const { dirname, join } = require("path")

// Ponte para o cache de build do ecosystem-core.
//
// A implementação vivia aqui e servia só à janela desktop. Ela foi promovida
// para o `web-interface-builder.lib`, onde os dois caminhos que compilam
// interface — a janela e o endpoint HTTP — usam o mesmo código, com as mesmas
// regras de assinatura e a mesma CACHE_VERSION. Manter duas cópias significaria
// que um `release` gerado por um caminho poderia ser aceito pelo outro sob
// critérios diferentes.
//
// `applications` e `ecosystem-core` são atualizados de forma independente, então
// este arquivo continua existindo e degrada sozinho: se o core instalado ainda
// não tiver o BuildCache, o cache simplesmente não age e a janela recompila —
// que é o comportamento antigo, e é seguro.

const _ResolveFromCore = () => {
    const builderPath = process.env.META_WEB_INTERFACE_BUILDER_PATH
    if(!builderPath) return undefined
    try {
        return require(join(dirname(builderPath), "BuildCache"))
    } catch(e) {
        return undefined
    }
}

const core = _ResolveFromCore()

// Sem o core: nada é fresco, nada é assinado. O chamador entende isso como
// "precisa compilar".
const fallback = {
    CACHE_VERSION: 0,
    ComputeWebInterfaceFingerprint: () => null,
    ReadBuildManifest:  () => null,
    WriteBuildManifest: () => null,
    IsWebInterfaceFresh: () => false,
    PurgeStaleWebInterfaceAssets: () => []
}

module.exports = core || fallback
