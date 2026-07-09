import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { EnvironmentInfo } from "../api/system"
import AppShell from "../Components/AppShell"

// Bloco de comando/código com botão "Copiar" (linhas de comentário em verde).
const CodeBlock = ({ children, title }: { children: string; title?: string }) => {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        try {
            navigator.clipboard.writeText(children)
            setCopied(true); setTimeout(() => setCopied(false), 1500)
        } catch (_) { /* ignora */ }
    }
    const lines = children.split("\n")
    return <div className="mpm-guide-code">
        <div className="mpm-guide-code__bar">
            <span className="mpm-mono">{title || "shell"}</span>
            <button className="mpm-btn mpm-btn--sm" onClick={copy}>
                <Icon name={copied ? "check" : "copy"} /> {copied ? "Copiado" : "Copiar"}
            </button>
        </div>
        <pre className="mpm-code-block"><code>{lines.map((ln, i) =>
            <span key={i} className={ln.trim().startsWith("#") ? "mpm-code-comment" : undefined}>
                {ln}{i < lines.length - 1 ? "\n" : ""}
            </span>
        )}</code></pre>
    </div>
}

// Callout (nota/atenção) — reaproveita o visual de intro do guia.
const Callout = ({ icon = "info circle", children }: { icon?: any; children: React.ReactNode }) =>
    <div className="mpm-panel mpm-guide-intro"><Icon name={icon} /><span>{children}</span></div>

// Tabela de referência simples com rolagem horizontal.
const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) =>
    <div className="mpm-doc-table__wrap">
        <table className="mpm-doc-table">
            <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
    </div>

const M = ({ children }: { children: React.ReactNode }) => <span className="mpm-mono">{children}</span>
const H3 = ({ children }: { children: React.ReactNode }) => <h3 className="mpm-guide-h3">{children}</h3>

const AGENT_INSTRUCTIONS = `Você tem acesso ao Meta Project Manager para gerenciar este projeto — pela CLI "mpm" OU pelas tools MCP (mesma semântica).
Regras:
- Toda ação tem um comando/tool; na CLI use SEMPRE --json e leia o envelope { ok, data } / { ok:false, code, message }.
- Identifique-se: na CLI, em TODO comando com --session-provider <claude|codex|other> --session-model <modelo> --session-trace <id>. No MCP a identidade já vem da config do servidor.
- CRIAR projeto/board/milestone/sprint exige APROVAÇÃO humana: retorna code "AGENT_SESSION_CONFIRMATION_REQUIRED" com pendingCreationId. Avise o humano e AGUARDE aprovação. NÃO tente burlar.
- Itens (histórias/tarefas/subtarefas/bugs), status, comentários e anexos são LIVRES.
- ANTES de criar estrutura, INVESTIGUE o que já existe (search_items / mpm item list --text; mpm project list) e prefira ATUALIZAR em vez de duplicar. Consulte roadmap/relacionamentos/bloqueios para enxergar conflitos.
- Antes de agir numa tarefa, leia o item (get_item / mpm item show <KEY>) e seus comentários (list_comments / mpm comment list <KEY>) — feedback do humano.
- Ao terminar um passo, registre: comente o que fez e atualize o status.`

// ------------------------------------------------------------------
// Tópicos da documentação (renderizados um por vez).
type Topic = { key: string; label: string; icon: any; lead: string; body: React.ReactNode }
type Paths = { mcpPath: string; cliPath: string; codexConfigPath: string }

// Constrói os tópicos com os CAMINHOS REAIS desta máquina (via System.GetEnvironmentInfo),
// para os comandos saírem prontos para copiar/colar sem editar nada.
const buildTopics = ({ mcpPath, cliPath, codexConfigPath }: Paths): Topic[] => [
    {
        key: "overview", label: "Visão geral", icon: "home",
        lead: "O que é, como um agente se conecta e as regras que valem para todos.",
        body: <>
            <p>O <b>Meta Project Manager</b> pode ser operado por agentes de IA (Claude Code, Codex, OpenCode…) de <b>duas formas</b>, sobre a <b>mesma camada de domínio</b> desta interface — nada é exclusivo da tela:</p>
            <ul className="mpm-guide-list">
                <li><b>CLI <M>mpm</M></b> — feita para IA: saída <M>--json</M> previsível, não-interativa. O agente monta linhas de comando.</li>
                <li><b>Servidor MCP</b> (Model Context Protocol) — o agente chama <b>tools nativas</b> (<M>create_item</M>, <M>set_item_status</M>…) sem montar comandos. Recomendado no Claude Code e no Codex.</li>
            </ul>
            <p>Nos dois casos valem as mesmas regras:</p>
            <ul className="mpm-guide-list">
                <li><b>Gate de aprovação:</b> criar <b>projeto/board/milestone/sprint</b> exige sua aprovação; itens, status, comentários e anexos são livres.</li>
                <li><b>Auditoria:</b> toda mudança é registrada com a sessão/agente responsável — você acompanha em <b>Atividade recente</b>, na tela <b>Agentes</b> e pelo <b>badge</b> de pendências.</li>
                <li><b>Identidade:</b> o agente se identifica (provider/modelo/sessão); host, usuário, diretório e git são capturados automaticamente.</li>
            </ul>
            <Callout icon="hand point right">Comece por <b>Conectar por MCP</b> (Claude Code / Codex) ou <b>Conectar pela CLI</b>. Depois veja <b>Autorização</b> e os verbos (Planejar, Executar, Interagir, Navegar, Acompanhar).</Callout>
        </>
    },
    {
        key: "connect-mcp", label: "Conectar por MCP", icon: "plug",
        lead: "Claude Code e Codex: configure uma vez; toda nova sessão já vem com as tools.",
        body: <>
            <p>O servidor MCP roda por <M>stdio</M> e é lançado pelo próprio cliente (1 processo por sessão). A configuração é feita <b>uma vez</b>.</p>

            <H3>Passo 1 — instalar o executável</H3>
            <CodeBlock title="uma vez, no terminal">{`repo install ApplicationsRepository LOCAL_FS --executables meta-project-manager-mcp
# depois de qualquer alteração no código do pacote:
repo update ApplicationsRepository`}</CodeBlock>
            <p className="mpm-muted">Instala em <M>{mcpPath}</M> (caminho já usado nos comandos abaixo). Clientes MCP <b>não expandem o <M>~</M></b> — por isso os comandos usam o caminho <b>absoluto</b> desta máquina.</p>

            <H3>Passo 2a — Claude Code</H3>
            <p>Um comando registra o servidor para <b>todas as novas sessões</b>. <M>--scope user</M> vale em todos os projetos; <M>--scope project</M> grava um <M>.mcp.json</M> versionável (compartilha com o time).</p>
            <CodeBlock title="uma vez, no terminal">{`claude mcp add \\
  --env MPM_SESSION_PROVIDER=claude \\
  --env MPM_SESSION_MODEL=claude-opus-4 \\
  --scope user \\
  --transport stdio \\
  meta-project-manager \\
  -- ${mcpPath} serve`}</CodeBlock>
            <p className="mpm-muted"><b>A ordem importa:</b> as flags <M>--env</M> vêm <b>antes</b> de <M>--scope</M>/<M>--transport</M>. O <M>--env</M> é variádico — se ficar logo antes do nome, ele engole <M>meta-project-manager</M> (erro <M>Invalid environment variable format</M>). O <M>--</M> também é obrigatório (tudo à direita vai para o servidor). As tools aparecem como <M>mcp__meta_project_manager__&lt;tool&gt;</M>.</p>

            <H3>Passo 2b — Codex</H3>
            <p>O Codex não tem comando de adicionar — <b>acrescente</b> este bloco ao <M>{codexConfigPath}</M> (sem mexer no resto):</p>
            <CodeBlock title={codexConfigPath}>{`[mcp_servers."meta-project-manager"]
command = "${mcpPath}"
args = ["serve"]
[mcp_servers."meta-project-manager".env]
MPM_SESSION_PROVIDER = "codex"
MPM_SESSION_MODEL = "gpt-5.5"`}</CodeBlock>

            <H3>Passo 3 — abrir uma nova sessão</H3>
            <p><b>Nada a fazer por sessão.</b> O cliente sobe o servidor sozinho, o agente já enxerga as tools e a identidade é preenchida automaticamente. Confirme com <M>/mcp</M> dentro da sessão (no Claude Code, também <M>claude mcp list</M> / <M>claude mcp get meta-project-manager</M>).</p>
            <Callout icon="clock outline">O <M>trace</M> da sessão é gerado por processo — como é 1 processo por sessão, cada sessão já ganha um id distinto. Só fixe <M>MPM_SESSION_TRACE</M> se quiser um id legível/estável.</Callout>
        </>
    },
    {
        key: "connect-cli", label: "Conectar pela CLI", icon: "terminal",
        lead: "O executável mpm, o PATH e o formato de saída --json.",
        body: <>
            <p>A CLI é instalada como o executável <M>mpm</M> (alias <M>meta-project-manager</M>), em <M>{cliPath}</M>.</p>
            <CodeBlock title="instalar / atualizar">{`repo install ApplicationsRepository LOCAL_FS --executables mpm
repo update ApplicationsRepository   # após editar o código`}</CodeBlock>
            <p>Garanta o executável no <M>PATH</M> do ambiente da sessão (ou use o caminho completo).</p>
            <H3>Formato de saída (--json)</H3>
            <p>Com <M>--json</M>, todo comando imprime um envelope estável — o agente deve ler <M>ok</M> e reagir a <M>code</M>:</p>
            <CodeBlock title="envelopes">{`{ "ok": true, "data": { ... } }
{ "ok": false, "code": "ALGUM_CODIGO", "message": "…", "details": { ... } }`}</CodeBlock>
            <p className="mpm-muted">Destrutivos exigem <M>--confirm</M> (ou <M>--yes</M>); <M>--dry-run</M> simula. Resolvers de <M>--project/--board/--item</M> aceitam id, slug ou key (ex.: <M>MPM-42</M>).</p>
        </>
    },
    {
        key: "sessions", label: "Sessão & identidade", icon: "id badge",
        lead: "Como o agente se identifica e o que é capturado automaticamente.",
        body: <>
            <p>Não há “login”. Na <b>CLI</b>, o agente se identifica <b>em cada comando</b> com flags <M>--session-*</M>. No <b>MCP</b>, a identidade é definida <b>uma vez</b> na config do servidor (variáveis <M>MPM_SESSION_*</M>). Em ambos, host, usuário do SO, PID, diretório e git (repo/branch/commit) são capturados sozinhos e a sessão é registrada.</p>
            <Table head={["Variável (MCP)", "Flag (CLI)", "Descrição"]} rows={[
                [<M>MPM_SESSION_PROVIDER</M>, <M>--session-provider</M>, <>claude | codex | chatgpt | other</>],
                [<M>MPM_SESSION_MODEL</M>, <M>--session-model</M>, "Modelo em uso (rótulo)"],
                [<M>MPM_SESSION_TRACE</M>, <M>--session-trace</M>, "Id da sessão (gerado se omitido)"],
                [<M>MPM_SESSION_OBJECTIVE</M>, <M>--session-objective</M>, "Objetivo da sessão (opcional)"],
                [<M>MPM_SESSION_AGENT</M>, <M>--session-agent</M>, "Nome/handle do agente (opcional)"],
                [<M>MPM_SESSION_OWNER</M>, <M>--session-owner</M>, "Humano dono da sessão (opcional)"]
            ]} />
            <CodeBlock title="CLI: o agente atua já se identificando">{`mpm task create \\
  --project meu-app \\
  --title "Implementar login" \\
  --session-provider claude \\
  --session-model claude-opus-4 \\
  --session-trace SESSAO-123 \\
  --json`}</CodeBlock>
            <p className="mpm-muted">O usuário-agente é criado automaticamente na 1ª ação — não precisa cadastrá-lo antes. Nos exemplos dos próximos tópicos, as flags <M>--session-*</M> e o <M>--json</M> foram omitidos por brevidade; <b>inclua-os em todos os comandos da CLI</b>.</p>
        </>
    },
    {
        key: "authorization", label: "Autorização (gate)", icon: "lock",
        lead: "Criar estrutura por agente exige sua aprovação. Como funciona e como aprovar.",
        body: <>
            <p><b>Criar estrutura</b> — projeto, board, milestone ou sprint — por um agente é <b>bloqueado até você aprovar</b>. A tentativa vira um <b>pedido de criação</b> pendente e devolve:</p>
            <CodeBlock title="resposta ao tentar criar">{`{
  "ok": false,
  "code": "AGENT_SESSION_CONFIRMATION_REQUIRED",
  "details": {
    "pendingCreationId": "…",
    "type": "project",
    "nextCommands": ["mpm agent creation approve <id>", "mpm agent creation reject <id>"]
  }
}`}</CodeBlock>
            <p>Isto <b>não é um erro</b> — é o fluxo esperado. Você aprova/rejeita <b>nesta interface</b> (tela <b>Agentes → Pedidos de criação</b>, com todos os detalhes da sessão: host, usuário, git…) ou pela CLI:</p>
            <CodeBlock title="lado humano">{`mpm agent creation list --json
mpm agent creation approve <pendingCreationId> --json   # executa a criação de fato
mpm agent creation reject  <pendingCreationId> --json`}</CodeBlock>
            <Callout icon="check circle">Já <b>itens</b> (histórias/tarefas/subtarefas/bugs), <b>status</b>, <b>comentários</b> e <b>anexos</b> são <b>livres</b> — o agente faz sem pedir aprovação. Aprovar/rejeitar e confirmar sessões são sempre ações <b>suas</b> (no MCP, não são tools do agente).</Callout>
        </>
    },
    {
        key: "instructions", label: "Instruções para o agente", icon: "clipboard",
        lead: "Cole este bloco nas regras do seu Claude Code / Codex.",
        body: <>
            <p>Cole nas instruções/regras do agente para que ele saiba operar o gerenciador (serve para CLI e MCP):</p>
            <CodeBlock title="instruções do agente">{AGENT_INSTRUCTIONS}</CodeBlock>
        </>
    },
    {
        key: "plan", label: "Planejar", icon: "sitemap",
        lead: "Projeto, board, milestone, sprint (com aprovação) e a hierarquia do backlog.",
        body: <>
            <p>Estrutura entra no <b>gate</b> (aguarda aprovação); o backlog hierárquico é livre: <b>epic → feature → story/task → subtask</b>.</p>
            <CodeBlock>{`# estrutura — cada "create" aguarda sua aprovação
mpm project   create --name "Meu App"
mpm board     create --project meu-app --name "Development"
mpm milestone create --project meu-app --name "MVP" --target-date 2026-09-01
mpm sprint    create --project meu-app --name "Sprint 1"

# backlog e hierarquia (livre)
mpm epic    create --project meu-app --title "Autenticação"
mpm feature create --project meu-app --title "Login por e-mail" --parent MEU-1
mpm task    create --project meu-app --title "Tela de login"   --parent MEU-2 --priority high

# ideia crua no inbox / triagem depois
mpm inbox add "Suporte a SSO" --project meu-app
mpm item set-horizon MEU-3 --horizon next`}</CodeBlock>
            <p className="mpm-muted">Tools MCP equivalentes: <M>create_project</M>, <M>create_board</M>, <M>create_milestone</M>, <M>create_sprint</M> (com gate), <M>create_item</M>, <M>add_to_inbox</M>.</p>
        </>
    },
    {
        key: "execute", label: "Executar", icon: "cogs",
        lead: "Mexer nas tarefas: status, atualizar, mover, atribuir, bloquear, vincular.",
        body: <>
            <CodeBlock>{`mpm item list          --project meu-app --status ready
mpm item set-status    MEU-42 --status in-progress
mpm item update        MEU-42 --priority high --progress 40
mpm item move-to-board MEU-42 --board <BOARD_ID> --status review
mpm item assign        MEU-42 --user claude-kaio
mpm item block         MEU-42 --reason "aguardando API externa"`}</CodeBlock>
            <p className="mpm-muted">Tools MCP: <M>list_items</M>, <M>set_item_status</M>, <M>update_item</M>, <M>move_item_to_board</M>, <M>assign_item</M>, <M>block_item</M>, <M>link_item</M>.</p>
        </>
    },
    {
        key: "interact", label: "Interagir", icon: "comments",
        lead: "Comentar, ler o feedback do humano, criar bug, anexar log/print.",
        body: <>
            <CodeBlock>{`# ler a tarefa e o SEU feedback antes de agir
mpm item show    MEU-42            # descrição, critérios, checklist, links
mpm comment list MEU-42            # comentários / feedback do humano

# comentar o que fez
mpm comment add  MEU-42 --body "Implementado; falta teste."

# criar bug
mpm item create --project meu-app --type bug --title "Login falha no 2FA" --priority urgent

# anexar log / print
mpm attachment add MEU-42 --file ./test-output.log`}</CodeBlock>
            <p className="mpm-muted">Tools MCP: <M>get_item</M>, <M>add_comment</M>, <M>list_comments</M>, <M>create_item</M> (type bug), <M>add_file_attachment</M>, <M>add_link_attachment</M>.</p>
        </>
    },
    {
        key: "navigate", label: "Navegar & decidir", icon: "compass",
        lead: "Consultar antes de agir: criar novo vs. atualizar existente, relações e conflitos.",
        body: <>
            <p>Para decidir entre <b>criar algo novo</b> e <b>atualizar o que existe</b> — e evitar duplicatas e conflitos — o agente deve <b>consultar os dados primeiro</b>:</p>
            <ul className="mpm-guide-list">
                <li><b>Já existe algo equivalente?</b> Busque em TODOS os projetos por texto antes de criar.</li>
                <li><b>Qual o plano?</b> Veja projetos, roadmap por horizonte e milestones/sprints.</li>
                <li><b>Quais as relações?</b> O item mostra os <b>links</b> (blocks / depends-on / relates-to).</li>
                <li><b>Há riscos/conflitos?</b> Veja itens <b>bloqueados</b> e <b>atrasados</b>.</li>
            </ul>
            <CodeBlock>{`# buscar equivalentes (CLI busca dentro de um projeto por --text)
mpm item list --text "login"      --project meu-app
mpm project list                  # panorama dos projetos
mpm roadmap --project meu-app --by horizon
mpm milestone list --project meu-app
mpm item show MEU-42              # revela os relacionamentos (links)
mpm report blocked --project meu-app
mpm report overdue --project meu-app`}</CodeBlock>
            <Callout icon="lightbulb">No <b>MCP</b>, a tool <M>search_items</M> busca em <b>TODOS os projetos</b> de uma vez (a CLI busca por projeto). Demais tools: <M>list_projects</M>, <M>roadmap</M>, <M>list_milestones</M>, <M>list_sprints</M>, <M>get_item</M> (links), <M>report_blocked</M>, <M>report_overdue</M>.</Callout>
        </>
    },
    {
        key: "monitor", label: "Acompanhar", icon: "chart line",
        lead: "Auditoria e relatórios — o que o agente fez e a saúde do projeto.",
        body: <>
            <p>Tudo que o agente faz vira <b>auditoria</b> (com a sessão/agente responsável). Você acompanha:</p>
            <ul className="mpm-guide-list">
                <li><b>Nesta interface:</b> aba <b>Atividade recente</b> do projeto, tela <b>Agentes</b> (sessões + pedidos pendentes) e o <b>badge</b> de pendências.</li>
                <li><b>Por CLI / MCP:</b></li>
            </ul>
            <CodeBlock>{`mpm activity list         --project meu-app --limit 50   # quem/qual sessão fez o quê
mpm report project-status --project meu-app
mpm agent session list    --agent claude-kaio`}</CodeBlock>
            <p className="mpm-muted">Tools MCP: <M>list_activity</M>, <M>project_status</M>.</p>
        </>
    },
    {
        key: "reference", label: "Referência de tools", icon: "table",
        lead: "Tools MCP por finalidade e os comandos de CLI equivalentes.",
        body: <>
            <Table head={["Finalidade", "Tools MCP", "CLI mpm"]} rows={[
                ["Planejar (gate)", <M>create_project, create_board, create_milestone, create_sprint</M>, <M>project/board/milestone/sprint create</M>],
                ["Backlog", <M>create_item, add_to_inbox</M>, <M>epic/feature/task create, inbox add</M>],
                ["Executar", <M>set_item_status, update_item, move_item_to_board, assign_item, block_item, link_item</M>, <M>item set-status/update/move-to-board/assign/block/link</M>],
                ["Interagir", <M>add_comment, list_comments, add_file_attachment, add_link_attachment</M>, <M>comment add/list, attachment add</M>],
                ["Navegar", <M>search_items, list_projects, list_boards, roadmap, list_milestones, list_sprints, report_blocked, report_overdue</M>, <M>item list --text, project list, roadmap, report blocked/overdue</M>],
                ["Acompanhar", <M>list_activity, project_status, get_item, get_project</M>, <M>activity list, report project-status, item show</M>],
                ["Aprovar (humano)", <>— (não é tool do agente)</>, <M>agent creation list/approve/reject</M>]
            ]} />
        </>
    },
    {
        key: "providers", label: "Provedores & modelos", icon: "users",
        lead: "Claude Code, Codex, OpenCode e outros — o que muda entre eles.",
        body: <>
            <p>Todos usam a <b>mesma</b> CLI <M>mpm</M> ou o <b>mesmo</b> servidor MCP — muda só o <M>provider</M> e o <M>model</M>:</p>
            <Table head={["Provedor", "provider", "Exemplo de modelo"]} rows={[
                ["Claude Code", <M>claude</M>, <M>claude-opus-4</M>],
                ["Codex", <M>codex</M>, <M>gpt-5.5</M>],
                ["ChatGPT", <M>chatgpt</M>, <M>gpt-5.5-thinking</M>],
                ["OpenCode / outros", <M>other</M>, <>&lt;modelo em uso&gt;</>]
            ]} />
            <p className="mpm-muted">O usuário-agente é criado na 1ª ação; o modelo é sempre registrado na sessão (rastreio forense).</p>
        </>
    },
    {
        key: "troubleshooting", label: "Solução de problemas", icon: "wrench",
        lead: "As tools/comandos não aparecem ou não conectam? Comece por aqui.",
        body: <>
            <H3>As tools MCP não aparecem no /mcp</H3>
            <ul className="mpm-guide-list">
                <li>O <M>command</M> precisa ser o <b>caminho absoluto</b> do executável (clientes não expandem <M>~</M>).</li>
                <li>O executável precisa existir: rode <M>repo install … --executables meta-project-manager-mcp</M> (e <M>repo update</M> após editar).</li>
                <li>No Claude Code, confira <M>claude mcp get meta-project-manager</M>; lembre do <M>--</M> antes do comando.</li>
                <li>Teste à mão: rodar <M>meta-project-manager-mcp serve</M> no terminal deve <b>ficar aguardando</b> (lendo stdin). <M>Ctrl-D</M> encerra.</li>
            </ul>
            <H3>Erro AGENT_SESSION_CONFIRMATION_REQUIRED</H3>
            <p>Não é um bug — é o <b>gate</b>. Uma criação de estrutura ficou pendente; aprove em <b>Agentes → Pedidos de criação</b> (ou <M>mpm agent creation approve &lt;id&gt;</M>).</p>
            <H3>A CLI mpm não é encontrada</H3>
            <p>Adicione <M>~/EcosystemData/executables</M> ao <M>PATH</M> da sessão, ou use o caminho completo.</p>
            <H3>Editei o código e nada mudou</H3>
            <p>Rode <M>repo update ApplicationsRepository</M> para re-sincronizar o executável instalado, e reinicie a sessão do cliente (o servidor MCP sobe 1 vez por sessão).</p>
        </>
    }
]

const FALLBACK_EXEC_DIR = "/home/SEU_USUARIO/EcosystemData/executables"

const AgentGuidePage = () => {
    const api = useApi()
    const [env, setEnv] = useState<EnvironmentInfo | null>(null)
    useEffect(() => {
        let live = true
        api.system.getEnvironmentInfo().then((e) => { if (live) setEnv(e) }).catch(() => { /* usa fallback */ })
        return () => { live = false }
    }, [api])

    const topics = useMemo(() => buildTopics({
        mcpPath: (env && env.mcpExecutablePath) || `${FALLBACK_EXEC_DIR}/meta-project-manager-mcp`,
        cliPath: (env && env.cliExecutablePath) || `${FALLBACK_EXEC_DIR}/mpm`,
        codexConfigPath: (env && env.codexConfigPath) || "~/.codex/config.toml"
    }), [env])

    const [active, setActive] = useState(topics[0].key)
    const idx = Math.max(0, topics.findIndex((t) => t.key === active))
    const topic = topics[idx]
    const go = (key: string) => { setActive(key); try { window.scrollTo({ top: 0 }) } catch (_) { /* noop */ } }

    return <AppShell active="guide"
        breadcrumb={[{ label: "Guia de IA" }]}
        title="Guia de IA — agentes no gerenciador"
        subtitle={<>Como Claude Code, Codex, OpenCode e outros operam o Meta Project Manager pela CLI <M>mpm</M> ou pelo servidor <M>MCP</M>.</>}>
        <div className="mpm-docs">
            <main className="mpm-docs-main">
                <div className="mpm-docs-topichead">
                    <h2 className="mpm-docs-h2"><Icon name={topic.icon} /> {topic.label}</h2>
                    <p className="mpm-docs-lead">{topic.lead}</p>
                </div>
                <section className="mpm-panel mpm-guide-section">{topic.body}</section>
                <div className="mpm-docs-nav-btns">
                    <button className="mpm-btn" disabled={idx === 0} onClick={() => idx > 0 && go(topics[idx - 1].key)}>
                        <Icon name="arrow left" /> {idx > 0 ? topics[idx - 1].label : ""}
                    </button>
                    <button className="mpm-btn mpm-btn--primary" disabled={idx === topics.length - 1} onClick={() => idx < topics.length - 1 && go(topics[idx + 1].key)}>
                        {idx < topics.length - 1 ? topics[idx + 1].label : ""} <Icon name="arrow right" />
                    </button>
                </div>
            </main>

            <nav className="mpm-docs-nav" aria-label="Tópicos do guia">
                <div className="mpm-docs-nav__title">Tópicos</div>
                {topics.map((t, i) =>
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

export default AgentGuidePage
