import { activityTitle, activityDetail, activityIcon } from "../src/Utils/activity"
import { ActivityEntry, User } from "../src/api/types"

const users: Record<string, User> = {
    u1: { id: "u1", type: "human", displayName: "Kaio", status: "active" }
}
const base = { id: "e", entityId: "i1", projectId: "p1", source: "gui", createdAt: "2026-07-09T00:47:00Z" }

const mk = (o: Partial<ActivityEntry>): ActivityEntry => ({ ...base, ...o } as ActivityEntry)

describe("activityTitle", () => {
    it("descreve criação de item com a key", () => {
        const e = mk({ action: "create", entityType: "work-item", actorUserId: "u1", metadata: { key: "CFGEC-7" } })
        expect(activityTitle(e, users)).toBe("Kaio criou item CFGEC-7")
    })

    it("descreve mudança de status com o valor novo", () => {
        const e = mk({
            action: "set-status", entityType: "work-item", actorType: "agent", provider: "claude",
            metadata: { key: "CFGEC-7" }, before: { statusKey: "backlog" }, after: { statusKey: "done" }
        })
        expect(activityTitle(e, users)).toBe("Agente claude mudou o status de CFGEC-7 para done")
    })

    it("descreve update listando os campos alterados", () => {
        const e = mk({
            action: "update", entityType: "work-item", actorUserId: "u1",
            metadata: { key: "CFGEC-7" }, after: { priority: "high", statusKey: "ready" }
        })
        expect(activityTitle(e, users)).toBe("Kaio atualizou item CFGEC-7 (prioridade, status)")
    })

    it("descreve atribuição resolvendo o nome do responsável", () => {
        const e = mk({ action: "assign", entityType: "work-item", metadata: { key: "CFGEC-7" }, after: { assigneeUserId: "u1" } })
        expect(activityTitle(e, users)).toContain("atribuiu CFGEC-7 a Kaio")
    })

    it("usa o usuario-desktop quando actorType=desktop", () => {
        const e = mk({ action: "create", entityType: "activity-note", actorType: "desktop" })
        expect(activityTitle(e, users)).toBe("Usuário Desktop criou uma anotação")
    })

    it("descreve pedido de aprovação de remoção", () => {
        const e = mk({ action: "request", entityType: "creation-request", actorType: "agent", provider: "claude",
            metadata: { actionName: "delete", type: "item" } })
        expect(activityTitle(e, users)).toBe("Agente claude solicitou aprovação para remover item")
    })

    it("nunca devolve o nome cru da ação para ações conhecidas", () => {
        const e = mk({ action: "delete", entityType: "board", actorUserId: "u1", metadata: { name: "Development" } })
        expect(activityTitle(e, users)).toBe("Kaio removeu board Development")
    })
})

describe("activityDetail", () => {
    it("inclui o diff antes → depois e o contexto técnico", () => {
        const e = mk({
            action: "set-status", entityType: "work-item", actorType: "agent",
            provider: "claude", model: "claude-opus-4", traceId: "T-1",
            before: { statusKey: "backlog" }, after: { statusKey: "done" }
        })
        const d = activityDetail(e)
        expect(d).toContain("gui · claude · claude-opus-4")
        expect(d).toContain("sessão T-1")
        expect(d).toContain("status: backlog → done")
    })
})

describe("activityIcon", () => {
    it("mapeia ações para ícones distintos", () => {
        expect(activityIcon("delete")).toBe("trash")
        expect(activityIcon("set-status")).toBe("exchange")
        expect(activityIcon("approve")).toBe("check circle")
    })
})
