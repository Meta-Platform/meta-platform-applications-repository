import * as React from "react"
import { Icon } from "semantic-ui-react"

import { WorkItem } from "../api/types"
import { SoftwareContextFields } from "../api/items"

const ENVIRONMENTS = ["", "local", "dev", "staging", "homologation", "production"]

interface SoftwareContextSectionProps {
    item: WorkItem
    onSave: (input: SoftwareContextFields) => void
}

// SoftwareContextSection (feature 2): edição do contexto de software do item.
const SoftwareContextSection = ({ item, onSave }: SoftwareContextSectionProps) => {
    const rev = item.updatedAt || ""

    const textField = (label: string, field: keyof SoftwareContextFields, placeholder?: string) =>
        <div className="mpm-field">
            <span className="mpm-field__label">{label}</span>
            <input className="mpm-input" placeholder={placeholder}
                defaultValue={(item as any)[field] || ""}
                key={`${field}-${item.id}-${rev}`}
                onBlur={(e) => {
                    if (e.target.value !== ((item as any)[field] || ""))
                        onSave({ [field]: e.target.value } as SoftwareContextFields)
                }} />
        </div>

    return <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="code branch" /> Contexto de software</div>
        {textField("Repositório", "repositoryUrl", "https://...")}
        <div className="mpm-row mpm-gap-4">
            {textField("Branch", "branchName")}
            {textField("Commit", "commitHash")}
        </div>
        {textField("Pull request", "pullRequestUrl", "https://...")}
        <div className="mpm-field">
            <span className="mpm-field__label">Ambiente</span>
            <select className="mpm-inline-select" value={item.environment || ""}
                onChange={(e) => onSave({ environment: e.target.value })}>
                {ENVIRONMENTS.map((env) => <option key={env || "none"} value={env}>{env || "—"}</option>)}
            </select>
        </div>
        {textField("Caminho do pacote", "packagePath")}
        <div className="mpm-row mpm-gap-4">
            {textField("Módulo", "moduleName")}
            {textField("Camada", "layerName")}
            {textField("Grupo", "groupName")}
        </div>
    </div>
}

export default SoftwareContextSection
