

const { promisify } = require("util") as typeof import("util")
const fs            = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")

const readdir   = promisify(fs.readdir)

class ManagersService {

    listManagerName = []

    constructor({path:projecPath}: any){
        
        readdir(path.resolve(projecPath, "src", "Managers"))
        .then((list: any) => this.listManagerName = list.map((filename: any) => {
            const [name, type, ext] = filename.split(".")
            return name
        }))

    } 

}


module.exports = ManagersService