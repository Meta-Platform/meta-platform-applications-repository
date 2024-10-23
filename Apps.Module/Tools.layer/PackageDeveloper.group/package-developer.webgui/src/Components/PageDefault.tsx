
import * as React    from "react"
import { Container } from "semantic-ui-react"

import GlobalStyle from "../Styles/Global.style"

import PackageMenu from "../Components/PackageMenu"

const PageDefault = ({children}:any) =>
    <Container fluid={true}>
        <GlobalStyle />
        <div>
            <PackageMenu/>
            {children}
        </div>
    </Container>

export default PageDefault