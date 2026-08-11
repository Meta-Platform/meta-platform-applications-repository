# container-manager.webgui

- **Tipo:** interface gráfica web (`.webgui`)
- **Namespace:** `@/container-manager.webgui`

## Propósito

A interface do Container Manager: conexões, containers, imagens, redes e
volumes. Construída sobre o kit comum `@i-components` — nenhum componente de
`semantic-ui-react` é usado diretamente.

## Telas

| Seção | O que faz |
|-------|-----------|
| **Aplicações** | Agrupa os containers por aplicação (estado, uptime, memória, CPU, rede, processos) com atalho para log ao vivo e terminal. É a tela de entrada |
| **Conexões** | Cadastra Docker/Podman, testa antes de salvar, mostra conectado/offline e oferece os runtimes encontrados na máquina |
| **Containers** | Lista com estado, portas e imagem; start, stop, restart, kill e remove; inspeção e histórico de logs; criação com portas, ambiente, volumes e rede |
| **Imagens** | Lista, inspeção, remoção e build a partir do texto de um Dockerfile, com a saída do build à vista |
| **Redes** | Lista, criação, remoção e conexão/desconexão de containers |
| **Volumes** | Lista, criação, remoção e navegação de arquivos: entrar em pastas, enviar, baixar e apagar |

## Como conversa com o backend

Transporte duplo, decidido em tempo de execução por `Utils/Api.ts`, que é uma
casca fina sobre o `GetRequestByServer` de `@i-components/net` (com
`wsQueryParams: true`, porque os streams daqui levam argumentos em `in:"query"`):

| | Navegador | Janela (GUI-host) |
|---|---|---|
| Requisição | HTTP (axios) | `window.metaGui.invoke` |
| Stream | `WebSocket` | `IPCWebSocket` sobre `metaGui.stream` |

As duas colunas têm a **mesma superfície**, então nenhuma tela sabe a diferença
— é assim que tudo o que funciona na janela funciona na web, com um código só.

O que sustenta isso do lado do servidor: o `container-manager-gui.service`
publica o **`api.json` inteiro** no manifesto (não só os nomes dos métodos) e
implementa `InvokeStream`. Sem o manifesto completo, a interface não teria como
saber que `LogStream` é um stream, e o modo janela ficaria sem log ao vivo,
terminal e métricas.

## Sobre o terminal

É um console de **linha**: cada comando é enviado ao pressionar Enter, com
histórico nas setas ↑/↓ e Ctrl+C mandando ETX. Não é um emulador de terminal
completo — cursor, cores e aplicações de tela cheia (`top`, `vim`) exigiriam
`xterm.js` e uma dependência nova no pacote. Para "ver o que está acontecendo
lá dentro", que é o uso real, a linha basta.

`Utils/StripAnsi.ts` limpa as sequências de escape antes de exibir (opcional no
log ao vivo). A **ordem** das alternativas do padrão importa: o CSI aceita `]`,
dígitos e `;` no meio, então casa o começo de um OSC — o título de janela do
bash — e come a primeira letra do que vem depois. É o tipo de defeito que só
aparece na tela, com um prompt de verdade.

## O que a interface não deixa passar

- **A conexão ativa fica na barra de topo, sempre visível.** Uma remoção no
  runtime errado não tem desfazer — quem opera precisa saber, o tempo todo, em
  qual runtime a próxima ação vai cair.
- **Toda ação destrutiva passa por confirmação** com o nome do alvo escrito na
  pergunta: a linha clicada por engano é sempre a do vizinho.
- **Erro vira frase, não código.** `Utils/DescribeError.ts` encontra a mensagem
  do backend nos dois transportes, para o mesmo problema não aparecer de duas
  formas diferentes.
