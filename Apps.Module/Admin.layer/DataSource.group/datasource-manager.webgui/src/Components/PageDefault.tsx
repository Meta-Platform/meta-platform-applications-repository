
import * as React    from "react"
import { Container } from "semantic-ui-react"

import GlobalStyle from "../Styles/Global.style"

import Menu from "./Menu"

const PageDefault = ({children}:any) =>
    <Container fluid={true}>
        <GlobalStyle />
        <div>
            <Menu/>
            {children}
        </div>
    </Container>

export default PageDefault