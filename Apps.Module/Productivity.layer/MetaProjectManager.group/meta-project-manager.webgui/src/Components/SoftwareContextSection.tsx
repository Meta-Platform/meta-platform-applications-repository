import * as React from "react"
import { Icon } from "semantic-ui-react"

import { WorkItem } from "../api/types"
import { SoftwareContextFields } from "../api/items"

const ENVIRONMENTS = ["", "local", "dev", "staging", "homologation", "production"]

interface SoftwareContextSectionProps {
    item: WorkItem
    onSave: (input: SoftwareContextFields) => void
}

// Contexto de ENTREGA: como o trabalho foi (ou será) entregue — branch, commit,
// pull request, ambiente. "Onde se mexe" é outra pergunta, respondida pelo
// EcosystemContextSection (pacote na hierarquia da Meta Platform).
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
        <div className="mpm-section-title"><Icon name="code branch" /> Entrega</div>
        {textField("Repositório (URL)", "repositoryUrl", "https://...")}
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
    </div>
}

export default SoftwareContextSection
