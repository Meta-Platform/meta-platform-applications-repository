const path = require("path")
const Expand = (value) => path.resolve(String(value || "~/virtual-desk-state/local-databases/my-blueprint.sqlite").replace(/^~(?=$|\/)/, process.env.HOME || ""))
const GetStore = async ({ blueprintStoreLib, dbFilePath }) => {
  const lib = blueprintStoreLib && (blueprintStoreLib.require ? blueprintStoreLib.require(".") : blueprintStoreLib)
  const InitializeBlueprintStore = lib.InitializeBlueprintStore || require("../../blueprint-store.lib/src").InitializeBlueprintStore
  return InitializeBlueprintStore({ storage: Expand(dbFilePath) })
}
module.exports = { GetStore, Expand }
