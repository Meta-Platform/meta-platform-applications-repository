const LibraryService  = require("../../Library.service")
const WebguiService   = require("../../Webgui.service")
const WebserviceService  = require("../../Webservice.service")
const WebappService  = require("../../Webapp.service")

module.exports = [
    {
        "name":"WebappPackage" ,
        "requirements":["WebappExt"],
        "service": WebappService
    },
    {
        "name":"LibraryPackage" ,
        "requirements":["LibraryExt"],
        "service": LibraryService
    },
    {
        "name":"WebguiPackage" ,
        "requirements":["WebguiExt"],
        "service": WebguiService
    },
    {
        "name":"WebservicePackage" ,
        "requirements":["WebserviceExt"],
        "service": WebserviceService
    }
]