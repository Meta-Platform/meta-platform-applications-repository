// Schema dos metadados do Meta Platform: define, por entidade, os campos com TIPO e
// OBRIGATORIEDADE, e as funções de validação. Inferido do uso atual + convenções
// (referências @/ e @@/). Fonte única — importado pelas árvores e pelos forms.

export type FieldType = "string" | "number" | "boolean" | "reference" | "path" | "keyvalue" | "stringlist" | "enum"

export type Field = {
    key: string
    label: string
    type?: FieldType
    required?: boolean
    enum?: string[]
    placeholder?: string
}

// ---- Field-sets por entidade ----
// namespace = instância de serviço (@@/...); dependency = pacote (@/...).
export const F_BOOT_SERVICE: Field[] = [
    { key:"namespace",    label:"namespace",    type:"reference", required:true, placeholder:"@@/service-name" },
    { key:"dependency",   label:"dependency",   type:"reference", required:true, placeholder:"@/name.service" },
    { key:"params",       label:"params",       type:"keyvalue" },
    { key:"bound-params", label:"bound-params", type:"keyvalue" }
]
export const F_SERVICE: Field[] = [
    { key:"namespace",    label:"namespace",    type:"reference", required:true, placeholder:"@@/service-name" },
    { key:"path",         label:"path",         type:"path",      required:true },
    { key:"bound-params", label:"bound-params", type:"stringlist" },
    { key:"params",       label:"params",       type:"stringlist" }
]
export const F_BOOT_ENDPOINT: Field[] = [
    { key:"dependency",   label:"dependency",   type:"reference", required:true, placeholder:"@/name.webservice" },
    { key:"bound-params", label:"bound-params", type:"keyvalue" }
]
export const F_EG_ENDPOINT: Field[] = [
    { key:"url",          label:"url",          type:"string", required:true },
    { key:"type",         label:"type",         type:"string", required:true },
    { key:"params",       label:"params",       type:"keyvalue" },
    { key:"bound-params", label:"bound-params", type:"keyvalue" }
]
export const F_EXECUTABLE: Field[] = [
    { key:"executableName", label:"executableName", type:"string",    required:true },
    { key:"dependency",     label:"dependency",     type:"reference", required:true, placeholder:"@/name.cli" }
]
export const F_WINDOW: Field[] = [
    { key:"title",        label:"title",        type:"string",    required:true },
    { key:"dependency",   label:"dependency",   type:"reference", required:true, placeholder:"@/name.webgui" },
    { key:"width",        label:"width",        type:"number" },
    { key:"height",       label:"height",       type:"number" },
    { key:"params",       label:"params",       type:"keyvalue" },
    { key:"bound-params", label:"bound-params", type:"keyvalue" }
]

// ---- Validação ----
export type Issue = { level: "error" | "warning", message: string }

const isEmpty = (v:any) => v == null || v === "" || (Array.isArray(v) && v.length === 0)

export const validateField = (f:Field, value:any):Issue | null => {
    if(f.required && isEmpty(value)) return { level:"error", message:"Campo obrigatório" }
    if(isEmpty(value)) return null
    if(f.type === "number"){
        const n = Number(value)
        if(value === "" || isNaN(n)) return { level:"error", message:"Deve ser um número" }
    }
    if(f.type === "reference" && typeof value === "string" && !/^@@?\//.test(value.trim()))
        return { level:"warning", message:"Referência deve começar com @/ ou @@/" }
    if(f.type === "enum" && f.enum && f.enum.indexOf(value) < 0)
        return { level:"error", message:`Valor inválido (use: ${f.enum.join(", ")})` }
    return null
}

// Valida um registro (objeto) contra um field-set → issues por campo.
export const validateRecord = (fields:Field[], value:any):{ key:string, issue:Issue }[] =>
    (fields || []).reduce((acc:any[], f) => {
        const issue = validateField(f, value && value[f.key])
        if(issue) acc.push({ key: f.key, issue })
        return acc
    }, [])

// Valida um arquivo de metadado inteiro → lista de problemas {path, message, level}.
// path é um rótulo legível (ex.: "services[0].namespace").
export const validateMetadataFile = (filePath:string, content:string):{ path:string, message:string, level:"error"|"warning" }[] => {
    let obj:any
    try { obj = typeof content === "string" ? JSON.parse(content) : content } catch(e) { return [] }
    const out:{ path:string, message:string, level:"error"|"warning" }[] = []
    const base = (filePath || "").split("/").pop() || ""

    const checkList = (list:any, fields:Field[], label:string) => {
        if(!Array.isArray(list)) return
        list.forEach((item:any, i:number) => {
            validateRecord(fields, item).forEach(({ key, issue }) =>
                out.push({ path: `${label}[${i}].${key}`, message: issue.message, level: issue.level }))
        })
    }

    if(base === "boot.json"){
        checkList(obj && obj.services, F_BOOT_SERVICE, "services")
        checkList(obj && obj.endpoints, F_BOOT_ENDPOINT, "endpoints")
        checkList(obj && obj.windows, F_WINDOW, "windows")
        checkList(obj && obj.executables, F_EXECUTABLE, "executables")
    } else if(base === "services.json"){
        checkList(obj, F_SERVICE, "services")
    } else if(base === "endpoint-group.json"){
        checkList(obj && obj.endpoints, F_EG_ENDPOINT, "endpoints")
    }
    return out
}
