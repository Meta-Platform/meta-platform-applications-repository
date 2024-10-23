import * as React            from "react"
import {useState, useEffect} from "react"
import styled                from "styled-components"
import { connect }           from "react-redux"

import GetRequestByServer from "../Utils/GetRequestByServer"

import { 
	Container,
	Segment,
	Header,
	Label,
	Table,
	Grid
} from "semantic-ui-react"


const GetColorByStatus = (status:string) => {
	switch(status){
		case "PENDING":
			return "grey"
		case "WAITING":
			return "olive"
		case "READY":
			return "green"	
		case "ERROR":
			return "red"
		default:
			return "grey"
	}
}

const SegmentGroupStyle = styled(Segment.Group)`
	margin-bottom:10px!important;
`

const Source = (source:any) => 
	<SegmentGroupStyle>
		<Segment tertiary>
			<Label 
				size="mini" 
				title={source.message} 
				color={GetColorByStatus(source.status)}
				horizontal>
				{source.status}
			</Label>
			<strong>{source.name}</strong></Segment>
		<Segment>
			<Table basic="very" celled collapsing>
				<Table.Body>
					{
						Object.keys(source)
						.filter((property:string) => {
							return property !== "type"
							&& property !== "name"
							&& property !== "status"
						})
						.map((property, key) =>
							<Table.Row key={key} error={property === "message"}>
								<Table.Cell><strong>{property}</strong></Table.Cell>
								<Table.Cell>
									{
										property !== "cwd" 
										? source[property]
										: <span style={{fontSize:"0.9em"}}>{source[property]}</span>
									}
								</Table.Cell>
							</Table.Row>)
					}
					
				</Table.Body>
				</Table>
		</Segment>
	</SegmentGroupStyle>

const StatusContainer = ({HTTPServerManager}:any) => {

    const [status, setStatus] = useState<any[]>()

    useEffect(() =>  {

		let count = setInterval(() =>{
			updateStatus()
		}, 500)

		return () => clearInterval(count)
	}, [])

    const updateStatus = () => {
		GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "DataSources")
		.Status()
		.then(({data}:any) => setStatus(data))
	}



    return <Container>
				<Header dividing as='h2'>File System</Header>
				<Grid columns={3}>
					<Grid.Row>
						{
							status 
							//@ts-ignore
							&& status
							.filter(({type}:{type:string}) => type === "FSService")
							.map((source:any, key:any) => 
								<Grid.Column key={key}>
									<Source {...source}/>
								</Grid.Column>)
						}
					</Grid.Row>
				</Grid>
				
                <Header dividing as='h2'>Object Relational Mapper</Header>
				<Grid columns={3}>
					<Grid.Row>
						{
							//@ts-ignore
							status 
							//@ts-ignore
							&& status
							.filter(({type}:{type:string}) => type === "ORMService")
							.map((source:any, key:any) => 
								<Grid.Column key={key}>
									<Source {...source}/>
								</Grid.Column>)
						}
					</Grid.Row>
				</Grid>
				
				<Header dividing as='h2'>Data Store</Header>
				<Grid columns={3}>
					<Grid.Row>
						{
							//@ts-ignore
							status 
							//@ts-ignore
							&& status
							.filter(({type}:{type:string}) => type === "DataStoreService")
							.map((source:any, key:any) => 
								<Grid.Column key={key}>
									<Source {...source}/>
								</Grid.Column>)
						}
					</Grid.Row>
				</Grid>
            </Container>
}
    


const mapStateToProps = ({HTTPServerManager}:any) => ({
	HTTPServerManager
})

export default connect(mapStateToProps, (dispatch:any) =>({}))(StatusContainer)