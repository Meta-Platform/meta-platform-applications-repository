import { useMemo } from "react"
import { useSelector } from "react-redux"

import { createApiClient, ApiClient } from "../api/client"
import { useReadOnly } from "./useReadOnly"

// Fornece o client tipado do Meta Project Manager às telas. O catálogo de
// servidores em execução (HTTPServerManager) é a "serverManagerInformation"
// consumida pelo transporte dual (GetAPI) — igual ao Desktop.container do
// template.
export const useApi = (): ApiClient => {
    const HTTPServerManager = useSelector((state: any) => state.HTTPServerManager)
    // Num projeto arquivado, o client recusa qualquer escrita (o backend também).
    const readOnly = useReadOnly()
    return useMemo(() => createApiClient(HTTPServerManager, { readOnly }), [HTTPServerManager, readOnly])
}

export default useApi
