const { EventEmitter } = require("events")

// Contexto compartilhado do webservice: UMA instância do store de domínio
// (para todos os controllers) + emitter/buffer de eventos realtime.
// O store emite onEvent -> alimenta o buffer (polling via GetEvents) e o
// emitter (push via endpoint WebSocket /events).
let _context

const MAX_BUFFER = 500

const GetContext = ({ projectStoreLib, dbFilePath, attachmentsDirPath, maxAttachmentBytes }) => {
    if(_context) return _context

    const emitter = new EventEmitter()
    emitter.setMaxListeners(0)
    const buffer = []
    let seq = 0

    const InitializeProjectStore = projectStoreLib.require("InitializeProjectStore")
    const store = InitializeProjectStore({
        storage: dbFilePath,
        attachmentsDirPath,
        maxAttachmentBytes,
        onEvent: (evt) => {
            const tagged = { ...evt, seq: ++seq }
            buffer.push(tagged)
            if(buffer.length > MAX_BUFFER) buffer.shift()
            emitter.emit("event", tagged)
        }
    })

    // Eventos desde um cursor (polling do browser). since=0 => tudo no buffer.
    const EventsSince = (since = 0, limit = 200) => {
        const events = buffer.filter((e) => e.seq > Number(since)).slice(0, Number(limit))
        return { cursor: seq, events }
    }

    _context = { store, emitter, EventsSince, ready: store.ConnectAndSync() }
    return _context
}

module.exports = { GetContext }
