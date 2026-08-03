/*
    Controller de VOLUMES, sempre no contexto de uma conexão.

    As operações de arquivo (listar, enviar, baixar, apagar) custam um container
    efêmero cada, porque volume nomeado não é diretório acessível de fora do
    runtime. Quem paga esse custo é o adaptador; aqui só se expõe.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess")

const VolumesController = (params) => {

    const { containerRuntimeConnectionService } = params
    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const _ListVolumes = (connectionId) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ListAllVolumes())

    const _InspectVolume = ({ connectionId, volumeName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.InspectVolume(volumeName))

    const _CreateVolume = ({ connectionId, options }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.CreateNewVolume(options))

    const _RemoveVolume = ({ connectionId, volumeName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.RemoveVolume(volumeName))

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

    const controllerServiceObject = {
        controllerName: "VolumesController",
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
