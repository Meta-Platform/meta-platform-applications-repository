import * as React from "react"
import { useState, useEffect } from "react"
import { Icon } from "semantic-ui-react"

const enc = encodeURIComponent

// Tamanhos nomeados -> px (mantém compatibilidade com chamadas antigas).
const toPx = (size:any) => typeof size === "number" ? size : ({ mini: 16, tiny: 28, small: 40 }[size as string] || 18)

// Ícone do pacote com fallback: se o pacote não tiver icon.svg/png (ou falhar ao
// carregar), mostra um cubo padrão. Imagem e fallback usam o MESMO tamanho fixo,
// para os ícones ficarem alinhados/consistentes na lista.
const PackageIcon = ({ workspace, name, ext, size = 18 }:any) => {

    const [failed, setFailed] = useState(false)
    const px = toPx(size)

    useEffect(() => { setFailed(false) }, [workspace, name, ext])

    if(failed || !workspace || !name || !ext){
        return <Icon name="cube" color="grey" style={{ margin: 0, fontSize: px, width: px, height: px, lineHeight: `${px}px` }} />
    }

    // Electron GUI-host: ícone via protocolo custom metaicon://. Fora do Electron,
    // a rota relativa do webservice.
    const src = (typeof window !== "undefined" && (window as any).metaGui)
        ? `metaicon://package?workspace=${enc(workspace)}&packageName=${enc(name)}&ext=${enc(ext)}`
        : `/package-developer/icon/${enc(workspace)}/${enc(name)}/${enc(ext)}`

    return <img
        src={src}
        onError={() => setFailed(true)}
        style={{ width: px, height: px, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }} />
}

export default PackageIcon
