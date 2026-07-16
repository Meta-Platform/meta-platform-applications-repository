const fs = require("fs")
const crypto = require("crypto")
const { join } = require("path")

// Cache de build do webgui (.desktopapp em modo GUI-host).
//
// O processo principal do Electron compila o webgui com webpack a CADA abertura.
// Aqui derivamos uma "assinatura de conteúdo" (fingerprint) das ENTRADAS do
// build — a árvore de fonte do webgui (context) e o node_modules resolvido — e a
// gravamos junto ao bundle gerado. Na abertura seguinte, se a assinatura recém
// calculada bate com a salva (e os artefatos ainda existem no disco), o webpack
// é PULADO e o bundle já montado é carregado direto.
//
// Quando disparar rebuild:
//   - primeira vez (não há manifesto);
//   - edição da fonte do webgui (conteúdo do context muda);
//   - pacote/repositório atualizado — o reprovisionamento renova o node_modules,
//     alterando o conteúdo hasheado.
// Iguais ⇒ o bundle atual serve.

// Versão do formato/algoritmo do cache. Incremente para forçar um rebuild global
// quando a config do webpack (WebInterfaceBuilder) ou este cálculo mudarem de
// forma incompatível com bundles já gerados.
const CACHE_VERSION = 1
const MANIFEST_FILE = ".meta-build-manifest.json"

// Acrescenta ao hash o conteúdo de toda a árvore, em ordem determinística
// (entradas ordenadas por nome). Para cada entrada:
//   - arquivo: caminho relativo + bytes do conteúdo;
//   - symlink: caminho relativo + alvo do link (NÃO segue — evita ciclos e
//     varredura fora da árvore, ex.: os links em node_modules/.bin);
//   - diretório: marca o caminho e recorre.
// Falhas de leitura são absorvidas (a entrada entra como "ilegível") para nunca
// derrubar o cálculo.
const _HashTree = (hash, rootDir, currentDir) => {
    let entries
    try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch(e) {
        return
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for(const entry of entries){
        const full = join(currentDir, entry.name)
        const rel  = full.slice(rootDir.length)
        if(entry.isSymbolicLink()){
            let target = ""
            try { target = fs.readlinkSync(full) } catch(e) {}
            hash.update("L:" + rel + " -> " + target + "\n")
        } else if(entry.isDirectory()){
            hash.update("D:" + rel + "\n")
            _HashTree(hash, rootDir, full)
        } else if(entry.isFile()){
            hash.update("F:" + rel + "\n")
            try {
                hash.update(fs.readFileSync(full))
            } catch(e) {
                hash.update("<unreadable>")
            }
        }
    }
}

// Fingerprint de conteúdo (sha256 hex) das entradas do build do webgui. O
// diretório de saída/gerado NÃO participa — só fonte e node_modules —, então a
// assinatura calculada antes do build permanece válida para gravar depois dele.
const ComputeWebInterfaceFingerprint = ({ context, nodeModules }) => {
    const hash = crypto.createHash("sha256")
    hash.update("v" + CACHE_VERSION + "\n")
    hash.update("[context]\n")
    if(context) _HashTree(hash, context, context)
    hash.update("[node_modules]\n")
    if(nodeModules) _HashTree(hash, nodeModules, nodeModules)
    return hash.digest("hex")
}

const _ManifestPath = (output) => join(output, MANIFEST_FILE)

const ReadBuildManifest = (output) => {
    try {
        return JSON.parse(fs.readFileSync(_ManifestPath(output), "utf8"))
    } catch(e) {
        return null
    }
}

const WriteBuildManifest = (output, { fingerprint, serverAppName, builtAt } = {}) => {
    const manifest = {
        cacheVersion:  CACHE_VERSION,
        fingerprint:   fingerprint,
        serverAppName: serverAppName || null,
        builtAt:       builtAt || new Date().toISOString()
    }
    try {
        fs.writeFileSync(_ManifestPath(output), JSON.stringify(manifest, null, 2), "utf8")
    } catch(e) {}
    return manifest
}

// O bundle já montado serve (pula webpack) somente se: existe manifesto da mesma
// CACHE_VERSION, o fingerprint bate E os artefatos essenciais estão no disco
// (index.html + bundle.js). Qualquer dúvida ⇒ false ⇒ rebuild (seguro).
const IsWebInterfaceFresh = ({ output, fingerprint }) => {
    if(!fingerprint) return false
    const manifest = ReadBuildManifest(output)
    if(!manifest) return false
    if(manifest.cacheVersion !== CACHE_VERSION) return false
    if(manifest.fingerprint !== fingerprint) return false
    if(!fs.existsSync(join(output, "index.html"))) return false
    if(!fs.existsSync(join(output, "bundle.js"))) return false
    return true
}

module.exports = {
    CACHE_VERSION,
    ComputeWebInterfaceFingerprint,
    ReadBuildManifest,
    WriteBuildManifest,
    IsWebInterfaceFresh
}
