import * as React from "react"

import { PropertyGroup } from "../../../Domain/values"
import CopyableCodeValue from "./CopyableCodeValue"

// Lista de propriedades técnicas: grupos rotulados (identidade, implementação,
// params, bound-params…) em grade chave→valor. Grupos e entradas já chegam sem
// vazios (Domain/values); aqui não há decisão de conteúdo, só de forma.

type Props = {
    groups     : PropertyGroup[]
    onOpenRef? : (target:string) => void
}

const TechnicalPropertyList = ({ groups, onOpenRef }:Props) => {
    const visible = (groups || []).filter((g) => g.entries.length > 0)
    if(!visible.length) return null
    return <div className="pdx-props">
        {
            visible.map((group) =>
                <div className="pdx-props__group" key={group.label}>
                    <div className="pdx-props__label">{group.label}</div>
                    <div className="pdx-props__grid">
                        {
                            group.entries.map((entry, i) =>
                                <React.Fragment key={`${entry.label}-${i}`}>
                                    <div className="pdx-props__key">{entry.label}</div>
                                    <div className="pdx-props__value">
                                        <CopyableCodeValue value={entry.value} type={entry.type}
                                            refTarget={entry.refTarget} onOpenRef={onOpenRef} />
                                    </div>
                                </React.Fragment>)
                        }
                    </div>
                </div>)
        }
    </div>
}

export default TechnicalPropertyList
