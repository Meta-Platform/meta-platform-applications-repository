const path = require("path")
const { StartMcpServer } = require("../Server")
const { InitializeBlueprintStore } = require("../../../blueprint-store.lib/src")
const ServeCommand = async ({ args = {}, startupParams = {} }: { args?: any, startupParams?: any }) => {
  console.log = (...parts: any[]) => process.stderr.write(parts.join(" ") + "\n")
  const storage = path.resolve(String(startupParams.MB_DB_FILE_PATH || "~/virtual-desk-state/local-databases/my-blueprint.sqlite").replace(/^~(?=$|\/)/, process.env.HOME || ""))
  const actor = { provider: args.sessionProvider || process.env.MB_SESSION_PROVIDER || "other", model: args.sessionModel || process.env.MB_SESSION_MODEL || "unknown", traceId: args.sessionTrace || process.env.MB_SESSION_TRACE || `mcp-${process.pid}` }
  StartMcpServer({ store: await InitializeBlueprintStore({ storage }), actor })
  await new Promise(() => {})
}
module.exports = ServeCommand
