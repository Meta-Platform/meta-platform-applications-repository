/* Deliberadamente JavaScript: este módulo é requerido pelas DUAS metades — o
 * task loader (Node puro, antes do spawn) e o `electron-main`, que o carrega
 * ANTES de a resolução de `.ts` estar instalada. Convertido para `.ts`, a
 * janela deixaria de abrir. Mesmo motivo do GpuPreference.js. */

const fs = require("fs")
const os = require("os")
const { join, dirname } = require("path")

/* A SANDBOX DO CHROMIUM, E POR QUE ELA PRECISA DE UMA DECISÃO NOSSA.

   Toda janela do ecossistema é um Chromium, e o Chromium se recusa a rodar sem
   isolar os processos filhos. Ele tenta, nesta ordem:

     1. namespace sandbox — cria um user namespace e, DENTRO dele, pede
        CAP_SYS_ADMIN para montar os demais namespaces. Não exige root.
     2. SUID helper — o binário `chrome-sandbox` ao lado do executável, que só
        serve se for `root:root` com o bit setuid (modo 4755).
     3. nenhum dos dois → FATAL: o processo aborta com SIGTRAP antes de existir
        qualquer janela.

   Os dois caminhos quebram por motivos que NÃO estão sob o controle de quem
   escreve o app:

     - o (1) é política da distro, não do programa. No Ubuntu 24.04 o perfil
       AppArmor `unprivileged_userns` faz `audit deny capability` — nega TODAS
       as capabilities dentro do namespace, inclusive a única de que o zygote
       precisa. Basta um `apt upgrade` de kernel para o mesmo binário, na mesma
       máquina, abrir num boot e abortar no seguinte.
     - o (2) exige root. O `npm install` extrai o Electron como usuário comum,
       então TODA atualização do Electron devolve o `chrome-sandbox` sem o bit
       setuid — e o ecossistema não eleva privilégio em ponto nenhum.

   Sem este módulo o resultado é o pior possível: a janela morre no nascimento
   por uma razão que nada tem a ver com o app, e a explicação existe apenas no
   stderr do Chromium. Aqui a máquina é lida ANTES do spawn, escolhemos o modo
   mais seguro que ela suporta e, quando nenhum é possível, a janela abre sem
   sandbox AVISANDO — em vez de não abrir.

   POR QUE A DECISÃO PRÉVIA É HEURÍSTICA. A única sonda fiel do caminho (1)
   seria um processo sem perfil próprio repetindo a sequência do zygote:
   `unshare(1)` NÃO serve (no Ubuntu ele tem perfil AppArmor próprio e passa
   exatamente onde o Electron falha), e subir um Chromium só para perguntar
   custa mais do que abrir a janela. Então lemos os sinais conhecidos do /proc e
   deixamos a palavra final para o RESULTADO: quem chama reconhece a falha pelo
   stderr (`LooksLikeSandboxFailure`) e reabre sem sandbox. É essa segunda
   camada que faz a solução valer também na distro que ainda não conhecemos. */

const DISABLE_SWITCH = "--no-sandbox"

// Sinais, no /proc, de que o caminho (1) não vai funcionar. A lista é dos
// mecanismos conhecidos; o que ela não previr cai na rede de segurança acima.
const NAMESPACE_BLOCKERS = [
    {
        // Ubuntu 24.04+ e derivados.
        path   : "/proc/sys/kernel/apparmor_restrict_unprivileged_userns",
        blocked: (value) => value === "1",
        reason : "o AppArmor desta distro nega capabilities dentro de user namespaces não privilegiados (kernel.apparmor_restrict_unprivileged_userns=1)"
    },
    {
        path   : "/proc/sys/user/max_user_namespaces",
        blocked: (value) => value === "0",
        reason : "o kernel não permite criar user namespaces (user.max_user_namespaces=0)"
    },
    {
        // Debian/Arch e kernels com o patch antigo de userns.
        path   : "/proc/sys/kernel/unprivileged_userns_clone",
        blocked: (value) => value === "0",
        reason : "o kernel não permite user namespaces sem privilégio (kernel.unprivileged_userns_clone=0)"
    }
]

// Assinaturas do abort de sandbox no stderr do Chromium. Ampla de propósito: a
// mensagem exata muda entre versões, e um falso positivo aqui custa uma
// reabertura sem sandbox — enquanto um falso negativo custa a janela.
const FAILURE_SIGNATURES = [
    /setuid_sandbox/i,
    /chrome-sandbox/i,
    /SUID sandbox/i,
    /no usable sandbox/i,
    /failed to move to new namespace/i,
    /sandbox_linux\.cc/i,
    /namespace sandbox/i
]

const _ReadKernelFlag = (path) => {
    try {
        return fs.readFileSync(path, "utf8").trim()
    } catch (error) {
        // Ausente = esta distro não tem o mecanismo; não é sinal de bloqueio.
        return null
    }
}

/* O helper SUID: existe? está como o Chromium exige? O inode entra no retorno
   porque é ele que muda quando o Electron é reinstalado — é assim que o aviso
   ao usuário sabe que está diante de uma situação nova. */
const InspectSuidHelper = (electronBinaryPath) => {
    const path = join(dirname(String(electronBinaryPath || "")), "chrome-sandbox")
    try {
        const stats = fs.statSync(path)
        const isRootOwned  = stats.uid === 0
        const hasSetuidBit = Boolean(stats.mode & 0o4000)
        return { path, exists: true, inode: String(stats.ino), isRootOwned, hasSetuidBit, usable: isRootOwned && hasSetuidBit }
    } catch (error) {
        return { path, exists: false, inode: null, isRootOwned: false, hasSetuidBit: false, usable: false }
    }
}

const InspectNamespaceSupport = () => {
    for(const blocker of NAMESPACE_BLOCKERS){
        const value = _ReadKernelFlag(blocker.path)
        if(value !== null && blocker.blocked(value))
            return { available: false, reason: blocker.reason }
    }
    return { available: true, reason: null }
}

/* A decisão, usada pelas duas metades.

   `args` entra na linha de comando do Electron; `mode` é o que o aviso e o log
   reportam. `forceDisabled` é o retorno da rede de segurança: quem observou o
   abort pede a reabertura já sem sandbox. */
const ResolveSandboxLaunch = (electronBinaryPath, { forceDisabled = false } = {}) => {
    const helper = InspectSuidHelper(electronBinaryPath)

    // Só o Linux tem esta escolha: no macOS/Windows a sandbox do Chromium não
    // depende de setuid nem da política de namespaces do kernel.
    if(process.platform !== "linux")
        return { mode: "sandboxed", args: [], helper, namespace: { available: true, reason: null }, reason: "plataforma-nao-aplicavel" }

    if(forceDisabled)
        return { mode: "disabled", args: [DISABLE_SWITCH], helper, namespace: InspectNamespaceSupport(), reason: "abort-observado" }

    // O helper configurado resolve sozinho: com ele o Chromium nunca aborta,
    // mesmo com o namespace bloqueado. Nem vale ler o /proc.
    if(helper.usable)
        return { mode: "sandboxed", args: [], helper, namespace: null, reason: "suid-helper" }

    const namespace = InspectNamespaceSupport()
    if(namespace.available)
        return { mode: "sandboxed", args: [], helper, namespace, reason: "namespace" }

    return { mode: "disabled", args: [DISABLE_SWITCH], helper, namespace, reason: "sem-caminho-disponivel" }
}

const LooksLikeSandboxFailure = (text) => {
    const content = String(text || "")
    if(!content) return false
    return FAILURE_SIGNATURES.some((signature) => signature.test(content))
}

/* Os comandos que devolvem a sandbox. São dois porque o Chromium exige as duas
   coisas: dono root E o bit setuid. */
const RepairCommands = (helperPath) => [
    `sudo chown root:root ${helperPath}`,
    `sudo chmod 4755 ${helperPath}`
]

/* Este texto EXPLICA um problema — não pode, ele próprio, virar um segundo
   problema. Por isso o estado é lido com tolerância: um `state` incompleto (de
   uma versão anterior, de um env truncado) rende um aviso mais pobre, nunca uma
   exceção em cima de uma janela que já abriu degradada. */
const _HelperOf = (state) =>
    (state && state.helper) || { path: "(caminho desconhecido)", exists: false, inode: null, usable: false }

/* O texto que a pessoa lê — em um só lugar, porque ele aparece no log, no
   terminal e no diálogo da janela, e as três versões precisam dizer o mesmo. */
const DescribeSandboxNotice = (state) => {
    const helper    = _HelperOf(state)
    const namespace = state && state.namespace

    const causes = [
        namespace && !namespace.available ? namespace.reason : null,
        !helper.exists
            ? `o auxiliar de sandbox não foi encontrado (${helper.path})`
            : !helper.usable
                ? `o auxiliar ${helper.path} não está com dono root e bit setuid (modo 4755)`
                : null
    ].filter(Boolean)

    return {
        title  : "Esta janela abriu sem a sandbox de segurança",
        summary: "O Chromium isola o conteúdo que exibe em processos com privilégio reduzido. Nesta máquina nenhum dos dois caminhos de isolamento está disponível, então a janela foi aberta sem essa proteção — a alternativa seria não abrir.",
        causes,
        risk   : "O que muda: uma falha de segurança no conteúdo exibido deixa de ficar contida no processo da janela e passa a valer o que a sua conta de usuário pode fazer — seus arquivos, sua rede, suas credenciais. O risco é maior nas janelas que carregam endereços da internet do que nas que só exibem conteúdo local.",
        repair : RepairCommands(helper.path),
        footer : "Depois de rodar os comandos, feche e abra a janela. É preciso repetir a cada atualização do Electron, porque a instalação refaz o arquivo como usuário comum."
    }
}

/* O mesmo aviso como bloco de texto, para o log e para o terminal. */
const FormatSandboxWarning = (state) => {
    const notice = DescribeSandboxNotice(state)
    return [
        notice.title.toUpperCase(),
        notice.summary,
        ...notice.causes.map((cause) => `  - ${cause}`),
        notice.risk,
        "Para restaurar a sandbox:",
        ...notice.repair.map((command) => `  ${command}`),
        notice.footer
    ].join("\n")
}

/* AVISAR SEM VIRAR RUÍDO. Um alerta que reaparece a cada abertura deixa de ser
   lido — e um que aparece só uma vez esconde que a situação mudou. O meio
   termo: reaparece quando a MÁQUINA muda (outro kernel, outra instalação do
   Electron, outro motivo), e cala de vez se a pessoa pedir. */
const _NoticeFilePath = () =>
    join(process.env.XDG_CONFIG_HOME || join(os.homedir(), ".config"), "meta-platform", "sandbox-notice.json")

const NoticeSignature = (state) => {
    const helper = _HelperOf(state)
    return [os.release(), helper.path, helper.inode || "-", state && state.reason].join("|")
}

const _ReadNoticeRecord = () => {
    try {
        return JSON.parse(fs.readFileSync(_NoticeFilePath(), "utf8"))
    } catch (error) {
        return { signature: null, silenced: false }
    }
}

const ShouldAnnounceNotice = (state) => {
    const record = _ReadNoticeRecord()
    if(record.silenced) return false
    return record.signature !== NoticeSignature(state)
}

const RememberNoticeAnnounced = (state, { silenced = false } = {}) => {
    try {
        const filePath = _NoticeFilePath()
        fs.mkdirSync(dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, JSON.stringify({
            signature: NoticeSignature(state),
            silenced,
            updatedAt: new Date().toISOString()
        }, null, 4), "utf8")
    } catch (error) {
        /* Não conseguir lembrar só custa avisar de novo — nunca a janela. */
    }
}

module.exports = {
    ResolveSandboxLaunch,
    InspectSuidHelper,
    InspectNamespaceSupport,
    LooksLikeSandboxFailure,
    DescribeSandboxNotice,
    FormatSandboxWarning,
    RepairCommands,
    ShouldAnnounceNotice,
    RememberNoticeAnnounced,
    DISABLE_SWITCH
}
