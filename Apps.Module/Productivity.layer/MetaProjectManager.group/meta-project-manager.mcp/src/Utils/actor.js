const os = require("os")
const { execSync } = require("child_process")

// Best-effort: captura repositório/branch/commit do diretório atual.
const GitSnapshot = (cwd) => {
    const run = (cmd) => { try { return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() } catch(e){ return undefined } }
    return {
        repositoryUrl: run("git config --get remote.origin.url"),
        branchName: run("git rev-parse --abbrev-ref HEAD"),
        commitHash: run("git rev-parse --short HEAD")
    }
}

const Pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== "")

// Identidade da sessão do agente para o servidor MCP.
//
// Diferente da CLI (que recebe --session-* em CADA comando), aqui a identidade
// é definida UMA vez, no startup do servidor: 1 processo servidor MCP = 1 sessão
// de agente. Lê de argv (--session-provider/model/trace/...) e de variáveis de
// ambiente (MPM_SESSION_*), com env como fallback — é assim que clientes MCP
// (Claude Code, etc.) costumam injetar configuração ("env" no mcpServers).
//
// O ator é SEMPRE do tipo "agent": é o que ativa (a) o GATE de aprovação humana
// para criação de projeto/board/milestone/sprint e (b) a atribuição correta na
// auditoria. O SO/processo/git é capturado automaticamente (forense da sessão).
const BuildAgentActor = ({ args = {}, env = process.env } = {}) => {
    const cwd = process.cwd()
    return {
        source: "agent",
        session: {
            provider:          Pick(args.sessionProvider, env.MPM_SESSION_PROVIDER, "other"),
            model:             Pick(args.sessionModel, env.MPM_SESSION_MODEL),
            traceId:           Pick(args.sessionTrace, env.MPM_SESSION_TRACE, `mcp-${os.hostname()}-${process.pid}`),
            externalSessionId: Pick(args.sessionExternalId, env.MPM_SESSION_EXTERNAL_ID),
            agent:             Pick(args.sessionAgent, env.MPM_SESSION_AGENT),
            owner:             Pick(args.sessionOwner, env.MPM_SESSION_OWNER),
            sessionUrl:        Pick(args.sessionUrl, env.MPM_SESSION_URL),
            objective:         Pick(args.sessionObjective, env.MPM_SESSION_OBJECTIVE),
            agentVersion:      Pick(args.sessionVersion, env.MPM_SESSION_VERSION),
            host: os.hostname(),
            osUser: os.userInfo().username,
            pid: process.pid,
            workingDirectory: cwd,
            ...GitSnapshot(cwd)
        }
    }
}

module.exports = { BuildAgentActor, GitSnapshot }
