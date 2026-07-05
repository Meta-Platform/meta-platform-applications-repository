# api-designer-gui.service

Serviço especializado em **servir a GUI** (`api-designer.webgui`) da aplicação
Electron **sem webservices HTTP** (modo *GUI-host* — ver
`desktop-window-instance.lib`).

**Compõe** o controller já existente do `api-designer.webservice` (`APIDesigner`),
requerido via o handle do pacote (`apiDesignerWebservice.require(...)`). A lógica
de negócio permanece única na webservice (dual-transport). Expõe `Invoke` e
`GetManifest`; o `Invoke` espelha o contrato de invocação do servidor HTTP
(0 params → `method()`; 1 → `method(valor)`; 2+ → `method(objeto)`), então é um
drop-in transparente do webservice. Sem ícones (`GetIcon` não é necessário).

Bound-params: `apiAuthoringLib`, `apiDesignerWebservice` (handles) + param `apisDir`.
