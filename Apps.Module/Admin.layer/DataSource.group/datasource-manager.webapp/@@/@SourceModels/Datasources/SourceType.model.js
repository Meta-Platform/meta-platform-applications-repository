
const { DataTypes } = require("sequelize")

module.exports = {
    modelName:"SourceType",
    atributes:{
        Id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            unique: true 
        },
        Type:{
            type: DataTypes.STRING(45),
            allowNull: false,
            unique: true 
        },
        Description:{
            type: DataTypes.STRING(45)
        }
    },
    options:{
        tableName: "Source_Type"
    },
    associations:({Source, SourceType})=>{
       SourceType.hasMany(Source, {foreignKey: {name:"Source_Type_Id", allowNull: false}})
    }
}