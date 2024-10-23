import * as React from "react"

import { 
	Segment, 
	Form
 } from 'semantic-ui-react'

import RuleView from "./RuleView"

const AgentLinkRulesView = ({ linkRules }) => {
	const renderLinkRule = (rule) => {
		return <Segment secondary style={{margin: "8px", marginBottom: "15px", padding:"8px", boxShadow: "rgb(92 92 92) 1px 1px 3px 1px"}}>
					<Form size="tiny">
						<Form.Field>
							<label style={{marginBottom:"0px"}}>reference name</label>
							<input placeholder={"reference name"} value={rule.referenceName}/>
							<label style={{marginTop:"8px", marginBottom:"0px"}}>requirement</label>
							{
								Object.keys(rule.requirement)
								.map((logicOperator) => <RuleView logicOperator={logicOperator} expressions={rule.requirement[logicOperator]}/>)
							}
						</Form.Field>
					</Form>
				</Segment>
	}

	return <>{linkRules.map((linkRule) => renderLinkRule(linkRule))}</>
}

export default AgentLinkRulesView