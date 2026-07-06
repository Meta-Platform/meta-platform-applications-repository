# Package Developer

IDE do ecossistema **Meta Platform** para navegar, inspecionar, criar e editar
pacotes. Roda como aplicação web (`.webapp`) ou desktop (`.desktopapp`, Electron),
e compartilha capacidades com o CLI `mypkg` (`package-toolkit.cli`).

---

## Modelo

A unidade de trabalho é o **Repository**: um diretório com
`metadata/applications.json` válido. A hierarquia navegada é:

```
Repository → <Nome>.Module → <nome>.layer → [<nome>.group] → <nome>.<ext>
```

`ext` = tipo do pacote (`lib`, `cli`, `service`, `webapp`, `webgui`,
`webservice`, `app`, `desktopapp`).

## Pacotes do grupo

| Pacote | Papel |
|---|---|
| `package-developer.webapp` / `.desktopapp` | Empacotamento (porta 8093 / janela Electron loadURL 8094) |
| `package-developer.webgui` | Front React + Redux + semantic-ui-react + styled-components |
| `package-developer.webservice` | Controllers/APIs (ModuleDeveloper, FileSystemNavigator, PackageTasks, *Explorer) |
| `package-developer.lib` | Funções de leitura da hierarquia (IsRepository, GetRepositoryHierarchy, …) |

Libs compartilhadas (em **ecosystem-core-repository**, reaproveitadas por UI e CLI):
`workspace-store.lib` (persistência), `package-toolkit.lib` (scaffold:
`CreateRepositoryStruct`, `CreateContainer`, `CreateLibPackage`, …),
`package-process-manager.lib` (run/stop), `api-authoring.lib`.

---

## Interface

### Tela inicial
Repositórios **recentes** (cards) + **Abrir repositório** (navegador de diretórios
que destaca repos) + **Criar repositório** (scaffold).

### Modo Navegação (4 colunas)
1. **Repositórios abertos** — switcher (abrir/alternar/fechar vários) + home.
2. **Módulos / Layers** — árvore; "+" cria Module (topo) e Layer (por módulo).
3. **Pacotes** — grupos + pacotes; "+" cria Grupo/Pacote no layer e Pacote no grupo;
   ícone de editar por pacote (e por grupo, abre todos juntos).
4. **Info (somente leitura)** — namespace, path, chips (tipo/versão/readonly),
   dependências **npm**, **grafo de dependências entre pacotes** (`@/`, hub→lista em SVG),
   boot/serviços/endpoints/comandos, e seção **Executar / Console**
   (Install/Run/Debug/Stop + terminal WS com stdin).

### Modo Edição (tela cheia, VSCode-like)
Rail esquerdo minimizado (voltar + trocar pacote do grupo). Navegação intercambiável:
- **Tipo** (padrão): pacote por componente — Metadados (Namespace/Boot/Serviços/
  Endpoints/Comandos/Parâmetros) + Código (categorias de `src/`).
- **Arquivos**: árvore de arquivos completa.
Abas multi-arquivo/multi-pacote com **posição lembrada entre sessões**; Save por arquivo.
Menu de contexto (botão direito) na árvore: **novo arquivo, renomear, excluir** (arquivo/pasta).

**Editores estruturados (formulário):** ao abrir `boot.json`, `services.json`,
`endpoint-group.json` ou `command-group.json`, o editor oferece um modo **Formulário**
(listas de registros com adicionar/remover/reordenar) além do **JSON** cru. Campos não
modelados são **preservados** (marcados com 🔒) — a edição por formulário nunca descarta
chaves. JSON inválido cai automaticamente no modo cru.

---

## Persistência (server-side)

`workspace-store.lib` → SQLite em `~/virtual-desk-state/local-databases/`:
- **Workspace** (repositórios): nome, path, `lastAccessedAt` (recentes/Touch).
- **AppState** (chave/valor JSON): memória da IDE — última pasta do picker
  (`picker:lastDir`), repositórios abertos (`ide:open-repositories`), repositório ativo
  (`ide:last-repository`), abas por sessão de edição (`edit-tabs:<repo>:<título>`).

---

## API (webservice)

- **ModuleDeveloper**: `GET /workspaces`, `GET /recent-repositories`,
  `GET /workspace/:w/hierarchy`, `GET|POST /app-state`, `POST /workspace`,
  `POST /repository`, `POST /container`, `POST /package`,
  `POST /rename-node`, `POST /delete-node`, `DELETE /workspace/:name`,
  `POST /browse-dir`, `GET /icon/:w/:pkg/:ext`.
- **FileSystemNavigator**: `ListItem`, `GetContentItem`, `SaveContentItem`,
  `CreateContentItem`, `RenameContentItem`, `DeleteContentItem`, `GetPackageMetadata`.
- **PackageTasks**: `InstallDependencies`, `Start`, `Debug`, `Stop`, `ListRunning`,
  `GetLogs`, e WS `/console` (logs ao vivo + stdin).

Segurança: criação valida que o destino está **dentro do repositório**
(`_AssertInsideRepo`); abrir/criar valida `IsRepository`.

---

## CLI (`mypkg` / package-toolkit.cli)

Paridade com a UI, compartilhando o mesmo scaffold do `package-toolkit.lib`:

```bash
mypkg workspace list
mypkg workspace create <nome> <path>
mypkg create repository <nome>                 # no diretório atual
mypkg create container <module|layer|group> <nome>
mypkg create package <nome> <ext>              # qualquer tipo
mypkg create library|commandline|services <nome>
```

> O wrapper do `mypkg` não preserva aspas: nomes com espaço são divididos.

---

## Design system

Tokens em `webgui/src/Styles/Global.style.ts` (`--mp-*`): base **slate**
(`--mp-bg-canvas #0B1118` …) + acento **teal** (`--mp-accent #14D6C8`), status
(success/warning/danger/info), editor (`--mp-code-bg #0D1117`), overlay, sombras,
raios e focus-ring. Tema **dark unificado** (navegação e edição compartilham a base;
não há mais fundo vinho/verde por modo). Botões: primário teal com texto escuro,
secundário slate, destrutivo em *danger-soft*, disabled legível. Contraste mirando AA/AAA.

---

## Rodar / testar localmente

```bash
# sincronizar o código para o ambiente provisionado (~/EcosystemData) e rodar
run package <path>/package-developer.webapp        # 8093, sem janela (recomendado p/ teste)
run package <path>/package-developer.desktopapp    # janela Electron (8094)
```

Node via nvm 22.13. O `.webgui` builda em runtime (webpack, ~20 s → log
"construido com sucesso"). A **SPA** é servida em `/` (StaticEndpointsService).

**Cuidados conhecidos:**
- O `.desktopapp` **encerra o servidor ao fechar a janela** — para inspeção use o `.webapp`.
- O supervisor do `run` **respawna** o serviço: para reiniciar, mate a **árvore** de
  processos (não só a porta) e confirme a porta livre antes de subir de novo.

---

## Pendências (pós-🔴)

- **Mover** nós (pacote/grupo/layer/module) para outro pai. *(Renomear, excluir e criar
  arquivo novo já implementados — via menu de contexto na árvore e no editor.)*
- Info read-only: mostrar a **estrutura de arquivos** do pacote. *(O grafo de
  dependências entre pacotes via `@/` já é exibido no painel de info.)*
- Integrar o APIDesigner e dar o mesmo redesign ao `datasource-manager`.
- Estabilidade do `.desktopapp` (terminação ao fechar janela).
