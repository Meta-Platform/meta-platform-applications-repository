import * as React from "react"

import RelationalDatabaseExplorer from "../Explorers/RelationalDatabase.explorer"

import { Header } from "semantic-ui-react"

type RelationalDatabaseColumnProps = {
    source:SourceType
}

const RelationalDatabaseColumn = ({
    source
}:RelationalDatabaseColumnProps) => {
    return <> 
                <Header as="h3" dividing>{source.name}</Header>
                <RelationalDatabaseExplorer source={source}/>
            </>
}

export default RelationalDatabaseColumn