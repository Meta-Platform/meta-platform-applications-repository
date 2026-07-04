import * as React from "react"
import { connect } from "react-redux"
import { Button, Label } from "semantic-ui-react"

import usePackageTasks from "../Hooks/usePackageTasks"
import PackageConsole from "./PackageConsole"

const STATUS_COLOR:any = { RUNNING: "green", STOPPED: "grey", ERROR: "red", STOPPING: "yellow" }

const RunPackage = ({ HTTPServerManager, packageSelected, workspace }:any) => {

    const { status, busy, install, start, debug, stop } =
        usePackageTasks({ HTTPServerManager, workspace, packageSelected })

    const isRunning = status === "RUNNING"

    return <>
        <Button.Group size="mini">
            <Button color="orange" icon="boxes" content="Install deps"
                loading={busy === "install"} disabled={!!busy} onClick={() => install()} />
            <Button color="blue" icon="play" content="Run"
                loading={busy === "start"} disabled={!!busy || isRunning} onClick={() => start()} />
            <Button color="teal" icon="bug" content="Debug"
                loading={busy === "debug"} disabled={!!busy || isRunning} onClick={() => debug()} />
            <Button color="red" icon="stop" content="Stop"
                loading={busy === "stop"} disabled={!!busy || !isRunning} onClick={() => stop()} />
        </Button.Group>
        {" "}
        <Label color={STATUS_COLOR[status] || "grey"}>{status}</Label>

        <div style={{marginTop:10}}>
            <PackageConsole workspace={workspace} packageSelected={packageSelected} />
        </div>
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(RunPackage)
