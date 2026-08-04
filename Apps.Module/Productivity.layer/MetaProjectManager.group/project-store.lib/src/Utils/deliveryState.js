// Tradução entre os DOIS EIXOS do modelo de entrega e o statusKey de sempre.
//
// O produto usou uma coluna só (statusKey) para responder duas perguntas
// diferentes: "em que pé está o trabalho?" e "quem já olhou isto?". Enquanto o
// humano executava, uma coluna bastava — ele era as duas respostas. Com o agente
// executando, `review` passou a significar três coisas ao mesmo tempo (entregue,
// sendo revisado, esperando decisão), e nenhuma delas dava para consultar.
//
// Agora `executionState` × `reviewState` são a verdade, e o statusKey é
// CONSEQUÊNCIA — calculado aqui, nunca escrito à mão em projeto migrado. Ele
// continua existindo porque o board o pinta, as colunas customizadas o usam e
// (o que mais importa) `AnalyticsStore.ProjectFlow`/`ItemTimeline` reconstroem o
// histórico inteiro fazendo replay dos eventos `set-status`. Parar de escrevê-lo
// cegaria o gráfico de fluxo a partir da migração.

const QUEUED_STATUSES = new Set(["backlog", "ready"])
const DONE_STATUSES   = new Set(["done", "completed", "archived"])

/**
 * O statusKey que corresponde a um par de estados.
 *
 * `currentStatusKey` existe para preservar a distinção backlog↔ready, que os
 * eixos novos não carregam: os dois são "na fila" para o agente, mas quem olha o
 * board separou um do outro de propósito.
 */
const DeriveStatusKey = ({ executionState, reviewState, blockedReason, currentStatusKey } = {}) => {
    // Bloqueio ganha de tudo: é o estado que pede ação humana imediata, e
    // esconder isso atrás de "em execução" foi o que já produziu item parado há
    // dias aparecendo como trabalho em curso.
    if(blockedReason) return "blocked"

    if(reviewState === "accepted" || executionState === "done") return "done"

    // Entregue e ainda não decidido — as três fases (coletando, com o revisor,
    // esperando o humano) são `review` no board, e a distinção fina fica na
    // Mesa, onde ela muda o que a pessoa faz.
    if(executionState === "delivered") return "review"

    // Devolvido volta a ser trabalho em curso: tem dono, tem crítica e alguém
    // está mexendo. Tratá-lo como fila o ofereceria a outro agente.
    if(reviewState === "returned") return "in-progress"

    if(executionState === "claimed" || executionState === "executing") return "in-progress"

    // Na fila: preserva backlog/ready se já era um dos dois.
    if(QUEUED_STATUSES.has(currentStatusKey)) return currentStatusKey
    return "backlog"
}

/**
 * O par de estados que corresponde a um statusKey legado — usado UMA vez por
 * item, na migração do projeto.
 *
 * `review` é o caso interessante: no modelo antigo significa "o agente terminou e
 * espera validação", que é exatamente uma entrega aguardando humano. A migração
 * cria a entrega retroativa correspondente (sem evidência, e dizendo isso).
 */
const MapLegacyStatusToStates = (statusKey) => {
    if(DONE_STATUSES.has(statusKey))  return { executionState: "done",      reviewState: "accepted" }
    if(statusKey === "review")        return { executionState: "delivered", reviewState: "awaiting-human" }
    if(statusKey === "in-progress")   return { executionState: "executing", reviewState: "none" }
    // `blocked` volta para a fila: o bloqueio vive em blockedReason, e mantê-lo
    // como estado de execução criaria um item que nunca sai de lugar nenhum.
    return { executionState: "queued", reviewState: "none" }
}

// Um item nestes estados NÃO é fila: ou tem dono, ou está esperando decisão.
const IsQueueable = ({ executionState, reviewState } = {}) =>
    executionState === "queued" && (reviewState === "none" || !reviewState)

module.exports = { DeriveStatusKey, MapLegacyStatusToStates, IsQueueable, QUEUED_STATUSES, DONE_STATUSES }
