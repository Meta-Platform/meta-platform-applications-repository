import * as React from "react"

import { EmptyState } from "@i-components"

import OpenSqliteButton from "./OpenSqliteButton"

type Props = { onOpenSqlite:(path:string, name:string)=>void }

// Tela inicial: conectar em uma base SQLite pré-existente. É o estado vazio
// canônico do kit — ícone, frase curta e a ação de saída.
const Welcome = ({onOpenSqlite}:Props) =>
    <div className="ds-center">
        <EmptyState
            icon    = "database"
            title   = "Gerenciador de Bases de Dados"
            message = "Conecte-se a uma base SQLite existente para navegar, consultar e modificar tabelas, dados e estrutura."
            actions = {<OpenSqliteButton onOpen={onOpenSqlite} label="Abrir base SQLite existente"/>}/>
    </div>

export default Welcome
