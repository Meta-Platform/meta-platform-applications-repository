const os     = require("os") as typeof import("os")
const path   = require("path") as typeof import("path")
const crypto = require("crypto") as typeof import("crypto")

// Expande "~" para o home do usuário (mesmo padrão de workspace-store.lib).
const ConvertPathToAbsolutPath = (_path: any) =>
    path.join(_path).replace("~", os.homedir())

const NewId = () => crypto.randomUUID()

const NowISO = () => new Date().toISOString()

// slug url-safe a partir de um texto livre.
const Slugify = (text: any) =>
    String(text || "")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "item"

// Prefixo de key (ex.: "Meta Platform" -> "MP"); usa iniciais, min 2 chars.
// Valor ANTERIOR dos campos que um patch vai alterar (para o diff da auditoria).
const PatchDiff = (instance: any, patch: any) => {
    const before: any = {}
    for(const key of Object.keys(patch || {})) before[key] = instance[key]
    return before
}

const DeriveKeyPrefix = (name: any) => {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean)
    let prefix = words.map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "")
    if(prefix.length < 2) prefix = String(name || "MPM").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3)
    return (prefix || "MPM").slice(0, 5)
}

// Descrição curta (<=240 chars) — projeto, board, marco, sprint e ITEM usam o
// MESMO limite; a regra fica aqui para os quatro não divergirem.
const AssertShortDescription = (value: any) => {
    if(value === undefined || value === null || value === "") return
    const { SHORT_DESCRIPTION_MAX } = require("../Config")
    const { DomainError } = require("../Errors")
    if(String(value).length > SHORT_DESCRIPTION_MAX)
        throw new DomainError("VALIDATION_ERROR",
            `Descrição curta excede ${SHORT_DESCRIPTION_MAX} caracteres.`,
            { field: "shortDescription", max: SHORT_DESCRIPTION_MAX })
}

// Normaliza uma lista de rótulos: aceita array, string separada por vírgulas ou
// o JSON cru da coluna (consulta `raw: true` não desserializa a coluna JSON).
// Tira espaços, remove vazios e duplicatas (case-insensitive, mantendo a 1ª grafia).
const NormalizeLabels = (labels: any) => {
    if(labels === undefined || labels === null) return undefined
    let source = labels
    if(typeof source === "string" && source.trim().startsWith("[")){
        try { source = JSON.parse(source) } catch(e: any){ /* não era JSON: trata como lista por vírgulas */ }
    }
    const raw = Array.isArray(source) ? source : String(source).split(",")
    const seen = new Set()
    const out = []
    for(const entry of raw){
        const label = String(entry === null || entry === undefined ? "" : entry).trim()
        if(!label) continue
        const key = label.toLowerCase()
        if(seen.has(key)) continue
        seen.add(key)
        out.push(label)
    }
    return out
}

// Sanitiza um nome de arquivo (remove path traversal e chars perigosos).
const SanitizeFileName = (name: any) =>
    String(name || "file")
        .replace(/[/\\]/g, "_")
        .replace(/\.\.+/g, "_")
        .replace(/[^A-Za-z0-9._ -]/g, "_")
        .trim() || "file"

const Sha256OfBuffer = (buffer: any) =>
    crypto.createHash("sha256").update(buffer).digest("hex")

// Converte instância Sequelize (ou objeto) em JSON plano com datas ISO.
const Serialize = (instance: any) => {
    if(instance === null || instance === undefined) return instance
    const obj = typeof instance.toJSON === "function" ? instance.toJSON() : { ...instance }
    for(const key of Object.keys(obj)){
        const value = obj[key]
        if(value instanceof Date) obj[key] = value.toISOString()
    }
    return obj
}

const SerializeMany = (list: any) => list.map(Serialize)

module.exports = {
    ConvertPathToAbsolutPath,
    NewId,
    NowISO,
    Slugify,
    DeriveKeyPrefix,
    PatchDiff,
    AssertShortDescription,
    NormalizeLabels,
    SanitizeFileName,
    Sha256OfBuffer,
    Serialize,
    SerializeMany
}
