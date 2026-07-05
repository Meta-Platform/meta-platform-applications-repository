import * as React from "react"
import { Button, Icon } from "semantic-ui-react"

import Window from "./Window"

// Janela de boas-vindas (estilo "Welcome to..."), exibida no primeiro acesso.
type WelcomeWindowProps = {
    appCount: number
    onClose: () => void
}

const WelcomeWindow = ({ appCount, onClose }:WelcomeWindowProps) =>
    <div className="myd-modal-scrim">
        <Window
            title="Bem-vindo ao MyDesktop"
            width={520}
            onClose={onClose}
            className="myd-welcome"
            footer={<Button primary onClick={onClose}>Vamos lá</Button>}>

            <div className="myd-welcome__body">
                <div className="myd-welcome__art">
                    <Icon name="desktop" size="huge"/>
                </div>
                <div className="myd-welcome__text">
                    <h2>Sua área de trabalho do ecossistema.</h2>
                    <p className="myd-welcome__lead">
                        O MyDesktop é a porta de entrada do uso local. Todas as
                        aplicações de desktop instaladas aparecem aqui como ícones —
                        é só dar um duplo-clique para abrir.
                    </p>
                    <ul className="myd-welcome__list">
                        <li><Icon name="th"/> Seus apps instalados, num só lugar.</li>
                        <li><Icon name="rocket"/> Duplo-clique no ícone (ou clique no dock) para iniciar.</li>
                        <li><Icon name="mouse pointer"/> Botão direito na área de trabalho: adicionar/remover apps e trocar o tema.</li>
                    </ul>
                    <p className="myd-welcome__count">
                        {
                            appCount > 0
                                ? <><strong>{appCount}</strong> {appCount === 1 ? "aplicação instalada" : "aplicações instaladas"} prontas para uso.</>
                                : <>Nenhuma aplicação de desktop instalada ainda — instale apps pelo Ecosystem Control Panel.</>
                        }
                    </p>
                </div>
            </div>
        </Window>
    </div>

export default WelcomeWindow
