// Catálogo de tools MCP → métodos da @/project-store.lib.
//
// Cada tool devolve JSON plano (o MESMO dado da CLI/GUI — camada de domínio
// única). O `actor` (agente, definido no startup do servidor) é injetado em
// TODA mutação → auditoria correta + gate de aprovação humana para criação
// estrutural (project/board/milestone/sprint).
//
// Deliberadamente NÃO expostas ao agente:
//  - aprovar/rejeitar pedido e confirmar sessão → são ações HUMANAS (se o agente
//    pudesse se autoaprovar, o gate não teria sentido).
//
// Deleção (project/board/item): EXPOSTA, porém SEMPRE via gate — a tool cria um
// pedido destrutivo e, por padrão (waitApproval), BLOQUEIA aguardando a decisão
// humana; ao aprovar, o store executa um SOFT delete (deletedAt, reversível). A
// espera não polui o stdout (respostas JSON-RPC só saem no fim; logs vão p/ stderr).

// Helpers de JSON Schema (enxutos, só o que as tools usam).
const S = {
    str:  (description) => ({ type: "string", description }),
    num:  (description) => ({ type: "number", description }),
    bool: (description) => ({ type: "boolean", description }),
    enum: (values, description) => ({ type: "string", enum: values, description })
}
const Obj = (properties, required) => ({ type: "object", properties, ...(required ? { required } : {}), additionalProperties: false })

const WORK_ITEM_TYPES = ["epic","feature","story","task","subtask","bug","improvement","refactor","documentation","research","automation","tech-debt","decision"]
const PRIORITIES = ["none","low","medium","high","urgent"]
const HORIZONS = ["inbox","now","next","later","maybe","archived"]
// Espelha Config.LINK_RELATIONS do project-store.lib (valores REAIS aceitos).
const LINK_RELATIONS = ["blocks","depends","relates","duplicates","implements","tests","originated_from"]
// Registro de riscos: escala da matriz 3×3 (probabilidade/impacto) e ciclo de vida.
const RISK_LEVELS = ["low","medium","high"]
const RISK_STATUSES = ["open","mitigating","accepted","closed","occurred"]
// Documento de planejamento (termo de abertura/charter): ciclo de vida.
const PLANNING_DOC_STATUSES = ["draft","review","approved","archived"]

const { INSTRUCTIONS } = require("./Instructions")

const BuildTools = ({ store, actor }) => {

    // Anexa o ator do agente ao payload de uma mutação.
    const A = (payload) => ({ ...payload, actor })

    // Erro de domínio para a camada MCP (formatado como { ok:false, code, ... }).
    const McpError = (code, message, details) => Object.assign(new Error(message), { code, details })

    // Executa uma AÇÃO GATED (criar projeto/board/milestone/sprint, ou deletar).
    // O gate transforma a chamada num pedido pendente; por padrão (waitApproval)
    // a tool BLOQUEIA (polling do SQLite via WaitForApproval) até a decisão humana
    // e devolve o resultado da ação — o agente não segue adiante sem o veredicto.
    // Se rejeitado/expirado, erro estruturado. resumeToken (derivado da ação + alvo)
    // dá idempotência: retries reusam o pedido pendente em vez de duplicá-lo.
    const ACTION_LABEL = { create: "criação", delete: "remoção" }
    const GatedAction = async ({ actionName = "delete", type, ref, run, waitApproval = true, approvalTimeoutSeconds }) => {
        const resumeToken = `${actionName}:${type}:${ref}`
        try {
            return await run({ ...actor, resumeToken }) // caminho não-gated (não esperado p/ agente)
        } catch(e){
            if(e.code !== "AGENT_SESSION_CONFIRMATION_REQUIRED") throw e
            const requestId = e.details && e.details.pendingCreationId
            const label = ACTION_LABEL[actionName] || actionName
            if(waitApproval === false)
                return { status: "pending_approval", approvalRequestId: requestId, actionName, type, message: "Aguardando aprovação humana. Consulte o humano ou reenvie com waitApproval para bloquear." }
            const timeoutMs = Number(approvalTimeoutSeconds) > 0 ? Number(approvalTimeoutSeconds) * 1000 : 0
            const final = await store.WaitForApproval({ request: requestId, timeoutMs })
            if(final.timedOut) throw McpError("APPROVAL_TIMEOUT", "Tempo de espera pela aprovação esgotado.", { approvalRequestId: requestId })
            if(final.status === "rejected") throw McpError("REJECTED_BY_HUMAN", final.rejectionReason || `${label[0].toUpperCase()}${label.slice(1)} rejeitada por um humano.`, { approvalRequestId: requestId, reason: final.rejectionReason })
            if(final.status === "failed") throw McpError("APPROVAL_EXECUTION_FAILED", (final.error && final.error.message) || `Falha ao executar a ${label} aprovada.`, { approvalRequestId: requestId })
            return final.result
        }
    }
    const GatedDelete = (args) => GatedAction({ ...args, actionName: "delete" })
    const GatedCreate = (args) => GatedAction({ ...args, actionName: "create" })

    // Campos de controle da espera, comuns a toda tool sob gate.
    const WAIT_FIELDS = {
        waitApproval: S.bool("Aguardar a aprovação humana e retomar (padrão true). false retorna o approvalRequestId sem esperar."),
        approvalTimeoutSeconds: S.num("Timeout da espera em segundos (0/omitido = sem timeout)")
    }

    // Schema comum das tools de delete: alvo + controle de espera.
    const DeleteSchema = (targetKey, targetDesc) => Obj({
        [targetKey]: S.str(targetDesc),
        ...WAIT_FIELDS
    }, [targetKey])

    // Sufixo padrão da descrição de toda tool de criação estrutural.
    const GATED_CREATE_NOTE = " GATE: criação estrutural por agente exige aprovação humana — esta tool BLOQUEIA até o humano aprovar ou rejeitar no Meta Project Manager (ou via `mpm agent creation approve|reject <id>`). NÃO prossiga por outro caminho; rejeição vira erro REJECTED_BY_HUMAN. Use waitApproval:false só se precisar explicitamente não bloquear."

    const DeleteDesc = (alvo) => `Remove (SOFT delete) ${alvo}. AÇÃO DESTRUTIVA sob gate: cria um pedido e AGUARDA aprovação humana (a interface mostra O QUE será removido e QUEM pediu). Aprovado → executa e retorna o resultado; rejeitado → { ok:false, code:"REJECTED_BY_HUMAN" }. NÃO tente burlar o gate.`

    return [
        // ───────────── Estruturar o projeto (projeto/board: GATE de aprovação humana) ─────────────
        {
            name: "create_project",
            description: "Cria um projeto." + GATED_CREATE_NOTE,
            inputSchema: Obj({
                name: S.str("Nome do projeto"),
                slug: S.str("Slug único (opcional; derivado do nome se ausente)"),
                shortDescription: S.str("OBRIGATÓRIO NA PRÁTICA: resumo de UMA linha (<=240 chars). É o que o humano lê no modal de aprovação e nos cards."),
                description: S.str("Descrição em markdown. SEJA ASSERTIVO E CURTO: use seções curtas (## Objetivo, ## Escopo, ## Fora de escopo). Evite despejar logs, caminhos longos e tabelas enormes — o humano precisa decidir rápido."),
                keyPrefix: S.str("Prefixo das keys dos itens (ex.: MPM)"),
                status: S.enum(["planning","candidate","active","paused","completed","archived"], "Status inicial"),
                repositoryUrl: S.str("URL do repositório"),
                localPath: S.str("Caminho local do projeto"),
                ...WAIT_FIELDS
            }, ["name"]),
            handler: (i) => GatedCreate({
                type: "project", ref: i.slug || i.name,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.CreateProject({ name: i.name, slug: i.slug, shortDescription: i.shortDescription, description: i.description, keyPrefix: i.keyPrefix, status: i.status, repositoryUrl: i.repositoryUrl, localPath: i.localPath, actor })
            })
        },
        {
            name: "create_board",
            description: "Cria um board (Kanban) no projeto." + GATED_CREATE_NOTE,
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                name: S.str("Nome do board"),
                shortDescription: S.str("Descrição curta (<=240 chars)"),
                description: S.str("Descrição"),
                type: S.str("Tipo do board (ex.: kanban)"),
                setDefault: S.bool("Tornar board padrão do projeto (o 1º board vira padrão automaticamente)"),
                ...WAIT_FIELDS
            }, ["project","name"]),
            handler: (i) => GatedCreate({
                type: "board", ref: `${i.project}:${i.name}`,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.CreateBoard({ project: i.project, name: i.name, shortDescription: i.shortDescription, description: i.description, type: i.type, setDefault: i.setDefault, actor })
            })
        },
        {
            name: "create_milestone",
            description: "Cria um milestone — na interface chamado \"Entrega\": um alvo com data. LIVRE (planejamento é reversível). Criar a entrega NÃO vincula itens: use assign_item_planning.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                name: S.str("Nome do milestone"),
                description: S.str("Descrição"),
                targetDate: S.str("Data alvo (ISO, ex.: 2026-09-01)")
            }, ["project","name"]),
            handler: (i) => store.CreateMilestone(A({ project: i.project, name: i.name, description: i.description, targetDate: i.targetDate }))
        },
        {
            name: "create_sprint",
            description: "Cria um sprint (janela de tempo com um objetivo). LIVRE (planejamento é reversível).",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                name: S.str("Nome do sprint"),
                goal: S.str("Objetivo do sprint"),
                startDate: S.str("Início (ISO)"),
                endDate: S.str("Fim (ISO)")
            }, ["project","name"]),
            handler: (i) => store.CreateSprint(A({ project: i.project, name: i.name, goal: i.goal, startDate: i.startDate, endDate: i.endDate }))
        },

        // ───────────── Documentação do projeto (wiki em árvore) ─────────────
        // Páginas de markdown organizadas em árvore (parentId). Boa fonte de
        // contexto E manutenível pelo agente. Criar/editar é LIVRE; excluir é gated.
        {
            name: "list_doc_pages",
            description: "Lista as páginas de documentação do projeto (planas; monte a árvore por parentId). Não traz corpos grandes truncados — use get_doc_page para o conteúdo completo.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ListDocPages({ project: i.project })
        },
        {
            name: "get_doc_page",
            description: "Lê uma página de documentação (com o corpo markdown completo).",
            inputSchema: Obj({ docPage: S.str("Id da página de documentação") }, ["docPage"]),
            handler: (i) => store.GetDocPage({ docPage: i.docPage })
        },
        {
            name: "create_doc_page",
            description: "Cria uma página de documentação (markdown). Para uma sub-página, passe parentId. LIVRE (conteúdo reversível). Referencie itens no corpo com a key entre colchetes duplos (ex.: [[MPM-42]]).",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                parentId: S.str("Id da página-pai (omitir = página raiz)"),
                title: S.str("Título da página"),
                icon: S.str("Emoji opcional para o ícone da página"),
                body: S.str("Conteúdo em markdown")
            }, ["project","title"]),
            handler: (i) => store.CreateDocPage(A({ project: i.project, parentId: i.parentId, title: i.title, icon: i.icon, body: i.body }))
        },
        {
            name: "update_doc_page",
            description: "Edita uma página de documentação (título/ícone/corpo). LIVRE. Para mover/reordenar na árvore use move_doc_page.",
            inputSchema: Obj({
                docPage: S.str("Id da página de documentação"),
                title: S.str("Novo título"),
                icon: S.str("Novo emoji do ícone"),
                body: S.str("Novo corpo em markdown")
            }, ["docPage"]),
            handler: (i) => store.UpdateDocPage(A({ docPage: i.docPage, title: i.title, icon: i.icon, body: i.body }))
        },
        {
            name: "move_doc_page",
            description: "Move/reordena uma página na árvore de documentação: parentId muda o pai (\"none\" = raiz); order define a posição entre irmãos. LIVRE.",
            inputSchema: Obj({
                docPage: S.str("Id da página de documentação"),
                parentId: S.str("Novo pai (id) ou \"none\" para raiz"),
                order: S.num("Posição entre irmãos")
            }, ["docPage"]),
            handler: (i) => store.MoveDocPage(A({ docPage: i.docPage, parentId: i.parentId, order: i.order }))
        },

        // ───────────── Registro de riscos (matriz 3×3, PMBOK) ─────────────
        // Lista plana de riscos por projeto. probabilidade × impacto (baixo/médio/
        // alto) → nível derivado (low/moderate/high/critical) no campo `level`.
        // Criar/editar é LIVRE; excluir é gated.
        {
            name: "list_risks",
            description: "Lista os riscos do projeto (com o nível derivado da matriz probabilidade×impacto no campo `level`).",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ListRisks({ project: i.project })
        },
        {
            name: "get_risk",
            description: "Lê um risco (descrição, mitigação, contingência, dono, marco e nível).",
            inputSchema: Obj({ risk: S.str("Id do risco") }, ["risk"]),
            handler: (i) => store.GetRisk({ risk: i.risk })
        },
        {
            name: "create_risk",
            description: "Registra um risco do projeto. probability/impact usam a matriz 3×3 (low/medium/high). LIVRE (reversível).",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                title: S.str("Título curto do risco"),
                description: S.str("Descrição em markdown"),
                probability: S.enum(RISK_LEVELS, "Probabilidade (low|medium|high)"),
                impact: S.enum(RISK_LEVELS, "Impacto (low|medium|high)"),
                status: S.enum(RISK_STATUSES, "Estado (open|mitigating|accepted|closed|occurred)"),
                category: S.str("Categoria livre (técnico/prazo/custo/externo…)"),
                mitigation: S.str("Plano de mitigação (reduzir prob./impacto)"),
                contingency: S.str("Plano de contingência (se ocorrer)"),
                ownerUserId: S.str("Dono do risco (id|handle)"),
                milestoneId: S.str("Marco afetado (id|nome)")
            }, ["project","title"]),
            handler: (i) => store.CreateRisk(A({ project: i.project, title: i.title, description: i.description, probability: i.probability, impact: i.impact, status: i.status, category: i.category, mitigation: i.mitigation, contingency: i.contingency, ownerUserId: i.ownerUserId, milestoneId: i.milestoneId }))
        },
        {
            name: "update_risk",
            description: "Edita um risco (título/descrição/probabilidade/impacto/estado/categoria/mitigação/contingência/dono/marco). Passe \"none\" em ownerUserId/milestoneId para limpar. LIVRE.",
            inputSchema: Obj({
                risk: S.str("Id do risco"),
                title: S.str("Novo título"),
                description: S.str("Nova descrição em markdown"),
                probability: S.enum(RISK_LEVELS, "Probabilidade (low|medium|high)"),
                impact: S.enum(RISK_LEVELS, "Impacto (low|medium|high)"),
                status: S.enum(RISK_STATUSES, "Estado (open|mitigating|accepted|closed|occurred)"),
                category: S.str("Categoria livre"),
                mitigation: S.str("Plano de mitigação"),
                contingency: S.str("Plano de contingência"),
                ownerUserId: S.str("Dono (id|handle) ou \"none\" para limpar"),
                milestoneId: S.str("Marco (id|nome) ou \"none\" para limpar")
            }, ["risk"]),
            handler: (i) => store.UpdateRisk(A({ risk: i.risk, title: i.title, description: i.description, probability: i.probability, impact: i.impact, status: i.status, category: i.category, mitigation: i.mitigation, contingency: i.contingency, ownerUserId: i.ownerUserId, milestoneId: i.milestoneId }))
        },

        // ───────────── Documento de planejamento (charter/termo de abertura) ─────────────
        // Seções ESTRUTURADAS (objetivo/escopo/…); distinto do wiki (doc_page). `version`
        // sobe a cada edição. Criar/editar é LIVRE; excluir é gated.
        {
            name: "list_planning_docs",
            description: "Lista os documentos de planejamento do projeto (termo de abertura/charter, com seções estruturadas).",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ListPlanningDocs({ project: i.project })
        },
        {
            name: "get_planning_doc",
            description: "Lê um documento de planejamento (todas as seções + versão).",
            inputSchema: Obj({ planningDoc: S.str("Id do documento de planejamento") }, ["planningDoc"]),
            handler: (i) => store.GetPlanningDoc({ planningDoc: i.planningDoc })
        },
        {
            name: "create_planning_doc",
            description: "Cria um documento de planejamento (charter). Seções são markdown. LIVRE (reversível).",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                title: S.str("Título do documento"),
                milestoneId: S.str("Marco (id|nome) — documento por marco (opcional)"),
                status: S.enum(PLANNING_DOC_STATUSES, "Estado (draft|review|approved|archived)"),
                objective: S.str("Objetivo (markdown)"),
                scope: S.str("Escopo — o que está incluído (markdown)"),
                outOfScope: S.str("Fora de escopo (markdown)"),
                stakeholders: S.str("Partes interessadas (markdown)"),
                assumptions: S.str("Premissas (markdown)"),
                constraints: S.str("Restrições (markdown)"),
                successCriteria: S.str("Critérios de sucesso (markdown)"),
                deliverables: S.str("Entregas (markdown)")
            }, ["project","title"]),
            handler: (i) => store.CreatePlanningDoc(A({ project: i.project, title: i.title, milestoneId: i.milestoneId, status: i.status, objective: i.objective, scope: i.scope, outOfScope: i.outOfScope, stakeholders: i.stakeholders, assumptions: i.assumptions, constraints: i.constraints, successCriteria: i.successCriteria, deliverables: i.deliverables }))
        },
        {
            name: "update_planning_doc",
            description: "Edita um documento de planejamento (título/status/marco/seções). Cada edição incrementa `version`. Passe \"none\" em milestoneId para desvincular. LIVRE.",
            inputSchema: Obj({
                planningDoc: S.str("Id do documento de planejamento"),
                title: S.str("Novo título"),
                milestoneId: S.str("Marco (id|nome) ou \"none\" para desvincular"),
                status: S.enum(PLANNING_DOC_STATUSES, "Estado (draft|review|approved|archived)"),
                objective: S.str("Objetivo (markdown)"),
                scope: S.str("Escopo (markdown)"),
                outOfScope: S.str("Fora de escopo (markdown)"),
                stakeholders: S.str("Partes interessadas (markdown)"),
                assumptions: S.str("Premissas (markdown)"),
                constraints: S.str("Restrições (markdown)"),
                successCriteria: S.str("Critérios de sucesso (markdown)"),
                deliverables: S.str("Entregas (markdown)")
            }, ["planningDoc"]),
            handler: (i) => store.UpdatePlanningDoc(A({ planningDoc: i.planningDoc, title: i.title, milestoneId: i.milestoneId, status: i.status, objective: i.objective, scope: i.scope, outOfScope: i.outOfScope, stakeholders: i.stakeholders, assumptions: i.assumptions, constraints: i.constraints, successCriteria: i.successCriteria, deliverables: i.deliverables }))
        },

        // ───────────── Remover (SOFT delete — GATE destrutivo + espera) ─────────────
        {
            name: "delete_project",
            description: DeleteDesc("um projeto"),
            inputSchema: DeleteSchema("project", "Projeto (id|slug|key)"),
            handler: (i) => GatedDelete({ type: "project", ref: i.project, waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (a) => store.DeleteProject({ project: i.project, actor: a }) })
        },
        {
            name: "delete_board",
            description: DeleteDesc("um board"),
            inputSchema: DeleteSchema("board", "Board (id)"),
            handler: (i) => GatedDelete({ type: "board", ref: i.board, waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (a) => store.DeleteBoard({ board: i.board, actor: a }) })
        },
        {
            name: "delete_item",
            description: DeleteDesc("um item de trabalho"),
            inputSchema: DeleteSchema("item", "Item (id|key, ex.: MPM-42)"),
            handler: (i) => GatedDelete({ type: "item", ref: i.item, waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (a) => store.DeleteItem({ item: i.item, actor: a }) })
        },
        {
            name: "delete_doc_page",
            description: DeleteDesc("uma página de documentação (e suas sub-páginas, em cascata)"),
            inputSchema: DeleteSchema("docPage", "Id da página de documentação"),
            handler: (i) => GatedDelete({ type: "doc-page", ref: i.docPage, waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (a) => store.DeleteDocPage({ docPage: i.docPage, actor: a }) })
        },
        {
            name: "delete_risk",
            description: DeleteDesc("um risco do registro de riscos"),
            inputSchema: DeleteSchema("risk", "Id do risco"),
            handler: (i) => GatedDelete({ type: "risk", ref: i.risk, waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (a) => store.DeleteRisk({ risk: i.risk, actor: a }) })
        },
        {
            name: "delete_planning_doc",
            description: DeleteDesc("um documento de planejamento"),
            inputSchema: DeleteSchema("planningDoc", "Id do documento de planejamento"),
            handler: (i) => GatedDelete({ type: "planning-doc", ref: i.planningDoc, waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (a) => store.DeletePlanningDoc({ planningDoc: i.planningDoc, actor: a }) })
        },
        {
            name: "list_doc_page_attachments",
            description: "Lista os anexos de ARQUIVO de uma página de documentação (imagem/PDF/log/artefato). Distinto da imagem embutida no corpo (que é data-URI no markdown).",
            inputSchema: Obj({ docPage: S.str("Id da página de documentação") }, ["docPage"]),
            handler: (i) => store.ListDocPageAttachments({ docPage: i.docPage })
        },
        {
            name: "add_doc_page_link_attachment",
            description: "Anexa um link a uma página de documentação. Esquemas aceitos: http, https e file:// (referência a arquivo LOCAL, sem copiar — use add_doc_page_file_attachment para guardar o arquivo). LIVRE.",
            inputSchema: Obj({ docPage: S.str("Id da página de documentação"), url: S.str("URL"), name: S.str("Nome"), description: S.str("Descrição") }, ["docPage","url"]),
            handler: (i) => store.AddDocPageLinkAttachment(A({ docPage: i.docPage, url: i.url, name: i.name, description: i.description }))
        },
        {
            name: "add_doc_page_file_attachment",
            description: "Anexa um arquivo LOCAL (imagem gerada, PDF, log, artefato) a uma página de documentação. O caminho deve ser acessível no host onde o servidor MCP roda. LIVRE.",
            inputSchema: Obj({ docPage: S.str("Id da página de documentação"), filePath: S.str("Caminho do arquivo local"), name: S.str("Nome"), description: S.str("Descrição") }, ["docPage","filePath"]),
            handler: (i) => store.AddDocPageFileAttachment(A({ docPage: i.docPage, filePath: i.filePath, name: i.name, description: i.description }))
        },

        // ───────────── Revisar o projeto (metadados, boards, colunas, planejamento) ─────────────
        //
        // Tudo que um humano faz DENTRO de um projeto o agente também faz. O que muda
        // o contrato do projeto (texto/identidade, ciclo de vida, estrutura do fluxo)
        // ou remove algo passa pelo gate e BLOQUEIA até a decisão humana.
        {
            name: "update_project",
            description: "Atualiza um projeto. Campos operacionais (icon, color, repositoryUrl, localPath) são LIVRES. GATE (bloqueia até aprovação): name, slug, shortDescription, description, status — reescrever o texto ou mudar o ciclo de vida do projeto o humano revisa antes.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                name: S.str("Novo nome"),
                slug: S.str("Novo slug"),
                shortDescription: S.str("Resumo de UMA linha (<=240 chars)"),
                description: S.str("Descrição em markdown, organizada e curta"),
                status: S.enum(["planning","candidate","active","paused","completed","archived"], "Status do projeto"),
                icon: S.str("Ícone"),
                color: S.str("Cor (hex)"),
                repositoryUrl: S.str("URL do repositório"),
                localPath: S.str("Caminho local"),
                ...WAIT_FIELDS
            }, ["project"]),
            handler: (i) => GatedAction({
                actionName: "update", type: "project", ref: i.project,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.UpdateProject({
                    project: i.project, name: i.name, slug: i.slug, shortDescription: i.shortDescription,
                    description: i.description, status: i.status, icon: i.icon, color: i.color,
                    repositoryUrl: i.repositoryUrl, localPath: i.localPath, actor
                })
            })
        },
        {
            name: "archive_project",
            description: "Arquiva um projeto (sai das listagens ativas). GATE: bloqueia até aprovação humana.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)"), ...WAIT_FIELDS }, ["project"]),
            handler: (i) => GatedAction({
                actionName: "archive", type: "project", ref: i.project,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.ArchiveProject({ project: i.project, actor })
            })
        },
        {
            name: "restore_project",
            description: "Restaura um projeto arquivado (volta a active). GATE: bloqueia até aprovação humana.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)"), ...WAIT_FIELDS }, ["project"]),
            handler: (i) => GatedAction({
                actionName: "restore", type: "project", ref: i.project,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.RestoreProject({ project: i.project, actor })
            })
        },
        {
            name: "get_board",
            description: "Detalhe de um board, incluindo as colunas (statusKey de cada uma).",
            inputSchema: Obj({ board: S.str("Board (id)") }, ["board"]),
            handler: (i) => store.GetBoard({ board: i.board })
        },
        {
            name: "update_board",
            description: "Renomeia/descreve um board. LIVRE — não muda o fluxo (para colunas, veja as tools de coluna).",
            inputSchema: Obj({
                board: S.str("Board (id)"),
                name: S.str("Novo nome"),
                shortDescription: S.str("Resumo de uma linha"),
                description: S.str("Descrição")
            }, ["board"]),
            handler: (i) => store.UpdateBoard(A({ board: i.board, name: i.name, shortDescription: i.shortDescription, description: i.description }))
        },
        {
            name: "set_default_board",
            description: "Define o board padrão do projeto (onde novos itens caem). GATE: bloqueia até aprovação humana.",
            inputSchema: Obj({ board: S.str("Board (id)"), ...WAIT_FIELDS }, ["board"]),
            handler: (i) => GatedAction({
                actionName: "set-default", type: "board", ref: i.board,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.SetDefaultBoard({ board: i.board, actor })
            })
        },
        {
            name: "list_columns",
            description: "Lista as colunas de um board, na ordem do fluxo.",
            inputSchema: Obj({ board: S.str("Board (id)") }, ["board"]),
            handler: (i) => store.ListColumns({ board: i.board })
        },
        {
            name: "add_column",
            description: "Cria uma coluna no board. GATE: a coluna é uma etapa do fluxo por onde todo o trabalho passa — bloqueia até aprovação humana.",
            inputSchema: Obj({
                board: S.str("Board (id)"),
                name: S.str("Nome da coluna"),
                statusKey: S.str("Chave de status (derivada do nome se ausente)"),
                color: S.str("Cor (hex)"),
                wipLimit: S.num("Limite de trabalho em progresso"),
                isDoneColumn: S.bool("Marca itens desta coluna como concluídos"),
                ...WAIT_FIELDS
            }, ["board","name"]),
            handler: (i) => GatedAction({
                actionName: "create", type: "column", ref: `${i.board}:${i.name}`,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.AddColumn({ board: i.board, name: i.name, statusKey: i.statusKey, color: i.color, wipLimit: i.wipLimit, isDoneColumn: i.isDoneColumn, actor })
            })
        },
        {
            name: "update_column",
            description: "Altera uma coluna (nome, statusKey, cor, WIP). GATE: bloqueia até aprovação humana.",
            inputSchema: Obj({
                column: S.str("Coluna (id)"),
                name: S.str("Novo nome"),
                statusKey: S.str("Nova chave de status"),
                color: S.str("Cor (hex)"),
                wipLimit: S.num("Limite de WIP"),
                isDoneColumn: S.bool("É coluna de concluído"),
                ...WAIT_FIELDS
            }, ["column"]),
            handler: (i) => GatedAction({
                actionName: "update", type: "column", ref: i.column,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.UpdateColumn({ column: i.column, name: i.name, statusKey: i.statusKey, color: i.color, wipLimit: i.wipLimit, isDoneColumn: i.isDoneColumn, actor })
            })
        },
        {
            name: "move_column",
            description: "Reposiciona uma coluna no fluxo (order = índice 0-based). GATE: bloqueia até aprovação humana.",
            inputSchema: Obj({ column: S.str("Coluna (id)"), order: S.num("Nova posição (0 = primeira)"), ...WAIT_FIELDS }, ["column","order"]),
            handler: (i) => GatedAction({
                actionName: "move", type: "column", ref: i.column,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.MoveColumn({ column: i.column, order: i.order, actor })
            })
        },
        {
            name: "delete_column",
            description: "Remove uma coluna do board. GATE destrutivo: bloqueia até aprovação humana.",
            inputSchema: Obj({ column: S.str("Coluna (id)"), ...WAIT_FIELDS }, ["column"]),
            handler: (i) => GatedDelete({
                type: "column", ref: i.column,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.DeleteColumn({ column: i.column, actor })
            })
        },
        {
            name: "update_milestone",
            description: "Atualiza uma entrega/milestone (nome, descrição, data-alvo, status). LIVRE.",
            inputSchema: Obj({
                milestone: S.str("Milestone (id)"),
                name: S.str("Novo nome"),
                description: S.str("Descrição"),
                targetDate: S.str("Data alvo (ISO)"),
                status: S.enum(["planning","active","released","archived"], "Status")
            }, ["milestone"]),
            handler: (i) => store.UpdateMilestone(A({ milestone: i.milestone, name: i.name, description: i.description, targetDate: i.targetDate, status: i.status }))
        },
        {
            name: "delete_milestone",
            description: "Remove uma entrega/milestone (os itens ficam sem entrega). GATE destrutivo: bloqueia até aprovação humana.",
            inputSchema: Obj({ milestone: S.str("Milestone (id)"), ...WAIT_FIELDS }, ["milestone"]),
            handler: (i) => GatedDelete({
                type: "milestone", ref: i.milestone,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.DeleteMilestone({ milestone: i.milestone, actor })
            })
        },
        {
            name: "update_sprint",
            description: "Atualiza um sprint (nome, objetivo, datas, status). LIVRE.",
            inputSchema: Obj({
                sprint: S.str("Sprint (id)"),
                name: S.str("Novo nome"),
                goal: S.str("Objetivo"),
                startDate: S.str("Início (ISO)"),
                endDate: S.str("Fim (ISO)"),
                status: S.enum(["planned","active","completed","archived"], "Status")
            }, ["sprint"]),
            handler: (i) => store.UpdateSprint(A({ sprint: i.sprint, name: i.name, goal: i.goal, startDate: i.startDate, endDate: i.endDate, status: i.status }))
        },
        {
            name: "delete_sprint",
            description: "Remove um sprint (os itens ficam sem sprint). GATE destrutivo: bloqueia até aprovação humana.",
            inputSchema: Obj({ sprint: S.str("Sprint (id)"), ...WAIT_FIELDS }, ["sprint"]),
            handler: (i) => GatedDelete({
                type: "sprint", ref: i.sprint,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.DeleteSprint({ sprint: i.sprint, actor })
            })
        },

        // ───────────── Detalhe do item: checklist, critérios, vínculos, tipo ─────────────
        {
            name: "add_checklist_item",
            description: "Adiciona um passo ao checklist do item. LIVRE.",
            inputSchema: Obj({ item: S.str("Item (id|key)"), text: S.str("Texto do passo") }, ["item","text"]),
            handler: (i) => store.AddChecklistItem(A({ item: i.item, text: i.text }))
        },
        {
            name: "update_checklist_item",
            description: "Edita/marca um passo do checklist. LIVRE.",
            inputSchema: Obj({ checklistItem: S.str("Passo (id)"), text: S.str("Novo texto"), done: S.bool("Concluído") }, ["checklistItem"]),
            handler: (i) => store.UpdateChecklistItem({ checklistItem: i.checklistItem, text: i.text, done: i.done })
        },
        {
            name: "remove_checklist_item",
            description: "Remove um passo do checklist. GATE destrutivo: bloqueia até aprovação humana.",
            inputSchema: Obj({ checklistItem: S.str("Passo (id)"), ...WAIT_FIELDS }, ["checklistItem"]),
            handler: (i) => GatedDelete({
                type: "checklist-item", ref: i.checklistItem,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.RemoveChecklistItem({ checklistItem: i.checklistItem, actor })
            })
        },
        {
            name: "add_acceptance_criteria",
            description: "Adiciona um critério de aceite (Definition of Done) ao item. LIVRE.",
            inputSchema: Obj({ item: S.str("Item (id|key)"), text: S.str("Texto do critério") }, ["item","text"]),
            handler: (i) => store.AddAcceptanceCriteria({ item: i.item, text: i.text })
        },
        {
            name: "update_acceptance_criteria",
            description: "Edita/marca um critério de aceite. LIVRE.",
            inputSchema: Obj({ criteria: S.str("Critério (id)"), text: S.str("Novo texto"), met: S.bool("Atendido") }, ["criteria"]),
            handler: (i) => store.UpdateAcceptanceCriteria({ criteria: i.criteria, text: i.text, met: i.met })
        },
        {
            name: "remove_acceptance_criteria",
            description: "Remove um critério de aceite. GATE destrutivo: bloqueia até aprovação humana.",
            inputSchema: Obj({ criteria: S.str("Critério (id)"), ...WAIT_FIELDS }, ["criteria"]),
            handler: (i) => GatedDelete({
                type: "acceptance-criteria", ref: i.criteria,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.RemoveAcceptanceCriteria({ criteria: i.criteria, actor })
            })
        },
        {
            name: "unlink_item",
            description: "Remove um vínculo entre itens. LIVRE. Relações: blocks, depends, relates, duplicates, implements, tests.",
            inputSchema: Obj({
                item: S.str("Item de origem (id|key)"),
                relation: S.enum(LINK_RELATIONS, "Relação"),
                target: S.str("Item alvo (id|key)")
            }, ["item","relation","target"]),
            handler: (i) => store.UnlinkItem(A({ item: i.item, relation: i.relation, target: i.target }))
        },
        {
            name: "convert_item",
            description: "Converte o tipo de um item NO LUGAR (ex.: task → story). LIVRE. Para transformar uma IDEIA (discovery) em trabalho preservando a ideia, use convert_idea.",
            inputSchema: Obj({ item: S.str("Item (id|key)"), type: S.enum(WORK_ITEM_TYPES, "Novo tipo") }, ["item","type"]),
            handler: (i) => store.ConvertItem(A({ item: i.item, type: i.type }))
        },
        {
            name: "convert_idea",
            description: "Converte uma IDEIA (discovery) em item de trabalho PRESERVANDO a ideia: cria o item destino a partir dela, cria o vínculo `originated_from` (novo --originated_from--> ideia) e arquiva a ideia (sai do inbox, não é apagada). Retorna { created, idea }. LIVRE.",
            inputSchema: Obj({
                item: S.str("Ideia (id|key)"),
                type: S.enum(WORK_ITEM_TYPES, "Tipo do item de trabalho a criar"),
                title: S.str("Título do novo item (padrão: o da ideia)"),
                parent: S.str("Item pai (id|key) para hierarquia")
            }, ["item","type"]),
            handler: (i) => store.ConvertIdea(A({ item: i.item, type: i.type, title: i.title, parent: i.parent }))
        },
        {
            name: "reorder_item",
            description: "Reordena o item dentro da coluna/lista (order = índice). LIVRE.",
            inputSchema: Obj({ item: S.str("Item (id|key)"), order: S.num("Nova posição") }, ["item","order"]),
            handler: (i) => store.ReorderItem(A({ item: i.item, order: i.order }))
        },

        // ───────────── Executar (itens — LIVRE, sem gate) ─────────────
        {
            name: "create_item",
            description: "Cria um item de trabalho (epic/feature/story/task/subtask/bug/…). LIVRE (não exige aprovação). Use `parent` para hierarquia: epic → feature → story/task → subtask. ESCRITA: título curto e imperativo; descrição em markdown ORGANIZADA e RESUMIDA (seções como ## Reprodução, ## Esperado, ## Obtido). Suporta **negrito**, *itálico* e <u>sublinhado</u>.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                type: S.enum(WORK_ITEM_TYPES, "Tipo do item"),
                title: S.str("Título"),
                description: S.str("Descrição (markdown)"),
                parent: S.str("Item pai (id|key) para hierarquia"),
                board: S.str("Board (id) onde colocar"),
                priority: S.enum(PRIORITIES, "Prioridade"),
                status: S.str("Status inicial (statusKey)"),
                assignee: S.str("Responsável (id|handle)"),
                area: S.str("Área (ex.: GUI, Backend)"),
                horizon: S.enum(HORIZONS, "Horizonte de planejamento"),
                milestone: S.str("Milestone (id) a vincular"),
                sprint: S.str("Sprint (id) a vincular")
            }, ["project","type","title"]),
            handler: (i) => store.CreateItem(A({ project: i.project, type: i.type, title: i.title, description: i.description, parent: i.parent, board: i.board, priority: i.priority, statusKey: i.status, assignee: i.assignee, area: i.area, horizon: i.horizon, milestoneId: i.milestone, sprintId: i.sprint }))
        },
        {
            name: "add_to_inbox",
            description: "Registra uma ideia crua no inbox do projeto (horizon=inbox, clarity=idea) para triagem posterior. LIVRE.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                title: S.str("Ideia / título"),
                description: S.str("Detalhes (markdown)"),
                type: S.enum(WORK_ITEM_TYPES, "Tipo (padrão: task)"),
                area: S.str("Área"),
                ideaOrigin: S.str("Origem da ideia")
            }, ["project","title"]),
            handler: (i) => store.CreateItem(A({ project: i.project, type: i.type || "task", title: i.title, description: i.description, horizon: "inbox", clarityState: "idea", area: i.area, ideaOrigin: i.ideaOrigin }))
        },
        {
            name: "list_items",
            description: "Lista itens do projeto com filtros (status, tipo, responsável, prioridade, milestone, sprint, horizon, texto…).",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                type: S.enum(WORK_ITEM_TYPES, "Filtrar por tipo"),
                status: S.str("Filtrar por status (statusKey)"),
                parent: S.str("Filhos de um item (id|key)"),
                board: S.str("Board (id)"),
                assignee: S.str("Responsável (id|handle)"),
                priority: S.enum(PRIORITIES, "Prioridade"),
                milestone: S.str("Milestone (id|nome)"),
                sprint: S.str("Sprint (id|nome)"),
                package: S.str("Só os itens que tocam este pacote (ref|namespace|nome)"),
                horizon: S.enum(HORIZONS, "Horizonte"),
                text: S.str("Busca textual"),
                limit: S.num("Máx. de itens"),
                offset: S.num("Deslocamento")
            }, ["project"]),
            handler: (i) => store.ListItems({ project: i.project, type: i.type, status: i.status, parent: i.parent, board: i.board, assignee: i.assignee, priority: i.priority, milestone: i.milestone, sprint: i.sprint, horizon: i.horizon, text: i.text, package: i.package, limit: i.limit, offset: i.offset })
        },
        {
            name: "get_item",
            description: "Detalha um item: descrição, critérios de aceite, checklist, links, subtarefas. Leia ANTES de agir numa tarefa.",
            inputSchema: Obj({ item: S.str("Item (id|key, ex.: MPM-42)") }, ["item"]),
            handler: (i) => store.GetItem({ item: i.item })
        },
        {
            name: "update_item",
            description: "Atualiza campos de um item. Use ao receber FEEDBACK do humano (via `list_comments`, comentários que começam com \"Feedback para o agente\"): reescreva o TÍTULO e/ou a DESCRIÇÃO conforme pedido, de forma curta, assertiva e organizada, e depois comente o que mudou.",
            inputSchema: Obj({
                item: S.str("Item (id|key)"),
                title: S.str("Título"),
                description: S.str("Descrição (markdown)"),
                status: S.str("Status (statusKey)"),
                priority: S.enum(PRIORITIES, "Prioridade"),
                progress: S.num("Progresso 0–100"),
                dueDate: S.str("Prazo (ISO)"),
                assignee: S.str("Responsável (id|handle)"),
                repositoryUrl: S.str("Repositório"),
                branchName: S.str("Branch"),
                commitHash: S.str("Commit"),
                pullRequestUrl: S.str("Pull request"),
                horizon: S.enum(HORIZONS, "Horizonte"),
                area: S.str("Área"),
                typeFields: { type: "object", additionalProperties: true, description: "Campos específicos do tipo (bug: severity/regression/expected/actual/repro; story: persona/need/benefit; decision/research/tech-debt…). Merge no servidor: manda só o que muda." }
            }, ["item"]),
            handler: (i) => store.UpdateItem(A({ item: i.item, title: i.title, description: i.description, statusKey: i.status, priority: i.priority, progress: i.progress, dueDate: i.dueDate, assignee: i.assignee, repositoryUrl: i.repositoryUrl, branchName: i.branchName, commitHash: i.commitHash, pullRequestUrl: i.pullRequestUrl, horizon: i.horizon, area: i.area, typeFields: i.typeFields }))
        },
        {
            name: "set_item_status",
            description: "Muda o status de um item (ex.: backlog → ready → in-progress → review → done). LIVRE.",
            inputSchema: Obj({ item: S.str("Item (id|key)"), status: S.str("Novo status (statusKey)") }, ["item","status"]),
            handler: (i) => store.SetStatus(A({ item: i.item, status: i.status }))
        },
        {
            name: "assign_item",
            description: "Atribui um item a um usuário (humano ou agente).",
            inputSchema: Obj({ item: S.str("Item (id|key)"), user: S.str("Usuário (id|handle)") }, ["item","user"]),
            handler: (i) => store.Assign(A({ item: i.item, user: i.user }))
        },
        {
            name: "move_item_to_board",
            description: "Move um item para outro board (opcionalmente ajustando o status/coluna).",
            inputSchema: Obj({ item: S.str("Item (id|key)"), board: S.str("Board (id)"), status: S.str("Status/coluna destino") }, ["item","board"]),
            handler: (i) => store.MoveToBoard(A({ item: i.item, board: i.board, status: i.status }))
        },
        {
            name: "block_item",
            description: "Marca um item como bloqueado, com motivo (envie `reason` vazio para desbloquear).",
            inputSchema: Obj({ item: S.str("Item (id|key)"), reason: S.str("Motivo do bloqueio") }, ["item"]),
            handler: (i) => store.SetBlocked(A({ item: i.item, reason: i.reason }))
        },
        {
            name: "link_item",
            description: "Cria um vínculo entre itens. Relações aceitas (exatas): blocks, depends, relates, duplicates, implements, tests, originated_from. Direção: `item` --relação--> `target` (ex.: relation=blocks significa que `item` BLOQUEIA `target`; originated_from = `item` originou-se de `target`).",
            inputSchema: Obj({
                item: S.str("Item origem (id|key)"),
                relation: S.enum(LINK_RELATIONS, "Relação (valor exato)"),
                target: S.str("Item alvo (id|key)")
            }, ["item","relation","target"]),
            handler: (i) => store.LinkItem(A({ item: i.item, relation: i.relation, target: i.target }))
        },
        {
            name: "assign_item_planning",
            description: "Vincula um item a um MILESTONE e/ou SPRINT (e ajusta o horizonte). Use \"none\" para desvincular. Sem isso, milestones/sprints ficam com totalItems 0.",
            inputSchema: Obj({
                item: S.str("Item (id|key)"),
                milestone: S.str("Milestone (id) ou \"none\" para remover"),
                sprint: S.str("Sprint (id) ou \"none\" para remover"),
                horizon: S.enum(HORIZONS, "Horizonte de planejamento (opcional)")
            }, ["item"]),
            handler: async (i) => {
                let result
                if(i.milestone !== undefined || i.sprint !== undefined)
                    result = await store.AssignItemPlanning(A({ item: i.item, milestone: i.milestone, sprint: i.sprint }))
                if(i.horizon !== undefined)
                    result = await store.UpdateItem(A({ item: i.item, horizon: i.horizon }))
                return result || store.GetItem({ item: i.item })
            }
        },

        // ───────────── Interagir ─────────────
        {
            name: "add_comment",
            description: "Adiciona um comentário a um item — registre o que você (agente) fez, dúvidas ou resultados. LIVRE.",
            inputSchema: Obj({ item: S.str("Item (id|key)"), body: S.str("Texto (markdown)"), format: S.str("Formato (markdown|text)") }, ["item","body"]),
            handler: (i) => store.AddComment(A({ item: i.item, body: i.body, format: i.format }))
        },
        {
            name: "list_comments",
            description: "Lista os comentários de um item — leia o FEEDBACK do humano ANTES de agir. Comentários iniciados por \"Feedback para o agente — reescrever…\" são instruções DIRETAS sobre o título/descrição: aplique-as com `update_item`.",
            inputSchema: Obj({ item: S.str("Item (id|key)") }, ["item"]),
            handler: (i) => store.ListComments({ item: i.item })
        },
        {
            name: "add_link_attachment",
            description: "Anexa um link a um item. Esquemas aceitos: http, https e file:// (referência a arquivo LOCAL, sem copiar o conteúdo — use add_file_attachment para guardar o arquivo).",
            inputSchema: Obj({ item: S.str("Item (id|key)"), url: S.str("URL"), name: S.str("Nome"), description: S.str("Descrição") }, ["item","url"]),
            handler: (i) => store.AddLinkAttachment(A({ item: i.item, url: i.url, name: i.name, description: i.description }))
        },
        {
            name: "add_file_attachment",
            description: "Anexa um arquivo LOCAL (log, print, artefato) a um item. O caminho deve ser acessível no host onde o servidor MCP roda.",
            inputSchema: Obj({ item: S.str("Item (id|key)"), filePath: S.str("Caminho do arquivo local"), name: S.str("Nome"), description: S.str("Descrição") }, ["item","filePath"]),
            handler: (i) => store.AddFileAttachment(A({ item: i.item, filePath: i.filePath, name: i.name, description: i.description }))
        },

        // ───────────── Acompanhar / contexto ─────────────
        {
            name: "list_projects",
            description: "Lista os projetos.",
            inputSchema: Obj({ status: S.str("Filtrar por status"), includeArchived: S.bool("Incluir arquivados") }),
            handler: (i) => store.ListProjects({ status: i.status, includeArchived: i.includeArchived })
        },
        {
            name: "get_project",
            description: "Detalha um projeto (metadados, board padrão, key-prefix).",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.GetProject({ project: i.project })
        },
        {
            name: "set_project_report",
            description: "Grava o RELATÓRIO FINAL de conclusão de um projeto: markdown com o panorama do que foi feito, com links para itens (ex.: [[CFGEC-9]]) e commits. LIVRE (não exige aprovação) — é um deliverable que o agente redige e o humano lê. Substitui o relatório anterior. Renderizado na aba 'Relatório Final' da GUI.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)"), finalReport: S.str("Relatório final em markdown") }, ["project", "finalReport"]),
            handler: (i) => store.SetProjectReport(A({ project: i.project, finalReport: i.finalReport }))
        },
        {
            name: "get_project_report",
            description: "Lê o relatório final de um projeto (retorna o markdown e quando foi atualizado).",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.GetProjectReport({ project: i.project })
        },
        {
            name: "list_boards",
            description: "Lista os boards de um projeto (com colunas/status).",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ListBoards({ project: i.project })
        },
        {
            name: "project_status",
            description: "Relatório de status do projeto (contagens por status/tipo, bloqueados, atrasados, progresso).",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ProjectStatus({ project: i.project })
        },
        {
            name: "roadmap",
            description: "Roadmap do projeto por horizonte (inbox/now/next/later/maybe) — visão de planejamento.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.RoadmapByHorizon({ project: i.project })
        },
        {
            name: "project_flow",
            description: "Fluxo TEMPORAL do projeto reconstruído do histórico real (audit log): Cumulative Flow (itens por status por dia) e throughput (concluídos/criados por dia). `hasData:false` significa histórico insuficiente — não invente tendências nesse caso.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ProjectFlow({ project: i.project })
        },

        // ───────────── Descobrir / decidir (criar novo vs. atualizar existente, conflitos) ─────────────
        {
            name: "search_items",
            description: "Busca itens por texto em TODOS os projetos (ou num só, se `project` for informado). USE ANTES de criar: para decidir se já existe algo equivalente (então ATUALIZE em vez de duplicar) e para achar itens relacionados/conflitantes entre projetos.",
            inputSchema: Obj({
                text: S.str("Termo a buscar no título"),
                project: S.str("Restringe a um projeto (id|slug|key); omita para buscar em todos"),
                type: S.enum(WORK_ITEM_TYPES, "Filtrar por tipo"),
                status: S.str("Filtrar por status (statusKey)"),
                assignee: S.str("Responsável (id|handle)"),
                area: S.str("Área"),
                limit: S.num("Máx. de itens (padrão 50)")
            }, ["text"]),
            handler: (i) => store.ListItems({ text: i.text, project: i.project, type: i.type, status: i.status, assignee: i.assignee, area: i.area, package: i.package, limit: i.limit || 50, sort: "created" })
        },
        {
            name: "list_milestones",
            description: "Lista os milestones do projeto (com progresso) — contexto de planejamento para decidir onde encaixar o trabalho.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ListMilestones({ project: i.project })
        },
        {
            name: "list_sprints",
            description: "Lista os sprints do projeto (com progresso) — contexto de execução em curso.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ListSprints({ project: i.project })
        },
        {
            name: "report_blocked",
            description: "Lista os itens BLOQUEADOS do projeto — sinaliza dependências travadas e possíveis conflitos a resolver antes de avançar.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.Blocked({ project: i.project })
        },
        {
            name: "report_overdue",
            description: "Lista os itens ATRASADOS (prazo vencido) do projeto — riscos que podem conflitar com um novo plano.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.Overdue({ project: i.project })
        },

        // ───────────── Contexto do ecossistema (Meta Platform) ─────────────
        //
        // "Onde mexo?" não se responde com uma URL de repositório, e sim com um
        // PACOTE: Repositório → Módulo → Camada → Grupo → Pacote (.lib, .webgui,
        // .cli, .service, .webservice, .desktopapp…). Um item pode tocar VÁRIOS.
        // NÃO digite o nome de cabeça: liste e use o `ref` que voltar.
        {
            name: "list_ecosystem_packages",
            description: "Lista/pesquisa os pacotes reais do ecossistema (indexados do disco). Busque por nome, grupo, camada, módulo, repositório ou tipo. USE ANTES de vincular um item a um pacote — o `ref` devolvido aqui é o identificador correto.",
            inputSchema: Obj({
                text: S.str("Termo (nome do pacote, grupo, camada, módulo, repositório)"),
                repository: S.str("Repositório (ex.: ApplicationsRepository)"),
                module: S.str("Módulo (ex.: Apps.Module)"),
                layer: S.str("Camada (ex.: Productivity.layer)"),
                group: S.str("Grupo (ex.: MetaProjectManager.group)"),
                type: S.str("Tipo do pacote (lib|webgui|cli|service|webservice|desktopapp|webapp)"),
                limit: S.num("Máx. de pacotes"), offset: S.num("Deslocamento")
            }),
            handler: (i) => store.ListEcosystemPackages({
                text: i.text, repository: i.repository, module: i.module,
                layer: i.layer, group: i.group, type: i.type, limit: i.limit, offset: i.offset
            })
        },
        {
            name: "index_ecosystem_packages",
            description: "Relê os repositórios do disco e atualiza o catálogo de pacotes. Rode quando um pacote novo não aparecer em list_ecosystem_packages.",
            inputSchema: Obj({}),
            handler: () => store.IndexEcosystemPackages(A({}))
        },
        {
            name: "list_item_packages",
            description: "Pacotes que um item toca, com o papel de cada um (primary = onde o trabalho acontece; touched = também é alterado).",
            inputSchema: Obj({ item: S.str("Item (id|key)") }, ["item"]),
            handler: (i) => store.ListItemPackages({ item: i.item })
        },
        {
            name: "set_item_packages",
            description: "Define TODOS os pacotes que o item toca (substitui os anteriores). Aceita o `ref` completo ou o nome do pacote quando único. LIVRE. Uma mudança real costuma atravessar store, webservice, MCP e GUI — liste todos.",
            inputSchema: Obj({
                item: S.str("Item (id|key)"),
                packages: {
                    type: "array",
                    description: "Pacotes tocados",
                    items: Obj({
                        package: S.str("ref, namespace ou nome do pacote"),
                        role: S.enum(["primary", "touched"], "Papel (padrão: touched)"),
                        note: S.str("O que muda neste pacote")
                    }, ["package"])
                }
            }, ["item", "packages"]),
            handler: (i) => store.SetItemPackages(A({ item: i.item, packages: i.packages }))
        },
        {
            name: "add_item_package",
            description: "Vincula um pacote a um item, sem mexer nos outros. LIVRE.",
            inputSchema: Obj({
                item: S.str("Item (id|key)"),
                package: S.str("ref, namespace ou nome do pacote"),
                role: S.enum(["primary", "touched"], "Papel (padrão: touched)"),
                note: S.str("O que muda neste pacote")
            }, ["item", "package"]),
            handler: (i) => store.AddItemPackage(A({ item: i.item, package: i.package, role: i.role, note: i.note }))
        },
        {
            name: "remove_item_package",
            description: "Desvincula um pacote de um item. LIVRE.",
            inputSchema: Obj({ item: S.str("Item (id|key)"), package: S.str("ref ou nome do pacote") }, ["item", "package"]),
            handler: (i) => store.RemoveItemPackage(A({ item: i.item, package: i.package }))
        },

        // ───────────── Feedback do humano (fila com claim exclusivo) ─────────────
        //
        // O humano clica com o botão direito num campo da interface e escreve o que
        // quer diferente. O feedback guarda ONDE foi dado (entidade + campo + tela +
        // trecho). Vários agentes leem a mesma fila: pegue com claim_feedback (é
        // exclusivo e tem prazo) antes de trabalhar, e feche com resolve_feedback.
        {
            name: "list_feedback",
            description: "Lista feedbacks do humano para os agentes. Por padrão só os ABERTOS (inclui os que estavam com outro agente e cujo claim expirou). Cada feedback diz o campo/escopo, a entidade e o trecho criticado. Além do feedback de ITEM, o humano dá feedback de ESCOPO (de tela): sobre o projeto inteiro (scope=project), todo o planejamento (scope=planning), todas as ideias (scope=ideas), o board/lista/backlog, ou uma PÁGINA de documentação (scope=doc-page — o entityId é o id da página; use get_doc_page para lê-la) — filtre por `scope` para pegar só um recorte. FLUXO: list_feedback → claim_feedback → (aplique a correção) → resolve_feedback.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                status: S.enum(["open","in-analysis","resolved","dismissed","all"], "Status (padrão: open)"),
                item: S.str("Só os feedbacks deste item (id|key)"),
                scope: S.enum(["work-item","project","planning","ideas","board","list","backlog","doc-page"], "Escopo: só o feedback deste recorte (ex.: planning = todo o planejamento; doc-page = uma página de documentação, com o id da página em entityId)"),
                since: S.str("Criados a partir desta data/hora (ISO)"),
                until: S.str("Criados até esta data/hora (ISO)"),
                limit: S.num("Máx. de feedbacks"), offset: S.num("Deslocamento")
            }),
            handler: (i) => store.ListFeedback({
                project: i.project, status: i.status, item: i.item, entityType: i.scope,
                since: i.since, until: i.until, limit: i.limit, offset: i.offset
            })
        },
        {
            name: "get_feedback",
            description: "Detalhe de um feedback: texto, onde foi dado (entidade/campo/tela/trecho) e o estado do claim.",
            inputSchema: Obj({ feedback: S.str("Feedback (id)") }, ["feedback"]),
            handler: (i) => store.GetFeedback({ feedback: i.feedback })
        },
        {
            name: "claim_feedback",
            description: "PEGA um feedback para trabalhar nele. É EXCLUSIVO: se outro agente já o pegou (e o claim está vivo), retorna CONFLICT — pule para o próximo. O claim EXPIRA (padrão 30 min): se você demorar, o feedback volta para a fila e outro agente pode assumir. Renove chamando claim_feedback de novo. NÃO trabalhe num feedback sem claim.",
            inputSchema: Obj({
                feedback: S.str("Feedback (id)"),
                ttlSeconds: S.num("Duração do claim em segundos (padrão 1800 = 30 min)")
            }, ["feedback"]),
            handler: (i) => store.ClaimFeedback(A({ feedback: i.feedback, ttlSeconds: i.ttlSeconds }))
        },
        {
            name: "release_feedback",
            description: "Devolve para a fila um feedback que você havia pegado mas não vai resolver agora.",
            inputSchema: Obj({ feedback: S.str("Feedback (id)") }, ["feedback"]),
            handler: (i) => store.ReleaseFeedback(A({ feedback: i.feedback }))
        },
        {
            name: "resolve_feedback",
            description: "Marca o feedback como RESOLVIDO (some da fila). Só quem detém o claim vivo pode resolver. Aplique a correção ANTES (update_item, update_project…) e descreva em `note` o que mudou.",
            inputSchema: Obj({
                feedback: S.str("Feedback (id)"),
                note: S.str("O que você mudou para atender o feedback")
            }, ["feedback"]),
            handler: (i) => store.ResolveFeedback(A({ feedback: i.feedback, note: i.note }))
        },

        {
            name: "project_changes",
            description: "TUDO que mudou num projeto numa janela de tempo, de uma vez — para o agente se atualizar desde a última consulta. Passe `since` com o `latestAt` da consulta anterior. Devolve os eventos em ordem cronológica, um resumo por ação/entidade e o novo `latestAt`.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                since: S.str("Início da janela (ISO). Omitido = desde sempre"),
                until: S.str("Fim da janela (ISO). Omitido = agora"),
                limit: S.num("Teto de eventos (padrão 500)")
            }, ["project"]),
            handler: async (i) => {
                const projectId = (await store.ResolveProject(i.project)).id
                const limit = Number(i.limit) > 0 ? Number(i.limit) : 500

                // Pagina até o teto: o agente pediu "de uma vez", não uma página.
                const PAGE = 100
                const events = []
                for(let offset = 0; offset < limit; offset += PAGE){
                    const page = await store.ListActivity({
                        projectId, from: i.since, to: i.until,
                        limit: Math.min(PAGE, limit - offset), offset, actor
                    })
                    events.push(...page)
                    if(page.length < PAGE) break
                }

                // Ordem cronológica (a auditoria devolve do mais novo para o mais antigo).
                events.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))

                const byAction = {}
                const byEntity = {}
                for(const e of events){
                    byAction[e.action] = (byAction[e.action] || 0) + 1
                    byEntity[e.entityType] = (byEntity[e.entityType] || 0) + 1
                }

                return {
                    project: projectId,
                    since: i.since || null,
                    until: i.until || null,
                    count: events.length,
                    truncated: events.length >= limit,
                    // Guarde e mande de volta como `since` na próxima consulta.
                    latestAt: events.length > 0 ? events[events.length - 1].createdAt : (i.since || null),
                    summary: { byAction, byEntity },
                    events
                }
            }
        },

        {
            name: "list_activity",
            description: "Auditoria: quem/qual sessão fez o quê, com filtros (ação, ator, provider, modelo, fonte, período). Útil para o agente se situar antes de agir. Consulta GLOBAL (sem `project`) exige a permissão activity:read:all_projects — sem ela retorna FORBIDDEN.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key). Omita para consulta global (exige permissão)"),
                entityType: S.str("Tipo de entidade (project|board|work-item|…)"),
                entityId: S.str("Id da entidade"),
                action: S.str("Ação (create|update|set-status|approve|…)"),
                actorType: S.enum(["human","agent","system","desktop"], "Tipo do ator"),
                source: S.enum(["gui","cli","api","agent","mcp","desktop"], "Fonte da ação"),
                provider: S.str("Provider do agente (claude|codex|…)"),
                model: S.str("Modelo usado"),
                from: S.str("Início do intervalo (ISO)"),
                to: S.str("Fim do intervalo (ISO)"),
                limit: S.num("Máx. de eventos"), offset: S.num("Deslocamento")
            }),
            handler: async (i) => {
                const projectId = i.project ? (await store.ResolveProject(i.project)).id : undefined
                return store.ListActivity({
                    projectId, entityType: i.entityType, entityId: i.entityId, action: i.action,
                    actorType: i.actorType, source: i.source, provider: i.provider, model: i.model,
                    from: i.from, to: i.to, limit: i.limit, offset: i.offset, actor
                })
            }
        },
        {
            name: "list_audit_events",
            description: "Eventos de auditoria (imutáveis) com diff antes→depois. Mesmos filtros de list_activity. Consulta global exige permissão.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"), action: S.str("Ação"),
                actorType: S.enum(["human","agent","system","desktop"], "Tipo do ator"),
                provider: S.str("Provider"), model: S.str("Modelo"),
                from: S.str("Início (ISO)"), to: S.str("Fim (ISO)"),
                limit: S.num("Máx."), offset: S.num("Deslocamento")
            }),
            handler: async (i) => {
                const projectId = i.project ? (await store.ResolveProject(i.project)).id : undefined
                return store.ListActivity({ projectId, action: i.action, actorType: i.actorType, provider: i.provider, model: i.model, from: i.from, to: i.to, limit: i.limit, offset: i.offset, actor })
            }
        },
        {
            name: "get_audit_event",
            description: "Detalha um evento de auditoria: ator, sessão, provider/modelo, ação e o diff (antes → depois).",
            inputSchema: Obj({ event: S.str("Id do evento de auditoria") }, ["event"]),
            handler: (i) => store.GetAuditEvent({ event: i.event })
        },
        {
            name: "add_activity_note",
            description: "Registra uma ANOTAÇÃO de atividade num escopo (projeto/board/sprint/milestone/item). Use para deixar contexto legível para humanos e outros agentes. Distinta de add_comment (que é conversa sobre um item específico).",
            inputSchema: Obj({
                text: S.str("Texto da anotação"),
                project: S.str("Projeto (id|slug|key)"), board: S.str("Board (id)"),
                sprint: S.str("Sprint (id)"), milestone: S.str("Milestone (id)"),
                item: S.str("Item (id|key)")
            }, ["text"]),
            handler: (i) => store.AddActivityNote(A({ text: i.text, project: i.project, board: i.board, sprint: i.sprint, milestone: i.milestone, item: i.item, source: "mcp" }))
        },
        {
            name: "list_activity_notes",
            description: "Lê as ANOTAÇÕES de atividade de um escopo — inclusive as escritas manualmente pelo `usuario-desktop`. Leia antes de agir para captar contexto humano recente. Sem escopo, exige permissão global.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"), board: S.str("Board (id)"),
                sprint: S.str("Sprint (id)"), milestone: S.str("Milestone (id)"),
                item: S.str("Item (id|key)"),
                from: S.str("Início (ISO)"), to: S.str("Fim (ISO)"), limit: S.num("Máx.")
            }),
            handler: (i) => store.ListActivityNotes({ project: i.project, board: i.board, sprint: i.sprint, milestone: i.milestone, item: i.item, from: i.from, to: i.to, limit: i.limit, actor })
        },
        {
            name: "get_activity_context",
            description: "Contexto consolidado de um escopo: anotações humanas recentes + auditoria recente. Chame ANTES de agir para entender o que aconteceu e reagir às notas do humano.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"), board: S.str("Board (id)"),
                sprint: S.str("Sprint (id)"), milestone: S.str("Milestone (id)"),
                item: S.str("Item (id|key)"), limit: S.num("Máx. por seção")
            }),
            handler: (i) => store.GetActivityContext({ project: i.project, board: i.board, sprint: i.sprint, milestone: i.milestone, item: i.item, limit: i.limit, actor })
        },

        // ───────────── Orientação (para clientes que ignoram `instructions`) ─────────────
        {
            name: "get_guidance",
            description: "Regras de operação deste gerenciador: o que é livre, o que exige aprovação humana, como escrever título/descrição, relações de vínculo válidas, códigos de erro e o fluxo recomendado. Chame UMA VEZ no início da sessão se você não recebeu as instruções do servidor.",
            inputSchema: Obj({}),
            handler: async () => ({
                instructions: INSTRUCTIONS,
                constraints: {
                    linkRelations: LINK_RELATIONS,
                    keyPrefixMaxChars: 5,
                    shortDescriptionMaxChars: 240,
                    linkAttachmentSchemes: ["http", "https", "file"],
                    gatedActions: {
                        create: ["project", "board", "milestone", "sprint"],
                        delete: ["project", "board", "item", "risk", "planning-doc"]
                    },
                    humanOnly: ["aprovar pedido", "rejeitar pedido", "confirmar sessão"],
                    globalActivityPermission: "activity:read:all_projects"
                },
                session: {
                    provider: actor && actor.session && actor.session.provider,
                    model: actor && actor.session && actor.session.model,
                    traceId: actor && actor.session && actor.session.traceId
                }
            })
        }
    ]
}

module.exports = { BuildTools }
