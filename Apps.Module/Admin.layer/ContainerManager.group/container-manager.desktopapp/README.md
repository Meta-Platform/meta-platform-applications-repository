# container-manager.desktopapp

- **Tipo:** aplicação de janela (`.desktopapp`)
- **Namespace:** `@/container-manager.desktopapp`
- **Executável:** `container-manager-desktop`

## Propósito

O Container Manager como janela do sistema, sem servidor HTTP. O Electron
hospeda os serviços no processo principal e a interface fala com eles por IPC
(modo **GUI-host**).

## Grafo de serviços (`gui-host.serviceGraph`)

```
containerRuntimeConnection  ← @/container-runtime-adapter.service · Managers/ContainerRuntimeConnection.manager
guiService                  ← @/container-manager-gui.service · Services/ContainerManagerGui.service
                              (recebe containerRuntimeConnection e o webservice como lib)
```

As factories recebem o bag comum de `params` da janela — é por isso que
`storageDir` é declarado ali, apontando para o mesmo `appDataDir`: o
serviceGraph não aceita parâmetros por nó.

## Executar

```bash
executor package ~/EcosystemData/repositories/PlatformApplicationsRepo/Apps.Module/Admin.layer/ContainerManager.group/container-manager.desktopapp
```
