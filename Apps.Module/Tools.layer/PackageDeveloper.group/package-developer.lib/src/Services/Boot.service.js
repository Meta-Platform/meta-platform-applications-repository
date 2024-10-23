

const {resolve} = require("path")

class BootService {

    constructor({path}){
        this.config = require(resolve(path, "metadata", "boot.json"))
    } 

}


module.exports = BootService