import * as React from "react"
import { Button, Icon, Input } from "semantic-ui-react"

import {
    setListItem, addListItem, removeListItem,
    patchRecord, addRecord, removeRecord, moveRecord,
    objectToEntries, entriesToObject, setEntryKey, setEntryValue, addEntry, removeEntryAt,
    coerceNumber, isScalar
} from "./metadataFormLogic"

// Editor de objeto chave→valor (params, bound-params, …). Valores escalares são
// editáveis; objetos/arrays aninhados são PRESERVADOS (mostrados como bloqueados).
export const KeyValueEditor = ({ value, onChange }:any) => {
    const entries = objectToEntries(value)
    const commit = (next:any[]) => onChange(entriesToObject(next))
    return <div>
        {
            entries.map(([k, v]:any, i:number) =>
                <div key={i} style={{display:"flex", gap:4, marginBottom:4, alignItems:"center"}}>
                    <Input size="mini" value={k} placeholder="chave" style={{flex:1}}
                        onChange={(e:any) => commit(setEntryKey(entries, i, e.target.value))} />
                    <span style={{opacity:0.4}}>:</span>
                    {
                        isScalar(v)
                        ? <Input size="mini" value={v != null ? v : ""} placeholder="valor" style={{flex:1.4}}
                            onChange={(e:any) => commit(setEntryValue(entries, i, e.target.value))} />
                        : <span style={{flex:1.4, fontSize:"0.75em", opacity:0.55}}><Icon name="lock" />objeto preservado</span>
                    }
                    <Button size="mini" basic icon="trash" onClick={() => commit(removeEntryAt(entries, i))} />
                </div>)
        }
        <Button size="mini" basic icon="plus" content="Adicionar" onClick={() => commit(addEntry(entries))} />
    </div>
}

// Editor de lista de strings (adicionar / remover / editar).
export const StringListEditor = ({ value, onChange, placeholder }:any) => {
    const list:string[] = Array.isArray(value) ? value : []
    return <div>
        {
            list.map((item, i) =>
                <div key={i} style={{display:"flex", gap:6, marginBottom:4}}>
                    <Input size="mini" value={item} placeholder={placeholder} style={{flex:1}}
                        onChange={(e:any) => onChange(setListItem(list, i, e.target.value))} />
                    <Button size="mini" basic icon="trash" onClick={() => onChange(removeListItem(list, i))} />
                </div>)
        }
        <Button size="mini" basic icon="plus" content="Adicionar" onClick={() => onChange(addListItem(list))} />
    </div>
}

// Editor de lista de registros. `fields` = [{key, label, placeholder, type?}].
// type "stringlist" renderiza um StringListEditor aninhado. Campos não listados
// são PRESERVADOS (spread) e mostrados como "preservados" — nunca há perda.
export const RecordListEditor = ({ value, fields, onChange, itemLabel, emptyItem }:any) => {
    const list:any[] = Array.isArray(value) ? value : []
    return <div>
        {
            list.map((it:any, i:number) => {
                const known = fields.map((f:any) => f.key)
                const extra = Object.keys(it || {}).filter((k) => known.indexOf(k) === -1)
                return <div key={i} style={{border:"1px solid var(--mp-line-faint)", borderRadius:6, padding:8, marginBottom:8}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
                        <strong style={{opacity:0.7, fontSize:"0.85em"}}>{itemLabel ? itemLabel(it, i) : `#${i+1}`}</strong>
                        <div>
                            <Button size="mini" basic icon="arrow up"   onClick={() => onChange(moveRecord(list, i, -1))} />
                            <Button size="mini" basic icon="arrow down" onClick={() => onChange(moveRecord(list, i, 1))} />
                            <Button size="mini" basic icon="trash" color="red" onClick={() => onChange(removeRecord(list, i))} />
                        </div>
                    </div>
                    {
                        fields.map((f:any) =>
                            <div key={f.key} style={{marginBottom:6}}>
                                <label style={{fontSize:"0.78em", opacity:0.7, display:"block", marginBottom:2}}>{f.label}</label>
                                {
                                    f.type === "stringlist"
                                    ? <StringListEditor value={it[f.key] || []} onChange={(x:any) => onChange(patchRecord(list, i, f.key, x))} />
                                    : f.type === "keyvalue"
                                    ? <KeyValueEditor value={it[f.key] || {}} onChange={(x:any) => onChange(patchRecord(list, i, f.key, x))} />
                                    : f.type === "number"
                                    ? <Input size="mini" fluid type="number" value={it[f.key] != null ? it[f.key] : ""} placeholder={f.placeholder}
                                        onChange={(e:any) => onChange(patchRecord(list, i, f.key, coerceNumber(e.target.value)))} />
                                    : <Input size="mini" fluid value={it[f.key] != null ? it[f.key] : ""} placeholder={f.placeholder}
                                        onChange={(e:any) => onChange(patchRecord(list, i, f.key, e.target.value))} />
                                }
                            </div>)
                    }
                    {
                        extra.length > 0 &&
                        <div style={{fontSize:"0.72em", opacity:0.5, marginTop:4}}>
                            <Icon name="lock" /> preservados: {extra.join(", ")}
                        </div>
                    }
                </div>
            })
        }
        <Button size="mini" basic icon="plus" content="Adicionar" onClick={() => onChange(addRecord(list, emptyItem))} />
    </div>
}
