import React, { useMemo, useState } from "react"
import type { ComponentStory, StoryCollection } from "@i-components"
import { commonStories } from "@i-components"
import { instanceManagerStories } from "@instance-components"
import { webGuiCollections } from "./webguis"

const collections: StoryCollection[] = [
    commonStories,
    instanceManagerStories,
    ...webGuiCollections
]

const StoryCanvas = ({ story }: { story: ComponentStory }) => {
    const Story = story.component
    return <main className="catalog-main">
        <header className="catalog-story-header">
            <span className="catalog-kicker">{story.group}</span>
            <h1>{story.title}</h1>
            <p>{story.description}</p>
            <code>{story.sourcePackage}</code>
        </header>
        <section className="catalog-canvas"><Story {...(story.props || {})} /></section>
    </main>
}

export const App = () => {
    const [query, setQuery] = useState("")
    const [selectedId, setSelectedId] = useState(collections[0].stories[0].id)
    const normalized = query.trim().toLowerCase()
    const visible = useMemo(() => collections
        .map((collection) => ({
            ...collection,
            stories: collection.stories.filter((story) =>
                !normalized || `${collection.title} ${story.title} ${story.group}`.toLowerCase().includes(normalized)
            )
        }))
        .filter((collection) => collection.stories.length), [normalized])
    const selected = collections.flatMap(({ stories }) => stories)
        .find(({ id }) => id === selectedId) || visible[0]?.stories[0]

    return <div className="catalog-shell">
        <aside className="catalog-sidebar">
            <div className="catalog-brand">
                <span>Application Repository</span>
                <strong>UI Catalog</strong>
                <small>Storybook da plataforma</small>
            </div>
            <input
                aria-label="Buscar componentes e WebGui"
                placeholder="Buscar componente ou WebGui…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
            />
            <nav>
                {visible.map((collection) => <section key={collection.id}>
                    <h2>{collection.title}</h2>
                    {collection.stories.map((story) =>
                        <button
                            className={story.id === selected?.id ? "active" : ""}
                            key={story.id}
                            onClick={() => setSelectedId(story.id)}
                        >{story.title}</button>
                    )}
                </section>)}
            </nav>
        </aside>
        {selected ? <StoryCanvas story={selected} /> : <main className="catalog-empty">Nenhum componente encontrado.</main>}
    </div>
}
