import * as React from "react"
import { Button, Stack, Toolbar } from "@i-components"

import EndpointForm    from "../Forms/Endpoint.form"
import TableParameters from "../Components/TableParameters.component"

const DetailsColumn = ({
    hasPendingChanges,
    endpointSelected,
    methodForUpdate,
    parametersForUpdate,
    pathForUpdate,
    onChangeUrl,
    onChangeMethod,
    onChangeParameters,
    onCancelEndpointEditing,
    onConfirmEndpointEditing
}:any) =>
<Stack>
    {
        endpointSelected
        && <EndpointForm
                values         = {endpointSelected || {}}
                summary        = {endpointSelected.summary}
                method         = {methodForUpdate || endpointSelected.method}
                path           = {pathForUpdate || endpointSelected.path}
                onChangeUrl    = {onChangeUrl}
                onChangeMethod = {onChangeMethod}/>
    }
    {
        endpointSelected
        && <TableParameters
                onChangeParameters = {onChangeParameters}
                parameters         = {parametersForUpdate || endpointSelected.parameters || []}/>
    }
    <Toolbar>
        <Toolbar.Spacer/>
        <Button
            icon     = "undo"
            disabled = {!hasPendingChanges}
            onClick  = {onCancelEndpointEditing}>
            Cancelar
        </Button>
        <Button
            variant  = "primary"
            icon     = "save"
            disabled = {!hasPendingChanges}
            onClick  = {onConfirmEndpointEditing}>
            Confirmar
        </Button>
    </Toolbar>
</Stack>

export default DetailsColumn
