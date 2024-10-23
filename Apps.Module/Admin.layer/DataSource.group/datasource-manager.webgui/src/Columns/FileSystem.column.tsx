import * as React from "react"

import FSExplorer from "../Explorers/FS.explorer"

type FileSystemColumnProps = {
    source:SourceType
}

const FileSystemColumn = ({
    source
}:FileSystemColumnProps) => {

    return <> 
                <h3>File System</h3>

                <FSExplorer source={source}/>
            </>
}

export default FileSystemColumn