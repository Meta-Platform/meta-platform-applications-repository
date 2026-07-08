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
