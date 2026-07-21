
import * as React    from "react"

import Menu from "./Menu"

// Wrapper legado (usado por telas auxiliares). O workbench principal
// (Main.page) monta o próprio shell .ds-app e NÃO passa por aqui.
const PageDefault = ({children}:any) =>
    <div className="ds-app">
        <Menu/>
        <div style={{flex:"1 1 auto", overflow:"auto"}}>
            {children}
        </div>
    </div>

export default PageDefault
