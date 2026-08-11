import * as React from "react"
import { Icon } from "@i-components"

import { IndexedPackage } from "../../Domain/packageIndex"
import { relativePackagePath } from "../../Domain/packageModel"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import PackageIcon from "../PackageIcon"
import { Badge, CollapsibleSection, Metrics } from "./ui/Primitives"
import { IssueBadges } from "./ui/ValidationBadge"

// Inspeção de um container da hierarquia (Module/Layer/Group): o que ele agrega.
// Existe para que a coluna de estrutura também tenha detalhe correspondente — a
// regra é: tudo que se seleciona tem uma view.

type Props = {
    kind      : string
    label     : string
    path      : string
    packages  : IndexedPackage[]
    onOpenPackage : (path:string) => void
}

const KIND_LABEL:any = { module: "módulo", layer: "layer", group: "grupo" }

const ContainerView = ({ kind, label, path, packages, onOpenPackage }:Props) => {

    const byType:{[ext:string]:number} = {}
    packages.forEach((p) => { byType[p.ext] = (byType[p.ext] || 0) + 1 })
    const issues = packages.reduce((n, p) => n + p.errors + p.warnings, 0)

    return <div className="pdx-inspector">
        <div className="pdx-inspector__head">
            <div className="pdx-ident">
                <Icon name={kind === "group" ? "folder" : kind === "layer" ? "clone outline" : "cubes"}
                    size="large" className="pdx-ident__icon" style={{color:"var(--mp-muted)"}} />
                <div className="pdx-ident__main">
                    <div className="pdx-ident__name">{label}</div>
                    <div className="pdx-ident__badges">
                        <Badge tone="type">{KIND_LABEL[kind] || kind}</Badge>
                        { !!issues && <Badge tone="warning">{issues} problema(s)</Badge> }
                    </div>
                    <div className="pdx-ident__badges" style={{marginTop:6}}>
                        <CopyableCodeValue value={relativePackagePath(path) || path} copyValue={path}
                            title={path} type="path" />
                    </div>
                </div>
            </div>
        </div>

        <div className="pdx-inspector__body">
            <Metrics items={[{ value: packages.length, label: "pacotes" }]
                .concat(Object.keys(byType).sort().map((ext) => ({ value: byType[ext], label: ext })))} />

            {
                packages.length > 0 &&
                <CollapsibleSection id="container-packages" title="Pacotes" icon="cubes" count={packages.length}>
                    <div>
                        {
                            packages.map((pkg) =>
                                <button key={pkg.path} type="button" className="pdx-card pdx-card--clickable"
                                    style={{display:"block", width:"100%"}}
                                    onClick={() => onOpenPackage(pkg.path)}>
                                    <div className="pdx-card__head">
                                        <PackageIcon workspace={pkg.repository} name={pkg.name} ext={pkg.ext} size={16} />
                                        <span className="pdx-card__title">{pkg.dirname}</span>
                                        <IssueBadges issues={pkg.model.issues} compact />
                                    </div>
                                    { pkg.description &&
                                        <div className="pdx-card__body" style={{fontSize:12, color:"var(--mp-muted)"}}>
                                            {pkg.description}
                                        </div> }
                                </button>)
                        }
                    </div>
                </CollapsibleSection>
            }
        </div>
    </div>
}

export default ContainerView
