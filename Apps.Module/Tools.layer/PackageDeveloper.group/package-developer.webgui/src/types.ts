type LogType = {
    timestamp:number,
    data:any
}

type DefaultVerification = {
    hasPackageJson    : Boolean
    hasNodeModulesDir : Boolean
    hasBootFile       : Boolean
}

type PackageVerifications = DefaultVerification & {
    hasUIDir      : Boolean
    hasWebDir     : Boolean
    hasLibDir     : Boolean
    hasAppDataDir : Boolean
}

type UIVerifications = DefaultVerification & {
    hasRoutesConfigFile : true
}

type WebVerifications = DefaultVerification & {
    hasAPIs : true
    hasControllers : true
}

type LibVerifications = DefaultVerification & {
    hasManagers : true
    hasServices : true
}

type PackageDetails = {
    workspace     : string
    name          : string
    path          : string
    log           : Array<LogType>
    verifications : PackageVerifications
}

type UIDetails = {
    log           : Array<LogType>
    verifications : UIVerifications
}

type WebDetails = {
    log           : Array<LogType>
    verifications : WebVerifications
}

type LibDetails = {
    log           : Array<LogType>
    verifications : LibVerifications
}

type UIRoute = {
    path:string
    page:string
}
