// Classificação e normalização de VALORES de metadado — camada sem React, usada
// pelo modelo do pacote e pelos componentes de apresentação. Concentra aqui a
// regra de "o que é vazio" (seção 11 do guia de UX): nada de undefined, null,
// {} ou [] chegando na interface.

export type ValueType = "reference" | "service-reference" | "template" | "path" | "code" | "text" | "number" | "boolean"

export type PropertyEntry = {
    label   : string
    value   : string
    type    : ValueType
    // Referência a outro pacote (@/nome.ext) — a UI transforma em link navegável.
    refTarget? : string
}

export type PropertyGroup = {
    label   : string
    entries : PropertyEntry[]
    // "chips": lista de NOMES (params exigidos, bound-params de grupo) — numerar
    // essas entradas só cria ruído, então elas aparecem lado a lado.
    variant?: "grid" | "chips"
}

const REF_RE          = /^@\//
const SERVICE_REF_RE  = /^@@\//
const SELF_REF_RE     = /^@\/\//
const TEMPLATE_RE     = /\{\{\s*([^}]+?)\s*\}\}/g
const PATH_RE         = /[\\/]/

export const isScalar = (v:any):boolean =>
    v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"

// Vazio = ausente, string em branco, array sem itens ou objeto sem chaves.
export const isEmptyValue = (v:any):boolean => {
    if(v == null) return true
    if(typeof v === "string") return v.trim() === ""
    if(Array.isArray(v)) return v.length === 0
    if(typeof v === "object") return Object.keys(v).length === 0
    return false
}

export const isPackageReference = (v:any):boolean =>
    typeof v === "string" && REF_RE.test(v.trim()) && !SELF_REF_RE.test(v.trim())

export const isServiceReference = (v:any):boolean =>
    typeof v === "string" && SERVICE_REF_RE.test(v.trim())

export const isTemplateValue = (v:any):boolean => {
    TEMPLATE_RE.lastIndex = 0
    return typeof v === "string" && TEMPLATE_RE.test(v)
}

// Nomes das variáveis {{...}} usadas num valor (para saber se resolvem em params).
export const templateVariables = (v:any):string[] => {
    if(typeof v !== "string") return []
    const out:string[] = []
    let m:RegExpExecArray | null
    TEMPLATE_RE.lastIndex = 0
    while((m = TEMPLATE_RE.exec(v)) !== null) out.push(m[1])
    return out
}

// Pacote alvo de uma referência: "@/git-status.lib/services/GitStatusManager" →
// "git-status.lib". Retorna undefined para @@/ (instância local) e @// (o próprio).
export const referenceTarget = (v:any):string | undefined => {
    if(!isPackageReference(v)) return undefined
    const rest = String(v).trim().slice(2)
    const first = rest.split("/")[0]
    return first || undefined
}

export const classifyValue = (v:any):ValueType => {
    if(typeof v === "number")  return "number"
    if(typeof v === "boolean") return "boolean"
    const s = String(v == null ? "" : v)
    if(isPackageReference(s)) return "reference"
    if(isServiceReference(s)) return "service-reference"
    if(isTemplateValue(s))    return "template"
    if(PATH_RE.test(s) && !/\s/.test(s)) return "path"
    return "text"
}

export const formatValue = (v:any):string => {
    if(typeof v === "boolean") return v ? "true" : "false"
    if(v == null) return ""
    if(typeof v === "object") return JSON.stringify(v)
    return String(v)
}

export const toPropertyEntry = (label:string, value:any):PropertyEntry => {
    const type = classifyValue(value)
    return {
        label,
        value     : formatValue(value),
        type,
        refTarget : referenceTarget(value)
    }
}

// Converte um objeto em entradas chave→valor, DESCARTANDO as vazias. Objetos
// aninhados (ex.: bound-params.controller-params) são ACHATADOS em "pai.filho",
// para que cada valor apareça legível e copiável em vez de virar um JSON cru.
const MAX_DEPTH = 3

export const toPropertyEntries = (value:any, prefix = "", depth = 0):PropertyEntry[] => {
    if(isEmptyValue(value)) return []
    const key = (k:string) => prefix ? `${prefix}.${k}` : k

    if(Array.isArray(value))
        return value
            .filter((v) => !isEmptyValue(v))
            .reduce((acc:PropertyEntry[], v, i) =>
                isScalar(v) || depth >= MAX_DEPTH
                    ? acc.concat([toPropertyEntry(key(String(i + 1)), v)])
                    : acc.concat(toPropertyEntries(v, key(String(i + 1)), depth + 1)), [])

    if(typeof value === "object")
        return Object.keys(value)
            .filter((k) => !isEmptyValue(value[k]))
            .reduce((acc:PropertyEntry[], k) =>
                isScalar(value[k]) || depth >= MAX_DEPTH
                    ? acc.concat([toPropertyEntry(key(k), value[k])])
                    : acc.concat(toPropertyEntries(value[k], key(k), depth + 1)), [])

    return [toPropertyEntry(prefix || "valor", value)]
}

// Lista de nomes (["installDataDirPath", "?panelStateFilePath"]) → chips.
export const toChipGroup = (label:string, value:any):PropertyGroup[] => {
    if(!Array.isArray(value)) return []
    const entries = value
        .filter((v) => !isEmptyValue(v) && isScalar(v))
        .map((v) => toPropertyEntry(String(v), v))
    return entries.length ? [{ label, entries, variant: "chips" as const }] : []
}

// Grupo de propriedades; devolve [] quando não há nada a mostrar (a UI omite a
// seção inteira em vez de renderizar um cabeçalho vazio). Uma lista de nomes
// vira chips; o resto vira grade chave→valor.
export const toPropertyGroup = (label:string, value:any):PropertyGroup[] => {
    if(Array.isArray(value) && value.length > 0 && value.every(isScalar))
        return toChipGroup(label, value)
    const entries = toPropertyEntries(value)
    return entries.length ? [{ label, entries }] : []
}

// Coleta recursiva das referências @/ contidas num valor de metadado.
export const collectReferences = (node:any, out:string[] = []):string[] => {
    if(node == null) return out
    if(typeof node === "string"){
        const target = referenceTarget(node)
        if(target && out.indexOf(target) < 0) out.push(target)
        return out
    }
    if(Array.isArray(node)){ node.forEach((n) => collectReferences(n, out)); return out }
    if(typeof node === "object"){ Object.keys(node).forEach((k) => collectReferences(node[k], out)) }
    return out
}
