import * as React from "react"

import OpenSqliteButton from "./OpenSqliteButton"

type Props = { onOpenSqlite:(path:string, name:string)=>void }

// Tela inicial: conectar em uma base SQLite pré-existente.
const Welcome = ({onOpenSqlite}:Props) =>
    <div className="ds-welcome">
        <div className="ds-welcome__card">
            <div className="ds-welcome__icon">🗄️</div>
            <h2>Gerenciador de Bases de Dados</h2>
            <p>Conecte-se a uma base <b>SQLite</b> existente para navegar, consultar e modificar tabelas, dados e estrutura.</p>
            <OpenSqliteButton onOpen={onOpenSqlite} className="ds-btn primary" label="Abrir base SQLite existente"/>
        </div>
    </div>

export default Welcome
