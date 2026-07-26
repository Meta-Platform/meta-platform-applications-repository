import * as React from "react"

import { RuntimeItem } from "../../../Domain/packageModel"
import { referenceTarget } from "../../../Domain/values"
import ItemList, { Summary, defaultSummary } from "./ItemList"

// Serviços (fornecidos pelo pacote em services.json ou instanciados no boot).
// O resumo destaca o PROVEDOR — é a informação que falta quando se lê um boot.

const summarize = (item:RuntimeItem):Summary[] => {
    const provider = referenceTarget(item.raw && item.raw.dependency)
    const base = defaultSummary(item)
    return provider ? [{ label: "", value: provider } as Summary].concat(base) : base
}

const ServiceList = ({ items, selectedId, onSelect }:any) =>
    <ItemList items={items} selectedId={selectedId} onSelect={onSelect} summarize={summarize} />

export default ServiceList
