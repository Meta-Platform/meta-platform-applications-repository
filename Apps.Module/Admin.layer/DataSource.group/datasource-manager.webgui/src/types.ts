
declare module "*.svg"

type SourceType = {
	keystone ?: string
	name      : string
	status    : string
	type      : string
	filename ?: string
	dialect  ?: string
	message  ?: string
}

type FieldDescriptionType = {
    columnName    : String
    type          : String
    allowNull     : Boolean
    defaultValue  : any
    primaryKey    : Boolean
    autoIncrement : Boolean
    comment       : String
}