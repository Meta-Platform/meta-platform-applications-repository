const {resolve} = require("path") as typeof import("path")

const GetAssessedRequirements = require("../../Package.Functions/GetAssessedRequirements.function")
const LoadAllFileJson         = require("../../Package.Functions/LoadAllFileJson.function")
const LoadAllServices         = require("../../Package.Functions/LoadAllServices.function")

const REQUIREMENTS = require("./Configs/requirements.config")
const JSON_FILES_CONFIGS = require("./Configs/jsonFilesConfigs.config.json")
const SERVICE_CONFIG = require("./Configs/service.config")


class WebappService {
    
    requirementsEvaluated : Record<string, any> = {}
    jsonFiles             : Record<string, any> = {}
    services              : Record<string, any> = {}
    requirements          = REQUIREMENTS
    jsonFilesConfigs      = JSON_FILES_CONFIGS
    serviceConfigs        = SERVICE_CONFIG
    path                  : string

    constructor({path}: any){
        
        this.path = path

        GetAssessedRequirements({params:{path:this.path}, requirements:this.requirements})
        .then((requirementsEvaluated: any) => {
            
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
                ApisDir,
                ControllersDir
            },
            jsonFiles
        } = this

        return { 
            log:[],
            verifications:{
                hasAPIs:ApisDir,
                hasControllers:ControllersDir,
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
                // DEFEITO PRÉ-EXISTENTE: indexa o ARRAY de nomes por nome, então
                // `params` sempre sai undefined. O certo seria
                // `this.services.Boot.config[serviceName]`. Mantido como está —
                // a conversão não altera comportamento.
                params:(listServiceName as any)[serviceName]
            }))
        }else {
            return []
        }
    }

    GetAPIs = () => this.services.APIs 
        && this.services.APIs.listAPIName || []

    GetControllers = () => this.services.Controller 
        && this.services.Controller.listWebName || []
}

module.exports = WebappService