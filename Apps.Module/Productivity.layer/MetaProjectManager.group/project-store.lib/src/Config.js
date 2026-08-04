// Constantes de domínio compartilhadas pela lib, CLI e webservice.

const PROJECT_STATUSES   = ["planning", "candidate", "active", "paused", "completed", "archived"]

const WORK_ITEM_TYPES    = ["epic", "feature", "story", "task", "subtask", "bug", "improvement", "refactor", "documentation", "research", "automation", "tech-debt", "decision"]

const WORK_ITEM_PRIORITIES = ["none", "low", "medium", "high", "urgent", "critical"]

// Planejamento (spec de planejamento futuro: inbox/ideias/backlog/roadmap).
const WORK_ITEM_HORIZONS = ["inbox", "now", "next", "later", "maybe", "archived"]

const WORK_ITEM_CLARITY  = ["idea", "refining", "ready"]

// ESTIMATIVA em faixas nomeadas. É o campo `effort` — não existe um segundo eixo
// de "tamanho": quem planeja escreve xs…xl e o produto soma pelos pesos abaixo.
const WORK_ITEM_EFFORTS  = ["xs", "s", "m", "l", "xl"]

// Peso relativo de cada faixa, para SOMAR esforço por marco/sprint. Escala
// tipo Fibonacci reduzida: dobrar de faixa custa mais que o dobro da anterior.
// Sem isto, `progress` conta itens e trata "xl" e "xs" como iguais.
const WORK_ITEM_EFFORT_WEIGHTS = { xs: 1, s: 2, m: 3, l: 5, xl: 8 }

// CONFIANÇA na estimativa/no entendimento do item. Separada do esforço: "grande
// e conhecido" e "pequeno e nebuloso" são riscos diferentes.
const WORK_ITEM_CONFIDENCE = ["low", "medium", "high"]

const WORK_ITEM_VALUES   = ["none", "low", "medium", "high", "critical"]

// Vocabulário sugerido de áreas (não obrigatório — o campo aceita string livre,
// permitindo também nomes de módulo da Meta Platform).
const AREAS              = ["GUI", "CLI", "Backend", "Database", "Agents", "Infra", "UX", "Documentation", "Automation", "Integrations"]

const LINK_RELATIONS     = ["blocks", "depends", "relates", "duplicates", "implements", "tests", "originated_from"]

// Vínculo RISCO ↔ ITEM de trabalho. Direção: risco --relação--> item.
//  - mitigates: o item REDUZ o risco (é o trabalho que endereça o risco);
//  - triggers:  o item PODE PROVOCAR o risco (mexer ali é o que expõe o perigo);
//  - relates:   relação de contexto, sem causalidade declarada.
const RISK_LINK_RELATIONS = ["mitigates", "triggers", "relates"]

// Dependência entre MARCOS (entregas). Direção: milestone --relação--> outro.
// `depends` = precisa do outro concluído antes; `blocks` = o outro precisa deste.
// São a mesma aresta vista dos dois lados; guardamos como o autor escreveu.
const MILESTONE_LINK_RELATIONS = ["depends", "blocks"]

const ATTACHMENT_TYPES   = ["file", "image", "video", "pdf", "markdown", "log", "link", "other"]

// "desktop" = usuário automático que representa ações/anotações manuais feitas no
// ambiente desktop/local. "system" = automações internas do próprio gerenciador.
const USER_TYPES         = ["human", "agent", "desktop", "system"]

// Usuário automático semeado no boot para registrar notas/ações do desktop.
const DESKTOP_USER_HANDLE      = "usuario-desktop"
const DESKTOP_USER_DISPLAYNAME = "Usuário Desktop"

const AGENT_PROVIDERS    = ["claude", "codex", "chatgpt", "other"]

const AGENT_SESSION_STATUSES = ["pending_confirmation", "active", "closed", "rejected"]

// PRESENÇA de uma sessão (eixo separado do status/gate): ela ainda está aí?
//  - here: agiu há pouco;
//  - idle: sem ação há AGENT_PRESENCE_IDLE_MINUTES — provavelmente pensando/parada;
//  - gone: saiu (`end_session`) ou sumiu há AGENT_PRESENCE_GONE_MINUTES.
// A varredura que aplica isto (SweepPresence) roda por demanda, na leitura de
// presença — não há processo de fundo, e a informação nunca fica velha na tela.
const AGENT_PRESENCE_STATES = ["here", "idle", "gone"]
const AGENT_PRESENCE_IDLE_MINUTES = 15
const AGENT_PRESENCE_GONE_MINUTES = 60

// Tipos de aviso entregues entre sessões (AgentNotice):
//  - joined/left: entrada e saída de outro agente no workspace;
//  - message: recado dirigido de uma sessão a outra;
//  - environment: alguém subiu/derrubou/reprovisionou recurso compartilhado;
//  - item-touched: mexeram num item que VOCÊ reivindicou.
const AGENT_NOTICE_KINDS = ["joined", "left", "message", "environment", "item-touched"]

// Ações sobre ambiente COMPARTILHADO que uma sessão registra para as outras
// (MPMX3-21). Não é monitoração: é histórico de intenção entre agentes.
const ENVIRONMENT_ACTIONS = ["up", "down", "restart", "provision", "build", "other"]

const AUDIT_SOURCES      = ["gui", "cli", "api", "agent", "mcp", "desktop"]

// Escopos aos quais uma nota de atividade pode ser associada.
const ACTIVITY_SCOPES    = ["project", "board", "sprint", "milestone", "item", "global"]

// Permissões (modelo simples, guardado em User.permissionsJson).
// Consultar atividade/auditoria de TODOS os projetos exige permissão explícita.
const PERMISSIONS = [
    "activity:read:project",
    "activity:read:all_projects",
    "activity:write:note",
    "audit:read:project",
    "audit:read:all_projects",
    "approval:approve",
    "approval:reject",
    "sensitive:archive",
    "sensitive:delete"
]

// Limite recomendado/máximo da descrição curta (shortDescription).
const SHORT_DESCRIPTION_MAX = 240

// keyPrefix do projeto (ex.: MPM -> MPM-42). Informado explicitamente, é validado
// (nunca truncado em silêncio); derivado do nome, é cortado sem erro.
const KEY_PREFIX_MAX = 5

// Esquemas aceitos por AddLinkAttachment. file:// permite referenciar um arquivo
// local (log, artefato) sem copiá-lo para o storage de anexos.
const LINK_URL_SCHEMES = ["http", "https", "file"]

// Pedidos de aprovação (gate de agente). Um pedido carrega a AÇÃO que o agente
// tentou executar; um humano aprova (executa de fato) ou rejeita.
const APPROVAL_ACTIONS   = ["create", "delete", "archive"]

// Grau de risco da ação (dirige a UI de confirmação: destructive = trava reforçada).
const APPROVAL_RISKS     = ["normal", "sensitive", "destructive"]

// Ciclo de vida do pedido. pending -> approved (executado) | rejected | failed.
// expired/cancelled reservados para timeout/cancelamento explícito.
const APPROVAL_STATUSES  = ["pending", "approved", "rejected", "failed", "expired", "cancelled"]

// Tipos de alvo que um pedido de delete por agente pode carregar (soft delete).
const APPROVAL_DELETE_TARGETS = ["project", "board", "item", "risk", "planning-doc"]

const ENVIRONMENTS       = ["local", "dev", "staging", "homologation", "production"]

const MILESTONE_STATUSES = ["planning", "active", "released", "archived"]

const SPRINT_STATUSES    = ["planned", "active", "completed", "archived"]

// Registro de riscos (matriz 3×3): probabilidade e impacto usam a MESMA escala.
// O nível derivado (baixo→crítico) é calculado no RisksStore a partir do produto.
const RISK_LEVELS        = ["low", "medium", "high"]
const RISK_STATUSES      = ["open", "mitigating", "accepted", "closed", "occurred"]

// Documento de planejamento (termo de abertura/charter): ciclo de vida do plano.
const PLANNING_DOC_STATUSES = ["draft", "review", "approved", "archived"]

// ── MODELO DE ENTREGA ────────────────────────────────────────────────────────
//
// O produto nasceu com UM eixo (statusKey) para responder duas perguntas
// diferentes: "em que pé está o trabalho?" e "quem já olhou isto?". Enquanto o
// humano era o executor, uma coluna bastava. Com o agente executando, a segunda
// pergunta passou a ser a que importa — e ela não cabe numa coluna de board.
//
// Agora são dois eixos. `executionState` é o que o AGENTE faz; `reviewState` é
// onde a ENTREGA está no caminho até a decisão humana. `statusKey` continua
// existindo, mas vira consequência: quem escreve é DeriveStatusKey, e é dele que
// o board, o gráfico de fluxo e o histórico do item continuam vivendo.
const EXECUTION_STATES = ["queued", "claimed", "executing", "delivered", "done"]
const REVIEW_STATES    = ["none", "collecting", "ai-review", "awaiting-human", "returned", "accepted"]

// Ciclo de vida de uma ENTREGA. Uma tarefa gera N entregas — uma por rodada de
// revisão —, e é a entrega, não a tarefa, que o humano aceita ou devolve.
const DELIVERY_STATUSES = [
    "draft",           // criada, o agente ainda escreve o resumo
    "collecting",      // enviada; o coletor está montando a evidência
    "ai-review",       // aguardando o agente-revisor
    "awaiting-human",  // passou pela IA (ou escapou por falta de revisor)
    "accepted",
    "returned",        // devolvida ao mesmo agente, com motivo
    "withdrawn"        // o próprio agente retirou antes de alguém decidir
]

// Estado da revisão POR AGENTE, separado do status da entrega porque a entrega
// segue viva enquanto o revisor vai e volta. `escalated` = ninguém revisou a
// tempo e ela subiu ao humano marcada como não revisada — falta de revisor
// nunca pode prender trabalho.
const AI_REVIEW_STATES = ["pending", "claimed", "passed", "returned", "skipped", "escalated"]

// Quem decide, e o que decide. `escalate` é do revisor-IA que não se sente apto;
// `abstain` é o que registra "olhei e não é comigo" sem travar a fila.
const REVIEWER_TYPES     = ["ai", "human"]
const REVIEW_DECISIONS   = ["accept", "return", "escalate", "abstain"]

// EVIDÊNCIA: o que o sistema colheu sozinho sobre uma entrega. `gap` é a
// ausência registrada como fato — é o que impede a evidência de mentir por
// omissão ("não havia comando de verificação declarado" precisa aparecer tanto
// quanto "os testes passaram").
const EVIDENCE_KINDS = ["commit", "file", "verification", "criteria", "environment", "activity", "note", "gap"]

// Quem produziu a linha de evidência. Só `note` nasce do agente; o resto é
// colhido — evidência auto-relatada não é evidência.
const EVIDENCE_SOURCES = ["auto", "agent", "system"]

// COMO um commit foi ligado ao item. `key` é a correlação forte (a chave do
// item na mensagem); `window` é o plano B por janela de tempo, que se declara
// fraco em vez de fingir certeza.
const EVIDENCE_ATTRIBUTIONS = ["key", "window", "declared", "none"]
const EVIDENCE_CONFIDENCE   = ["high", "low"]

// Gravidade de uma lacuna. `blocking` é o que o revisor tem instrução de
// devolver; `warning` informa sem barrar.
const EVIDENCE_SEVERITIES = ["info", "warning", "blocking"]

// Qualidade agregada da evidência de uma entrega — o selo que o humano lê antes
// de abrir qualquer detalhe.
const EVIDENCE_QUALITIES = ["verified", "partial", "unverified", "none"]

// MANDATO: o escopo que o humano aprova UMA vez e dentro do qual o agente
// encadeia trabalho sem perguntar. `exhausted` é parada por condição atingida
// (o mandato cumpriu seu papel); `revoked` é o humano puxando o freio.
const MANDATE_STATUSES = ["draft", "pending", "active", "paused", "exhausted", "revoked", "completed"]

// Condições de parada, na ordem em que são avaliadas. O nome vai para
// `stopReason` e é o que o agente lê ao ser barrado.
const MANDATE_STOP_REASONS = [
    "unreviewed-limit",     // entregas demais esperando revisão humana
    "consecutive-returns",  // devolvido vezes seguidas: insistir é desperdício
    "out-of-scope",
    "delivery-limit",
    "expired",
    "revoked"
]

// Tetos padrão de um mandato novo. São conservadores de propósito: o mandato
// existe para o agente andar sozinho, não para acumular trabalho que ninguém
// olhou — três entregas paradas já indicam que o gargalo virou o humano.
const MANDATE_DEFAULT_MAX_UNREVIEWED         = 3
const MANDATE_DEFAULT_MAX_CONSECUTIVE_RETURNS = 2

// PAPÉIS de agente. `reviewer` é o único que muda regra de verdade (não se pode
// revisar a própria entrega); os outros dois documentam intenção e alimentam a
// fila certa.
const AGENT_ROLES = ["executor", "reviewer", "planner"]

// PLANO proposto pelo agente: rascunho que o humano aceita, edita ou recusa UMA
// vez. Aceito, vira árvore de itens + rodada + mandato numa decisão só.
const PLAN_STATUSES = ["draft", "submitted", "accepted", "rejected", "superseded"]

// Quanto tempo uma entrega espera por um agente-revisor antes de subir ao humano
// marcada como não revisada, e por quanto tempo uma revisão fica reivindicada.
const AI_REVIEW_TIMEOUT_MINUTES = 30
const AI_REVIEW_CLAIM_MINUTES   = 20

// Colunas/status padrão de um board recém-criado (spec §4.2).
const DEFAULT_COLUMNS = [
    { name: "Backlog",     statusKey: "backlog",     color: "#64748B", isDoneColumn: false },
    { name: "Ready",       statusKey: "ready",       color: "#38BDF8", isDoneColumn: false },
    { name: "In Progress", statusKey: "in-progress", color: "#F59E0B", isDoneColumn: false },
    { name: "Review",      statusKey: "review",      color: "#A855F7", isDoneColumn: false },
    { name: "Blocked",     statusKey: "blocked",     color: "#EF4444", isDoneColumn: false },
    { name: "Done",        statusKey: "done",        color: "#22C55E", isDoneColumn: true  },
    { name: "Archived",    statusKey: "archived",    color: "#475569", isDoneColumn: false }
]

// Transições de status de tarefa que, feitas por AGENTE, exigem solicitação/
// aprovação explícita do humano (gate no SetStatus):
//  - INICIAR = mover para "in-progress" (começar a trabalhar na tarefa);
//  - CONCLUIR = mover para "done"/"completed" OU para qualquer coluna marcada como
//    isDoneColumn no board (o WorkItemsStore também consulta a coluna).
// Board customizado: se a coluna de "em progresso" tiver outro statusKey, inclua-o
// aqui. A conclusão por coluna isDoneColumn é detectada dinamicamente.
const AGENT_GATED_START_STATUSES = ["in-progress"]
const AGENT_GATED_DONE_STATUSES  = ["done", "completed"]

// FONTE ÚNICA do que passa por gate de aprovação humana quando o ator é agente.
// `GateAgentAction` CONSULTA este mapa antes de criar o pedido, e a orientação
// exposta ao agente (get_guidance) é derivada daqui — assim o que o produto diz
// e o que o produto faz não podem divergir (era o caso de milestone/sprint, que
// a orientação anunciava como gated e o código criava livremente).
//
// Chave = actionName do pedido; valor = tipos de alvo gated naquela ação.
// Um par (ação, tipo) ausente daqui é LIVRE para o agente.
const AGENT_GATE_POLICY = {
    create:        ["project", "board", "column"],
    update:        ["project", "column"],
    move:          ["column"],
    "set-default": ["board"],
    archive:       ["project"],
    restore:       ["project"],
    // Só as transições de INICIAR/CONCLUIR (ver AGENT_GATED_*_STATUSES); as demais
    // mudanças de status não chegam a chamar o gate.
    "set-status":  ["work-item"],
    // O MESMO gate, para um CONJUNTO de itens numa decisão só. Um projeto de 74
    // itens gerava ~150 diálogos idênticos — e humano que carimba não lê, que é
    // o oposto do que o gate existe para garantir (MPMX3-8). O pedido carrega a
    // lista inteira, então a decisão continua informada.
    "set-status-batch": ["work-item"],
    // Concluir um ÉPICO inteiro numa autorização só. Existe porque fechar um
    // épico de 8 filhos custava 8 aprovações idênticas — e humano que carimba
    // não lê. O pedido carrega a lista do que será concluído junto.
    "complete-epic": ["work-item"],
    delete:        ["project", "board", "item", "milestone", "sprint", "column",
                    "checklist-item", "acceptance-criteria", "risk", "doc-page", "planning-doc"]
}

// Esta ação, sobre este tipo de alvo, exige aprovação humana quando feita por agente?
const IsAgentGatedAction = ({ actionName, type } = {}) =>
    Array.isArray(AGENT_GATE_POLICY[actionName]) && AGENT_GATE_POLICY[actionName].includes(type)

// EXCEÇÕES da trava de PLANEJAMENTO (agentPlanningLock). A trava existe para que o
// agente não trabalhe num projeto que o humano ainda está montando — mas recusar
// TAMBÉM a saída de `planning` a transformava em armadilha: o agente não podia
// destravar o projeto, e não havia superfície humana que o fizesse (MPMX3-1).
//
// Cada regra libera UMA escrita, e só quando ela é exatamente o que tira o projeto
// do planejamento: `onlyFields` é o conjunto MÁXIMO de campos que o patch pode
// tocar. Um update que mexa em status E descrição não passa — não é "destravar".
// A exceção não afasta o gate de aprovação: `update`/`project` segue em
// AGENT_GATE_POLICY, então o humano continua decidindo.
const PLANNING_LOCK_EXEMPTIONS = [
    { actionName: "update", type: "project", onlyFields: ["status"] }
]

// Esta escrita está isenta da trava de planejamento? `fields` = campos do patch.
const IsPlanningLockExempt = ({ actionName, type, fields } = {}) =>
    Array.isArray(fields) && fields.length > 0 &&
    PLANNING_LOCK_EXEMPTIONS.some((rule) =>
        rule.actionName === actionName && rule.type === type &&
        fields.every((field) => rule.onlyFields.includes(field)))

// Limite padrão de tamanho de anexo (bytes). Configurável via startup-params.
const DEFAULT_MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

module.exports = {
    PROJECT_STATUSES,
    AGENT_GATED_START_STATUSES,
    AGENT_GATED_DONE_STATUSES,
    AGENT_GATE_POLICY,
    IsAgentGatedAction,
    PLANNING_LOCK_EXEMPTIONS,
    IsPlanningLockExempt,
    WORK_ITEM_TYPES,
    WORK_ITEM_PRIORITIES,
    WORK_ITEM_HORIZONS,
    WORK_ITEM_CLARITY,
    WORK_ITEM_EFFORTS,
    WORK_ITEM_EFFORT_WEIGHTS,
    WORK_ITEM_CONFIDENCE,
    WORK_ITEM_VALUES,
    AREAS,
    LINK_RELATIONS,
    RISK_LINK_RELATIONS,
    MILESTONE_LINK_RELATIONS,
    ATTACHMENT_TYPES,
    MILESTONE_STATUSES,
    SPRINT_STATUSES,
    RISK_LEVELS,
    RISK_STATUSES,
    PLANNING_DOC_STATUSES,
    // Modelo de entrega
    EXECUTION_STATES,
    REVIEW_STATES,
    DELIVERY_STATUSES,
    AI_REVIEW_STATES,
    REVIEWER_TYPES,
    REVIEW_DECISIONS,
    EVIDENCE_KINDS,
    EVIDENCE_SOURCES,
    EVIDENCE_ATTRIBUTIONS,
    EVIDENCE_CONFIDENCE,
    EVIDENCE_SEVERITIES,
    EVIDENCE_QUALITIES,
    MANDATE_STATUSES,
    MANDATE_STOP_REASONS,
    MANDATE_DEFAULT_MAX_UNREVIEWED,
    MANDATE_DEFAULT_MAX_CONSECUTIVE_RETURNS,
    AGENT_ROLES,
    PLAN_STATUSES,
    AI_REVIEW_TIMEOUT_MINUTES,
    AI_REVIEW_CLAIM_MINUTES,
    USER_TYPES,
    DESKTOP_USER_HANDLE,
    DESKTOP_USER_DISPLAYNAME,
    AGENT_PROVIDERS,
    AGENT_SESSION_STATUSES,
    AGENT_PRESENCE_STATES,
    AGENT_PRESENCE_IDLE_MINUTES,
    AGENT_PRESENCE_GONE_MINUTES,
    AGENT_NOTICE_KINDS,
    ENVIRONMENT_ACTIONS,
    AUDIT_SOURCES,
    ACTIVITY_SCOPES,
    PERMISSIONS,
    SHORT_DESCRIPTION_MAX,
    KEY_PREFIX_MAX,
    LINK_URL_SCHEMES,
    APPROVAL_ACTIONS,
    APPROVAL_RISKS,
    APPROVAL_STATUSES,
    APPROVAL_DELETE_TARGETS,
    ENVIRONMENTS,
    DEFAULT_COLUMNS,
    DEFAULT_MAX_ATTACHMENT_BYTES
}
