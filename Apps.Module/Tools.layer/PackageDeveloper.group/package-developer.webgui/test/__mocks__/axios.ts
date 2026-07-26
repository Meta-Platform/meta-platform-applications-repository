// Stub do axios: os testes não fazem HTTP — quem conversa com o webservice é
// mockado por teste (GetRequestByServer). O pacote publica ESM e não roda no
// ambiente do jest sem transform.
const noop = () => Promise.resolve({ data: undefined })

export default {
    get: noop,
    post: noop,
    put: noop,
    delete: noop,
    request: noop,
    create: () => ({ get: noop, post: noop, put: noop, delete: noop, request: noop })
}
