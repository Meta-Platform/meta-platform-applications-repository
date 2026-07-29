import * as React from "react"
import { EntityHeader, FormField, SelectInput, TextInput } from "@i-components"

const METHOD_OPTIONS = [
	{ value: "GET",    label: "GET" },
	{ value: "POST",   label: "POST" },
	{ value: "PUT",    label: "PUT" },
	{ value: "DELETE", label: "DELETE" },
	{ value: "WS",     label: "WS" }
]

// Método + path do endpoint. A moldura é do kit: EntityHeader para a identidade
// do endpoint e FormField/TextInput/SelectInput para a edição.
const EndpointForm = ({summary, method, path, onChangeUrl, onChangeMethod} : any) =>
	<>
		<EntityHeader icon="edit outline" title={summary} typeLabel="endpoint"/>
		<div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
			<div style={{ width: 130, flex: "0 0 auto" }}>
				<FormField label="método">
					<SelectInput
						value    = {method || "GET"}
						options  = {METHOD_OPTIONS}
						onChange = {({target:{value}}:any) => onChangeMethod(value)}/>
				</FormField>
			</div>
			<div style={{ flex: "1 1 auto", minWidth: 0 }}>
				<FormField label="path" error={!path || path === "" ? "informe o path" : undefined} required>
					<TextInput
						value       = {path || ""}
						invalid     = {!path || path === ""}
						placeholder = "/recurso/:id"
						onChange    = {({target:{value}}:any) => onChangeUrl(value)}/>
				</FormField>
			</div>
		</div>
	</>

export default EndpointForm
