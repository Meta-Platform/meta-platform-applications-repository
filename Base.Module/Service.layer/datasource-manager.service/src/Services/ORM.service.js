const Sequelize = require("sequelize")
const crypto    = require("crypto")

// Envolve uma conexão Sequelize para uma fonte "relational-database".
// Suporta os dialetos do Sequelize; o foco atual é SQLite (dialect "sqlite" +
// storage = caminho do arquivo .sqlite). Para os demais dialetos usa a
// assinatura de rede (host/port/database/username/password).
//
// IMPORTANTE: além dos getters de metadados, ESTE service EXPÕE a connection
// (GetConnection/GetQueryInterface/EnsureConnection). O RelacionalDatabaseHandler
// depende disso — antes o objeto retornado não expunha a connection e o handler
// quebrava.
const ORMService = (params) => {

    const {
        name,
        type,
        dialect
    } = params

    let keystone, status, connection, message

    const _IsSqlite = () => dialect === "sqlite"

    const _BuildConnection = () => {
        if(_IsSqlite()){
            // SQLite ignora host/port/username/password; usa storage (arquivo).
            return new Sequelize({
                dialect: "sqlite",
                storage: params.storage,
                logging: false
            })
        }

        const { host, port, database, username, password } = params
        return new Sequelize(database, username, password, {
            dialect,
            port,
            host,
            logging: false
        })
    }

    // O keystone identifica unicamente a fonte. Para SQLite o discriminador é o
    // caminho do arquivo (storage); para rede é database+host+port+username.
    const _KeystoneSeed = () => _IsSqlite()
        ? [name, type, dialect, params.storage].join("|")
        : [name, type, params.database, dialect, params.host, params.port, params.username].join("|")

    const _Init = () => {
        try{
            keystone = crypto.createHash("md5").update(_KeystoneSeed()).digest("hex")
            connection = _BuildConnection()
            status = "WAITING"
            _Authenticate()
        }catch(e){
            status = "ERROR"
            message = e.message
        }
    }

    const _Authenticate = async() => {
        try{
            await connection.authenticate()
            status = "READY"
        }catch(e){
            status = "ERROR"
            message = e.message
        }
    }

    // Garante uma connection autenticada antes de operar. _Authenticate roda em
    // background no boot; se ainda estiver WAITING/ERROR, tenta reautenticar.
    const _EnsureConnection = async() => {
        if(!connection)
            throw new Error(message || "connection não inicializada")
        if(status !== "READY")
            await _Authenticate()
        if(status !== "READY")
            throw new Error(message || "connection indisponível")
        return connection
    }

    const _GetInfo = () => ({
        keystone,
        type,
        name,
        status,
        message,
        dialect,
        ...( _IsSqlite()
            ? { storage: params.storage }
            : {
                database: params.database,
                host: params.host,
                port: params.port,
                username: params.username
            })
    })

    _Init()

    return {
        GetInfo: _GetInfo,
        GetName: () => name,
        GetKeystone: () => keystone,
        GetType: () => type,
        GetDialect: () => dialect,
        GetConnection: () => connection,
        EnsureConnection: _EnsureConnection,
        GetQueryInterface: () => connection.getQueryInterface()
    }

}

module.exports = ORMService
