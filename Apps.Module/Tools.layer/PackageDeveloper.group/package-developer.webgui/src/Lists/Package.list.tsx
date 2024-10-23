
import * as React from "react"

import {
	List, 
	Image, 
	Button, 
	Icon
} from "semantic-ui-react"
import styled from "styled-components"

const ListStyled = styled(List)`
	overflow: scroll;
    height: 87vh;
`

const ButtonGitStyle = styled(Button)`
	margin-left: 10px!important;
`

type PackageListProps =
{
	list:Array<any>
	packageSelected:{name:string, ext:string}
	workspaceSelected:any
	onSelect:Function
}

const PackageList = ({
	list, 
	workspaceSelected, 
	packageSelected, 
	onSelect
}:PackageListProps) => 
	<ListStyled selection animated>
		{
			list
			.map(({name, namespace, ext}:any, key:number) => 
			<List.Item 
				key={key} 
				active={packageSelected && name === packageSelected.name && ext === packageSelected.ext}
				onClick={() => onSelect({name, ext})} >
				<Image size="mini" src={`http://localhost:8093/package-developer/icon/${workspaceSelected}/${name}/${ext}`}/>
				<List.Content>
					<List.Header>{name}</List.Header>
					<List.Description>{namespace}</List.Description>
				</List.Content>
			</List.Item>)
		}
	</ListStyled>


export default PackageList