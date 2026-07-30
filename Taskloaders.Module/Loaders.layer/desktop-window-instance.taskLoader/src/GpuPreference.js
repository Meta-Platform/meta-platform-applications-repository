const fs = require("fs")
const os = require("os")
const { join } = require("path")
const { execFileSync } = require("child_process")

/* Qual placa de vídeo a janela usa.

   Em laptop com duas GPUs (integrada + dedicada) o Chromium no Linux ativa a
   INTEGRADA e não há como mudar isso de dentro da página: o `powerPreference`
   que o WebGL aceita é honrado no macOS/Windows, não aqui. A escolha é feita na
   largada do processo — que é o que este módulo resolve.

   O caminho que funciona é o backend Vulkan do ANGLE:
     --use-angle=vulkan                          → ANGLE prefere a DEDICADA
     --use-angle=vulkan + ANGLE_PREFERRED_DEVICE → a placa escolhida
   O nome em ANGLE_PREFERRED_DEVICE precisa ser EXATO (o nome que o driver
   Vulkan reporta); um pedaço dele ("AMD") não casa e cai no padrão.

   O caminho por PRIME (__NV_PRIME_RENDER_OFFLOAD + ANGLE/GL), que parece o
   óbvio, foi medido e cai em SwiftShader — renderização por CPU. Não usar.

   DUAS METADES, e o motivo de elas serem separadas: o SWITCH pode ser aplicado
   pelo próprio processo Electron (`app.commandLine`), mas a VARIÁVEL de ambiente
   não — no Linux o processo de GPU nasce do zygote, criado antes de o JS rodar,
   e enxerga o ambiente daquele instante. Por isso ANGLE_PREFERRED_DEVICE tem de
   entrar no env de QUEM ABRE o Electron (o task loader), e não de dentro dele.

   A preferência mora fora do userData do Electron justamente porque os dois
   lados precisam lê-la: o task loader (Node puro, antes do spawn) e a janela. */

// Um arquivo por app (a classe X11 do .desktopapp), sob a config do usuário.
const CONFIG_DIR_NAME = join("meta-platform", "gpu-preference")

// Modos: o usuário raramente sabe (e não deveria precisar saber) o nome do
// dispositivo; "dedicada"/"integrada" cobrem a escolha real, e "device" existe
// para máquinas com mais de duas placas.
const MODES = ["auto", "dedicated", "integrated", "device"]

// Dispositivos que existem no Vulkan mas não são placas: renderizam na CPU.
const SOFTWARE_DEVICE = /llvmpipe|lavapipe|swiftshader/i

let cachedDevices

/* A lista de placas vem do `vulkaninfo` do sistema (~0,25 s) porque é a única
   fonte que dá o NOME EXATO como o driver Vulkan o reporta — que é a chave que
   o ANGLE compara. O Electron sabe dizer vendor/device id, não o nome.
   Sem `vulkaninfo` instalado ficamos sem lista: o modo automático continua
   funcionando (não depende de nome), os demais caem no comportamento padrão. */
const ListVulkanDevices = () => {
    if(cachedDevices) return cachedDevices

    let output
    try {
        output = execFileSync("vulkaninfo", ["--summary"], { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] })
    } catch (error) {
        cachedDevices = []
        return cachedDevices
    }

    const devices = []
    let current

    for(const rawLine of String(output).split("\n")){
        const line = rawLine.trim()
        // "GPU0:" abre o bloco de um dispositivo; os campos vêm como "chave = valor".
        if(/^GPU\d+:/.test(line)){
            current = { name: null, type: null, vendorId: null }
            devices.push(current)
            continue
        }
        if(!current) continue
        const match = line.match(/^(deviceName|deviceType|vendorID)\s*=\s*(.+)$/)
        if(!match) continue
        if(match[1] === "deviceName") current.name = match[2].trim()
        if(match[1] === "vendorID")   current.vendorId = match[2].trim()
        if(match[1] === "deviceType") current.type =
              /DISCRETE/.test(match[2])   ? "discrete"
            : /INTEGRATED/.test(match[2]) ? "integrated"
            : /VIRTUAL/.test(match[2])    ? "virtual"
            : "software"
    }

    cachedDevices = devices.filter((device) => device.name && !SOFTWARE_DEVICE.test(device.name))
    return cachedDevices
}

const _ConfigDirPath = () =>
    join(process.env.XDG_CONFIG_HOME || join(os.homedir(), ".config"), CONFIG_DIR_NAME)

const _SafeName = (appKey) => String(appKey || "default").replace(/[^a-zA-Z0-9._-]/g, "_")

const PreferenceFilePath = (appKey) => join(_ConfigDirPath(), `${_SafeName(appKey)}.json`)

const ReadPreference = (appKey) => {
    try {
        const raw = JSON.parse(fs.readFileSync(PreferenceFilePath(appKey), "utf8"))
        return {
            mode      : MODES.includes(raw.mode) ? raw.mode : "auto",
            deviceName: raw.deviceName || null
        }
    } catch (error) {
        // Sem arquivo (ou ilegível) é o caso comum: primeira abertura.
        return { mode: "auto", deviceName: null }
    }
}

const WritePreference = (appKey, { mode, deviceName }) => {
    const preference = {
        mode      : MODES.includes(mode) ? mode : "auto",
        deviceName: deviceName || null,
        updatedAt : new Date().toISOString()
    }
    fs.mkdirSync(_ConfigDirPath(), { recursive: true })
    fs.writeFileSync(PreferenceFilePath(appKey), JSON.stringify(preference, null, 4), "utf8")
    return preference
}

/* Traduz a preferência em nome de dispositivo. `null` = deixa o ANGLE decidir
   (ele prefere a dedicada), que é o que queremos no modo automático. */
const _ResolveDeviceName = (preference, devices) => {
    if(preference.mode === "device")     return preference.deviceName || null
    if(preference.mode === "integrated") return (devices.find((device) => device.type === "integrated") || {}).name || null
    if(preference.mode === "dedicated")  return (devices.find((device) => device.type === "discrete")   || {}).name || null
    return null
}

/* A decisão, uma vez só, usada pelas duas metades.

   `useVulkan` vira o switch; `env` entra no spawn do Electron. Quando a máquina
   não tem duas placas no Vulkan não mexemos em nada: forçar o backend Vulkan
   onde não há escolha só arriscaria trocar um caminho que funciona por um que
   pode cair em software. */
const ResolveGpuLaunch = (appKey) => {
    const preference = ReadPreference(appKey)

    // Só o Linux precisa disto: no macOS/Windows a escolha por powerPreference
    // funciona de dentro da página, e mexer nas flags só criaria regressão.
    if(process.platform !== "linux")
        return { ...preference, useVulkan: false, deviceName: null, env: {}, devices: [], reason: "plataforma-nao-aplicavel" }

    const devices = ListVulkanDevices()

    if(devices.length === 0)
        return { ...preference, useVulkan: false, deviceName: null, env: {}, devices, reason: "sem-vulkan" }

    if(devices.length < 2 && preference.mode === "auto")
        return { ...preference, useVulkan: false, deviceName: null, env: {}, devices, reason: "sem-alternativa" }

    const deviceName = _ResolveDeviceName(preference, devices)

    return {
        ...preference,
        useVulkan : true,
        deviceName,
        env       : deviceName ? { ANGLE_PREFERRED_DEVICE: deviceName } : {},
        devices,
        reason    : null
    }
}

module.exports = { ResolveGpuLaunch, ListVulkanDevices, ReadPreference, WritePreference, PreferenceFilePath, MODES }
