import * as React from "react"

// Coleta recursiva de todas as strings de um valor de metadata.
const collectStrings = (node:any, out:string[]) => {
    if(node == null) return
    if(typeof node === "string"){ out.push(node); return }
    if(Array.isArray(node)){ node.forEach((n) => collectStrings(n, out)); return }
    if(typeof node === "object"){ Object.keys(node).forEach((k) => collectStrings(node[k], out)) }
}

// Extrai os pacotes referenciados via `@/<pacote>/...` nos metadados (boot/services/
// endpoint-group/command-group). Ignora `@@/` (instâncias de serviço internas) e
// `@//` (auto-referência ao próprio pacote). Retorna namespaces únicos, ordenados.
export const extractPackageRefs = (metadata:any):string[] => {
    const strings:string[] = [];
    ["metadata/boot.json", "metadata/services.json", "metadata/endpoint-group.json", "metadata/command-group.json"]
        .forEach((k) => collectStrings(metadata && metadata[k], strings))
    const set:{[k:string]:boolean} = {}
    strings.forEach((s) => {
        const m = /^@\/([^/@][^/]*)/.exec(s)   // 1º segmento após @/ (não @@/, não @//)
        if(m && m[1]) set[m[1]] = true
    })
    return Object.keys(set).sort()
}

const truncate = (s:string, n:number) => s.length > n ? s.slice(0, n - 1) + "…" : s

// Grafo hub→lista (SVG leve, sem dependência externa): nó central = este pacote;
// à direita, os pacotes que ele referencia via @/.
const DependencyGraph = ({ metadata, pkg }:any) => {
    const refs = extractPackageRefs(metadata)
    // Sem dependências entre pacotes → não renderiza card vazio.
    if(refs.length === 0) return null

    const selfLabel = `${pkg.name}.${pkg.ext}`

    const rowH = 46, top = 24, leftX = 12, nodeW = 150, rightX = 210, depW = 150
    const H = Math.max(120, refs.length * rowH + top)
    const leftY = H / 2

    return <svg viewBox={`0 0 ${rightX + depW + 12} ${H}`} width="100%" style={{maxHeight:420, display:"block"}}>
                {
                    refs.map((r, i) => {
                        const y = top + i * rowH + 15
                        return <path key={"e" + i}
                            d={`M ${leftX + nodeW} ${leftY} C ${leftX + nodeW + 30} ${leftY}, ${rightX - 30} ${y}, ${rightX} ${y}`}
                            style={{ fill:"none", stroke:"var(--mp-line-faint, #9aa4b2)", strokeWidth:1.5 }} />
                    })
                }
                <g>
                    <rect x={leftX} y={leftY - 16} width={nodeW} height={32} rx={7}
                        style={{ fill:"var(--mp-accent, #14D6C8)" }} />
                    <text x={leftX + nodeW / 2} y={leftY + 4} textAnchor="middle" fontSize={11} fontWeight={700}
                        style={{ fill:"var(--mp-accent-ink, #06231f)" }}>{truncate(selfLabel, 22)}</text>
                </g>
                {
                    refs.map((r, i) => {
                        const y = top + i * rowH + 15
                        return <g key={"n" + i}>
                            <rect x={rightX} y={y - 15} width={depW} height={30} rx={6}
                                style={{ fill:"var(--mp-panel-raised, #eef1f5)", stroke:"var(--mp-line-faint, #9aa4b2)" }} />
                            <text x={rightX + 10} y={y + 4} fontSize={10.5}
                                style={{ fill:"var(--mp-text-primary, #1b2430)" }}>{truncate(r, 24)}</text>
                        </g>
                    })
                }
            </svg>
}

export default DependencyGraph
