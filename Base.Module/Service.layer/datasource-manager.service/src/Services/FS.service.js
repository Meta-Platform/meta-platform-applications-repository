const crypto        = require("crypto")
const { promisify } = require("util")
const fs            = require("fs")

const readdir  = promisify(fs.readdir)
const exists   = promisify(fs.exists)
const readFile = promisify(fs.readFile)

const FSService = (params) => {

    const { name, type, cwd } = params
    let status = "WAITING", keystone, message

    const _Init = () => {
        exists(cwd).then(isExist => {
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

    const _ListItem = (path) => new Promise(async (resolve, reject) => {
        try{
            const listItem = (await readdir(cwd + (path || "/")))
            .map((filename) => ({
                filename,
                isFile: fs.lstatSync(`${cwd + (path || "/")}/${filename}`).isFile()
            }))

            resolve({
                path: (path || "/"),
                listItem
            })

        }catch(e){
            reject(e)
        }
    })


    const _GetContentItem = (path) => readFile(cwd + path, "utf-8")

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