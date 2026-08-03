import { useCallback, useEffect, useState } from "react"

import { DescribeError } from "../Utils/DescribeError"

/*
    Carregamento de uma lista do runtime, com os três estados que toda tela
    deste aplicativo tem: carregando, erro e dado.

    O erro é guardado como TEXTO já legível. Um runtime fora do ar é situação
    normal aqui — o usuário desligou o Docker, a máquina remota caiu — e
    precisa aparecer como frase na tela, não como exceção no console.
*/
export const useResource = <T,>(Carregar: () => Promise<T>, dependencias: any[], ativo = true) => {
    const [dado, setDado] = useState<T | null>(null)
    const [carregando, setCarregando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    const Recarregar = useCallback(async () => {
        if (!ativo) {
            setDado(null)
            setErro(null)
            return
        }
        setCarregando(true)
        setErro(null)
        try {
            const resultado = await Carregar()
            setDado(resultado)
        } catch (falha) {
            setErro(DescribeError(falha))
            setDado(null)
        } finally {
            setCarregando(false)
        }
    }, dependencias.concat([ativo]))

    useEffect(() => { Recarregar() }, [Recarregar])

    return { dado, carregando, erro, Recarregar }
}

export default useResource
