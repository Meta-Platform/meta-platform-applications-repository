
const { DataTypes } = require("sequelize")

module.exports = {
    modelName:"App",
    atributes:{
        Id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            unique: true 
        },
        Name:{
            type: DataTypes.STRING(45),
            allowNull: false,
            unique: true 
        },
        Path:{
            type: DataTypes.STRING(45)
        }
    },
    options:{
        //tableName: "App"
    },
    associations:({App, AppType})=>{
        App.belongsTo(AppType)
    }
}
