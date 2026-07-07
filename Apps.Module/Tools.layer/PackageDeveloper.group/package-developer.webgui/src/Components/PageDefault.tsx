
import * as React    from "react"
import { Container } from "semantic-ui-react"

import GlobalStyle from "../Styles/Global.style"
import useZoom     from "../Hooks/useZoom"

import PackageMenu from "../Components/PackageMenu"

const PageDefault = ({children, onHome, centerTitle}:any) => {
    useZoom()   // Ctrl/Cmd +, - e 0 ajustam o zoom de todo o app
    return <Container fluid={true}>
        <GlobalStyle />
        <div>
            <PackageMenu onHome={onHome} centerTitle={centerTitle} />
            {children}
        </div>
    </Container>
}

export default PageDefault