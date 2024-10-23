import React from "react"

import {Segment, Form} from "semantic-ui-react"

type RoutesEditorProps = {
    routes:Array<UIRoute>
}

const RoutesEditor = ({
    routes
}:RoutesEditorProps) => {
    
    return <Segment>
                <h4>Routes Editor</h4>
                <Form>
                    {
                        routes
                        && routes.map(({page, path}, key) => 
                        <Form.Group key={key}>
                            <Form.Input width={6} value={page}/>
                            <Form.Input width={8} value={path}/>
                        </Form.Group>)
                    }
                </Form>
            </Segment>
}

export default RoutesEditor