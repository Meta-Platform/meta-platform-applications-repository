/*
    Resolvedor para o runner de teste do Node.

    O código-fonte importa como o webpack espera — `"../Actions/User.actions"`,
    sem extensão. O ESM do Node exige o caminho completo, então qualquer módulo
    que tenha um import relativo assim é IMPOSSÍVEL de testar direto: o teste
    morre em ERR_MODULE_NOT_FOUND antes da primeira asserção.

    Pôr `.ts` nos imports do código resolveria para o Node e quebraria o build:
    o TypeScript recusa extensão `.ts` em import sem `allowImportingTsExtensions`,
    e o tsconfig aqui é `module: commonjs`. Ou seja, a correção não pode ser no
    código de produção — tem que ser no runner.

    Este hook só entra em ação quando a resolução normal FALHA, e só para
    caminho relativo: tenta de novo acrescentando `.ts`. Não muda a semântica de
    nada que já resolve.

    Só `.ts`, e não `.tsx`, de propósito: o apagamento de tipos do Node recusa
    JSX (`ERR_UNKNOWN_FILE_EXTENSION` para `.tsx`), então acrescentar o
    candidato só trocaria uma mensagem de erro por outra. Neste package os 22
    componentes `.tsx` são intestáveis por este runner — o que dá para testar
    por aqui é lógica pura em `.ts`. Cobrir componente exigiria ts-jest, como
    fazem o `meta-project-manager.webgui` e o `package-developer.webgui`.
*/
export async function resolve(specifier, context, nextResolve) {
    try {
        return await nextResolve(specifier, context)
    } catch (error) {
        const ehRelativo = specifier.startsWith("./") || specifier.startsWith("../")
        const jaTemExtensao = /\.[cm]?[jt]sx?$/.test(specifier)

        if (ehRelativo && !jaTemExtensao) {
            return nextResolve(`${specifier}.ts`, context)
        }

        throw error
    }
}
