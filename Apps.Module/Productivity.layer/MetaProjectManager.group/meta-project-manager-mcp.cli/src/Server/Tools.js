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
// Risco ↔ item e marco ↔ marco (Config.RISK_LINK_RELATIONS / MILESTONE_LINK_RELATIONS).
const RISK_LINK_RELATIONS = ["mitigates","triggers","relates"]
const MILESTONE_LINK_RELATIONS = ["depends","blocks"]
// Planejamento por item: estimativa em faixas, confiança e valor.
const EFFORTS = ["xs","s","m","l","xl"]
const CONFIDENCE = ["low","medium","high"]
const VALUES = ["none","low","medium","high","critical"]
// Registro de riscos: escala da matriz 3×3 (probabilidade/impacto) e ciclo de vida.
const RISK_LEVELS = ["low","medium","high"]
const RISK_STATUSES = ["open","mitigating","accepted","closed","occurred"]
// Documento de planejamento (termo de abertura/charter): ciclo de vida.
const PLANNING_DOC_STATUSES = ["draft","review","approved","archived"]

const { INSTRUCTIONS } = require("./Instructions")
const { MutationResult, ListEnvelope, ITEM_LIST_FIELDS, PROJECT_LIST_FIELDS, RunBatch, Pick } = require("./Envelopes")

const BuildTools = ({ store, actor }) => {

    // Anexa o ator do agente ao payload de uma mutação.
    const A = (payload) => ({ ...payload, actor })

    // Erro de domínio para a camada MCP (formatado como { ok:false, code, ... }).
    const McpError = (code, message, details) => Object.assign(new Error(message), { code, details })

    // ───────────── Envelopes de resposta (camada MCP, store/GUI intactos) ─────────────
    //
    // MPMX-3: mutações de item devolvem um RESUMO por padrão (não o item inteiro com
    //   a descrição longa) — barato para confirmar em lote. `view:"full"` traz tudo.
    // MPMX-7: junto vai `pendingFeedbackCount` do item, para o agente saber que há
    //   feedback do humano sem uma chamada list_feedback extra a cada ciclo.
    const ITEM_SUMMARY_FIELDS = ["key", "statusKey", "progress", "completedAt", "updatedAt"]
    const SummarizeItem = (it) => {
        if(!it || typeof it !== "object") return it
        const out = {}
        for(const f of ITEM_SUMMARY_FIELDS) if(f in it) out[f] = it[f]
        return out
    }
    // Conta o feedback ABERTO deste item (escopo work-item). Nunca derruba a mutação:
    // se a contagem falhar, volta undefined e o retorno principal segue.
    const PendingFeedbackForItem = async (itemRef) => {
        try {
            const list = await store.ListFeedback({ item: itemRef, status: "open", limit: 500 })
            return Array.isArray(list) ? list.length : undefined
        } catch(e){ return undefined }
    }
    // Envelopa o retorno de uma mutação de item: view=summary (padrão) encolhe o
    // corpo; pendingFeedbackCount evita o list_feedback extra.
    const ItemMutationResult = async (data, view) => {
        const body = view === "full" ? data : SummarizeItem(data)
        const pendingFeedbackCount = data && data.id ? await PendingFeedbackForItem(data.id) : undefined
        // O que FALTA para o item estar pronto atravessa o resumo: encolher a
        // resposta não pode apagar justamente o aviso de que a definição de
        // pronto não foi cumprida (MPMX3-10).
        const unmet = data && data.unmetAcceptanceCriteria
        return { ...body, pendingFeedbackCount, ...(unmet && unmet.length ? { unmetAcceptanceCriteria: unmet } : {}) }
    }
    // Campo `view` comum às mutações de item.
    const VIEW_FIELD = { view: S.enum(["summary", "full"], "Formato do retorno: summary (padrão) = { key, statusKey, progress, completedAt, updatedAt } + pendingFeedbackCount; full = o item inteiro.") }

    // MPMX2-2: TODA escrita devolve resumo por padrão, não só as de item. Devolver
    // o registro inteiro repete para o agente a descrição que ele mesmo acabou de
    // mandar — em 124 criações, é o dobro do custo sem uma informação nova.
    const Written = (entity) => (data, view) => MutationResult(data, view, entity)
    const VIEW_FIELD_FOR = (entity, summaryHint) => ({
        view: S.enum(["summary", "full"], `Formato do retorno: summary (padrão) = ${summaryHint}; full = o registro inteiro.`)
    })

    // MPMX2-4: projeção nas listagens, com o MESMO contrato do search_items —
    // envelope { items, total, limit, offset } e resumo sem a descrição longa.
    const FIELDS_FIELD = {
        fields: { type: "array", items: { type: "string" }, description: "Projeção: SÓ estes campos por registro (ex.: [\"key\",\"title\",\"statusKey\"]). Omitido = resumo padrão (sem a descrição longa)." },
        limit: S.num("Máx. de registros por página"),
        offset: S.num("Deslocamento para paginar (padrão 0)")
    }

    // Criação de item usada por create_item, create_items (lote) e add_to_inbox —
    // um caminho só, para os três aceitarem exatamente os mesmos campos.
    // `acceptanceCriteria` entra aqui porque criar o item e a sua Definition of
    // Done em chamadas separadas era o segundo maior gerador de round-trips.
    const CreateItemFromInput = async (i) => {
        const created = await store.CreateItem(A({
            project: i.project, type: i.type, title: i.title,
            shortDescription: i.shortDescription, description: i.description,
            parent: i.parent, board: i.board, priority: i.priority, statusKey: i.status,
            assignee: i.assignee, area: i.area, labels: i.labels,
            effort: i.effort, confidence: i.confidence, value: i.value,
            horizon: i.horizon, clarityState: i.clarityState, ideaOrigin: i.ideaOrigin,
            milestoneId: i.milestone, sprintId: i.sprint
        }))
        if(Array.isArray(i.acceptanceCriteria))
            for(const text of i.acceptanceCriteria)
                if(text && String(text).trim()) await store.AddAcceptanceCriteria({ item: created.id, text })
        return MutationResult(created, i.view, "item")
    }

    // Executa uma AÇÃO GATED (criar projeto/board/milestone/sprint, ou deletar).
    // O gate transforma a chamada num pedido pendente; por padrão (waitApproval)
    // a tool BLOQUEIA (polling do SQLite via WaitForApproval) até a decisão humana
    // e devolve o resultado da ação — o agente não segue adiante sem o veredicto.
    // Se rejeitado/expirado, erro estruturado. resumeToken (derivado da ação + alvo)
    // dá idempotência: retries reusam o pedido pendente em vez de duplicá-lo.
    const ACTION_LABEL = {
        create: "criação", delete: "remoção", "set-status": "mudança de status",
        "set-status-batch": "mudança de status em lote"
    }
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

    const TOOLS = [
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
            description: "Cria um milestone — na interface chamado \"Entrega\": um alvo com data. LIVRE (planejamento é reversível). Criar a entrega NÃO vincula itens: use assign_item_planning. Para sequenciar fases, use link_milestones em vez de escrever \"depende de F1\" na descrição.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                name: S.str("Nome do milestone"),
                shortDescription: S.str("Resumo de UMA linha (<=240 chars) — é o que se lê no card da entrega"),
                description: S.str("Descrição"),
                targetDate: S.str("Data alvo (ISO, ex.: 2026-09-01)"),
                ...VIEW_FIELD_FOR("milestone", "{ id, name, status, targetDate, updatedAt }")
            }, ["project","name"]),
            handler: async (i) => Written("milestone")(await store.CreateMilestone(A({ project: i.project, name: i.name, shortDescription: i.shortDescription, description: i.description, targetDate: i.targetDate })), i.view)
        },
        {
            name: "create_sprint",
            description: "Cria um sprint (janela de tempo com um objetivo). LIVRE (planejamento é reversível).",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                name: S.str("Nome do sprint"),
                shortDescription: S.str("Resumo de UMA linha (<=240 chars)"),
                goal: S.str("Objetivo do sprint"),
                startDate: S.str("Início (ISO)"),
                endDate: S.str("Fim (ISO)"),
                ...VIEW_FIELD_FOR("sprint", "{ id, name, status, startDate, endDate, updatedAt }")
            }, ["project","name"]),
            handler: async (i) => Written("sprint")(await store.CreateSprint(A({ project: i.project, name: i.name, shortDescription: i.shortDescription, goal: i.goal, startDate: i.startDate, endDate: i.endDate })), i.view)
        },
        {
            name: "link_milestones",
            description: "Declara DEPENDÊNCIA entre entregas: `relation:\"depends\"` = a entrega precisa da outra concluída antes; `\"blocks\"` = a outra precisa desta. Rejeita ciclo (VALIDATION_ERROR). Alimenta o `roadmap` (que passa a sair em ordem topológica), o `dependenciesMet` de list_milestones e a prontidão em report_ready. LIVRE.",
            inputSchema: Obj({
                milestone: S.str("Entrega de origem (id)"),
                relation: S.enum(MILESTONE_LINK_RELATIONS, "depends (precisa da outra) | blocks (a outra precisa desta)"),
                target: S.str("Outra entrega (id)"),
                ...VIEW_FIELD_FOR("milestoneLink", "{ id, sourceMilestoneId, relation, targetMilestoneId }")
            }, ["milestone","target"]),
            handler: async (i) => Written("milestoneLink")(await store.LinkMilestones(A({ milestone: i.milestone, relation: i.relation, target: i.target })), i.view)
        },
        {
            name: "unlink_milestones",
            description: "Remove a dependência entre duas entregas. Sem `relation`, remove qualquer vínculo entre as duas. LIVRE.",
            inputSchema: Obj({
                milestone: S.str("Entrega de origem (id)"),
                relation: S.enum(MILESTONE_LINK_RELATIONS, "Relação a remover (omitir = todas entre as duas)"),
                target: S.str("Outra entrega (id)")
            }, ["milestone","target"]),
            handler: (i) => store.UnlinkMilestones(A({ milestone: i.milestone, relation: i.relation, target: i.target }))
        },

        // ───────────── Documentação do projeto (wiki em árvore) ─────────────
        // Páginas de markdown organizadas em árvore (parentId). Boa fonte de
        // contexto E manutenível pelo agente. Criar/editar é LIVRE; excluir é gated.
        {
            name: "list_doc_pages",
            description: "Lista as páginas de documentação do projeto (planas; monte a árvore por parentId). NÃO traz o corpo markdown — só o tamanho (`bodyLength`), para você decidir o que abrir; use get_doc_page para o conteúdo. Peça o corpo explicitamente com fields:[\"id\",\"title\",\"body\"] se realmente precisar dele em lote.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                ...FIELDS_FIELD
            }, ["project"]),
            handler: async (i) => {
                const limit = Number(i.limit) > 0 ? Number(i.limit) : 200
                const offset = Number(i.offset) > 0 ? Number(i.offset) : 0
                const all = await store.ListDocPages({ project: i.project })
                // O `body` é markdown inteiro de cada página: 14 páginas bastaram para
                // estourar o contexto do cliente. Some por padrão, e no lugar dele fica
                // o tamanho — o suficiente para escolher qual página vale abrir.
                const rows = all.slice(offset, offset + limit).map((page) => ({
                    ...page,
                    bodyLength: page.body ? String(page.body).length : 0
                }))
                const DEFAULT_FIELDS = ["id", "title", "icon", "parentId", "order", "bodyLength", "updatedAt"]
                return ListEnvelope({ rows, total: all.length, limit, offset, fields: i.fields, defaultFields: DEFAULT_FIELDS })
            }
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
                body: S.str("Conteúdo em markdown"),
                ...VIEW_FIELD_FOR("docPage", "{ id, title, parentId, order, updatedAt }")
            }, ["project","title"]),
            handler: async (i) => Written("docPage")(await store.CreateDocPage(A({ project: i.project, parentId: i.parentId, title: i.title, icon: i.icon, body: i.body })), i.view)
        },
        {
            name: "update_doc_page",
            description: "Edita uma página de documentação (título/ícone/corpo). LIVRE. Para mover/reordenar na árvore use move_doc_page.",
            inputSchema: Obj({
                docPage: S.str("Id da página de documentação"),
                title: S.str("Novo título"),
                icon: S.str("Novo emoji do ícone"),
                body: S.str("Novo corpo em markdown"),
                ...VIEW_FIELD_FOR("docPage", "{ id, title, parentId, order, updatedAt }")
            }, ["docPage"]),
            handler: async (i) => Written("docPage")(await store.UpdateDocPage(A({ docPage: i.docPage, title: i.title, icon: i.icon, body: i.body })), i.view)
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
            description: "Lista os riscos do projeto (com o nível derivado da matriz probabilidade×impacto no campo `level`). Passe `item` para ver só os riscos VINCULADOS àquele item de trabalho.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                item: S.str("Só os riscos vinculados a este item (id|key)")
            }),
            handler: (i) => store.ListRisks({ project: i.project, item: i.item })
        },
        {
            name: "get_risk",
            description: "Lê um risco (descrição, mitigação, contingência, dono, marco, nível) E os itens de trabalho vinculados a ele — abrir um risco já responde se existe trabalho endereçando-o.",
            inputSchema: Obj({ risk: S.str("Id do risco") }, ["risk"]),
            handler: (i) => store.GetRisk({ risk: i.risk })
        },
        {
            name: "link_risk_item",
            description: "Vincula um RISCO a um ITEM de trabalho: `mitigates` (o item reduz o risco), `triggers` (o item pode provocá-lo) ou `relates` (contexto). Depois disso, get_item mostra o risco e get_risk mostra o trabalho — em vez de a relação viver como menção textual na descrição. Item e risco devem ser do mesmo projeto. LIVRE.",
            inputSchema: Obj({
                risk: S.str("Id do risco"),
                item: S.str("Item (id|key)"),
                relation: S.enum(RISK_LINK_RELATIONS, "mitigates (padrão) | triggers | relates"),
                note: S.str("Por que este item e este risco se relacionam"),
                ...VIEW_FIELD_FOR("riskLink", "{ id, riskId, workItemId, relation, itemKey, riskTitle }")
            }, ["risk","item"]),
            handler: async (i) => Written("riskLink")(await store.LinkRiskItem(A({ risk: i.risk, item: i.item, relation: i.relation, note: i.note })), i.view)
        },
        {
            name: "unlink_risk_item",
            description: "Remove o vínculo entre um risco e um item. Sem `relation`, remove todos os vínculos entre os dois. LIVRE.",
            inputSchema: Obj({
                risk: S.str("Id do risco"),
                item: S.str("Item (id|key)"),
                relation: S.enum(RISK_LINK_RELATIONS, "Relação a remover (omitir = todas)")
            }, ["risk","item"]),
            handler: (i) => store.UnlinkRiskItem(A({ risk: i.risk, item: i.item, relation: i.relation }))
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
                milestoneId: S.str("Marco afetado (id|nome)"),
                item: S.str("Item de trabalho que MITIGA este risco (id|key) — cria o vínculo junto"),
                ...VIEW_FIELD_FOR("risk", "{ id, title, status, level, updatedAt }")
            }, ["project","title"]),
            handler: async (i) => {
                const risk = await store.CreateRisk(A({ project: i.project, title: i.title, description: i.description, probability: i.probability, impact: i.impact, status: i.status, category: i.category, mitigation: i.mitigation, contingency: i.contingency, ownerUserId: i.ownerUserId, milestoneId: i.milestoneId }))
                if(i.item) await store.LinkRiskItem(A({ risk: risk.id, item: i.item, relation: "mitigates" }))
                return Written("risk")(risk, i.view)
            }
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
                deliverables: S.str("Entregas (markdown)"),
                ...VIEW_FIELD_FOR("planningDoc", "{ id, title, status, version, updatedAt }")
            }, ["project","title"]),
            handler: async (i) => Written("planningDoc")(await store.CreatePlanningDoc(A({ project: i.project, title: i.title, milestoneId: i.milestoneId, status: i.status, objective: i.objective, scope: i.scope, outOfScope: i.outOfScope, stakeholders: i.stakeholders, assumptions: i.assumptions, constraints: i.constraints, successCriteria: i.successCriteria, deliverables: i.deliverables })), i.view)
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
            description: "Atualiza um projeto. Campos operacionais (icon, color, repositoryUrl, localPath) são LIVRES. GATE (bloqueia até aprovação): name, slug, shortDescription, description, status — reescrever o texto ou mudar o ciclo de vida do projeto o humano revisa antes. PROJETO EM `planning`: toda escrita é recusada (PROJECT_IN_PLANNING), EXCETO esta tool enviando SÓ `status` — é assim que se propõe tirar o projeto do planejamento (ainda sob aprovação humana). `status` junto de qualquer outro campo volta a ser recusado.",
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
            name: "close_project",
            description: "Encerra um projeto de forma COESA num passo: valida as pré-condições (trabalho concluído + relatório final) e então ARQUIVA. IDEIAS DO INBOX NÃO CONTAM como pendência (elas são registro para o futuro, não trabalho do projeto) — mas o retorno diz quantas são e quais, porque arquivar o projeto as leva junto. Use `ideasTo: \"<projeto>\"` para MOVÊ-LAS antes de arquivar, em vez de perdê-las. Se faltar algo, NÃO arquiva e retorna `CLOSE_PRECONDITION_FAILED` com o que falta. `finalReport` grava o relatório no mesmo passo; `force:true` ignora itens abertos (nunca a falta de relatório). O arquivamento passa pelo GATE: bloqueia até um humano aprovar.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                finalReport: S.str("Relatório final em markdown a gravar antes de encerrar (opcional se já houver um)"),
                force: S.bool("Encerrar mesmo com itens não concluídos (a falta de relatório final NUNCA é ignorada)"),
                ideasTo: S.str("Mover as ideias do inbox para ESTE projeto antes de arquivar (id|slug|key)"),
                ...WAIT_FIELDS
            }, ["project"]),
            handler: async (i) => {
                // 1. Se veio relatório, grava primeiro (livre, sem gate).
                if(typeof i.finalReport === "string" && i.finalReport.trim())
                    await store.SetProjectReport(A({ project: i.project, finalReport: i.finalReport }))

                // 2. IDEIAS não são trabalho pendente (MPMX3-13). Elas bloqueavam o
                // encerramento e a única saída era `force`, que as arquivava junto
                // com o projeto — material bom sumindo em silêncio. Aqui elas saem
                // da contagem e, se `ideasTo` foi informado, MUDAM DE CASA antes.
                const ideas = await store.ListItems({ project: i.project, horizon: "inbox", includeClaimed: true, limit: 500 })
                let movedIdeas
                if(i.ideasTo && ideas.length){
                    const target = await store.ResolveProject(i.ideasTo)
                    movedIdeas = []
                    for(const idea of ideas){
                        const moved = await store.MoveItemToProject(A({ item: idea.id, project: target.id })).catch(() => undefined)
                        if(moved) movedIdeas.push({ from: idea.key, to: moved.key, title: idea.title })
                    }
                }
                const remainingIdeas = movedIdeas ? [] : ideas

                // 3. Confere as pré-condições sobre o estado atual.
                const metrics = await store.ProjectMetrics({ project: i.project })
                const report = await store.GetProjectReport({ project: i.project })
                const openItems = Math.max(0, metrics.total - metrics.done - remainingIdeas.length)
                const preconditions = {
                    allItemsDone: openItems === 0,
                    totalItems: metrics.total,
                    openItems,
                    inboxIdeas: remainingIdeas.length,
                    hasFinalReport: !!(report.finalReport && String(report.finalReport).trim())
                }
                const missing = []
                if(!preconditions.allItemsDone && !i.force) missing.push(`${openItems} item(ns) não concluído(s) (use force:true para ignorar)`)
                if(!preconditions.hasFinalReport) missing.push("relatório final ausente (passe finalReport ou grave com set_project_report)")
                if(missing.length)
                    throw McpError("CLOSE_PRECONDITION_FAILED", `Não é possível encerrar o projeto: ${missing.join("; ")}.`, { preconditions })

                // 4. Arquiva sob GATE (bloqueia até a aprovação humana).
                const archived = await GatedAction({
                    actionName: "archive", type: "project", ref: i.project,
                    waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                    run: (actor) => store.ArchiveProject({ project: i.project, actor })
                })
                return {
                    closed: true, preconditions, project: archived,
                    // O QUE FOI JUNTO: dito explicitamente, para a decisão de
                    // recuperar (ou não) ser tomada com a informação na mão.
                    ...(movedIdeas ? { movedIdeas, movedIdeasTo: i.ideasTo } : {}),
                    ...(remainingIdeas.length ? {
                        archivedWithIdeas: remainingIdeas.map((idea) => ({ key: idea.key, title: idea.title })),
                        archivedWithIdeasHint: "estas ideias foram arquivadas com o projeto; use ideasTo:\"<projeto>\" na próxima vez para movê-las antes"
                    } : {})
                }
            }
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
            description: "Atualiza uma entrega/milestone (nome, resumo, descrição, data-alvo, status). LIVRE.",
            inputSchema: Obj({
                milestone: S.str("Milestone (id)"),
                name: S.str("Novo nome"),
                shortDescription: S.str("Resumo de UMA linha (<=240 chars)"),
                description: S.str("Descrição"),
                targetDate: S.str("Data alvo (ISO)"),
                status: S.enum(["planning","active","released","archived"], "Status"),
                ...VIEW_FIELD_FOR("milestone", "{ id, name, status, targetDate, updatedAt }")
            }, ["milestone"]),
            handler: async (i) => Written("milestone")(await store.UpdateMilestone(A({ milestone: i.milestone, name: i.name, shortDescription: i.shortDescription, description: i.description, targetDate: i.targetDate, status: i.status })), i.view)
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
            description: "Adiciona critério(s) de aceite (Definition of Done) ao item. LIVRE. Passe `texts` para criar vários de uma vez (ou `acceptanceCriteria` já em create_item).",
            inputSchema: Obj({
                item: S.str("Item (id|key)"),
                text: S.str("Texto do critério (um só)"),
                texts: { type: "array", items: { type: "string" }, description: "Vários critérios de uma vez — resultado por elemento, como nas demais tools de lote." },
                ...VIEW_FIELD_FOR("criteria", "{ id, workItemId, text, met }")
            }, ["item"]),
            handler: async (i) => {
                if(Array.isArray(i.texts) && i.texts.length)
                    return RunBatch(
                        i.texts,
                        (text) => store.AddAcceptanceCriteria({ item: i.item, text }),
                        (criteria) => ({ id: criteria.id, text: criteria.text })
                    )
                if(!i.text) throw McpError("VALIDATION_ERROR", "Informe `text` (um critério) ou `texts` (vários).", { field: "text" })
                return Written("criteria")(await store.AddAcceptanceCriteria({ item: i.item, text: i.text }), i.view)
            }
        },
        {
            name: "update_acceptance_criteria",
            description: "Edita/marca critério(s) de aceite. Aceita UM id, uma LISTA de ids (mesmo `met` para todos) ou `updates: [{ criteria, met }]` para valores diferentes por critério — fechar um item de 4 critérios custa 1 chamada, não 4. LIVRE.",
            inputSchema: Obj({
                criteria: { description: "Critério (id) ou lista de ids", anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
                updates: {
                    type: "array",
                    description: "Um valor por critério: [{ criteria, met, text }]",
                    items: Obj({ criteria: S.str("Critério (id)"), met: S.bool("Atendido"), text: S.str("Novo texto") }, ["criteria"])
                },
                text: S.str("Novo texto (quando `criteria` é um id só)"),
                met: S.bool("Atendido — aplicado a todos os ids informados em `criteria`")
            }),
            handler: (i) => store.UpdateAcceptanceCriteria({ criteria: i.criteria, updates: i.updates, text: i.text, met: i.met })
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
            description: "Cria um item de trabalho (epic/feature/story/task/subtask/bug/…). LIVRE (não exige aprovação), EXCETO: em projeto com status `planning` toda escrita é recusada (PROJECT_IN_PLANNING), e você não pode criar um item já `in-progress`/`done` (AGENT_ACTION_REQUIRES_HUMAN — crie em backlog/ready). Use `parent` para hierarquia: epic → feature → story/task → subtask. ESCRITA: título curto e imperativo; `shortDescription` de UMA linha (é o que o humano lê no card); descrição em markdown ORGANIZADA e RESUMIDA (seções como ## Reprodução, ## Esperado, ## Obtido). Classifique com `labels` (filtráveis) em vez de tabelas na descrição, e registre estimativa/confiança em `effort`/`confidence`. Para criar MUITOS itens, use create_items (lote). Retorna um RESUMO (use view:\"full\" para o item inteiro).",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                type: S.enum(WORK_ITEM_TYPES, "Tipo do item"),
                title: S.str("Título"),
                shortDescription: S.str("Resumo de UMA linha (<=240 chars) — é o que aparece no card e no modal de aprovação. Preencha sempre."),
                description: S.str("Descrição (markdown)"),
                parent: S.str("Item pai (id|key) para hierarquia"),
                board: S.str("Board (id) onde colocar"),
                priority: S.enum(PRIORITIES, "Prioridade"),
                status: S.str("Status inicial (statusKey)"),
                assignee: S.str("Responsável (id|handle)"),
                area: S.str("Área (ex.: GUI, Backend). Adota a grafia já usada no projeto — veja list_areas."),
                labels: { type: "array", items: { type: "string" }, description: "Rótulos livres e FILTRÁVEIS (ex.: [\"agente:senior\",\"trilha:iam\"]). Use-os em vez de tabelas dentro da descrição; veja o vocabulário do projeto em list_labels." },
                effort: S.enum(EFFORTS, "Estimativa em faixas: xs|s|m|l|xl (somável por entrega)"),
                confidence: S.enum(CONFIDENCE, "Confiança na estimativa/no entendimento: low|medium|high"),
                value: S.enum(VALUES, "Valor percebido: none|low|medium|high|critical"),
                horizon: S.enum(HORIZONS, "Horizonte de planejamento"),
                milestone: S.str("Milestone (id) a vincular"),
                sprint: S.str("Sprint (id) a vincular"),
                acceptanceCriteria: { type: "array", items: { type: "string" }, description: "Critérios de aceite (Definition of Done) criados junto — evita uma chamada add_acceptance_criteria por critério." },
                ...VIEW_FIELD_FOR("item", "{ id, key, statusKey, progress, updatedAt }")
            }, ["project","type","title"]),
            handler: (i) => CreateItemFromInput(i)
        },
        {
            name: "create_items",
            description: "Cria VÁRIOS itens numa chamada só (mesmos campos de create_item por elemento). Use ao registrar um plano inteiro: 100 itens viram 1 round-trip em vez de 100. Cada elemento é criado de forma independente e o retorno traz `{ index, ok, key | error }` por elemento — uma falha isolada NÃO invalida o lote. HIERARQUIA NO MESMO LOTE: dê um `ref` ao pai (apelido livre, ex.: \"epico-1\") e aponte `parent: \"@epico-1\"` nos filhos — assim epic → feature → story vai inteiro numa chamada, sem saber as keys de antemão. Os elementos são processados na ordem enviada.",
            inputSchema: Obj({
                items: {
                    type: "array",
                    description: "Itens a criar, na ordem em que devem ser processados",
                    items: Obj({
                        project: S.str("Projeto (id|slug|key)"),
                        type: S.enum(WORK_ITEM_TYPES, "Tipo do item"),
                        title: S.str("Título"),
                        ref: S.str("Apelido deste item DENTRO do lote (ex.: \"epico-1\"), para que os filhos o citem em parent como \"@epico-1\""),
                        shortDescription: S.str("Resumo de UMA linha (<=240 chars)"),
                        description: S.str("Descrição (markdown)"),
                        parent: S.str("Item pai: id, key, ou \"@apelido\" de um item criado antes NESTE lote"),
                        board: S.str("Board (id)"),
                        priority: S.enum(PRIORITIES, "Prioridade"),
                        status: S.str("Status inicial (statusKey)"),
                        assignee: S.str("Responsável (id|handle)"),
                        area: S.str("Área"),
                        labels: { type: "array", items: { type: "string" }, description: "Rótulos" },
                        effort: S.enum(EFFORTS, "Estimativa (xs|s|m|l|xl)"),
                        confidence: S.enum(CONFIDENCE, "Confiança (low|medium|high)"),
                        value: S.enum(VALUES, "Valor"),
                        horizon: S.enum(HORIZONS, "Horizonte"),
                        milestone: S.str("Milestone (id)"),
                        sprint: S.str("Sprint (id)"),
                        acceptanceCriteria: { type: "array", items: { type: "string" }, description: "Critérios de aceite" }
                    }, ["project","type","title"])
                },
                project: S.str("Projeto padrão dos elementos que não informarem `project`")
            }, ["items"]),
            handler: async (i) => {
                // Apelidos do lote: o agente não conhece as keys antes de criar, então
                // a hierarquia se declara por "@apelido" e é resolvida aqui, na ordem.
                const byRef = {}
                const out = await RunBatch(
                    i.items,
                    async (entry) => {
                        const parent = typeof entry.parent === "string" && entry.parent.startsWith("@")
                            ? byRef[entry.parent.slice(1)]
                            : entry.parent
                        if(typeof entry.parent === "string" && entry.parent.startsWith("@") && !parent)
                            throw McpError("VALIDATION_ERROR", `Apelido "${entry.parent}" não foi criado antes neste lote.`, { field: "parent", ref: entry.parent })
                        const created = await CreateItemFromInput({ ...entry, parent, project: entry.project || i.project })
                        if(entry.ref) byRef[entry.ref] = created.key
                        return created
                    },
                    (created) => ({ key: created.key, id: created.id })
                )
                return out
            }
        },
        {
            name: "add_to_inbox",
            description: "Registra uma ideia crua no inbox do projeto (horizon=inbox, clarity=idea) para triagem posterior. LIVRE. Preencha os campos de TRIAGEM (`value`, `effort`, `confidence`, `milestone` como fase provável, `labels`): são eles que sustentam a decisão de promover ou descartar, viajam para o item em convert_idea e permitem ordenar o inbox por `sort:\"triage\"` em list_items. Não os escreva como bloco markdown na descrição — assim não filtram nem ordenam.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                title: S.str("Ideia / título"),
                shortDescription: S.str("Resumo de UMA linha (<=240 chars)"),
                description: S.str("Detalhes (markdown): hipótese, dependências, relação com o roadmap"),
                type: S.enum(WORK_ITEM_TYPES, "Tipo (padrão: task)"),
                area: S.str("Área"),
                labels: { type: "array", items: { type: "string" }, description: "Rótulos" },
                value: S.enum(VALUES, "Valor percebido: none|low|medium|high|critical"),
                effort: S.enum(EFFORTS, "Esforço percebido: xs|s|m|l|xl"),
                confidence: S.enum(CONFIDENCE, "Confiança na avaliação: low|medium|high"),
                milestone: S.str("Fase/entrega provável (milestone id), se já dá para dizer"),
                ideaOrigin: S.str("Origem da ideia"),
                ...VIEW_FIELD_FOR("item", "{ id, key, statusKey, progress, updatedAt }")
            }, ["project","title"]),
            handler: (i) => CreateItemFromInput({
                ...i, type: i.type || "task", horizon: "inbox", clarityState: "idea"
            })
        },
        {
            name: "list_items",
            description: "Lista itens do projeto com filtros (status, tipo, responsável, prioridade, milestone, sprint, horizon, label, área, esforço, confiança, texto…). Retorno ENXUTO (sem a descrição longa) e PAGINADO: `{ items, total, limit, offset, hasMore }` — MESMO contrato do search_items. Peça campos específicos com `fields`; `sort:\"triage\"` ordena por valor e esforço (leitura de inbox/backlog). FILA LIMPA: item com reivindicação VIVA de outra sessão NÃO vem (é o que `claim_item` promete); passe `includeClaimed: true` para ver o quadro completo — aí cada item tomado traz `claim`.",
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
                release: S.str("Só os itens deste release/tag (ex.: v0.0.29)"),
                horizon: S.enum(HORIZONS, "Horizonte"),
                label: S.str("Só os itens com ESTE rótulo (valor exato — veja list_labels)"),
                area: S.str("Área (valor exato — veja list_areas)"),
                effort: S.enum(EFFORTS, "Estimativa (xs|s|m|l|xl)"),
                confidence: S.enum(CONFIDENCE, "Confiança (low|medium|high)"),
                value: S.enum(VALUES, "Valor"),
                text: S.str("Busca textual"),
                sort: S.enum(["order","created","priority","value","effort","triage"], "Ordenação (padrão: order). triage = mais valor e menos esforço primeiro."),
                includeClaimed: S.bool("Mostrar também os itens reivindicados por outra sessão (padrão: false — item tomado sai da fila)"),
                ...FIELDS_FIELD
            }, ["project"]),
            handler: async (i) => {
                const limit = Number(i.limit) > 0 ? Number(i.limit) : 100
                const offset = Number(i.offset) > 0 ? Number(i.offset) : 0
                const filters = {
                    project: i.project, type: i.type, status: i.status, parent: i.parent, board: i.board,
                    assignee: i.assignee, priority: i.priority, milestone: i.milestone, sprint: i.sprint,
                    horizon: i.horizon, text: i.text, package: i.package, release: i.release,
                    label: i.label, area: i.area, effort: i.effort, confidence: i.confidence, value: i.value,
                    includeClaimed: i.includeClaimed, actor
                }
                const [rows, total] = await Promise.all([
                    store.ListItems({ ...filters, limit, offset, sort: i.sort }),
                    store.CountItems(filters)
                ])
                return ListEnvelope({ rows, total, limit, offset, fields: i.fields, defaultFields: ITEM_LIST_FIELDS })
            }
        },
        {
            name: "get_item",
            description: "Detalha um item: descrição, critérios de aceite, checklist, links (navegáveis, com a key e o projeto da outra ponta), subtarefas. Traz também pendingFeedbackCount (feedback aberto do item). Leia ANTES de agir numa tarefa.",
            inputSchema: Obj({ item: S.str("Item (id|key, ex.: MPM-42)") }, ["item"]),
            handler: async (i) => {
                const data = await store.GetItem({ item: i.item })
                return { ...data, pendingFeedbackCount: await PendingFeedbackForItem(data.id) }
            }
        },
        {
            name: "update_item",
            description: "Atualiza campos de um item. Use ao receber FEEDBACK do humano (via `list_comments`, comentários que começam com \"Feedback para o agente\"): reescreva o TÍTULO e/ou a DESCRIÇÃO conforme pedido, de forma curta, assertiva e organizada, e depois comente o que mudou. Ao ENTREGAR o item, registre o release em releaseTag/releaseUrl (ex.: v0.0.29). Retorna um RESUMO + pendingFeedbackCount (use view:\"full\" para o item inteiro).",
            inputSchema: Obj({
                item: S.str("Item (id|key)"),
                title: S.str("Título"),
                shortDescription: S.str("Resumo de UMA linha (<=240 chars) — o que o humano lê no card"),
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
                releaseTag: S.str("Release/tag que entregou o item (ex.: v0.0.29)"),
                releaseUrl: S.str("URL do release/tag"),
                horizon: S.enum(HORIZONS, "Horizonte"),
                area: S.str("Área (adota a grafia já usada no projeto — veja list_areas)"),
                labels: { type: "array", items: { type: "string" }, description: "Rótulos filtráveis — SUBSTITUI a lista atual (mande a lista completa que deve ficar)." },
                effort: S.enum(EFFORTS, "Estimativa em faixas (xs|s|m|l|xl)"),
                confidence: S.enum(CONFIDENCE, "Confiança na estimativa (low|medium|high)"),
                value: S.enum(VALUES, "Valor percebido"),
                typeFields: { type: "object", additionalProperties: true, description: "Campos específicos do tipo (bug: severity/regression/expected/actual/repro; story: persona/need/benefit; decision/research/tech-debt…). Merge no servidor: manda só o que muda." },
                ...VIEW_FIELD
            }, ["item"]),
            handler: async (i) => ItemMutationResult(await store.UpdateItem(A({ item: i.item, title: i.title, shortDescription: i.shortDescription, description: i.description, statusKey: i.status, priority: i.priority, progress: i.progress, dueDate: i.dueDate, assignee: i.assignee, repositoryUrl: i.repositoryUrl, branchName: i.branchName, commitHash: i.commitHash, pullRequestUrl: i.pullRequestUrl, releaseTag: i.releaseTag, releaseUrl: i.releaseUrl, horizon: i.horizon, area: i.area, labels: i.labels, effort: i.effort, confidence: i.confidence, value: i.value, typeFields: i.typeFields })), i.view)
        },
        {
            name: "set_item_status",
            description: "Muda o status de um item (ex.: backlog → ready → in-progress → review → done). A maioria das transições é LIVRE, MAS iniciar (mover para in-progress) e concluir (mover para done/completed ou coluna de conclusão) EXIGEM aprovação humana: a chamada BLOQUEIA até o humano decidir e então retorna o item já no novo status; rejeição vira REJECTED_BY_HUMAN. Nunca comece nem dê uma tarefa por concluída sem solicitação explícita do usuário. Ao CONCLUIR, o retorno traz `unmetAcceptanceCriteria` — os critérios que ainda não foram marcados: LEIA antes de dar o item por pronto, é a definição de pronto que você mesmo escreveu. Vários itens de uma vez: `set_items_status` (uma aprovação só). Use waitApproval:false para receber o approvalRequestId sem esperar. Retorna um RESUMO + pendingFeedbackCount (use view:\"full\" para o item inteiro).",
            inputSchema: Obj({
                item: S.str("Item (id|key)"),
                status: S.str("Novo status (statusKey)"),
                ...VIEW_FIELD,
                ...WAIT_FIELDS
            }, ["item","status"]),
            // Iniciar/concluir é gated como criar/remover — e agora ESPERA como elas.
            // Antes, esta tool chamava o store direto: o pedido nascia pendente e o erro
            // subia na hora, contrariando a própria descrição e deixando pedidos órfãos
            // que ninguém aguardava. Transições livres não tocam o gate e passam direto.
            handler: async (i) => {
                const result = await GatedAction({
                    actionName: "set-status", type: "work-item", ref: `${i.item}:${i.status}`,
                    waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                    run: (actor) => store.SetStatus({ item: i.item, status: i.status, actor })
                })
                // Com waitApproval:false o retorno é o PEDIDO, não o item — resumi-lo
                // como item devolveria um objeto vazio.
                if(result && result.status === "pending_approval") return result
                return ItemMutationResult(result, i.view)
            }
        },
        {
            name: "set_items_status",
            description: "Muda o status de VÁRIOS itens com UMA aprovação humana. Use quando o humano já autorizou o conjunto (\"pode concluir todos esses\"): em vez de N diálogos idênticos — 74 itens geraram ~150 —, o humano vê UMA vez a lista completa (com os critérios de aceite ainda em aberto de cada item) e decide. Transições livres (ex.: → review) aplicam direto, sem pedido. Rejeitar não muda nada. Não é autorização guarda-chuva: vale só para este pedido.",
            inputSchema: Obj({
                items: { type: "array", items: { type: "string" }, description: "Itens (id|key)" },
                status: S.str("Novo status (statusKey) para todos"),
                ...WAIT_FIELDS
            }, ["items", "status"]),
            handler: (i) => GatedAction({
                actionName: "set-status-batch", type: "work-item", ref: `${i.items.join(",")}:${i.status}`,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.SetStatusBatch({ items: i.items, status: i.status, actor })
            })
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
            description: "Cria um vínculo entre itens, INCLUSIVE de projetos diferentes (ex.: MPTL-20 depends VDRP-39): `item` e `target` são resolvidos por key/id em todo o workspace. Relações aceitas (exatas): blocks, depends, relates, duplicates, implements, tests, originated_from. Direção: `item` --relação--> `target` (relation=depends significa que `item` DEPENDE de `target`; blocks = `item` BLOQUEIA `target`). Veja as duas pontas resolvidas (key + projeto + crossProject) em get_item.",
            inputSchema: Obj({
                item: S.str("Item origem (id|key)"),
                relation: S.enum(LINK_RELATIONS, "Relação (valor exato)"),
                target: S.str("Item alvo (id|key)"),
                ...VIEW_FIELD_FOR("link", "{ id, sourceItemId, relation, targetItemId }")
            }, ["item","relation","target"]),
            handler: async (i) => Written("link")(await store.LinkItem(A({ item: i.item, relation: i.relation, target: i.target })), i.view)
        },
        {
            name: "link_items",
            description: "Cria VÁRIOS vínculos numa chamada só. Mesma semântica de link_item por elemento (inclusive entre projetos), com resultado independente por vínculo: `{ index, ok, error? }`. Use ao registrar as dependências de um plano inteiro — dezenas de vínculos em 1 round-trip.",
            inputSchema: Obj({
                links: {
                    type: "array",
                    description: "Vínculos a criar",
                    items: Obj({
                        item: S.str("Item origem (id|key)"),
                        relation: S.enum(LINK_RELATIONS, "Relação (valor exato)"),
                        target: S.str("Item alvo (id|key)")
                    }, ["item","relation","target"])
                }
            }, ["links"]),
            handler: (i) => RunBatch(
                i.links,
                (entry) => store.LinkItem(A({ item: entry.item, relation: entry.relation, target: entry.target })),
                (link) => ({ id: link.id, relation: link.relation })
            )
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
            description: "Lista os projetos. Retorno ENXUTO por padrão: identidade, status, keyPrefix e caminho — SEM a descrição longa e SEM o relatório final (que sozinhos passavam de 5 mil caracteres por projeto). Use `fields` para pedir campos específicos, `view:\"full\"` para o registro inteiro e get_project/get_project_report quando precisar de UM texto completo.",
            inputSchema: Obj({
                status: S.str("Filtrar por status"),
                includeArchived: S.bool("Incluir arquivados"),
                ...FIELDS_FIELD,
                ...VIEW_FIELD_FOR("project", "identidade, status, keyPrefix e caminho (sem description/finalReport)")
            }),
            handler: async (i) => {
                const limit = Number(i.limit) > 0 ? Number(i.limit) : 100
                const offset = Number(i.offset) > 0 ? Number(i.offset) : 0
                const rows = await store.ListProjects({ status: i.status, includeArchived: i.includeArchived })
                const page = rows.slice(offset, offset + limit)
                // view:"full" = registro inteiro (inclusive os textos longos).
                if(i.view === "full")
                    return { items: page, total: rows.length, limit, offset, returned: page.length, hasMore: offset + page.length < rows.length }
                return ListEnvelope({
                    rows: page, total: rows.length, limit, offset, fields: i.fields,
                    defaultFields: PROJECT_LIST_FIELDS
                })
            }
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
            description: "Roadmap do projeto por horizonte (inbox/now/next/later/maybe/archived/unassigned) — visão de planejamento. Retorno ENXUTO e PAGINADO POR HORIZONTE: cada balde vira `{ items, total, limit, offset, hasMore }` com o MESMO resumo de list_items (sem a descrição longa). `horizon` traz um balde só; `fields` projeta; `limit`/`offset` valem por balde. Um projeto de 87 itens devolvia 84 mil caracteres e era cortado — peça um horizonte por vez para ler o plano inteiro.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                horizon: S.enum([...HORIZONS, "unassigned"], "Só este horizonte (omitido = todos, cada um paginado)"),
                ...FIELDS_FIELD
            }, ["project"]),
            handler: async (i) => {
                const limit = Number(i.limit) > 0 ? Number(i.limit) : 25
                const offset = Number(i.offset) > 0 ? Number(i.offset) : 0
                const buckets = await store.RoadmapByHorizon({ project: i.project })
                const wanted = i.horizon ? [i.horizon] : Object.keys(buckets)
                const out = {}
                for(const name of wanted){
                    const rows = buckets[name] || []
                    out[name] = ListEnvelope({
                        rows: rows.slice(offset, offset + limit),
                        total: rows.length, limit, offset, fields: i.fields,
                        defaultFields: ITEM_LIST_FIELDS
                    })
                }
                // O totalizador evita uma segunda chamada só para saber onde está o volume.
                return { horizons: out, totals: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])) }
            }
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
            description: "Busca itens por texto (título ou key, ex.: \"MPMX-2\") em TODOS os projetos (ou num só, se `project` for informado). USE ANTES de criar: para decidir se já existe algo equivalente (então ATUALIZE em vez de duplicar) e para achar itens relacionados entre projetos. Retorno ENXUTO por padrão (sem a descrição longa) e PAGINADO: `{ items, total, limit, offset }`. Peça campos específicos com `fields` e página com `limit`/`offset` — não baixe corpos enormes só para conferir se algo existe.",
            inputSchema: Obj({
                text: S.str("Termo a buscar no título ou na key"),
                project: S.str("Restringe a um projeto (id|slug|key); omita para buscar em todos"),
                type: S.enum(WORK_ITEM_TYPES, "Filtrar por tipo"),
                status: S.str("Filtrar por status (statusKey)"),
                assignee: S.str("Responsável (id|handle)"),
                area: S.str("Área"),
                label: S.str("Só os itens com ESTE rótulo (valor exato — veja list_labels)"),
                effort: S.enum(EFFORTS, "Estimativa (xs|s|m|l|xl)"),
                confidence: S.enum(CONFIDENCE, "Confiança (low|medium|high)"),
                release: S.str("Filtrar pelo release/tag do item (ex.: v0.0.29)"),
                includeClaimed: S.bool("Incluir itens reivindicados por outra sessão (padrão: false)"),
                fields: { type: "array", items: { type: "string" }, description: "Projeção: SÓ estes campos por item (ex.: [\"key\",\"title\",\"statusKey\"]). Omitido = resumo padrão (sem a descrição)." },
                limit: S.num("Máx. de itens por página (padrão 50)"),
                offset: S.num("Deslocamento para paginar (padrão 0)")
            }, ["text"]),
            handler: async (i) => {
                const limit = Number(i.limit) > 0 ? Number(i.limit) : 50
                const offset = Number(i.offset) > 0 ? Number(i.offset) : 0
                const filters = { text: i.text, project: i.project, type: i.type, status: i.status, assignee: i.assignee, area: i.area, label: i.label, effort: i.effort, confidence: i.confidence, release: i.release, includeClaimed: i.includeClaimed, actor }
                const [rows, total] = await Promise.all([
                    store.ListItems({ ...filters, limit, offset, sort: "created" }),
                    store.CountItems(filters)
                ])
                // Resumo por padrão: a descrição longa é o que estourava o contexto.
                // Mesma projeção do list_items + projectId (a busca cruza projetos).
                return ListEnvelope({
                    rows, total, limit, offset, fields: i.fields,
                    defaultFields: ["projectId", ...ITEM_LIST_FIELDS]
                })
            }
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
        {
            name: "report_ready",
            description: "O que está PRONTO PARA COMEÇAR: itens em backlog/ready, sem bloqueio, com todas as dependências (`depends`/`blocks`) já concluídas e cuja entrega não está travada por outra. É o inverso de report_blocked — responde \"o que posso pegar agora?\" sem reconstruir o grafo de vínculos à mão. Ordenado por quantos itens cada um DESTRAVA (`unblocks`) e depois por prioridade: pegue primeiro o que libera mais trabalho.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                limit: S.num("Máx. de itens (padrão: todos)"),
                fields: { type: "array", items: { type: "string" }, description: "Projeção: SÓ estes campos por item. Omitido = resumo padrão + unblocks/unblocksKeys." }
            }, ["project"]),
            handler: async (i) => {
                const rows = await store.Ready({ project: i.project, limit: i.limit })
                const DEFAULT_FIELDS = [...ITEM_LIST_FIELDS, "unblocks", "unblocksKeys"]
                const fields = Array.isArray(i.fields) && i.fields.length ? i.fields : DEFAULT_FIELDS
                return { items: rows.map((row) => Pick(row, fields)), total: rows.length }
            }
        },
        {
            name: "list_labels",
            description: "Vocabulário de RÓTULOS realmente em uso no projeto, com a contagem de cada um. Consulte ANTES de rotular: reusar o rótulo existente é o que mantém o filtro (`list_items label=…`) íntegro — um rótulo novo com grafia diferente cria uma trilha paralela que ninguém encontra.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ListProjectLabels({ project: i.project })
        },
        {
            name: "list_areas",
            description: "Vocabulário de ÁREAS em uso no projeto, com a contagem de cada uma. `area` é texto livre: ao escrever, o servidor ADOTA a grafia já usada quando o valor difere só por caixa/acento/separador (\"Rede\" e \"rede\" não viram duas trilhas). `variants` mostra as grafias divergentes que sobraram de antes dessa normalização.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.ListProjectAreas({ project: i.project })
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
            name: "ecosystem_index_status",
            description: "Estado do catálogo de pacotes, sem escrever nada: se está construído (`indexed`), quantos pacotes, quando foi a última indexação, a distribuição por repositório e tipo, e quais repositórios DECLARADOS ainda não foram indexados (`notIndexedRepositories`). Chame ANTES de vincular itens a pacotes — e antes de decidir se vale rodar index_ecosystem_packages.",
            inputSchema: Obj({}),
            handler: () => store.EcosystemIndexStatus()
        },
        {
            name: "index_ecosystem_packages",
            description: "Relê os repositórios do disco e atualiza o catálogo de pacotes. IDEMPOTENTE e seguro de repetir: reindexar não apaga nem renomeia nada — pacotes existentes são atualizados no lugar, e os que sumiram do disco só ficam MARCADOS como ausentes (os vínculos item↔pacote continuam válidos). O custo é varrer os diretórios dos repositórios declarados (segundos). Consulte ecosystem_index_status antes, para saber se é necessário.",
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
            description: "Contexto consolidado de um escopo: anotações humanas recentes + auditoria recente. É a leitura CARA da investigação — prefira `project_pulse` e `who_is_here` para se situar, e venha aqui quando precisar do TEXTO das notas humanas. Vem enxuto por padrão (corpo das notas recortado, diffs da auditoria fora); `fullText:true` traz tudo, ao custo de contexto.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"), board: S.str("Board (id)"),
                sprint: S.str("Sprint (id)"), milestone: S.str("Milestone (id)"),
                item: S.str("Item (id|key)"), limit: S.num("Máx. por seção"),
                fullText: S.bool("Trazer o corpo INTEIRO das notas e os diffs da auditoria (padrão false — a resposta enxuta cabe no contexto)"),
                noteBodyChars: S.num("Tamanho do recorte do corpo de cada nota (padrão 400)")
            }),
            handler: (i) => store.GetActivityContext({ project: i.project, board: i.board, sprint: i.sprint, milestone: i.milestone, item: i.item, limit: i.limit, fullText: i.fullText, noteBodyChars: i.noteBodyChars, actor })
        },

        // ───────────── Orientação (para clientes que ignoram `instructions`) ─────────────
        {
            name: "get_guidance",
            description: "Regras de operação deste gerenciador: o que é livre, o que exige aprovação humana, como escrever título/descrição, relações de vínculo válidas, códigos de erro e o fluxo recomendado. Chame UMA VEZ no início da sessão se você não recebeu as instruções do servidor.",
            inputSchema: Obj({}),
            handler: async () => ({
                instructions: INSTRUCTIONS,
                // Políticas de trabalho que TODO agente segue (não só as regras de API).
                // Parte já é imposta por gate (iniciar/concluir tarefa); as demais são
                // disciplina que o agente carrega sem instrução externa.
                workflowPolicies: [
                    "Ao entrar num projeto, pergunte quem mais está ativo (who_is_here) ANTES de escolher trabalho.",
                    "Pegue trabalho reivindicando (next_task, ou report_ready + claim_item) e relate a cada virada de etapa (report_progress é o heartbeat).",
                    "Em checkout compartilhado, `git add` por caminho explícito — nunca -A: o commit sai com arquivo de outra sessão dentro.",
                    "Mexeu em ambiente compartilhado (subir/derrubar serviço, reprovisionar), registre com record_environment_action.",
                    "Encostou no trabalho de outra sessão, avise ela (send_agent_message) — mural não notifica ninguém.",
                    "Ao terminar, release_item e end_session: sem isso seus itens ficam fora da fila dos outros até expirar.",
                    "Nunca mova um item para done/completed sem aprovação humana explícita — deixe em review e proponha (imposto por gate no set_item_status).",
                    "Nunca dê algo por entregue nem registre commit/PR/release sem autorização explícita do humano.",
                    "Higiene de board antes de trabalhar: o item deve estar num board, com planejamento (milestone/sprint) e movido para in-progress (iniciar exige aprovação humana).",
                    "Verifique o RESULTADO ao final (reconsulte/valide), não presuma sucesso.",
                    "Cheque list_feedback do projeto ANTES, DURANTE e ao FINALIZAR — não encerre com feedback aberto."
                ],
                constraints: (() => {
                    // O gate é DERIVADO da mesma política que o store consulta ao decidir
                    // se bloqueia (store.AgentGatePolicy → Config.AGENT_GATE_POLICY). Uma
                    // lista escrita à mão aqui já anunciou gate em milestone/sprint que o
                    // código nunca aplicou, e o agente planejava esperas que não existiam.
                    const policy = store.AgentGatePolicy()
                    return {
                        linkRelations: LINK_RELATIONS,
                        riskLinkRelations: RISK_LINK_RELATIONS,
                        milestoneLinkRelations: MILESTONE_LINK_RELATIONS,
                        crossProjectLinks: true,
                        keyPrefixMaxChars: 5,
                        shortDescriptionMaxChars: 240,
                        shortDescriptionOn: ["project", "board", "item", "milestone", "sprint"],
                        efforts: EFFORTS,
                        confidence: CONFIDENCE,
                        values: VALUES,
                        linkAttachmentSchemes: ["http", "https", "file"],
                        // Chave = ação; valor = tipos de alvo gated. O que NÃO está aqui é
                        // livre — inclusive criar milestone e sprint.
                        gatedActions: {
                            ...policy.actions,
                            statusStart: policy.statuses.start,
                            statusDone: [...policy.statuses.done, ...(policy.statuses.doneByColumn ? ["coluna isDoneColumn"] : [])]
                        },
                        humanOnly: policy.humanOnly,
                        globalActivityPermission: "activity:read:all_projects"
                    }
                })(),
                session: {
                    provider: actor && actor.session && actor.session.provider,
                    model: actor && actor.session && actor.session.model,
                    traceId: actor && actor.session && actor.session.traceId
                }
            })
        },
        {
            name: "project_sequence",
            description: "A SEQUÊNCIA do trabalho, sem calendário: para cada item, o estado (feito | fazendo | pronto | esperando | bloqueado), DE QUEM ele espera (`waitingFor`) e o que ele destrava (`unblocks`). Substitui a leitura por data — trabalho de vários agentes em paralelo não se descreve por prazo, e sim por ordem e dependência. Use para escolher o que atacar e para explicar por que algo não pode começar ainda.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)") }, ["project"]),
            handler: (i) => store.SequenceView({ project: i.project })
        },
        {
            name: "project_pulse",
            description: "O QUE ACABOU DE ACONTECER no projeto: mudanças de status, criações, bloqueios, reivindicações e o progresso que os agentes reportaram — em ordem, do mais recente para o mais antigo. LEIA ANTES de escolher trabalho: vários agentes atuam aqui ao mesmo tempo, e pegar item sem saber o que os outros estão fazendo gera trabalho jogado fora. Enxuto de propósito (ruído de campo alterado fica fora).",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)"), limit: S.num("Máx. de eventos (padrão 30)") }, ["project"]),
            handler: (i) => store.ProjectPulse({ project: i.project, limit: i.limit })
        },
        {
            name: "report_progress",
            description: "CONTE O QUE VOCÊ ESTÁ FAZENDO, enquanto faz. Obrigatório: ao COMEÇAR num item, ao VIRAR DE ETAPA (investiguei → implementando → verificando) e ao TERMINAR. Por que importa: vários agentes trabalham neste projeto ao mesmo tempo; a auditoria registra o FATO (mudou status), nunca a intenção — sem o seu relato, o humano e os outros agentes não sabem o que está sendo tentado agora e atropelam o seu trabalho. Uma linha basta, direta (\"lendo o ReportsStore para achar onde a fila é montada\"). Também RENOVA sua reivindicação do item — reportar é o heartbeat. LIVRE.",
            inputSchema: Obj({
                item: S.str("Item (id|key) em que você está trabalhando"),
                project: S.str("Projeto (id|slug|key) — use quando o trabalho ainda não é de um item específico"),
                note: S.str("O que você está fazendo agora, em uma linha"),
                phase: S.str("Etapa curta: investigando | implementando | verificando | bloqueado | concluindo")
            }, ["note"]),
            handler: (i) => store.ReportProgress(A({ item: i.item, project: i.project, note: i.note, phase: i.phase }))
        },
        {
            name: "claim_item",
            description: "REIVINDICA um item antes de trabalhar nele: enquanto sua reivindicação vive, os outros agentes veem que ele está tomado e ele SAI da fila deles (list_items/search_items/report_ready deixam de oferecê-lo). Faça isto ANTES de começar (e antes de pedir para iniciar a tarefa). A reivindicação tem validade e é renovada por `report_progress` — se sua sessão morrer, ela expira sozinha e o item volta à fila. Item já reivindicado por outra sessão responde `ITEM_CLAIMED`: pegue outro. Declare em `packages` os pacotes que você vai TOCAR: a resposta avisa (`warnings`) se outra sessão já está com um deles — a colisão real entre agentes é de ARQUIVO, não de card. LIVRE.",
            inputSchema: Obj({
                item: S.str("Item (id|key)"),
                minutes: S.num("Validade em minutos (padrão 45)"),
                packages: { type: "array", items: { type: "string" }, description: "Pacotes que você vai tocar (ref|namespace|nome) — vira aviso de colisão para as outras sessões" }
            }, ["item"]),
            handler: (i) => store.ClaimItem(A({ item: i.item, minutes: i.minutes, packages: i.packages }))
        },
        {
            name: "next_task",
            description: "PEGUE a próxima tarefa da fila: escolhe o item mais desimpedido (mesma regra do `report_ready`) e JÁ REIVINDICA para você, numa chamada. Use isto em vez de ler a fila e reivindicar depois — entre as duas chamadas cabe outro agente pegando o mesmo item. Devolve o item completo, a validade da reivindicação, quem mais está por aqui (`alsoHere`) e avisos de pacote em disputa. Fila vazia ou toda tomada → `item` ausente e uma mensagem dizendo qual dos dois. Iniciar a tarefa (in-progress) continua exigindo aprovação humana. LIVRE.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                minutes: S.num("Validade da reivindicação em minutos (padrão 45)"),
                area: S.str("Só tarefas desta área"),
                label: S.str("Só tarefas com este rótulo"),
                type: S.enum(WORK_ITEM_TYPES, "Só tarefas deste tipo")
            }, ["project"]),
            handler: (i) => store.NextTask(A({ project: i.project, minutes: i.minutes, area: i.area, label: i.label, type: i.type }))
        },
        {
            name: "who_is_here",
            description: "QUEM MAIS ESTÁ TRABALHANDO AQUI AGORA. Primeira pergunta ao entrar num projeto: devolve, numa chamada, as sessões vivas — provedor/modelo, objetivo, foco atual, presença (here|idle), os ITENS que cada uma reivindicou, os PACOTES em jogo e o último progresso relatado. É a leitura que evita descobrir a companhia colidindo com ela. LIVRE.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key) — restringe a quem tem trabalho aqui"),
                includeGone: S.bool("Incluir também as sessões que já saíram (padrão: false)")
            }),
            handler: (i) => store.WhoIsHere(A({ project: i.project, includeGone: i.includeGone }))
        },
        {
            name: "send_agent_message",
            description: "Manda um recado DIRIGIDO a outra sessão de agente — ela o recebe na próxima resposta dela (em `_notices`), sem precisar consultar nada. Use quando a informação é urgente e específica: \"varri um arquivo teu para o meu commit\", \"subi o orquestrador, não derrube\", \"estou neste pacote, espere antes de reprovisionar\". Endereço: `toSession` (id, veja `who_is_here`) ou `item` (fala com quem reivindicou aquele item). Não é mural: nota de projeto é para contexto, isto é para quem PRECISA saber agora.",
            inputSchema: Obj({
                toSession: S.str("Sessão alvo (id) — veja who_is_here"),
                item: S.str("Ou o item (id|key): fala com a sessão que o reivindicou"),
                project: S.str("Projeto de contexto (id|slug|key)"),
                body: S.str("O recado, direto e curto")
            }, ["body"]),
            handler: (i) => store.SendSessionMessage(A({ toSession: i.toSession, item: i.item, project: i.project, body: i.body }))
        },
        {
            name: "agent_inbox",
            description: "Seus avisos entre sessões (quem entrou, quem saiu, recados dirigidos a você, mexidas em ambiente compartilhado). Normalmente você NÃO precisa chamar: os avisos novos já viajam em `_notices` nas respostas das outras tools. Use para reler o histórico ou conferir o que chegou enquanto você não estava escrevendo. LIVRE.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                kind: S.enum(["joined", "left", "message", "environment", "item-touched"], "Só avisos deste tipo"),
                unreadOnly: S.bool("Só os ainda não lidos"),
                limit: S.num("Máx. de avisos (padrão 30)")
            }),
            handler: async (i) => {
                const session = await store.FindSessionByIdentity((actor && actor.session) || {}).catch(() => undefined)
                return store.ListNotices({ session: session && session.id, project: i.project, kind: i.kind, unreadOnly: i.unreadOnly, limit: i.limit })
            }
        },
        {
            name: "update_session_focus",
            description: "Atualiza O QUE VOCÊ ESTÁ FAZENDO nesta sessão (`currentFocus`) e/ou o objetivo dela. Provedor e modelo NÃO mudam depois da liberação (identidade auditada), mas intenção muda o tempo todo: numa sessão você troca de foco várias vezes, e um objetivo congelado na entrada mostra você trabalhando em algo que abandonou horas atrás. `report_progress` já atualiza o foco sozinho — use esta tool quando o OBJETIVO da sessão mudou. LIVRE.",
            inputSchema: Obj({
                objective: S.str("O que você veio fazer (novo objetivo da sessão)"),
                currentFocus: S.str("O que você está fazendo agora, em uma linha"),
                sessionName: S.str("Nome curto da sessão na interface")
            }),
            handler: (i) => store.UpdateSessionFocus(A({ objective: i.objective, currentFocus: i.currentFocus, sessionName: i.sessionName }))
        },
        {
            name: "record_environment_action",
            description: "REGISTRA que você mexeu em recurso COMPARTILHADO: subiu/derrubou/reiniciou um serviço, reprovisionou um pacote, ocupou uma porta. Vira histórico consultável (`list_environment_actions`) E aviso entregue às outras sessões. Por que importa: o conflito entre agentes não é só de item e de arquivo — se outra sessão derruba o processo que você subiu no meio do seu ciclo, o trabalho quebra sem explicação. LIVRE.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                action: S.enum(["up", "down", "restart", "provision", "build", "other"], "O que você fez"),
                target: S.str("Sobre o quê: serviço, processo, porta, pacote"),
                note: S.str("Detalhe curto (por que, até quando, o que não derrubar)")
            }, ["action", "target"]),
            handler: (i) => store.RecordEnvironmentAction(A({ project: i.project, action: i.action, target: i.target, note: i.note }))
        },
        {
            name: "list_environment_actions",
            description: "O que subiu, caiu ou foi reprovisionado no ambiente compartilhado, e por quem. Leia antes de derrubar/reiniciar qualquer coisa: pode haver outra sessão dependendo daquele processo. LIVRE.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                limit: S.num("Máx. de registros (padrão 30)")
            }),
            handler: (i) => store.ListEnvironmentActions(A({ project: i.project, limit: i.limit }))
        },
        {
            name: "end_session",
            description: "ENCERRA sua sessão: libera na hora todos os itens que você reivindicou e avisa as outras sessões de que você saiu. Chame ao terminar o trabalho — sem isto sua saída só é notada por tempo (uma hora sem sinal), e até lá os seus itens ficam fora da fila dos outros sem ninguém trabalhando neles. Depois disto você não escreve mais nesta sessão.",
            inputSchema: Obj({ note: S.str("Recado de saída (o que ficou pendente, o que não derrubar)") }),
            handler: (i) => store.EndSession(A({ note: i.note }))
        },
        {
            name: "release_item",
            description: "Libera o item que você reivindicou — faça ao terminar, ao desistir ou ao trocar de tarefa. Devolve o item à fila dos outros agentes na hora, em vez de esperar a validade expirar. LIVRE.",
            inputSchema: Obj({ item: S.str("Item (id|key)") }, ["item"]),
            handler: (i) => store.ReleaseItem(A({ item: i.item }))
        },
        {
            name: "complete_epic",
            description: "Conclui um ÉPICO e todos os itens que pendem dele numa AUTORIZAÇÃO SÓ. Use quando o épico terminou: em vez de N pedidos de `set_item_status` (um por filho), o humano vê UMA vez a lista do que será concluído junto — inclusive os filhos ainda abertos — e decide. GATE: bloqueia até a decisão; rejeitar não conclui nada. Não é autorização guarda-chuva: vale só para este pedido.",
            inputSchema: Obj({
                epic: S.str("Épico (id|key)"),
                status: S.str("Status de conclusão (padrão: done)"),
                ...WAIT_FIELDS
            }, ["epic"]),
            handler: (i) => GatedAction({
                actionName: "complete-epic", type: "work-item", ref: i.epic,
                waitApproval: i.waitApproval, approvalTimeoutSeconds: i.approvalTimeoutSeconds,
                run: (actor) => store.CompleteEpic({ item: i.epic, status: i.status || "done", actor })
            })
        },
        {
            name: "declare_session",
            description: "DECLARA quem você é: provedor e modelo REAIS desta sessão (ex.: provider \"claude\", model \"claude-opus-5\"). Chame ANTES de qualquer escrita, na primeira interação com o projeto. Por que existe: o provedor/modelo vinham de variável de ambiente fixa na configuração do cliente, que envelhece e ninguém revisa — o registro dizia `claude-opus-4` numa sessão Opus 5. Declare o modelo que você É, não o que a configuração diz. Um humano vê a declaração, corrige se preciso e libera a sessão. LIVRE (e permitido mesmo com a sessão ainda pendente).",
            inputSchema: Obj({
                provider: S.enum(["claude", "codex", "chatgpt", "other"], "Provedor real desta sessão"),
                model: S.str("Modelo real (ex.: claude-opus-5, gpt-6). Não repita o que veio da configuração se ele estiver errado."),
                objective: S.str("O que você veio fazer nesta sessão — é o que o humano lê para decidir se libera."),
                sessionName: S.str("Nome curto para identificar a sessão na interface")
            }),
            handler: (i) => store.DeclareSession(A({
                provider: i.provider, model: i.model, objective: i.objective, sessionName: i.sessionName
            }))
        }
    ]

    // ───────────── Portão de ENTRADA da sessão (MPME-28) ─────────────
    //
    // Uma sessão desconhecida não escreve antes de um humano liberar. O portão
    // fica AQUI, na camada de transporte, e não espalhado pelo domínio: é o
    // ponto por onde toda tool passa, então a cobertura é completa sem varrer os
    // ~60 call sites de escrita do store.
    //
    // LEITURA continua livre de propósito: um agente parado no portão deve
    // investigar o projeto enquanto espera — é justamente o que o torna útil
    // quando a liberação chega.
    const READ_ONLY_TOOLS = new Set([
        "roadmap", "project_status", "project_flow", "project_changes", "project_pulse",
        "ecosystem_index_status", "declare_session", "get_guidance", "report_blocked",
        "report_overdue", "report_ready", "list_ecosystem_packages",
        // Coordenação: saber quem está aqui e ler os próprios avisos é LEITURA —
        // e é o que um agente parado no portão mais precisa fazer.
        "who_is_here", "agent_inbox",
        // Sobre a PRÓPRIA sessão: dizer no que está e sair não podem depender da
        // liberação, senão uma sessão pendente que desiste fica presa esperando
        // aprovação para se despedir.
        "update_session_focus", "end_session"
    ])
    const IsReadOnlyTool = (name) =>
        READ_ONLY_TOOLS.has(name) || /^(list_|get_|search_)/.test(name)

    // Quando o portão barra, o agente BLOQUEIA aqui (como no gate de ação) em vez
    // de tentar de novo em laço: quem decide é o humano, e o agente espera.
    const SessionGate = async (toolName) => {
        try {
            await store.AssertSessionApproved({ actor, action: toolName })
            return
        } catch(e){
            if(e.code !== "AGENT_SESSION_PENDING_APPROVAL") throw e
            const sessionId = e.details && e.details.sessionId
            const final = await store.WaitForSessionDecision({ session: sessionId, timeoutMs: 0 })
            if(final.status === "active") return
            throw McpError("AGENT_SESSION_REJECTED",
                `Entrada da sessão ${final.status === "rejected" ? "recusada" : "encerrada"} pelo humano.`,
                { sessionId, status: final.status })
        }
    }

    return TOOLS.map((tool) => IsReadOnlyTool(tool.name)
        ? tool
        : { ...tool, handler: async (input) => { await SessionGate(tool.name); return tool.handler(input) } })
}

module.exports = { BuildTools }
