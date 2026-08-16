const crypto        = require("crypto") as typeof import("crypto")
const { promisify } = require("util") as typeof import("util")
const fs            = require("fs") as typeof import("fs")

const readdir  = promisify(fs.readdir)
const exists   = promisify(fs.exists)
const readFile = promisify(fs.readFile)

const FSService = (params: any) => {

    const { name, type, cwd } = params
    let status = "WAITING", keystone: string | undefined, message: string | undefined

    const _Init = () => {
        exists(cwd).then((isExist: any) => {
            if(isExist){
                status = "READY"
                keystone = crypto.createHash("md5").update(name+cwd).digest("hex")
            }else{
                status = "ERROR"
                message = "directory don't exist"
            }
        })
    }

    const _GetInfo = () => {
        return {
            keystone,
            type,
            name,
            cwd,
            status,
            message
        }
    }

    const _ListItem = (path: any) => new Promise(async (resolve, reject) => {
        try{
            const listItem = (await readdir(cwd + (path || "/")))
            .map((filename: any) => ({
                filename,
                isFile: fs.lstatSync(`${cwd + (path || "/")}/${filename}`).isFile()
            }))

            resolve({
                path: (path || "/"),
                listItem
            })

        }catch(e: any){
            reject(e)
        }
    })


    const _GetContentItem = (path: any) => readFile(cwd + path, "utf-8")

    _Init()

    return {
        GetInfo: _GetInfo,
        ListItem: _ListItem,
        GetContentItem: _GetContentItem,
        GetName: () => name,
        GetKeystone: () => keystone,
        GetType: () => type
    }
        
}

module.exports = FSService