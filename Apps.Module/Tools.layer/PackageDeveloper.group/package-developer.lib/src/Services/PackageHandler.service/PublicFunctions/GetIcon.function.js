
const { promisify } = require("util")
const fs = require("fs")
const path = require("path")
const access = promisify(fs.access)

GetIconFunction = (packagePath) => 
    new Promise(async (resolve, reject) => {
        try{
            await access(path.resolve(packagePath, "icon.svg"), fs.constants.F_OK)
            resolve(path.resolve(packagePath, "icon.svg"))
        }catch(e){
            try{
                await access(path.resolve(packagePath, "icon.png"), fs.constants.F_OK)
                resolve(path.resolve(packagePath, "icon.png"))
            }catch(ee){
                reject("icon not found!")
            }
        }
    })
        
module.exports = GetIconFunction