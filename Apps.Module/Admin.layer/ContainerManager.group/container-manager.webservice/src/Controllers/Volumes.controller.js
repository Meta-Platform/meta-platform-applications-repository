/*
    Controller de VOLUMES, sempre no contexto de uma conexão.

    As operações de arquivo (listar, enviar, baixar, apagar) custam um container
    efêmero cada, porque volume nomeado não é diretório acessível de fora do
    runtime. Quem paga esse custo é o adaptador; aqui só se expõe.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess")
const { EnsureFits } = require("../Helpers/InlineSizeLimit")

const VolumesController = (params) => {

    const {
        containerRuntimeConnectionService,
        containerCatalogLib,
        appDataDir,
        dbFilePath,
        secretKeyPath,
        stacksDir
    } = params

    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const GetContext = require("../AppContext")
    const contexto = GetContext({
        containerCatalogLib, appDataDir, dbFilePath, secretKeyPath, stacksDir
    })

    const RegistrarAtividade = async (dados) => {
        try {
            const store = await contexto.GetStoreOrNull()
            if (store) await store.RecordActivity(dados)
        } catch (erro) {
            console.error("Falha ao registrar atividade:", erro)
        }
    }

    const _ListVolumes = (connectionId) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ListAllVolumes())

    const _InspectVolume = ({ connectionId, volumeName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.InspectVolume(volumeName))

    const _CreateVolume = ({ connectionId, options }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.CreateNewVolume(options))

    // `force` chegou ao adaptador em CTMG-49; aqui ele passa a ser oferecido.
    // Sem forçar, o runtime recusa remover volume que algum container declara —
    // e essa recusa é informação, não obstáculo.
    const _RemoveVolume = ({ connectionId, volumeName, force = false }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.RemoveVolume({ volumeName, force }))

    const _ListVolumeEntries = ({ connectionId, volumeName, path }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ListVolumeEntries({ volumeName, path }))

    const _GetFileFromVolume = ({ connectionId, volumeName, path }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.GetFileFromVolume({ volumeName, path }))

    const _PutFileInVolume = ({ connectionId, volumeName, path, fileName, contentBase64 }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.PutFileInVolume({
            volumeName,
            path,
            fileName,
            contentBase64
        }))

    const _DeleteVolumeEntry = ({ connectionId, volumeName, path }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.DeleteVolumeEntry({ volumeName, path }))

    const _MakeVolumeDirectory = async ({ connectionId, volumeName, path }) =>
        await WithAdapter(connectionId, (a) => a.MakeVolumeDirectory({ volumeName, path }))

    /* ==================================================== volumes de ponta a
                                                            ponta (E8) */

    /*
        TAMANHO E QUEM USA (CTMG-100).

        Medir custa um container efêmero — não é lista, é consulta sob demanda.
        Chamar isto para cada linha da tabela transformaria abrir a tela de
        volumes em subir dez containers.
    */
    const _GetVolumeUsage = ({ connectionId, volumeName }) =>
        WithAdapter(connectionId, (a) => a.GetVolumeUsage(volumeName))

    /*
        BACKUP (CTMG-101).

        O tamanho é conferido ANTES de empacotar: o tar.gz inteiro passa pela
        memória do servidor e depois pela da aba, inflado em base64. Um volume
        de banco de dados estoura isso sem aviso.

        A medição é do conteúdo cru; o gzip vai comprimir, então o teto é
        conservador — e é assim que deve ser: recusar um backup que caberia é
        um aborrecimento, deixar passar um que derruba o processo é perder o
        trabalho.
    */
    const _ExportVolume = async ({ connectionId, volumeName }) => {
        const uso = await WithAdapter(connectionId, (a) => a.GetVolumeUsage(volumeName))
        EnsureFits({ sizeBytes: uso.sizeBytes, what: `O volume ${volumeName}` })

        const resultado = await WithAdapter(connectionId, (a) => a.ExportVolume(volumeName))

        await RegistrarAtividade({
            connectionId,
            action: "volume.export",
            targetType: "volume",
            targetId: volumeName,
            targetName: volumeName,
            result: "ok",
            details: { sizeBytes: uso.sizeBytes, fileCount: uso.fileCount }
        })

        return resultado
    }

    const _ImportVolume = async ({ connectionId, volumeName, contentBase64, clear, force }) => {
        EnsureFits({
            sizeBytes: Math.floor(String(contentBase64 || "").length * 0.75),
            what: "O backup enviado"
        })

        const resultado = await WithAdapter(connectionId, (a) =>
            a.ImportVolume({ volumeName, contentBase64, clear, force }))

        await RegistrarAtividade({
            connectionId,
            action: "volume.import",
            targetType: "volume",
            targetId: volumeName,
            targetName: volumeName,
            result: "ok",
            details: { clear: Boolean(clear), force: Boolean(force), created: resultado.created }
        })

        return resultado
    }

    const _CloneVolume = async ({ connectionId, sourceVolumeName, targetVolumeName, force }) => {
        const resultado = await WithAdapter(connectionId, (a) =>
            a.CloneVolume({ sourceVolumeName, targetVolumeName, force }))

        await RegistrarAtividade({
            connectionId,
            action: "volume.clone",
            targetType: "volume",
            targetId: targetVolumeName,
            targetName: targetVolumeName,
            result: "ok",
            details: { from: sourceVolumeName }
        })

        return resultado
    }

    const _EmptyVolume = async ({ connectionId, volumeName, force }) => {
        const resultado = await WithAdapter(connectionId, (a) => a.EmptyVolume({ volumeName, force }))

        await RegistrarAtividade({
            connectionId,
            action: "volume.empty",
            targetType: "volume",
            targetId: volumeName,
            targetName: volumeName,
            result: "ok",
            details: { force: Boolean(force) }
        })

        return resultado
    }

    const _PruneVolumes = async ({ connectionId, filters }) => {
        const resultado = await WithAdapter(connectionId, (a) => a.PruneVolumes({ filters }))

        await RegistrarAtividade({
            connectionId,
            action: "volume.prune",
            targetType: "volume",
            result: "ok",
            details: {
                removed: (resultado.VolumesDeleted || []).length,
                reclaimed: resultado.SpaceReclaimed
            }
        })

        return resultado
    }

    const controllerServiceObject = {
        controllerName: "VolumesController",
        GetVolumeUsage: _GetVolumeUsage,
        ExportVolume: _ExportVolume,
        ImportVolume: _ImportVolume,
        CloneVolume: _CloneVolume,
        EmptyVolume: _EmptyVolume,
        PruneVolumes: _PruneVolumes,
        MakeVolumeDirectory: _MakeVolumeDirectory,
        ListVolumes: _ListVolumes,
        InspectVolume: _InspectVolume,
        CreateVolume: _CreateVolume,
        RemoveVolume: _RemoveVolume,
        ListVolumeEntries: _ListVolumeEntries,
        GetFileFromVolume: _GetFileFromVolume,
        PutFileInVolume: _PutFileInVolume,
        DeleteVolumeEntry: _DeleteVolumeEntry
    }

    return controllerServiceObject
}

module.exports = VolumesController
