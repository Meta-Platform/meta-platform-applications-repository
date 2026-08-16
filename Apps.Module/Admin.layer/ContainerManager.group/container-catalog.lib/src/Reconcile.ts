/*
    Reconciliar o banco com o runtime (CTMG-69).

    Este app não é dono do Docker. Alguém vai criar container pela linha de
    comando, remover outro à mão, e mudar uma porta por fora — e tudo isso é
    legítimo. A pergunta não é como impedir; é o que fazer quando acontece.

    **O RUNTIME É A VERDADE SOBRE O QUE EXISTE.** Este banco acrescenta
    contexto. Quando divergem, quem manda é o runtime, e o resultado desta
    função é a lista das divergências — não uma correção automática.

    Corrigir sozinho seria pior: adotar um container alheio, ou apagar o
    registro de um container que só está temporariamente fora, são decisões que
    dependem de saber o que a pessoa quis. A função classifica; a tela pergunta.

    Três classificações:

      adopted  — container com a nossa label e SEM registro. Nasceu daqui e o
                 banco foi perdido, ou veio de outra instalação. Dá para
                 recuperar a procedência das próprias labels.
      missing  — registro sem container. Foi removido por fora.
      drifted  — os dois existem, mas o spec do container não é mais o que
                 gravamos. Alguém editou por fora.

    Função pura sobre listas: recebe o que o runtime respondeu e o que o banco
    tem. Não chama Docker nem SQL — o que a torna verificável inteira sem
    nenhum dos dois.
*/

const PREFIXO_DE_LABEL = "com.metaplatform.container-manager"

const EhGerenciado = (container: any) =>
    String(container?.Labels?.[`${PREFIXO_DE_LABEL}.managed`] || "") === "true"

/*
    Reconstrói a procedência a partir das labels. É o que torna a redundância
    entre banco e label útil de verdade: com o banco perdido, ainda se sabe de
    que receita o container nasceu.
*/
const ProcedenciaDasLabels = (container: any) => {
    const labels = container?.Labels || {}
    return {
        origin: labels[`${PREFIXO_DE_LABEL}.origin`] || "manual",
        recipeSlug: labels[`${PREFIXO_DE_LABEL}.recipe`] || null,
        recipeVersion: labels[`${PREFIXO_DE_LABEL}.recipe-version`] || null,
        serviceId: labels[`${PREFIXO_DE_LABEL}.service-id`] || null,
        stackName: labels[`${PREFIXO_DE_LABEL}.stack`] || null,
        stackServiceName: labels[`${PREFIXO_DE_LABEL}.stack-service`] || null,
        createdAt: labels[`${PREFIXO_DE_LABEL}.created-at`] || null
    }
}

/*
    Compara o que gravamos com o que o container tem HOJE.

    Só os campos que o usuário escolhe e que mudar importa. Comparar o spec
    inteiro acusaria divergência em todo container, porque o daemon preenche
    dezenas de padrões que nunca foram pedidos — e um aviso que aparece sempre
    é um aviso que ninguém lê.
*/
const CAMPOS_COMPARADOS = ["image", "ports", "mounts", "restart", "resources", "env"]

const Diferencas = (specGravado: any, specAtual: any) => {
    const diferentes = []

    for (const campo of CAMPOS_COMPARADOS) {
        const gravado = JSON.stringify(specGravado?.[campo] ?? null)
        const atual = JSON.stringify(specAtual?.[campo] ?? null)
        if (gravado !== atual) diferentes.push(campo)
    }

    return diferentes
}

/**
 * @param containers   o que o runtime listou (formato de ListAllContainers)
 * @param provenance   os registros de container_provenance desta conexão
 * @param specs        { [containerId]: spec }, quando já descritos — opcional.
 *                     Sem isso, `drifted` fica vazio: sem o spec atual não há
 *                     o que comparar, e inventar uma comparação seria pior.
 */
const ReconcileConnection = ({ containers = [], provenance = [], specs = {} }: {
    containers?: any[],
    provenance?: any[],
    specs?: Record<string, any>
}) => {
    const porId = new Map<string, any>(provenance.map((p) => [p.containerId, p]))
    const idsNoRuntime = new Set(containers.map((c) => c.Id))

    const adopted: any[] = []
    const drifted: any[] = []

    for (const container of containers) {
        const registro = porId.get(container.Id)

        if (!registro) {
            if (EhGerenciado(container)) {
                adopted.push({
                    containerId: container.Id,
                    containerName: (container.Names?.[0] || "").replace(/^\//, ""),
                    image: container.Image,
                    provenance: ProcedenciaDasLabels(container)
                })
            }
            continue
        }

        const specAtual = specs[container.Id]
        if (!specAtual || !registro.spec) continue

        const campos = Diferencas(registro.spec, specAtual)
        if (campos.length > 0) {
            drifted.push({
                containerId: container.Id,
                containerName: (container.Names?.[0] || "").replace(/^\//, ""),
                fields: campos
            })
        }
    }

    const missing = provenance
        .filter((p) => !idsNoRuntime.has(p.containerId))
        .map((p) => ({
            containerId: p.containerId,
            containerName: p.containerName,
            origin: p.origin,
            serviceId: p.serviceId
        }))

    return { adopted, missing, drifted }
}

module.exports = ReconcileConnection
module.exports.ReconcileConnection = ReconcileConnection
module.exports.ProcedenciaDasLabels = ProcedenciaDasLabels
module.exports.EhGerenciado = EhGerenciado
module.exports.PREFIXO_DE_LABEL = PREFIXO_DE_LABEL
