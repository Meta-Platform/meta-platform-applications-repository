import * as React from "react"
import { useState } from "react"
import { Surface, Stack, Badge } from "../components/Primitives"
import Icon from "../components/Icon"
import { Button, IconButton, ButtonGroup, Toolbar } from "../components/Controls"
import { FormField, TextInput, TextArea, SelectInput, CheckboxInput, RadioInput, SearchInput } from "../components/Inputs"
import {
    Spinner, LoadingOverlay, ProgressBar, Banner, EmptyState, Skeleton, SkeletonList, ToastStack
} from "../components/Feedback"
import { Dialog, ConfirmDialog, Drawer, Tooltip, Menu, ContextMenu, Popover } from "../components/Overlays"
import {
    Panel, ListRow, DataTable, TreeRow, ObjectCard, Tile, TileRow, KeyValueList, Tabs, CodeBlock
} from "../components/DataDisplay"
import { PageMasthead, EntityHeader, StatusStrip, StatusChip, SystemBanner } from "../components/Headers"
import StatusBadge from "../components/StatusBadge"
import CopyableMonoText from "../components/CopyableMonoText"
import { THEMES } from "../theme"
import type { ComponentStory, StoryCollection } from "./types"

// Histórias do kit comum. Regra que mantém o catálogo completo: cada
// componente exportado por @i-components tem EXATAMENTE uma história aqui —
// promoveu componente para o kit, escreveu a história.

const SOURCE = "@/i-components.icomponents"

const Story = (story: Omit<ComponentStory, "sourcePackage">): ComponentStory => ({
    sourcePackage: SOURCE,
    importFrom: "@i-components",
    status: "stable",
    ...story
})

/* ------------------------------------------------------------------ */
/* Fundamentos                                                        */
/* ------------------------------------------------------------------ */

const TOKEN_GROUPS = [
    {
        title: "Superfícies e papel",
        tokens: [ "--mp-paper", "--mp-paper-2", "--mp-paper-3", "--mp-surface", "--mp-surface-2", "--mp-surface-muted" ]
    },
    {
        title: "Tinta e texto",
        tokens: [ "--mp-ink", "--mp-ink-2", "--mp-ink-3", "--mp-muted", "--mp-muted-2" ]
    },
    {
        title: "Acentos",
        tokens: [ "--mp-accent-yellow", "--mp-accent-blue", "--mp-accent-cyan", "--mp-accent-orange", "--mp-accent-violet", "--mp-accent-pink" ]
    },
    {
        title: "Estado",
        tokens: [ "--mp-success", "--mp-warning", "--mp-danger", "--mp-info", "--mp-neutral" ]
    }
]

const TokenPalette = () =>
    <Stack>
        { TOKEN_GROUPS.map((group) =>
            <div key={group.title}>
                <div className="mp-kv__label" style={{ marginBottom: 6 }}>{group.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    { group.tokens.map((token) =>
                        <div key={token} style={{ width: 132 }}>
                            <div style={{
                                height: 40,
                                background: `var(${token})`,
                                border: "var(--mp-border)",
                                borderRadius: "var(--mp-radius-sm)"
                            }}/>
                            <code style={{ fontSize: 10, color: "var(--mp-muted)" }}>{token}</code>
                        </div>) }
                </div>
            </div>) }
    </Stack>

const TypeScale = () =>
    <Stack>
        { [
            [ "--mp-text-3xl", "Título de aplicação" ],
            [ "--mp-text-2xl", "Título de página" ],
            [ "--mp-text-xl",  "Título de entidade" ],
            [ "--mp-text-lg",  "Título de diálogo" ],
            [ "--mp-text-md",  "Corpo destacado" ],
            [ "--mp-text-sm",  "Corpo padrão da interface" ],
            [ "--mp-text-xs",  "Metadado técnico / rótulo" ]
        ].map(([ token, sample ]) =>
            <div key={token} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <code style={{ width: 120, fontSize: 11, color: "var(--mp-muted)" }}>{token}</code>
                <span style={{ fontSize: `var(${token})`, fontFamily: "var(--mp-font-display)", fontWeight: 700 }}>{sample}</span>
            </div>) }
    </Stack>

const ThemeGallery = () =>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        { THEMES.map((theme) =>
            <Surface key={theme.key} style={{ padding: 14, minWidth: 190 }}>
                <Stack>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name={theme.icon}/>
                        <strong>{theme.label}</strong>
                    </div>
                    <code style={{ fontSize: 11, color: "var(--mp-muted)" }}>data-theme="{theme.key}"</code>
                </Stack>
            </Surface>) }
    </div>

/* ------------------------------------------------------------------ */
/* Previews com estado                                                */
/* ------------------------------------------------------------------ */

const DialogPreview = ({ title = "Instalar aplicativo", size = "md" }: any) => {
    const [ open, setOpen ] = useState(false)
    return <>
        <Button variant="primary" icon="window maximize" onClick={() => setOpen(true)}>Abrir diálogo</Button>
        <Dialog
            open={open}
            size={size}
            icon="download"
            title={title}
            subtitle="ui-catalog-desktop · PlatformApplicationsRepo"
            onClose={() => setOpen(false)}
            actions={<>
                <Button onClick={() => setOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={() => setOpen(false)}>Instalar</Button>
            </>}>
            <Stack>
                <p style={{ margin: 0 }}>O executável será criado e registrado no repositório instalado.</p>
                <KeyValueList
                    columns={2}
                    items={[
                        { label: "Executável", value: "ui-catalog-desktop", mono: true },
                        { label: "Tipo", value: "DESKTOP" }
                    ]}/>
            </Stack>
        </Dialog>
    </>
}

const ConfirmPreview = ({ danger = true }: any) => {
    const [ open, setOpen ] = useState(false)
    return <>
        <Button variant={danger ? "danger" : "default"} icon="trash" onClick={() => setOpen(true)}>Desinstalar…</Button>
        <ConfirmDialog
            open={open}
            danger={danger}
            title="Desinstalar aplicativo"
            message="O executável será removido e o aplicativo sai da lista do my-desktop. O pacote continua no repositório."
            confirmLabel="Desinstalar"
            onCancel={() => setOpen(false)}
            onConfirm={() => setOpen(false)}/>
    </>
}

const DrawerPreview = () => {
    const [ open, setOpen ] = useState(false)
    return <>
        <Button icon="columns" onClick={() => setOpen(true)}>Abrir gaveta</Button>
        <Drawer
            open={open}
            title="Inspetor de instância"
            onClose={() => setOpen(false)}
            actions={<Button variant="primary" onClick={() => setOpen(false)}>Fechar</Button>}>
            <KeyValueList items={[
                { label: "instanceId", value: "9f31c2…a04", mono: true },
                { label: "Status", value: <StatusBadge status="ACTIVE"/> },
                { label: "Pacote", value: "@/ui-catalog.desktopapp", mono: true }
            ]}/>
        </Drawer>
    </>
}

const MenuPreview = () =>
    <Menu items={[
        { key: "open", label: "Abrir", icon: "external" },
        { key: "shortcut", label: "Criar atalho na área de trabalho", icon: "plus" },
        { key: "sep", separator: true },
        { key: "stop", label: "Encerrar instância", icon: "stop", danger: true }
    ]}/>

const ContextMenuPreview = () => {
    const [ point, setPoint ] = useState<{ x: number, y: number }>()
    return <>
        <Surface
            style={{ padding: 24, textAlign: "center", cursor: "context-menu" }}
            onContextMenu={(event: any) => { event.preventDefault(); setPoint({ x: event.clientX, y: event.clientY }) }}>
            Clique com o botão direito nesta área
        </Surface>
        { point && <ContextMenu
            x={point.x}
            y={point.y}
            onClose={() => setPoint(undefined)}
            items={[
                { key: "reload", label: "Recarregar ícones", icon: "refresh" },
                { key: "theme", label: "Tema", icon: "paint brush" }
            ]}/> }
    </>
}

const PopoverPreview = () => {
    const [ open, setOpen ] = useState(false)
    return <Popover
        open={open}
        onClose={() => setOpen(false)}
        align="left"
        trigger={<Button icon="th" trailingIcon="chevron down" onClick={() => setOpen(!open)}>10 apps</Button>}>
        <Stack>
            { [ "Ui Catalog", "Launcher", "Package Developer" ].map((name) =>
                <ListRow key={name} icon="cube" title={name} onClick={() => setOpen(false)}/>) }
        </Stack>
    </Popover>
}

const ToastPreviewStack = () => {
    const [ toasts, setToasts ] = useState([
        { id: "1", tone: "info" as const, title: "Lançando aplicativo", message: "ui-catalog-desktop", spinner: true },
        { id: "2", tone: "success" as const, title: "Aplicativo aberto", message: "Instância registrada no monitor" }
    ])
    return <Stack>
        <Button icon="undo" onClick={() => setToasts([
            { id: "1", tone: "info", title: "Lançando aplicativo", message: "ui-catalog-desktop", spinner: true },
            { id: "2", tone: "success", title: "Aplicativo aberto", message: "Instância registrada no monitor" }
        ])}>Repor avisos</Button>
        <ToastStack
            position="bottom-center"
            toasts={toasts}
            onDismiss={(id) => setToasts(toasts.filter((toast) => toast.id !== id))}/>
    </Stack>
}

const SearchPreview = ({ placeholder = "Buscar componente…" }: any) => {
    const [ value, setValue ] = useState("")
    return <div style={{ maxWidth: 320 }}>
        <SearchInput value={value} onValueChange={setValue} placeholder={placeholder}/>
    </div>
}

const TabsPreview = () => {
    const [ active, setActive ] = useState("componentes")
    return <Tabs
        activeKey={active}
        onChange={setActive}
        tabs={[
            { key: "componentes", label: "Componentes", icon: "cubes", count: 46 },
            { key: "tokens", label: "Fundamentos", icon: "paint brush" },
            { key: "apps", label: "Aplicativos", icon: "th", count: 10 },
            { key: "obsoleto", label: "Descontinuado", disabled: true }
        ]}/>
}

const TreePreview = () => {
    const [ expanded, setExpanded ] = useState<string[]>([ "Apps.Module" ])
    const [ selected, setSelected ] = useState("ui-catalog.webgui")
    const Toggle = (key: string) => setExpanded(expanded.includes(key)
        ? expanded.filter((item) => item !== key)
        : [ ...expanded, key ])
    return <Surface style={{ padding: 8 }}>
        <TreeRow
            label="Apps.Module"
            icon="folder"
            hasChildren
            expanded={expanded.includes("Apps.Module")}
            onToggle={() => Toggle("Apps.Module")}/>
        { expanded.includes("Apps.Module") && <>
            <TreeRow label="Tools.layer" icon="folder open" depth={1} hasChildren expanded onToggle={() => {}}/>
            <TreeRow
                label="ui-catalog.webgui"
                icon="file code"
                depth={2}
                meta=".webgui"
                selected={selected === "ui-catalog.webgui"}
                onSelect={() => setSelected("ui-catalog.webgui")}/>
            <TreeRow
                label="ui-catalog.desktopapp"
                icon="desktop"
                depth={2}
                dirty
                meta="não commitado"
                selected={selected === "ui-catalog.desktopapp"}
                onSelect={() => setSelected("ui-catalog.desktopapp")}/>
        </> }
    </Surface>
}

const LoadingOverlayPreview = ({ percentage = 64 }: any) =>
    <div style={{ position: "relative", minHeight: 180 }}>
        <SkeletonList rows={3}/>
        <LoadingOverlay message="Construindo a interface…" percentage={Number(percentage)}/>
    </div>

const INSTANCE_ROWS = [
    { instance: "9f31c2a0", app: "ui-catalog-desktop", status: "ACTIVE", started: "19:05" },
    { instance: "4ab7e910", app: "launcher-desktop", status: "FINISHED", started: "18:42" },
    { instance: "77c0d331", app: "meta-project-manager", status: "FAILURE", started: "18:10" }
]

const TablePreview = ({ dense = false }: any) => {
    const [ selected, setSelected ] = useState<string>()
    return <DataTable
        dense={dense}
        rows={INSTANCE_ROWS}
        rowKey={(row: any) => row.instance}
        selectedKey={selected}
        onRowClick={(row: any) => setSelected(row.instance)}
        columns={[
            { key: "instance", header: "Instância", mono: true, width: 130 },
            { key: "app", header: "Aplicativo" },
            {
                key: "status",
                header: "Status",
                render: (row: any) =>
                    <StatusBadge status={row.status} reason={row.status === "FAILURE" ? "porta 8085 ocupada" : undefined}/>
            },
            { key: "started", header: "Início", align: "right", mono: true, width: 90 }
        ]}/>
}

const ListRowPreview = () => {
    const [ selected, setSelected ] = useState("b")
    return <Surface style={{ padding: 8 }}>
        { [ [ "a", "EssentialRepo" ], [ "b", "PlatformApplicationsRepo" ], [ "c", "EngineeringToolsRepo" ] ].map(([ key, title ]) =>
            <ListRow
                key={key}
                icon="database"
                title={title}
                meta="LOCAL_FS · ~/Workspaces/meta-platform-repo"
                selected={selected === key}
                right={<Icon name="chevron right" tone="muted"/>}
                onClick={() => setSelected(key)}/>) }
    </Surface>
}

const StatusStripPreview = () => {
    const [ active, setActive ] = useState("ativas")
    return <StatusStrip right={<Button size="sm" variant="subtle" icon="filter">Limpar</Button>}>
        { [
            { key: "ativas", icon: "check circle", tone: "success", label: "ativas", count: 3 },
            { key: "encerradas", icon: "ban", tone: "neutral", label: "encerradas", count: 12 },
            { key: "falhas", icon: "times circle", tone: "danger", label: "falhas", count: 1 }
        ].map((chip) =>
            <StatusChip
                key={chip.key}
                icon={chip.icon}
                tone={chip.tone}
                label={chip.label}
                count={chip.count}
                active={active === chip.key}
                onClick={() => setActive(chip.key)}/>) }
    </StatusStrip>
}

const ShellPreview = () => {
    const [ section, setSection ] = useState("componentes")
    return <div style={{ height: 320, border: "var(--mp-border)", borderRadius: "var(--mp-radius-md)", overflow: "hidden" }}>
        <div className="mp-shell has-sidebar" style={{ height: "100%" }}>
            <div className="mp-shell__topbar">
                <div className="mp-topbar">
                    <div className="mp-topbar__brand">
                        <span className="mp-topbar__mark"/>
                        <span className="mp-topbar__name">UI Catalog</span>
                        <span className="mp-topbar__subtitle">Application Repository</span>
                    </div>
                    <div className="mp-topbar__center"><SearchInput value="" onValueChange={() => {}}/></div>
                    <div className="mp-topbar__right"><IconButton icon="paint brush" label="tema"/></div>
                </div>
            </div>
            <div className="mp-shell__sidebar">
                <nav className="mp-navrail">
                    <div className="mp-navrail__items">
                        { [
                            { key: "componentes", label: "Componentes", icon: "cubes", count: 46 },
                            { key: "tokens", label: "Fundamentos", icon: "paint brush" },
                            { key: "apps", label: "Aplicativos", icon: "th", count: 10 }
                        ].map((item) =>
                            <button
                                type="button"
                                key={item.key}
                                className={`mp-navrail__item ${item.key === section ? "is-active" : ""}`}
                                onClick={() => setSection(item.key)}>
                                <Icon name={item.icon} className="mp-navrail__icon"/>
                                <span className="mp-navrail__label">{item.label}</span>
                                { item.count !== undefined && <span className="mp-navrail__count">{item.count}</span> }
                            </button>) }
                    </div>
                </nav>
            </div>
            <main className="mp-shell__content" style={{ padding: 16 }}>
                <KeyValueList items={[
                    { label: "Seção", value: section },
                    { label: "Shell", value: "AppShell + Topbar + NavRail", mono: true }
                ]}/>
            </main>
        </div>
    </div>
}

/* ------------------------------------------------------------------ */
/* Coleção                                                            */
/* ------------------------------------------------------------------ */

export const commonStories: StoryCollection = {
    id: "application-repository.common",
    title: "Kit comum · @i-components",
    description: "Primitivas, controles, padrões de dados e shell usados por TODOS os aplicativos do Application Repository.",
    kind: "kit",
    sourcePackage: SOURCE,
    importFrom: "@i-components",
    stories: [

        /* --- Fundamentos --- */
        Story({
            id: "foundation.tokens",
            title: "Tokens de cor",
            group: "Fundamentos",
            description: "Paleta do design system em variáveis CSS --mp-*. Componente nenhum usa cor literal: sempre o token.",
            component: TokenPalette,
            usage: "background: var(--mp-surface);\nborder: var(--mp-border);\ncolor: var(--mp-ink);",
            tags: [ "tema", "cor" ]
        }),
        Story({
            id: "foundation.type",
            title: "Escala tipográfica",
            group: "Fundamentos",
            description: "Sete degraus de texto (--mp-text-*) e três famílias: display, ui e mono.",
            component: TypeScale,
            usage: "font-family: var(--mp-font-display);\nfont-size: var(--mp-text-xl);",
            tags: [ "tipografia" ]
        }),
        Story({
            id: "foundation.themes",
            title: "Temas",
            group: "Fundamentos",
            description: "Cinco temas aplicados por data-theme no <html>. O padrão corporativo é grayscale.",
            component: ThemeGallery,
            usage: "import { ApplyTheme, applySavedTheme } from \"@i-components\"\n\napplySavedTheme()      // no boot, antes do render\nApplyTheme(\"dark\")     // troca explícita",
            tags: [ "tema" ]
        }),

        /* --- Primitivas --- */
        Story({
            id: "primitive.surface",
            title: "Surface",
            group: "Primitivas",
            description: "Bloco de conteúdo elevado: papel, borda dura e sombra deslocada do retro-brutalist.",
            component: ({ children = "Surface compartilhada" }: any) =>
                <Surface style={{ padding: 20, maxWidth: 520 }}>
                    <Stack>
                        <Badge>iComponents</Badge>
                        <h3 style={{ margin: 0 }}>{children}</h3>
                        <p style={{ margin: 0, color: "var(--mp-muted)" }}>
                            Tokens, tipografia, bordas e elevação vêm do design system comum.
                        </p>
                        <Button variant="primary">Executar ação</Button>
                    </Stack>
                </Surface>,
            props: { children: "Surface compartilhada" },
            controls: { children: { label: "Título", type: "text" } },
            exportName: "Surface",
            usage: "import { Surface, Stack } from \"@i-components\"\n\n<Surface style={{ padding: 20 }}>\n    <Stack>…</Stack>\n</Surface>",
            propsDoc: [
                { name: "className", type: "string", description: "Classes extras (o kit já aplica .mp-surface)." },
                { name: "...props", type: "HTMLAttributes<HTMLDivElement>", description: "Repassado para o <div>." }
            ]
        }),
        Story({
            id: "primitive.stack",
            title: "Stack",
            group: "Primitivas",
            description: "Empilhamento vertical com espaçamento do token --mp-space-3.",
            component: () =>
                <Stack>
                    <Surface style={{ padding: 10 }}>primeiro</Surface>
                    <Surface style={{ padding: 10 }}>segundo</Surface>
                    <Surface style={{ padding: 10 }}>terceiro</Surface>
                </Stack>,
            exportName: "Stack",
            usage: "<Stack>\n    <Row/>\n    <Row/>\n</Stack>"
        }),
        Story({
            id: "primitive.icon",
            title: "Icon",
            group: "Primitivas",
            description: "Ícone canônico. Encapsula o Semantic corrigindo margem e cor por token — é o componente mais usado da plataforma (151 chamadas antes da padronização).",
            component: ({ name = "cube", tone = "inherit" }: any) =>
                <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 22 }}>
                    <Icon name={name} tone={tone}/>
                    { [ "neutral", "muted", "success", "warning", "danger", "info" ].map((itemTone) =>
                        <Icon key={itemTone} name={name} tone={itemTone as any}/>) }
                </div>,
            props: { name: "cube", tone: "inherit" },
            controls: {
                name: { label: "Ícone", type: "text" },
                tone: { label: "Tom", type: "select", options: [ "inherit", "neutral", "muted", "success", "warning", "danger", "info" ] }
            },
            exportName: "Icon",
            usage: "import { Icon } from \"@i-components\"\n\n<Icon name=\"check circle\" tone=\"success\"/>",
            propsDoc: [
                { name: "name", type: "string", required: true, description: "Nome do ícone (conjunto Semantic/FA4)." },
                { name: "tone", type: "IconTone", default: "\"inherit\"", description: "neutral | muted | success | warning | danger | info | inherit." },
                { name: "spaced", type: "boolean", default: "false", description: "Mantém a margem lateral original (texto corrido)." },
                { name: "size", type: "string", description: "mini | tiny | small | large | big | huge." }
            ]
        }),
        Story({
            id: "primitive.button",
            title: "Button",
            group: "Primitivas",
            description: "Ação. Cinco variantes cobrem toda a hierarquia de ênfase da plataforma.",
            component: ({ variant = "primary", size = "md", icon = "play", children = "Executar", loading = false, disabled = false }: any) =>
                <Stack>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button variant={variant} size={size} icon={icon} loading={loading} disabled={disabled}>{children}</Button>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button variant="primary" icon="play">Primary</Button>
                        <Button variant="default" icon="refresh">Default</Button>
                        <Button variant="subtle" icon="cog">Subtle</Button>
                        <Button variant="danger" icon="trash">Danger</Button>
                        <Button variant="ghost" icon="ellipsis horizontal">Ghost</Button>
                    </div>
                </Stack>,
            props: { variant: "primary", size: "md", icon: "play", children: "Executar" },
            controls: {
                children: { label: "Rótulo", type: "text" },
                variant: { label: "Variante", type: "select", options: [ "primary", "default", "subtle", "danger", "ghost" ] },
                size: { label: "Tamanho", type: "select", options: [ "sm", "md", "lg" ] },
                icon: { label: "Ícone", type: "text" },
                loading: { label: "Carregando", type: "boolean" },
                disabled: { label: "Desabilitado", type: "boolean" }
            },
            exportName: "Button",
            usage: "import { Button } from \"@i-components\"\n\n<Button variant=\"primary\" icon=\"play\" onClick={Run}>\n    Executar\n</Button>",
            propsDoc: [
                { name: "variant", type: "ButtonVariant", default: "\"default\"", description: "primary | default | subtle | danger | ghost." },
                { name: "size", type: "ButtonSize", default: "\"md\"", description: "sm | md | lg." },
                { name: "icon", type: "string", description: "Ícone à esquerda do rótulo." },
                { name: "trailingIcon", type: "string", description: "Ícone à direita (menus, expansão)." },
                { name: "loading", type: "boolean", default: "false", description: "Troca o ícone por girador e desabilita." },
                { name: "block", type: "boolean", default: "false", description: "Ocupa a largura total." }
            ],
            variants: [
                { label: "Primary", props: { variant: "primary" }, description: "Ação principal da tela." },
                { label: "Danger", props: { variant: "danger", icon: "trash", children: "Excluir" }, description: "Ação destrutiva." },
                { label: "Subtle", props: { variant: "subtle", icon: "cog", children: "Opções" }, description: "Baixa ênfase." }
            ]
        }),
        Story({
            id: "primitive.iconbutton",
            title: "IconButton",
            group: "Primitivas",
            description: "Ação só-ícone com rótulo acessível obrigatório.",
            component: () =>
                <ButtonGroup>
                    <IconButton icon="play" label="iniciar"/>
                    <IconButton icon="pause" label="pausar"/>
                    <IconButton icon="stop" label="encerrar" variant="danger"/>
                </ButtonGroup>,
            exportName: "IconButton",
            usage: "<IconButton icon=\"stop\" label=\"encerrar\" variant=\"danger\" onClick={Stop}/>",
            propsDoc: [
                { name: "icon", type: "string", required: true },
                { name: "label", type: "string", required: true, description: "Vira aria-label e title — o botão não tem texto visível." }
            ]
        }),
        Story({
            id: "primitive.toolbar",
            title: "Toolbar",
            group: "Primitivas",
            description: "Faixa de controles com separador e empurrão à direita.",
            component: () =>
                <Toolbar>
                    <Button size="sm" icon="refresh">Atualizar</Button>
                    <Toolbar.Separator/>
                    <Button size="sm" variant="subtle" icon="filter">Filtros</Button>
                    <Toolbar.Spacer/>
                    <StatusChip icon="cube" label="pacotes" count={113}/>
                </Toolbar>,
            exportName: "Toolbar",
            usage: "<Toolbar>\n    <Button size=\"sm\" icon=\"refresh\">Atualizar</Button>\n    <Toolbar.Spacer/>\n    <StatusChip label=\"itens\" count={12}/>\n</Toolbar>"
        }),

        /* --- Formulários --- */
        Story({
            id: "form.field",
            title: "FormField",
            group: "Formulários",
            description: "Invólucro de rótulo, dica e erro. Todo campo do kit entra aqui.",
            component: ({ label = "Nome do executável", error = "", hint = "Minúsculas e hífens." }: any) =>
                <div style={{ maxWidth: 340 }}>
                    <FormField label={label} hint={hint} error={error} required>
                        <TextInput placeholder="ui-catalog-desktop" invalid={Boolean(error)}/>
                    </FormField>
                </div>,
            props: { label: "Nome do executável", hint: "Minúsculas e hífens.", error: "" },
            controls: {
                label: { label: "Rótulo", type: "text" },
                hint: { label: "Dica", type: "text" },
                error: { label: "Erro", type: "text" }
            },
            exportName: "FormField",
            usage: "<FormField label=\"Nome\" error={error} required>\n    <TextInput value={name} onChange={OnChange}/>\n</FormField>",
            propsDoc: [
                { name: "label", type: "string" },
                { name: "hint", type: "string", description: "Texto auxiliar (suprimido quando há erro)." },
                { name: "error", type: "string", description: "Mensagem de erro com role=alert." },
                { name: "required", type: "boolean" }
            ]
        }),
        Story({
            id: "form.text",
            title: "TextInput e TextArea",
            group: "Formulários",
            description: "Entrada de texto de uma linha e de bloco (mono, redimensionável).",
            component: () =>
                <Stack>
                    <TextInput placeholder="serverName"/>
                    <TextInput placeholder="desabilitado" disabled/>
                    <TextInput placeholder="inválido" invalid/>
                    <TextArea placeholder={"{\n    \"serverName\": \"UICatalogDesktopInstance\"\n}"}/>
                </Stack>,
            exportName: "TextInput",
            usage: "<TextInput value={value} onChange={(e) => Set(e.target.value)} placeholder=\"serverName\"/>"
        }),
        Story({
            id: "form.select",
            title: "SelectInput",
            group: "Formulários",
            description: "Seleção dirigida por dados: options é [{ value, label }], não uma árvore de itens.",
            component: () =>
                <div style={{ maxWidth: 300 }}>
                    <SelectInput
                        placeholder="Escolha o tipo…"
                        options={[
                            { value: "DESKTOP", label: "DESKTOP — janela Electron" },
                            { value: "APP", label: "APP — serviço web" },
                            { value: "CLI", label: "CLI — linha de comando" }
                        ]}/>
                </div>,
            exportName: "SelectInput",
            usage: "<SelectInput\n    value={appType}\n    onChange={(e) => Set(e.target.value)}\n    options={[{ value: \"DESKTOP\", label: \"Desktop\" }]}/>",
            propsDoc: [
                { name: "options", type: "SelectOption[]", required: true, description: "[{ value, label, disabled }]." },
                { name: "placeholder", type: "string", description: "Vira a opção vazia." }
            ]
        }),
        Story({
            id: "form.toggles",
            title: "CheckboxInput e RadioInput",
            group: "Formulários",
            description: "Marcações com caixa desenhada por token.",
            component: () =>
                <Stack>
                    <CheckboxInput label="Instalar também o executável de debug" defaultChecked/>
                    <CheckboxInput label="Abrir depois de instalar"/>
                    <div style={{ display: "flex", gap: 18 }}>
                        <RadioInput name="onda" label="Onda 1" defaultChecked/>
                        <RadioInput name="onda" label="Onda 2"/>
                        <RadioInput name="onda" label="Onda 3"/>
                    </div>
                </Stack>,
            exportName: "CheckboxInput",
            usage: "<CheckboxInput label=\"Abrir depois\" checked={open} onChange={Toggle}/>"
        }),
        Story({
            id: "form.search",
            title: "SearchInput",
            group: "Formulários",
            description: "Busca com ícone e botão de limpar — o padrão que cada aplicativo reimplementava.",
            component: SearchPreview,
            props: { placeholder: "Buscar componente…" },
            controls: { placeholder: { label: "Placeholder", type: "text" } },
            exportName: "SearchInput",
            usage: "<SearchInput value={query} onValueChange={setQuery}/>",
            propsDoc: [
                { name: "value", type: "string", required: true },
                { name: "onValueChange", type: "(value: string) => void", required: true, description: "Recebe o texto direto (não o evento)." }
            ]
        }),

        /* --- Feedback --- */
        Story({
            id: "feedback.spinner",
            title: "Spinner",
            group: "Feedback",
            description: "Girador inline com rótulo para leitores de tela.",
            component: () =>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <Spinner size="sm"/><Spinner/><Spinner size="lg"/>
                </div>,
            exportName: "Spinner",
            usage: "{ isLoading && <Spinner label=\"Carregando pacotes…\"/> }"
        }),
        Story({
            id: "feedback.overlay",
            title: "LoadingOverlay",
            group: "Feedback",
            description: "Cobre uma região enquanto ela carrega, com progresso determinístico opcional. Substitui Dimmer+Loader.",
            component: LoadingOverlayPreview,
            props: { percentage: 64 },
            controls: { percentage: { label: "Progresso", type: "number", min: 0, max: 100 } },
            exportName: "LoadingOverlay",
            usage: "<div style={{ position: \"relative\" }}>\n    {content}\n    { building && <LoadingOverlay message=\"Construindo…\" percentage={pct}/> }\n</div>"
        }),
        Story({
            id: "feedback.progress",
            title: "ProgressBar",
            group: "Feedback",
            description: "Barra determinística — build de WebGui, ingestão, instalação.",
            component: () =>
                <Stack>
                    <ProgressBar label="Construindo a interface" percentage={64}/>
                    <ProgressBar label="Concluído" percentage={100} tone="success"/>
                    <ProgressBar label="Falhou em 38%" percentage={38} tone="danger"/>
                </Stack>,
            exportName: "ProgressBar",
            usage: "<ProgressBar label=\"Construindo\" percentage={percentage}/>"
        }),
        Story({
            id: "feedback.banner",
            title: "Banner",
            group: "Feedback",
            description: "Mensagem em bloco nos quatro tons. Substitui <Message> do Semantic.",
            component: ({ tone = "info", title = "Instância encerrada sem motivo registrado" }: any) =>
                <Stack>
                    <Banner tone={tone} title={title}>
                        O daemon não persistiu o motivo do término; verifique o log da instância.
                    </Banner>
                    <Banner tone="success" title="Aplicativo instalado">ui-catalog-desktop foi registrado.</Banner>
                    <Banner tone="warning" title="Repositório fora de sincronia">Rode repo update.</Banner>
                    <Banner tone="danger" title="Porta ocupada">8085 já está em uso.</Banner>
                </Stack>,
            props: { tone: "info", title: "Instância encerrada sem motivo registrado" },
            controls: {
                tone: { label: "Tom", type: "select", options: [ "info", "success", "warning", "danger", "neutral" ] },
                title: { label: "Título", type: "text" }
            },
            exportName: "Banner",
            usage: "<Banner tone=\"danger\" title=\"Porta ocupada\">8085 já está em uso.</Banner>"
        }),
        Story({
            id: "feedback.empty",
            title: "EmptyState",
            group: "Feedback",
            description: "Estado vazio canônico: ícone, frase curta e ação de saída.",
            component: () =>
                <EmptyState
                    icon="cubes"
                    title="Nenhum componente encontrado"
                    message="Nenhuma história corresponde à busca. Limpe o filtro ou promova o componente para o kit."
                    actions={<Button variant="primary" icon="plus">Promover componente</Button>}/>,
            exportName: "EmptyState",
            usage: "<EmptyState icon=\"inbox\" title=\"Sem instâncias\" message=\"Lance um pacote pelo Launcher.\"/>"
        }),
        Story({
            id: "feedback.skeleton",
            title: "Skeleton e SkeletonList",
            group: "Feedback",
            description: "Blocos de carregamento no estilo do sistema (sem girador na tela toda).",
            component: () =>
                <Stack>
                    <SkeletonList rows={3}/>
                    <div style={{ display: "flex", gap: 8 }}>
                        <Skeleton variant="icon"/><Skeleton width={180}/><Skeleton variant="chip"/>
                    </div>
                </Stack>,
            exportName: "SkeletonList",
            usage: "{ isLoading ? <SkeletonList rows={5}/> : <List items={items}/> }"
        }),
        Story({
            id: "feedback.toasts",
            title: "ToastStack",
            group: "Feedback",
            description: "Pilha de avisos temporários. A vida do toast é do aplicativo; aqui só a apresentação.",
            component: ToastPreviewStack,
            exportName: "ToastStack",
            usage: "<ToastStack toasts={toasts} onDismiss={Dismiss} position=\"bottom-right\"/>",
            propsDoc: [
                { name: "toasts", type: "ToastItem[]", required: true, description: "[{ id, tone, title, message, spinner, iconUrl }]." },
                { name: "onDismiss", type: "(id: string) => void" },
                { name: "position", type: "string", default: "\"bottom-right\"", description: "bottom-right | top-right | bottom-center." }
            ]
        }),

        /* --- Sobreposições --- */
        Story({
            id: "overlay.dialog",
            title: "Dialog",
            group: "Sobreposições",
            description: "Diálogo modal com cabeçalho, corpo e rodapé de ações. Fecha no Escape e no scrim.",
            component: DialogPreview,
            props: { title: "Instalar aplicativo", size: "md" },
            controls: {
                title: { label: "Título", type: "text" },
                size: { label: "Tamanho", type: "select", options: [ "sm", "md", "lg", "xl" ] }
            },
            exportName: "Dialog",
            usage: "<Dialog\n    open={open}\n    title=\"Instalar aplicativo\"\n    onClose={Close}\n    actions={<Button variant=\"primary\">Instalar</Button>}>\n    {body}\n</Dialog>",
            propsDoc: [
                { name: "open", type: "boolean", default: "true" },
                { name: "size", type: "\"sm\" | \"md\" | \"lg\" | \"xl\"", default: "\"md\"" },
                { name: "onClose", type: "() => void", description: "Habilita Escape, scrim e botão de fechar." },
                { name: "actions", type: "ReactNode", description: "Botões do rodapé (à direita)." }
            ]
        }),
        Story({
            id: "overlay.confirm",
            title: "ConfirmDialog",
            group: "Sobreposições",
            description: "Confirmação padronizada — mesma ordem de botões e mesmo destaque para ação destrutiva.",
            component: ConfirmPreview,
            props: { danger: true },
            controls: { danger: { label: "Destrutiva", type: "boolean" } },
            exportName: "ConfirmDialog",
            usage: "<ConfirmDialog\n    open={open}\n    danger\n    title=\"Desinstalar\"\n    message=\"O executável será removido.\"\n    onConfirm={Uninstall}\n    onCancel={Close}/>"
        }),
        Story({
            id: "overlay.drawer",
            title: "Drawer",
            group: "Sobreposições",
            description: "Gaveta lateral para inspetores e detalhes, ancorada abaixo da barra de topo.",
            component: DrawerPreview,
            exportName: "Drawer",
            usage: "<Drawer open={open} title=\"Inspetor\" width={480} onClose={Close}>{detail}</Drawer>"
        }),
        Story({
            id: "overlay.tooltip",
            title: "Tooltip",
            group: "Sobreposições",
            description: "Dica curta em CSS puro (sem posicionamento em JS).",
            component: () =>
                <div style={{ display: "flex", gap: 22, paddingTop: 24 }}>
                    <Tooltip content="encerrar instância"><Button variant="danger" icon="stop">Stop</Button></Tooltip>
                    <Tooltip content="abaixo" position="bottom"><Button icon="info">Ajuda</Button></Tooltip>
                </div>,
            exportName: "Tooltip",
            usage: "<Tooltip content=\"encerrar\"><IconButton icon=\"stop\" label=\"encerrar\"/></Tooltip>"
        }),
        Story({
            id: "overlay.menu",
            title: "Menu",
            group: "Sobreposições",
            description: "Lista de ações dirigida por dados, com separador e item destrutivo.",
            component: MenuPreview,
            exportName: "Menu",
            usage: "<Menu items={[{ key: \"open\", label: \"Abrir\", icon: \"external\", onSelect: Open }]} onClose={Close}/>",
            propsDoc: [
                { name: "items", type: "MenuItem[]", required: true, description: "[{ key, label, icon, danger, disabled, separator, onSelect }]." },
                { name: "onClose", type: "() => void", description: "Chamado após selecionar e no Escape." }
            ]
        }),
        Story({
            id: "overlay.contextmenu",
            title: "ContextMenu",
            group: "Sobreposições",
            description: "Menu ancorado em coordenadas de tela (botão direito) — o padrão do my-desktop.",
            component: ContextMenuPreview,
            exportName: "ContextMenu",
            usage: "{ point && <ContextMenu x={point.x} y={point.y} items={items} onClose={Close}/> }"
        }),
        Story({
            id: "overlay.popover",
            title: "Popover",
            group: "Sobreposições",
            description: "Painel ancorado no gatilho (seletor de tema, lista de apps, filtros).",
            component: PopoverPreview,
            exportName: "Popover",
            usage: "<Popover open={open} onClose={Close} trigger={<Button onClick={Toggle}>Apps</Button>}>\n    {content}\n</Popover>"
        }),

        /* --- Dados --- */
        Story({
            id: "data.panel",
            title: "Panel",
            group: "Dados",
            description: "Moldura de seção: cabeçalho com título/ações, corpo e rodapé.",
            component: () =>
                <Panel
                    title="Instâncias em execução"
                    icon="server"
                    actions={<Button size="sm" variant="subtle" icon="refresh">Atualizar</Button>}>
                    <ListRow icon="cube" title="ui-catalog-desktop" meta="9f31c2a0 · 19:05" right={<StatusBadge status="ACTIVE"/>} onClick={() => {}}/>
                    <ListRow icon="cube" title="launcher-desktop" meta="4ab7e910 · 18:42" right={<StatusBadge status="FINISHED"/>} onClick={() => {}}/>
                </Panel>,
            exportName: "Panel",
            usage: "<Panel title=\"Instâncias\" icon=\"server\" actions={<Button size=\"sm\">Atualizar</Button>}>\n    {rows}\n</Panel>"
        }),
        Story({
            id: "data.listrow",
            title: "ListRow",
            group: "Dados",
            description: "Linha de lista com ícone, título, metadado mono e área direita.",
            component: ListRowPreview,
            exportName: "ListRow",
            usage: "<ListRow icon=\"database\" title={repo.name} meta={repo.path} onClick={Select}/>"
        }),
        Story({
            id: "data.table",
            title: "DataTable",
            group: "Dados",
            description: "Tabela dirigida por dados: colunas com render, alinhamento, mono e modo denso. Substitui <Table> do Semantic.",
            component: TablePreview,
            props: { dense: false },
            controls: { dense: { label: "Denso", type: "boolean" } },
            exportName: "DataTable",
            usage: "<DataTable\n    rows={instances}\n    rowKey={(row) => row.instanceId}\n    onRowClick={Select}\n    columns={[\n        { key: \"instanceId\", header: \"Instância\", mono: true },\n        { key: \"status\", header: \"Status\", render: (row) => <StatusBadge status={row.status}/> }\n    ]}/>",
            propsDoc: [
                { name: "columns", type: "DataColumn[]", required: true, description: "[{ key, header, width, align, mono, render }]." },
                { name: "rows", type: "any[]", required: true },
                { name: "rowKey", type: "(row, index) => string", description: "Chave estável da linha (seleção)." },
                { name: "dense", type: "boolean", default: "false" },
                { name: "emptyMessage", type: "string", description: "Texto do EmptyState quando rows está vazio." }
            ]
        }),
        Story({
            id: "data.tree",
            title: "TreeRow",
            group: "Dados",
            description: "Linha de árvore com recuo, twisty, seleção e marca de não-commitado (git).",
            component: TreePreview,
            exportName: "TreeRow",
            usage: "<TreeRow\n    label={node.name}\n    icon=\"file code\"\n    depth={depth}\n    hasChildren={node.children.length > 0}\n    expanded={isOpen}\n    dirty={node.isDirty}\n    onToggle={Toggle}\n    onSelect={Select}/>",
            propsDoc: [
                { name: "depth", type: "number", default: "0", description: "Nível de recuo (14px por nível)." },
                { name: "dirty", type: "boolean", default: "false", description: "Pinta o rótulo de vermelho (não commitado)." },
                { name: "hasChildren", type: "boolean", default: "false", description: "Mostra o twisty e aria-expanded." }
            ]
        }),
        Story({
            id: "data.objectcard",
            title: "ObjectCard",
            group: "Dados",
            description: "Cartão de objeto: pacote, instância, repositório, projeto. Ícone, título, metadado e chips.",
            component: () =>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    <ObjectCard
                        icon="desktop"
                        title="ui-catalog.desktopapp"
                        meta="Apps.Module/Tools.layer/UICatalog.group"
                        status={<StatusBadge status="ACTIVE"/>}
                        chips={<><span className="mp-type-chip">desktopapp</span><span className="mp-type-chip">gui-host</span></>}
                        onClick={() => {}}/>
                    <ObjectCard
                        icon="cube"
                        title="i-components.icomponents"
                        meta="Base.Module/Library.layer"
                        chips={<span className="mp-type-chip">icomponents</span>}
                        selected
                        onClick={() => {}}/>
                </div>,
            exportName: "ObjectCard",
            usage: "<ObjectCard\n    icon=\"desktop\"\n    title={pkg.name}\n    meta={pkg.namespace}\n    status={<StatusBadge status={pkg.status}/>}\n    onClick={Open}/>"
        }),
        Story({
            id: "data.tile",
            title: "Tile e TileRow",
            group: "Dados",
            description: "Faixa de indicadores do topo das telas de operação.",
            component: () =>
                <TileRow>
                    <Tile icon="server" count={3} title="Instâncias ativas" sub="+1 nesta hora" subTone="success" onClick={() => {}}/>
                    <Tile icon="cubes" count={113} title="Pacotes" sub="10 aplicativos"/>
                    <Tile icon="warning sign" count={1} title="Falhas" sub="ver detalhes" subTone="danger" onClick={() => {}}/>
                </TileRow>,
            exportName: "Tile",
            usage: "<TileRow>\n    <Tile icon=\"server\" count={active} title=\"Instâncias ativas\" onClick={GoToMonitor}/>\n</TileRow>"
        }),
        Story({
            id: "data.keyvalue",
            title: "KeyValueList",
            group: "Dados",
            description: "Dados técnicos em pares rótulo/valor, com coluna mono. Padrão para metadados de pacote.",
            component: ({ columns = 2 }: any) =>
                <KeyValueList
                    columns={Number(columns)}
                    items={[
                        { label: "Namespace", value: "@/ui-catalog.desktopapp", mono: true },
                        { label: "Executável", value: "ui-catalog-desktop", mono: true },
                        { label: "Tipo", value: "DESKTOP" },
                        { label: "Repositório", value: "PlatformApplicationsRepo" },
                        { label: "Socket", value: "ui-catalog-desktop.sock", mono: true }
                    ]}/>,
            props: { columns: 2 },
            controls: { columns: { label: "Colunas", type: "select", options: [ "1", "2", "3" ] } },
            exportName: "KeyValueList",
            usage: "<KeyValueList columns={2} items={[{ label: \"Namespace\", value: pkg.namespace, mono: true }]}/>"
        }),
        Story({
            id: "data.tabs",
            title: "Tabs",
            group: "Dados",
            description: "Abas de navegação dentro de uma tela, com contador e item desabilitado.",
            component: TabsPreview,
            exportName: "Tabs",
            usage: "<Tabs activeKey={tab} onChange={setTab} tabs={[{ key: \"overview\", label: \"Visão\", icon: \"eye\" }]}/>"
        }),
        Story({
            id: "data.code",
            title: "CodeBlock",
            group: "Dados",
            description: "Saída técnica em monoespaçada com fundo de terminal.",
            component: () =>
                <CodeBlock language="bash">{"repo install PlatformApplicationsRepo LOCAL_FS \\\n    --executables ui-catalog-desktop"}</CodeBlock>,
            exportName: "CodeBlock",
            usage: "<CodeBlock language=\"json\">{JSON.stringify(metadata, null, 4)}</CodeBlock>"
        }),

        /* --- Cabeçalhos e status --- */
        Story({
            id: "header.masthead",
            title: "PageMasthead",
            group: "Cabeçalhos",
            description: "Cabeçalho de página: ícone, título, subtítulo, ações e faixa de contexto.",
            component: ({ title = "Catálogo de UI", subtitle = "46 componentes em 3 bibliotecas" }: any) =>
                <PageMasthead
                    icon="cubes"
                    title={title}
                    subtitle={subtitle}
                    actions={<>
                        <Button variant="subtle" icon="refresh">Recarregar</Button>
                        <Button variant="primary" icon="plus">Nova história</Button>
                    </>}>
                    <StatusStrip right={<CopyableMonoText value="@/i-components.icomponents" maxChars={30}/>}>
                        <StatusChip icon="check circle" tone="success" label="estáveis" count={44}/>
                        <StatusChip icon="flask" tone="info" label="beta" count={2}/>
                    </StatusStrip>
                </PageMasthead>,
            props: { title: "Catálogo de UI", subtitle: "46 componentes em 3 bibliotecas" },
            controls: {
                title: { label: "Título", type: "text" },
                subtitle: { label: "Subtítulo", type: "text" }
            },
            exportName: "PageMasthead",
            usage: "<PageMasthead icon=\"cubes\" title=\"Catálogo\" subtitle={subtitle} actions={actions}>\n    <StatusStrip>{chips}</StatusStrip>\n</PageMasthead>"
        }),
        Story({
            id: "header.entity",
            title: "EntityHeader",
            group: "Cabeçalhos",
            description: "Cabeçalho de entidade — pacote, instância, socket, repositório, projeto, fonte de dados.",
            component: () =>
                <EntityHeader
                    icon="desktop"
                    title="ui-catalog.desktopapp"
                    subtitle="Apps.Module/Tools.layer/UICatalog.group"
                    typeLabel="desktopapp"
                    status="ACTIVE"
                    meta={[ { label: "repo", value: "PlatformApplicationsRepo" }, { label: "janelas", value: 1 } ]}
                    technicalRef={{ label: "path", value: "/home/kadisk/EcosystemData/repos/PlatformApplicationsRepo/Apps.Module/Tools.layer/UICatalog.group/ui-catalog.desktopapp" }}
                    actions={<Button variant="danger" icon="stop">Encerrar</Button>}/>,
            exportName: "EntityHeader",
            usage: "<EntityHeader\n    icon=\"cube\"\n    title={pkg.name}\n    subtitle={pkg.namespace}\n    typeLabel={pkg.ext}\n    status={instance.status}\n    meta={[{ label: \"repo\", value: pkg.repo }]}\n    technicalRef={{ label: \"path\", value: pkg.path }}\n    actions={actions}/>"
        }),
        Story({
            id: "header.statusstrip",
            title: "StatusStrip e StatusChip",
            group: "Cabeçalhos",
            description: "Faixa de contadores que também funciona como filtro (chip clicável com estado ativo).",
            component: StatusStripPreview,
            exportName: "StatusStrip",
            usage: "<StatusStrip>\n    <StatusChip tone=\"success\" label=\"ativas\" count={active} onClick={Filter}/>\n</StatusStrip>"
        }),
        Story({
            id: "header.statusbadge",
            title: "StatusBadge",
            group: "Cabeçalhos",
            description: "Status oficial do Task Executor e da conexão de supervisor, com tom, ícone e severidade em fonte única.",
            component: () =>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    { [ "ACTIVE", "STARTING", "FINISHED", "FAILURE", "TERMINATED", "CONNECTED", "CONNECTING", "UNAVAILABLE", "AWAITING_PRECONDITIONS" ]
                        .map((status) =>
                            <StatusBadge
                                key={status}
                                status={status}
                                reason={status === "FAILURE" ? "porta 8085 ocupada" : undefined}/>) }
                </div>,
            exportName: "StatusBadge",
            usage: "<StatusBadge status={task.status} reason={task.statusReason}/>\n\n// ordenar por severidade:\nrows.sort((a, b) => GetSeverityRank(a.status) - GetSeverityRank(b.status))",
            propsDoc: [
                { name: "status", type: "string", required: true, description: "Status do Task Executor ou da conexão." },
                { name: "reason", type: "string", description: "Vira tooltip — tipicamente o motivo de FAILURE." },
                { name: "size", type: "\"sm\" | \"md\"", default: "\"sm\"" }
            ]
        }),
        Story({
            id: "header.systembanner",
            title: "SystemBanner",
            group: "Cabeçalhos",
            description: "Faixa de sistema alta, com ação: somente-leitura, aviso de ambiente, falha de conexão.",
            component: ({ tone = "readonly" }: any) =>
                <Stack>
                    <SystemBanner
                        tone={tone}
                        title="Projeto arquivado — somente leitura"
                        actions={<Button size="sm" icon="undo">Restaurar</Button>}>
                        Nenhuma escrita é aceita enquanto o projeto estiver arquivado.
                    </SystemBanner>
                    <SystemBanner tone="danger" title="Daemon indisponível">
                        O executor-manager não respondeu no socket.
                    </SystemBanner>
                </Stack>,
            props: { tone: "readonly" },
            controls: { tone: { label: "Tom", type: "select", options: [ "info", "readonly", "warning", "danger", "success" ] } },
            exportName: "SystemBanner",
            usage: "<SystemBanner tone=\"readonly\" title=\"Somente leitura\" actions={<Button>Restaurar</Button>}>\n    {message}\n</SystemBanner>"
        }),
        Story({
            id: "header.copyable",
            title: "CopyableMonoText",
            group: "Cabeçalhos",
            description: "Dado técnico com truncamento central e cópia do valor completo.",
            component: () =>
                <Stack>
                    <CopyableMonoText
                        value="/home/kadisk/EcosystemData/repos/PlatformApplicationsRepo/Apps.Module/Tools.layer/UICatalog.group/ui-catalog.desktopapp"
                        maxChars={52}/>
                    <CopyableMonoText
                        value="unix:/home/kadisk/EcosystemData/supervisor-sockets/ui-catalog-desktop.sock"
                        maxChars={40}/>
                </Stack>,
            exportName: "CopyableMonoText",
            usage: "<CopyableMonoText value={pkg.path} maxChars={48}/>"
        }),

        /* --- Shell --- */
        Story({
            id: "shell.appshell",
            title: "AppShell, Topbar, NavRail e StatusBar",
            group: "Shell",
            description: "Esqueleto de aplicação dimensionado pelos tokens --mp-shell-*. Todo desktop app monta a tela por aqui.",
            component: ShellPreview,
            exportName: "AppShell",
            usage: "<AppShell\n    topbar={<Topbar brand=\"UI Catalog\" right={actions}/>}\n    sidebar={<NavRail items={sections} activeKey={section} onSelect={setSection}/>}>\n    <ContentArea>{page}</ContentArea>\n</AppShell>",
            propsDoc: [
                { name: "topbar", type: "ReactNode", description: "Barra de topo (altura --mp-shell-topbar-h)." },
                { name: "sidebar", type: "ReactNode", description: "NavRail ou SidePanel." },
                { name: "dock", type: "ReactNode", description: "Faixa inferior (my-desktop)." }
            ]
        })
    ]
}
