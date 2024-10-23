import * as React from "react"

import {
    Segment, 
    Loader,
    Dimmer
} from "semantic-ui-react"

import ItemPackage from "../../Components/ItemPackage"

const PackageList = ({
    isLoading,
    packageList,
    paramsSelected,
    serverManagerInformation,
    onStartPackage,
    onSelectPackage
}) => {

    return <Segment placeholder>
                { isLoading && <Dimmer active><Loader/></Dimmer> }
                <div style={{ overflow: 'auto', height:"82vh" }}>
                    {
                        packageList
                        .map((packageInformation:any, key) => {
                                return <ItemPackage
                                            key={key}
                                            paramsSelected={paramsSelected}
                                            style={{marginRight:"15px"}}
                                            onStartPackage={onStartPackage}
                                            packageInformation={packageInformation}
                                            serverManagerInformation={serverManagerInformation}
                                            onSelectPackage={onSelectPackage}/>
                            })
                    }
                </div>
            </Segment>
}

export default PackageList