const { promisify } = require("util")
const fs = require("fs")
const readdir  = promisify(fs.readdir)

ListItemFunction = (developmentStore, path) => 
    new Promise(async (resolve, reject) => {
        try{
            const listItem = (await readdir(developmentStore.path + (path || "/")))
            .map((filename) => ({
                filename,
                isFile: fs.lstatSync(`${developmentStore.path + (path || "/")}/${filename}`).isFile()
            }))

            resolve({
                path: (path || "/"),
                listItem
            })

        }catch(e){
            reject(e)
        }
    })

module.exports = ListItemFunction