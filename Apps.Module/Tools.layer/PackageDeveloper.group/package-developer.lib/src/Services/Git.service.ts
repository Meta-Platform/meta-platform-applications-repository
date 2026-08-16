
const simpleGit = require("simple-git")

class GitService {

    git: any

    constructor({path}: any){
        this.git =  simpleGit(path, { binary: 'git' })
        
        this
        .git
        .status()
        .then((status: any) => {
            status
            
        })
    } 


    

}


module.exports = GitService