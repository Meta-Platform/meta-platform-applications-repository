// Stub do query-string (pacote ESM puro): os testes não montam URLs de servidor.
export const stringify = (obj:any) =>
    Object.keys(obj || {}).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`).join("&")
export const parse = () => ({})
export default { stringify, parse }
