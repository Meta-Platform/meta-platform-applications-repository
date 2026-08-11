import * as React from "react"
import { Icon } from "@i-components"

import { PackageModel, SectionId } from "../../Domain/packageModel"
import { GitScope } from "../../Domain/gitModel"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import { GitCounters } from "./GitStatusView"
import { Badge } from "./ui/Primitives"
import { IssueList } from "./ui/ValidationBadge"

// Visão geral: blocos com peso visual DIFERENTE, para o olho achar o que quer
// sem ler tudo — descrição em destaque, capacidades como atalhos coloridos por
// tipo de recurso, localização como ficha, e alertas só quando existem.

type Props = {
    model        : PackageModel
    onOpenSection: (sectionId:SectionId | "boot") => void
    onOpenRef?   : (target:string) => void
    onOpenTab?   : (tab:string) => void
    gitScope?    : GitScope
}

// Cor por família de recurso — a mesma do diagrama do boot, para o usuário
// aprender uma vez só.
const SECTION_META:any = {
    "boot-params"     : { label: "parâmetros",      accent: "neutral" },
    "boot-services"   : { label: "serviços do boot", accent: "green" },
    "boot-executables": { label: "executáveis",     accent: "orange" },
    "boot-endpoints"  : { label: "endpoints do boot", accent: "blue" },
    "boot-windows"    : { label: "janelas",         accent: "violet" },
    "services"        : { label: "serviços",        accent: "green" },
    "endpoints"       : { label: "endpoints",       accent: "blue" },
    "commands"        : { label: "comandos",        accent: "cyan" },
    "startup-params"  : { label: "startup params",  accent: "neutral" }
}

const Block = ({ title, icon, right, children, tone }:any) =>
    <section className={`pdx-block${tone ? ` pdx-block--${tone}` : ""}`}>
        <header className="pdx-block__head">
            { icon && <Icon name={icon} style={{margin:0}} /> }
            <h3 className="pdx-block__title">{title}</h3>
            { right }
        </header>
        <div className="pdx-block__body">{children}</div>
    </section>

const PackageOverview = ({ model, onOpenSection, onOpenRef, onOpenTab, gitScope }:Props) => {

    const { identity } = model
    const errors   = model.issues.filter((i) => i.level === "error")
    const warnings = model.issues.filter((i) => i.level === "warning")

    return <div className="pdx-overview">

        {
            identity.description &&
            <p className="pdx-overview__lead">{identity.description}</p>
        }

        {
            (errors.length > 0 || warnings.length > 0) &&
            <Block title="Precisa de atenção" icon="warning sign" tone="alert"
                right={<span className="pdx-inline" style={{marginLeft:"auto", gap:4}}>
                    { errors.length > 0 && <Badge tone="error">{errors.length} erro(s)</Badge> }
                    { warnings.length > 0 && <Badge tone="warning">{warnings.length} aviso(s)</Badge> }
                </span>}>
                <IssueList issues={model.issues.slice(0, 6)} />
                { model.issues.length > 6 &&
                    <div className="pdx-muted" style={{fontSize:12, marginTop:6}}>
                        e mais {model.issues.length - 6} problema(s) — ver aba Metadados
                    </div> }
            </Block>
        }

        {
            (model.sections.length > 0 || model.boot) &&
            <Block title="Capacidades" icon="cubes"
                right={<span className="pdx-block__hint">clique para abrir no Runtime</span>}>
                <div className="pdx-caps">
                    {
                        model.boot &&
                        <button type="button" className="pdx-cap pdx-cap--boot" onClick={() => onOpenSection("boot")}>
                            <Icon name="rocket" style={{margin:0}} />
                            <span className="pdx-cap__label">boot</span>
                        </button>
                    }
                    {
                        model.sections.map((s) => {
                            const meta = SECTION_META[s.id] || { label: s.title, accent: "neutral" }
                            return <button key={s.id} type="button"
                                className={`pdx-cap pdx-cap--${meta.accent}`}
                                onClick={() => onOpenSection(s.id)}>
                                <Icon name={s.icon as any} style={{margin:0}} />
                                <span className="pdx-cap__label">{meta.label}</span>
                                <span className="pdx-cap__count">{s.items.length}</span>
                            </button>
                        })
                    }
                </div>
            </Block>
        }

        <Block title="Localização" icon="folder outline">
            <dl className="pdx-facts">
                { identity.repository && <><dt>repositório</dt><dd>{identity.repository}</dd></> }
                { identity.module && <><dt>módulo</dt><dd>{identity.module}</dd></> }
                { identity.layer && <><dt>layer</dt><dd>{identity.layer}</dd></> }
                { identity.group && <><dt>grupo</dt><dd>{identity.group}</dd></> }
                { identity.namespace &&
                    <><dt>namespace</dt><dd><CopyableCodeValue value={identity.namespace} type="reference" /></dd></> }
                <dt>caminho</dt>
                <dd>
                    <CopyableCodeValue value={identity.relativePath || identity.path}
                        copyValue={identity.path} title={identity.path} type="path" />
                </dd>
            </dl>
        </Block>

        {
            model.packageRefs.length > 0 &&
            <Block title="Depende de" icon="sitemap"
                right={ onOpenTab
                    ? <button type="button" className="pdx-link pdx-block__action"
                        onClick={() => onOpenTab("dependencies")}>ver detalhes</button>
                    : undefined }>
                <div className="pdx-inline">
                    {
                        model.packageRefs.map((ref) =>
                            <button key={ref} type="button" className="pdx-ref"
                                onClick={() => onOpenRef && onOpenRef(ref)} title={`Abrir ${ref}`}>
                                {ref}
                            </button>)
                    }
                </div>
            </Block>
        }

        {
            gitScope && gitScope.files.length > 0 &&
            <Block title="Alterações não commitadas" icon="code branch" tone="git"
                right={<span className="pdx-inline" style={{marginLeft:"auto", gap:4}}>
                    <GitCounters counts={gitScope.counts} />
                </span>}>
                <div className="pdx-inline">
                    { gitScope.files.slice(0, 8).map((f) => <span key={f.path} className="pdx-chip-file">{f.name}</span>) }
                    { gitScope.files.length > 8 &&
                        <span className="pdx-muted" style={{fontSize:12}}>+{gitScope.files.length - 8}</span> }
                </div>
                { onOpenTab &&
                    <button type="button" className="pdx-link pdx-block__action" style={{marginTop:8}}
                        onClick={() => onOpenTab("git")}>ver todos na aba Git</button> }
            </Block>
        }

        {
            (identity.version || identity.license || identity.author || model.npm.length > 0) &&
            <Block title="Publicação" icon="tag">
                <div className="pdx-inline">
                    { identity.version && <Badge tone="version">v{identity.version}</Badge> }
                    { identity.license && <Badge>{identity.license}</Badge> }
                    { model.npm.length > 0 &&
                        <Badge icon="cube">{model.npm.length} dependência(s) npm</Badge> }
                </div>
                { identity.author &&
                    <div className="pdx-muted" style={{fontSize:12, marginTop:8}}>{identity.author}</div> }
            </Block>
        }
    </div>
}

export default PackageOverview
