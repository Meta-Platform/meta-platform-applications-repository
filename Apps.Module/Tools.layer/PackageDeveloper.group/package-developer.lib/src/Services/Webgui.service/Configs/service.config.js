const BootService   = require("../../../Services/Boot.service")
const RoutesService = require("../../../Services/Routes.service")
const GitService  = require("../../Git.service")
module.exports = [
    {
        "name":"Git" ,
        "requirements":["GitDir"],
        "service": GitService
    },
    {
        "name":"Boot",
        "requirements":["NodeModulesDir", "BootFile"],
        "service" : BootService
    },
    {
        "name":"Routes" ,
        "requirements":["RoutesConfigJsonFile"],
        "service": RoutesService
    }
]