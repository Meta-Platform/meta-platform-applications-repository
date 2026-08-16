

const path = require("path") as typeof import("path")

class RoutesService {

    routes: any

    constructor({path:projecPath}: any){
        this.routes = require(path.resolve(projecPath, "src", "routes.config.json"))
    } 


    GetRoutes = () => this.routes

}


module.exports = RoutesService