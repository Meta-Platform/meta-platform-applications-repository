const os     = require("os")
const path   = require("path")
const crypto = require("crypto")

// Expande "~" para o home do usuário (mesmo padrão de workspace-store.lib).
const ConvertPathToAbsolutPath = (_path) =>
    path.join(_path).replace("~", os.homedir())

const NewId = () => crypto.randomUUID()

const NowISO = () => new Date().toISOString()

// slug url-safe a partir de um texto livre.
const Slugify = (text) =>
    String(text || "")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "item"

// Prefixo de key (ex.: "Meta Platform" -> "MP"); usa iniciais, min 2 chars.
// Valor ANTERIOR dos campos que um patch vai alterar (para o diff da auditoria).
const PatchDiff = (instance, patch) => {
    const before = {}
    for(const key of Object.keys(patch || {})) before[key] = instance[key]
    return before
}

const DeriveKeyPrefix = (name) => {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean)
    let prefix = words.map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "")
    if(prefix.length < 2) prefix = String(name || "MPM").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3)
    return (prefix || "MPM").slice(0, 5)
}

// Sanitiza um nome de arquivo (remove path traversal e chars perigosos).
const SanitizeFileName = (name) =>
    String(name || "file")
        .replace(/[/\\]/g, "_")
        .replace(/\.\.+/g, "_")
        .replace(/[^A-Za-z0-9._ -]/g, "_")
        .trim() || "file"

const Sha256OfBuffer = (buffer) =>
    crypto.createHash("sha256").update(buffer).digest("hex")

// Converte instância Sequelize (ou objeto) em JSON plano com datas ISO.
const Serialize = (instance) => {
    if(instance === null || instance === undefined) return instance
    const obj = typeof instance.toJSON === "function" ? instance.toJSON() : { ...instance }
    for(const key of Object.keys(obj)){
        const value = obj[key]
        if(value instanceof Date) obj[key] = value.toISOString()
    }
    return obj
}

const SerializeMany = (list) => list.map(Serialize)

module.exports = {
    ConvertPathToAbsolutPath,
    NewId,
    NowISO,
    Slugify,
    DeriveKeyPrefix,
    PatchDiff,
    SanitizeFileName,
    Sha256OfBuffer,
    Serialize,
    SerializeMany
}
