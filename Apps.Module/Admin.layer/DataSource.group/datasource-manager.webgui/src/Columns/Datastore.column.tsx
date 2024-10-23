import * as React from "react"

import DatastoreExplorer from "../Explorers/Datastore.explorer"

type DatastoreColumnProps = {
    source:SourceType
}

const DatastoreColumn = ({
    source
}:DatastoreColumnProps) => {
    return <> 
                <h3>
                   Datastore
                </h3>

                <DatastoreExplorer source={source}/>
            </>
}

export default DatastoreColumn