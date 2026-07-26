import * as React from "react"
import { Icon } from "semantic-ui-react"

import { PackageModel, RuntimeItem } from "../../../Domain/packageModel"
import TechnicalPropertyList from "../ui/TechnicalPropertyList"
import CopyableCodeValue from "../ui/CopyableCodeValue"
import { IssueList } from "../ui/ValidationBadge"
import { Badge, CollapsibleSection } from "../ui/Primitives"
import EndpointRoutes from "./EndpointRoutes"

// Detalhe de UM recurso do runtime (serviço, executável, endpoint, comando,
// parâmetro, janela). A estrutura é sempre a mesma — identidade, propriedades,
// relacionamentos, origem — para que o usuário aprenda a ler uma vez só.

type Props = {
    item        : RuntimeItem
    model       : PackageModel
    workspace?  : string
    onOpenRef?  : (target:string) => void
    onSelectItem?: (itemId:string) => void
}

const KIND_LABEL:any = {
    "boot-service"   : "serviço do boot",
    "boot-executable": "executável",
    "boot-endpoint"  : "endpoint do boot",
    "boot-window"    : "janela",
    "boot-param"     : "parâmetro do boot",
    "service"        : "serviço fornecido",
    "endpoint"       : "endpoint",
    "command"        : "comando",
    "startup-param"  : "startup param"
}

const ItemDetail = ({ item, model, workspace, onOpenRef, onSelectItem }:Props) => {

    const providers = item.refs.filter((r) => r !== `${model.identity.name}.${model.identity.ext}`)
    const children = item.children || []
    // Endpoint do tipo controller: as rotas (com método HTTP) vêm do api-template.
    const apiTemplate = item.kind === "endpoint" && item.raw && item.raw.params
        ? item.raw.params["api-template"]
        : undefined

    return <div>
        <div className="pdx-ident" style={{marginBottom:12}}>
            <Icon name={item.icon as any} className="pdx-ident__icon" size="large" style={{color:"var(--mp-muted)"}} />
            <div className="pdx-ident__main">
                <div className="pdx-ident__name pdx-mono">{item.title}</div>
                <div className="pdx-ident__badges">
                    <Badge>{KIND_LABEL[item.kind] || item.kind}</Badge>
                    { item.subtitle && <span className="pdx-muted" style={{fontSize:12}}>{item.subtitle}</span> }
                </div>
            </div>
        </div>

        <TechnicalPropertyList groups={item.groups} onOpenRef={onOpenRef} />

        {
            providers.length > 0 &&
            <div style={{marginTop:14}}>
                <div className="pdx-props__label">pacotes relacionados</div>
                <div className="pdx-inline">
                    {
                        providers.map((ref) =>
                            <CopyableCodeValue key={ref} value={ref} type="reference"
                                refTarget={ref} onOpenRef={onOpenRef} />)
                    }
                </div>
            </div>
        }

        {
            children.length > 0 &&
            <div style={{marginTop:16}}>
                <CollapsibleSection id={`children-${item.id}`} title="subcomandos" count={children.length} icon="terminal">
                    <div>
                        {
                            children.map((child) =>
                                <button key={child.id} type="button" className="pdx-card pdx-card--clickable"
                                    style={{display:"block", width:"100%", marginBottom:8}}
                                    onClick={() => onSelectItem && onSelectItem(child.id)}>
                                    <div className="pdx-card__head">
                                        <Icon name="terminal" style={{margin:0, color:"var(--mp-muted)"}} />
                                        <span className="pdx-card__title">{child.title}</span>
                                    </div>
                                    { child.subtitle &&
                                        <div className="pdx-card__body" style={{fontSize:12, color:"var(--mp-muted)"}}>{child.subtitle}</div> }
                                </button>)
                        }
                    </div>
                </CollapsibleSection>
            </div>
        }

        {
            apiTemplate && workspace &&
            <div style={{marginTop:16}}>
                <EndpointRoutes workspace={workspace} pkg={model.identity}
                    apiTemplate={apiTemplate} baseUrl={item.raw && item.raw.url} />
            </div>
        }

        { item.issues.length > 0 &&
            <div style={{marginTop:16}}><IssueList issues={item.issues} /></div> }

        <div style={{marginTop:16}}>
            <div className="pdx-props__label">origem</div>
            <CopyableCodeValue value={item.file} type="path" />
        </div>
    </div>
}

export default ItemDetail
