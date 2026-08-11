import React from "react"
import { Button } from "@i-components"

const Functionalities = ({
    hasNodeModulesDir
}:any) =>
    <>
        {/*<h4>Functionalities</h4>*/}
        {
            !hasNodeModulesDir
            && <Button
                variant = "primary"
                icon    = "boxes"
                size    = "sm">install dependencies</Button>
        }
        <Button
            disabled = {!hasNodeModulesDir}
            variant  = "default"
            icon     = "play"
            size     = "sm">Run</Button>
        <Button
            disabled = {!hasNodeModulesDir}
            variant  = "default"
            icon     = "bug"
            size     = "sm">Run</Button>
        <Button
            variant = "default"
            icon    = "code"
            size    = "sm">open in vscode</Button>
        <Button
            variant = "default"
            icon    = "folder open"
            size    = "sm"
            style   = {{marginTop:5}}>to explorer</Button>
    </>


export default Functionalities
