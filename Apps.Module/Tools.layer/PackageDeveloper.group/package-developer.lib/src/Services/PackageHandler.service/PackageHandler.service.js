const GetAssessedRequirements = require("../../Package.Functions/GetAssessedRequirements.function")
const LoadAllFileJson         = require("../../Package.Functions/LoadAllFileJson.function")
const LoadAllServices         = require("../../Package.Functions/LoadAllServices.function")

const REQUIREMENTS = require("./Configs/requirements.config")
const JSON_FILES_CONFIGS = require("./Configs/jsonFilesConfigs.config.json")
const SERVICE_CONFIG = require("./Configs/service.config")

/**
 * Status
 * STARTING
 * READY
 * DEPENDENCIES_NOT_INSTALLED
 * INSTALLING_DEPENDENCIES
 * RUNNING
 * RUNNING_SCRIPT
 * INSTALL_DEPENDENCIES_ERROR
 * BUILDING_UI
 * RUNNING_ERROR
 * RUNNING_SCRIPT_ERROR
 * CLEANING_DEPENDENCIES
 * CLEANING_DEPENDENCIES_ERROR
 */

class PackageDevelopmentService {

    requirementsEvaluated = {}
    jsonFiles             = {}
    services              = {}
    requirements          = REQUIREMENTS
    jsonFilesConfigs      = JSON_FILES_CONFIGS
    serviceConfigs        = SERVICE_CONFIG
    
    constructor({
        workspaceName, 
        packageName, 
        path
    }){

        //this.serviceRootList = serviceRootList

        const [ name, ext ] = packageName.split(".")

        this.name          = name
        this.path          = path
        this.workspaceName = workspaceName
        this.ext           = ext
        
        GetAssessedRequirements({params:{path, packageName}, requirements:this.requirements})
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
    
   /* rootService = (name) => this.serviceRootList
        .find(({constructor}) => constructor.name === name)*/

    /*InstallDependencies = () => {
        this.status = "INSTALLING_DEPENDENCIES"
        
        const processService = this.rootService("ProcessManager")
        .Run({cwd:this.path , cmd:"yarn", args:["install"]})

        this.listPID.push(processService.GetPID())
        
        processService
        .onClose()
        .then(code => {
            if(code === 0){
                this.status = "READY"
            }else{
                this.status = "INSTALL_DEPENDENCIES_ERROR"
            }
            this.RemovePID(processService.GetPID())
            
        })
    }

    Develop = () => {
        this.status = "RUNNING_DEVELOPER_SERVER"

        const processService = this.rootService("ProcessManager")
        .Run({cwd:this.path , cmd:"node_modules\\.bin\\webpack-dev-server.cmd ", args:[]})
        this.listPID.push(processService.GetPID())
        
        processService
        .onClose()
        .then(code => {
            if(code === 0){
                this.status = "READY"
            }else{
                this.status = "RUNNING_SCRIPT_ERROR"
            }
            this.RemovePID(processService.GetPID())
            
        })
    }

    BuildArtifact = () => {

        const {
            name,
            type,
            workspace
        } = this

        this.status = "BUILDING_UI"

        const processService = this.rootService("ProcessManager")
        .Run({
            cwd:this.path, cmd:"node_modules\\.bin\\webpack.cmd", args:[], env:{
                BUILD_DIST_DIR_NAME: name + "." + type,
                BUILD_PATH_OUTPUT: path.resolve(__dirname, PACKAGES_SERVICE_DIR, ".data", workspace),
                //BUILD_ENTRYPOINT: "./src/index.tsx",
                //BUILD_PATH_OUTPUT: "C:\\Meu_Espaço\\Workspace\\Workspace_Test\\my-platform\\myplatform\\Workspace-User\\StoreEditor.ui"
        }})

        this.listPID.push(processService.GetPID())
        
        processService
        .onClose()
        .then(code => {
            if(code === 0){
                this.status = "READY"
            }else{
                this.status = "BUILDING_UI_ERROR"
            }
            this.RemovePID(processService.GetPID())
            
        })
    }


    RemovePID = (pid) => {
        this.listPID = this.listPID.filter(_pid => _pid !== pid)
    }

    ClearDependencies = () => {
        this.status = "CLEANING_DEPENDENCIES"
        rmdir(this.path + "/" + "node_modules", {recursive:true})
        .then(() => {
            this.status = "DEPENDENCIES_NOT_INSTALLED"
        })
        .catch(error => {
            console.log(error)
            this.status = "CLEANING_DEPENDENCIES_ERROR"
        })
    }*/


   

}


module.exports = PackageDevelopmentService