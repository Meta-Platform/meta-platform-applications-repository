// Catálogo de tools MCP → métodos da @/project-store.lib.
//
// Cada tool devolve JSON plano (o MESMO dado da CLI/GUI — camada de domínio
// única). O `actor` (agente, definido no startup do servidor) é injetado em
// TODA mutação → auditoria correta + gate de aprovação humana para criação
// estrutural (project/board/milestone/sprint).
//
// Deliberadamente NÃO expostas ao agente:
//  - aprovar/rejeitar pedido de criação e confirmar sessão → são ações HUMANAS
//    (se o agente pudesse se autoaprovar, o gate não teria sentido);
//  - deleção física (project/board/item delete) → fica na GUI/CLI humana.

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

const BuildTools = ({ store, actor }) => {

    // Anexa o ator do agente ao payload de uma mutação.
    const A = (payload) => ({ ...payload, actor })

    return [
        // ───────────── Planejar (criação estrutural — GATE de aprovação humana) ─────────────
        {
            name: "create_project",
            description: "Cria um projeto. ATENÇÃO: criação estrutural por agente EXIGE aprovação humana — a tool retorna { ok:false, code:\"AGENT_SESSION_CONFIRMATION_REQUIRED\", details:{ pendingCreationId } }. Avise o humano e AGUARDE ele aprovar (na interface, ou `mpm agent creation approve <id>`). NÃO tente burlar.",
            inputSchema: Obj({
                name: S.str("Nome do projeto"),
                slug: S.str("Slug único (opcional; derivado do nome se ausente)"),
                description: S.str("Descrição (markdown)"),
                keyPrefix: S.str("Prefixo das keys dos itens (ex.: MPM)"),
                status: S.enum(["planning","candidate","active","paused","completed","archived"], "Status inicial"),
                repositoryUrl: S.str("URL do repositório"),
                localPath: S.str("Caminho local do projeto")
            }, ["name"]),
            handler: (i) => store.CreateProject(A({ name: i.name, slug: i.slug, description: i.description, keyPrefix: i.keyPrefix, status: i.status, repositoryUrl: i.repositoryUrl, localPath: i.localPath }))
        },
        {
            name: "create_board",
            description: "Cria um board (Kanban) no projeto. Criação estrutural — EXIGE aprovação humana (mesmo gate de create_project).",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                name: S.str("Nome do board"),
                description: S.str("Descrição"),
                type: S.str("Tipo do board (ex.: kanban)"),
                setDefault: S.bool("Tornar board padrão do projeto")
            }, ["project","name"]),
            handler: (i) => store.CreateBoard(A({ project: i.project, name: i.name, description: i.description, type: i.type, setDefault: i.setDefault }))
        },
        {
            name: "create_milestone",
            description: "Cria um milestone. Criação estrutural — EXIGE aprovação humana.",
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
            description: "Cria um sprint. Criação estrutural — EXIGE aprovação humana.",
            inputSchema: Obj({
                project: S.str("Projeto (id|slug|key)"),
                name: S.str("Nome do sprint"),
                goal: S.str("Objetivo do sprint"),
                startDate: S.str("Início (ISO)"),
                endDate: S.str("Fim (ISO)")
            }, ["project","name"]),
            handler: (i) => store.CreateSprint(A({ project: i.project, name: i.name, goal: i.goal, startDate: i.startDate, endDate: i.endDate }))
        },

        // ───────────── Executar (itens — LIVRE, sem gate) ─────────────
        {
            name: "create_item",
            description: "Cria um item de trabalho (epic/feature/story/task/subtask/bug/…). LIVRE (não exige aprovação). Use `parent` para hierarquia: epic → feature → story/task → subtask.",
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
                horizon: S.enum(HORIZONS, "Horizonte de planejamento")
            }, ["project","type","title"]),
            handler: (i) => store.CreateItem(A({ project: i.project, type: i.type, title: i.title, description: i.description, parent: i.parent, board: i.board, priority: i.priority, statusKey: i.status, assignee: i.assignee, area: i.area, horizon: i.horizon }))
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
                horizon: S.enum(HORIZONS, "Horizonte"),
                text: S.str("Busca textual"),
                limit: S.num("Máx. de itens"),
                offset: S.num("Deslocamento")
            }, ["project"]),
            handler: (i) => store.ListItems({ project: i.project, type: i.type, status: i.status, parent: i.parent, board: i.board, assignee: i.assignee, priority: i.priority, milestone: i.milestone, sprint: i.sprint, horizon: i.horizon, text: i.text, limit: i.limit, offset: i.offset })
        },
        {
            name: "get_item",
            description: "Detalha um item: descrição, critérios de aceite, checklist, links, subtarefas. Leia ANTES de agir numa tarefa.",
            inputSchema: Obj({ item: S.str("Item (id|key, ex.: MPM-42)") }, ["item"]),
            handler: (i) => store.GetItem({ item: i.item })
        },
        {
            name: "update_item",
            description: "Atualiza campos de um item (título, descrição, prioridade, progresso, prazo; contexto de software: repo/branch/commit/PR; planejamento: horizon/area).",
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
                area: S.str("Área")
            }, ["item"]),
            handler: (i) => store.UpdateItem(A({ item: i.item, title: i.title, description: i.description, statusKey: i.status, priority: i.priority, progress: i.progress, dueDate: i.dueDate, assignee: i.assignee, repositoryUrl: i.repositoryUrl, branchName: i.branchName, commitHash: i.commitHash, pullRequestUrl: i.pullRequestUrl, horizon: i.horizon, area: i.area }))
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
            description: "Cria um vínculo entre itens (blocks/depends-on/relates-to/duplicates/…).",
            inputSchema: Obj({ item: S.str("Item origem (id|key)"), relation: S.str("Relação (ex.: blocks, depends-on, relates-to)"), target: S.str("Item alvo (id|key)") }, ["item","relation","target"]),
            handler: (i) => store.LinkItem(A({ item: i.item, relation: i.relation, target: i.target }))
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
            description: "Lista os comentários de um item — leia o FEEDBACK do humano antes de agir.",
            inputSchema: Obj({ item: S.str("Item (id|key)") }, ["item"]),
            handler: (i) => store.ListComments({ item: i.item })
        },
        {
            name: "add_link_attachment",
            description: "Anexa um link externo (PR, doc, dashboard) a um item.",
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
            handler: (i) => store.ListItems({ text: i.text, project: i.project, type: i.type, status: i.status, assignee: i.assignee, area: i.area, limit: i.limit || 50, sort: "created" })
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
            name: "list_activity",
            description: "Auditoria recente do projeto: quem/qual sessão fez o quê. Útil para o agente se situar antes de agir.",
            inputSchema: Obj({ project: S.str("Projeto (id|slug|key)"), limit: S.num("Máx. de eventos"), offset: S.num("Deslocamento") }, ["project"]),
            handler: async (i) => {
                const projectId = i.project ? (await store.ResolveProject(i.project)).id : undefined
                return store.ListActivity({ projectId, limit: i.limit, offset: i.offset })
            }
        }
    ]
}

module.exports = { BuildTools }
