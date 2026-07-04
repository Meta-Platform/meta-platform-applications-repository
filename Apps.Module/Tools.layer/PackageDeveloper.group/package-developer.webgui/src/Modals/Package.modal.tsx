import * as React from "react"
import {useState} from "react"

import { Button, Modal, Form, Dropdown } from "semantic-ui-react"

const EXT_OPTIONS = [
    { key: "lib", text: "lib", value: "lib" }
]

type ModalProps = {
    open     : boolean
    onClose  : Function
    onCreatePackage : Function
}

const PackageModal = ({open, onClose, onCreatePackage}:ModalProps) =>{

    const [packageName, setPackageName] = useState("")
    const [ext, setExt] = useState("lib")

    const reset = () => {
        setPackageName("")
        setExt("lib")
    }

    const handleAdd = () => {
        if(packageName.trim() === "") return
        onCreatePackage({packageName, ext})
        reset()
        onClose()
    }

    return <Modal
                open={open}
                closeIcon
                size="tiny"
                onClose={() => onClose()}>
                <Modal.Header>Create Package</Modal.Header>
                <Modal.Content>
                    <Form>
                        <Form.Field>
                            <label>name</label>
                            <input
                                placeholder="name"
                                value={packageName}
                                onChange={(e) => setPackageName(e.target.value)} />
                        </Form.Field>
                        <Form.Field>
                            <label>type</label>
                            <Dropdown
                                selection
                                options={EXT_OPTIONS}
                                value={ext}
                                onChange={(_, {value}:any) => setExt(value)} />
                        </Form.Field>
                    </Form>
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => reset()}>
                        Reset
                    </Button>
                    <Button
                        content="Create"
                        labelPosition="right"
                        icon="plus"
                        onClick={() => handleAdd()}
                        positive/>
                </Modal.Actions>
            </Modal>
}

export default PackageModal
