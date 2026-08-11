import * as React from "react"
import { useState } from "react"
import { Icon, Button, IconButton, TextInput, Tabs } from "@i-components"

import {
    setListItem, addListItem, removeListItem,
    patchRecord, addRecord, removeRecord, moveRecord,
    objectToEntries, entriesToObject, setEntryKey, setEntryValue, addEntry, removeEntryAt,
    coerceNumber, isScalar
} from "./metadataFormLogic"
import { validateField } from "./metadataSchema"


// Rótulo curto do tipo do campo (badge).
const TYPE_BADGE:any = { reference:"ref", number:"num", path:"path", boolean:"bool", enum:"enum" }
// Mensagem de validação abaixo do campo.
const FieldMsg = ({ issue }:any) => issue
    ? <div className={`pdx-form-msg pdx-form-msg--${issue.level === "error" ? "error" : "warning"}`}>
        <Icon name={issue.level === "error" ? "times circle" : "warning circle"} />{issue.message}
      </div>
    : null
// Estilo de borda por severidade.
const issueBorder = (issue:any) => issue
    ? { borderColor: issue.level === "error" ? "var(--mp-danger)" : "var(--mp-warning)" }
    : undefined

// ---- Elementos base ----
// A caixa (linhas, cards, campos, blocos aninhados) vive em
// Styles/components.css, escopada em `.pdx-form-*`; os controles
// (entrada, botão, botão-ícone, abas) são do kit @i-components.

// Campo de referência/caminho (ganha botão de copiar + dica de tipo).
const refLike = (key:string, val:any) =>
    /^(dependency|namespace)$/i.test(key || "") || /path$/i.test(key || "") || /^@@?\//.test(String(val == null ? "" : val))
const copyVal = (v:any) => { try { navigator.clipboard && navigator.clipboard.writeText(String(v == null ? "" : v)) } catch(_) {} }

// Rótulo do campo: nome + marca de obrigatório + selo do tipo.
const FieldLabel = ({ field }:any) => <label>
    {field.label}
    { field.required && <span title="obrigatório" className="pdx-form-required">*</span> }
    { field.type && TYPE_BADGE[field.type] && <span className="pdx-form-typehint">{TYPE_BADGE[field.type]}</span> }
</label>

// ---- Editor de lista de strings ----
export const StringListEditor = ({ value, onChange, placeholder }:any) => {
    const list:string[] = Array.isArray(value) ? value : []
    return <div>
        { list.map((item, i) =>
            <div className="pdx-form-row" key={i}>
                <TextInput className="pdx-form-input" value={item} placeholder={placeholder}
                    onChange={(e:any) => onChange(setListItem(list, i, e.target.value))} />
                <IconButton icon="trash" label="Remover" size="sm"
                    className="pdx-form-iconbtn pdx-form-iconbtn--danger"
                    onClick={() => onChange(removeListItem(list, i))} />
            </div>) }
        <Button variant="subtle" size="sm" icon="plus" className="pdx-form-addbtn"
            onClick={() => onChange(addListItem(list))}>Adicionar</Button>
    </div>
}

// ---- Editor de objeto chave→valor ----
export const KeyValueEditor = ({ value, onChange }:any) => {
    const entries = objectToEntries(value)
    const commit = (next:any[]) => onChange(entriesToObject(next))
    return <div>
        { entries.map(([k, v]:any, i:number) =>
            <div className="pdx-form-kvrow" key={i}>
                <TextInput className="pdx-form-input" value={k} placeholder="chave"
                    onChange={(e:any) => commit(setEntryKey(entries, i, e.target.value))} />
                <span className="pdx-form-kvrow__sep">:</span>
                {
                    isScalar(v)
                    ? <TextInput className="pdx-form-input" value={v != null ? v : ""} placeholder="valor"
                        onChange={(e:any) => commit(setEntryValue(entries, i, e.target.value))} />
                    : <span className="pdx-form-kvrow__opaque"><Icon name="lock" />objeto preservado</span>
                }
                <IconButton icon="trash" label="Remover" size="sm"
                    className="pdx-form-iconbtn pdx-form-iconbtn--danger"
                    onClick={() => commit(removeEntryAt(entries, i))} />
            </div>) }
        <Button variant="subtle" size="sm" icon="plus" className="pdx-form-addbtn"
            onClick={() => commit(addEntry(entries))}>Adicionar</Button>
    </div>
}

// Renderiza os campos de UM registro (sem card/lista) — para o form focado de um
// item. Divide em SUB-TABS: "Geral" (campos simples) + uma aba por campo aninhado
// (params, bound-params, …), evitando scroll longo.
export const RecordFields = ({ value, fields, onChange }:any) => {
    const it = value && typeof value === "object" && !Array.isArray(value) ? value : {}
    const known = fields.map((f:any) => f.key)
    const extra = Object.keys(it).filter((k) => known.indexOf(k) === -1)
    const patch = (key:string, val:any) => onChange({ ...it, [key]: val })

    const scalars = fields.filter((f:any) => f.type !== "keyvalue" && f.type !== "stringlist")
    const nested  = fields.filter((f:any) => f.type === "keyvalue" || f.type === "stringlist")

    const renderScalar = (f:any) => {
        const val = it[f.key]
        const isRef = f.type === "reference" || f.type === "path" || refLike(f.key, val)
        const issue = validateField(f, val)
        return <div className="pdx-form-field" key={f.key}>
            <FieldLabel field={f} />
            <div className="pdx-form-row" style={{marginBottom:0}}>
                {
                    f.type === "number"
                    ? <TextInput className="pdx-form-input" type="number" style={issueBorder(issue)} value={val != null ? val : ""} placeholder={f.placeholder}
                        onChange={(e:any) => patch(f.key, coerceNumber(e.target.value))} />
                    : <TextInput className="pdx-form-input" style={issueBorder(issue)} value={val != null ? val : ""} placeholder={f.placeholder}
                        onChange={(e:any) => patch(f.key, e.target.value)} />
                }
                { isRef && <IconButton icon="copy outline" label="Copiar" size="sm"
                    className="pdx-form-iconbtn" onClick={() => copyVal(val)} /> }
            </div>
            <FieldMsg issue={issue} />
        </div>
    }
    const renderNested = (f:any) =>
        f.type === "stringlist"
            ? <StringListEditor value={it[f.key] || []} onChange={(x:any) => patch(f.key, x)} />
            : <KeyValueEditor value={it[f.key] || {}} onChange={(x:any) => patch(f.key, x)} />

    const subtabs = [ ...(scalars.length ? [{ key:"__geral", label:"Geral" }] : []), ...nested.map((f:any) => ({ key:f.key, label:f.label })) ]
    const [tab, setTab] = useState<string>(subtabs[0] ? subtabs[0].key : "")
    const active = subtabs.some((t) => t.key === tab) ? tab : (subtabs[0] ? subtabs[0].key : "")

    const preserved = extra.length > 0
        ? <div className="pdx-form-preserved"><Icon name="lock" />preservados: {extra.join(", ")}</div>
        : null

    if(subtabs.length <= 1)
        return <div>{ fields.map((f:any) => nested.indexOf(f) > -1
            ? <div className="pdx-form-field" key={f.key}><label>{f.label}</label><div className="pdx-form-nested">{renderNested(f)}</div></div>
            : renderScalar(f)) }{preserved}</div>

    return <div>
        <Tabs className="pdx-form-subtabs" tabs={subtabs} activeKey={active} onChange={(key:string) => setTab(key)} />
        { active === "__geral" ? scalars.map(renderScalar) : renderNested(nested.find((f:any) => f.key === active) || nested[0]) }
        {preserved}
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
                return <div className="pdx-form-card" key={i}>
                    <div className="pdx-form-card__head">
                        <span className="pdx-form-card__title">{itemLabel ? itemLabel(it, i) : `#${i + 1}`}</span>
                        <IconButton icon="chevron up"   label="Mover para cima"  size="sm" className="pdx-form-iconbtn" onClick={() => onChange(moveRecord(list, i, -1))} />
                        <IconButton icon="chevron down" label="Mover para baixo" size="sm" className="pdx-form-iconbtn" onClick={() => onChange(moveRecord(list, i, 1))} />
                        <IconButton icon="trash"        label="Remover"          size="sm" className="pdx-form-iconbtn pdx-form-iconbtn--danger" onClick={() => onChange(removeRecord(list, i))} />
                    </div>
                    <div className="pdx-form-card__body">
                        {
                            fields.map((f:any) => {
                                const nested = f.type === "stringlist" || f.type === "keyvalue"
                                const issue = nested ? null : validateField(f, it[f.key])
                                return <div className="pdx-form-field" key={f.key}>
                                    <FieldLabel field={f} />
                                    {
                                        f.type === "stringlist"
                                        ? <div className="pdx-form-nested"><StringListEditor value={it[f.key] || []} onChange={(x:any) => onChange(patchRecord(list, i, f.key, x))} /></div>
                                        : f.type === "keyvalue"
                                        ? <div className="pdx-form-nested"><KeyValueEditor value={it[f.key] || {}} onChange={(x:any) => onChange(patchRecord(list, i, f.key, x))} /></div>
                                        : f.type === "number"
                                        ? <TextInput className="pdx-form-input" type="number" style={issueBorder(issue)} value={it[f.key] != null ? it[f.key] : ""} placeholder={f.placeholder}
                                            onChange={(e:any) => onChange(patchRecord(list, i, f.key, coerceNumber(e.target.value)))} />
                                        : <TextInput className="pdx-form-input" style={issueBorder(issue)} value={it[f.key] != null ? it[f.key] : ""} placeholder={f.placeholder}
                                            onChange={(e:any) => onChange(patchRecord(list, i, f.key, e.target.value))} />
                                    }
                                    <FieldMsg issue={issue} />
                                </div>
                            })
                        }
                        { extra.length > 0 && <div className="pdx-form-preserved"><Icon name="lock" />preservados: {extra.join(", ")}</div> }
                    </div>
                </div>
            })
        }
        <Button variant="subtle" size="sm" icon="plus" className="pdx-form-addbtn"
            onClick={() => onChange(addRecord(list, emptyItem))}>Adicionar</Button>
    </div>
}
