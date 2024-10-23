const Sequelize = require("sequelize")
const crypto    = require("crypto")

const ORMService = (params) => {


    const {
        name, 
        type, 
        dialect, 
        host, 
        port, 
        database, 
        username, 
        password 
    } = params

    let keystone, status, connection, message

    const _Init = () => {
        try{

            keystone  = crypto.createHash("md5")
                .update(name + type + database + dialect + host + port + username)
                .digest("hex")

            connection = new Sequelize(database, username, password, {
                dialect,
                port,
                host,
                logging: false
            })
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

    const _GetInfo = () => {

        return {
            keystone,
            type,
            name,
            status,
            message,
            database,
            dialect,
            host,
            port,
            username
        }
    }

    _Init()
    return {
        GetInfo:_GetInfo,
        GetName: () => name,
        GetKeystone: () => keystone,
        GetType: () => type
    }

}

module.exports = ORMService