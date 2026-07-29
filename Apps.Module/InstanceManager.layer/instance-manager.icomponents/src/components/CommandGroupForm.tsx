import * as React from "react"
import { useMemo, useState } from "react"

import {
    Banner, Button, CheckboxInput, CodeBlock, FormField, IconButton, Panel,
    StatusChip, TextInput, TreeRow
} from "@i-components"

import {
    BuildCommandLineArgs,
    BuildCommandTree,
    CommandEntry,
    CommandParameter,
    CommandSignature,
    FindCommandEntry,
    FlattenCommandTree,
    MissingPositionals
} from "../utils/CommandGroup"

// Form de execução de um pacote CLI, montado a partir do `command-group.json`.
//
//   coluna 1  árvore de comandos declarados pelo pacote
//   coluna 2  campos do comando selecionado (posicionais e opções)
//   rodapé    preview da linha de comando + executar/encerrar
//
// Os posicionais são obrigatórios; as opções, não. Nós sem handler (`path`) são
// apenas agrupadores do yargs — aparecem como pasta e não podem ser executados.
// Toda a UI vem do kit comum (@i-components).

const SectionTitle = ({ children }: any) =>
    <div className="mp-kv__label" style={{ padding: "4px 6px 8px" }}>{children}</div>

const CommandNodeView = ({ entry, selectedId, onSelect }: any) => {

    const [ isOpen, setIsOpen ] = useState(entry.depth === 0)

    const hasChildren = entry.children.length > 0
    const isSelected  = entry.id === selectedId

    return <div>
        <TreeRow
            label={entry.label}
            icon={entry.isExecutable ? "terminal" : "folder"}
            depth={entry.depth}
            hasChildren={hasChildren}
            expanded={isOpen}
            selected={isSelected}
            onToggle={() => setIsOpen(!isOpen)}
            onSelect={() => {
                if(entry.isExecutable) onSelect(entry.id)
                else if(hasChildren) setIsOpen(!isOpen)
            }}/>
        {
            isOpen &&
            entry.children.map((child: CommandEntry) =>
                <CommandNodeView key={child.id} entry={child} selectedId={selectedId} onSelect={onSelect}/>)
        }
    </div>
}

// Campo de valor múltiplo (`array` no yargs): uma linha por valor.
const ArrayField = ({ value, onChange }: any) => {

    const items: string[] = Array.isArray(value) && value.length > 0 ? value : [ "" ]

    const _replace = (index: number, item: string) =>
        onChange(items.map((current, position) => position === index ? item : current))

    return <>
        {
            items.map((item, index) =>
                <div key={index} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    <TextInput value={item} onChange={(event: any) => _replace(index, event.target.value)}/>
                    <IconButton
                        icon="minus"
                        label="remover valor"
                        size="sm"
                        disabled={items.length === 1 && item === ""}
                        onClick={() => onChange(items.filter((_, position) => position !== index))}/>
                </div>)
        }
        <Button size="sm" variant="subtle" icon="plus" onClick={() => onChange([ ...items, "" ])}>valor</Button>
    </>
}

const ParameterField = ({ parameter, value, isRequired, onChange }: {
    parameter  : CommandParameter
    value      : any
    isRequired : boolean
    onChange   : (value: any) => void
}) => {

    const { key, valueType, describe } = parameter
    const label = parameter.paramType === "option" ? `--${key}` : key

    if(valueType === "boolean")
        return <div style={{ marginBottom: 7 }}>
            <CheckboxInput
                label={`--${key}${describe ? ` — ${describe}` : ""}`}
                checked={value === true}
                onChange={(event: any) => onChange(event.target.checked)}/>
        </div>

    if(valueType === "array")
        return <FormField label={label} hint={describe} required={isRequired}>
            <ArrayField value={value} onChange={onChange}/>
        </FormField>

    return <FormField label={label} hint={describe} required={isRequired}>
        <TextInput
            type={valueType === "number" ? "number" : "text"}
            value={value === undefined ? "" : value}
            onChange={(event: any) => onChange(event.target.value)}/>
    </FormField>
}

const STATUS_TONE: any = { idle: "neutral", running: "warning", exited: "neutral", error: "danger" }

const CommandGroupForm = ({
    commandGroup,
    executableName,
    status,
    onExecute,
    onKill
}: any) => {

    const commandTree = useMemo(() => BuildCommandTree(commandGroup), [ commandGroup ])

    const [ selectedId, setSelectedId ] = useState<string>()
    // Valores por comando: trocar de comando não pode apagar o que já foi digitado.
    const [ valuesByCommand, setValuesByCommand ] = useState<any>({})

    // Pré-seleciona o primeiro comando executável.
    const firstExecutableId = useMemo(() =>
        FlattenCommandTree(commandTree).find((entry) => entry.isExecutable)?.id,
    [ commandTree ])

    const activeId = selectedId || firstExecutableId
    const entry    = FindCommandEntry(commandTree, activeId)

    const values = (activeId && valuesByCommand[activeId]) || {}

    const _changeValue = (key: string, value: any) =>
        setValuesByCommand({ ...valuesByCommand, [activeId as string]: { ...values, [key]: value } })

    const missingPositionals = entry ? MissingPositionals(entry, values) : []
    const commandLineArgs    = entry ? BuildCommandLineArgs(entry, values) : ""

    const isRunning = status === "running"
    const canRun    = Boolean(entry) && missingPositionals.length === 0 && !isRunning
    const hasRun    = status === "exited" || status === "error"

    if(commandTree.length === 0)
        return <Banner tone="info" title="Sem command-group">
            este pacote não declara um <code>command-group</code> — use a aba <strong>terminal</strong>.
        </Banner>

    return <div className="mp-stack">

        <div style={{ display: "flex", gap: 10, minHeight: 0 }}>

            { /* coluna 1 — árvore de comandos */ }
            <div style={{ width: 260, flex: "0 0 auto", overflow: "auto", maxHeight: "34vh" }}>
                <Panel title="comandos" icon="list">
                    {
                        commandTree.map((rootEntry) =>
                            <CommandNodeView
                                key={rootEntry.id}
                                entry={rootEntry}
                                selectedId={activeId}
                                onSelect={setSelectedId}/>)
                    }
                </Panel>
            </div>

            { /* coluna 2 — parâmetros do comando selecionado */ }
            <div style={{ flex: "1 1 auto", minWidth: 0, overflow: "auto", maxHeight: "34vh" }}>
                <Panel title={entry ? CommandSignature(entry) : "comando"} icon="terminal">
                    {
                        !entry
                        ? <div className="mp-empty-state__message">selecione um comando</div>
                        : <>
                            { entry.description &&
                                <div className="mp-field__hint" style={{ marginBottom: 10 }}>{entry.description}</div> }

                            {
                                entry.positionalKeys.length > 0 &&
                                <>
                                    <SectionTitle>posicionais</SectionTitle>
                                    {
                                        entry.positionalKeys.map((key) =>
                                            <ParameterField
                                                key={key}
                                                parameter={entry.parametersByKey[key] || { key, paramType: "positional", valueType: "string" }}
                                                value={values[key]}
                                                isRequired={true}
                                                onChange={(value: any) => _changeValue(key, value)}/>)
                                    }
                                </>
                            }
                            {
                                entry.options.length > 0 &&
                                <>
                                    <SectionTitle>opções</SectionTitle>
                                    {
                                        entry.options.map((parameter) =>
                                            <ParameterField
                                                key={parameter.key}
                                                parameter={parameter}
                                                value={values[parameter.key]}
                                                isRequired={false}
                                                onChange={(value: any) => _changeValue(parameter.key, value)}/>)
                                    }
                                </>
                            }
                            {
                                entry.positionalKeys.length === 0 && entry.options.length === 0 &&
                                <div className="mp-field__hint">este comando não recebe parâmetros.</div>
                            }
                        </>
                    }
                </Panel>
            </div>
        </div>

        { /* rodapé — preview da linha de comando e ações */ }
        <div className="mp-toolbar">
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <CodeBlock language="bash">{`$ ${executableName || "pkg-exec"} ${commandLineArgs}`}</CodeBlock>
            </div>
            <Button
                variant="primary"
                icon={hasRun ? "redo" : "play"}
                disabled={!canRun}
                onClick={() => onExecute(commandLineArgs)}>
                { hasRun ? "executar de novo" : "executar" }
            </Button>
            <Button icon="stop" disabled={!isRunning} onClick={onKill}>encerrar</Button>
            <StatusChip label={status} tone={STATUS_TONE[status] || "neutral"}/>
        </div>
        {
            missingPositionals.length > 0 &&
            <Banner tone="warning" title="Parâmetros obrigatórios">
                preencha: <strong>{missingPositionals.join(", ")}</strong>
            </Banner>
        }
    </div>
}

export default CommandGroupForm
