import * as React from "react"
import { DataTable, KeyValueList, Panel } from "@i-components"

// Visualizador recursivo de parâmetros de execução (startup-params, boot).
// Objeto vira lista chave/valor; lista de objetos vira tabela; escalar vira
// valor mono. Toda a apresentação sai do kit comum — este componente não
// desenha borda, cor nem tipografia próprias (antes usava Segment/Table do
// Semantic com sombras e "aliceblue" no código).

const GetUniqueProperties = (arrayOfObjects: any[]): string[] => {
    const uniqueProperties = new Set<string>()
    arrayOfObjects.forEach((item) => Object.keys(item || {}).forEach((key) => uniqueProperties.add(key)))
    return Array.from(uniqueProperties)
}

const IsPlainObject = (value: any) =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const IsArrayOfObjects = (value: any) =>
    Array.isArray(value) && value.some(IsPlainObject)

const ScalarText = (value: any) => value === undefined || value === null ? "—" : String(value)

const ArrayOfObjectsTable = ({ rows }: { rows: any[] }) =>
    <DataTable
        dense
        rows={rows}
        columns={GetUniqueProperties(rows).map((property) => ({
            key: property,
            header: property,
            mono: true,
            render: (row: any) => ScalarText(row[property])
        }))}/>

const ParamsBlock = ({ params }: any): any => {

    const keys = Object.keys(params || {})
    if(keys.length === 0) return null

    // Escalares e listas simples viram uma única lista chave/valor; os valores
    // compostos ganham painel próprio, recursivamente.
    const flatItems = keys
        .filter((key) => !IsPlainObject(params[key]) && !IsArrayOfObjects(params[key]))
        .map((key) => ({
            label: key,
            mono: true,
            value: Array.isArray(params[key]) ? params[key].map(ScalarText).join(", ") : ScalarText(params[key])
        }))

    const compositeKeys = keys.filter((key) => IsPlainObject(params[key]) || IsArrayOfObjects(params[key]))

    return <>
        { flatItems.length > 0 && <KeyValueList columns={2} items={flatItems}/> }
        { compositeKeys.map((key) =>
            <Panel key={key} title={key} icon={Array.isArray(params[key]) ? "list" : "folder open"}>
                { Array.isArray(params[key])
                    ? <ArrayOfObjectsTable rows={params[key]}/>
                    : <ParamsBlock params={params[key]}/> }
            </Panel>) }
    </>
}

const ParamsViewer = ({ params }: any) =>
    params ? <div className="mp-stack"><ParamsBlock params={params}/></div> : null

export default ParamsViewer
