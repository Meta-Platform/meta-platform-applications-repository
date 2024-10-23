import * as React from "react"
import { 
	Menu,
	Header,
	Image
} from "semantic-ui-react"
import styled from "styled-components"



const AppsMenuItem = styled(Menu.Item)`
	padding: 8px!important;
`

const MainMenu = () => {

    return <Menu attached="top">
                <AppsMenuItem active>
                    <Header>Datasource Manager</Header>
                </AppsMenuItem>
            </Menu>
}
    

export default MainMenu