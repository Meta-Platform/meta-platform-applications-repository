
import * as React from "react"

import {List, Header, Image} from "semantic-ui-react"

import tableIcon from "../../Assets/table.svg"

const TableList = ({selected, list, onSelect}:any) => {
	return <>
        <Header dividing as="h4">Tables</Header>
        <List selection animated>
            {
                list.map((modelName:string, key:any) => 
                <List.Item 
                    key={key} 
                    active={selected === modelName} 
                     onClick={()=>onSelect(modelName)}>
                         <Image size="mini" src={tableIcon}/>
                    <List.Content>
                        <List.Header>
                            {modelName}
                        </List.Header>
                    </List.Content>
                </List.Item>)
            }
        </List>
    </>

}

export default TableList