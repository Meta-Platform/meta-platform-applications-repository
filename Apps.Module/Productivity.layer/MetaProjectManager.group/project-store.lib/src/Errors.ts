// Erro de domínio com código estável (consumido pela CLI e pelo webservice).
class DomainError extends Error {
    // `declare` porque o campo já é criado pela atribuição do construtor: aqui só
    // se anuncia o que ele carrega, sem acrescentar nada ao que roda.
    declare code: any
    declare details: any
    constructor(code: any, message: any, details?: any){
        super(message)
        this.name = "DomainError"
        this.code = code
        this.details = details
    }
    toResponse(){
        return { ok: false, code: this.code, message: this.message, details: this.details }
    }
}

// HTTP status sugerido por código (usado pelo webservice).
const HTTP_STATUS_BY_CODE = {
    VALIDATION_ERROR: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    AGENT_SESSION_CONFIRMATION_REQUIRED: 409,
    FORBIDDEN: 403,
    // Projeto arquivado é somente leitura: qualquer escrita é recusada.
    PROJECT_ARCHIVED: 403
}

module.exports = { DomainError, HTTP_STATUS_BY_CODE }
