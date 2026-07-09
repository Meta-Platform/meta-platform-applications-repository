import * as React from "react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import AppShell from "../Components/AppShell"

// Termo em destaque + realce mono para nomes técnicos.
const T = ({ children }: { children: React.ReactNode }) => <b>{children}</b>
const M = ({ children }: { children: React.ReactNode }) => <span className="mpm-mono">{children}</span>
const H3 = ({ children }: { children: React.ReactNode }) => <h3 className="mpm-guide-h3">{children}</h3>

const Callout = ({ icon = "info circle", children }: { icon?: any; children: React.ReactNode }) =>
    <div className="mpm-panel mpm-guide-intro"><Icon name={icon} /><span>{children}</span></div>

const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) =>
    <div className="mpm-doc-table__wrap">
        <table className="mpm-doc-table">
            <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
    </div>

type Topic = { key: string; label: string; icon: any; lead: string; body: React.ReactNode }

// Glossário/Manual dos conceitos do Meta Project Manager. Objetivo: qualquer pessoa
// (ou agente) entender o que é cada objeto e COMO usar, sem contexto prévio.
const TOPICS: Topic[] = [
    {
        key: "overview", label: "Como funciona", icon: "compass",
        lead: "O modelo mental do gerenciador em uma passada: do projeto ao trabalho do dia a dia.",
        body: <>
            <p>O <T>Meta Project Manager</T> organiza o trabalho em camadas. De cima para baixo:</p>
            <ul className="mpm-guide-list">
                <li><T>Projeto</T> — o container de tudo (um produto, sistema ou iniciativa).</li>
                <li><T>Board</T> — um quadro do projeto, dividido em <T>colunas</T> (status) por onde o trabalho flui.</li>
                <li><T>Item de trabalho</T> — a unidade de trabalho (epic, feature, história, tarefa, subtarefa, bug…). Vive numa coluna do board.</li>
                <li><T>Planejamento</T> — <T>Milestone</T> (alvo de entrega por data), <T>Sprint</T> (janela de tempo) e <T>Horizonte</T> (inbox/now/next…) organizam <i>quando</i> cada item acontece.</li>
            </ul>
            <p>Um fluxo típico: crie um <T>Projeto</T> → ele ganha um <T>Board</T> com colunas → você joga <T>itens</T> no board e os move de coluna conforme avançam → agrupa itens em <T>Milestones</T>/<T>Sprints</T> e acompanha no <T>Roadmap</T>.</p>
            <Callout icon="hand point right">Use o menu à direita para pular direto ao conceito que você quer entender. O <T>Glossário A–Z</T>, no fim, resume tudo em uma linha por termo.</Callout>
        </>
    },
    {
        key: "project", label: "Projeto", icon: "folder",
        lead: "O container de tudo. Tem uma key, um slug e um board padrão.",
        body: <>
            <p>Um <T>Projeto</T> é o espaço de um produto/sistema/iniciativa. Dentro dele vivem boards, itens, milestones, sprints, comentários e anexos.</p>
            <ul className="mpm-guide-list">
                <li><T>Nome</T> e <T>slug</T> — o slug (ex.: <M>meu-app</M>) é o identificador legível na URL.</li>
                <li><T>Key prefix</T> — o prefixo das keys dos itens (ex.: <M>MEU</M> → <M>MEU-42</M>). Cada item recebe um número sequencial.</li>
                <li><T>Status</T> — planning, active, paused, completed, archived.</li>
                <li><T>Board padrão</T> — onde novos itens caem por default.</li>
            </ul>
            <Callout icon="shield">Criação de projeto <T>por um agente</T> exige sua aprovação (ver <T>Aprovação & Gate</T>). Excluir é <T>soft delete</T>: some da lista, mas é reversível.</Callout>
        </>
    },
    {
        key: "board", label: "Board & Colunas", icon: "columns",
        lead: "O quadro Kanban do projeto: colunas = status por onde o trabalho passa.",
        body: <>
            <p>Um <T>Board</T> é um quadro (estilo Kanban). Cada <T>coluna</T> representa um <T>status</T> (statusKey). Mover um card de coluna muda o status do item.</p>
            <p>Colunas padrão de um board novo:</p>
            <Table head={["Coluna", "statusKey", "Significa"]} rows={[
                ["Backlog", <M>backlog</M>, "Ainda não priorizado para execução"],
                ["Ready", <M>ready</M>, "Pronto para começar"],
                ["In Progress", <M>in-progress</M>, "Em execução agora"],
                ["Review", <M>review</M>, "Em revisão / validação"],
                ["Blocked", <M>blocked</M>, "Travado por uma dependência"],
                ["Done", <M>done</M>, "Concluído (coluna de conclusão)"],
                ["Archived", <M>archived</M>, "Arquivado / fora do fluxo"]
            ]} />
            <p className="mpm-muted">As colunas são configuráveis: você pode adicionar, renomear, reordenar e definir limites de WIP. Um projeto pode ter vários boards.</p>
        </>
    },
    {
        key: "item", label: "Item de trabalho & Tipos", icon: "tasks",
        lead: "A unidade de trabalho. Organiza-se em hierarquia: epic → feature → história/tarefa → subtarefa.",
        body: <>
            <p>Um <T>Item de trabalho</T> é qualquer coisa a fazer. Todo item tem uma <T>key</T> (ex.: <M>MEU-42</M>), um <T>tipo</T>, um <T>status</T> e uma <T>prioridade</T>. Itens podem ter pai/filho, formando uma hierarquia.</p>
            <Table head={["Tipo", "O que é"]} rows={[
                [<M>epic</M>, "Grande bloco de trabalho, agrupa features"],
                [<M>feature</M>, "Funcionalidade entregável, agrupa histórias/tarefas"],
                [<M>story</M>, "História de usuário (valor sob a ótica de quem usa)"],
                [<M>task</M>, "Tarefa técnica concreta"],
                [<M>subtask</M>, "Passo menor dentro de uma tarefa/história"],
                [<M>bug</M>, "Defeito a corrigir"],
                [<M>improvement / refactor / tech-debt</M>, "Melhoria, refatoração, dívida técnica"],
                [<M>documentation / research / decision</M>, "Doc, investigação, decisão registrada"]
            ]} />
            <p>Um item carrega ainda: <T>responsável</T>, <T>critérios de aceite</T>, <T>checklist</T>, <T>vínculos</T> (blocks/depends-on/relates-to), <T>comentários</T>, <T>anexos</T> e contexto de software (repo/branch/commit/PR).</p>
        </>
    },
    {
        key: "backlog-inbox", label: "Backlog, Inbox & Horizonte", icon: "clipboard list",
        lead: "Onde as ideias e o trabalho não-agendado ficam antes de entrar no fluxo.",
        body: <>
            <H3>Inbox</H3>
            <p>A <T>Inbox</T> é a caixa de entrada de <T>ideias cruas</T> (horizonte <M>inbox</M>, clareza <M>idea</M>). Serve para capturar rápido sem decidir nada; depois você faz a triagem (vira tarefa/história, vai para o backlog ou é descartada).</p>
            <H3>Backlog</H3>
            <p>O <T>Backlog</T> é a lista priorizada do que ainda não está em execução. É onde se decide o <i>o quê</i> e o <i>em que ordem</i>, usando prioridade, valor, esforço e clareza.</p>
            <H3>Horizonte</H3>
            <p>O <T>Horizonte</T> diz <i>quão perto</i> um item está de ser feito — um planejamento leve, sem datas:</p>
            <Table head={["Horizonte", "Significa"]} rows={[
                [<M>inbox</M>, "Ideia recém-capturada, sem triagem"],
                [<M>now</M>, "Fazendo agora"],
                [<M>next</M>, "Próximo a fazer"],
                [<M>later</M>, "Mais para frente"],
                [<M>maybe</M>, "Talvez — a validar"]
            ]} />
        </>
    },
    {
        key: "milestone", label: "Milestone", icon: "flag",
        lead: "Um alvo de entrega com data. Agrupa itens rumo a um marco (ex.: um release).",
        body: <>
            <p>Um <T>Milestone</T> (marco/release) é um <T>alvo de entrega</T> com uma <T>data-alvo</T>. Você associa itens a ele e acompanha o <T>progresso</T> (itens concluídos / total) rumo àquela data.</p>
            <ul className="mpm-guide-list">
                <li>Responde <T>“o que precisa estar pronto até tal data?”</T>.</li>
                <li>Tem status: planning, active, released, archived.</li>
                <li>É orientado a <T>escopo + data</T> (diferente do Sprint, que é orientado a <T>tempo</T>).</li>
            </ul>
            <Callout icon="road">Milestones aparecem no <T>Roadmap</T> ordenados por data-alvo, cada um com sua barra de progresso.</Callout>
        </>
    },
    {
        key: "sprint", label: "Sprint", icon: "rocket",
        lead: "Uma janela de tempo (iteração) com um objetivo. Time-boxed: começa e termina em datas fixas.",
        body: <>
            <p>Um <T>Sprint</T> (iteração) é uma <T>janela de tempo</T> fixa (ex.: 2 semanas) com um <T>objetivo</T>. Você coloca itens no sprint e o time trabalha para concluí-los dentro daquela janela.</p>
            <ul className="mpm-guide-list">
                <li>Tem <T>início</T>, <T>fim</T> e um <T>objetivo</T> (goal).</li>
                <li>Status: planned, active, completed, archived.</li>
                <li>É orientado a <T>tempo</T>: “o que dá para entregar nesta janela?”.</li>
            </ul>
            <Callout icon="info circle"><T>Milestone × Sprint:</T> o milestone é uma <b>meta com data</b> (pode levar vários sprints); o sprint é uma <b>caixa de tempo</b> curta e repetível. Um item pode estar em um sprint <i>e</i> contar para um milestone.</Callout>
        </>
    },
    {
        key: "roadmap", label: "Roadmap", icon: "road",
        lead: "A visão do plano no tempo: por data (milestones) ou por horizonte (now/next/later).",
        body: <>
            <p>O <T>Roadmap</T> é a <T>visão de planejamento</T> do projeto. Ele tem dois modos:</p>
            <ul className="mpm-guide-list">
                <li><T>Por data</T> — a timeline de <T>milestones</T> ordenada pela data-alvo, com progresso de cada um; os <T>sprints</T> aparecem logo abaixo.</li>
                <li><T>Por horizonte</T> — os itens agrupados em colunas <M>now / next / later / maybe</M> (e inbox), para enxergar prioridade sem depender de datas.</li>
            </ul>
            <p className="mpm-muted">É onde você responde “para onde o projeto está indo e quando”.</p>
        </>
    },
    {
        key: "attributes", label: "Status, Prioridade, Valor, Esforço", icon: "sliders horizontal",
        lead: "Os atributos que classificam e priorizam cada item.",
        body: <>
            <Table head={["Atributo", "Valores", "Para quê"]} rows={[
                [<T>Status</T>, <M>backlog · ready · in-progress · review · blocked · done…</M>, "Onde o item está no fluxo (= coluna do board)"],
                [<T>Prioridade</T>, <M>none · low · medium · high · urgent · critical</M>, "Quão urgente é fazer"],
                [<T>Valor</T>, <M>low · medium · high · critical</M>, "Quanto impacto/benefício entrega"],
                [<T>Esforço</T>, <M>xs · s · m · l · xl</M>, "Tamanho estimado do trabalho"],
                [<T>Clareza</T>, <M>idea · refining · ready</M>, "Quão bem definido/entendido está"]
            ]} />
            <p className="mpm-muted">Combinando <T>valor</T> alto + <T>esforço</T> baixo, você acha o que priorizar. <T>Clareza</T> baixa sinaliza que ainda falta refinar antes de executar.</p>
        </>
    },
    {
        key: "people", label: "Usuários & Agentes", icon: "users",
        lead: "Humanos e agentes de IA colaboram no mesmo projeto, com rastreio de quem fez o quê.",
        body: <>
            <p>Há dois tipos de <T>usuário</T>: <T>humano</T> e <T>agente</T> (IA). Um <T>Agente</T> (Claude, Codex…) atua pela CLI <M>mpm</M> ou pelo servidor <T>MCP</T> e se identifica por <T>sessão</T> (provider/modelo/trace).</p>
            <ul className="mpm-guide-list">
                <li>Toda ação registra <T>quem</T> fez — humano ou agente, e qual sessão/modelo.</li>
                <li>Agentes atuam livremente em itens/status/comentários; criar ou <T>remover</T> estrutura exige sua aprovação.</li>
            </ul>
            <Callout icon="book">A tela <T>Guia de IA</T> explica como conectar Claude Code / Codex por CLI ou MCP passo a passo.</Callout>
        </>
    },
    {
        key: "approval", label: "Aprovação & Gate", icon: "shield",
        lead: "Ações estruturais/destrutivas de um agente ficam pendentes até você aprovar.",
        body: <>
            <p>O <T>Gate de aprovação</T> protege o projeto de ações sensíveis feitas por agentes. Quando um agente tenta <T>criar</T> projeto/board/milestone/sprint ou <T>remover</T> projeto/board/item, a ação <T>não executa</T>: vira um <T>pedido pendente</T>.</p>
            <p>Um <T>modal global</T> aparece em qualquer tela mostrando <T>o quê</T> será feito (e, em remoções, o que será afetado) e <T>quem</T> pediu (agente, provider, modelo, sessão). Você <T>aprova</T> (a ação executa) ou <T>rejeita</T> (com motivo). O comando do agente fica aguardando e retoma sozinho após a aprovação.</p>
            <ul className="mpm-guide-list">
                <li><T>Livre</T> (sem gate): criar/editar itens, mudar status, comentar, anexar.</li>
                <li><T>Com gate</T>: criar estrutura e <T>remover</T> qualquer coisa.</li>
            </ul>
            <Callout icon="history">Tudo fica na <T>Auditoria</T>: a ação, quem pediu, quem aprovou/rejeitou e o resultado.</Callout>
        </>
    },
    {
        key: "az", label: "Glossário A–Z", icon: "list",
        lead: "Todos os termos, um por linha, para consulta rápida.",
        body: <>
            <Table head={["Termo", "Definição curta"]} rows={[
                [<T>Agente</T>, "Usuário de IA (Claude, Codex…) que atua via CLI/MCP, identificado por sessão."],
                [<T>Anexo</T>, "Arquivo ou link associado a um item (log, print, PR, doc)."],
                [<T>Aprovação (Gate)</T>, "Trava que exige decisão humana para ações estruturais/destrutivas de agente."],
                [<T>Auditoria</T>, "Registro imutável de cada mudança: quem, quando, o quê, resultado."],
                [<T>Backlog</T>, "Lista priorizada do que ainda não está em execução."],
                [<T>Board</T>, "Quadro Kanban do projeto, dividido em colunas de status."],
                [<T>Checklist</T>, "Lista de sub-passos marcáveis dentro de um item."],
                [<T>Coluna</T>, "Etapa do board; corresponde a um status (statusKey)."],
                [<T>Critério de aceite</T>, "Condição que define quando um item está pronto (Definition of Done)."],
                [<T>Esforço</T>, "Tamanho estimado do trabalho (xs–xl)."],
                [<T>Horizonte</T>, "Proximidade de execução: inbox/now/next/later/maybe."],
                [<T>Inbox</T>, "Caixa de ideias cruas para triagem posterior."],
                [<T>Item de trabalho</T>, "Unidade de trabalho (epic/feature/story/task/subtask/bug…)."],
                [<T>Key</T>, "Identificador do item (prefixo do projeto + número, ex.: MEU-42)."],
                [<T>MCP</T>, "Model Context Protocol: agente chama tools nativas do gerenciador."],
                [<T>Milestone</T>, "Alvo de entrega com data; agrupa itens rumo a um marco."],
                [<T>Prioridade</T>, "Quão urgente é fazer (none→critical)."],
                [<T>Projeto</T>, "Container de tudo: boards, itens, planejamento, pessoas."],
                [<T>Roadmap</T>, "Visão do plano no tempo (por data ou por horizonte)."],
                [<T>Sprint</T>, "Janela de tempo fixa (iteração) com um objetivo."],
                [<T>Status</T>, "Situação do item no fluxo (= coluna do board)."],
                [<T>Soft delete</T>, "Remoção reversível: o objeto some das listas mas não é apagado de fato."],
                [<T>Sessão (de agente)</T>, "Identidade de uma execução do agente (provider/modelo/trace)."],
                [<T>Valor</T>, "Impacto/benefício que o item entrega."],
                [<T>Vínculo</T>, "Relação entre itens: blocks, depends-on, relates-to…"]
            ]} />
        </>
    }
]

const GlossaryPage = () => {
    const navigate = useNavigate()
    const [active, setActive] = useState(TOPICS[0].key)
    const idx = Math.max(0, TOPICS.findIndex((t) => t.key === active))
    const topic = TOPICS[idx]
    const go = (key: string) => { setActive(key); try { window.scrollTo({ top: 0 }) } catch (_) { /* noop */ } }

    return <AppShell active="glossary">
        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">Manual & Glossário</h1>
                <div className="mpm-page-subtitle">O que é cada objeto do gerenciador — Projeto, Board, Item, Milestone, Sprint, Roadmap… — e como usar.</div>
            </div>
            <div className="mpm-page-head__actions">
                <button className="mpm-btn" title="Guia de conexão de agentes (Claude Code / Codex) por CLI e MCP" onClick={() => navigate("/guide")}>
                    <Icon name="book" /> Guia de IA
                </button>
            </div>
        </div>

        <div className="mpm-docs">
            <main className="mpm-docs-main">
                <div className="mpm-docs-topichead">
                    <h2 className="mpm-docs-h2"><Icon name={topic.icon} /> {topic.label}</h2>
                    <p className="mpm-docs-lead">{topic.lead}</p>
                </div>
                <section className="mpm-panel mpm-guide-section">{topic.body}</section>
                <div className="mpm-docs-nav-btns">
                    <button className="mpm-btn" disabled={idx === 0} onClick={() => idx > 0 && go(TOPICS[idx - 1].key)}>
                        <Icon name="arrow left" /> {idx > 0 ? TOPICS[idx - 1].label : ""}
                    </button>
                    <button className="mpm-btn mpm-btn--primary" disabled={idx === TOPICS.length - 1} onClick={() => idx < TOPICS.length - 1 && go(TOPICS[idx + 1].key)}>
                        {idx < TOPICS.length - 1 ? TOPICS[idx + 1].label : ""} <Icon name="arrow right" />
                    </button>
                </div>
            </main>

            <nav className="mpm-docs-nav" aria-label="Conceitos">
                <div className="mpm-docs-nav__title">Conceitos</div>
                {TOPICS.map((t, i) =>
                    <button key={t.key} className={`mpm-docs-nav__item ${t.key === active ? "is-active" : ""}`} onClick={() => go(t.key)}>
                        <span className="mpm-docs-nav__num">{i + 1}</span>
                        <Icon name={t.icon} />
                        <span className="mpm-docs-nav__label">{t.label}</span>
                    </button>
                )}
            </nav>
        </div>
    </AppShell>
}

export default GlossaryPage
