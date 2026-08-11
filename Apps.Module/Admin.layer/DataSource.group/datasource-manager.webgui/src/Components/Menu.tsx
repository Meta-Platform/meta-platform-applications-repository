import * as React from "react"

import { Topbar, ThemePicker } from "@i-components"

type Props = { subtitle?:string }

// Barra de sistema do Datasource Manager. A identidade e o seletor de tema são
// os do kit (`Topbar` + `ThemePicker`): a barra deixou de ser uma composição
// local de <div> e passou a ser a mesma dos demais aplicativos.
const AppTopbar = ({subtitle}:Props) =>
    <Topbar
        brand    = "Datasource Manager"
        subtitle = {subtitle}
        right    = {<ThemePicker variant="popover"/>}/>

export default AppTopbar
