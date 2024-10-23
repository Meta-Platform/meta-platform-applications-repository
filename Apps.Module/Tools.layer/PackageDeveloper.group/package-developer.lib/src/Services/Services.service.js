

const { promisify } = require("util")
const fs            = require("fs")
const path = require("path")

const readdir   = promisify(fs.readdir)

class ServicesService {

    listServiceName = []

    constructor({path:projecPath}){
        
        readdir(path.resolve(projecPath, "src", "Services"))
        .then(list => this.listServiceName = list.map(filename => {
            const [name, type, ext] = filename.split(".")
            return name
        }))

    } 

}


module.exports = ServicesService