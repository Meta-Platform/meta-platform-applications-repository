const BootService     = require("../../../Services/Boot.service")
const ManagersService = require("../../../Services/Managers.service")
const ServicesService = require("../../../Services/Services.service")

module.exports = [
    {
        "name":"Boot",
        "requirements":["NodeModulesDir", "BootFile"],
        "service" : BootService
    },
    {
        "name":"Managers" ,
        "requirements":["ManagersDir"],
        "service": ManagersService
    },
    {
        "name":"Services" ,
        "requirements":["ServiceDir"],
        "service": ServicesService
    }
]