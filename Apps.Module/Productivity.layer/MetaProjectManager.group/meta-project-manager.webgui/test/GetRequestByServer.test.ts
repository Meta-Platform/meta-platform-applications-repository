// Regressão do bug crítico (#12): quando os controllers do webservice são montados
// em url:"/", servicePath("/") + path("/projects") = "//projects" — e o axios trata
// "//" como protocol-relative, descartando o host. Este teste trava o fix (colapso
// de barras em GetRequestByServer): a URL deve ser "/projects", nunca "//projects".

const calls: any[] = []

// query-string é ESM-only; o jest não transforma node_modules. Mock simples
// (nem é usado nestes casos, que não têm query params).
jest.mock("query-string", () => ({
    __esModule: true,
    default: { stringify: (o: any) => new URLSearchParams(o).toString() },
    stringify: (o: any) => new URLSearchParams(o).toString()
}))

jest.mock("axios", () => ({
    __esModule: true,
    default: {
        create: (cfg: any) => new Proxy({}, {
            get: (_t, method: string) => (url: string, body: any) => {
                calls.push({ method, baseURL: cfg.baseURL, url, body })
                return Promise.resolve({ data: { ok: true, data: [] } })
            }
        })
    }
}))

import GetRequestByServer from "../src/Utils/GetRequestByServer"

const info = {
    list_web_servers_running: [{
        name: "App", port: "8894",
        listServices: [{
            serviceName: "ProjectsController", path: "/",
            apiTemplate: { endpoints: [
                { summary: "ListProjects", method: "GET", path: "/projects", parameters: [] },
                { summary: "GetProject", method: "GET", path: "/projects/:projectId", parameters: [{ name: "projectId", in: "path" }] }
            ] }
        }]
    }]
}

beforeEach(() => { calls.length = 0 })

test("controller montado em '/' não produz URL protocol-relative (//projects)", async () => {
    const api: any = GetRequestByServer(info)("App", "Projects")
    await api.ListProjects({})
    const c = calls.find((x) => x.method === "get")
    expect(c).toBeTruthy()
    expect(c.baseURL).toBe("http://localhost:8894")
    expect(c.url).toBe("/projects")
    expect(c.url.startsWith("//")).toBe(false)
})

test("path param é interpolado sem barra dupla", async () => {
    const api: any = GetRequestByServer(info)("App", "Projects")
    await api.GetProject({ projectId: "abc" })
    const c = calls.find((x) => x.method === "get")
    expect(c.url).toBe("/projects/abc")
})
