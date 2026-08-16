

const { promisify } = require("util") as typeof import("util")
const fs            = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")

const readdir   = promisify(fs.readdir)

class ControllersService {

    listWebName = []

    constructor({path:projecPath}: any){
        readdir(path.resolve(projecPath, "src", "Controllers"))
        .then((list: any) => this.listWebName = list.map((filename: any) => {
            const [name, type, ext] = filename.split(".")
            return name
        }))
    } 
}


module.exports = ControllersService