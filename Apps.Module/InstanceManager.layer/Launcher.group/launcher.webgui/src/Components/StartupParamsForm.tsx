import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { useEffect } from "react"
import styled from "styled-components"
import {
    Segment,
    Form,
    Input
} from "semantic-ui-react"

const StyledInput = styled(Input)`
  &&& input {
    ${props => props.isModified ? 'border-color: orange !important;' : ''}
    ${props => props.isModified ? 'background-color: #fff6e7 !important;' : ''}
  }
`

import CompareValues from "../Utils/CompareValues"

const StartupParamsForm = ({
    schema, 
    params, 
    onChangeParams
}) => {

    const { 
        getValues, 
        reset, 
        control 
    } = useForm({ defaultValues: params })

    useEffect(() => {
        reset(params)
    }, [params, reset])
    
    const handleChangeForm = () => {
        onChangeParams(getValues())
    }

    return <Segment secondary>
                <div style={{ overflow: 'auto', maxHeight:"35vh" }}>
                    <Form style={{marginRight: "15px"}} onChange={() => handleChangeForm()}>
                        {
                            Object.keys(schema.properties)
                            .map((propertyName, key) => {

                                return <Form.Field style={{marginBottom:"7px"}} key={key}>
                                            <label style={{marginBottom:"0px"}}>{propertyName}</label>
                                            <Controller
                                                name={propertyName}
                                                control={control}
                                                render={({ field }) => {
                                                    const isDifferent = !CompareValues(params[propertyName], field.value)
                                                    return <StyledInput size="mini" isModified={isDifferent} {...field} />
                                                }}/>
                                        </Form.Field>
                            })
                        }
                    </Form>
                </div>
            </Segment>
}

export default StartupParamsForm