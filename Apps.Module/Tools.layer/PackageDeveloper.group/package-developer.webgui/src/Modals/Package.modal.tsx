import * as React from "react"
import {useState} from "react"

import { Button, Dialog, FormField, SelectInput, TextInput } from "@i-components"

const EXT_OPTIONS = [
    { value: "lib", label: "lib" }
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

    return <Dialog
                open={open}
                size="sm"
                title="Create Package"
                onClose={() => onClose()}
                actions={<>
                    <Button onClick={() => reset()}>
                        Reset
                    </Button>
                    <Button
                        variant="primary"
                        icon="plus"
                        onClick={() => handleAdd()}>
                        Create
                    </Button>
                </>}>
                <FormField label="name" htmlFor="pdx-package-name">
                    <TextInput
                        id="pdx-package-name"
                        placeholder="name"
                        value={packageName}
                        onChange={(e:any) => setPackageName(e.target.value)} />
                </FormField>
                <FormField label="type" htmlFor="pdx-package-ext">
                    <SelectInput
                        id="pdx-package-ext"
                        options={EXT_OPTIONS}
                        value={ext}
                        onChange={(e:any) => setExt(e.target.value)} />
                </FormField>
            </Dialog>
}

export default PackageModal
