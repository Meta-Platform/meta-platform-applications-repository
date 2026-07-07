// Harness de integração do webservice: replica FIELMENTE o mapeamento HTTP->método
// do server-manager (CreateAPIEndpointsService): getAllParams = {...path,...body,...query};
// 0 params => método(undefined); 1 presente E 1 declarado => valor posicional; senão => objeto.
const express = require("express")
const http = require("http")
const path = require("path")

const WS_ROOT = path.resolve(__dirname, "..")
const LIB_SRC = path.resolve(WS_ROOT, "../project-store.lib/src")

const CONTROLLERS = ["Health", "Projects", "Boards", "Items", "Comments", "Attachments", "Users", "Agents", "Reports", "Events"]

const getAllParams = ({ body, params, query }) => ({ ...params, ...body, ...query })

const MakeServer = ({ startupParams }) => {
    const controllerParams = {
        projectStoreLib: { require: (m) => require(path.join(LIB_SRC, m)) },
        dbFilePath: startupParams.MPM_DB_FILE_PATH,
        attachmentsDirPath: startupParams.MPM_ATTACHMENTS_DIR_PATH,
        maxAttachmentBytes: startupParams.MPM_MAX_ATTACHMENT_BYTES
    }

    const app = express()
    app.use(express.json())

    for(const name of CONTROLLERS){
        const factory = require(path.join(WS_ROOT, "src", "Controllers", `${name}.controller`))
        const api = require(path.join(WS_ROOT, "src", "APIs", `${name}.api.json`))
        const service = factory(controllerParams)
        for(const ep of api.endpoints){
            if(ep.method === "ws") continue // WS testado à parte
            const expressPath = ep.path.replace(/:([A-Za-z0-9_]+)/g, ":$1")
            app[ep.method.toLowerCase()](expressPath, async (req, res, next) => {
                try {
                    const params = getAllParams(req)
                    let result
                    if(!ep.parameters) result = await service[ep.summary]()
                    else if(Object.keys(params).length === 1 && ep.parameters.length === 1) result = await service[ep.summary](params[Object.keys(params)[0]])
                    else result = await service[ep.summary](params)
                    if(ep.typeResponse === "file") return res.sendFile(result)
                    res.send(result)
                } catch(e){ next(e) }
            })
        }
    }

    const server = http.createServer(app)
    const listen = () => new Promise((r) => server.listen(0, () => r(server.address().port)))
    const close = () => new Promise((r) => server.close(r))

    const request = (method, urlPath, body) => new Promise((resolve, reject) => {
        const port = server.address().port
        const data = body ? JSON.stringify(body) : undefined
        const req = http.request({ host: "127.0.0.1", port, path: urlPath, method, headers: { "Content-Type": "application/json" } }, (res) => {
            let buf = ""
            res.on("data", (c) => buf += c)
            res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(buf) }) } catch(e){ resolve({ status: res.statusCode, text: buf }) } })
        })
        req.on("error", reject)
        if(data) req.write(data)
        req.end()
    })

    return { listen, close, request }
}

module.exports = MakeServer
