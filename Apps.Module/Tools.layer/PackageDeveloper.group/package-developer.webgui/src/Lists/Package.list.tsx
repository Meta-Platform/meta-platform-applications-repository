
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
	onOpen?:Function
}

const PackageList = ({
	list,
	workspaceSelected,
	packageSelected,
	onSelect,
	onOpen
}:PackageListProps) =>
	<ListStyled selection animated>
		{
			list
			.map(({name, namespace, ext}:any, key:number) =>
			<List.Item
				key={key}
				active={packageSelected && name === packageSelected.name && ext === packageSelected.ext}
				onClick={() => onSelect({name, ext})}
				onDoubleClick={() => onOpen && onOpen({name, ext})} >
				<Image size="mini" src={`/package-developer/icon/${encodeURIComponent(workspaceSelected)}/${encodeURIComponent(name)}/${encodeURIComponent(ext)}`}/>
				<List.Content>
					<List.Header>{name}</List.Header>
					<List.Description>{namespace}</List.Description>
				</List.Content>
			</List.Item>)
		}
	</ListStyled>


export default PackageList