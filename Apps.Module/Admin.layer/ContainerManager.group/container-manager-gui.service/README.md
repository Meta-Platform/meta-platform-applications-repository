# container-manager-gui.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/container-manager-gui.service`

## Propósito

Serve a interface do Container Manager quando ela roda **sem HTTP**, dentro do
Electron (modo GUI-host). Compõe os controllers do
`@/container-manager.webservice` e os expõe por `Invoke(api, método, dados)`.

Zero duplicação de lógica: os controllers são os mesmos do webservice, e os
`.api.json` são o manifesto compartilhado. `Invoke` espelha exatamente o
contrato de invocação do servidor HTTP — nenhum parâmetro (`method()`), um
parâmetro (`method(valor)`), dois ou mais (`method(objeto)`) —, e é isso que
faz o IPC ser um substituto direto do HTTP para a mesma webgui.

## Serviço exposto (`metadata/services.json`)

| Namespace | Path | Dependências |
|-----------|------|--------------|
| `ContainerManagerGuiService` | `Services/ContainerManagerGui.service` | `bound-params`: `containerRuntimeConnectionService`, `containerManagerWebservice` |
