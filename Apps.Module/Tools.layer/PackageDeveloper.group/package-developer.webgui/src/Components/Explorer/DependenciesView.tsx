import * as React from "react"
import { useMemo } from "react"
import { Icon } from "@i-components"

import { PackageModel } from "../../Domain/packageModel"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import { Badge } from "./ui/Primitives"

// Dependências internas (@/) com o PORQUÊ de cada uma: quem, dentro deste
// pacote, referencia aquele pacote. Ordenadas por peso (mais usos primeiro),
// com o tipo do pacote visível — é o mapa de acoplamento do pacote.

type Usage = { section: string, item: string, icon: string }

const extOf = (namespace:string):string => {
    const m = /\.([a-zA-Z]+)$/.exec(namespace)
    return m ? m[1].toLowerCase() : ""
}

const DependenciesView = ({ model, onOpenRef }:{ model:PackageModel, onOpenRef?:(t:string) => void }) => {

    const dependencies = useMemo(() => {
        const usage:{[ref:string]:Usage[]} = {}
        model.sections.forEach((section) => {
            const walk = (items:any[]) => items.forEach((item) => {
                item.refs.forEach((ref:string) => {
                    usage[ref] = (usage[ref] || []).concat([{
                        section: section.title, item: item.title, icon: item.icon
                    }])
                })
                if(item.children) walk(item.children)
            })
            walk(section.items)
        })
        return model.packageRefs
            .map((ref) => ({ ref, ext: extOf(ref), uses: usage[ref] || [] }))
            .sort((a, b) => b.uses.length - a.uses.length || a.ref.localeCompare(b.ref))
    }, [model])

    if(!dependencies.length) return null

    return <div>
        <div className="pdx-summary">
            <strong>{dependencies.length}</strong> pacote(s) referenciado(s) por
            <strong> {dependencies.reduce((n, d) => n + d.uses.length, 0)}</strong> declaração(ões) deste pacote
        </div>

        {
            dependencies.map(({ ref, ext, uses }) =>
                <section key={ref} className={`pdx-dep pdx-dep--${ext || "other"}`}>
                    <header className="pdx-dep__head">
                        <span className="pdx-dep__mark" aria-hidden="true" />
                        <button type="button" className="pdx-dep__name" onClick={() => onOpenRef && onOpenRef(ref)}
                            title={`Abrir ${ref}`}>
                            {ref.replace(/\.[a-zA-Z]+$/, "")}
                            <span className="pdx-row__ext">{ext ? `.${ext}` : ""}</span>
                        </button>
                        { ext && <Badge tone="type">{ext}</Badge> }
                        <span className="pdx-dep__count">{uses.length} uso(s)</span>
                    </header>
                    {
                        uses.length > 0 &&
                        <ul className="pdx-dep__uses">
                            {
                                uses.map((use, i) =>
                                    <li key={i}>
                                        <Icon name={use.icon as any} style={{margin:0, color:"var(--mp-muted)"}} />
                                        <span className="pdx-dep__section">{use.section}</span>
                                        <span className="pdx-dep__item">{use.item}</span>
                                    </li>)
                            }
                        </ul>
                    }
                </section>)
        }

        {
            model.npm.length > 0 &&
            <div style={{marginTop:20}}>
                <div className="pdx-props__label">dependências npm</div>
                <div className="pdx-inline">
                    { model.npm.map((dep) =>
                        <CopyableCodeValue key={dep.name} value={`${dep.name}@${dep.range}`} type="text" />) }
                </div>
            </div>
        }
    </div>
}

export default DependenciesView
