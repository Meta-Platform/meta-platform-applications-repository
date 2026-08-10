import * as React from "react"
import {useState, useEffect} from "react"
import { connect } from "react-redux"

import {
    Banner, ContentArea, EmptyState, KeyValueList,
    PageMasthead, Panel, StatusChip, Surface
} from "@i-components"

import GetRequestByServer from "../Utils/GetRequestByServer"

// Tom do status da fonte. Os status daqui (PENDING/WAITING/READY/ERROR) são do
// serviço de dados e não estão no vocabulário do StatusBadge da plataforma —
// por isso o chip com tom explícito, e não o badge.
const GetToneByStatus = (status:string) => {
    switch(status){
        case "WAITING": return "warning"
        case "READY"  : return "success"
        case "ERROR"  : return "danger"
        default       : return "neutral"
    }
}

const SECTIONS = [
    { type: "FSService",        title: "File System",              icon: "folder" },
    { type: "ORMService",       title: "Object Relational Mapper",  icon: "database" },
    { type: "DataStoreService", title: "Data Store",                icon: "hdd" }
]

// Propriedades já mostradas no cabeçalho do cartão.
const HEADER_PROPERTIES = [ "type", "name", "status" ]

const MONO_PROPERTIES = [ "cwd", "keystone", "filename", "storage", "dialect" ]

const Source = (source:any) =>
    <Surface className="ds-status-card">
        <div className="ds-status-card__head">
            <strong className="ds-status-card__name">{source.name}</strong>
            <StatusChip label={source.status} tone={GetToneByStatus(source.status)}/>
        </div>

        { source.status === "ERROR" && source.message &&
            <Banner tone="danger">{source.message}</Banner> }

        <KeyValueList
            items = {
                Object.keys(source)
                .filter((property:string) => HEADER_PROPERTIES.indexOf(property) < 0)
                .map((property:string) => ({
                    label : property,
                    value : source[property] === null || source[property] === undefined
                        ? undefined
                        : String(source[property]),
                    mono  : MONO_PROPERTIES.indexOf(property) >= 0
                }))
            }/>
    </Surface>

const StatusContainer = ({HTTPServerManager}:any) => {

    const [status, setStatus] = useState<any[]>()

    useEffect(() =>  {

		let count = setInterval(() =>{
			updateStatus()
		}, 500)

		return () => clearInterval(count)
	}, [])

    const updateStatus = () => {
		GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "DataSources")
		.Status()
		.then(({data}:any) => setStatus(data))
	}

    const SourcesOf = (type:string) => (status || []).filter((source:any) => source.type === type)

    return <ContentArea wide>
        <PageMasthead
            icon     = "database"
            title    = "Status das fontes de dados"
            subtitle = "Serviços registrados no gerenciador, atualizados a cada 500 ms."/>

        { SECTIONS.map(({type, title, icon}) => {
            const sources = SourcesOf(type)
            return <Panel key={type} title={title} icon={icon} className="ds-status-panel">
                { sources.length === 0
                    ? <EmptyState icon="inbox" message="Nenhuma fonte deste tipo."/>
                    : <div className="ds-status-grid">
                        { sources.map((source:any, key:number) => <Source key={key} {...source}/>) }
                    </div> }
            </Panel>
        }) }
    </ContentArea>
}

const mapStateToProps = ({HTTPServerManager}:any) => ({
	HTTPServerManager
})

export default connect(mapStateToProps, (dispatch:any) =>({}))(StatusContainer)
