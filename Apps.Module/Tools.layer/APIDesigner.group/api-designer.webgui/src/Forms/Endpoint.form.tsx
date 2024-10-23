import * as React from "react"

import { Checkbox, Form, Input, Select, Header, Icon} from "semantic-ui-react"
import styled from "styled-components"

const options = [
	{ key: "GET", text: "GET", value: "GET" },
	{ key: "POST", text: "POST", value: "POST" },
	{ key: "PUT", text: "PUT", value: "PUT" },
	{ key: "DELETE", text: "DELETE", value: "DELETE" },
	{ key: "WS",     text: "WS",     value: "WS" }
  ]

const SelectStyle = styled(Select)`
	min-width: 100px!important;
`

const EndpointForm = ({summary, method, path, onChangeUrl, onChangeMethod} : any) => 
	<Form>
	  <Form.Field>
	  	<Header size="medium">
			<Icon name="edit outline" />
    		<Header.Content>{summary}</Header.Content>
		</Header>
	  </Form.Field>
	  <Form.Field error={!path || path === ""}>
		<label>path</label>
		<Input
			value         = {path || ""}
			onChange    = {({target:{value}}) => onChangeUrl(value)}
			label         = {<SelectStyle value={method} options={options} onChange={(e:any, {value}:any) => onChangeMethod(value)} />}
			labelPosition = "left"
			placeholder   = "path"
		/>
	  </Form.Field>
	</Form>
  
export default EndpointForm