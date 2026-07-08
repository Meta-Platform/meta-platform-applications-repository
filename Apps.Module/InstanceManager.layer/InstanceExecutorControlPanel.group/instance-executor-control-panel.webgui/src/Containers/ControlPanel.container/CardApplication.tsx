import * as React from "react"

import { Icon, Label, Button, Loader } from "semantic-ui-react"

import ObjectCard from "../../Components/ui/ObjectCard"
import ExtractURL from "../../Utils/ExtractURL"

// Card de processo/pacote em serviço — design system Retro-Brutalist (ObjectCard).
// Ações: abrir aplicação, ENCERRAR (delega StopPackage ao daemon) e ver detalhes.
const STATUS_ACCENT = {
    ACTIVE: "var(--mp-success, #2e7d32)",
    AWAITING_PRECONDITIONS: "var(--mp-warning, #b26a00)",
    FAILURE: "var(--mp-danger, #b3261e)"
}
const STATUS_COLOR = {
    ACTIVE: "green",
    AWAITING_PRECONDITIONS: "orange",
    FAILURE: "red"
}

const CardApplication = ({
    packageInformation,
    serverManagerInformation,
    onShowDetailsColumn,
    onStopPackage
}) => {

    const { applicationInServiceState, repositoryParams, packageInService, hasIcon } = packageInformation
    const status = applicationInServiceState?.status
    const port = applicationInServiceState?.staticParameters?.startupParams?.port

    const iconNode = hasIcon
        ? <img
            src={ExtractURL({
                serversStatus: serverManagerInformation.list_web_servers_running,
                apiName: "RepositoryManager",
                serverName: process.env.SERVER_APP_NAME,
                summary: "GetPackageIcon",
                args: repositoryParams
            })}
            style={{ width: 22, height: 22, objectFit: "contain" }} />
        : <Icon name="cube" style={{ margin: 0 }} />

    const statusBadge = status
        ? <Label color={STATUS_COLOR[status] || "grey"} size="mini">{status}</Label>
        : null

    const action = <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        { status === "AWAITING_PRECONDITIONS" && <Loader size="mini" active inline /> }
        <Button
            size="mini" compact basic
            disabled={status !== "ACTIVE" || !port}
            onClick={() => window.open(`http://localhost:${port}`, "_blank")}>
            Abrir
        </Button>
        { packageInService && onStopPackage &&
            <Button
                size="mini" compact color="red" basic icon="stop"
                title="Encerrar processo"
                onClick={() => onStopPackage(repositoryParams)} /> }
        <Button
            size="mini" compact basic icon="info"
            title="Detalhes"
            onClick={() => onShowDetailsColumn(packageInformation)} />
    </div>

    return <div style={{ width: 300 }}>
        <ObjectCard
            iconNode={iconNode}
            title={repositoryParams.packageName}
            meta={`${repositoryParams.namespaceRepo}.${repositoryParams.moduleName}.${repositoryParams.layerName}`}
            status={statusBadge}
            chips={<Label size="mini">{repositoryParams.ext.toUpperCase()}</Label>}
            action={action}
            accent={STATUS_ACCENT[status]} />
    </div>
}

export default CardApplication
