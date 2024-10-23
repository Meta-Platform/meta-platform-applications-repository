
const { DataTypes } = require("sequelize")

module.exports = {
    modelName:"Workspace",
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
        Description:{
            type: DataTypes.STRING
        }
    },
    options:{
        tableName: "Workspace"
    },
    associations:({Workspace, Source})=> {
        Workspace.hasMany(Source, {foreignKey: {name:"Workspace_Id"}})
    }
}