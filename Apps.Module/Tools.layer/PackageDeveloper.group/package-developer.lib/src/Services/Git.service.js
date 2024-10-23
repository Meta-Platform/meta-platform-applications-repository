
const simpleGit = require("simple-git")

class GitService {

    constructor({path}){
        this.git =  simpleGit(path, { binary: 'git' })
        
        this
        .git
        .status()
        .then(status => {
            status
            
        })
    } 


    

}


module.exports = GitService