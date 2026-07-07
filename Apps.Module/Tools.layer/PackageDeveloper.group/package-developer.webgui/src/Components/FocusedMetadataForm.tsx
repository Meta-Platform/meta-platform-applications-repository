import * as React from "react"

import { StringListEditor, RecordListEditor, KeyValueEditor, RecordFields } from "./MetadataFormControls"
import { BootForm, CommandTree } from "./MetadataForms"

const labelFor = (fields:any[], it:any) => {
    if(!fields || !fields.length || !it) return "item"
    for(const f of fields){ if(it[f.key]) return it[f.key] }
    return "item"
}

// Renderiza o formulário FOCADO de um item de metadados (fatia de um arquivo JSON),
// escolhido pelo `kind` do item selecionado na árvore.
const FocusedMetadataForm = ({ detail, value, onChange }:any) => {
    const kind = detail && detail.kind
    switch(kind){
        case "boot":     return <BootForm value={value} onChange={onChange} />
        case "strings":  return <StringListEditor value={value || []} onChange={onChange} />
        case "keyvalue": return <KeyValueEditor value={value || {}} onChange={onChange} />
        case "commands": return <CommandTree list={value || []} onChange={onChange} />
        case "list":     return <RecordListEditor value={value || []} fields={detail.fields}
                                    emptyItem={detail.emptyItem || {}} itemLabel={(it:any) => labelFor(detail.fields, it)} onChange={onChange} />
        case "record":   return <RecordFields value={value || {}} fields={detail.fields} onChange={onChange} />
        default:         return <BootForm value={value} onChange={onChange} />
    }
}

export default FocusedMetadataForm
