/*
    Há quanto tempo a aplicação está de pé, na forma que se lê de relance.

    O runtime dá o instante de criação em epoch. "há 2h14" responde a pergunta
    que se faz olhando um painel ("subiu agora ou está de pé desde ontem?");
    uma data completa obrigaria a fazer a conta de cabeça.
*/
export const FormatUptime = (epochSegundos: number, agora = Date.now()): string => {
    if (!epochSegundos) return "—"

    const segundos = Math.max(0, Math.floor(agora / 1000 - epochSegundos))

    if (segundos < 60) return `${segundos}s`

    const minutos = Math.floor(segundos / 60)
    if (minutos < 60) return `${minutos}min`

    const horas = Math.floor(minutos / 60)
    if (horas < 24) return `${horas}h${String(minutos % 60).padStart(2, "0")}`

    const dias = Math.floor(horas / 24)
    return dias < 30 ? `${dias}d${horas % 24}h` : `${Math.floor(dias / 30)}mes`
}

export default FormatUptime
