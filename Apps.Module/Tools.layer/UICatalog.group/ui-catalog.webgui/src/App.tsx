import * as React from "react"
import { useMemo, useState } from "react"
import type { ComponentStory, StoryCollection } from "@i-components"
import { Banner, Button, CheckboxInput, CodeBlock, DataTable, EmptyState, Icon, IconButton, KeyValueList, Menu, ObjectCard, PageMasthead, Panel, Popover, SearchInput, SelectInput, StatusChip, StatusStrip, Tabs, TextInput, Tile, TileRow, Tooltip, ApplyTheme, GetSavedTheme, THEMES } from "@i-components"
import { commonStories } from "@i-components/catalog/stories"
import { instanceManagerStories } from "@instance-components"
import { apps, WaveLabel } from "./apps"

// UI Catalog — catálogo E UI kit do Application Repository.
//
// Catálogo: navegar por TODO componente disponível, agrupado por biblioteca e
//           por família, com preview vivo e controles interativos.
// UI kit:   para cada componente, de onde importar, o snippet de uso e o
//           contrato de props — o que um aplicativo precisa para consumir.
//
// O próprio catálogo é escrito só com componentes do kit: se um padrão não
// serve para montar esta tela, ele não serve para os outros aplicativos.

// As coleções chegam das bibliotecas .uilib (cada uma publica as suas
// histórias no manifesto uilib.json → catalog.stories).
const collections: StoryCollection[] = [ commonStories, instanceManagerStories ]

type Section = "components" | "apps"

const STATUS_TONE: any = { stable: "success", beta: "info", deprecated: "warning" }

/* ------------------------------------------------------------------ */
/* Controles interativos da história                                  */
/* ------------------------------------------------------------------ */

const StoryControls = ({ story, values, onChange }: {
    story: ComponentStory
    values: any
    onChange: (key: string, value: any) => void
}) => {
    const controls = story.controls || {}
    const keys = Object.keys(controls)
    if(!keys.length)
        return <div className="mp-field__hint">Esta história não expõe controles.</div>

    return <div className="mp-stack">
        { keys.map((key) => {
            const control = controls[key]
            const value = values[key]
            if(control.type === "boolean")
                return <CheckboxInput
                    key={key}
                    label={control.label}
                    checked={Boolean(value)}
                    onChange={(event: any) => onChange(key, event.target.checked)}/>
            if(control.type === "select")
                return <div key={key} className="mp-field">
                    <label className="mp-field__label">{control.label}</label>
                    <SelectInput
                        value={String(value ?? "")}
                        options={(control.options || []).map((option) => ({ value: option, label: option }))}
                        onChange={(event: any) => onChange(key, event.target.value)}/>
                </div>
            if(control.type === "number")
                return <div key={key} className="mp-field">
                    <label className="mp-field__label">{control.label}</label>
                    <TextInput
                        type="number"
                        min={control.min}
                        max={control.max}
                        value={value ?? 0}
                        onChange={(event: any) => onChange(key, Number(event.target.value))}/>
                </div>
            return <div key={key} className="mp-field">
                <label className="mp-field__label">{control.label}</label>
                <TextInput
                    value={String(value ?? "")}
                    onChange={(event: any) => onChange(key, event.target.value)}/>
            </div>
        }) }
    </div>
}

/* ------------------------------------------------------------------ */
/* Painel da história selecionada                                     */
/* ------------------------------------------------------------------ */

const StoryView = ({ story, collection }: { story: ComponentStory, collection: StoryCollection }) => {

    const [ tab, setTab ] = useState("preview")
    const [ overrides, setOverrides ] = useState<any>({})
    // Os overrides são por componente: trocar de história zera os controles.
    const [ lastId, setLastId ] = useState(story.id)
    if(lastId !== story.id) { setLastId(story.id); setOverrides({}) }

    const props = { ...(story.props || {}), ...overrides }
    const Preview = story.component
    const hasControls = Boolean(story.controls && Object.keys(story.controls).length)

    return <div className="ct-story">
        <PageMasthead
            icon="cube"
            title={story.title}
            subtitle={story.description}
            actions={
                <Tooltip content="biblioteca de origem">
                    <StatusChip icon="folder" label={collection.title}/>
                </Tooltip>
            }>
            <StatusStrip
                right={<code className="ct-import">{`import { ${story.exportName || story.title} } from "${story.importFrom || "@i-components"}"`}</code>}>
                <StatusChip label={story.group} icon="sitemap"/>
                { story.status && <StatusChip label={story.status} tone={STATUS_TONE[story.status]} icon="check circle"/> }
                { (story.tags || []).map((tag) => <StatusChip key={tag} label={tag} icon="tag"/>) }
            </StatusStrip>
        </PageMasthead>

        <Tabs
            activeKey={tab}
            onChange={setTab}
            tabs={[
                { key: "preview", label: "Preview", icon: "eye" },
                { key: "props", label: "Props", icon: "list", count: (story.propsDoc || []).length || undefined },
                { key: "usage", label: "Uso", icon: "code" },
                {
                    key: "variants",
                    label: "Variantes",
                    icon: "clone",
                    count: (story.variants || []).length || undefined,
                    disabled: !(story.variants || []).length
                }
            ]}/>

        { tab === "preview" &&
            <div className={`ct-preview ${hasControls ? "has-controls" : ""}`}>
                <section className="ct-canvas"><Preview {...props}/></section>
                { hasControls &&
                    <Panel title="Controles" icon="sliders horizontal">
                        <StoryControls
                            story={story}
                            values={props}
                            onChange={(key, value) => setOverrides({ ...overrides, [key]: value })}/>
                        { Object.keys(overrides).length > 0 &&
                            <div style={{ marginTop: 12 }}>
                                <Button size="sm" variant="subtle" icon="undo" onClick={() => setOverrides({})}>
                                    Restaurar padrões
                                </Button>
                            </div> }
                    </Panel> }
            </div> }

        { tab === "props" &&
            <div className="ct-tabbody">
                { (story.propsDoc || []).length
                    ? <DataTable
                        rows={story.propsDoc as any[]}
                        rowKey={(row: any) => row.name}
                        columns={[
                            { key: "name", header: "Prop", mono: true, width: 170 },
                            { key: "type", header: "Tipo", mono: true, width: 220 },
                            { key: "default", header: "Padrão", mono: true, width: 110, render: (row: any) => row.default || "—" },
                            {
                                key: "required",
                                header: "Obrig.",
                                width: 80,
                                align: "center",
                                render: (row: any) => row.required ? <Icon name="check" tone="success"/> : null
                            },
                            { key: "description", header: "Descrição" }
                        ]}/>
                    : <Banner tone="info" title="Sem contrato declarado">
                        Esta história ainda não documentou as props. Preencha <code>propsDoc</code> na história do componente.
                    </Banner> }
            </div> }

        { tab === "usage" &&
            <div className="ct-tabbody mp-stack">
                <KeyValueList
                    columns={2}
                    items={[
                        { label: "Importar de", value: story.importFrom || "@i-components", mono: true },
                        { label: "Pacote de origem", value: story.sourcePackage, mono: true },
                        { label: "Export", value: story.exportName || "—", mono: true },
                        { label: "Família", value: story.group }
                    ]}/>
                { story.usage
                    ? <CodeBlock language="tsx">{story.usage}</CodeBlock>
                    : <Banner tone="info" title="Sem snippet">
                        Preencha <code>usage</code> na história para que o consumidor copie e cole.
                    </Banner> }
                { story.notes && <Banner tone="info" title="Notas">{story.notes}</Banner> }
            </div> }

        { tab === "variants" &&
            <div className="ct-tabbody mp-stack">
                { (story.variants || []).map((variant) =>
                    <Panel key={variant.label} title={variant.label}>
                        { variant.description && <div className="mp-field__hint" style={{ marginBottom: 10 }}>{variant.description}</div> }
                        <div className="ct-canvas is-inline"><Preview {...(story.props || {})} {...variant.props}/></div>
                    </Panel>) }
            </div> }
    </div>
}

/* ------------------------------------------------------------------ */
/* Seção de aplicativos — placar da padronização                      */
/* ------------------------------------------------------------------ */

const AppsView = () => {

    const totalLocal = apps.reduce((sum, app) => sum + app.localComponents, 0)
    const totalSemantic = apps.reduce((sum, app) => sum + app.semanticFiles, 0)
    const migrated = apps.filter((app) => app.migrated).length
    const storyCount = collections.reduce((sum, item) => sum + item.stories.length, 0)

    return <div className="ct-story">
        <PageMasthead
            icon="th"
            title="Aplicativos do Application Repository"
            subtitle="Todo desktop app monta a UI com os componentes deste catálogo. Este é o placar da convergência.">
            <StatusStrip>
                <StatusChip
                    icon="check circle"
                    tone={migrated === apps.length ? "success" : "warning"}
                    label="no padrão"
                    count={`${migrated}/${apps.length}`}/>
                <StatusChip icon="cubes" label="componentes locais" count={totalLocal}/>
                <StatusChip
                    icon="warning sign"
                    tone={totalSemantic ? "danger" : "success"}
                    label="arquivos com semantic direto"
                    count={totalSemantic}/>
            </StatusStrip>
        </PageMasthead>

        <div className="ct-tabbody mp-stack">
            <TileRow>
                <Tile icon="cubes" count={storyCount} title="Histórias no catálogo" sub="kit + áreas"/>
                <Tile icon="book" count={collections.length} title="Bibliotecas" sub="1 comum + áreas"/>
                <Tile
                    icon="th"
                    count={apps.length}
                    title="Aplicativos"
                    sub={`${migrated} no padrão`}
                    subTone={migrated === apps.length ? "success" : "muted"}/>
            </TileRow>

            { [ 1, 2, 3 ].map((wave) =>
                <Panel key={wave} title={WaveLabel(wave as any)} icon="flag">
                    <div className="ct-appgrid">
                        { apps.filter((app) => app.wave === wave).map((app) =>
                            <ObjectCard
                                key={app.id}
                                icon={app.desktopExecutable ? "desktop" : "window maximize"}
                                title={app.title}
                                meta={app.guiPackage}
                                status={<StatusChip
                                    tone={app.migrated ? "success" : "warning"}
                                    icon={app.migrated ? "check" : "hourglass half"}
                                    label={app.migrated ? "no padrão" : "pendente"}/>}
                                chips={<>
                                    <span className="mp-type-chip">{app.area}</span>
                                    { app.localComponents > 0 && <span className="mp-type-chip">{app.localComponents} locais</span> }
                                    { app.semanticFiles > 0 && <span className="mp-type-chip">{app.semanticFiles} semantic</span> }
                                    { app.cssLines > 0 && <span className="mp-type-chip">{app.cssLines} L css</span> }
                                </>}/>) }
                    </div>
                </Panel>) }

            <Banner tone="info" title="Como um aplicativo entra no padrão">
                Importar tudo de <code>@i-components</code> (e da lib da sua área), remover o import direto de
                <code> semantic-ui-react</code>, apagar o CSS que duplica o design system e promover para o kit o
                componente que outro aplicativo também usaria — com história neste catálogo.
            </Banner>
        </div>
    </div>
}

/* ------------------------------------------------------------------ */
/* Aplicação                                                          */
/* ------------------------------------------------------------------ */

export const App = () => {

    const [ query, setQuery ] = useState("")
    const [ section, setSection ] = useState<Section>("components")
    const [ selectedId, setSelectedId ] = useState(collections[0].stories[0].id)
    const [ theme, setTheme ] = useState(GetSavedTheme())
    const [ themeOpen, setThemeOpen ] = useState(false)

    const normalized = query.trim().toLowerCase()

    // Cada biblioteca vira um bloco; dentro dele, as histórias agrupadas por
    // família (story.group) — é a navegação "vejo tudo que existe".
    const tree = useMemo(() => collections.map((collection) => {
        const stories = collection.stories.filter((story) =>
            !normalized ||
            `${collection.title} ${story.title} ${story.group} ${story.description} ${(story.tags || []).join(" ")}`
                .toLowerCase().includes(normalized))
        const groups: { group: string, stories: ComponentStory[] }[] = []
        stories.forEach((story) => {
            const found = groups.find((item) => item.group === story.group)
            if(found) found.stories.push(story)
            else groups.push({ group: story.group, stories: [ story ] })
        })
        return { collection, groups, count: stories.length }
    }), [ normalized ])

    const allStories = collections.flatMap((collection) =>
        collection.stories.map((story) => ({ story, collection })))

    const selected = allStories.find(({ story }) => story.id === selectedId)
        || tree.flatMap((block) => block.groups.flatMap((group) =>
            group.stories.map((story) => ({ story, collection: block.collection }))))[0]

    const ChangeTheme = (name: any) => { ApplyTheme(name); setTheme(name); setThemeOpen(false) }

    return <div className="mp-shell has-sidebar ct-shell">

        <div className="mp-shell__topbar">
            <header className="mp-topbar">
                <div className="mp-topbar__brand">
                    <span className="mp-topbar__mark"/>
                    <span className="mp-topbar__name">UI Catalog</span>
                    <span className="mp-topbar__subtitle">Application Repository · catálogo e UI kit</span>
                </div>
                <div className="mp-topbar__center">
                    <div style={{ maxWidth: 420, width: "100%" }}>
                        <SearchInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Buscar componente, família ou tag…"/>
                    </div>
                </div>
                <div className="mp-topbar__right">
                    <StatusChip icon="cubes" label="componentes" count={allStories.length}/>
                    <Popover
                        open={themeOpen}
                        align="right"
                        onClose={() => setThemeOpen(false)}
                        trigger={<IconButton icon="paint brush" label="trocar tema" onClick={() => setThemeOpen(!themeOpen)}/>}>
                        <Menu
                            onClose={() => setThemeOpen(false)}
                            items={THEMES.map((item) => ({
                                key: item.key,
                                label: `${item.label}${item.key === theme ? " ✓" : ""}`,
                                icon: item.icon,
                                onSelect: () => ChangeTheme(item.key)
                            }))}/>
                    </Popover>
                </div>
            </header>
        </div>

        <div className="mp-shell__sidebar">
            <nav className="mp-navrail ct-navrail">
                <div className="mp-navrail__items">
                    <button
                        type="button"
                        className={`mp-navrail__item ${section === "components" ? "is-active" : ""}`}
                        onClick={() => setSection("components")}>
                        <Icon name="cubes" className="mp-navrail__icon"/>
                        <span className="mp-navrail__label">Componentes</span>
                        <span className="mp-navrail__count">{allStories.length}</span>
                    </button>
                    <button
                        type="button"
                        className={`mp-navrail__item ${section === "apps" ? "is-active" : ""}`}
                        onClick={() => setSection("apps")}>
                        <Icon name="th" className="mp-navrail__icon"/>
                        <span className="mp-navrail__label">Aplicativos</span>
                        <span className="mp-navrail__count">{apps.length}</span>
                    </button>

                    { section === "components" && tree.map((block) => block.count > 0
                        ? <div key={block.collection.id} className="ct-lib">
                            <div className="ct-lib__head">
                                <span className="ct-lib__title">{block.collection.title}</span>
                                <span className="ct-lib__meta">{block.collection.importFrom}</span>
                            </div>
                            { block.groups.map((group) =>
                                <div key={group.group} className="ct-group">
                                    <div className="ct-group__title">{group.group}</div>
                                    { group.stories.map((story) =>
                                        <button
                                            type="button"
                                            key={story.id}
                                            className={`ct-item ${story.id === selected?.story.id ? "is-active" : ""}`}
                                            onClick={() => { setSelectedId(story.id); setSection("components") }}>
                                            {story.title}
                                        </button>) }
                                </div>) }
                        </div>
                        : null) }

                    { section === "components" && tree.every((block) => block.count === 0) &&
                        <div className="mp-field__hint" style={{ padding: 12 }}>Nada encontrado para “{query}”.</div> }
                </div>
            </nav>
        </div>

        <main className="mp-shell__content">
            { section === "apps"
                ? <AppsView/>
                : selected
                    ? <StoryView story={selected.story} collection={selected.collection}/>
                    : <EmptyState
                        icon="cubes"
                        title="Nenhum componente encontrado"
                        message="Limpe a busca para ver o catálogo completo."
                        actions={<Button variant="primary" icon="undo" onClick={() => setQuery("")}>Limpar busca</Button>}/> }
        </main>
    </div>
}
