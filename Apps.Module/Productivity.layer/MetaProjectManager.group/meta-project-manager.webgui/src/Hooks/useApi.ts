import { useMemo } from "react"
import { useSelector } from "react-redux"

import { createApiClient, ApiClient } from "../api/client"

// Fornece o client tipado do Meta Project Manager às telas. O catálogo de
// servidores em execução (HTTPServerManager) é a "serverManagerInformation"
// consumida pelo transporte dual (GetAPI) — igual ao Desktop.container do
// template.
export const useApi = (): ApiClient => {
    const HTTPServerManager = useSelector((state: any) => state.HTTPServerManager)
    return useMemo(() => createApiClient(HTTPServerManager), [HTTPServerManager])
}

export default useApi
