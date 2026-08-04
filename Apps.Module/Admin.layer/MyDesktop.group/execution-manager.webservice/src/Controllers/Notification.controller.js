// Notificações da área de trabalho.
//
// O `NotificationHub` já existia e já era montado aqui, mas não tinha nem saída
// nem entrada: os eventos disparados pelos controllers deste serviço morriam no
// emitter, sem ouvinte, e nenhum app de FORA conseguia avisar o desktop de nada.
//
// Este controller fecha os dois lados:
//  - StreamNotifications (WS) leva os eventos até a interface;
//  - Notify (POST) é a porta de entrada para produtores externos — é por ela que
//    o Meta Project Manager avisa que há entrega esperando revisão.
//
// `dedupeKey` existe porque o mesmo fato costuma ser anunciado mais de uma vez
// (um evento de domínio que dispara duas vezes, um retry): repetir a mesma
// notificação treina a pessoa a ignorá-las.
const DEDUPE_WINDOW_MS = 30000

const NotificationController = (params) => {

    const { notificationHubService } = params
    const recentes = new Map()   // dedupeKey → timestamp

    const StreamNotifications = (ws) => {

        const { RegisterNotificationListener } = notificationHubService

        RegisterNotificationListener((event) => {
            try{
                ws.send(JSON.stringify(event))
            }catch(e){
                Log.error("Notification", e)
            }
        })
    }

    const Notify = ({ source, kind, title, body, level, url, appKey, count, dedupeKey } = {}) => {

        if(!title)
            return { ok: false, code: "VALIDATION_ERROR", message: "Notificação sem título não diz nada a ninguém." }

        if(dedupeKey){
            const anterior = recentes.get(dedupeKey)
            if(anterior && Date.now() - anterior < DEDUPE_WINDOW_MS)
                return { ok: true, deduped: true }
            recentes.set(dedupeKey, Date.now())
            // Limpeza preguiçosa: o mapa nunca cresce sem limite, e não há
            // temporizador rodando por conta disso.
            if(recentes.size > 500)
                for(const [chave, quando] of recentes)
                    if(Date.now() - quando > DEDUPE_WINDOW_MS) recentes.delete(chave)
        }

        notificationHubService.NotifyEvent({
            type: "app-notification",
            source: source || "unknown",
            kind: kind || "info",
            title, body, level: level || "info",
            url, appKey,
            count: typeof count === "number" ? count : undefined
        })

        return { ok: true }
    }

    return {
        controllerName : "NotificationController",
        StreamNotifications,
        Notify
    }
}

module.exports = NotificationController
