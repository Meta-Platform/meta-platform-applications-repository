# datasource-gui.service

Serviço especializado em **servir a GUI** (`datasource-manager.webgui`) da
aplicação Electron **sem webservices HTTP** (modo *GUI-host* — ver
`desktop-window-instance.lib`).

**Compõe** os controllers já existentes do `datasource-manager.webservice`
(`DataSources`, `FileSystemNavigator`, `DataStoreNavigator`,
`RelacionalDatabaseHandler`), requeridos via o handle do pacote. A lógica de
negócio permanece única na webservice (dual-transport). Expõe `Invoke` e
`GetManifest`; o `Invoke` espelha o contrato de invocação do servidor HTTP
(0 → `method()`; 1 → `method(valor)`; 2+ → `method(objeto)`). Sem ícones.

Bound-params: `dataSourceLocalService` (service instanciado),
`datasourceManagerWebservice` (handle).
