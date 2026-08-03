/*
    Traduz a falha que chegou da API para a frase que vai aparecer na tela.

    O backend já manda mensagem boa nos casos que importam (runtime fora do ar,
    conexão removida, endpoint inválido). O trabalho aqui é ENCONTRAR essa
    mensagem, que vem em lugares diferentes conforme o transporte: no HTTP ela
    está no corpo da resposta do axios; no IPC, direto no Error. Sem isso, os
    dois caminhos exibiriam coisas diferentes para o mesmo problema.
*/
export const DescribeError = (falha: any): string => {
    if (!falha) return "Erro desconhecido."
    if (typeof falha === "string") return falha

    const corpo = falha.response?.data
    if (corpo) {
        if (typeof corpo === "string" && corpo.trim() !== "") return corpo
        if (corpo.message) return corpo.message
        if (corpo.error) return typeof corpo.error === "string" ? corpo.error : JSON.stringify(corpo.error)
    }

    if (falha.message) return falha.message

    return "Erro desconhecido."
}

export default DescribeError
