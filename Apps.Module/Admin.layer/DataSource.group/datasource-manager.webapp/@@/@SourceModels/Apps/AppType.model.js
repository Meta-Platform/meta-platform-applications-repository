const { DataTypes } = require("sequelize")

module.exports = {
    modelName:"AppType",
    atributes:{
        Id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            unique: true 
        },
        Type:{
            type: DataTypes.STRING(45),
            allowNull: false
        },
    
    },
    options:{
        //tableName: "App_Type"
    },
    associations:({})=>{

    }
}
