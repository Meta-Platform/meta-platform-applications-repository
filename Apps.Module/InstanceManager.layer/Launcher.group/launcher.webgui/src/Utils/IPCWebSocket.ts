// Objeto compatível com a API de WebSocket do browser, sobre o canal de
// streaming IPC (window.metaGui.stream). No modo Electron GUI-host substitui o
// `new WebSocket(ws://...)` — os componentes/hooks consomem a MESMA superfície
// (onopen/onmessage/onclose/onerror/send/close/readyState), então não mudam.
//
// Um único listener global (metaGui.stream.onEvent) despacha os eventos por
// streamId para a instância correspondente.

const _instances: { [id: string]: IPCWebSocket } = {}
let _subscribed = false

const _ensureSubscribed = () => {
    if(_subscribed) return
    _subscribed = true
    ;(window as any).metaGui.stream.onEvent((payload: any) => {
        const instance = _instances[payload && payload.streamId]
        if(instance) instance._dispatch(payload.type, payload.data)
    })
}

let _counter = 0
const _newStreamId = () => `s_${Date.now()}_${_counter++}`

class IPCWebSocket {
    readyState: number = 0
    onopen:    ((event?: any) => void) | null = null
    onmessage: ((event: any) => void)  | null = null
    onclose:   ((event?: any) => void) | null = null
    onerror:   ((event?: any) => void) | null = null

    private _streamId: string

    constructor(serviceName: string, method: string, data?: any){
        _ensureSubscribed()
        this._streamId = _newStreamId()
        _instances[this._streamId] = this
        ;(window as any).metaGui.stream.open(this._streamId, serviceName, method, data)
    }

    // Chamado pelo despachante global; converte os eventos do canal na API de
    // WebSocket que os consumidores esperam (event.data string em onmessage).
    _dispatch(type: string, data?: any){
        if(type === "open"){ this.readyState = 1; this.onopen && this.onopen({}) }
        else if(type === "message"){ this.onmessage && this.onmessage({ data }) }
        else if(type === "close"){ this.readyState = 3; this.onclose && this.onclose({}); delete _instances[this._streamId] }
        else if(type === "error"){ this.onerror && this.onerror({}) }
    }

    send(data: any){
        ;(window as any).metaGui.stream.send(this._streamId, typeof data === "string" ? data : JSON.stringify(data))
    }

    close(){
        this.readyState = 3
        ;(window as any).metaGui.stream.close(this._streamId)
        delete _instances[this._streamId]
    }
}

export default IPCWebSocket
