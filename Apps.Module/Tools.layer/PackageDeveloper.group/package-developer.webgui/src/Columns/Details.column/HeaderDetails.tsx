
import React from "react"

import {
    Grid,
    Header
} from "semantic-ui-react"

import PackageIcon from "../../Components/PackageIcon"

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
            <PackageIcon workspace={workspace} name={packageName} ext={ext} size="tiny" />
        </Grid.Column>
        <Grid.Column width={13}>
            <Header>{packageName}</Header>
            <span>{path}</span>
        </Grid.Column>
    </Grid>

export default HeaderDetails