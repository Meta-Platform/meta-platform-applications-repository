// Operações puras de edição usadas pelos editores estruturados de metadados.
// Regra de ouro: preservar campos não modelados (spread) — a edição via formulário
// NUNCA descarta chaves que o formulário não conhece.

export const setKey = (obj:any, key:string, val:any) =>
    ({ ...(obj && typeof obj === "object" ? obj : {}), [key]: val })

export const patchRecord = (list:any[], i:number, key:string, val:any) =>
    (list || []).map((it:any, j:number) => j === i ? { ...it, [key]: val } : it)

export const addRecord = (list:any[], item:any) =>
    [ ...(list || []), { ...(item || {}) } ]

export const removeRecord = (list:any[], i:number) =>
    (list || []).filter((_:any, j:number) => j !== i)

export const moveRecord = (list:any[], i:number, delta:number) => {
    const arr = [ ...(list || []) ]
    const j = i + delta
    if(j < 0 || j >= arr.length) return arr
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
    return arr
}

export const setListItem = (list:string[], i:number, v:string) =>
    (list || []).map((x:string, j:number) => j === i ? v : x)

export const addListItem = (list:string[], v:string = "") =>
    [ ...(list || []), v ]

export const removeListItem = (list:string[], i:number) =>
    (list || []).filter((_:string, j:number) => j !== i)

// ---- Editor de objeto (chave→valor). Trabalha sobre pares [chave, valor] para
// preservar ordem e o foco do input ao renomear a chave. ----

export const objectToEntries = (obj:any):any[] =>
    (obj && typeof obj === "object" && !Array.isArray(obj)) ? Object.keys(obj).map((k) => [k, obj[k]]) : []

export const entriesToObject = (entries:any[]):any => {
    const out:any = {}
    ;(entries || []).forEach(([k, v]:any) => { out[k] = v })
    return out
}

export const setEntryKey = (entries:any[], i:number, k:string) =>
    (entries || []).map((en:any, j:number) => j === i ? [k, en[1]] : en)

export const setEntryValue = (entries:any[], i:number, v:any) =>
    (entries || []).map((en:any, j:number) => j === i ? [en[0], v] : en)

export const addEntry = (entries:any[]) => [ ...(entries || []), ["", ""] ]

export const removeEntryAt = (entries:any[], i:number) =>
    (entries || []).filter((_:any, j:number) => j !== i)

// Coage a número quando o texto é numérico (para campos como width/height, que
// NÃO podem virar string no JSON). Vazio/inválido mantém o valor original.
export const coerceNumber = (v:any) => {
    if(v === "" || v == null) return v
    const n = Number(v)
    return Number.isNaN(n) ? v : n
}

// Um valor é "editável como texto" no formulário (string/número/bool/nulo);
// objetos e arrays aninhados são preservados como estão.
export const isScalar = (v:any) =>
    v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"
