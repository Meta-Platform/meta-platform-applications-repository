// Dispara o download de um conteúdo base64 via data URI (usado no desktop
// Electron GUI-host, onde não há URL HTTP para o arquivo).
export const triggerBase64Download = (name: string, mimeType: string | undefined, base64: string) => {
    const a = document.createElement("a")
    a.href = `data:${mimeType || "application/octet-stream"};base64,${base64}`
    a.download = name || "arquivo"
    document.body.appendChild(a)
    a.click()
    a.remove()
}

// Download de conteúdo textual (HTML, markdown) via Blob — evita data URI gigante
// e preserva UTF-8. Funciona no browser e no Electron GUI-host.
export const triggerTextDownload = (name: string, mimeType: string, text: string) => {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name || "arquivo"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// Abre um documento HTML autocontido num iframe oculto e chama a impressão do
// sistema (o usuário escolhe "Salvar como PDF"). Iframe (em vez de window.open)
// funciona também no Electron GUI-host, onde popups são bloqueados.
export const printHtmlDocument = (html: string) => {
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    document.body.appendChild(iframe)

    const cleanup = () => { try { iframe.remove() } catch (_) { /* já removido */ } }

    iframe.onload = () => {
        const win = iframe.contentWindow
        if (!win) { cleanup(); return }
        // Deixa o layout/imagens assentarem antes de imprimir.
        setTimeout(() => {
            try { win.focus(); win.print() } catch (_) { /* ignore */ }
            // Remove depois que o diálogo fecha (afterprint) ou por timeout de guarda.
            const done = () => setTimeout(cleanup, 500)
            try { win.addEventListener("afterprint", done, { once: true }) } catch (_) { setTimeout(cleanup, 60000) }
            setTimeout(cleanup, 120000)
        }, 300)
    }

    iframe.srcdoc = html
}
