const { DataTypes } = require("sequelize")

module.exports = {
    modelName:"SourceParameter",
    atributes:{
        Id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            unique: true 
        },
        Value:{
            type: DataTypes.STRING(45),
            allowNull: false
        }
    },
    options:{
        tableName: "Source_Parameter"
    },
    associations:({SourceParameter, ParameterType, Source})=>{
        SourceParameter.belongsTo(ParameterType, {foreignKey: {name:"Parameter_Type_Id", allowNull: false}})
        SourceParameter.belongsTo(Source, {foreignKey: {name:"Source_Id", allowNull: false}})
    }
}
