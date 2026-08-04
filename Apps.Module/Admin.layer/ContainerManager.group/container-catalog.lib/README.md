# container-catalog.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/container-catalog.lib`
- **Localização:** `Apps.Module/Admin.layer/ContainerManager.group` (PlatformApplicationsRepo)

## Propósito

A **memória** do Container Manager: o que o runtime de containers *não* guarda.

O Docker sabe quais containers existem. Ele não sabe que aquele Postgres nasceu
da receita `postgres` com determinados valores, que a imagem veio do registry
privado da empresa num certo dia, nem que alguém podou 12 GB na terça.

Persistência em SQLite (Sequelize), no molde do `@/project-store.lib` do Meta
Project Manager.

## Duas regras de projeto

**O runtime é a verdade sobre o que existe.** Este banco nunca substitui uma
listagem — ele acrescenta contexto. Quando divergem, o runtime ganha, e
`ReconcileConnection` marca a diferença em vez de corrigir sozinho.

**Segredo nunca entra em claro.** Senha de banco, credencial de registry e
material TLS passam pelo cofre local (`src/Crypto/LocalSecretBox.js`).

## As tabelas

| tabela | o que guarda |
|---|---|
| `recipes` | receitas do catálogo, curadas e do usuário |
| `managed_services` | serviços criados a partir de receita |
| `service_credentials` | as credenciais deles, seladas quando segredo |
| `registries` | registries privados com senha selada |
| `image_provenance` | de onde veio cada imagem, e se há versão nova |
| `container_provenance` | quem criou cada container e a partir de quê |
| `stacks` / `stack_services` | o modelo da stack e o hash do compose |
| `app_state` | preferências e estado de tela |
| `activity_log` | a trilha do que o app fez |

## O cofre

AES-256-GCM, chave de 32 bytes em modo `0600` gerada na primeira execução.
Formato `v1:iv:tag:cifra`.

**O que ele é:** proteção contra leitura acidental do arquivo — backup que
vaza, disco copiado, olho que passa por cima.

**O que ele NÃO é:** proteção contra quem já executa código como este usuário.
A chave está no disco dele, e precisa estar: o app sobe sem interação humana e
tem de conseguir abrir o próprio cofre. Prometer mais seria teatro.

GCM porque ele **autentica**: um byte alterado no banco faz a abertura falhar
em vez de devolver lixo silenciosamente.

## Credenciais: mascaradas por padrão

`GetCredentials` devolve `••••••••` para o que é segredo. Revelar é chamada à
parte (`RevealCredentials`), registrada na trilha.

Não é burocracia: a ficha de um banco fica aberta na tela enquanto se trabalha,
e vai parar em captura de tela, compartilhamento de janela e no ombro de quem
passa.

O mesmo vale para registries: `ListRegistries` devolve `hasPassword: true`,
nunca a senha — nem selada. A credencial de verdade sai por `GetAuthConfig`,
que só o servidor chama.

## Receitas curadas × do usuário

Atualizar o app precisa atualizar as receitas que vêm nele — senão o catálogo
apodrece, que foi o que matou o do Portainer e o do Yacht. Mas não pode
atropelar quem editou uma receita para o seu caso.

`UpsertBuiltinRecipes` só sobrescreve receita `builtin`, **não** marcada como
`locallyModified`, e com `builtinVersion` diferente.

## Armadilha do Sequelize que já mordeu aqui

Os atalhos de definição de coluna em `DefineModels.js` são **funções**, não
objetos. O Sequelize **muta** a definição que recebe (grava ali o `fieldName`
resolvido): reusar a mesma referência faz todos os campos herdarem o nome do
último processado, e o `sync()` cria índice sobre coluna inexistente —

```
SQLITE_ERROR: no such column: connectionId
CREATE INDEX ... ON `managed_services` (`connectionId`, `containerId`)
```

O erro não aponta para a causa em lugar nenhum.

## Regras de banco (herdadas do project-store.lib)

- `PRAGMA busy_timeout = 8000` — webapp e desktopapp abrem o mesmo arquivo
- `journal_mode = WAL`
- `sync()` + lista idempotente de `ALTER TABLE`. **Nunca `alter: true`**

## `require` no topo do módulo

O executor aponta o `NODE_PATH` para as dependências apenas enquanto o módulo é
carregado. `require` adiado falha com `MODULE_NOT_FOUND` mesmo com a
dependência instalada (CTMG-13).

## Testes

```bash
npm install
node --test        # 32 testes, banco em :memory:
```

## Dependências

`sequelize` · `sqlite3` · `yaml`
