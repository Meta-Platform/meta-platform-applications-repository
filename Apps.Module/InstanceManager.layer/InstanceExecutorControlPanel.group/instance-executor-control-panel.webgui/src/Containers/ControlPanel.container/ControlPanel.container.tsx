import * as React from "react"
import { useState } from "react"

import { Grid, Loader, Segment} from "semantic-ui-react"

import useWebSocket from "../../Hooks/useWebSocket"
import GetAPI from "../../Utils/GetAPI"
import PageMasthead from "../../Components/ui/PageMasthead"
import StatusStrip, { StatusChip } from "../../Components/ui/StatusStrip"
import ApplicationDetails from "./ApplicationDetails"
import CardApplication from "./CardApplication"

type PackageType = {
    namespaceRepo: string
    packageName: string
    moduleName: string
    layerName: string
    parentGroup: string
    ext: string
}

const ControlPanelContainer = ({ serverManagerInformation }:any) => {

    const [ packageList, setPackageList ] = useState<PackageType[]>([])
    const [ packageInfoSelected, setPackageInfoSelected ] = useState()
    const [ isLoading, setLoading ] = useState(true)
    
    const getRuntimeManagerAPI = () => 
        GetAPI({ 
            apiName:"EcosystemManager",  
            serverManagerInformation 
        })
    
    useWebSocket({
		socket: getRuntimeManagerAPI().PackageList,
		onMessage: (packageList) => {
            setPackageList(packageList.filter(({ packageInService }:any) => packageInService))
            setLoading(false)
        },
		onConnection: () => {
            fetchPackageList()
        },
		onDisconnection: () => {
            setPackageList([])
            setLoading(true)
        }
	})

    const fetchPackageList = async () => {
        try {
            const api = getRuntimeManagerAPI()
            const response = await api.ListPackages()
            const packageList = response.data
            setPackageList(packageList.filter(({ packageInService }:any) => packageInService))
            setLoading(false)
        }catch(e){
            console.log(e)
        }
    }

    const handleShowDetailsColumn =
        (packageInformation) =>
        setPackageInfoSelected(packageInformation)

    // Encerra o processo/pacote DELEGANDO ao daemon (StopPackage por identidade).
    const handleStopPackage = (repositoryParams) => {
        getRuntimeManagerAPI()
        .StopPackage(repositoryParams)
        .then(() => fetchPackageList())
        .catch((e:any) => console.log(e))
    }

    return <div style={{ padding: "1em" }}>
            <PageMasthead
                icon="server"
                title="Processos em execução"
                subtitle="Aplicações e serviços supervisionados pelo daemon">
                <StatusStrip>
                    <StatusChip tone="success" icon="play" label="em serviço" count={packageList.length} />
                </StatusStrip>
            </PageMasthead>
            <Grid>
                {
                    isLoading && <Loader active style={{margin: "50px"}}/>
                }
                <Grid.Column width={ packageInfoSelected ? 8 : undefined}>
                    <Grid>
                        <Grid.Row>
                            {
                                packageList
                                .map((packageInformation:any, key) => {
                                        return <Grid.Column style={{marginBottom:"15px", width:"auto"}}>
                                                    <CardApplication
                                                        onShowDetailsColumn={handleShowDetailsColumn}
                                                        onStopPackage={handleStopPackage}
                                                        packageInformation={packageInformation}
                                                        serverManagerInformation={serverManagerInformation}/>
                                                </Grid.Column>
                                    })
                            }
                        </Grid.Row>
                    </Grid>
                </Grid.Column>
                {
                    packageInfoSelected
                    && <Grid.Column width={8}>
                        <ApplicationDetails
                            serverManagerInformation={serverManagerInformation}
                            packageInformation={packageInfoSelected}
                            onClose={() => setPackageInfoSelected(undefined)}/>
                    </Grid.Column>
                }
            </Grid>
        </div>
}

export default ControlPanelContainer