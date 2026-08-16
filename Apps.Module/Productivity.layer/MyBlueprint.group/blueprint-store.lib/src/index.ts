const fs = require("fs")
const path = require("path")
const sqlite3 = require("sqlite3")

const STATES = ["inbox", "backlog", "planned", "done", "archived"]
const TYPES = ["idea", "note", "task"]
const PRIORITIES = ["none", "low", "medium", "high", "critical"]

const initialize = (db: any) => new Promise<void>((resolve, reject) => db.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'inbox', priority TEXT NOT NULL DEFAULT 'none', tags TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'manual', actor TEXT, mpm_reference TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, item_id TEXT, action TEXT NOT NULL, source TEXT NOT NULL, actor TEXT, created_at TEXT NOT NULL);
`, (error: any) => error ? reject(error) : resolve()))

const asPromise = (db: any, method: any, ...args: any[]): Promise<any> => new Promise((resolve, reject) => db[method](...args, function(this: any, error: any, value: any) {
  if(error) return reject(error)
  resolve(method === "run" ? { changes: this.changes, lastID: this.lastID } : value)
}))
const safeJson = (value: any, fallback: any) => { try { return JSON.parse(value) } catch(_: any) { return fallback } }
const normalize = (row: any) => row && ({ ...row, tags: safeJson(row.tags, []), actor: safeJson(row.actor, undefined) })
const now = () => new Date().toISOString()
const id = () => `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const value = (input: any, allowed: any, fallback: any) => allowed.includes(input) ? input : fallback

const InitializeBlueprintStore = async ({ storage }: any) => {
  const filePath = path.resolve(storage.replace(/^~(?=$|\/)/, process.env.HOME || ""))
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new sqlite3.Database(filePath)
  await initialize(db)

  const audit = async ({ itemId, action, source = "manual", actor }: any) => {
    await asPromise(db, "run", "INSERT INTO audit (id,item_id,action,source,actor,created_at) VALUES (?,?,?,?,?,?)", [id(), itemId || null, action, source, actor ? JSON.stringify(actor) : null, now()])
  }
  const get = async (itemId: any) => {
    const row = await asPromise(db, "get", "SELECT * FROM items WHERE id = ?", [itemId])
    if(!row) { const error = new Error("Item não encontrado") as any; error.code = "NOT_FOUND"; throw error }
    return normalize(row)
  }
  const CreateItem = async (input: any = {}, context: any = {}) => {
    const title = String(input.title || input.body || "").trim()
    if(!title) { const error = new Error("Título ou conteúdo é obrigatório") as any; error.code = "VALIDATION_ERROR"; throw error }
    const item = { id: id(), type: value(input.type, TYPES, "idea"), title, body: String(input.body || ""), status: value(input.status, STATES, "inbox"), priority: value(input.priority, PRIORITIES, "none"), tags: Array.from(new Set((input.tags || []).map((tag: any) => String(tag).trim()).filter(Boolean))), source: context.source || input.source || "manual", actor: context.actor, mpmReference: input.mpmReference || null, createdAt: now(), updatedAt: now() }
    await asPromise(db, "run", "INSERT INTO items (id,type,title,body,status,priority,tags,source,actor,mpm_reference,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [item.id,item.type,item.title,item.body,item.status,item.priority,JSON.stringify(item.tags),item.source,item.actor ? JSON.stringify(item.actor) : null,item.mpmReference,item.createdAt,item.updatedAt])
    await audit({ itemId: item.id, action: "created", source: item.source, actor: item.actor })
    return get(item.id)
  }
  const ListItems = async (filters: any = {}) => {
    const where = [], params = []
    if(filters.status) { where.push("status = ?"); params.push(filters.status) }
    if(filters.type) { where.push("type = ?"); params.push(filters.type) }
    if(filters.query) { where.push("(title LIKE ? OR body LIKE ? OR tags LIKE ?)"); const q = `%${filters.query}%`; params.push(q,q,q) }
    const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 200)
    const rows = await asPromise(db, "all", `SELECT * FROM items ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY CASE status WHEN 'inbox' THEN 0 WHEN 'backlog' THEN 1 WHEN 'planned' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, updated_at DESC LIMIT ?`, [...params, limit])
    return rows.map(normalize)
  }
  const UpdateItem = async (itemId: any, patch: any = {}, context: any = {}) => {
    const current = await get(itemId)
    const next = { ...current, ...patch, type: value(patch.type || current.type, TYPES, current.type), status: value(patch.status || current.status, STATES, current.status), priority: value(patch.priority || current.priority, PRIORITIES, current.priority), tags: patch.tags ? Array.from(new Set(patch.tags.map(String))) : current.tags, updatedAt: now() }
    await asPromise(db, "run", "UPDATE items SET type=?,title=?,body=?,status=?,priority=?,tags=?,mpm_reference=?,updated_at=? WHERE id=?", [next.type, String(next.title || "").trim() || current.title, String(next.body || ""), next.status, next.priority, JSON.stringify(next.tags), next.mpmReference || null, next.updatedAt, itemId])
    await audit({ itemId, action: "updated", source: context.source || "manual", actor: context.actor })
    return get(itemId)
  }
  const ArchiveItem = (itemId: any, context: any) => UpdateItem(itemId, { status: "archived" }, context)
  const GetSetting = async (key: any) => { const row = await asPromise(db, "get", "SELECT value FROM settings WHERE key=?", [key]); return row ? safeJson(row.value, row.value) : undefined }
  const SetSetting = async (key: any, settingValue: any) => { await asPromise(db, "run", "INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", [key, JSON.stringify(settingValue), now()]) }
  return { CreateItem, ListItems, GetItem: get, UpdateItem, ArchiveItem, GetSetting, SetSetting, Close: () => new Promise((resolve) => db.close(resolve)), STATES, TYPES, PRIORITIES }
}

module.exports = { InitializeBlueprintStore, STATES, TYPES, PRIORITIES }
