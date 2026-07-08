// Dispara o download de um objeto como arquivo .json no browser (Blob + <a>).
const downloadJson = (data: any, filename: string) => {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename.endsWith(".json") ? filename : `${filename}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (_) { /* ambiente sem DOM (ex.: testes) */ }
}

export default downloadJson
