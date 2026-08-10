import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { useEffect } from "react"

import { FormField, TextInput } from "@i-components"

import CompareValues from "../Utils/CompareValues"

// Form dos startup params de um pacote.
//
// O destaque do campo ALTERADO (o valor que difere do que o pacote declara) é
// a única variação visual daqui, e sai de uma classe local sobre tokens --mp-*
// (.lnc-input-modified) — antes era um `styled(Input)` do styled-components.
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

    return <form className="lnc-params-form" onChange={() => handleChangeForm()}>
        {
            Object.keys(schema.properties)
            .map((propertyName, key) =>
                <FormField label={propertyName} htmlFor={`lnc-param-${propertyName}`} key={key}>
                    <Controller
                        name={propertyName}
                        control={control}
                        render={({ field }) => {
                            const isDifferent = !CompareValues(params[propertyName], field.value)
                            return <TextInput
                                id={`lnc-param-${propertyName}`}
                                className={isDifferent ? "lnc-input-modified" : ""}
                                {...field}/>
                        }}/>
                </FormField>)
        }
    </form>
}

export default StartupParamsForm
