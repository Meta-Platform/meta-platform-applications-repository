import * as React from "react"

import { 
	Segment, 
	Form,
	Divider,
	FormGroup,
	FormField,
	Input,
	Select
 } from 'semantic-ui-react'

const GetLogicOperatorName = (logicOperator) => {
	switch(logicOperator){
		case "&&":
			return "AND"
		case "||":
			return "OR"
		default:
			return undefined
	}
}

const RuleView = ({expressions, logicOperator}) => {

	const renderExpression = (expression, operator="=") => 
		<Segment secondary style={{
				margin: "5px", 
				padding:"5px", 
				boxShadow: "rgb(92 92 92) 1px 1px 3px 1px",
				backgroundColor: "aliceblue"
				}}>
				<Form size="tiny">
					<FormGroup size="tiny" widths='equal'>
						<FormField
							control={Input}
							label='property'
							placeholder='property'
							value={expression.property}/>
						<FormField
							control={Select}
							label='is'
							options={[{ key: 'equal', text: '=', value: '=' }]}
							value={operator}
							placeholder='is'/>
						<FormField
							control={Input}
							label='value'
							placeholder='value'
							value={expression[operator]}/>
					</FormGroup>
				</Form>
		</Segment>


	return <Segment style={{margin: "10px", marginTop:"5px", padding:"5px", boxShadow: "rgb(92 92 92) 1px 1px 3px 1px"}}>
				{
					expressions.map((expression, index) => <>
						{renderExpression(expression)}
						{
							index < expressions.length-1
							&& <Divider horizontal>{GetLogicOperatorName(logicOperator)}</Divider>
						}
					</>)
				}
			</Segment>
}

export default RuleView