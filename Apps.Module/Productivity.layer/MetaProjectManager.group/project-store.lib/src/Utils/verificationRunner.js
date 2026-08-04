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
        const { terminalId } = await instanceManagerClient.RunCommand({ command, args, cwd })

        return new Promise((resolve) => {
            let saida = ""
            let finalizado = false
            let stream

            const terminar = (resultado) => {
                if(finalizado) return
                finalizado = true
                clearTimeout(relogio)
                try { stream && stream.close && stream.close() } catch(e){ /* já fechado */ }
                resolve({ ...resultado, output: _cap(saida), durationMs: Date.now() - inicio })
            }

            const relogio = setTimeout(() => {
                // Estourou: mata o processo para não deixar um build órfão
                // segurando recurso, e devolve o que já tinha saído.
                instanceManagerClient.KillTerminal({ terminalId }).catch(() => undefined)
                terminar({ exitCode: null, timedOut: true })
            }, timeoutMs)

            try {
                stream = instanceManagerClient.OpenTerminalStream({ terminalId })
            } catch(e){
                return terminar({ exitCode: null, error: String(e && e.message || e) })
            }

            stream.on && stream.on("message", (raw) => {
                let mensagem
                try { mensagem = JSON.parse(raw) } catch(e){ return }
                if(mensagem.type === "data") saida += mensagem.data
                else if(mensagem.type === "exit") terminar({ exitCode: mensagem.exitCode })
                else if(mensagem.type === "error") terminar({ exitCode: null, error: mensagem.message })
            })
            stream.on && stream.on("error", (e) => terminar({ exitCode: null, error: String(e && e.message || e) }))
            // Fechar sem `exit` significa que o desfecho se perdeu — dizer isso é
            // melhor que devolver "passou" por omissão.
            stream.on && stream.on("close", () => terminar({ exitCode: null, error: "o terminal fechou sem informar o código de saída" }))
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

module.exports = { CreateVerificationRunner }
