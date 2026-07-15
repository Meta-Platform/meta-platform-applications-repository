import * as React from "react"
import { useLocation } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useFeedback from "../Hooks/useFeedback"

// Feedback de ESCOPO (de tela): não é sobre um item, e sim sobre um recorte
// inteiro do projeto — o projeto todo, todo o planejamento, todas as ideias, o
// board, a lista ou o backlog. O usuário abre pelo botão "Feedback" no header da
// tela; o agente lê pela fila no MCP filtrando por `scope` (list_feedback).
//
// O `scope` É o `entityType` gravado no feedback: a MESMA string dos dois lados.
// "doc-page" identifica uma PÁGINA de documentação específica (entityId = id da
// página), para o agente filtrar o feedback daquela página no MCP (list_feedback).
export type FeedbackScope = "project" | "planning" | "ideas" | "board" | "list" | "backlog" | "doc-page"

interface PageFeedbackButtonProps {
    scope: FeedbackScope
    projectId?: string
    // A entidade criticada. Nos escopos de projeto (project/board/…) é o próprio
    // projeto (default). Em "doc-page" passe o id da página — é o que permite ao
    // agente pegar "o feedback DESTA página".
    entityId?: string
    // Rótulo humano ("Todo o planejamento"): vira o fieldLabel do feedback, que é
    // o que aparece no balão, na fila (/feedback) e para o agente.
    label: string
    // Só o ícone, para headers já cheios de botões (board/planejamento).
    compact?: boolean
}

// Largura do balão (FeedbackPopover.WIDTH): alinhamos a borda direita ao botão.
const POPOVER_W = 380

const PageFeedbackButton = ({ scope, projectId, entityId, label, compact }: PageFeedbackButtonProps) => {
    const feedback = useFeedback()
    const location = useLocation()
    if (!projectId) return null

    const open = (e: React.MouseEvent) => {
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
        feedback.openAt({
            x: box.right - POPOVER_W,
            y: box.bottom + 6,
            target: {
                entityType: scope,
                entityId: entityId || projectId,
                project: projectId,
                fieldLabel: label
            },
            screen: location.pathname + (location.hash || "")
        })
    }

    return <button className="mpm-btn" onClick={open}
        title={`Enviar feedback para os agentes sobre ${label.toLowerCase()}`}>
        <Icon name="comment alternate outline" />{compact ? null : <span>Feedback</span>}
    </button>
}

export default PageFeedbackButton
