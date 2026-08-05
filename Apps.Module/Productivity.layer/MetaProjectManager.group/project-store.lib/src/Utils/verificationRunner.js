// Teto do que se guarda da saída. O terminal de um build pode despejar
// megabytes; o que decide uma revisão são as primeiras e as últimas linhas.
const MAX_OUTPUT_CHARS = 200 * 1024

/**
 * Roda o comando de verificação PELO DAEMON e devolve saída + código de saída.
 *
 * Passar pelo daemon, e não por um `child_process` local, é o que mantém a
 * execução visível no monitor de instâncias — a mesma regra que vale para
 * lançar qualquer coisa neste ecossistema. O daemon devolve um `terminalId`; a
 * saída e o desfecho chegam pelo stream do terminal, que já emite
 * `{type:"exit", exitCode}` no fim.
 *
 * Nunca lança por causa do comando: um comando que falha é um RESULTADO
 * (exitCode != 0), não um erro. Só a indisponibilidade do daemon sobe.
 *
 * @param {object} deps  { instanceManagerClient }  cliente já construído
 * @returns {function}   RunVerification({command,args,cwd,timeoutMs})
 */
const CreateVerificationRunner = ({ instanceManagerClient } = {}) => {
    if(!instanceManagerClient) return undefined

    return async ({ command, args = [], cwd, timeoutMs = 180000 } = {}) => {
        const inicio = Date.now()
        // O daemon responde plano (`{terminalId}`) ou envelopado (`{data:{...}}`)
        // conforme o transporte que montou a API. Aceitar as duas formas evita um
        // terminalId `undefined` que só se manifestaria como comando pendurado.
        const resposta = await instanceManagerClient.RunCommand({ command, args, cwd })
        const terminalId = (resposta && resposta.terminalId) || (resposta && resposta.data && resposta.data.terminalId)
        if(!terminalId)
            return { exitCode: null, output: "", durationMs: Date.now() - inicio,
                     error: "o daemon aceitou o comando mas não devolveu um terminal para acompanhá-lo" }

        // OpenTerminalStream é ASSÍNCRONO (resolve a API do daemon antes de abrir
        // o socket). Tratar o retorno como se já fosse o socket registra os
        // handlers numa Promise — `stream.on` é undefined, nenhum evento chega, e
        // TODA verificação termina em timeout com saída vazia. O await é o ponto
        // inteiro desta função.
        let stream
        try {
            stream = await instanceManagerClient.OpenTerminalStream({ terminalId })
        } catch(e){
            return { exitCode: null, output: "", durationMs: Date.now() - inicio,
                     error: `não foi possível acompanhar o terminal ${terminalId}: ${e && e.message ? e.message : e}` }
        }
        if(!stream || typeof stream.on !== "function"){
            try { stream && stream.close && stream.close() } catch(e){ /* nada a fechar */ }
            return { exitCode: null, output: "", durationMs: Date.now() - inicio,
                     error: "o canal do terminal abriu sem superfície de eventos" }
        }

        return new Promise((resolve) => {
            let saida = ""
            let finalizado = false

            const terminar = (resultado) => {
                if(finalizado) return
                finalizado = true
                clearTimeout(relogio)
                try { stream.close && stream.close() } catch(e){ /* já fechado */ }
                resolve({ ...resultado, output: _cap(saida), durationMs: Date.now() - inicio })
            }

            const relogio = setTimeout(() => {
                // Estourou: mata o processo para não deixar um build órfão
                // segurando recurso, e devolve o que já tinha saído.
                instanceManagerClient.KillTerminal({ terminalId }).catch(() => undefined)
                terminar({ exitCode: null, timedOut: true })
            }, timeoutMs)

            stream.on("message", (raw) => {
                let mensagem
                try { mensagem = JSON.parse(raw) } catch(e){ return }
                if(mensagem.type === "data") saida += mensagem.data
                else if(mensagem.type === "exit") terminar({ exitCode: mensagem.exitCode })
                else if(mensagem.type === "error") terminar({ exitCode: null, error: mensagem.message })
            })
            stream.on("error", (e) => terminar({ exitCode: null, error: String(e && e.message || e) }))
            // Fechar sem `exit` significa que o desfecho se perdeu — dizer isso é
            // melhor que devolver "passou" por omissão.
            stream.on("close", () => terminar({ exitCode: null, error: "o terminal fechou sem informar o código de saída" }))
        })
    }
}

// Cabeça + cauda, com marca do que sumiu: cortar só o fim esconderia justamente
// o placar dos testes.
const _cap = (texto) => {
    if(texto.length <= MAX_OUTPUT_CHARS) return texto
    const metade = Math.floor(MAX_OUTPUT_CHARS / 2)
    const omitidos = texto.length - MAX_OUTPUT_CHARS
    return texto.slice(0, metade)
        + `\n\n… [${omitidos} caracteres omitidos] …\n\n`
        + texto.slice(-metade)
}

/**
 * MONTA o runner a partir do que um host tem em mãos — e é o ÚNICO lugar onde
 * essa montagem existe.
 *
 * Os três hosts (webservice, mpm.cli, mcp.cli) construíam o cliente do daemon
 * cada um por conta própria, e os três estavam errados: dois chamavam
 * `CreateInstanceManagerClient({})` sem o caminho do socket, e o terceiro
 * passava `socketPath` quando o nome do parâmetro é `platformApplicationSocketPath`.
 * Nos três casos a construção lançava, o catch engolia, e a verificação ficava
 * permanentemente desligada — sem erro em lugar nenhum, só a lacuna genérica
 * "a execução não está disponível neste ambiente" em toda entrega.
 *
 * Erro de montagem não pode derrubar o host: a verificação é uma capacidade a
 * mais, não um pré-requisito. Mas o MOTIVO precisa aparecer, senão o próximo
 * a investigar repete esta mesma escavação — daí `onUnavailable`.
 */
const BuildVerificationRunner = ({ instanceManagerClientLib, ecosystemDataPath, socketPath, onUnavailable } = {}) => {
    const avisar = (motivo) => { try { onUnavailable && onUnavailable(motivo) } catch(e){ /* nunca atrapalha */ } }

    if(!instanceManagerClientLib){
        avisar("a lib de cliente do daemon não foi injetada neste host (falta bound-param instanceManagerClientLib)")
        return undefined
    }

    const caminho = socketPath || _defaultSocketPath(ecosystemDataPath)
    if(!caminho){
        avisar("nem o caminho do socket nem o do EcosystemData foram informados")
        return undefined
    }

    try {
        const client = instanceManagerClientLib.require("CreateInstanceManagerClient")({
            platformApplicationSocketPath: caminho
        })
        return CreateVerificationRunner({ instanceManagerClient: client })
    } catch(e){
        avisar(`não foi possível falar com o daemon em ${caminho}: ${e && e.message ? e.message : e}`)
        return undefined
    }
}

// O daemon publica seu socket num lugar fixo dentro do EcosystemData. `~` chega
// sem expandir em startup-param, e um caminho com til vira um socket que não
// existe — falha silenciosa idêntica à que este módulo veio corrigir.
const _defaultSocketPath = (ecosystemDataPath) => {
    if(!ecosystemDataPath) return undefined
    const path = require("path")
    const os = require("os")
    const base = ecosystemDataPath.startsWith("~")
        ? path.join(os.homedir(), ecosystemDataPath.slice(1))
        : ecosystemDataPath
    return path.join(base, "sockets", "ecosystem-instance-manager.app.sock")
}

module.exports = { CreateVerificationRunner, BuildVerificationRunner }
