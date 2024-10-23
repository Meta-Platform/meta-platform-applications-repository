import * as React from "react"

import {
    List,
    Grid
} from "semantic-ui-react"

const ColumnListFile = ({listItem, currentPath, onChangePath, onOpenFile}:any) => 
    <Grid.Column>
    <List selection animated>
        {
            listItem
            .map(({ filename, isFile }: any, key: number) =>
                <List.Item
                    onDoubleClick={() => isFile ? onOpenFile(`${currentPath}${currentPath !== "/" ? "/" : ""}${filename}`) : onChangePath(`${currentPath}${currentPath !== "/" ? "/" : ""}${filename}`)}
                    key={key} >
                    <List.Icon name={isFile ? "file" : "folder"} />
                    <List.Content>
                        <List.Header>{filename}</List.Header>
                    </List.Content>
                </List.Item>)
        }
    </List>
    </Grid.Column>

export default ColumnListFile