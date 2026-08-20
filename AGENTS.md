# Instruções para agentes de IA

Valem para qualquer agente (Claude Code, Cursor, Codex, Copilot).

## O que é este repositório

As **aplicações** da plataforma: área de trabalho, painel do executor de
instâncias, gerenciador de containers, designer de APIs, desenvolvedor de
pacotes, gestor de projetos e catálogo de UI. Cada aplicação é um **Group** com
seus pacotes de interface, API e composição.

**Não existe `npm start`.** Quem executa os pacotes é um ecossistema Meta
Platform instalado na máquina, em `~/EcosystemData`.

## As três coisas que mais custam tempo

1. **O que roda não é este diretório.** `repo install` copia tudo para
   `~/EcosystemData/repos/`, e é dali que os executáveis rodam. Editar aqui e
   reiniciar não muda nada — é preciso `repo update <Repositório>`.
2. **Processo já em execução não vê código novo.** O Node carrega os módulos uma
   vez. Depois do `repo update`, o processo precisa ser reiniciado. Se ele é
   mais velho que o arquivo, não tem o código novo.
3. **Um glob de teste que não casa com nada não falha.** Roda zero teste e sai
   com sucesso. Confira o **número de casos** antes e depois, sempre.

## Antes de entregar

- Rode a suíte pelo `npm test` **do pacote**, e confira a contagem.
- Rode o verificador de tipos. Pacote sem `tsconfig.json` não é visto pelo gate.
- Todo pacote tem `README.md` no [padrão](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/package-readme-standard.md) —
  ele é publicado no site de documentação, então link quebrado aqui vaza para lá.
- Documentação e commits em **português (pt-BR)**.

> Interfaces (`.webgui`) são compiladas em tempo de execução: depois do
> `repo update`, a primeira abertura ainda pode servir o pacote anterior.

## Onde está a resposta

Este repositório **não documenta a plataforma** — ele a usa.

| Pergunta | Onde |
|---|---|
| Como a plataforma **é**, e por quê | [Open Standard](https://github.com/Meta-Platform/meta-platform-open-standard) — a fonte da verdade |
| Tipos de pacote, metadados, namespaces | [concepts/](https://github.com/Meta-Platform/meta-platform-open-standard/tree/main/concepts) |
| Parâmetros, herança, `{{VAR}}` | [Package Metadata Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/package-metadata-standard.md) |
| Socket e storage declarados | [Declared Resources Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/declared-resources-standard.md) |
| TypeScript sem build | [Source Language Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/source-language-standard.md) |
| Como instalar, criar pacote, comandos | [guias](https://github.com/Meta-Platform/.github/tree/main/docs) |

**Em caso de divergência: o código vence a documentação, e o Open Standard vence
a documentação de qualquer repositório.**
