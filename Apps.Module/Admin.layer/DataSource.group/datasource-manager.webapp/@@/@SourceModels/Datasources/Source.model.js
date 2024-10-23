const { DataTypes } = require("sequelize")

module.exports = {
    modelName:"Source",
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
        }
    },
    options:{
        tableName: "Source"
    },
    associations:({Source, SourceType, Workspace})=>{
        Source.belongsTo(SourceType, {foreignKey: {name:"Source_Type_Id", allowNull: false}})
        Source.belongsTo(Workspace, {foreignKey: {name:"Workspace_Id"}})
    }
}
