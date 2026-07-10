const { EventEmitter } = require("events")

// Contexto compartilhado do webservice: UMA instância do store de domínio
// (para todos os controllers) + emitter/buffer de eventos realtime.
// O store emite onEvent -> alimenta o buffer (polling via GetEvents) e o
// emitter (push via endpoint WebSocket /events).
//
// PROCESSOS SEPARADOS: os agentes falam com o banco por outro processo (o
// servidor MCP, a CLI). O `onEvent` do store só vê o que acontece DENTRO deste
// processo — nada que um agente faz chegaria à GUI. A única coisa que os
// processos compartilham é o SQLite, e toda mutação passa por `audit_events`.
// Por isso um observador relê a auditoria periodicamente e injeta o que é novo
// no MESMO fluxo de eventos: a GUI não precisa saber de onde a mudança veio.
let _context

const MAX_BUFFER = 500

// De quanto em quanto tempo procuramos mudanças feitas por outros processos.
const EXTERNAL_POLL_MS = 1000
// Ids já publicados, para não emitir duas vezes o evento que nasceu aqui dentro.
const MAX_SEEN = 2000

const GetContext = ({ projectStoreLib, dbFilePath, attachmentsDirPath, maxAttachmentBytes, ecosystemDataPath }) => {
    if(_context) return _context

    const emitter = new EventEmitter()
    emitter.setMaxListeners(0)
    const buffer = []
    let seq = 0

    // Ids de auditoria já publicados (ordem de inserção = ordem de descarte).
    const seenAuditIds = new Set()
    const _remember = (id) => {
        seenAuditIds.add(id)
        if(seenAuditIds.size > MAX_SEEN) seenAuditIds.delete(seenAuditIds.values().next().value)
    }

    const Publish = (evt) => {
        const tagged = { ...evt, seq: ++seq }
        buffer.push(tagged)
        if(buffer.length > MAX_BUFFER) buffer.shift()
        emitter.emit("event", tagged)
        return tagged
    }

    const InitializeProjectStore = projectStoreLib.require("InitializeProjectStore")
    const store = InitializeProjectStore({
        storage: dbFilePath,
        attachmentsDirPath,
        maxAttachmentBytes,
        // Onde o ecossistema declara seus repositórios (catálogo de pacotes).
        ecosystemDataPath,
        onEvent: (evt) => {
            // O evento de auditoria local já carrega o id: marcamos como visto para
            // o observador não republicá-lo quando reler a tabela.
            if(evt.type === "audit.created" && evt.payload && evt.payload.id) _remember(evt.payload.id)
            Publish(evt)
        }
    })

    // Eventos desde um cursor (polling do browser). since=0 => tudo no buffer.
    const EventsSince = (since = 0, limit = 200) => {
        const events = buffer.filter((e) => e.seq > Number(since)).slice(0, Number(limit))
        return { cursor: seq, events }
    }

    const ready = store.ConnectAndSync()

    // ── Observador de mudanças externas (agentes via MCP/CLI) ──────────────
    // Publica como `audit.created`, exatamente o mesmo evento que uma mutação
    // local produz — a GUI trata os dois do mesmo jeito.
    let watching = false
    const WatchExternalChanges = async () => {
        if(watching) return
        watching = true
        await ready

        const { AuditEvent } = store.models
        // Só o que for gravado a partir de agora interessa: no boot, marcamos os
        // eventos existentes como vistos (senão a GUI receberia o histórico todo).
        let since = new Date()
        try {
            const last = await AuditEvent.findOne({ order: [["createdAt", "DESC"]] })
            if(last){
                since = new Date(last.createdAt)
                _remember(last.id)
            }
        } catch(e){ /* tabela ainda não existe: o primeiro tick resolve */ }

        const tick = async () => {
            try {
                const rows = await AuditEvent.findAll({
                    where: { createdAt: { [store.sequelize.Sequelize.Op.gte]: since } },
                    order: [["createdAt", "ASC"]],
                    limit: 200
                })
                for(const row of rows){
                    if(seenAuditIds.has(row.id)) continue
                    _remember(row.id)
                    const payload = row.toJSON ? row.toJSON() : row
                    Publish({ type: "audit.created", payload, createdAt: new Date().toISOString(), external: true })
                }
                if(rows.length > 0) since = new Date(rows[rows.length - 1].createdAt)
            } catch(e){ /* best-effort: um tick que falha não derruba o serviço */ }
        }

        const timer = setInterval(tick, EXTERNAL_POLL_MS)
        if(timer.unref) timer.unref()   // não segura o processo vivo
    }
    WatchExternalChanges()

    _context = { store, emitter, EventsSince, Publish, ready }
    return _context
}

module.exports = { GetContext }
