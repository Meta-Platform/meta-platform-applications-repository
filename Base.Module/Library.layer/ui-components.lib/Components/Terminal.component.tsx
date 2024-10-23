import * as React           from "react"
import { useEffect, useRef} from "react"
import { Container, Grid }  from "semantic-ui-react"
import { Terminal }         from "xterm"
import styled               from "styled-components"

import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import GetRequestByServer from "../Utils/GetRequestByServer"

const GridStyle = styled(Grid)`
	background-color:#fff;
`

const TerminalComponent = ({pid, HTTPServerManager}:any) => {

    const termRef = useRef(null)

    useEffect(() => {
		const term = new Terminal({cols:90, rows:20})
		// @ts-ignore
		term.open(termRef.current)
        
        const ws = GetRequestByServer(HTTPServerManager)
        ("Core", "ProcessManager")
        .GetStardardInputOutput({pid})

		ws.onopen = () => {
            console.log("connected websocket main component")
		}
		
		ws.onmessage = function(e:any) {
			//console.log(e)
			if (typeof e.data === 'string') {
				//console.log(e.data)
				term.write(e.data)
			}
		}

		term.onData((data:any) => {
			ws.send(data)
				//term.write(data)
		})
	


	}, [])

    return <GridStyle padded>
                <Grid.Column>
                    <div ref={termRef}/>
                </Grid.Column>
            </GridStyle>
}


const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    
}, dispatch)

const mapStateToProps = ({ProcessManager, HTTPServerManager}:any) => ({
    ProcessManager,
    HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(TerminalComponent)
