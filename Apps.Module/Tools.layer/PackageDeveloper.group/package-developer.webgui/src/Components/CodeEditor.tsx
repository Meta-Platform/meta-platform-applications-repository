import * as React from "react"
import styled from "styled-components"
import {useEffect, useRef} from "react"

const EditorStyle = styled.div`
    height:400px;
`

type CodeEditor = {
    value:string,
    language:string
}

const CodeEditor = ({value, language}:CodeEditor) => {

    const $editor = useRef(null)

    useEffect(()=>{

       //import(/* webpackChunkName: "map" */ "monaco-editor")
       //.then(({editor}:any) => {
       //     editor.create($editor.current, {
       //         value,
       //         language
       //     })
      // })

        /*monaco.editor.create($editor.current, {
            value,
            language
        })*/
    }, [$editor])

    return <EditorStyle ref={$editor} />
}

export default CodeEditor