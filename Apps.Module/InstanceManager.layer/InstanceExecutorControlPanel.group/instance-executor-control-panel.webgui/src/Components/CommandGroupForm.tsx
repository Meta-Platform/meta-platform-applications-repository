import * as React from "react"
import { useMemo, useState } from "react"

import { Button, Checkbox, Form, Icon, Input, Label, Message, Segment } from "semantic-ui-react"

import {
    BuildCommandLineArgs,
    BuildCommandTree,
    CommandEntry,
    CommandParameter,
    CommandSignature,
    FindCommandEntry,
    FlattenCommandTree,
    MissingPositionals
} from "../Utils/CommandGroup"

// Form de execução de um pacote CLI, montado a partir do `command-group.json`.
//
//   coluna 1  árvore de comandos declarados pelo pacote
//   coluna 2  campos do comando selecionado (posicionais e opções)
//   rodapé    preview da linha de comando + executar/encerrar
//
// Os posicionais são obrigatórios; as opções, não. Nós sem handler (`path`) são
// apenas agrupadores do yargs — aparecem como pasta e não podem ser executados.

const MUTED = { color: "var(--mp-muted)" }

const SectionTitle = ({ icon, children }:any) =>
    <div style={{ ...MUTED, fontSize: ".78em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: "4px 6px 8px" }}>
        <Icon name={icon}/> {children}
    </div>

const CommandNodeView = ({ entry, selectedId, onSelect }:any) => {

    const [ isOpen, setIsOpen ] = useState(entry.depth === 0)

    const hasChildren = entry.children.length > 0
    const isSelected  = entry.id === selectedId

    const handleClick = () => {
        if(entry.isExecutable) onSelect(entry.id)
        if(hasChildren && !entry.isExecutable) setIsOpen(!isOpen)
    }

    return <div>
        <div
            onClick={handleClick}
            title={entry.description || entry.label}
            style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "4px 6px", paddingLeft: `${6 + entry.depth * 12}px`,
                cursor: entry.isExecutable || hasChildren ? "pointer" : "default",
                borderRadius: "4px",
                background: isSelected ? "var(--mp-accent-soft, rgba(45,116,196,.12))" : undefined,
                boxShadow: isSelected ? "inset 3px 0 0 var(--mp-accent-blue)" : undefined,
                fontWeight: isSelected ? 700 : 400
            }}>
            {
                hasChildren
                ? <Icon
                    name={isOpen ? "caret down" : "caret right"}
                    onClick={(event:any) => { event.stopPropagation(); setIsOpen(!isOpen) }}
                    style={{ flex: "0 0 auto", margin: 0, ...MUTED }}/>
                : <span style={{ flex: "0 0 auto", width: "1.18em" }}/>
            }
            <Icon
                name={entry.isExecutable ? "terminal" : "folder"}
                style={{ flex: "0 0 auto", margin: 0, color: entry.isExecutable ? "var(--mp-accent-cyan)" : "var(--mp-accent-orange)" }}/>
            <span style={{
                flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                ...entry.isExecutable ? {} : MUTED
            }}>
                {entry.label}
            </span>
        </div>
        {
            isOpen &&
            entry.children.map((child:CommandEntry) =>
                <CommandNodeView key={child.id} entry={child} selectedId={selectedId} onSelect={onSelect}/>)
        }
    </div>
}

const ArrayField = ({ value, onChange }:any) => {

    const items:string[] = Array.isArray(value) && value.length > 0 ? value : [""]

    const _replace = (index:number, item:string) => onChange(items.map((current, position) => position === index ? item : current))

    return <>
        {
            items.map((item, index) =>
                <div key={index} style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                    <Input
                        size="mini"
                        fluid
                        style={{ flex: "1 1 auto" }}
                        value={item}
                        onChange={(event:any) => _replace(index, event.target.value)}/>
                    <Button
                        basic icon="minus" size="mini" type="button"
                        title="remover"
                        disabled={items.length === 1 && item === ""}
                        onClick={() => onChange(items.filter((_, position) => position !== index))}/>
                </div>)
        }
        <Button basic icon size="mini" type="button" onClick={() => onChange([ ...items, "" ])}>
            <Icon name="plus"/> valor
        </Button>
    </>
}

const ParameterField = ({ parameter, value, isRequired, onChange }:{
    parameter  : CommandParameter
    value      : any
    isRequired : boolean
    onChange   : (value:any) => void
}) => {

    const { key, valueType, describe } = parameter

    const label = <label style={{ marginBottom: "0px" }}>
        {parameter.paramType === "option" ? `--${key}` : key}
        { isRequired && <span style={{ color: "var(--mp-accent-red, #c00)" }} title="obrigatório"> *</span> }
        { describe && <span style={{ ...MUTED, fontWeight: 400, marginLeft: "6px", fontSize: ".9em" }}>{describe}</span> }
    </label>

    if(valueType === "boolean")
        return <Form.Field style={{ marginBottom: "7px" }}>
            <Checkbox
                label={`--${key}${describe ? ` — ${describe}` : ""}`}
                checked={value === true}
                onChange={(event:any, { checked }:any) => onChange(checked)}/>
        </Form.Field>

    if(valueType === "array")
        return <Form.Field style={{ marginBottom: "7px" }}>
            {label}
            <ArrayField value={value} onChange={onChange}/>
        </Form.Field>

    return <Form.Field style={{ marginBottom: "7px" }}>
        {label}
        <Input
            size="mini"
            type={valueType === "number" ? "number" : "text"}
            value={value === undefined ? "" : value}
            onChange={(event:any) => onChange(event.target.value)}/>
    </Form.Field>
}

const CommandGroupForm = ({
    commandGroup,
    executableName,
    status,
    onExecute,
    onKill
}:any) => {

    const commandTree = useMemo(() => BuildCommandTree(commandGroup), [commandGroup])

    const [ selectedId, setSelectedId ] = useState<string>()
    // Valores por comando: trocar de comando não pode apagar o que já foi digitado.
    const [ valuesByCommand, setValuesByCommand ] = useState<any>({})

    // Pré-seleciona o primeiro comando executável.
    const firstExecutableId = useMemo(() =>
        FlattenCommandTree(commandTree).find((entry) => entry.isExecutable)?.id,
    [commandTree])

    const activeId = selectedId || firstExecutableId
    const entry    = FindCommandEntry(commandTree, activeId)

    const values = (activeId && valuesByCommand[activeId]) || {}

    const _changeValue = (key:string, value:any) =>
        setValuesByCommand({ ...valuesByCommand, [activeId as string]: { ...values, [key]: value } })

    const missingPositionals = entry ? MissingPositionals(entry, values) : []
    const commandLineArgs    = entry ? BuildCommandLineArgs(entry, values) : ""

    const isRunning = status === "running"
    const canRun    = Boolean(entry) && missingPositionals.length === 0 && !isRunning

    if(commandTree.length === 0)
        return <Message info size="tiny">
            <Icon name="info circle"/> este pacote não declara um <code>command-group</code> — use a aba <strong>terminal</strong>.
        </Message>

    return <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

        <div style={{ display: "flex", gap: "10px", minHeight: 0 }}>

            { /* coluna 1 — árvore de comandos */ }
            <Segment style={{ width: "260px", flex: "0 0 auto", overflow: "auto", maxHeight: "34vh", margin: 0, padding: "8px" }}>
                <SectionTitle icon="list">comandos</SectionTitle>
                {
                    commandTree.map((rootEntry) =>
                        <CommandNodeView
                            key={rootEntry.id}
                            entry={rootEntry}
                            selectedId={activeId}
                            onSelect={setSelectedId}/>)
                }
            </Segment>

            { /* coluna 2 — parâmetros do comando selecionado */ }
            <Segment style={{ flex: "1 1 auto", minWidth: 0, overflow: "auto", maxHeight: "34vh", margin: 0, padding: "8px" }}>
                {
                    !entry
                    ? <div style={{ ...MUTED, padding: "20px", textAlign: "center" }}>selecione um comando</div>
                    : <>
                        <div style={{ fontWeight: 700, marginBottom: "2px" }}>{CommandSignature(entry)}</div>
                        { entry.description && <div style={{ ...MUTED, fontSize: ".9em", marginBottom: "10px" }}>{entry.description}</div> }

                        <Form>
                            {
                                entry.positionalKeys.length > 0 &&
                                <>
                                    <SectionTitle icon="sort numeric down">posicionais</SectionTitle>
                                    {
                                        entry.positionalKeys.map((key) =>
                                            <ParameterField
                                                key={key}
                                                parameter={entry.parametersByKey[key] || { key, paramType: "positional", valueType: "string" }}
                                                value={values[key]}
                                                isRequired={true}
                                                onChange={(value:any) => _changeValue(key, value)}/>)
                                    }
                                </>
                            }
                            {
                                entry.options.length > 0 &&
                                <>
                                    <SectionTitle icon="sliders horizontal">opções</SectionTitle>
                                    {
                                        entry.options.map((parameter) =>
                                            <ParameterField
                                                key={parameter.key}
                                                parameter={parameter}
                                                value={values[parameter.key]}
                                                isRequired={false}
                                                onChange={(value:any) => _changeValue(parameter.key, value)}/>)
                                    }
                                </>
                            }
                            {
                                entry.positionalKeys.length === 0 && entry.options.length === 0 &&
                                <div style={{ ...MUTED, fontSize: ".9em" }}>este comando não recebe parâmetros.</div>
                            }
                        </Form>
                    </>
                }
            </Segment>
        </div>

        { /* rodapé — preview da linha de comando e ações */ }
        <Segment style={{ margin: 0, padding: "8px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{
                    flex: "1 1 auto", minWidth: 0, overflowX: "auto", whiteSpace: "nowrap",
                    fontFamily: "monospace", fontSize: ".9em",
                    background: "var(--mp-code-bg, rgba(0,0,0,.05))", padding: "6px 8px", borderRadius: "3px"
                }}>
                    <span style={MUTED}>$ </span>
                    {executableName || "pkg-exec"} {commandLineArgs}
                </div>
                <Button
                    primary size="small"
                    disabled={!canRun}
                    onClick={() => onExecute(commandLineArgs)}>
                    <Icon name={status === "exited" || status === "error" ? "redo" : "play"}/>
                    { status === "exited" || status === "error" ? "executar de novo" : "executar" }
                </Button>
                <Button basic size="small" disabled={!isRunning} onClick={onKill}>
                    <Icon name="stop"/> encerrar
                </Button>
                <Label size="small" color={({ idle: "grey", running: "orange", exited: "grey", error: "red" } as any)[status]}>
                    {status}
                </Label>
            </div>
            {
                missingPositionals.length > 0 &&
                <Message size="tiny" warning style={{ marginTop: "8px", marginBottom: 0 }}>
                    <Icon name="warning sign"/> preencha os parâmetros obrigatórios: <strong>{missingPositionals.join(", ")}</strong>
                </Message>
            }
        </Segment>
    </div>
}

export default CommandGroupForm
