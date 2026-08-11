import * as React from "react"
import { connect } from "react-redux"
import { Button, ButtonGroup } from "@i-components"

import usePackageTasks from "../Hooks/usePackageTasks"
import PackageConsole from "./PackageConsole"

// Tom do selo de estado — mesmas cores do kit (.mp-status-badge--*).
const STATUS_TONE:any = { RUNNING: "success", STOPPED: "done", ERROR: "danger", STOPPING: "warning" }

const RunPackage = ({ HTTPServerManager, packageSelected, workspace, terminalHeight }:any) => {

    const { status, busy, install, start, debug, stop } =
        usePackageTasks({ HTTPServerManager, workspace, packageSelected })

    const isRunning = status === "RUNNING"

    return <>
        <ButtonGroup>
            <Button size="sm" variant="default" icon="boxes"
                loading={busy === "install"} disabled={!!busy} onClick={() => install()}>Install deps</Button>
            <Button size="sm" variant="primary" icon="play"
                loading={busy === "start"} disabled={!!busy || isRunning} onClick={() => start()}>Run</Button>
            <Button size="sm" variant="default" icon="bug"
                loading={busy === "debug"} disabled={!!busy || isRunning} onClick={() => debug()}>Debug</Button>
            <Button size="sm" variant="danger" icon="stop"
                loading={busy === "stop"} disabled={!!busy || !isRunning} onClick={() => stop()}>Stop</Button>
        </ButtonGroup>
        {" "}
        <span className={`mp-status-badge mp-status-badge--${STATUS_TONE[status] || "done"} mp-status-badge--sm`}>
            <span className="mp-status-badge__text">{status}</span>
        </span>

        <div style={{marginTop:10}}>
            <PackageConsole workspace={workspace} packageSelected={packageSelected} terminalHeight={terminalHeight} />
        </div>
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(RunPackage)
