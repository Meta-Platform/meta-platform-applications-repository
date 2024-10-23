

const { promisify } = require("util")
const fs            = require("fs")
const path = require("path")

const readdir   = promisify(fs.readdir)

class ManagersService {

    listManagerName = []

    constructor({path:projecPath}){
        
        readdir(path.resolve(projecPath, "src", "Managers"))
        .then(list => this.listManagerName = list.map(filename => {
            const [name, type, ext] = filename.split(".")
            return name
        }))

    } 

}


module.exports = ManagersService