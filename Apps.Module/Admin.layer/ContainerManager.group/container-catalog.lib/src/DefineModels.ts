/*
    As tabelas do Container Manager (CTMG-64).

    O que este banco guarda é o que o RUNTIME NÃO GUARDA. O Docker sabe quais
    containers existem; ele não sabe que aquele Postgres nasceu da receita
    "postgres" com a senha X, nem que a imagem veio do registry privado da
    empresa em tal dia, nem que alguém podou 12 GB na terça.

    Duas regras de projeto:

    1. **O runtime é a verdade sobre o que existe.** Este banco nunca substitui
       uma listagem — ele acrescenta contexto. Se divergirem, o runtime ganha, e
       a reconciliação (CTMG-69) marca a diferença.

    2. **Todo id é UUID string e todo JSON mora em TEXT.** É o que permite ler o
       arquivo com sqlite3 na mão quando algo der errado, sem decodificador.

    Segredos NUNCA entram aqui em claro: passam pelo cofre (Crypto/
    LocalSecretBox.js) e o campo guarda a forma selada.
*/

const { DataTypes } = require("sequelize") as any

/*
    ATENÇÃO: cada atalho é uma FUNÇÃO, não um objeto.

    O Sequelize MUTA a definição de atributo que recebe — ele grava ali o
    `fieldName` resolvido. Reusar a mesma referência de objeto em vários campos
    faz todos herdarem o nome do último processado, e o `sync()` acaba criando
    índice sobre uma coluna que não existe:

        SQLITE_ERROR: no such column: connectionId
        CREATE INDEX ... ON `managed_services` (`connectionId`, `containerId`)

    Custou uma rodada de testes vermelhos para aparecer, e o erro não aponta
    para a causa em lugar nenhum. Devolver um objeto novo a cada chamada resolve.
*/
const Texto = () => ({ type: DataTypes.STRING, allowNull: true })
const TextoObrigatorio = () => ({ type: DataTypes.STRING, allowNull: false })
const Json = () => ({ type: DataTypes.TEXT, allowNull: true })
const TextoLongo = () => ({ type: DataTypes.TEXT, allowNull: true })
const Data = () => ({ type: DataTypes.DATE, allowNull: true })
const Booleano = (padrao = false) => ({
    type: DataTypes.BOOLEAN, allowNull: false, defaultValue: padrao
})

const DefineModels = (sequelize: any) => {

    const Id = () => ({
        id: { type: DataTypes.STRING, primaryKey: true }
    })

    /* ------------------------------------------------------------ receitas */

    const Recipe = sequelize.define("recipes", {
        ...Id(),
        slug: { type: DataTypes.STRING, allowNull: false, unique: true },
        name: TextoObrigatorio(),
        shortDescription: Texto(),
        category: Texto(),
        icon: Texto(),
        image: TextoObrigatorio(),
        defaultTag: Texto(),
        tagOptionsJson: Json(),
        parametersJson: Json(),
        specJson: Json(),
        healthcheckJson: Json(),
        credentialsJson: Json(),
        datasourceJson: Json(),
        readinessJson: Json(),
        documentationUrl: Texto(),
        /*
            `builtin` separa o que veio no app do que o usuário escreveu.
            `builtinVersion` é o que permite atualizar as curadas sem atropelar
            edição local (CTMG-108) — sem ele, ou nunca se atualiza nada, ou se
            apaga o trabalho de quem customizou.
        */
        builtin: Booleano(false),
        builtinVersion: Texto(),
        locallyModified: Booleano(false)
    }, { timestamps: true })

    /* -------------------------------------------------- serviços gerenciados */

    const ManagedService = sequelize.define("managed_services", {
        ...Id(),
        connectionId: TextoObrigatorio(),
        name: TextoObrigatorio(),
        recipeSlug: Texto(),
        recipeVersion: Texto(),
        containerId: Texto(),
        containerName: Texto(),
        networkName: Texto(),
        volumeNamesJson: Json(),
        valuesJson: Json(),
        specJson: Json(),
        /*
            `status` inclui "error" de propósito: quando a criação falha DEPOIS
            de o container existir, o serviço é gravado assim, com o log — em
            vez de sumir junto com a evidência (CTMG-111).
        */
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: "creating" },
        lastError: TextoLongo(),
        stackId: Texto(),
        stackServiceName: Texto()
    }, {
        timestamps: true,
        indexes: [
            { fields: ["connectionId", "containerId"] },
            { fields: ["connectionId", "name"] }
        ]
    })

    /* ---------------------------------------------------------- credenciais */

    const ServiceCredential = sequelize.define("service_credentials", {
        ...Id(),
        serviceId: TextoObrigatorio(),
        field: TextoObrigatorio(),
        // Em claro só o que não é segredo (usuário, banco). O resto vem selado.
        value: TextoLongo(),
        secret: Booleano(false),
        generated: Booleano(false)
    }, {
        timestamps: true,
        indexes: [{ fields: ["serviceId"] }]
    })

    /* ----------------------------------------------------------- registries */

    const Registry = sequelize.define("registries", {
        ...Id(),
        name: TextoObrigatorio(),
        serverAddress: TextoObrigatorio(),
        username: Texto(),
        // Sempre selado. Nunca devolvido em listagem (CTMG-88).
        passwordSealed: TextoLongo(),
        isDefault: Booleano(false),
        lastCheckedAt: Data(),
        lastCheckOk: { type: DataTypes.BOOLEAN, allowNull: true }
    }, { timestamps: true })

    /* --------------------------------------------------------- procedência */

    const ImageProvenance = sequelize.define("image_provenance", {
        ...Id(),
        connectionId: TextoObrigatorio(),
        imageId: TextoObrigatorio(),
        reference: Texto(),
        registry: Texto(),
        repository: Texto(),
        tag: Texto(),
        digest: Texto(),
        // pull | build | load | commit
        origin: TextoObrigatorio(),
        dockerfile: TextoLongo(),
        buildLog: TextoLongo(),
        // Última checagem de versão nova (CTMG-94).
        lastUpdateCheckAt: Data(),
        remoteDigest: Texto(),
        updateAvailable: { type: DataTypes.BOOLEAN, allowNull: true }
    }, {
        timestamps: true,
        indexes: [{ fields: ["connectionId", "imageId"] }]
    })

    const ContainerProvenance = sequelize.define("container_provenance", {
        ...Id(),
        connectionId: TextoObrigatorio(),
        containerId: TextoObrigatorio(),
        containerName: Texto(),
        // recipe | stack | manual | ecosystem | adopted
        origin: TextoObrigatorio(),
        recipeSlug: Texto(),
        serviceId: Texto(),
        stackId: Texto(),
        imageReference: Texto(),
        imageDigest: Texto(),
        specJson: Json(),
        createdBy: Texto()
    }, {
        timestamps: true,
        indexes: [{ fields: ["connectionId", "containerId"] }]
    })

    /* --------------------------------------------------------------- stacks */

    const Stack = sequelize.define("stacks", {
        ...Id(),
        name: { type: DataTypes.STRING, allowNull: false, unique: true },
        connectionId: TextoObrigatorio(),
        description: Texto(),
        directoryPath: Texto(),
        /*
            O hash do compose no disco. É o que permite perceber que alguém
            editou o arquivo por fora e PERGUNTAR o que fazer, em vez de
            sobrescrever calado (CTMG-122) — a diferença entre "o app usa
            compose" e "o app sequestrou meu compose".
        */
        composeHash: Texto(),
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: "created" }
    }, { timestamps: true })

    const StackService = sequelize.define("stack_services", {
        ...Id(),
        stackId: TextoObrigatorio(),
        name: TextoObrigatorio(),
        specJson: Json(),
        dependsOnJson: Json(),
        recipeSlug: Texto(),
        containerId: Texto(),
        order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
    }, {
        timestamps: true,
        indexes: [{ fields: ["stackId"] }]
    })

    /* ------------------------------------------------- estado e trilha */

    const AppState = sequelize.define("app_state", {
        key: { type: DataTypes.STRING, primaryKey: true },
        valueJson: Json()
    }, { timestamps: true })

    /*
        A trilha do que o APP fez — não do que aconteceu no runtime (isso são os
        eventos). Existe para responder "quem apagou aquele volume?" e "quanto
        a poda de terça liberou?", perguntas que nenhuma ferramenta gráfica
        pesquisada responde.
    */
    const ActivityLog = sequelize.define("activity_log", {
        ...Id(),
        at: { type: DataTypes.DATE, allowNull: false },
        connectionId: Texto(),
        action: TextoObrigatorio(),
        targetType: Texto(),
        targetId: Texto(),
        targetName: Texto(),
        result: { type: DataTypes.STRING, allowNull: false, defaultValue: "ok" },
        detailsJson: Json()
    }, {
        timestamps: false,
        indexes: [{ fields: ["at"] }, { fields: ["connectionId", "action"] }]
    })

    return {
        Recipe,
        ManagedService,
        ServiceCredential,
        Registry,
        ImageProvenance,
        ContainerProvenance,
        Stack,
        StackService,
        AppState,
        ActivityLog
    }
}

module.exports = DefineModels
