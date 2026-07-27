// Formatação de números de sistema — a mesma regra em todas as telas do painel.
//
// Um monitor mostra o mesmo dado em vários lugares (grid, medidor, gráfico,
// resumo). Se cada um formatar do seu jeito, a mesma instância aparece com
// "310 MB" aqui e "0.3 GB" ali, e o usuário desconfia do painel.

const UNITS = ["B", "KB", "MB", "GB", "TB"]

// Bytes com uma casa a partir de MB — abaixo disso a casa decimal é ruído.
export const FormatBytes = (bytes?: number): string => {
    if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "—"
    if (bytes < 1024) return `${bytes} B`

    let value = bytes
    let unitIndex = 0
    while (value >= 1024 && unitIndex < UNITS.length - 1) {
        value /= 1024
        unitIndex += 1
    }
    const decimals = unitIndex >= 2 && value < 100 ? 1 : 0
    return `${value.toFixed(decimals)} ${UNITS[unitIndex]}`
}

export const FormatPercent = (percent?: number, decimals = 1): string =>
    percent === undefined || percent === null || Number.isNaN(percent)
        ? "—"
        : `${percent.toFixed(decimals)}%`

// Duração no formato de monitor de sistema: 3d 04:12, 04:12:33, 12:33.
export const FormatDuration = (seconds?: number): string => {
    if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "—"

    const total   = Math.max(0, Math.floor(seconds))
    const days    = Math.floor(total / 86400)
    const hours   = Math.floor((total % 86400) / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const secs    = total % 60

    const pad = (value: number) => String(value).padStart(2, "0")

    if (days > 0)  return `${days}d ${pad(hours)}:${pad(minutes)}`
    if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    return `${pad(minutes)}:${pad(secs)}`
}

export const FormatClock = (epochMs?: number): string => {
    if (!epochMs) return "—"
    const date = new Date(epochMs)
    const pad = (value: number) => String(value).padStart(2, "0")
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export const FormatDateTime = (value?: string | number | Date): string => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    const pad = (part: number) => String(part).padStart(2, "0")
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// Nome curto do pacote: o caminho inteiro não cabe numa coluna e o que
// identifica a instância é a última parte.
export const PackageName = (packagePath?: string): string => {
    if (!packagePath) return "—"
    return packagePath.split("/").filter(Boolean).pop() || packagePath
}

// Segundos desde um instante — usado para uptime quando o daemon não mediu.
export const SecondsSince = (value?: string | number | Date): number | undefined => {
    if (!value) return undefined
    const started = new Date(value).getTime()
    if (Number.isNaN(started)) return undefined
    return Math.max(0, Math.round((Date.now() - started) / 1000))
}
