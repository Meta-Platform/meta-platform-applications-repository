import * as React from "react"
import styled     from "styled-components"

import {
	Grid, 
	Button
} from "semantic-ui-react"

import EndpointForm    from "../Forms/Endpoint.form"
import TableParameters from "../Components/TableParameters.component"

const RowStyle = styled(Grid.Row)`
	margin-bottom:15px;
`

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
<>
    <RowStyle>
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
    </RowStyle>
    <RowStyle>
        {
            endpointSelected 
            && <TableParameters 
                    onChangeParameters={onChangeParameters}
                    parameters={parametersForUpdate || endpointSelected.parameters || []}/>
        }
    </RowStyle>
    <Grid.Row>
        <Grid.Column>
            <Button 
                negative 
                disabled      = {!hasPendingChanges}
                onClick       = {onCancelEndpointEditing} 
                labelPosition = "right"
                icon          = "trash" 
                content       = "Cancel" />
            <Button 
                positive 
                disabled      = {!hasPendingChanges}
                onClick       = {onConfirmEndpointEditing}
                labelPosition = "right"
                icon          = "save" 
                content       = "Confirm" />
        </Grid.Column>
    </Grid.Row>
</>

export default DetailsColumn