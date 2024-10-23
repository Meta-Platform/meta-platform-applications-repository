
import * as React from "react"
import styled from "styled-components"
import { 
	Segment,
	Grid,
	Card
} from "semantic-ui-react"

import CardHeader from "./Package.card/Header"
import CardControl from "./Package.card/Control"

const WebappControlPanelStyle = styled(Segment)`
	box-shadow: 1px 1px 2px grey!important;
	
`

const WebappControlPanel = ({
	type,
	label,
	name, 
	group, 
	packages
}:any) => <WebappControlPanelStyle>					
				<CardHeader
					label={label}
					name={group}
					typePackage={type}/>
				<CardControl type={type}/>
				<Grid padded columns={3}>
					{
						packages
						&& packages
						.map(({type, information}:any, key:number) => 
							<Grid.Column key={key}>
								<WebappControlPanelStyle>
									<CardHeader
									label={"label"}
									name={"name"}
									typePackage={type}/>
									<CardControl  type={type}/>
								</WebappControlPanelStyle>
							</Grid.Column>
						)
						
					}
				</Grid>
			</WebappControlPanelStyle>
	
    export default WebappControlPanel