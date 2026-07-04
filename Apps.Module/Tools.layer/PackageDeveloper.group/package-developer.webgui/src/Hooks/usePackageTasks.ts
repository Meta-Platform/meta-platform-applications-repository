import { useEffect, useState, useRef } from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

const usePackageTasks = ({
    HTTPServerManager,
    workspace,
    packageSelected
}:any) => {

    const [logs, setLogs]     = useState<any[]>([])
    const [status, setStatus] = useState<string>("STOPPED")
    const [busy, setBusy]     = useState<string>("")

    const svc = GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "PackageTasks")

    const id = `${workspace}/${packageSelected.name}.${packageSelected.ext}`
    const body = () => ({ workspace, packageName: packageSelected.name, type: packageSelected.ext })

    const refreshLogs = () =>
        svc.GetLogs(body()).then(({data}:any) => setLogs((data && data.logs) || []))

    const refreshStatus = () =>
        svc.ListRunning().then(({data}:any) => {
            const found = (data || []).find((r:any) => r.id === id)
            setStatus(found ? found.status : "STOPPED")
        })

    const savedRefresh = useRef<Function>()
    savedRefresh.current = () => { refreshLogs(); refreshStatus() }

    useEffect(() => {
        savedRefresh.current && savedRefresh.current()
        const timer = setInterval(() => savedRefresh.current && savedRefresh.current(), 1500)
        return () => clearInterval(timer)
    }, [id])

    const run = (action:string, fn:Function) => {
        setBusy(action)
        return Promise.resolve(fn())
            .then(() => { refreshLogs(); refreshStatus() })
            .finally(() => setBusy(""))
    }

    const install = () => run("install", () => svc.InstallDependencies(body()))
    const start   = () => run("start",   () => svc.Start(body()))
    const debug   = () => run("debug",   () => svc.Debug(body()))
    const stop    = () => run("stop",    () => svc.Stop(body()))

    return { logs, status, busy, install, start, debug, stop }
}

export default usePackageTasks
