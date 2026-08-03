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
| **Conexões** | Cadastra Docker/Podman, testa antes de salvar, mostra conectado/offline e oferece os runtimes encontrados na máquina |
| **Containers** | Lista com estado, portas e imagem; start, stop, restart, kill e remove; inspeção e histórico de logs; criação com portas, ambiente, volumes e rede |
| **Imagens** | Lista, inspeção, remoção e build a partir do texto de um Dockerfile, com a saída do build à vista |
| **Redes** | Lista, criação, remoção e conexão/desconexão de containers |
| **Volumes** | Lista, criação, remoção e navegação de arquivos: entrar em pastas, enviar, baixar e apagar |

## Como conversa com o backend

Transporte duplo, decidido em tempo de execução por `Utils/Api.ts`: **HTTP**
com o `container-manager.webservice` quando servida pelo navegador, e **IPC**
com o `container-manager-gui.service` quando roda como janela Electron
(GUI-host). Os nomes de método são os mesmos nos dois caminhos, então nenhuma
tela sabe a diferença.

## O que a interface não deixa passar

- **A conexão ativa fica na barra de topo, sempre visível.** Uma remoção no
  runtime errado não tem desfazer — quem opera precisa saber, o tempo todo, em
  qual runtime a próxima ação vai cair.
- **Toda ação destrutiva passa por confirmação** com o nome do alvo escrito na
  pergunta: a linha clicada por engano é sempre a do vizinho.
- **Erro vira frase, não código.** `Utils/DescribeError.ts` encontra a mensagem
  do backend nos dois transportes, para o mesmo problema não aparecer de duas
  formas diferentes.
