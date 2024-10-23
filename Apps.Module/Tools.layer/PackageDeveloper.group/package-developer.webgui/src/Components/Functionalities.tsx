import React from "react"
import {
    Button, 
    Segment
} from "semantic-ui-react"

import styled from "styled-components"

const ButtonMTStyled = styled(Button)`
    margin-top:5px!important;
`

const Functionalities = ({
    hasNodeModulesDir
}:any) => 
    <>
        {/*<h4>Functionalities</h4>*/}
        {
            !hasNodeModulesDir 
            && <Button
                color         = "orange"
                content       = "install dependencies" 
                icon          = "boxes" 
                size          = "mini"
                labelPosition = "left" />
        }
        <Button 
            disabled      = {!hasNodeModulesDir}
            color         = "blue"
            content       = "Run" 
            icon          = "play" 
            size          = "mini"
            labelPosition = "left" />
        <Button 
            disabled      = {!hasNodeModulesDir}
            color         = "teal"
            content       = "Run" 
            icon          = "bug" 
            size          = "mini"
            labelPosition = "left" />
        <Button 
            color         = "violet"
            content       = "open in vscode" 
            icon          = "code" 
            size          = "mini"
            labelPosition = "left" />
        <ButtonMTStyled 
            color         = "purple"
            content       = "to explorer" 
            icon          = "folder open" 
            size          = "mini"
            labelPosition = "left" />
    </>


export default Functionalities