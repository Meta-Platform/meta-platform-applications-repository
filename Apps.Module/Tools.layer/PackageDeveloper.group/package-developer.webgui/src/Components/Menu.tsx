import * as React from "react"
import { 
	Menu,
	Header,
	Image
} from "semantic-ui-react"
import styled from "styled-components"

import listIcons    from "../Mocks/AppsMenu.mock"

const AppsMenuItem = styled(Menu.Item)`
	padding: 8px!important;
`

const MainMenu = () => {

    return <Menu attached="top">
                <AppsMenuItem active>
                    <Header>Package Developer</Header>
                </AppsMenuItem>
                {
                    listIcons
                    .filter(({enable}:any) => enable)
                    .map(({icon, title, url}, key) => 
                        <AppsMenuItem key={key}
                            title={title}
                            onClick={()=>{
                                //@ts-ignore
                                window.location = url
                            }}>
                            <Image spaced="right" src={icon} size="mini"/>
                        </AppsMenuItem>)
                }
            </Menu>
}
    

export default MainMenu