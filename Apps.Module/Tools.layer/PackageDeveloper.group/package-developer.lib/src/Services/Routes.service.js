

const path = require("path")

class RoutesService {

    constructor({path:projecPath}){
        this.routes = require(path.resolve(projecPath, "src", "routes.config.json"))
    } 


    GetRoutes = () => this.routes

}


module.exports = RoutesService