import * as React from "react"
import {List} from "semantic-ui-react"

const AppDataListItem = () =>
    <List.Item>
        <List.Icon name="folder" />
        <List.Content>
            <List.Header>AppData</List.Header>
        </List.Content>
    </List.Item>

export default AppDataListItem