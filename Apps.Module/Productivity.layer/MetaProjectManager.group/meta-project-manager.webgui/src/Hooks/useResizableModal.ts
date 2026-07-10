import { useEffect, useRef } from "react"

import useApi from "./useApi"

// Tamanho do modal, lembrado POR ITEM: um épico com descrição longa quer uma
// janela grande; uma subtarefa, não.
//
// O elemento redimensionável é o `.mpm-modal--inspector`, que pertence ao
// AppShell — o inspector o alcança pelo `closest()` a partir do próprio nó. É
// DOM direto de propósito: passar largura/altura por props obrigaria o AppShell
// a conhecer o item que está aberto.
interface Size { width: number; height: number }

const MIN_WIDTH = 520
const MIN_HEIGHT = 320
const SAVE_DEBOUNCE_MS = 400

const keyOf = (itemId: string) => `itemModal:${itemId}`

export const useResizableModal = (itemId: string) => {
    const api = useApi()
    const anchorRef = useRef<HTMLElement | null>(null)
    const saveTimer = useRef<any>(null)
    // Ignora o ResizeObserver disparado por NÓS ao aplicar o tamanho salvo.
    const applying = useRef(false)

    useEffect(() => {
        const anchor = anchorRef.current
        const modal = anchor ? anchor.closest(".mpm-modal--inspector") as HTMLElement | null : null
        if (!modal) return

        let alive = true

        api.system.getAppState(keyOf(itemId))
            .then((entry) => {
                if (!alive || !entry || !entry.value) return
                const size = entry.value as Size
                if (!size.width || !size.height) return
                applying.current = true
                modal.style.width = `${Math.max(MIN_WIDTH, size.width)}px`
                modal.style.height = `${Math.max(MIN_HEIGHT, size.height)}px`
                // Um frame depois, o observer já viu a mudança que fizemos.
                requestAnimationFrame(() => { applying.current = false })
            })
            .catch(() => {})

        const observer = new ResizeObserver((entries) => {
            if (applying.current) return
            const box = entries[0]
            if (!box) return
            const width = Math.round(box.contentRect.width)
            const height = Math.round(box.contentRect.height)

            clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(() => {
                api.system.setAppState(keyOf(itemId), { width, height }).catch(() => {})
            }, SAVE_DEBOUNCE_MS)
        })
        observer.observe(modal)

        return () => {
            alive = false
            clearTimeout(saveTimer.current)
            observer.disconnect()
            // O próximo item abre no tamanho dele (ou no padrão do CSS).
            modal.style.width = ""
            modal.style.height = ""
        }
    }, [itemId, api])

    return anchorRef
}

export default useResizableModal
