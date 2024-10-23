import * as React from "react"
import {useState, useEffect} from "react"

import { Button, Modal, Form } from "semantic-ui-react"


type ModalProps = {
    open     : boolean
    onClose  : Function
    onRun  : Function
}

const PackagePathModal = ({open, onClose, onRun}:ModalProps) =>{

    const [packagePath, setPathPackage] = useState("/home/kaiocezar/Workspaces/my-platform-reference-distro/repos/MyPlatform/UtilityApplication.Module/MyPlatformTools.layer/PackageDeveloper.group/package-developer.webapp")

    return <Modal 
                open={open} 
                closeIcon 
                size="tiny"
                onClose={() => onClose()}>
                <Modal.Header>package path for running</Modal.Header>
                <Modal.Content>
                    <Form>
                        <Form.Field>
                            <label>absolut path</label>
                            <input 
                                placeholder="path" 
                                defaultValue={packagePath} 
                                onChange= {({target:{value}}) => setPathPackage(value)}/>
                        </Form.Field>
                    </Form> 
                </Modal.Content>
                <Modal.Actions>
                    <Button color='orange'
                        content="RUN"
                        disabled={!packagePath}
                        onClick={() => onRun(packagePath)}/>
                </Modal.Actions>
            </Modal>
}
    
  

  export default PackagePathModal