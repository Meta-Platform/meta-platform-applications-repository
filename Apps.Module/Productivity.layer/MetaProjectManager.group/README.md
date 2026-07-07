# MetaProjectManager.group

**Meta Project Manager** — gestor de projetos, boards, histórias, tarefas, subtarefas,
anexos e colaboração entre **humanos e agentes de IA** dentro da Meta Platform.

Regra central: **paridade GUI/CLI** — toda ação da interface tem comando de CLI equivalente.
A GUI é para humanos; a CLI (`mpm`) é otimizada para agentes de IA (saída `--json`,
não-interativa, idempotente).

## Pacotes

| Pacote | Papel |
|---|---|
| `project-store.lib` | Domínio, persistência (SQLite/Sequelize) e auditoria. **Única fonte de regra de negócio.** |
| `meta-project-manager.webservice` | API REST + WebSocket (`/events`) sobre o store. |
| `meta-project-manager.webgui` | UI React/TS (board Kanban, lista hierárquica, inspector, usuários/agentes, relatórios). |
| `meta-project-manager-gui.service` | Serviço GUI-host (IPC) usado pelo desktop. |
| `meta-project-manager.webapp` | Composition root web (server + webservice + webgui) — registrado como **APP**. |
| `meta-project-manager.desktopapp` | Shell Electron (GUI-host) — registrado como **DESKTOP**. |
| `meta-project-manager.cli` | CLI `mpm` (paridade com a GUI). |

Arquitetura (spec §10.1): **CLI e webservice não duplicam regra** — ambos reusam
`@/project-store.lib`. A GUI fala com o webservice (HTTP) ou com o gui.service (IPC no desktop).

```
GUI  ─HTTP→ webservice ─┐
CLI  ────────────────────┼─→ project-store.lib (use cases + SQLite + auditoria)
Desktop ─IPC→ gui.service┘
```

## Como rodar

Provisionamento local (LOCAL_FS):

```bash
repo install ApplicationsRepository LOCAL_FS \
  --executables meta-project-manager meta-project-manager-desktop mpm
# após editar código:
repo update ApplicationsRepository
```

- **Web (browser):** executa o app `meta-project-manager` (APP) → abre a webgui servida pelo webapp.
- **Desktop (Electron):** executa `meta-project-manager-desktop` (DESKTOP, GUI-host).
- **CLI:** `mpm --help` (ou o alias `meta-project-manager`). Ver `meta-project-manager.cli/README.md`.

## Persistência

- Banco: `~/virtual-desk-state/local-databases/meta-project-manager.sqlite`
- Anexos: `~/virtual-desk-state/meta-project-manager/attachments/<projectId>/<attachmentId>/`

Migrations não são manuais — `sequelize.sync()` cria/atualiza o schema (idioma de `workspace-store.lib`).

## Testes

```bash
( cd project-store.lib && node --test )                       # domínio (16 casos)
( cd meta-project-manager.cli && npm i yargs --no-save && node --test )   # CLI (fluxo de agente)
```
