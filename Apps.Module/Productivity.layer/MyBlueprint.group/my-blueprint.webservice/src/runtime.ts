const path = require("path")
const Expand = (value: any) => path.resolve(String(value || "~/virtual-desk-state/local-databases/my-blueprint.sqlite").replace(/^~(?=$|\/)/, process.env.HOME || ""))
const GetStore = async ({ blueprintStoreLib, dbFilePath }: any) => {
  const lib = blueprintStoreLib && (blueprintStoreLib.require ? blueprintStoreLib.require(".") : blueprintStoreLib)
  const InitializeBlueprintStore = lib.InitializeBlueprintStore || require("../../blueprint-store.lib/src").InitializeBlueprintStore
  return InitializeBlueprintStore({ storage: Expand(dbFilePath) })
}
module.exports = { GetStore, Expand }
