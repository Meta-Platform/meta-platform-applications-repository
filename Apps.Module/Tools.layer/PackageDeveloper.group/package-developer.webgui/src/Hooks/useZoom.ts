import { useEffect } from "react"

// Zoom global do Package Developer via Ctrl/Cmd +, - e 0 (reset). Persistido em
// localStorage e aplicado com `zoom` (Chromium/Electron) — escala todo o app com
// reflow correto (diferente de transform:scale).
const KEY  = "pd:zoom"
const MIN  = 0.6
const MAX  = 2.2
const STEP = 0.1

const clamp = (z:number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100))

const apply = (z:number) => { (document.body.style as any).zoom = String(z) }

const useZoom = () => {
    useEffect(() => {
        let z = 1
        try { const s = parseFloat(localStorage.getItem(KEY) || ""); if(!isNaN(s)) z = clamp(s) } catch(e) {}
        apply(z)

        const set = (next:number) => {
            z = clamp(next)
            apply(z)
            try { localStorage.setItem(KEY, String(z)) } catch(e) {}
        }

        const onKey = (e:KeyboardEvent) => {
            if(!(e.ctrlKey || e.metaKey) || e.altKey) return
            if(e.key === "+" || e.key === "=")      { e.preventDefault(); set(z + STEP) }
            else if(e.key === "-" || e.key === "_") { e.preventDefault(); set(z - STEP) }
            else if(e.key === "0")                  { e.preventDefault(); set(1) }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])
}

export default useZoom
