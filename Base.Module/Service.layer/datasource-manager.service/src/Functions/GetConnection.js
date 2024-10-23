const Sequelize = require("sequelize")

module.exports = async ( {
    dialect,
    host,
    port,
    database,
    username,
    password
}) => {
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