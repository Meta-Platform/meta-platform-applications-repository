const Sequelize = require("sequelize") as any

module.exports = async ( {
    dialect,
    host,
    port,
    database,
    username,
    password
}: any) => {
    const connection = new Sequelize(database, 
        username, 
        password, {
            dialect,
            port,
            host,
            logging: true
    })

    
    await connection.authenticate()

    return connection
}