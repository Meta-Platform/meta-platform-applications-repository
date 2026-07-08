const os = require("os")
const path = require("path")

const { GetContext } = require("../AppContext")
const { Guard, idOf } = require("../Utils/respond")

// Controller System — export/import de projeto/board, app-state (memória da GUI)
// e informações do ambiente local (para o Guia de IA montar comandos prontos).
const SystemController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ExportProject = async (arg) => Guard(async () => { await ctx.ready; return store.ExportProject({ project: idOf(arg, "projectId") }) })
    const ExportBoard   = async (arg) => Guard(async () => { await ctx.ready; return store.ExportBoard({ board: idOf(arg, "boardId") }) })
    const ImportProject = async (p = {}) => Guard(async () => { await ctx.ready; return store.ImportProject({ data: p.data, actor: { source: "api" } }) })

    const GetAppState = async (arg) => Guard(async () => { await ctx.ready; const value = await store.GetAppState({ key: idOf(arg, "key") }); return { key: idOf(arg, "key"), value: value === undefined ? null : value } })
    const SetAppState = async (p = {}) => Guard(async () => { await ctx.ready; return store.SetAppState({ key: p.key, value: p.value }) })

    // Ambiente local: caminhos reais desta máquina para o Guia de IA gerar
    // comandos "copiar-e-colar" (executável MCP/CLI, config do Codex, DB).
    // O EcosystemData usa o padrão ~/EcosystemData; os campos são só rótulos
    // informativos (nenhuma decisão de domínio depende disso).
    const GetEnvironmentInfo = async () => Guard(async () => {
        const home = os.homedir()
        const execDir = path.join(home, "EcosystemData", "executables")
        let osUser; try { osUser = os.userInfo().username } catch (e) { osUser = undefined }
        let dbPath; try { dbPath = store.sequelize && store.sequelize.options && store.sequelize.options.storage } catch (e) { /* opcional */ }
        return {
            home,
            osUser,
            platform: process.platform,
            executablesDir: execDir,
            mcpExecutablePath: path.join(execDir, "meta-project-manager-mcp"),
            cliExecutablePath: path.join(execDir, "mpm"),
            codexConfigPath: path.join(home, ".codex", "config.toml"),
            dbPath
        }
    })

    return {
        controllerName: "SystemController",
        ExportProject, ExportBoard, ImportProject,
        GetAppState, SetAppState, GetEnvironmentInfo
    }
}

module.exports = SystemController
