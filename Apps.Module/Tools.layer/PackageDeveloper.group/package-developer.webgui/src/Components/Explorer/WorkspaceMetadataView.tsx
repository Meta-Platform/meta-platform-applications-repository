import * as React from "react"
import { Icon } from "semantic-ui-react"

import { WorkspaceModel } from "../../Domain/repositoryModel"
import { GitModel } from "../../Domain/gitModel"
import GitStatusView from "./GitStatusView"
import InspectorTabs from "./InspectorTabs"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import { Badge, CollapsibleSection, Metrics } from "./ui/Primitives"
import { IssueList } from "./ui/ValidationBadge"

// Visão do WORKSPACE: os repositórios abertos, o ativo, os totais agregados e os
// problemas globais. Só mostra o que o domínio fornece (o git-status.lib expõe
// branch e arquivos sujos; origem remota não é exposta e por isso não aparece).

type Props = {
    model      : WorkspaceModel
    onOpenRepository : (name:string) => void
    gitModel?  : GitModel
    onOpenPackage? : (path:string) => void
}

const WorkspaceMetadataView = ({ model, onOpenRepository, gitModel, onOpenPackage }:Props) => {

    const [tab, setTab] = React.useState("overview")

    return <div className="pdx-inspector">
        <div className="pdx-inspector__head">
            <div className="pdx-ident">
                <Icon name="folder open outline" size="large" className="pdx-ident__icon" style={{color:"var(--mp-muted)"}} />
                <div className="pdx-ident__main">
                    <div className="pdx-ident__name">Workspace</div>
                    <div className="pdx-ident__badges">
                        <Badge tone="type">{model.counts.repositories} repositório(s)</Badge>
                        { model.activeRepository && <Badge icon="dot circle outline">{model.activeRepository}</Badge> }
                        { gitModel && gitModel.total > 0 &&
                            <Badge tone="warning" icon="code branch">{gitModel.total} sem commitar</Badge> }
                    </div>
                </div>
            </div>
        </div>

        <InspectorTabs active={tab} onSelect={setTab} tabs={[
            { id: "overview", label: "Visão geral", icon: "info circle" },
            { id: "git", label: "Git", icon: "code branch" }
        ]} />

        {
            tab === "git"
            ? <div className="pdx-inspector__body">
                { gitModel && <GitStatusView model={gitModel} onOpenPackage={onOpenPackage} /> }
              </div>
            :
        <div className="pdx-inspector__body">
            <Metrics items={[
                { value: model.counts.repositories, label: "repositórios" },
                { value: model.counts.packages, label: "pacotes" },
                { value: model.counts.modules,  label: "módulos" },
                { value: model.counts.layers,   label: "layers" }
            ]} />

            <CollapsibleSection id="ws-repos" title="Repositórios abertos" icon="database"
                count={model.repositories.length}>
                <div className="pdx-tablewrap">
                    <table className="pdx-table">
                        <thead><tr><th>repositório</th><th>branch</th><th>pacotes</th><th>caminho</th></tr></thead>
                        <tbody>
                            {
                                model.repositories.map((repo) =>
                                    <tr key={repo.name} aria-selected={repo.active}
                                        onClick={() => onOpenRepository(repo.name)}>
                                        <td>
                                            <strong>{repo.name}</strong>
                                            { repo.active && <Badge tone="ok">ativo</Badge> }
                                            { !!repo.dirty && <Badge tone="warning">{repo.dirty}</Badge> }
                                        </td>
                                        <td className="pdx-mono">{repo.branch || ""}</td>
                                        <td className="pdx-mono">{repo.packages != null ? repo.packages : ""}</td>
                                        <td className="pdx-mono">{repo.path ? <CopyableCodeValue value={repo.path} type="path" /> : ""}</td>
                                    </tr>)
                            }
                        </tbody>
                    </table>
                </div>
            </CollapsibleSection>

            {
                model.issues.length > 0 &&
                <CollapsibleSection id="ws-issues" title="Problemas de metadado" icon="warning sign"
                    count={model.issues.length}>
                    <IssueList issues={model.issues} />
                </CollapsibleSection>
            }
        </div>
        }
    </div>
}

export default WorkspaceMetadataView
