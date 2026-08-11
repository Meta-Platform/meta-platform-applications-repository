import * as React from "react"
import { useState } from "react"
import { Button, ButtonGroup, Banner } from "@i-components"

import CodeEditor from "./CodeEditor"
import { BootForm, ServicesForm, EndpointGroupForm, CommandGroupForm } from "./MetadataForms"

const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

const FORMS:any = {
    "boot.json"           : BootForm,
    "services.json"       : ServicesForm,
    "endpoint-group.json" : EndpointGroupForm,
    "command-group.json"  : CommandGroupForm
}

// Um arquivo tem editor estruturado se é um dos metadados conhecidos.
export const isStructuredMetadata = (filePath:string) => !!FORMS[basename(filePath)]

// Editor de metadados com dois modos: Formulário (estruturado) e JSON cru.
// O formulário serializa de volta para `content` (JSON 4 espaços), então o fluxo
// de dirty/Save do editor pai continua valendo. Em JSON inválido, cai no modo cru.
const MetadataEditor = ({ filePath, content, onChange }:any) => {

    const Form = FORMS[basename(filePath)]
    const [mode, setMode] = useState<"form"|"raw">("form")

    let parsed:any
    let parseError:string | undefined
    try { parsed = JSON.parse(content) } catch(e:any) { parseError = (e && e.message) || "JSON inválido" }

    const canForm  = !!Form && !parseError
    const showForm = mode === "form" && canForm

    const emit = (obj:any) => onChange(JSON.stringify(obj, null, 4))

    return <div style={{flex:1, minHeight:0, display:"flex", flexDirection:"column"}}>
        <div style={{marginBottom:6, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            <ButtonGroup>
                <Button size="sm" variant={showForm ? "primary" : "default"} disabled={!canForm} icon="list" onClick={() => setMode("form")}>Formulário</Button>
                <Button size="sm" variant={!showForm ? "primary" : "default"} icon="code" onClick={() => setMode("raw")}>JSON</Button>
            </ButtonGroup>
            {
                parseError &&
                <Banner tone="danger" className="pdx-banner-compact">
                    JSON inválido — edite no modo JSON. ({parseError})
                </Banner>
            }
        </div>
        {
            showForm
            ? <div style={{flex:1, minHeight:0, overflow:"auto", padding:"4px 2px"}}>
                {/* largura limitada — evita inputs esticados por toda a tela ("muro") */}
                <div style={{maxWidth:820}}>
                    <Form value={parsed} onChange={emit} />
                </div>
              </div>
            : <CodeEditor value={content} language="json" onChange={onChange} />
        }
    </div>
}

export default MetadataEditor
