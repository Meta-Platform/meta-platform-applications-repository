// Leitura do `command-group.json` de um pacote CLI e geração da linha de comando.
//
// O metadata do pacote já chega inteiro do daemon (ListPackages lê todos os JSON
// de metadata/), então `metadata["command-group"]` está disponível no navegador
// sem nenhuma chamada extra. Aqui traduzimos aquela árvore — o mesmo schema que o
// `command-application.taskLoader` entrega ao yargs — para um form e, de volta,
// para a string `commandLineArgs` que o daemon repassa ao `pkg-exec`.

export type CommandParameter = {
    key       : string
    paramType ?: "positional" | "option"
    valueType ?: "string" | "number" | "boolean" | "array"
    describe  ?: string
}

export type CommandNode = {
    command       : string
    description  ?: string
    path         ?: string
    parameters   ?: CommandParameter[]
    children     ?: CommandNode[]
    namespace    ?: string
    commandName  ?: string
}

export type CommandGroup = {
    commands ?: CommandNode[]
}

export type CommandToken = {
    kind  : "literal" | "positional"
    value : string
}

export type CommandEntry = {
    id              : string
    depth           : number
    // O que o yargs registra: "register source [repositoryNamespace] [sourceType]".
    label           : string
    description     : string
    // Um nó sem `path` é só agrupador (ex.: `list`): o yargs não tem handler para
    // ele, então não é executável — serve de pasta na árvore.
    isExecutable    : boolean
    // Caminho completo até este comando, já incluindo os ancestrais.
    tokens          : CommandToken[]
    positionalKeys  : string[]
    options         : CommandParameter[]
    parametersByKey : { [key:string] : CommandParameter }
    children        : CommandEntry[]
}

const PLACEHOLDER = /^[[<](.+?)[\]>]$/

// "register source [repositoryNamespace]" -> literais + posicionais, em ordem.
// A ordem importa: é ela que monta a invocação.
export const ParseCommandTokens = (command:string):CommandToken[] =>
    (command || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => {
            const match = PLACEHOLDER.exec(token)
            return match
                ? { kind: "positional" as const, value: match[1].replace(/^\.{3}|\.{3}$/g, "") }
                : { kind: "literal" as const, value: token }
        })

// Comando completo como se digitaria no shell, com os posicionais como placeholder.
export const CommandSignature = (entry:CommandEntry) =>
    entry.tokens.map((token) => token.kind === "literal" ? token.value : `[${token.value}]`).join(" ")

const BuildEntry = (
    node        : CommandNode,
    id          : string,
    depth       : number,
    parentTokens: CommandToken[],
    parentParams: { [key:string] : CommandParameter }
):CommandEntry => {

    const tokens = [ ...parentTokens, ...ParseCommandTokens(node.command) ]

    // Os parâmetros dos ancestrais continuam valendo: o yargs roda o builder de
    // cada comando da cadeia, então `--opção` do pai é aceita no filho.
    const parametersByKey = (node.parameters || []).reduce(
        (accumulator, parameter) => ({ ...accumulator, [parameter.key]: parameter }),
        { ...parentParams } as { [key:string] : CommandParameter })

    const positionalKeys = tokens.filter((token) => token.kind === "positional").map((token) => token.value)

    const options = Object.keys(parametersByKey)
        .map((key) => parametersByKey[key])
        .filter((parameter) => parameter.paramType === "option")

    return {
        id,
        depth,
        label        : node.command,
        description  : node.description || "",
        isExecutable : Boolean(node.path),
        tokens,
        positionalKeys,
        options,
        parametersByKey,
        children     : (node.children || []).map((child, index) =>
            BuildEntry(child, `${id}.${index}`, depth + 1, tokens, parametersByKey))
    }
}

export const BuildCommandTree = (commandGroup?:CommandGroup):CommandEntry[] =>
    (commandGroup?.commands || []).map((node, index) => BuildEntry(node, String(index), 0, [], {}))

export const FlattenCommandTree = (entries:CommandEntry[]):CommandEntry[] =>
    entries.reduce((accumulator:CommandEntry[], entry) =>
        [ ...accumulator, entry, ...FlattenCommandTree(entry.children) ], [])

export const FindCommandEntry = (entries:CommandEntry[], id?:string):CommandEntry | undefined =>
    id ? FlattenCommandTree(entries).find((entry) => entry.id === id) : undefined

// Aspas no estilo do shell — o `TokenizeArgs` do command-application.lib desfaz
// exatamente isto (aspas duplas com \" e \\ como escapes).
export const QuoteArg = (value:string) => {
    if(value === "") return `""`
    if(!/[\s"'\\]/.test(value)) return value
    return `"${value.replace(/([\\"])/g, "\\$1")}"`
}

const IsEmpty = (value:any) => value === undefined || value === null || value === ""

// Posicionais são obrigatórios: sem eles o comando nem chega a rodar.
export const MissingPositionals = (entry:CommandEntry, values:any = {}) =>
    entry.positionalKeys.filter((key) => IsEmpty(values[key]))

export const BuildCommandLineArgs = (entry:CommandEntry, values:any = {}):string => {

    const args:string[] = []

    entry.tokens.forEach((token) => {
        if(token.kind === "literal") args.push(token.value)
        else if(!IsEmpty(values[token.value])) args.push(QuoteArg(String(values[token.value])))
    })

    entry.options.forEach(({ key, valueType }) => {

        const value = values[key]

        if(valueType === "boolean"){
            if(value === true) args.push(`--${key}`)
            return
        }

        if(valueType === "array"){
            (Array.isArray(value) ? value : [])
                .filter((item:any) => !IsEmpty(item))
                .forEach((item:any) => args.push(`--${key}`, QuoteArg(String(item))))
            return
        }

        if(IsEmpty(value)) return

        args.push(`--${key}`, QuoteArg(String(value)))
    })

    return args.join(" ")
}

// Nome do executável declarado no boot.json — o que aparece no preview (`repo …`).
export const ResolveExecutableName = (boot:any) =>
    (boot?.executables || []).find((executable:any) => executable?.executableName)?.executableName
