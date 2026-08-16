const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const readdir  = promisify(fs.readdir)

// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const ListItemFunction = (developmentStore: any, path: any) => 
    new Promise(async (resolve, reject) => {
        try{
            const listItem = (await readdir(developmentStore.path + (path || "/")))
            .map((filename: any) => ({
                filename,
                isFile: fs.lstatSync(`${developmentStore.path + (path || "/")}/${filename}`).isFile()
            }))

            resolve({
                path: (path || "/"),
                listItem
            })

        }catch(e: any){
            reject(e)
        }
    })

module.exports = ListItemFunction