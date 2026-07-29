import * as React from "react"
import { Button, Panel, SelectInput, TextInput } from "@i-components"

import EndpointsList from "../Lists/Endpoints.list"

const METHOD_OPTIONS = [
	{ value: "GET",    label: "GET" },
	{ value: "POST",   label: "POST" },
	{ value: "PUT",    label: "PUT" },
	{ value: "DELETE", label: "DELETE" },
	{ value: "WS",     label: "WS" }
]

const EndpointColumn = ({
    methodForCreate,
    endpointForCreate,
    endpointSelected,
    listEndpoint,
    onCreateEndpoint,
    onChangeSummary,
    onChangeEndpointForCreate,
    onChangeMethodForCreate
    }:any) =>
    <Panel title="Endpoints" icon="sitemap">
        <EndpointsList
            endpointSelected = {endpointSelected || {}}
            endpoint         = {listEndpoint}
            onChangeSummary  = {onChangeSummary}/>

        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <TextInput
                value       = {endpointForCreate || ""}
                placeholder = "nome do endpoint"
                onChange    = {({target:{value}}:any) => onChangeEndpointForCreate(value)}/>
            <div style={{ width: 120, flex: "0 0 auto" }}>
                <SelectInput
                    value    = {methodForCreate}
                    options  = {METHOD_OPTIONS}
                    onChange = {onChangeMethodForCreate}/>
            </div>
            <Button
                variant  = "primary"
                icon     = "add"
                disabled = {!(endpointForCreate && endpointForCreate !== "")}
                onClick  = {onCreateEndpoint}/>
        </div>
    </Panel>

export default EndpointColumn
