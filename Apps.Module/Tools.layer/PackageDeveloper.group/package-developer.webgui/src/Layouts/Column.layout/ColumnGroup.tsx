import React from "react"
import {Grid, Segment} from "semantic-ui-react"
import styled from "styled-components"

const SegmentStyle = styled(Segment)`
    background-color: #fff !important;
    border-color: #ffffff00 !important;
`

type ColumnGroupProps = {
    columns:any
    children:any
}

const ColumnGroup = ({columns, children}:ColumnGroupProps) => 
    <SegmentStyle attached="bottom">
            <Grid columns={columns} divided>
                <Grid.Row>
                   {children}
                </Grid.Row>
            </Grid>
        </SegmentStyle>

export default ColumnGroup