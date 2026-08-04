/*
    Salvar no disco do NAVEGADOR o que veio embutido na resposta.

    O servidor devolve arquivo em base64 dentro do JSON — imagem exportada,
    arquivo de volume, backup. Aqui isso vira download.

    ## `bytes.buffer`, e não a view

    O tipo genérico de `Uint8Array` no TypeScript recente não é aceito como
    `BlobPart`. Passar o buffer resolve, e o `as ArrayBuffer` é o que faz o
    compilador aceitar sem `any`.

    ## O objeto de URL é revogado

    Cada `createObjectURL` prende o blob inteiro na memória da aba até alguém
    soltar. Com um tar de imagem, isso é meio giga que não volta.
*/

export const DeBase64 = (base64: string): Uint8Array => {
    const binario = atob(base64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    return bytes
}

export const ParaBase64 = (texto: string): string => {
    const bytes = new TextEncoder().encode(texto)
    let binario = ""
    for (const byte of Array.from(bytes)) binario += String.fromCharCode(byte)
    return btoa(binario)
}

export const BaixarBytes = (
    nomeDoArquivo: string,
    bytes: Uint8Array,
    mimeType = "application/octet-stream"
) => {
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: mimeType }))
    const link = document.createElement("a")
    link.href = url
    link.download = nomeDoArquivo
    link.click()
    URL.revokeObjectURL(url)
}

export const BaixarBase64 = (
    nomeDoArquivo: string,
    base64: string,
    mimeType = "application/octet-stream"
) => BaixarBytes(nomeDoArquivo, DeBase64(base64), mimeType)

/*
    O caminho de volta: um arquivo escolhido pelo usuário vira base64 para
    caber no corpo JSON da chamada.
*/
export const LerArquivoComoBase64 = (arquivo: File): Promise<string> =>
    new Promise((resolver, rejeitar) => {
        const leitor = new FileReader()
        leitor.onerror = () => rejeitar(leitor.error)
        // `readAsDataURL` devolve "data:<mime>;base64,<conteúdo>"; o que
        // interessa é o que vem depois da vírgula.
        leitor.onload = () => resolver(String(leitor.result).split(",")[1])
        leitor.readAsDataURL(arquivo)
    })
