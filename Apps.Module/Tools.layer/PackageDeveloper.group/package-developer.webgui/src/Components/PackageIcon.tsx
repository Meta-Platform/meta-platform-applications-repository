import * as React from "react"
import { useState, useEffect } from "react"
import { Image, Icon } from "semantic-ui-react"

const enc = encodeURIComponent

// Ícone do pacote com fallback: se o pacote não tiver icon.svg/png (ou falhar
// ao carregar), mostra um ícone padrão em vez de uma imagem quebrada.
const PackageIcon = ({ workspace, name, ext, size = "mini" }:any) => {

    const [failed, setFailed] = useState(false)

    useEffect(() => { setFailed(false) }, [workspace, name, ext])

    if(failed || !workspace || !name || !ext){
        return <Icon name="cube" color="grey" size="large" style={{margin:0}} />
    }

    const src = `/package-developer/icon/${enc(workspace)}/${enc(name)}/${enc(ext)}`

    return <Image
        size={size}
        src={src}
        onError={() => setFailed(true)}
        style={{display:"inline-block"}} />
}

export default PackageIcon
