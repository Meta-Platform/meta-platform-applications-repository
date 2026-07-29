import * as React from "react"
import { Banner, Button, Panel, TextInput } from "@i-components"

import APIList from "../Lists/API.list"

const APIColumn = ({
    onChangeAPIForCreate,
    onChangeAPI,
    APISelected,
    listAPI,
    APIForCreate,
    onCreateAPI,
    errorMessage}:any) =>
    <Panel title="API" icon="globe">
        <APIList
            onChangeAPI = {onChangeAPI}
            APISelected = {APISelected}
            listAPI     = {listAPI}/>

        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <TextInput
                value       = {APIForCreate || ""}
                placeholder = "nome do web service"
                onChange    = {({target:{value}}:any) => onChangeAPIForCreate(value)}/>
            <Button
                variant  = "primary"
                icon     = "add"
                disabled = {!(APIForCreate && APIForCreate !== "")}
                onClick  = {onCreateAPI}/>
        </div>

        { errorMessage && <Banner tone="danger" title="Falha ao criar a API">{errorMessage}</Banner> }
    </Panel>

export default APIColumn
