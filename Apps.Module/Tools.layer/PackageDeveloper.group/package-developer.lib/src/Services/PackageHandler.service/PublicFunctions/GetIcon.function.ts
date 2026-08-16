
const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const access = promisify(fs.access)

// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const GetIconFunction = (packagePath: any) => 
    new Promise(async (resolve, reject) => {
        try{
            await access(path.resolve(packagePath, "icon.svg"), fs.constants.F_OK)
            resolve(path.resolve(packagePath, "icon.svg"))
        }catch(e: any){
            try{
                await access(path.resolve(packagePath, "icon.png"), fs.constants.F_OK)
                resolve(path.resolve(packagePath, "icon.png"))
            }catch(ee: any){
                reject("icon not found!")
            }
        }
    })
        
module.exports = GetIconFunction