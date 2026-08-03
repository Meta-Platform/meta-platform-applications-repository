import { useMemo } from "react"
import { useSelector } from "react-redux"

import Api from "../Utils/Api"

/*
    As cinco APIs do aplicativo, já ligadas ao transporte certo.

    O mesmo código serve navegador e janela Electron: `Api` resolve HTTP quando
    há servidor e IPC quando roda no GUI-host. Nenhuma tela sabe a diferença.
*/
export const useApi = () => {
    const HTTPServerManager = useSelector((estado: any) => estado.HTTPServerManager)

    return useMemo(() => {
        const Para = Api(HTTPServerManager)
        return {
            connections: Para("ContainerConnections"),
            containers: Para("Containers"),
            images: Para("Images"),
            networks: Para("Networks"),
            volumes: Para("Volumes")
        }
    }, [HTTPServerManager])
}

export default useApi
