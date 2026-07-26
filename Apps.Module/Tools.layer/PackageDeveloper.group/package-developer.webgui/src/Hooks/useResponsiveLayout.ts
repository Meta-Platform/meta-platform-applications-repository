import { useEffect, useState } from "react"

// Modo de layout do explorador, definido pelo COMPORTAMENTO do layout (quantas
// colunas cabem), não por dispositivo:
//   wide   (>= 1240px) → 4 regiões lado a lado, Inspector acoplado
//   medium (>=  840px) → estrutura + resultados; Inspector sobreposto (drawer)
//   narrow (<   840px) → só os resultados; Inspector em tela cheia

export type LayoutMode = "wide" | "medium" | "narrow"

export const WIDE_MIN = 1240
export const MEDIUM_MIN = 840

export const modeForWidth = (width:number):LayoutMode =>
    width >= WIDE_MIN ? "wide" : width >= MEDIUM_MIN ? "medium" : "narrow"

const currentWidth = () =>
    typeof window === "undefined" ? WIDE_MIN : window.innerWidth

const useResponsiveLayout = ():LayoutMode => {

    const [mode, setMode] = useState<LayoutMode>(() => modeForWidth(currentWidth()))

    useEffect(() => {
        const onResize = () => setMode(modeForWidth(currentWidth()))
        onResize()
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    return mode
}

export default useResponsiveLayout
