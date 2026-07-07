import * as React from "react"
import { Header, Button, Input, Icon } from "semantic-ui-react"

import { StringListEditor, RecordListEditor } from "./MetadataFormControls"
import { setKey, patchRecord, addRecord, removeRecord } from "./metadataFormLogic"

const Section = ({ title, children }:any) =>
    <div style={{marginBottom:18}}>
        <Header as="h5" style={{marginBottom:8, textTransform:"uppercase", letterSpacing:0.4, fontSize:"0.8em", opacity:0.75, borderBottom:"1px solid var(--mp-line-faint)", paddingBottom:4}}>{title}</Header>
        {children}
    </div>

// ----- boot.json (objeto) — preserva chaves de topo não modeladas -----
export const BootForm = ({ value, onChange }:any) => {
    const v = value && typeof value === "object" ? value : {}
    const set = (key:string, val:any) => onChange(setKey(v, key, val))
    return <div>
        <Section title="Params">
            <StringListEditor value={v.params || []} placeholder="port" onChange={(x:any) => set("params", x)} />
        </Section>
        <Section title="Executables">
            <RecordListEditor value={v.executables || []} onChange={(x:any) => set("executables", x)}
                emptyItem={{ executableName: "", dependency: "" }}
                itemLabel={(it:any) => it.executableName || "executable"}
                fields={[{ key:"executableName", label:"executableName" }, { key:"dependency", label:"dependency" }]} />
        </Section>
        <Section title="Services">
            <RecordListEditor value={v.services || []} onChange={(x:any) => set("services", x)}
                emptyItem={{ namespace: "", dependency: "", params: {}, "bound-params": {} }}
                itemLabel={(it:any) => it.namespace || "service"}
                fields={[
                    { key:"namespace", label:"namespace" },
                    { key:"dependency", label:"dependency" },
                    { key:"params", label:"params", type:"keyvalue" },
                    { key:"bound-params", label:"bound-params", type:"keyvalue" }
                ]} />
        </Section>
        <Section title="Endpoints">
            <RecordListEditor value={v.endpoints || []} onChange={(x:any) => set("endpoints", x)}
                emptyItem={{ dependency: "", "bound-params": {} }}
                itemLabel={(it:any) => it.dependency || "endpoint"}
                fields={[
                    { key:"dependency", label:"dependency" },
                    { key:"bound-params", label:"bound-params", type:"keyvalue" }
                ]} />
        </Section>
        <Section title="Windows">
            <RecordListEditor value={v.windows || []} onChange={(x:any) => set("windows", x)}
                emptyItem={{ title: "", dependency: "", width: 1280, height: 800, params: {}, "bound-params": {} }}
                itemLabel={(it:any) => it.title || "window"}
                fields={[
                    { key:"title", label:"title" },
                    { key:"dependency", label:"dependency" },
                    { key:"width", label:"width", type:"number" },
                    { key:"height", label:"height", type:"number" },
                    { key:"params", label:"params", type:"keyvalue" },
                    { key:"bound-params", label:"bound-params", type:"keyvalue" }
                ]} />
        </Section>
    </div>
}

// ----- services.json (array) -----
export const ServicesForm = ({ value, onChange }:any) =>
    <RecordListEditor value={Array.isArray(value) ? value : []} onChange={onChange}
        emptyItem={{ namespace: "", path: "", "bound-params": [], params: [] }}
        itemLabel={(it:any) => it.namespace || "service"}
        fields={[
            { key:"namespace", label:"namespace" },
            { key:"path", label:"path" },
            { key:"bound-params", label:"bound-params", type:"stringlist" },
            { key:"params", label:"params", type:"stringlist" }
        ]} />

// ----- endpoint-group.json (objeto) -----
export const EndpointGroupForm = ({ value, onChange }:any) => {
    const v = value && typeof value === "object" ? value : {}
    const set = (key:string, val:any) => onChange(setKey(v, key, val))
    return <div>
        <Section title="bound-params">
            <StringListEditor value={v["bound-params"] || []} onChange={(x:any) => set("bound-params", x)} />
        </Section>
        <Section title="Endpoints">
            <RecordListEditor value={v.endpoints || []} onChange={(x:any) => set("endpoints", x)}
                emptyItem={{ url: "", type: "controller", params: {}, "bound-params": {} }}
                itemLabel={(it:any) => it.url || "endpoint"}
                fields={[
                    { key:"url", label:"url" },
                    { key:"type", label:"type" },
                    { key:"params", label:"params", type:"keyvalue" },
                    { key:"bound-params", label:"bound-params", type:"keyvalue" }
                ]} />
        </Section>
    </div>
}

// ----- command-group.json (objeto, comandos recursivos) -----
const CMD_FIELDS = ["command", "namespace", "description", "path"]

const CMD_HANDLED = CMD_FIELDS.concat(["children", "parameters", "parametersToLoad"])

const CommandTree = ({ list, onChange }:any) => {
    const items:any[] = Array.isArray(list) ? list : []
    return <div>
        {
            items.map((it:any, i:number) => {
                const extra = Object.keys(it || {}).filter((k) => CMD_HANDLED.indexOf(k) === -1)
                return <div key={i} style={{border:"1px solid var(--mp-line-faint)", borderRadius:6, padding:8, marginBottom:8}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
                        <strong style={{opacity:0.7, fontSize:"0.85em"}}>{it.command || it.namespace || "comando"}</strong>
                        <Button size="mini" basic icon="trash" color="red" onClick={() => onChange(removeRecord(items, i))} />
                    </div>
                    {
                        CMD_FIELDS.map((k) =>
                            <div key={k} style={{marginBottom:4}}>
                                <label style={{fontSize:"0.78em", opacity:0.7, display:"block", marginBottom:2}}>{k}</label>
                                <Input size="mini" fluid value={it[k] != null ? it[k] : ""}
                                    onChange={(e:any) => onChange(patchRecord(items, i, k, e.target.value))} />
                            </div>)
                    }
                    <div style={{marginTop:6}}>
                        <label style={{fontSize:"0.78em", opacity:0.7, display:"block", marginBottom:2}}>parameters</label>
                        <RecordListEditor value={it.parameters || []} onChange={(x:any) => onChange(patchRecord(items, i, "parameters", x))}
                            emptyItem={{ key:"", paramType:"positional", valueType:"string", describe:"" }}
                            itemLabel={(p:any) => p.key || "param"}
                            fields={[
                                { key:"key", label:"key" },
                                { key:"paramType", label:"paramType (positional/option)" },
                                { key:"valueType", label:"valueType (string/number/boolean)" },
                                { key:"describe", label:"describe" }
                            ]} />
                    </div>
                    <div style={{marginTop:6}}>
                        <label style={{fontSize:"0.78em", opacity:0.7, display:"block", marginBottom:2}}>parametersToLoad</label>
                        <StringListEditor value={it.parametersToLoad || []} placeholder="nomeDoBoundParam"
                            onChange={(x:any) => onChange(patchRecord(items, i, "parametersToLoad", x))} />
                    </div>
                    <div style={{marginLeft:12, marginTop:6, borderLeft:"2px solid var(--mp-line-faint)", paddingLeft:8}}>
                        <div style={{fontSize:"0.75em", opacity:0.6, marginBottom:4}}>children</div>
                        <CommandTree list={it.children || []} onChange={(x:any) => onChange(patchRecord(items, i, "children", x))} />
                    </div>
                    {
                        extra.length > 0 &&
                        <div style={{fontSize:"0.72em", opacity:0.5, marginTop:4}}>
                            <Icon name="lock" /> preservados: {extra.join(", ")}
                        </div>
                    }
                </div>
            })
        }
        <Button size="mini" basic icon="plus" content="Adicionar comando"
            onClick={() => onChange(addRecord(items, { command: "", namespace: "" }))} />
    </div>
}

export const CommandGroupForm = ({ value, onChange }:any) => {
    const v = value && typeof value === "object" ? value : {}
    const set = (key:string, val:any) => onChange(setKey(v, key, val))
    return <div>
        <Section title="bound-params">
            <StringListEditor value={v["bound-params"] || []} onChange={(x:any) => set("bound-params", x)} />
        </Section>
        <Section title="Commands">
            <CommandTree list={v.commands || []} onChange={(x:any) => set("commands", x)} />
        </Section>
    </div>
}
