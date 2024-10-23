import * as React              from "react"
import { useEffect, useState } from "react"
import { connect }             from "react-redux"
import { Menu, Button}         from "semantic-ui-react"

import GetRequestByServer from "../Utils/GetRequestByServer"
import FluidItemNavigator from "./ExplorerFS.explorer/FluidItemNavigator"

const FSExplorer = ({
    source,
    HTTPServerManager
}: any) => {

    const [currentListItem, setCurrentListItem] = useState()
    const [currentPath, setCurrentPath]         = useState<string>()

    useEffect(() => {
        if (source) {
            setCurrentPath("/")
        }else{
            setCurrentListItem(undefined)
            setCurrentPath(undefined)
        }
    }, [source])

    useEffect(() => {
        if (currentPath) updateListItem()
    }, [currentPath])

    const updateListItem = () =>
        source
        && GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "FileSystemNavigator")
            //@ts-ignore
            .ListItem({ keystone: source.keystone, path: currentPath })
            .then(({ data }: any) => {
                const { path, listItem } = data
                setCurrentPath(path)
                setCurrentListItem(listItem)
            })
            .catch((e:any) => {
                console.log(e)
            })


    const handleBack = () => {
        //@ts-ignore
        const splited = currentPath.split("/")
        const newCurrentPath = splited.slice(0, splited.length - 1).join("/")
        setCurrentPath(newCurrentPath !== "" ? newCurrentPath : "/")
    }

    const handleOpenFile = (path:string) => {
        GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "FileSystemNavigator")
        //@ts-ignore
        .GetContentItem({ keystone: source.keystone, path })
        .then(({ data }: any) => {
           // console.log(data)
        })
        .catch((e:any) => {
            console.log(e)
        })
    }

    return <div style={{ marginTop: "15px" }}>
        <Menu attached="top">
            <Menu.Item>
                <strong>{source.name}</strong>
            </Menu.Item>
            <Menu.Item>
                File System
            </Menu.Item>
            {
                currentPath &&
                currentPath !== "/" &&
                <Menu.Item>
                    <Button icon="arrow left" onClick={handleBack} />
                </Menu.Item>
            }

            {
                source
                //@ts-ignore
                && source.message 
                && <Menu.Item color="red" active>
                    {
                        //@ts-ignore
                        source.message
                    }
                </Menu.Item>
            }
            {
                currentPath 
                && <Menu.Item>
                    {currentPath}
                </Menu.Item>
            }
        </Menu>

        <FluidItemNavigator 
            currentListItem = {currentListItem || []} 
            currentPath     = {currentPath}
            onChangePath    = {setCurrentPath}
            onOpenFile      = {handleOpenFile}/>

    </div>
}

const mapStateToProps = ({ HTTPServerManager }: any) => ({
    HTTPServerManager
})

export default connect(mapStateToProps, (dispatch) => ({}))(FSExplorer)