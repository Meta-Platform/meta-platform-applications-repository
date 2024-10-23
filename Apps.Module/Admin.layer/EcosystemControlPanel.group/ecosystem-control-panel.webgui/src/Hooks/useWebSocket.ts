
import { useEffect, useState, useRef } from "react"

const useWebSocket = ({
	socket:_socket,
	onMessage,
	onConnection,
	onDisconnection
}) => {

    const [ socket, setSocket ] = useState<any>()
    const [ statusConnection, changeStatusConnection ] = useState(false)
	const reconnectInterval = useRef<number | null>(null)

    useEffect(() => {
		connectToSocket()
		return () => {
            if (reconnectInterval.current) {
                clearInterval(reconnectInterval.current)
            }
        }
	}, [])

    useEffect(() => {
		if(socket){
			attachEventsToSocket()
		}
	}, [socket])

	useEffect(() => {
		if(!socket && !statusConnection && reconnectInterval){
			console.log("connection down! Attempting to reconnect...")
			reconnectInterval.current = window.setInterval(connectToSocket, 2000)
		}
	}, [statusConnection])

    const attachEventsToSocket = () => {
		socket.onopen = () => handleTaskListSocketConnection()

		socket.onmessage = function(event:any) {
			const {data} = event
			const message = JSON.parse(data)
			onMessage(message)
		}

		socket.onclose = (event:any) => handleTaskListSocketDisconnection()
	}

    const connectToSocket = () => {
		setSocket(_socket())
	}

    const handleTaskListSocketConnection = () => {
		changeStatusConnection(true)
		if (reconnectInterval.current) {
            clearInterval(reconnectInterval.current)
            reconnectInterval.current = null
        }
		onConnection()
	}

	const handleTaskListSocketDisconnection = () => {
		changeStatusConnection(false)
		setSocket(undefined)
		onDisconnection()
	}

}

export default useWebSocket