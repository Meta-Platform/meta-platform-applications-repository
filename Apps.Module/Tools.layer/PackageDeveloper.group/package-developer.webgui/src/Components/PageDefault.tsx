
import * as React    from "react"

import useZoom     from "../Hooks/useZoom"

import PackageMenu from "../Components/PackageMenu"

const PageDefault = ({children, onHome, centerTitle}:any) => {
    useZoom()   // Ctrl/Cmd +, - e 0 ajustam o zoom de todo o app
    return <div style={{width:"100%"}}>
        <div>
            <PackageMenu onHome={onHome} centerTitle={centerTitle} />
            {children}
        </div>
    </div>
}

export default PageDefault