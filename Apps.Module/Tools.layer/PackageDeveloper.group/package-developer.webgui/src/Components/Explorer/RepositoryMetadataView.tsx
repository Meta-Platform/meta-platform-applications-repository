import * as React from "react"
import { EmptyState, Icon, Spinner } from "@i-components"

import { RepositoryModel } from "../../Domain/repositoryModel"
import { GitModel } from "../../Domain/gitModel"
import GitStatusView from "./GitStatusView"
import InspectorTabs from "./InspectorTabs"
import Markdown from "../Markdown"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import { Badge, CollapsibleSection, IconButton, Metrics } from "./ui/Primitives"
import { IssueList } from "./ui/ValidationBadge"

// Metadados do repositório: identidade (repository.json), estrutura, executáveis
// publicados (applications.json) e validação. Cada bloco some se o repositório
// não tiver aquele arquivo — nada de seção com "não declarado".

type Props = {
    model?      : RepositoryModel
    loading?    : boolean
    error?      : string
    onRetry?    : () => void
    onOpenPackage? : (path:string) => void
    gitModel?   : GitModel
}

const RepositoryMetadataView = ({ model, loading, error, onRetry, onOpenPackage, gitModel }:Props) => {

    const [tab, setTab] = React.useState("overview")

    if(error)
        return <div className="pdx-inspector__body">
            <EmptyState icon="exclamation triangle" title="Não foi possível ler os metadados do repositório"
                message={error}
                actions={onRetry ? <IconButton icon="redo" label="Tentar novamente" text="Tentar novamente" onClick={onRetry} /> : undefined} />
        </div>

    if(!model)
        return <div className="pdx-inspector__body"><div className="pdx-loading"><Spinner/></div></div>

    return <div className="pdx-inspector">
        <div className="pdx-inspector__head">
            <div className="pdx-ident">
                <Icon name="database" size="large" className="pdx-ident__icon" style={{color:"var(--mp-muted)"}} />
                <div className="pdx-ident__main">
                    <div className="pdx-ident__name">{model.name}</div>
                    <div className="pdx-ident__badges">
                        <Badge tone="type">repositório</Badge>
                        { model.branch && <Badge icon="code branch">{model.branch}</Badge> }
                        {
                            model.install.installed
                            ? <Badge tone="ok" icon="check circle" title={model.install.installationPath}>instalado</Badge>
                            : <Badge icon="circle outline" title="não registrado no ecossistema desta máquina">não instalado</Badge>
                        }
                        { !!model.dirtyCount && <Badge tone="warning" icon="pencil">{model.dirtyCount} sem commitar</Badge> }
                        { loading && <Spinner size="sm"/> }
                    </div>
                    <div className="pdx-ident__badges" style={{marginTop:6}}>
                        { model.namespace && <CopyableCodeValue value={model.namespace} type="text" /> }
                        { model.path && <CopyableCodeValue value={model.path} type="path" /> }
                    </div>
                    {
                        model.remote &&
                        <div className="pdx-ident__badges" style={{marginTop:4}}>
                            <span className="pdx-props__key" style={{fontSize:11}}>origem</span>
                            <CopyableCodeValue value={model.remote} type="text" />
                        </div>
                    }
                </div>
            </div>
        </div>

        <InspectorTabs active={tab} onSelect={setTab} tabs={
            [
                { id: "overview", label: "Visão geral", icon: "info circle" },
                model.readme ? { id: "readme", label: "README", icon: "file alternate outline" } : null,
                { id: "git", label: "Git", icon: "code branch" }
            ].filter(Boolean) as any
        } />

        {
            tab === "readme"
            ? <div className="pdx-inspector__body"><Markdown text={model.readme} /></div>
            : tab === "git"
            ? <div className="pdx-inspector__body">
                { gitModel
                    ? <GitStatusView model={gitModel} repositories={[model.name]} onOpenPackage={onOpenPackage} />
                    : <div className="pdx-loading"><Spinner/></div> }
              </div>
            :
        <div className="pdx-inspector__body">
            <Metrics items={[
                { value: model.counts.packages, label: "pacotes" },
                { value: model.counts.modules,  label: "módulos" },
                { value: model.counts.layers,   label: "layers" },
                { value: model.counts.groups,   label: "grupos" },
                { value: model.applications.length, label: "executáveis" },
                { value: model.taskLoaders.length, label: "task loaders" }
            ]} />

            { model.issues.length > 0 &&
                <div style={{marginBottom:16}}><IssueList issues={model.issues} /></div> }

            {
                (model.dependencies.length > 0 || model.supportedPackageTypes.length > 0) &&
                <CollapsibleSection id="repo-identity" title="Declaração" icon="tag">
                    <div className="pdx-props__grid">
                        {
                            model.dependencies.length > 0 &&
                            <>
                                <div className="pdx-props__key">dependências</div>
                                <div className="pdx-props__value pdx-inline">
                                    { model.dependencies.map((d) => <CopyableCodeValue key={d} value={d} type="text" />) }
                                </div>
                            </>
                        }
                        {
                            model.supportedPackageTypes.length > 0 &&
                            <>
                                <div className="pdx-props__key">tipos suportados</div>
                                <div className="pdx-props__value pdx-inline">
                                    { model.supportedPackageTypes.map((t) => <Badge key={t}>{t}</Badge>) }
                                </div>
                            </>
                        }
                    </div>
                </CollapsibleSection>
            }

            <CollapsibleSection id="repo-install" title="Instalação no ecossistema" icon="download"
                right={<span style={{marginLeft:"auto"}}>
                    { model.install.installed
                        ? <Badge tone="ok">{model.install.applications} aplicação(ões)</Badge>
                        : <Badge>não instalado</Badge> }
                </span>}>
                {
                    model.install.installed
                    ? <div className="pdx-props__grid">
                        <div className="pdx-props__key">instalado em</div>
                        <div className="pdx-props__value">
                            <CopyableCodeValue value={model.install.installationPath || ""} type="path" />
                        </div>
                        { model.install.sourceType &&
                            <>
                                <div className="pdx-props__key">fonte</div>
                                <div className="pdx-props__value">
                                    <Badge>{model.install.sourceType}</Badge>
                                    { model.install.sourcePath &&
                                        <CopyableCodeValue value={model.install.sourcePath} type="path" /> }
                                </div>
                            </>
                        }
                      </div>
                    : <div className="pdx-muted" style={{fontSize:12}}>
                        Este repositório não está registrado no ecossistema desta máquina
                        (nenhuma entrada em repositories.json). Instale com <code>repo install</code>
                        para que seus executáveis fiquem disponíveis.
                      </div>
                }
            </CollapsibleSection>

            {
                model.taskLoaders.length > 0 &&
                <CollapsibleSection id="repo-loaders" title="Task loaders" icon="cubes"
                    count={model.taskLoaders.length}>
                    <div className="pdx-tablewrap">
                        <table className="pdx-table pdx-table--nowrap">
                            <thead><tr><th>objectLoaderType</th><th>pacote</th><th>entrada</th></tr></thead>
                            <tbody>
                                {
                                    model.taskLoaders.map((loader, i) =>
                                        <tr key={i} style={{cursor:"default"}}>
                                            <td className="pdx-mono"><strong>{loader.objectLoaderType}</strong></td>
                                            <td className="pdx-mono">{loader.package}</td>
                                            <td className="pdx-mono">
                                                {loader.entry}
                                                { loader.injectsDeps &&
                                                    <Badge title="injeta dependências nos pacotes">injectsDeps</Badge> }
                                            </td>
                                        </tr>)
                                }
                            </tbody>
                        </table>
                    </div>
                </CollapsibleSection>
            }

            {
                model.byType.length > 0 &&
                <CollapsibleSection id="repo-types" title="Pacotes por tipo" icon="cubes" count={model.byType.length}>
                    <div className="pdx-inline">
                        { model.byType.map((t) =>
                            <Badge key={t.ext} tone="type">{t.ext} <span className="pdx-chip__count">{t.count}</span></Badge>) }
                    </div>
                </CollapsibleSection>
            }

            {
                model.modules.length > 0 &&
                <CollapsibleSection id="repo-structure" title="Estrutura" icon="sitemap" count={model.modules.length}>
                    {
                        model.modules.map((mod) =>
                            <div key={mod.name} className="pdx-card">
                                <div className="pdx-card__head">
                                    <Icon name="cubes" style={{margin:0, color:"var(--mp-muted)"}} />
                                    <span className="pdx-card__title">{mod.name}</span>
                                </div>
                                <div className="pdx-card__body">
                                    <div className="pdx-props__grid">
                                        { mod.layers.map((layer) =>
                                            <React.Fragment key={layer.name}>
                                                <div className="pdx-props__key">{layer.name}</div>
                                                <div className="pdx-props__value pdx-mono" style={{fontSize:12}}>{layer.packages} pacote(s)</div>
                                            </React.Fragment>) }
                                    </div>
                                </div>
                            </div>)
                    }
                </CollapsibleSection>
            }

            {
                model.applications.length > 0 &&
                <CollapsibleSection id="repo-apps" title="Executáveis publicados" icon="rocket"
                    count={model.applications.length}
                    right={<span style={{marginLeft:"auto"}}>
                        <Badge tone="ok">{model.applications.filter((a) => a.installed).length} instalado(s)</Badge>
                    </span>}>
                    <div className="pdx-tablewrap">
                        <table className="pdx-table pdx-table--nowrap">
                            <thead><tr><th>executável</th><th>tipo</th><th>na plataforma</th><th>pacote</th></tr></thead>
                            <tbody>
                                {
                                    model.applications.map((app, i) =>
                                        <tr key={i}
                                            onClick={() => app.resolvedPackage && onOpenPackage && onOpenPackage(app.resolvedPackage.path)}
                                            style={{cursor: app.resolvedPackage ? "pointer" : "default"}}>
                                            <td className="pdx-mono">
                                                <strong>{app.executable}</strong>
                                                { !app.declared &&
                                                    <Badge tone="warning" title="instalado, mas não declarado pelo repositório">
                                                        órfão
                                                    </Badge> }
                                            </td>
                                            <td>{app.appType}</td>
                                            <td>
                                                { app.installed
                                                    ? <Badge tone="ok" icon="check">instalado</Badge>
                                                    : <Badge icon="circle outline">não instalado</Badge> }
                                            </td>
                                            <td className="pdx-mono">
                                                {app.packageNamespace}
                                                { app.declared && !app.resolvedPackage &&
                                                    <Badge tone="warning" icon="warning sign" title="pacote não encontrado">ausente</Badge> }
                                            </td>
                                        </tr>)
                                }
                            </tbody>
                        </table>
                    </div>
                </CollapsibleSection>
            }

            {
                model.metadataFiles.length > 0 &&
                <CollapsibleSection id="repo-files" title="Arquivos de metadado" icon="file code outline"
                    count={model.metadataFiles.length} defaultOpen={false}>
                    <div className="pdx-inline">
                        { model.metadataFiles.map((f) => <CopyableCodeValue key={f} value={f} type="path" />) }
                    </div>
                </CollapsibleSection>
            }
        </div>
        }
    </div>
}

export default RepositoryMetadataView
