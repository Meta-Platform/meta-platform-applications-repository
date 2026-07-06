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
