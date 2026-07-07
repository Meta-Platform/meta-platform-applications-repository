# meta-project-manager.desktopapp

Shell **Electron (GUI-host)** do Meta Project Manager (registrado como DESKTOP
`meta-project-manager-desktop`). Molde: `my-desktop.desktopapp`.

O `boot.json` declara uma `window` que carrega `@/meta-project-manager.webgui` e um
bloco `gui-host` cujo `serviceGraph` instancia o `@/meta-project-manager-gui.service`
(que compõe os controllers do webservice sobre `@/project-store.lib`) e o expõe ao
renderer por IPC. Sem webservices HTTP no modo desktop — a webgui usa transporte dual
(IPC no Electron, HTTP no navegador).

Persistência: `~/virtual-desk-state/local-databases/meta-project-manager.sqlite`
(o `~` é expandido pelo store via `os.homedir()`).
