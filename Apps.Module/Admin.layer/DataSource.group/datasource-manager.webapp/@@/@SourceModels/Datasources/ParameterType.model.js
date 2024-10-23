const { DataTypes } = require("sequelize")

module.exports = {
    modelName:"ParameterType",
    atributes:{
        Id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            unique: true 
        },
        Name:{
            type: DataTypes.STRING(45),
            allowNull: false
        },
        Description:{
            type: DataTypes.STRING(45)
        }
    },
    options:{
        tableName: "Parameter_Type"
    },
    associations:({ParameterType, SourceParameter, SourceType})=>{
        ParameterType.hasMany(SourceParameter, {foreignKey: {name:"Parameter_Type_Id", allowNull: false}})
        ParameterType.belongsTo(SourceType, {foreignKey: {name:"Source_Type_Id", allowNull: false}})
    }
}