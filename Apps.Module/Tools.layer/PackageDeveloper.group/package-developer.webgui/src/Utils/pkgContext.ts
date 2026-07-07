// Deriva o contexto (repo › módulo › layer › grupo) de um pacote a partir do path,
// e uma COR estável por (repo+módulo+layer) — para identificar visualmente pacotes
// de origens diferentes no editor multi-pacote.

// Cor estável (HSL) a partir de uma chave — mesma chave → mesma cor.
export const colorForKey = (key:string):string => {
    let h = 0
    for(let i = 0; i < (key || "").length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
    return `hsl(${h % 360}, 62%, 52%)`
}

export type PkgContext = {
    repo: string
    module?: string
    layer?: string
    group?: string
    colorKey: string
    color: string
    breadcrumb: string
}

export const pkgContext = (pkg:any):PkgContext => {
    const repo = pkg && pkg.workspace ? pkg.workspace : "?"
    const segs = (pkg && pkg.path ? String(pkg.path) : "").split("/").filter(Boolean)
    const module = segs.find((s) => s.endsWith(".Module"))
    const layer  = segs.find((s) => s.endsWith(".layer"))
    const group  = segs.find((s) => s.endsWith(".group"))
    const colorKey = `${repo}|${module || ""}|${layer || ""}`
    const parts = [repo, module, layer, group].filter(Boolean)
    return { repo, module, layer, group, colorKey, color: colorForKey(colorKey), breadcrumb: parts.join(" › ") }
}
