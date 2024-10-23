
const { promisify } = require("util")
const fs            = require("fs")

const path = require("path")

const readdir  = promisify(fs.readdir)

class APIsService {

    listAPIName = []

    constructor({path:projecPath}){

        readdir(path.resolve(projecPath, "src", "APIs"))
        .then(list => this.listAPIName = list.map(filename => {
            const [name, type, ext] = filename.split(".")
            return name
        }))
    } 

}


module.exports = APIsService