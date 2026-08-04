const http = require("http")

/**
 * Avisa a área de trabalho de que algo espera pelo humano.
 *
 * Dispara e esquece: **nunca lança**. Um aviso é acessório à operação que o
 * originou — se o desktop está fechado, se a rede recusa, se o endpoint não
 * existe naquela versão, a entrega que acabou de ser feita não pode falhar por
 * causa disso.
 *
 * Ligado num ponto SÓ (o observador de eventos do store, em AppContext), e não
 * espalhado pelos controllers: assim não há caminho de escrita que avise duas
 * vezes nem caminho que esqueça de avisar.
 */
const CreateDesktopNotifier = ({ url, appKey = "meta-project-manager", timeoutMs = 1500 } = {}) => {
    if(!url) return () => undefined

    const endpoint = new URL(url)

    return ({ title, body, kind, level, dedupeKey, count } = {}) => {
        if(!title) return
        const payload = JSON.stringify({
            source: "meta-project-manager", appKey,
            kind: kind || "info", title, body, level: level || "info",
            dedupeKey, count
        })
        try {
            const req = http.request({
                hostname: endpoint.hostname,
                port: endpoint.port,
                path: endpoint.pathname,
                method: "POST",
                timeout: timeoutMs,
                headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            })
            // Todo desfecho é silencioso: erro, timeout e resposta são
            // igualmente irrelevantes para quem chamou.
            req.on("error", () => undefined)
            req.on("timeout", () => { try { req.destroy() } catch(e){ /* já morreu */ } })
            req.write(payload)
            req.end()
        } catch(e){ /* nunca derruba a operação que originou o aviso */ }
    }
}

/**
 * Traduz um evento do store no aviso correspondente — e só nos casos em que há
 * de fato algo esperando por uma pessoa.
 *
 * O que NÃO vira aviso é tão importante quanto o que vira: progresso de agente,
 * mudança de campo e criação de item acontecem o tempo todo, e avisar sobre eles
 * treinaria a pessoa a ignorar a notificação inteira.
 */
const NotifiableEvent = (evt) => {
    if(!evt || !evt.payload) return undefined
    const p = evt.payload

    if(evt.type === "delivery.awaiting_human")
        return {
            title: "Entrega esperando revisão",
            body: `${p.key || ""} ${p.title || ""}`.trim(),
            kind: "delivery", dedupeKey: `delivery-awaiting:${p.id}`
        }
    if(evt.type === "mandate.exhausted")
        return {
            title: "Um agente parou",
            body: `${p.title || "Mandato"} — ${p.stopReason || "condição de parada atingida"}`,
            kind: "mandate", level: "warning", dedupeKey: `mandate-stopped:${p.id}`
        }
    if(evt.type === "approval.requested")
        return {
            title: "Aprovação pendente",
            body: p.request ? `${p.actionName || ""} ${p.type || ""}`.trim() : undefined,
            kind: "approval", level: "warning",
            dedupeKey: `approval:${p.request && p.request.id}`
        }
    return undefined
}

module.exports = { CreateDesktopNotifier, NotifiableEvent }
