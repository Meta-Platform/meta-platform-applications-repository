import { useEffect, useRef, useState } from "react"

type WebSocketFactory = () => any

type UseWebSocketOptions = {
    socket: WebSocketFactory
    onMessage: (message: any) => void
    onConnection: () => void
    onDisconnection: () => void
}

const useWebSocket = ({
    socket: createSocket,
    onMessage,
    onConnection,
    onDisconnection
}: UseWebSocketOptions) => {
    const [socket, setSocket] = useState<any>()
    const socketRef = useRef<any>()
    const mountedRef = useRef(false)
    const reconnectInterval = useRef<number | null>(null)

    const clearReconnect = () => {
        if (reconnectInterval.current !== null) {
            window.clearInterval(reconnectInterval.current)
            reconnectInterval.current = null
        }
    }

    const connect = () => {
        if (!mountedRef.current) return
        const nextSocket = createSocket()
        socketRef.current = nextSocket
        setSocket(nextSocket)
    }

    useEffect(() => {
        mountedRef.current = true
        connect()
        return () => {
            mountedRef.current = false
            clearReconnect()
            const current = socketRef.current
            if (current) {
                current.onopen = null
                current.onmessage = null
                current.onclose = null
                try { current.close?.() } catch (_) {}
            }
            socketRef.current = undefined
        }
    }, [])

    useEffect(() => {
        if (!socket) return

        socket.onopen = () => {
            clearReconnect()
            onConnection()
        }
        socket.onmessage = ({ data }: any) => onMessage(JSON.parse(data))
        socket.onclose = () => {
            if (!mountedRef.current) return
            socketRef.current = undefined
            setSocket(undefined)
            onDisconnection()
            if (reconnectInterval.current === null)
                reconnectInterval.current = window.setInterval(connect, 2000)
        }

        return () => {
            socket.onopen = null
            socket.onmessage = null
            socket.onclose = null
        }
    }, [socket, onMessage, onConnection, onDisconnection])
}

export default useWebSocket
