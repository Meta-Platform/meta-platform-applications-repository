import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApprovalQueue from "../Hooks/useApprovalQueue"
import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"

// Navegação GLOBAL (não depende de projeto): rail estreito, só ícones.
// A coluna ao lado (ProjectColumn) é dedicada ao projeto atual.
export const GLOBAL_NAV: { key: string; label: string; icon: any; to: string; hint: string }[] = [
    // A MESA é a primeira entrada e a raiz: quem revisa abre o produto para
    // saber o que espera por ele, não para escolher um projeto.
    { key: "desk",     label: "Mesa",       icon: "inbox",       to: "/",         hint: "O que espera por você: entregas para revisar, agentes travados, aprovações e feedback." },
    { key: "home",     label: "Projetos",   icon: "th large",    to: "/projects", hint: "Todos os projetos — o container de tudo (produto/sistema/iniciativa)." },
    { key: "archive",  label: "Arquivados", icon: "archive",     to: "/archive",  hint: "Projetos arquivados — navegação somente leitura, para consulta." },
    { key: "users",    label: "Usuários",   icon: "users",       to: "/users",    hint: "Pessoas e agentes de IA que colaboram nos projetos." },
    { key: "agents",   label: "Agentes",    icon: "microchip",   to: "/agents",   hint: "Sessões de agentes de IA e pedidos de aprovação pendentes." },
    { key: "feedback", label: "Feedback",   icon: "comment alternate outline", to: "/feedback", hint: "O que você pediu para os agentes corrigirem (botão direito num campo)." },
    { key: "reports",  label: "Métricas",   icon: "chart bar",   to: "/reports",  hint: "Métricas e status: bloqueados, atrasados, por agente/responsável." },
    { key: "audit",    label: "Auditoria",  icon: "history",     to: "/audit",    hint: "O que agentes e humanos fizeram: quem, quando, com qual modelo." },
    { key: "guide",    label: "Guia IA",    icon: "book",        to: "/guide",    hint: "Como conectar Claude Code / Codex por CLI e MCP." },
    { key: "glossary", label: "Manual",     icon: "help circle", to: "/glossary", hint: "Glossário e manual: o que é cada objeto e como usar." }
]

const NavRail = ({ active }: { active: string }) => {
    const navigate = useNavigate()
    const api = useApi()
    const { all } = useApprovalQueue()
    const pendingCreations = all.length

    // O QUE ESPERA POR VOCÊ, no ícone da Mesa.
    //
    // Vem do MESMO endpoint que a Mesa desenha, e não de uma contagem própria:
    // um badge que discorda da tela que ele aponta é pior que badge nenhum —
    // quem abre a Mesa e encontra menos do que o número prometia para de
    // confiar nos dois. Por isso o total é somado do `counts` da própria Mesa.
    const [pendingDecisions, setPendingDecisions] = useState(0)
    const loadDesk = useCallback(() => {
        api.reviews.desk()
            .then((d) => {
                const c = d && d.counts
                setPendingDecisions(c
                    ? c.deliveries + c.approvals + c.feedback + c.blocked + c.exhaustedMandates + (c.plans || 0)
                    : 0)
            })
            .catch(() => setPendingDecisions(0))
    }, [api])
    useEffect(() => { loadDesk() }, [loadDesk])
    useLiveReload(loadDesk, { always: true })

    // Feedbacks esperando um agente: o mesmo destaque dos pedidos de aprovação.
    const [openFeedback, setOpenFeedback] = useState(0)
    const loadFeedback = useCallback(() => {
        api.feedback.list({ status: "open", limit: "200" })
            .then((l) => setOpenFeedback((l || []).length))
            .catch(() => setOpenFeedback(0))
    }, [api])
    useEffect(() => { loadFeedback() }, [loadFeedback])
    useLiveReload(loadFeedback, { always: true })

    return <nav className="mpm-rail" aria-label="Navegação do sistema">
        {GLOBAL_NAV.map((n) =>
            <a key={n.key}
                className={`mpm-rail__item ${active === n.key ? "is-active" : ""}`}
                title={`${n.label} — ${n.hint}`}
                onClick={() => navigate(n.to)}>
                <Icon name={n.icon} />
                <span className="mpm-rail__label">{n.label}</span>
                {n.key === "desk" && pendingDecisions > 0
                    ? <span className="mpm-rail__badge" title="decisões esperando por você">{pendingDecisions}</span>
                    : null}
                {n.key === "agents" && pendingCreations > 0
                    ? <span className="mpm-rail__badge" title="pedidos pendentes">{pendingCreations}</span>
                    : null}
                {n.key === "feedback" && openFeedback > 0
                    ? <span className="mpm-rail__badge" title="feedbacks esperando um agente">{openFeedback}</span>
                    : null}
            </a>)}
    </nav>
}

export default NavRail
