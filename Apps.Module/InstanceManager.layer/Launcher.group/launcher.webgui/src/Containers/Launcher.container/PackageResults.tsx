import * as React from "react"
import { useState } from "react"

import { EmptyState, Icon, IconButton, ObjectCard, StatusBadge } from "@i-components"

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
//
// Cada resultado é um ObjectCard do kit. O clique de seleção fica no invólucro
// e não no cartão: os botões de ação (▶ / abrir) são <button>, e um <button>
// não pode conter outro.

const CATEGORY_LABEL:any = { app: "app", cli: "cli", service: "serviço", other: "—" }
const CATEGORY_ICON:any  = { app: "rocket", cli: "terminal", service: "cogs", other: "cube" }

const PackagePath = ({ repositoryParams }:any) => {
    const { namespaceRepo, moduleName, layerName, parentGroup } = repositoryParams
    return [ namespaceRepo, moduleName, layerName, parentGroup ].filter(Boolean).join(" · ")
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

    const handleQuickRun = async (event:any) => {
        event.stopPropagation()
        setIsBusy(true)
        try { await onRun(packageInformation) } catch(err){ console.log(err) } finally { setIsBusy(false) }
    }

    return <div className="lnc-result" onClick={() => onSelect(packageInformation)}>
        <ObjectCard
            className="is-clickable"
            selected={isSelected}
            iconNode={
                <PackageIcon
                    packageInformation={packageInformation}
                    serverManagerInformation={serverManagerInformation}
                    size={20}/>
            }
            title={packageName}
            meta={PackagePath(packageInformation)}
            status={ running ? <StatusBadge status={status}/> : undefined }
            chips={<>
                <span className="mp-type-chip">{ext}</span>
                {
                    // A intenção só vira chip quando ela ACRESCENTA algo ao tipo
                    // (desktopapp → app); num .cli seria repetir a mesma palavra.
                    CATEGORY_LABEL[category] !== ext &&
                    <span className="mp-type-chip">
                        <Icon name={CATEGORY_ICON[category]}/> {CATEGORY_LABEL[category]}
                    </span>
                }
            </>}
            right={
                (canOpen || canQuickRun) &&
                <span className="lnc-result-actions">
                    {
                        canOpen &&
                        <IconButton
                            icon="external"
                            label="abrir"
                            size="sm"
                            onClick={(event:any) => {
                                event.stopPropagation()
                                window.open(`http://localhost:${port}`, "_blank")
                            }}/>
                    }
                    {
                        canQuickRun &&
                        <IconButton
                            icon="play"
                            label="executar"
                            size="sm"
                            variant="primary"
                            disabled={isBusy}
                            onClick={handleQuickRun}/>
                    }
                </span>
            }/>
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
        return <EmptyState
            icon="search"
            title="nenhum pacote encontrado"
            message="ajuste a busca ou os filtros acima."/>

    // Em execução primeiro (o que importa acompanhar), depois alfabético.
    const sorted = [...packageList].sort((a:PackageInformation, b:PackageInformation) => {
        const ra = IsRunning(a) ? 0 : 1
        const rb = IsRunning(b) ? 0 : 1
        if(ra !== rb) return ra - rb
        return a.repositoryParams.packageName.localeCompare(b.repositoryParams.packageName)
    })

    return <div>
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
export { CATEGORY_LABEL, CATEGORY_ICON }
