const GetAssessedRequirements = require("../../Package.Functions/GetAssessedRequirements.function")
const LoadAllFileJson         = require("../../Package.Functions/LoadAllFileJson.function")
const LoadAllServices         = require("../../Package.Functions/LoadAllServices.function")

const REQUIREMENTS = require("./Configs/requirements.config")
const JSON_FILES_CONFIGS = require("./Configs/jsonFilesConfigs.config.json")
const SERVICE_CONFIG = require("./Configs/service.config")

class LibService {

    requirementsEvaluated = {}
    jsonFiles             = {}
    services              = {}
    requirements          = REQUIREMENTS
    jsonFilesConfigs      = JSON_FILES_CONFIGS
    serviceConfigs        = SERVICE_CONFIG
    
    constructor({path}){
        this.path = path

        GetAssessedRequirements({params:{path:this.path}, requirements:this.requirements})
        .then(requirementsEvaluated => {
            
            this.requirementsEvaluated = requirementsEvaluated

            const {path, serviceConfigs, jsonFilesConfigs} = this

            this.jsonFiles = LoadAllFileJson({
                path, 
                requirementsEvaluated,
                jsonFilesConfigs
            })

            this.services = LoadAllServices({
                path,
                requirementsEvaluated,
                serviceConfigs
            })
        })
    }

    GetDetails = () =>{
        const {
            requirementsEvaluated:{
                PackageJson,
                NodeModulesDir,
                BootFile,
                ManagersDir,
                ServiceDir
            },
            jsonFiles
        } = this
        
        return { 
            log:[],
            verifications:{
                hasManagers:ManagersDir,
                hasServices:ServiceDir,
                hasNodeModulesDir:NodeModulesDir,
                hasBootFile:BootFile,
                hasPackageJson:PackageJson
            },
            ...jsonFiles.PackageJson ? {packageJson:{scripts:jsonFiles.PackageJson.scripts}}:{}
        }
    }  

    GetBoot = () => {
        if (this.services.Boot){
            const listServiceName = Object.keys(this.services.Boot.config)
            return listServiceName.map(serviceName => ({
                serviceName:serviceName, 
                params:listServiceName[serviceName]
            }))
        }else {
            return []
        }
    }

    GetServices = () => this.services.Services
        && this.services.Services.listServiceName || []

    GetManagers = () => this.services.Managers 
        && this.services.Managers.listManagerName || []
}

module.exports = LibService
