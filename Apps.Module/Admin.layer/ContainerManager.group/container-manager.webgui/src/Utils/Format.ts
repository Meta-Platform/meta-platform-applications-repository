/*
    Formatação dos dados que o runtime devolve.

    O runtime fala em bytes, epoch e nomes com barra na frente. A tela fala em
    "1,2 GB", "há 3 dias" e "meu-container".
*/

export const FormatBytes = (bytes: number): string => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return "—"
    if (bytes < 1024) return `${bytes} B`
    const unidades = ["KB", "MB", "GB", "TB"]
    let valor = bytes / 1024
    let indice = 0
    while (valor >= 1024 && indice < unidades.length - 1) {
        valor = valor / 1024
        indice++
    }
    return `${valor.toFixed(valor >= 100 ? 0 : 1).replace(".", ",")} ${unidades[indice]}`
}

export const FormatEpoch = (epochSegundos: number): string => {
    if (!epochSegundos) return "—"
    return new Date(epochSegundos * 1000).toLocaleString("pt-BR")
}

export const FormatDate = (iso: string): string => {
    if (!iso) return "—"
    const data = new Date(iso)
    return isNaN(data.getTime()) ? iso : data.toLocaleString("pt-BR")
}

// O runtime devolve nomes de container com "/" na frente (herança da API).
export const ContainerName = (container: any): string => {
    const nomes = container?.Names || []
    const primeiro = nomes[0] || container?.Name || container?.Id || ""
    return String(primeiro).replace(/^\//, "")
}

export const ShortId = (id: string, tamanho = 12): string =>
    typeof id === "string" ? id.replace(/^sha256:/, "").slice(0, tamanho) : "—"

export const ImageTag = (imagem: any): string => {
    const tags = imagem?.RepoTags || []
    const util = tags.find((tag: string) => tag && tag !== "<none>:<none>")
    return util || `<sem tag> ${ShortId(imagem?.Id)}`
}

/*
    Portas publicadas, na forma que se lê: "8080→80/tcp". Porta sem host não
    está publicada e não interessa a quem procura como acessar o serviço.
*/
export const FormatPorts = (container: any): string => {
    const portas = container?.Ports || []
    const publicadas: string[] = portas
        .filter((porta: any) => porta.PublicPort)
        .map((porta: any) => `${porta.PublicPort}→${porta.PrivatePort}/${porta.Type || "tcp"}`)
    // A mesma porta aparece repetida quando o runtime publica em IPv4 e IPv6.
    const semRepeticao = publicadas.filter((porta, indice) => publicadas.indexOf(porta) === indice)
    return semRepeticao.length > 0 ? semRepeticao.join(", ") : "—"
}

/*
    O estado do container vira token de status do design system, para a tela
    nunca depender só de cor.
*/
export const ContainerStatusToken = (estado: string): string => {
    switch (String(estado || "").toLowerCase()) {
        case "running": return "ACTIVE"
        case "restarting": return "STARTING"
        case "paused": return "STOPPING"
        case "created": return "PREPPED_TO_START"
        case "exited": return "FINISHED"
        case "dead": return "FAILURE"
        case "removing": return "STOPPING"
        default: return "TERMINATED"
    }
}

export const NetworkNames = (container: any): string => {
    const redes = container?.NetworkSettings?.Networks
    if (!redes) return "—"
    const nomes = Object.keys(redes)
    return nomes.length > 0 ? nomes.join(", ") : "—"
}
