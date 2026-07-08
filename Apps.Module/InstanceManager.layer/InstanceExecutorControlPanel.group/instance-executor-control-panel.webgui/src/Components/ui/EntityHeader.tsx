import * as React from "react"
import { Icon, Label } from "semantic-ui-react"
import StatusBadge from "../StatusBadge"
import CopyableMonoText from "./CopyableMonoText"

// Cabeçalho canônico de entidade — usado por package, environment, socket,
// repository, config file, task. Estrutura única de apresentação (§9.3, §19).
// Design system: Meta System Retro-Brutalist UI (classe .mp-entity-header).
//
// props:
//   icon         nome do ícone semantic
//   iconNode     nó custom no slot do ícone (ex.: imagem do pacote) — sobrepõe `icon`
//   title        nome da entidade
//   subtitle     namespace/descrição (mono)
//   typeLabel    string curta (ex.: "application") — chip de tipo
//   status       string de status (renderiza StatusBadge; opcional)
//   badges       nó extra na linha do título (ex.: installed/debug)
//   meta         [{ label, value }] chips de metadados
//   technicalRef { label, value } dado técnico copiável (path/hash)
//   actions      nó com botões (ação primária à direita)
const EntityHeader = ({
    icon = "cube",
    iconNode,
    title,
    subtitle,
    typeLabel,
    status,
    badges,
    meta = [],
    technicalRef,
    actions
}:any) => {
    return <header className="mp-entity-header">
        <span className="mp-entity-header__icon">
            { iconNode || <Icon name={icon} style={{ margin: 0 }}/> }
        </span>

        <div className="mp-entity-header__body">
            <div className="mp-entity-header__titleline">
                <h2 className="mp-entity-header__title" title={title}>{title}</h2>
                { typeLabel && <Label basic size="small">{typeLabel}</Label> }
                { status && <StatusBadge status={status} size="small"/> }
                { badges }
            </div>

            { subtitle && <div className="mp-entity-header__subtitle" title={subtitle}>{subtitle}</div> }

            { (meta.length > 0 || technicalRef) &&
                <div className="mp-entity-header__meta">
                    {
                        meta.filter((m:any) => m && m.value !== undefined && m.value !== null)
                            .map((m:any, i:number) =>
                                <span key={i} className="mp-entity-header__metachip">
                                    { m.label && <span className="mp-entity-header__metalabel">{m.label}</span> }
                                    <span className="mp-entity-header__metavalue">{String(m.value)}</span>
                                </span>)
                    }
                    {
                        technicalRef &&
                        <span className="mp-entity-header__metachip">
                            { technicalRef.label && <span className="mp-entity-header__metalabel">{technicalRef.label}</span> }
                            <CopyableMonoText value={technicalRef.value} maxChars={technicalRef.maxChars || 48}/>
                        </span>
                    }
                </div>
            }
        </div>

        { actions && <div className="mp-entity-header__actions">{actions}</div> }
    </header>
}

export default EntityHeader
