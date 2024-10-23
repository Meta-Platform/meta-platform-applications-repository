

const { promisify } = require("util")
const fs            = require("fs")
const path = require("path")

const readdir   = promisify(fs.readdir)

class ControllersService {

    listWebName = []

    constructor({path:projecPath}){
        readdir(path.resolve(projecPath, "src", "Controllers"))
        .then(list => this.listWebName = list.map(filename => {
            const [name, type, ext] = filename.split(".")
            return name
        }))
    } 
}


module.exports = ControllersService