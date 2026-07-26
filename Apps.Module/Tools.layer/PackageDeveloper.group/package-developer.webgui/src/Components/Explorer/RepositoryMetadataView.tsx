import * as React from "react"
import { Icon, Loader } from "semantic-ui-react"

import { RepositoryModel } from "../../Domain/repositoryModel"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import { Badge, CollapsibleSection, EmptyState, IconButton, Metrics } from "./ui/Primitives"
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
}

const RepositoryMetadataView = ({ model, loading, error, onRetry, onOpenPackage }:Props) => {

    if(error)
        return <div className="pdx-inspector__body">
            <EmptyState icon="exclamation triangle" title="Não foi possível ler os metadados do repositório"
                hint={error}
                action={onRetry ? <IconButton icon="redo" label="Tentar novamente" text="Tentar novamente" onClick={onRetry} /> : undefined} />
        </div>

    if(!model)
        return <div className="pdx-inspector__body"><Loader active inline="centered" /></div>

    return <div className="pdx-inspector">
        <div className="pdx-inspector__head">
            <div className="pdx-ident">
                <Icon name="database" size="large" className="pdx-ident__icon" style={{color:"var(--mp-muted)"}} />
                <div className="pdx-ident__main">
                    <div className="pdx-ident__name">{model.name}</div>
                    <div className="pdx-ident__badges">
                        <Badge tone="type">repositório</Badge>
                        { model.branch && <Badge icon="code branch">{model.branch}</Badge> }
                        { !!model.dirtyCount && <Badge tone="warning" icon="pencil">{model.dirtyCount} sem commitar</Badge> }
                        { loading && <Loader active inline size="mini" /> }
                    </div>
                    <div className="pdx-ident__badges" style={{marginTop:6}}>
                        { model.namespace && <CopyableCodeValue value={model.namespace} type="text" /> }
                        { model.path && <CopyableCodeValue value={model.path} type="path" /> }
                    </div>
                </div>
            </div>
        </div>

        <div className="pdx-inspector__body">
            <Metrics items={[
                { value: model.counts.packages, label: "pacotes" },
                { value: model.counts.modules,  label: "módulos" },
                { value: model.counts.layers,   label: "layers" },
                { value: model.counts.groups,   label: "grupos" },
                { value: model.applications.length, label: "executáveis" }
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
                    count={model.applications.length} defaultOpen={false}>
                    <div className="pdx-tablewrap">
                        <table className="pdx-table">
                            <thead><tr><th>executável</th><th>tipo</th><th>pacote</th></tr></thead>
                            <tbody>
                                {
                                    model.applications.map((app, i) =>
                                        <tr key={i}
                                            onClick={() => app.resolvedPackage && onOpenPackage && onOpenPackage(app.resolvedPackage.path)}
                                            style={{cursor: app.resolvedPackage ? "pointer" : "default"}}>
                                            <td className="pdx-mono">{app.executable}</td>
                                            <td>{app.appType}</td>
                                            <td className="pdx-mono">
                                                {app.packageNamespace}
                                                { !app.resolvedPackage &&
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
    </div>
}

export default RepositoryMetadataView
