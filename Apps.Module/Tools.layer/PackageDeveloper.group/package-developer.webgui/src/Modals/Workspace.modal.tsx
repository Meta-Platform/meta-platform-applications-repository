import * as React from "react"
import {useState, useEffect} from "react"

import { Button, Modal, Form } from "semantic-ui-react"


type ModalProps = {
    open     : boolean
    onClose  : Function
}

const WorkspaceModal = ({open, onClose}:ModalProps) =>{

    return <Modal 
                open={open} 
                closeIcon 
                size="tiny"
                onClose={() => onClose()}>
                <Modal.Header>Add Workspace</Modal.Header>
                <Modal.Content>
                    <Form>
                        <Form.Field>
                            <label>name</label>
                            <input placeholder="name" />
                        </Form.Field>
                        <Form.Field>
                            <label>path</label>
                            <input placeholder="path" />
                        </Form.Field>
                    </Form> 
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => {}}>
                        Reset
                    </Button>
                    <Button
                        content="Add"
                        labelPosition="right"
                        icon="plus"
                        onClick={() => {}}
                        positive/>
                </Modal.Actions>
            </Modal>
}
    
  

  export default WorkspaceModal