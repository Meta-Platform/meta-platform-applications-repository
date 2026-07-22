import * as React from "react"
import { useState } from "react"

import { Button, Icon, Label } from "semantic-ui-react"

import PackageIcon from "./PackageIcon"
import {
    PackageInformation,
    PackageKey,
    PackageCategory,
    IsBootable,
    IsCommandLine,
    IsRunning
} from "./PackageTree"

// Lista plana de resultados do Launcher — o modo "achar e rodar".
//
// Ao contrário da árvore (module → layer → group), aqui os pacotes já vêm
// filtrados/buscados e aparecem lado a lado, com o caminho apenas como legenda
// apagada. A ideia é reconhecer o pacote pelo nome e lançá-lo num clique: apps
// executáveis ganham um botão ▶ inline; o que já está no ar sobe para o topo.

const CATEGORY_LABEL:any = { app: "app", cli: "cli", service: "serviço", other: "—" }
const CATEGORY_COLOR:any = { app: "blue", cli: "teal", service: "violet", other: "grey" }

const PathLabel = ({ repositoryParams }:any) => {
    const { namespaceRepo, moduleName, layerName, parentGroup } = repositoryParams
    const path = [ namespaceRepo, moduleName, layerName, parentGroup ].filter(Boolean).join(" · ")
    return <span
        style={{ display: "block", fontSize: ".78em", color: "var(--mp-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={path}>
        {path}
    </span>
}

const StatusDot = ({ packageInformation }:any) => {
    if(!IsRunning(packageInformation)) return null
    const status = packageInformation.applicationInServiceState?.status
    const color = status === "ACTIVE" ? "green" : "orange"
    return <Icon name="circle" size="small" color={color as any} title={status} style={{ flex: "0 0 auto", margin: 0 }}/>
}

const ResultRow = ({ packageInformation, isSelected, onSelect, onRun, serverManagerInformation }:any) => {

    const [ isBusy, setIsBusy ] = useState(false)

    const { packageName, ext } = packageInformation.repositoryParams
    const category = PackageCategory(packageInformation)
    const running  = IsRunning(packageInformation)
    const status   = packageInformation.applicationInServiceState?.status
    const port     = packageInformation.applicationInServiceState?.staticParameters?.startupParams?.port

    // Lançamento rápido: só apps/serviços executáveis e ainda parados. CLI precisa
    // escolher comando, então cai no painel de detalhe (clique na linha).
    const canQuickRun = IsBootable(packageInformation) && !IsCommandLine(packageInformation) && !running
    const canOpen     = running && status === "ACTIVE" && port

    const handleQuickRun = async (e:any) => {
        e.stopPropagation()
        setIsBusy(true)
        try { await onRun(packageInformation) } catch(err){ console.log(err) } finally { setIsBusy(false) }
    }

    return <div
        className="launcher-result"
        onClick={() => onSelect(packageInformation)}
        style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px",
            cursor: "pointer", borderRadius: "6px", marginBottom: "3px",
            background: isSelected ? "var(--mp-accent-soft, rgba(45,116,196,.12))" : undefined,
            boxShadow: isSelected ? "inset 3px 0 0 var(--mp-accent-blue)" : undefined
        }}>

        <span style={{ flex: "0 0 auto", display: "flex", width: 22, justifyContent: "center" }}>
            <PackageIcon packageInformation={packageInformation} serverManagerInformation={serverManagerInformation} size={20}/>
        </span>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {packageName}
                </span>
                <Label size="mini" basic color={CATEGORY_COLOR[category]} style={{ flex: "0 0 auto", padding: "2px 5px" }}>
                    {ext}
                </Label>
                <StatusDot packageInformation={packageInformation}/>
            </div>
            <PathLabel repositoryParams={packageInformation.repositoryParams}/>
        </div>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "4px" }}>
            {
                canOpen &&
                <Button
                    color="green" size="mini" compact
                    onClick={(e:any) => { e.stopPropagation(); window.open(`http://localhost:${port}`, "_blank") }}
                    title="abrir">
                    <Icon name="external" style={{ margin: 0 }}/>
                </Button>
            }
            {
                canQuickRun &&
                <Button
                    primary size="mini" compact
                    loading={isBusy} disabled={isBusy}
                    onClick={handleQuickRun}
                    title="executar">
                    <Icon name="play" style={{ margin: 0 }}/>
                </Button>
            }
        </div>
    </div>
}

const PackageResults = ({
    packageList = [],
    selectedKey,
    onSelectPackage,
    onRunPackage,
    serverManagerInformation
}:any) => {

    if(packageList.length === 0)
        return <div style={{ color: "var(--mp-muted-2)", padding: "40px 20px", textAlign: "center" }}>
            <Icon name="search" size="big" style={{ color: "var(--mp-line-soft)" }}/>
            <div style={{ marginTop: "10px" }}>nenhum pacote encontrado</div>
            <div style={{ marginTop: "4px", fontSize: ".85em" }}>ajuste a busca ou os filtros acima.</div>
        </div>

    // Em execução primeiro (o que importa acompanhar), depois alfabético.
    const sorted = [...packageList].sort((a:PackageInformation, b:PackageInformation) => {
        const ra = IsRunning(a) ? 0 : 1
        const rb = IsRunning(b) ? 0 : 1
        if(ra !== rb) return ra - rb
        return a.repositoryParams.packageName.localeCompare(b.repositoryParams.packageName)
    })

    return <div style={{ padding: "2px" }}>
        {
            sorted.map((packageInformation:PackageInformation) => {
                const key = PackageKey(packageInformation.repositoryParams)
                return <ResultRow
                    key={key}
                    packageInformation={packageInformation}
                    isSelected={key === selectedKey}
                    onSelect={onSelectPackage}
                    onRun={onRunPackage}
                    serverManagerInformation={serverManagerInformation}/>
            })
        }
    </div>
}

export default PackageResults
export { CATEGORY_LABEL, CATEGORY_COLOR }
