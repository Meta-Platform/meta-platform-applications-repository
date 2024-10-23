const BootService         = require("../../../Services/Boot.service")
const APIsService         = require("../../../Services/APIs.service")
const ControllersService  = require("../../../Services/Controllers.service")
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
        "name":"APIs" ,
        "requirements":["ApisDir"],
        "service": APIsService
    },
    {
        "name":"Controller" ,
        "requirements":["ControllersDir"],
        "service": ControllersService
    }
]