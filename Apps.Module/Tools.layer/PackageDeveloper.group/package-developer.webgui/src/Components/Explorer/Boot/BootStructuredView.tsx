import * as React from "react"

import { PackageModel, SectionId } from "../../../Domain/packageModel"
import { CollapsibleSection, EmptyState, Metrics } from "../ui/Primitives"
import { IssueList } from "../ui/ValidationBadge"
import SectionView from "../Runtime/SectionView"

// Boot em forma ESTRUTURADA: um resumo com o que realmente existe, seguido das
// seções recolhíveis. Sem blocos repetidos e sem seção vazia — o objetivo é dar
// o modelo mental do boot em uma tela.

const BOOT_SECTIONS:SectionId[] = ["boot-params", "boot-services", "boot-executables", "boot-endpoints", "boot-windows"]

const LABEL:any = {
    "boot-params"     : "parâmetros",
    "boot-services"   : "serviços",
    "boot-executables": "executáveis",
    "boot-endpoints"  : "endpoints",
    "boot-windows"    : "janelas"
}

type Props = {
    model       : PackageModel
    selectedId? : string
    onSelectItem: (itemId:string) => void
    onOpenRef?  : (target:string) => void
    workspace?  : string
}

const BootStructuredView = ({ model, selectedId, onSelectItem, onOpenRef, workspace }:Props) => {

    const sections = model.sections.filter((s) => BOOT_SECTIONS.indexOf(s.id) > -1)
    if(!model.boot)
        return <EmptyState icon="rocket" title="Este pacote não declara boot"
            hint="Nada a mostrar: metadata/boot.json não existe." />

    const bootIssues = model.issues.filter((i) => i.file === "metadata/boot.json")
    const providers:string[] = []
    sections.forEach((s) => s.items.forEach((i) => i.refs.forEach((r) => { if(providers.indexOf(r) < 0) providers.push(r) })))

    return <div>
        <Metrics items={sections.map((s) => ({ value: s.items.length, label: LABEL[s.id] || s.title }))
            .concat([{ value: providers.length, label: "dependências" },
                     { value: bootIssues.length, label: "problemas" }])} />

        { bootIssues.length > 0 &&
            <div style={{marginBottom:16}}><IssueList issues={bootIssues} /></div> }

        {
            sections.map((section) =>
                <CollapsibleSection key={section.id} id={section.id} icon={section.icon}
                    title={section.title} count={section.items.length}>
                    <SectionView section={section} selectedId={selectedId} onSelect={onSelectItem}
                        onOpenRef={onOpenRef} workspace={workspace} pkg={model.identity} />
                </CollapsibleSection>)
        }
    </div>
}

export default BootStructuredView
