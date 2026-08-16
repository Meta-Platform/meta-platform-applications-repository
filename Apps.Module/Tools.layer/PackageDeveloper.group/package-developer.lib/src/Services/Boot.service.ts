

const {resolve} = require("path") as typeof import("path")

class BootService {

    config: any

    constructor({path}: any){
        this.config = require(resolve(path, "metadata", "boot.json"))
    } 

}


module.exports = BootService