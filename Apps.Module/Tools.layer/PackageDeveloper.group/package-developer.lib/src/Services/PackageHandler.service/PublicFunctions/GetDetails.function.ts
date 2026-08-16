// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const GetDetailsFunction = (packageDevelopmentService: any) =>{
    
    const {
        workspaceName, 
        name, 
        path, 
        log,
        requirementsEvaluated,
        jsonFiles,
        ext
    } = packageDevelopmentService

    return {
        workspace:workspaceName, 
        name, 
        ext,
        path, 
        log,
        verifications:requirementsEvaluated,
        ... jsonFiles.PackageJson ? {packageJson:{scripts:jsonFiles.PackageJson.scripts}}:{}
    }
}  

module.exports = GetDetailsFunction