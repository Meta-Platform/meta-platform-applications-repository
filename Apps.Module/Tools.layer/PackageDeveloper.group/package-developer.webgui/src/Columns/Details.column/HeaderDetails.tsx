
import React from "react"

import {
    Grid,
    Header,
    Image
} from "semantic-ui-react"

type HeaderDetailsProps = {
    packageName : string
    workspace : string
    ext : string
    path : string
}

const HeaderDetails = ({
    packageName,
    workspace,
    ext,
    path
}:HeaderDetailsProps) =>
    <Grid  columns={2}>
        <Grid.Column width={3}>
            <Image
                size="tiny"
                src={`/package-developer/icon/${encodeURIComponent(workspace)}/${encodeURIComponent(packageName)}/${encodeURIComponent(ext)}`}/>
        </Grid.Column>
        <Grid.Column width={13}>
            <Header>{packageName}</Header>
            <span>{path}</span>
        </Grid.Column>
    </Grid>

export default HeaderDetails