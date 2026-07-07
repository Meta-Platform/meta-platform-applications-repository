import * as React from "react"
import { Icon } from "semantic-ui-react"
import styled from "styled-components"

import {
    setListItem, addListItem, removeListItem,
    patchRecord, addRecord, removeRecord, moveRecord,
    objectToEntries, entriesToObject, setEntryKey, setEntryValue, addEntry, removeEntryAt,
    coerceNumber, isScalar
} from "./metadataFormLogic"

// ---- Elementos base (estilo limpo, tema-consciente) ----

const TextInput = styled.input`
    width: 100%;
    box-sizing: border-box;
    padding: 5px 9px;
    border: 1px solid var(--mp-line-faint, rgba(127,127,127,.28));
    border-radius: 6px;
    background: rgba(127,127,127,.07);
    color: inherit;
    font-size: .86em;
    font-family: inherit;
    &:focus { outline: none; border-color: var(--mp-accent, #14D6C8); box-shadow: 0 0 0 2px rgba(20,214,200,.2); }
    &::placeholder { opacity: .5; }
`
const IconBtn = styled.button`
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; flex-shrink: 0;
    border: 1px solid transparent; border-radius: 6px;
    background: transparent; color: var(--mp-text-secondary, #9aa4b2); cursor: pointer;
    &:hover:not(:disabled) { background: rgba(127,127,127,.14); }
    &:disabled { opacity: .35; cursor: default; }
    &.danger:hover:not(:disabled) { color: var(--mp-danger, #e0576b); }
    & > i.icon { margin: 0 !important; font-size: 13px; }
`
const AddBtn = styled.button`
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; margin-top: 2px;
    border: 1px dashed var(--mp-line-faint, rgba(127,127,127,.35));
    border-radius: 6px; background: transparent; color: var(--mp-text-secondary, #9aa4b2);
    font-size: .8em; cursor: pointer;
    &:hover { border-color: var(--mp-accent, #14D6C8); color: var(--mp-accent, #14D6C8); }
    & > i.icon { margin: 0 !important; }
`
const Row = styled.div` display: flex; align-items: center; gap: 6px; margin-bottom: 6px; `
const KVRow = styled.div`
    display: grid;
    grid-template-columns: minmax(90px, .6fr) 14px minmax(0, 1fr) 26px;
    align-items: center; gap: 6px; margin-bottom: 6px;
`
const Card = styled.div`
    border: 1px solid var(--mp-line-faint, rgba(127,127,127,.28));
    border-radius: 8px; overflow: hidden; margin-bottom: 10px;
    background: rgba(127,127,127,.035);
`
const CardHead = styled.div`
    display: flex; align-items: center; gap: 6px; padding: 5px 6px 5px 10px;
    background: rgba(127,127,127,.09); border-bottom: 1px solid var(--mp-line-faint, rgba(127,127,127,.28));
    & .title { flex: 1; font-weight: 600; font-size: .86em; color: var(--mp-accent, #14D6C8);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`
const CardBody = styled.div` padding: 8px 10px; `
const Field = styled.div`
    margin-bottom: 8px;
    & > label { display: block; font-size: .68em; text-transform: uppercase; letter-spacing: .04em; opacity: .55; margin-bottom: 3px; }
`
const Nested = styled.div` border-left: 2px solid var(--mp-line-faint, rgba(127,127,127,.25)); padding-left: 8px; `
const Preserved = styled.div` font-size: .72em; opacity: .5; margin-top: 4px; & > i.icon { margin-right: 3px; } `

// ---- Editor de lista de strings ----
export const StringListEditor = ({ value, onChange, placeholder }:any) => {
    const list:string[] = Array.isArray(value) ? value : []
    return <div>
        { list.map((item, i) =>
            <Row key={i}>
                <TextInput value={item} placeholder={placeholder}
                    onChange={(e:any) => onChange(setListItem(list, i, e.target.value))} />
                <IconBtn className="danger" title="Remover" onClick={() => onChange(removeListItem(list, i))}><Icon name="trash" /></IconBtn>
            </Row>) }
        <AddBtn onClick={() => onChange(addListItem(list))}><Icon name="plus" />Adicionar</AddBtn>
    </div>
}

// ---- Editor de objeto chave→valor ----
export const KeyValueEditor = ({ value, onChange }:any) => {
    const entries = objectToEntries(value)
    const commit = (next:any[]) => onChange(entriesToObject(next))
    return <div>
        { entries.map(([k, v]:any, i:number) =>
            <KVRow key={i}>
                <TextInput value={k} placeholder="chave"
                    onChange={(e:any) => commit(setEntryKey(entries, i, e.target.value))} />
                <span style={{textAlign:"center", opacity:0.4}}>:</span>
                {
                    isScalar(v)
                    ? <TextInput value={v != null ? v : ""} placeholder="valor"
                        onChange={(e:any) => commit(setEntryValue(entries, i, e.target.value))} />
                    : <span style={{fontSize:"0.75em", opacity:0.55}}><Icon name="lock" />objeto preservado</span>
                }
                <IconBtn className="danger" title="Remover" onClick={() => commit(removeEntryAt(entries, i))}><Icon name="trash" /></IconBtn>
            </KVRow>) }
        <AddBtn onClick={() => commit(addEntry(entries))}><Icon name="plus" />Adicionar</AddBtn>
    </div>
}

// Renderiza os campos de UM registro (sem card/lista) — para o form focado de um item.
export const RecordFields = ({ value, fields, onChange }:any) => {
    const it = value && typeof value === "object" && !Array.isArray(value) ? value : {}
    const known = fields.map((f:any) => f.key)
    const extra = Object.keys(it).filter((k) => known.indexOf(k) === -1)
    const patch = (key:string, val:any) => onChange({ ...it, [key]: val })
    return <div>
        {
            fields.map((f:any) =>
                <Field key={f.key}>
                    <label>{f.label}</label>
                    {
                        f.type === "stringlist" ? <Nested><StringListEditor value={it[f.key] || []} onChange={(x:any) => patch(f.key, x)} /></Nested>
                        : f.type === "keyvalue" ? <Nested><KeyValueEditor value={it[f.key] || {}} onChange={(x:any) => patch(f.key, x)} /></Nested>
                        : f.type === "number" ? <TextInput type="number" value={it[f.key] != null ? it[f.key] : ""} placeholder={f.placeholder}
                            onChange={(e:any) => patch(f.key, coerceNumber(e.target.value))} />
                        : <TextInput value={it[f.key] != null ? it[f.key] : ""} placeholder={f.placeholder}
                            onChange={(e:any) => patch(f.key, e.target.value)} />
                    }
                </Field>)
        }
        { extra.length > 0 && <Preserved><Icon name="lock" />preservados: {extra.join(", ")}</Preserved> }
    </div>
}

// ---- Editor de lista de registros (cards) ----
export const RecordListEditor = ({ value, fields, onChange, itemLabel, emptyItem }:any) => {
    const list:any[] = Array.isArray(value) ? value : []
    return <div>
        {
            list.map((it:any, i:number) => {
                const known = fields.map((f:any) => f.key)
                const extra = Object.keys(it || {}).filter((k) => known.indexOf(k) === -1)
                return <Card key={i}>
                    <CardHead>
                        <span className="title">{itemLabel ? itemLabel(it, i) : `#${i + 1}`}</span>
                        <IconBtn title="Mover para cima"  onClick={() => onChange(moveRecord(list, i, -1))}><Icon name="chevron up" /></IconBtn>
                        <IconBtn title="Mover para baixo" onClick={() => onChange(moveRecord(list, i, 1))}><Icon name="chevron down" /></IconBtn>
                        <IconBtn className="danger" title="Remover" onClick={() => onChange(removeRecord(list, i))}><Icon name="trash" /></IconBtn>
                    </CardHead>
                    <CardBody>
                        {
                            fields.map((f:any) =>
                                <Field key={f.key}>
                                    <label>{f.label}</label>
                                    {
                                        f.type === "stringlist"
                                        ? <Nested><StringListEditor value={it[f.key] || []} onChange={(x:any) => onChange(patchRecord(list, i, f.key, x))} /></Nested>
                                        : f.type === "keyvalue"
                                        ? <Nested><KeyValueEditor value={it[f.key] || {}} onChange={(x:any) => onChange(patchRecord(list, i, f.key, x))} /></Nested>
                                        : f.type === "number"
                                        ? <TextInput type="number" value={it[f.key] != null ? it[f.key] : ""} placeholder={f.placeholder}
                                            onChange={(e:any) => onChange(patchRecord(list, i, f.key, coerceNumber(e.target.value)))} />
                                        : <TextInput value={it[f.key] != null ? it[f.key] : ""} placeholder={f.placeholder}
                                            onChange={(e:any) => onChange(patchRecord(list, i, f.key, e.target.value))} />
                                    }
                                </Field>)
                        }
                        { extra.length > 0 && <Preserved><Icon name="lock" />preservados: {extra.join(", ")}</Preserved> }
                    </CardBody>
                </Card>
            })
        }
        <AddBtn onClick={() => onChange(addRecord(list, emptyItem))}><Icon name="plus" />Adicionar</AddBtn>
    </div>
}
