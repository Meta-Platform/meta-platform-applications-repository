
import * as React from "react"

import { 
	Card,
	Button
} from "semantic-ui-react"


type PackageCommand = {
    keystone: String
    label: String
}

const COMMANDS: PackageCommand[] = [
    { keystone: "install-dependencies", label: "install dependencies" },
    { keystone: "build", label: "build" },
    { keystone: "rebuild", label: "rebuild" },
    { keystone: "start", label: "start" },
    { keystone: "restart", label: "restart" },
    { keystone: "stop", label: "stop" },
    { keystone: "clean", label: "clean" }
]


const COMMANDS_BY_TYPE = [
    {
        type : "webapp",
        keystoneCommands: ["restart", "stop", "clean"]
    },
    {
        type : "webservice",
        keystoneCommands:["restart", "stop", "clean"]
    },
    {
        type : "webgui",
        keystoneCommands:["rebuild", "clean"]
    },
    {
        type : "lib",
        keystoneCommands:["install-dependencies"]
    }
]

const RenderCommandButtonByType = (type:String) => {    
    const commandType = COMMANDS_BY_TYPE.find((commandType) => commandType.type === type)
    if(commandType){
        const { keystoneCommands } = commandType
        return keystoneCommands.map((keystone, index) => {
            const command = COMMANDS.find((command) => command.keystone === keystone)
            return <Button key={index} style={{"marginTop":"5px"}}>{command.label}</Button>
        })
    } else {
        return <></>
    }
}

const Control = ({
    type
}:any) => <Card.Content>
                <Card.Header>
                    control
                </Card.Header>
                {
                    RenderCommandButtonByType(type)
                }
            </Card.Content>
	
export default Control