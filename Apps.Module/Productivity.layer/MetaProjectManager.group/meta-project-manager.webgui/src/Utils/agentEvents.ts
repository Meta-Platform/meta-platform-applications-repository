import { ActivityEntry, PlatformEvent } from "../api/types"

// O backend emite `audit.created` a cada mutação, com o registro de auditoria
// inteiro: quem (ator/provider/modelo), onde (projeto/entidade) e o quê (ação).
// É a única fonte que responde "quem mexeu" — os eventos de domínio
// (item.updated, board.updated…) não carregam ator.
export const AUDIT_EVENT = "audit.created"

// O evento chega com metadata/before/after ainda em JSON (o Serialize do store
// não hidrata). A GUI trabalha com o objeto.
export const hydrateAuditEvent = (payload: any): ActivityEntry => ({
    ...payload,
    metadata: payload.metadata || (payload.metadataJson ? safeParse(payload.metadataJson) : undefined),
    before: payload.before || (payload.beforeJson ? safeParse(payload.beforeJson) : undefined),
    after: payload.after || (payload.afterJson ? safeParse(payload.afterJson) : undefined)
})

const safeParse = (raw: string) => { try { return JSON.parse(raw) } catch (_) { return undefined } }

// Entradas de auditoria de um lote de eventos.
export const auditEntriesOf = (events: PlatformEvent[]): ActivityEntry[] =>
    events
        .filter((e) => e.type === AUDIT_EVENT && (e as any).payload)
        .map((e) => hydrateAuditEvent((e as any).payload))

// Só o que um AGENTE fez (é o que vira toast — as ações do próprio usuário não
// precisam ser anunciadas de volta para ele).
export const agentEntriesOf = (events: PlatformEvent[]): ActivityEntry[] =>
    auditEntriesOf(events).filter((e) => e.actorType === "agent")

// Um lote mexeu no projeto informado?
export const touchesProject = (events: PlatformEvent[], projectId?: string): boolean => {
    if (!projectId) return false
    return auditEntriesOf(events).some((e) => e.projectId === projectId)
}

// Um lote mexeu neste item específico (inclui comentário/anexo do item)?
export const touchesItem = (events: PlatformEvent[], itemId?: string): boolean => {
    if (!itemId) return false
    return auditEntriesOf(events).some((e) =>
        e.entityId === itemId || (e.metadata && (e.metadata as any).workItemId === itemId))
}
