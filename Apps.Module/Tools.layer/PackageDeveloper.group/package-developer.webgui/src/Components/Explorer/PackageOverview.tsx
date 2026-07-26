import * as React from "react"
import { Icon } from "semantic-ui-react"

import { PackageModel, SectionId } from "../../Domain/packageModel"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import { Badge, CollapsibleSection, Metrics } from "./ui/Primitives"
import { IssueList } from "./ui/ValidationBadge"

// Visão geral: grupos semânticos (propósito, localização, capacidades, runtime,
// dependências, validação, metadados) em vez de uma lista contínua de texto.
// Cada grupo some quando não tem conteúdo.

type Props = {
    model        : PackageModel
    onOpenSection: (sectionId:SectionId | "boot") => void
    onOpenRef?   : (target:string) => void
    onOpenTab?   : (tab:string) => void
}

const SECTION_LABEL:any = {
    "boot-params": "parâmetros", "boot-services": "serviços do boot",
    "boot-executables": "executáveis", "boot-endpoints": "endpoints do boot",
    "boot-windows": "janelas", "services": "serviços", "endpoints": "endpoints",
    "commands": "comandos", "startup-params": "startup params"
}

const PackageOverview = ({ model, onOpenSection, onOpenRef, onOpenTab }:Props) => {

    const { identity } = model
    const location:{ label:string, value:string }[] = [
        identity.repository ? { label: "repositório", value: identity.repository } : null,
        identity.module     ? { label: "módulo", value: identity.module } : null,
        identity.layer      ? { label: "layer", value: identity.layer } : null,
        identity.group      ? { label: "grupo", value: identity.group } : null
    ].filter(Boolean) as any[]

    return <div>
        {
            identity.description &&
            <p style={{fontSize:14, lineHeight:1.5, color:"var(--mp-ink-2)", marginTop:0}}>{identity.description}</p>
        }

        <Metrics items={model.sections.map((s) => ({
            value: s.items.length, label: SECTION_LABEL[s.id] || s.title
        })).concat([{ value: model.npm.length, label: "npm" }])} />

        <CollapsibleSection id="ov-location" title="Localização" icon="folder outline">
            <div className="pdx-props__grid">
                {
                    location.map((l) =>
                        <React.Fragment key={l.label}>
                            <div className="pdx-props__key">{l.label}</div>
                            <div className="pdx-props__value"><span style={{fontSize:12}}>{l.value}</span></div>
                        </React.Fragment>)
                }
                <div className="pdx-props__key">caminho</div>
                <div className="pdx-props__value"><CopyableCodeValue value={identity.path} type="path" /></div>
                {
                    identity.namespace &&
                    <>
                        <div className="pdx-props__key">namespace</div>
                        <div className="pdx-props__value"><CopyableCodeValue value={identity.namespace} type="reference" /></div>
                    </>
                }
            </div>
        </CollapsibleSection>

        {
            model.sections.length > 0 &&
            <CollapsibleSection id="ov-capabilities" title="Capacidades" icon="cubes" count={model.sections.length}>
                <div className="pdx-inline">
                    { model.boot &&
                        <button type="button" className="pdx-chip" onClick={() => onOpenSection("boot")}>
                            <Icon name="rocket" style={{margin:0}} />boot
                        </button> }
                    {
                        model.sections.map((s) =>
                            <button key={s.id} type="button" className="pdx-chip" onClick={() => onOpenSection(s.id)}>
                                <Icon name={s.icon as any} style={{margin:0}} />
                                {SECTION_LABEL[s.id] || s.title}
                                <span className="pdx-chip__count">{s.items.length}</span>
                            </button>)
                    }
                </div>
            </CollapsibleSection>
        }

        {
            model.packageRefs.length > 0 &&
            <CollapsibleSection id="ov-refs" title="Dependências internas" icon="sitemap" count={model.packageRefs.length}>
                <div className="pdx-inline">
                    {
                        model.packageRefs.map((ref) =>
                            <CopyableCodeValue key={ref} value={ref} type="reference" refTarget={ref} onOpenRef={onOpenRef} />)
                    }
                </div>
            </CollapsibleSection>
        }

        {
            model.npm.length > 0 &&
            <CollapsibleSection id="ov-npm" title="Dependências npm" icon="cube" count={model.npm.length} defaultOpen={false}>
                <div className="pdx-props__grid">
                    {
                        model.npm.map((dep) =>
                            <React.Fragment key={dep.name}>
                                <div className="pdx-props__key pdx-mono">{dep.name}</div>
                                <div className="pdx-props__value"><CopyableCodeValue value={dep.range} type="text" /></div>
                            </React.Fragment>)
                    }
                </div>
            </CollapsibleSection>
        }

        {
            model.issues.length > 0 &&
            <CollapsibleSection id="ov-issues" title="Validação" icon="warning sign" count={model.issues.length}>
                <IssueList issues={model.issues} />
            </CollapsibleSection>
        }

        {
            model.metadataFiles.length > 0 &&
            <CollapsibleSection id="ov-files" title="Arquivos de metadado" icon="file code outline"
                count={model.metadataFiles.length} defaultOpen={false}>
                <div className="pdx-inline">
                    { model.metadataFiles.map((f) => <CopyableCodeValue key={f} value={f} type="path" />) }
                </div>
            </CollapsibleSection>
        }

        {
            (identity.author || identity.license || identity.version) &&
            <CollapsibleSection id="ov-pkg" title="Publicação" icon="tag" defaultOpen={false}>
                <div className="pdx-inline">
                    { identity.version && <Badge tone="version">v{identity.version}</Badge> }
                    { identity.license && <Badge>{identity.license}</Badge> }
                    { identity.author && <span className="pdx-muted" style={{fontSize:12}}>{identity.author}</span> }
                </div>
            </CollapsibleSection>
        }
    </div>
}

export default PackageOverview
