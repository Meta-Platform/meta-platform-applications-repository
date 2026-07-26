import * as React from "react"

import { RuntimeSection } from "../../../Domain/packageModel"
import EndpointList from "./EndpointList"
import ServiceList from "./ServiceList"
import ItemList from "./ItemList"

// Escolhe a apresentação adequada ao tipo da seção: endpoints comparam melhor em
// tabela; serviços destacam o provedor; o resto usa a lista compacta padrão.

type Props = {
    section     : RuntimeSection
    selectedId? : string
    onSelect    : (itemId:string) => void
}

const SectionView = ({ section, selectedId, onSelect }:Props) => {
    if(section.id === "endpoints")
        return <EndpointList items={section.items} selectedId={selectedId} onSelect={onSelect} />
    if(section.id === "services" || section.id === "boot-services")
        return <ServiceList items={section.items} selectedId={selectedId} onSelect={onSelect} />
    return <ItemList items={section.items} selectedId={selectedId} onSelect={onSelect} />
}

export default SectionView
