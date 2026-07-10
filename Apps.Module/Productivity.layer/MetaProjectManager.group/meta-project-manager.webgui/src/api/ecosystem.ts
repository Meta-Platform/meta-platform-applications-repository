import { Caller } from "./client"
import { EcosystemPackage, ItemPackage, ListPackagesQuery, ItemPackageInput } from "./types"

// Catálogo de pacotes da Meta Platform e o vínculo item ↔ pacotes.
const CreateEcosystemApi = (call: Caller) => ({
    listPackages: (query: ListPackagesQuery = {}): Promise<EcosystemPackage[]> =>
        call("Ecosystem", "ListPackages", query),

    getPackage: (packageRef: string): Promise<EcosystemPackage> =>
        call("Ecosystem", "GetPackage", { packageRef }),

    // Relê o disco: só sob demanda (é a única operação cara).
    index: (): Promise<{ repositories: string[]; indexed: number; markedMissing: number }> =>
        call("Ecosystem", "IndexPackages", {}),

    listItemPackages: (itemId: string): Promise<ItemPackage[]> =>
        call("Ecosystem", "ListItemPackages", { itemId }),

    setItemPackages: (itemId: string, packages: ItemPackageInput[]): Promise<ItemPackage[]> =>
        call("Ecosystem", "SetItemPackages", { itemId, packages })
})

export default CreateEcosystemApi
