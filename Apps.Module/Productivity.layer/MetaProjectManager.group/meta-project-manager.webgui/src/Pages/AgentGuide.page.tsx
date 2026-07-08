import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import AppShell from "../Components/AppShell"

// Bloco de comando/código com botão "Copiar".
const CodeBlock = ({ children, title }: { children: string; title?: string }) => {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        try {
            navigator.clipboard.writeText(children)
            setCopied(true); setTimeout(() => setCopied(false), 1500)
        } catch (_) { /* ignora */ }
    }
    return <div className="mpm-guide-code">
        <div className="mpm-guide-code__bar">
            <span className="mpm-mono mpm-muted">{title || "shell"}</span>
            <button className="mpm-btn mpm-btn--sm" onClick={copy}>
                <Icon name={copied ? "check" : "copy"} /> {copied ? "Copiado" : "Copiar"}
            </button>
        </div>
        <pre className="mpm-code-block"><code>{children}</code></pre>
    </div>
}

const Section = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) =>
    <section className="mpm-panel mpm-guide-section">
        <h2 className="mpm-guide-h2"><span className="mpm-guide-num">{n}</span> {title}</h2>
        {children}
    </section>

const AGENT_INSTRUCTIONS = `Você tem acesso à CLI "mpm" (Meta Project Manager) para gerenciar este projeto.
Regras:
- Toda ação tem um comando mpm; use SEMPRE --json e leia o envelope { ok, data } / { ok:false, code, message }.
- Identifique-se em TODO comando com: --session-provider <claude|codex|other> --session-model <modelo> --session-trace <id-da-sessão>.
- CRIAR projeto/board/milestone/sprint exige APROVAÇÃO humana: o comando retorna
  code "AGENT_SESSION_CONFIRMATION_REQUIRED" com pendingCreationId. Informe o humano e AGUARDE ele aprovar. NÃO tente burlar.
- Itens (histórias/tarefas/subtarefas/bugs), mudança de status, comentários e anexos são LIVRES.
- Antes de agir numa tarefa, leia: mpm item show <KEY> --json e mpm comment list <KEY> --json (feedback do humano).
- Ao terminar um passo, registre: comente o que fez (mpm comment add) e atualize o status (mpm item set-status).`

const AgentGuidePage = () =>
    <AppShell active="guide">
        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">Guia de IA — agentes no gerenciador</h1>
                <div className="mpm-page-subtitle">Como Claude Code, Codex, OpenCode e outros abrem sessão e operam o Meta Project Manager pela CLI <span className="mpm-mono">mpm</span>.</div>
            </div>
        </div>

        <div className="mpm-guide">
            <div className="mpm-panel mpm-guide-intro">
                <Icon name="magic" />
                <span>Agentes operam o gerenciador pela CLI <b>mpm</b> — a MESMA camada de domínio da interface (nada é exclusivo da tela). A CLI é feita para IA: saída <span className="mpm-mono">--json</span> previsível, não-interativa, e toda mudança fica na auditoria (você acompanha por esta interface: <b>Atividade recente</b>, tela <b>Agentes</b> e o badge de pendências).</span>
            </div>

            <Section n="1" title="Abrir uma sessão (identidade inline)">
                <p>Não há "login": o agente se <b>identifica em cada comando</b> com flags <span className="mpm-mono">--session-*</span>. A CLI captura sozinha host, usuário do SO, PID, diretório e git (repo/branch/commit) e registra a sessão.</p>
                <CodeBlock title="o agente cria/atua já se identificando">{`mpm task create \\
  --project meu-app \\
  --title "Implementar login" \\
  --session-provider claude \\
  --session-model claude-sonnet-4 \\
  --session-trace SESSAO-123 \\
  --json`}</CodeBlock>
                <p className="mpm-muted">Providers aceitos: <span className="mpm-mono">claude</span>, <span className="mpm-mono">codex</span>, <span className="mpm-mono">chatgpt</span>, <span className="mpm-mono">other</span>. O usuário-agente é criado automaticamente na primeira ação — você não precisa cadastrá-lo antes.</p>
            </Section>

            <Section n="2" title="Autorização: criar projeto / board / milestone / sprint">
                <p><b>Criar estrutura</b> (projeto, board, milestone, sprint) por um agente é <b>bloqueado até você aprovar</b>. O comando devolve:</p>
                <CodeBlock title="resposta ao tentar criar">{`{
  "ok": false,
  "code": "AGENT_SESSION_CONFIRMATION_REQUIRED",
  "pendingCreationId": "…",
  "nextCommands": ["mpm agent creation approve <id>", "mpm agent creation reject <id>"]
}`}</CodeBlock>
                <p>Você aprova/rejeita <b>nesta interface</b> (tela <b>Agentes → Pedidos de criação</b>, com todos os detalhes da sessão) ou pela CLI:</p>
                <CodeBlock title="lado humano">{`mpm agent creation list --json
mpm agent creation approve <pendingCreationId> --json   # executa a criação
mpm agent creation reject  <pendingCreationId> --json`}</CodeBlock>
                <p className="mpm-muted">Já <b>itens</b> (histórias/tarefas/subtarefas/bugs), <b>status</b>, <b>comentários</b> e <b>anexos</b> são <b>livres</b> — o agente faz sem pedir aprovação.</p>
            </Section>

            <Section n="3" title="Instruções para colar no agente">
                <p>Cole este bloco nas instruções/regras do seu Claude Code, Codex ou OpenCode para que ele saiba operar o gerenciador:</p>
                <CodeBlock title="instruções do agente">{AGENT_INSTRUCTIONS}</CodeBlock>
            </Section>

            <Section n="4" title="Planejar um board ou projeto inteiro">
                <CodeBlock>{`# 1) estrutura (aguarda sua aprovação)
mpm project create --name "Meu App" --session-provider claude --session-model claude-sonnet-4 --json
mpm board   create --project meu-app --name "Development" --session-provider claude --session-model claude-sonnet-4 --json
mpm milestone create --project meu-app --name "MVP" --target-date 2026-09-01 --session-provider claude --session-model claude-sonnet-4 --json
mpm sprint    create --project meu-app --name "Sprint 1" --session-provider claude --session-model claude-sonnet-4 --json

# 2) backlog e hierarquia (livre): epic -> feature -> story/task -> subtask
mpm epic    create --project meu-app --title "Autenticação" --json
mpm feature create --project meu-app --title "Login por e-mail" --parent MEU-1 --json
mpm task    create --project meu-app --title "Tela de login" --parent MEU-2 --priority high --json

# ideia crua no inbox / triagem depois
mpm inbox add "Suporte a SSO" --project meu-app --json
mpm item set-horizon MEU-3 --horizon next --json`}</CodeBlock>
            </Section>

            <Section n="5" title="Executar: mexer nas tarefas (status, mover, atribuir)">
                <CodeBlock>{`mpm item list --project meu-app --status ready --json
mpm item set-status MEU-42 --status in-progress --actor-session-id <SID> --json
mpm item update     MEU-42 --priority high --progress 40 --json
mpm item move-to-board MEU-42 --board <BOARD_ID> --status review --json
mpm item assign     MEU-42 --user claude-kaio --json
mpm item block      MEU-42 --reason "aguardando API externa" --json`}</CodeBlock>
            </Section>

            <Section n="6" title="Interagir: comentar, ler seu feedback, criar bug, anexar">
                <CodeBlock>{`# ler a tarefa e o SEU feedback antes de agir
mpm item show    MEU-42 --json          # descrição, critérios, checklist, links
mpm comment list MEU-42 --json          # seus comentários / feedback

# comentar o que fez
mpm comment add  MEU-42 --body "Implementado; falta teste." --actor-session-id <SID> --json

# criar bug
mpm item create --project meu-app --type bug --title "Login falha no 2FA" --priority urgent --json

# anexar log / print
mpm attachment add MEU-42 --file ./test-output.log --json`}</CodeBlock>
            </Section>

            <Section n="7" title="Acompanhar o que o agente está fazendo">
                <p>Tudo que o agente faz vira <b>auditoria</b> (com a sessão/agente responsável). Você acompanha:</p>
                <ul className="mpm-guide-list">
                    <li><b>Nesta interface:</b> a aba <b>Atividade recente</b> do projeto (atualiza sozinha), a tela <b>Agentes</b> (sessões + pedidos pendentes) e o <b>badge</b> de pendências.</li>
                    <li><b>Por CLI:</b></li>
                </ul>
                <CodeBlock>{`mpm activity list --project meu-app --limit 50 --json   # quem/qual sessão fez o quê
mpm report project-status --project meu-app --json
mpm agent session list --agent claude-kaio --json`}</CodeBlock>
            </Section>

            <Section n="8" title="Provedores (Claude Code, Codex, OpenCode…)">
                <p>Todos usam a <b>mesma</b> CLI <span className="mpm-mono">mpm</span> — muda só o <span className="mpm-mono">--session-provider</span> e o <span className="mpm-mono">--session-model</span>:</p>
                <ul className="mpm-guide-list">
                    <li><b>Claude Code</b> — rode o <span className="mpm-mono">mpm</span> no terminal da sessão; use <span className="mpm-mono">--session-provider claude --session-model claude-sonnet-4</span>.</li>
                    <li><b>Codex</b> — <span className="mpm-mono">--session-provider codex --session-model gpt-5.5-thinking</span> (ou o modelo em uso).</li>
                    <li><b>OpenCode / outros</b> — <span className="mpm-mono">--session-provider other --session-model &lt;modelo&gt;</span>.</li>
                </ul>
                <p className="mpm-muted">O executável fica em <span className="mpm-mono">~/EcosystemData/executables/mpm</span>. Garanta que ele esteja no <span className="mpm-mono">PATH</span> do ambiente da sessão (ou use o caminho completo). Alias: <span className="mpm-mono">meta-project-manager</span>.</p>
            </Section>

            <Section n="9" title="Referência rápida">
                <div className="mpm-guide-ref">
                    {[
                        ["Planejar", "project/board/milestone/sprint create (aprovação), epic/feature/story/task create, inbox add"],
                        ["Executar", "item set-status, item update, item move-to-board, item assign, item block"],
                        ["Interagir", "comment add/list, item show, item create --type bug, attachment add"],
                        ["Acompanhar", "activity list, report project-status, agent session list"],
                        ["Aprovar (humano)", "agent creation list/approve/reject"]
                    ].map(([k, v]) => <div key={k} className="mpm-guide-ref__row">
                        <span className="mpm-chip mpm-chip--neutral">{k}</span>
                        <span className="mpm-mono mpm-muted">{v}</span>
                    </div>)}
                </div>
            </Section>
        </div>
    </AppShell>

export default AgentGuidePage
