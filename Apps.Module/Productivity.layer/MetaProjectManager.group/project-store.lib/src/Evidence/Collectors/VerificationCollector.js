// Recorte da saída: cabeça e cauda. O que importa num teste está no começo
// (o comando, o setup) e no fim (o placar, o erro) — o meio é repetição.
const HEAD_BYTES = 8 * 1024
const TAIL_BYTES = 8 * 1024

/**
 * A VERIFICAÇÃO: o sistema roda o comando declarado e guarda o que aconteceu.
 *
 * É a diferença entre "o agente disse que testou" e "os testes passaram". Um
 * resumo escrito por quem fez o trabalho não é evidência do trabalho; um código
 * de saída obtido por quem revisa, é.
 *
 * O comando é DECLARADO — pelo item ou pelo projeto —, nunca inferido: adivinhar
 * como se testa um projeto é a forma mais rápida de produzir uma evidência que
 * mente.
 */
const VerificationCollector = async ({ delivery, item, project, runVerification, repositoryPath, now }) => {
    const evidence = []
    const gaps = []

    const command = delivery.verifyCommand || item.verifyCommand || (project && project.verifyCommand)
    if(!command){
        gaps.push(_gap("sem-comando-de-verificacao",
            "Nenhum comando de verificação declarado (no item ou no projeto): não há como comprovar que a entrega funciona",
            "warning", now))
        return { evidence, gaps, verifyExitCode: undefined }
    }
    if(!runVerification){
        gaps.push(_gap("verificacao-indisponivel",
            `O comando "${command}" não pôde ser executado: a execução não está disponível neste ambiente`,
            "warning", now))
        return { evidence, gaps, verifyExitCode: undefined }
    }

    const cwd = (project && project.verifyCwd) || item.packagePath || repositoryPath || (project && project.localPath)
    const [programa, ...args] = _tokenize(command)

    let resultado
    try {
        resultado = await runVerification({ command: programa, args, cwd, timeoutMs: 180000 })
    } catch(e){
        gaps.push(_gap("verificacao-falhou-ao-iniciar",
            `Não foi possível executar "${command}": ${e && e.message ? e.message : e}`,
            "blocking", now))
        return { evidence, gaps, verifyExitCode: undefined }
    }

    const passou = resultado.exitCode === 0
    evidence.push({
        kind: "verification", source: "auto", collectorName: "VerificationCollector",
        title: passou ? `Verificação passou: ${command}` : `Verificação FALHOU: ${command}`,
        ref: command,
        body: _trim(resultado.output || ""),
        exitCode: resultado.exitCode,
        attribution: "declared", confidence: "high",
        severity: passou ? "info" : "blocking",
        occurredAt: now, collectedAt: now,
        dataJson: {
            cwd, durationMs: resultado.durationMs,
            timedOut: resultado.timedOut || false,
            outputTruncated: (resultado.output || "").length > HEAD_BYTES + TAIL_BYTES
        }
    })

    if(!passou)
        gaps.push(_gap("verificacao-falhou",
            resultado.timedOut
                ? `A verificação "${command}" estourou o tempo limite`
                : `A verificação "${command}" terminou com código ${resultado.exitCode}`,
            "blocking", now))

    return { evidence, gaps, verifyExitCode: resultado.exitCode }
}

// Divisão simples respeitando aspas — o comando declarado é uma linha só, e o
// que se quer evitar é quebrar `--test "caminho com espaço"`.
const _tokenize = (linha) => {
    const tokens = []
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g
    let m
    while((m = re.exec(linha)) !== null) tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3])
    return tokens
}

const _trim = (texto) => {
    if(texto.length <= HEAD_BYTES + TAIL_BYTES) return texto
    const cortado = texto.length - HEAD_BYTES - TAIL_BYTES
    return texto.slice(0, HEAD_BYTES)
        + `\n\n… [${cortado} caracteres omitidos no meio] …\n\n`
        + texto.slice(-TAIL_BYTES)
}

const _gap = (ref, title, severity, now) => ({
    kind: "gap", source: "system", collectorName: "VerificationCollector",
    ref, title, severity, collectedAt: now
})

module.exports = VerificationCollector
