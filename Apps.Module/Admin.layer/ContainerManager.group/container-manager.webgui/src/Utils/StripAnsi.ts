/*
    Remove as sequências de escape ANSI do texto vindo do container.

    A saída de um container traz cor, movimentação de cursor e limpeza de tela
    como bytes de controle. Renderizadas num `<pre>`, essas sequências viram
    lixo visual no meio da mensagem — `[32m` grudado na palavra que deveria
    estar verde.

    A remoção é OPCIONAL na interface: quem quiser ver o texto exatamente como
    o container escreveu pode desligar. Aqui não se interpreta cor, só se
    limpa — interpretar exigiria um emulador de terminal completo.
*/

/*
    A ORDEM das alternativas importa, e errar nela estraga o texto em vez de
    limpá-lo.

    O OSC (`ESC ] 0 ; título BEL`, que o bash usa para nomear a janela) precisa
    vir ANTES do CSI: o padrão de CSI aceita `]`, dígitos e `;` no meio, então
    ele casa o começo de um OSC e consome como terminador a PRIMEIRA letra do
    título — que é texto do usuário. Com o prompt `myecosystem@...`, o
    resultado foi `yecosystem@...` na tela, com o resto da sequência sobrando.

    Ordem: OSC completo → OSC sem terminador (fluxo cortado) → CSI → escapes de
    um caractere.
*/
const PADRAO_ANSI = new RegExp(
    [
        "[\\u001B\\u009B]\\][^\\u0007\\u001B]*(?:\\u0007|\\u001B\\\\)",
        "[\\u001B\\u009B]\\][^\\u0007\\u001B]*$",
        "[\\u001B\\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-TZcf-ntqry=><~]",
        "[\\u001B\\u009B][@-Z\\\\-_]"
    ].join("|"),
    "g"
)

export const StripAnsi = (texto: string): string =>
    typeof texto === "string" ? texto.replace(PADRAO_ANSI, "") : ""

export default StripAnsi
