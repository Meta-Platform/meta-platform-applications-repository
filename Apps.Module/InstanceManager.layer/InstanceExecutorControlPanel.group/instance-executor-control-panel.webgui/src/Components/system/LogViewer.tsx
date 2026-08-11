import * as React from "react"
import { useState } from "react"

import { LogViewer as KitLogViewer } from "@i-components/components/advanced/runtime"

import { useWebSocket } from "@instance-components"
import { GetAPI } from "@i-components/net"
import { FormatBytes } from "./Format"

/**
 * Log de uma instância, ao vivo.
 *
 * O daemon já gravava esse log em disco — era o único lugar que respondia "por
 * que essa instância morreu" — e não havia como lê-lo sem abrir um terminal e
 * conhecer o instanceId. Aqui ele vira uma aba do painel.
 *
 * O stream manda um snapshot na conexão e, depois, só os incrementos. Este
 * componente acumula; o daemon não reenvia o que já foi entregue.
 *
 * O DESENHO é do kit (`LogViewer` de @i-components), que nasceu deste visor:
 * barra, filtro, acompanhar/quebrar/limpar/copiar, realce por nível e
 * virtualização das linhas. Aqui fica só o que é domínio — assinar o stream,
 * acumular as linhas e dizer se a conexão está de pé.
 *
 * Deve ser montado com key={instanceId} para reconectar ao trocar de instância.
 */

// Teto de linhas em memória. Um desktop de sessão longa escreve dezenas de
// milhares; o DOM não aguenta e ninguém rola até lá. O corte é pela frente, que
// é o lado velho — e quem corta para a tela é o kit, pelo `maxLines`.
const MAX_LINES = 4000

const LogViewer = ({ instance, serverManagerInformation, height }: any) => {

    const [ lines, setLines ]         = useState<string[]>([])
    const [ size, setSize ]           = useState<number>()
    const [ connected, setConnected ] = useState(false)

    const instanceId = instance && instance.instanceId

    const getObservabilityAPI = () =>
        GetAPI({ apiName: "InstanceObservability", serverManagerInformation })

    // As sequências ANSI não são mais apagadas na entrada: o visor do kit as
    // interpreta e pinta com os tokens --mp-terminal-*, o que devolve a
    // informação que a limpeza jogava fora.
    const _Append = (incoming: string[], replace: boolean) =>
        setLines((current) => {
            const merged = replace ? (incoming || []) : [...current, ...(incoming || [])]
            // Corte folgado aqui só para o array não crescer sem limite entre
            // renders; o corte do que aparece é o do kit.
            return merged.length > MAX_LINES * 2 ? merged.slice(merged.length - MAX_LINES) : merged
        })

    useWebSocket({
        socket          : () => getObservabilityAPI().InstanceLogStream({ instanceId }),
        onMessage       : (message: any) => {
            if (!message) return
            // `rotated` = o arquivo foi truncado no daemon: o que está na tela
            // não é mais a continuação do que vem, então recomeça.
            _Append(message.lines || [], message.type === "snapshot" || message.rotated === true)
            if (message.size !== undefined) setSize(message.size)
            setConnected(true)
        },
        onConnection    : () => setConnected(true),
        onDisconnection : () => setConnected(false)
    })

    return <KitLogViewer
        className="iep-log"
        lines={lines}
        maxLines={MAX_LINES}
        height={height || "100%"}
        showLevelFilter={false}
        emptyLabel="nenhuma linha registrada para esta instância ainda."
        onClear={() => setLines([])}
        meta={<>
            {size !== undefined ? `${FormatBytes(size)} · ` : ""}
            <span style={{ color: connected ? "var(--mp-terminal-green)" : "var(--mp-terminal-orange)" }}>
                {connected ? "ao vivo" : "desconectado"}
            </span>
        </>}/>
}

export default LogViewer
