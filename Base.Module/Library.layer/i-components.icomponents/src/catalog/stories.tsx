import React from "react"
import { Badge, Button, Stack, Surface } from "../components/Primitives"
import type { StoryCollection } from "./types"

const SurfacePreview = ({ title = "Surface compartilhada" }) =>
    <Surface style={{ padding: 20, maxWidth: 520 }}>
        <Stack>
            <Badge>iComponents</Badge>
            <h3>{title}</h3>
            <p>Tokens, tipografia, bordas e elevação vêm do design system comum.</p>
            <Button>Executar ação</Button>
        </Stack>
    </Surface>

export const commonStories: StoryCollection = {
    id: "application-repository.common",
    title: "Application Repository / Comuns",
    description: "Componentes, tema e contratos usados por todos os WebGui.",
    stories: [
        {
            id: "common.surface",
            title: "Surface e ações",
            group: "Primitives",
            description: "Composição base para painéis, cards e ações de desktop apps.",
            component: SurfacePreview,
            props: { title: "Surface compartilhada" },
            controls: { title: { label: "Título", type: "text" } },
            sourcePackage: "@/i-components.icomponents"
        }
    ]
}
