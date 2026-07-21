// Handler de bases relacionais (Sequelize). É o "motor" do gerenciador de BD:
// navegação (tabelas/colunas/índices), consulta (SELECT paginado + SQL livre),
// CRUD de linhas e DDL (criar/alterar/dropar tabela e colunas).
//
// Acessa a connection Sequelize através do ORM service (GetORMSourceByKeystone →
// EnsureConnection/GetConnection/GetQueryInterface). As DataTypes vêm da própria
// connection (connection.constructor.DataTypes) para não acoplar o pacote da
// webservice à dependência `sequelize`.
const RelacionalDatabaseHandlerController = (params) => {

    const { dataSourceLocalService } = params

    const _GetSource = (keystone) => {
        const source = dataSourceLocalService.GetORMSourceByKeystone(keystone)
        if(!source)
            throw new Error(`Fonte relacional não encontrada para o keystone: ${keystone}`)
        return source
    }

    // Conexão autenticada + query interface prontos para uso.
    const _Ctx = async (keystone) => {
        const source     = _GetSource(keystone)
        const connection = await source.EnsureConnection()
        return { connection, qi: connection.getQueryInterface() }
    }

    // Quoting de identificadores conforme o dialeto (defesa contra SQL injection
    // em nomes de tabela/coluna que compomos manualmente no SELECT).
    const _Quote = (connection, id) => {
        const qg = connection.getQueryInterface().queryGenerator
        if(qg && typeof qg.quoteIdentifier === "function")
            return qg.quoteIdentifier(id)
        const dialect = connection.getDialect()
        if(dialect === "mysql" || dialect === "mariadb")
            return "`" + String(id).replace(/`/g, "``") + "`"
        return '"' + String(id).replace(/"/g, '""') + '"'
    }

    const _MapType = (connection, typeStr) => {
        const DT  = connection.constructor.DataTypes
        const key = String(typeStr || "STRING").toUpperCase().replace(/\(.*\)/, "").trim()
        const map = {
            INT: DT.INTEGER, INTEGER: DT.INTEGER, BIGINT: DT.BIGINT,
            FLOAT: DT.FLOAT, REAL: DT.REAL, DOUBLE: DT.DOUBLE,
            DECIMAL: DT.DECIMAL, NUMERIC: DT.DECIMAL,
            STRING: DT.STRING, VARCHAR: DT.STRING, CHAR: DT.STRING,
            TEXT: DT.TEXT, BOOLEAN: DT.BOOLEAN, BOOL: DT.BOOLEAN,
            DATE: DT.DATE, DATETIME: DT.DATE, DATEONLY: DT.DATEONLY,
            TIME: DT.TIME, BLOB: DT.BLOB, JSON: DT.JSON, UUID: DT.UUID
        }
        return map[key] || DT.STRING
    }

    const _BuildAttribute = (connection, column) => {
        const attr = {
            type: _MapType(connection, column.type),
            allowNull: column.allowNull !== false
        }
        if(column.primaryKey)    attr.primaryKey    = true
        if(column.autoIncrement) attr.autoIncrement = true
        if(column.unique)        attr.unique        = true
        if(column.defaultValue !== undefined && column.defaultValue !== null && column.defaultValue !== "")
            attr.defaultValue = column.defaultValue
        return attr
    }

    // --- Navegação -----------------------------------------------------------

    const _ShowAllTableName = ({ keystone }) =>
        _Ctx(keystone).then(async ({ qi }) => {
            const tables = await qi.showAllTables()
            return tables.map((t) => (typeof t === "string" ? t : (t.tableName || Object.values(t)[0])))
        })

    const _DescribeTable = ({ keystone, tableName }) =>
        _Ctx(keystone).then(async ({ qi }) => {
            const desc = await qi.describeTable(tableName)
            return Object.keys(desc).map((name) => ({ name, ...desc[name] }))
        })

    const _ShowTableIndexes = ({ keystone, tableName }) =>
        _Ctx(keystone).then(({ qi }) => qi.showIndex(tableName))

    // --- Consulta ------------------------------------------------------------

    const _CountRows = ({ keystone, tableName }) =>
        _Ctx(keystone).then(async ({ connection }) => {
            const sql  = `SELECT COUNT(*) AS count FROM ${_Quote(connection, tableName)}`
            const rows = await connection.query(sql, { type: "SELECT" })
            return Number((rows[0] || {}).count || 0)
        })

    const _SelectRows = ({ keystone, tableName, limit, offset, orderBy, orderDir }) =>
        _Ctx(keystone).then(async ({ connection, qi }) => {
            const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000)
            const off = Math.max(parseInt(offset, 10) || 0, 0)

            const desc    = await qi.describeTable(tableName)
            const columns = Object.keys(desc)

            let sql = `SELECT * FROM ${_Quote(connection, tableName)}`
            if(orderBy && columns.includes(orderBy)){
                const dir = String(orderDir).toUpperCase() === "DESC" ? "DESC" : "ASC"
                sql += ` ORDER BY ${_Quote(connection, orderBy)} ${dir}`
            }
            sql += ` LIMIT ${lim} OFFSET ${off}`

            const rows  = await connection.query(sql, { type: "SELECT" })
            const total = await _CountRows({ keystone, tableName })

            return { rows, columns, total, limit: lim, offset: off }
        })

    // Executa SQL arbitrário. SELECT/PRAGMA/WITH/EXPLAIN retornam linhas;
    // demais (INSERT/UPDATE/DELETE/DDL) retornam metadados.
    const _RunSQL = ({ keystone, sql }) =>
        _Ctx(keystone).then(async ({ connection }) => {
            const trimmed  = String(sql || "").trim()
            const isSelect = /^(select|pragma|with|explain)\b/i.test(trimmed)
            if(isSelect){
                const rows    = await connection.query(trimmed, { type: "SELECT" })
                const columns = rows.length ? Object.keys(rows[0]) : []
                return { kind: "select", rows, columns, rowCount: rows.length }
            }
            const [results, metadata] = await connection.query(trimmed)
            return { kind: "write", results, metadata }
        })

    // --- CRUD de linhas ------------------------------------------------------

    const _InsertRow = ({ keystone, tableName, values }) =>
        _Ctx(keystone).then(async ({ qi }) => {
            await qi.bulkInsert(tableName, [values])
            return { inserted: 1 }
        })

    const _UpdateRow = ({ keystone, tableName, values, where }) =>
        _Ctx(keystone).then(async ({ qi }) => {
            await qi.bulkUpdate(tableName, values, where)
            return { updated: true }
        })

    const _DeleteRow = ({ keystone, tableName, where }) =>
        _Ctx(keystone).then(async ({ qi }) => {
            await qi.bulkDelete(tableName, where)
            return { deleted: true }
        })

    // --- DDL -----------------------------------------------------------------

    const _CreateTable = ({ keystone, tableName, columns }) =>
        _Ctx(keystone).then(async ({ connection, qi }) => {
            const attributes = {}
            ;(columns || []).forEach((c) => { attributes[c.name] = _BuildAttribute(connection, c) })
            await qi.createTable(tableName, attributes)
            return { created: tableName }
        })

    const _DropTable = ({ keystone, tableName }) =>
        _Ctx(keystone).then(async ({ qi }) => {
            await qi.dropTable(tableName)
            return { dropped: tableName }
        })

    const _AddColumn = ({ keystone, tableName, column }) =>
        _Ctx(keystone).then(async ({ connection, qi }) => {
            await qi.addColumn(tableName, column.name, _BuildAttribute(connection, column))
            return { added: column.name }
        })

    const _RemoveColumn = ({ keystone, tableName, columnName }) =>
        _Ctx(keystone).then(async ({ qi }) => {
            await qi.removeColumn(tableName, columnName)
            return { removed: columnName }
        })

    const controllerServiceObject = {
        controllerName: "RelacionalDatabaseHandlerController",
        ShowAllTableName: _ShowAllTableName,
        DescribeTable: _DescribeTable,
        ShowTableIndexes: _ShowTableIndexes,
        CountRows: _CountRows,
        SelectRows: _SelectRows,
        RunSQL: _RunSQL,
        InsertRow: _InsertRow,
        UpdateRow: _UpdateRow,
        DeleteRow: _DeleteRow,
        CreateTable: _CreateTable,
        DropTable: _DropTable,
        AddColumn: _AddColumn,
        RemoveColumn: _RemoveColumn
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = RelacionalDatabaseHandlerController
