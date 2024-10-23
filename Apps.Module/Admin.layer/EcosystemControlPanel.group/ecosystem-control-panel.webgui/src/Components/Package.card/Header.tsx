import * as React from "react"

import styled from "styled-components"
import { 
	Image, 
	Card,
	Button
} from "semantic-ui-react"

const ButtonOpenWebappStyle = styled(Button)`
	padding: 10px!important;
`

const Header = ({
	label,
	name, 
	typePackage
}:any) => <Card.Content>
    <ButtonOpenWebappStyle 
        title="open app" 
        floated="left" 
        basic 
        onClick={()=> window.open(`/${name}`)}>
        <Image
            size="mini"
            src={`/dashboard/icon/${name}`}/>
    </ButtonOpenWebappStyle>	
    <Card.Header>
        {label} 
    </Card.Header>
    <Card.Meta>{typePackage}</Card.Meta>
</Card.Content>			

export default Header