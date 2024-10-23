
import React from "react"
import { Menu, Header, MenuItem} from "semantic-ui-react"

const SidebarMenu = ({
    title,
    onSelectMenu,
    activeItem
}) =>{
    return <Menu pointing secondary vertical>
                <MenuItem>
                    <Header>{title}</Header>
                </MenuItem>
                <MenuItem
                    name='packages'
                    active={activeItem === 'packages'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                <MenuItem
                    name='environments'
                    active={activeItem === 'environments'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                <MenuItem
                    name='task executor monitor'
                    active={activeItem === 'task executor monitor'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                <MenuItem
                    name='repositories'
                    active={activeItem === 'repositories'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
            </Menu>
}


export default SidebarMenu