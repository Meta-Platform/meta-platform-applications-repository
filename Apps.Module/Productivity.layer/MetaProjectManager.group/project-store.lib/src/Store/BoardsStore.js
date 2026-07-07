const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { DEFAULT_COLUMNS } = require("../Config")

const BoardsStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { Board, BoardColumn } = models

    const ResolveBoard = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de board é obrigatória.", { field: "board" })
        const board = await Board.findOne({ where: { id: ref, deletedAt: null } })
        if(!board) throw new DomainError("NOT_FOUND", `Board "${ref}" não encontrado.`, { ref })
        return board
    }

    const _createDefaultColumns = async (boardId) => {
        let order = 0
        for(const col of DEFAULT_COLUMNS){
            await BoardColumn.create({ id: NewId(), boardId, ...col, order: order++ })
        }
    }

    const CreateBoard = async ({ project, name, description, type = "kanban", withDefaultColumns = true, setDefault, actor } = {}) => {
        if(!name) throw new DomainError("VALIDATION_ERROR", "Nome do board é obrigatório.", { field: "name" })
        const projectInstance = await store.ResolveProject(project)

        // Gate: criação de board por agente exige aprovação humana (vira pedido pendente).
        if(store.IsAgentCreation(actor)){
            const { request } = await store.RequestCreation({ type: "board", projectId: projectInstance.id, payload: { project: projectInstance.id, name, description, type, withDefaultColumns, setDefault }, actor })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Criação de board por agente requer aprovação humana.",
                { pendingCreationId: request.id, type: "board", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        const board = await Board.create({ id: NewId(), projectId: projectInstance.id, name, description, type })
        if(withDefaultColumns) await _createDefaultColumns(board.id)
        const isFirst = (await Board.count({ where: { projectId: projectInstance.id, deletedAt: null } })) === 1
        if(setDefault || isFirst) await projectInstance.update({ defaultBoardId: board.id })
        const data = Serialize(board)
        await writeAudit({ projectId: projectInstance.id, entityType: "board", entityId: board.id, action: "create", actor, metadata: { name } })
        emit("board.updated", data)
        return data
    }

    const ListBoards = async ({ project } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const rows = await Board.findAll({ where: { projectId: projectInstance.id, deletedAt: null }, order: [["createdAt", "ASC"]] })
        return SerializeMany(rows)
    }

    const GetBoard = async ({ board } = {}) => {
        const instance = await ResolveBoard(board)
        const columns = await ListColumns({ board: instance.id })
        return { ...Serialize(instance), columns }
    }

    const UpdateBoard = async ({ board, actor, ...fields } = {}) => {
        const instance = await ResolveBoard(board)
        const patch = {}
        for(const key of ["name", "description", "type"]) if(fields[key] !== undefined) patch[key] = fields[key]
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "board", entityId: instance.id, action: "update", actor, metadata: patch })
        emit("board.updated", data)
        return data
    }

    const DuplicateBoard = async ({ board, name, actor } = {}) => {
        const src = await ResolveBoard(board)
        const copy = await Board.create({ id: NewId(), projectId: src.projectId, name: name || `${src.name} (cópia)`, description: src.description, type: src.type })
        const columns = await BoardColumn.findAll({ where: { boardId: src.id }, order: [["order", "ASC"]] })
        for(const col of columns){
            await BoardColumn.create({ id: NewId(), boardId: copy.id, name: col.name, statusKey: col.statusKey, color: col.color, order: col.order, wipLimit: col.wipLimit, isDoneColumn: col.isDoneColumn })
        }
        const data = Serialize(copy)
        await writeAudit({ projectId: src.projectId, entityType: "board", entityId: copy.id, action: "duplicate", actor, metadata: { from: src.id } })
        emit("board.updated", data)
        return data
    }

    const DeleteBoard = async ({ board, actor } = {}) => {
        const instance = await ResolveBoard(board)
        await instance.update({ deletedAt: new Date() })
        await writeAudit({ projectId: instance.projectId, entityType: "board", entityId: instance.id, action: "delete", actor })
        emit("board.updated", { id: instance.id, deleted: true })
        return { id: instance.id, deleted: true }
    }

    const SetDefaultBoard = async ({ board, actor } = {}) => {
        const instance = await ResolveBoard(board)
        const projectInstance = await store.ResolveProject(instance.projectId)
        await projectInstance.update({ defaultBoardId: instance.id })
        await writeAudit({ projectId: instance.projectId, entityType: "board", entityId: instance.id, action: "set-default", actor })
        return { id: instance.id, isDefault: true }
    }

    // -------- Colunas --------
    const ListColumns = async ({ board } = {}) => {
        const instance = await ResolveBoard(board)
        const rows = await BoardColumn.findAll({ where: { boardId: instance.id }, order: [["order", "ASC"]] })
        return SerializeMany(rows)
    }

    const AddColumn = async ({ board, name, statusKey, color, wipLimit, isDoneColumn = false, actor } = {}) => {
        const instance = await ResolveBoard(board)
        if(!name) throw new DomainError("VALIDATION_ERROR", "Nome da coluna é obrigatório.", { field: "name" })
        const key = statusKey || require("../Utils/helpers").Slugify(name)
        const order = await BoardColumn.count({ where: { boardId: instance.id } })
        const column = await BoardColumn.create({ id: NewId(), boardId: instance.id, name, statusKey: key, color, wipLimit, isDoneColumn, order })
        const data = Serialize(column)
        await writeAudit({ projectId: instance.projectId, entityType: "board-column", entityId: column.id, action: "create", actor, metadata: { name, statusKey: key } })
        emit("board.updated", { boardId: instance.id })
        return data
    }

    const UpdateColumn = async ({ column, actor, ...fields } = {}) => {
        const instance = await BoardColumn.findOne({ where: { id: column } })
        if(!instance) throw new DomainError("NOT_FOUND", `Coluna "${column}" não encontrada.`, { ref: column })
        const patch = {}
        for(const key of ["name", "statusKey", "color", "wipLimit", "isDoneColumn"]) if(fields[key] !== undefined) patch[key] = fields[key]
        await instance.update(patch)
        emit("board.updated", { boardId: instance.boardId })
        return Serialize(instance)
    }

    const MoveColumn = async ({ column, order, actor } = {}) => {
        const instance = await BoardColumn.findOne({ where: { id: column } })
        if(!instance) throw new DomainError("NOT_FOUND", `Coluna "${column}" não encontrada.`, { ref: column })
        // Remove a coluna da sequência e a reinsere na posição alvo, renumerando tudo.
        const columns = (await BoardColumn.findAll({ where: { boardId: instance.boardId }, order: [["order", "ASC"], ["createdAt", "ASC"]] }))
            .filter((col) => col.id !== instance.id)
        const target = Math.max(0, Math.min(Number(order), columns.length))
        columns.splice(target, 0, instance)
        for(let i = 0; i < columns.length; i++) await columns[i].update({ order: i })
        emit("board.updated", { boardId: instance.boardId })
        return Serialize(await instance.reload())
    }

    const DeleteColumn = async ({ column, actor } = {}) => {
        const instance = await BoardColumn.findOne({ where: { id: column } })
        if(!instance) throw new DomainError("NOT_FOUND", `Coluna "${column}" não encontrada.`, { ref: column })
        await instance.destroy()
        emit("board.updated", { boardId: instance.boardId })
        return { id: column, deleted: true }
    }

    return {
        ResolveBoard,
        CreateBoard, ListBoards, GetBoard, UpdateBoard, DuplicateBoard, DeleteBoard, SetDefaultBoard,
        ListColumns, AddColumn, UpdateColumn, MoveColumn, DeleteColumn
    }
}

module.exports = BoardsStore
