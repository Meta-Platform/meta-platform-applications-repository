
const { promisify } = require("util") as typeof import("util")
const fs            = require("fs") as typeof import("fs")

const path = require("path") as typeof import("path")

const readdir  = promisify(fs.readdir)

class APIsService {

    listAPIName = []

    constructor({path:projecPath}: any){

        readdir(path.resolve(projecPath, "src", "APIs"))
        .then((list: any) => this.listAPIName = list.map((filename: any) => {
            const [name, type, ext] = filename.split(".")
            return name
        }))
    } 

}


module.exports = APIsService