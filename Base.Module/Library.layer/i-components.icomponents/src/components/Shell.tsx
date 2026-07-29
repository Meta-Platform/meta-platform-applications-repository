import * as React from "react"
import Icon from "./Icon"

// Esqueleto de aplicação (§8): barra de topo, trilha/barra lateral e área de
// conteúdo, dimensionados pelos tokens --mp-shell-*. Todo desktop app do
// Application Repository monta a tela por aqui, em vez de recriar o grid.

export const AppShell = ({ topbar, sidebar, dock, children, className = "" }: any) =>
    <div className={`mp-shell ${sidebar ? "has-sidebar" : ""} ${dock ? "has-dock" : ""} ${className}`.trim()}>
        { topbar && <div className="mp-shell__topbar">{topbar}</div> }
        { sidebar && <div className="mp-shell__sidebar">{sidebar}</div> }
        <main className="mp-shell__content">{children}</main>
        { dock && <div className="mp-shell__dock">{dock}</div> }
    </div>

// Barra de topo: identidade à esquerda, ações/estado à direita.
export const Topbar = ({ brand, subtitle, children, right, className = "" }: any) =>
    <header className={`mp-topbar ${className}`.trim()}>
        <div className="mp-topbar__brand">
            <span className="mp-topbar__mark" aria-hidden="true"/>
            <span className="mp-topbar__name">{brand}</span>
            { subtitle && <span className="mp-topbar__subtitle">{subtitle}</span> }
        </div>
        <div className="mp-topbar__center">{children}</div>
        { right && <div className="mp-topbar__right">{right}</div> }
    </header>

// Trilha de navegação vertical. items: [{ key, label, icon, count, disabled }]
export const NavRail = ({ items = [], activeKey, onSelect, collapsed = false, footer, className = "" }: any) =>
    <nav className={`mp-navrail ${collapsed ? "is-collapsed" : ""} ${className}`.trim()}>
        <div className="mp-navrail__items">
            { items.map((item: any) =>
                <button
                    type="button"
                    key={item.key}
                    disabled={item.disabled}
                    title={collapsed ? item.label : undefined}
                    aria-current={item.key === activeKey ? "page" : undefined}
                    className={`mp-navrail__item ${item.key === activeKey ? "is-active" : ""}`.trim()}
                    onClick={() => onSelect && onSelect(item.key)}>
                    { item.icon && <Icon name={item.icon} className="mp-navrail__icon"/> }
                    { !collapsed && <span className="mp-navrail__label">{item.label}</span> }
                    { !collapsed && item.count !== undefined && <span className="mp-navrail__count">{item.count}</span> }
                </button>) }
        </div>
        { footer && <div className="mp-navrail__foot">{footer}</div> }
    </nav>

// Painel lateral de navegação com título e busca (explorer, catálogo, board).
export const SidePanel = ({ title, actions, children, className = "" }: any) =>
    <aside className={`mp-sidepanel ${className}`.trim()}>
        { (title || actions) &&
            <header className="mp-sidepanel__head">
                <span className="mp-sidepanel__title">{title}</span>
                { actions && <span className="mp-sidepanel__actions">{actions}</span> }
            </header> }
        <div className="mp-sidepanel__body">{children}</div>
    </aside>

// Área de conteúdo com largura máxima de leitura (--mp-content-max-w).
export const ContentArea = ({ wide = false, children, className = "" }: any) =>
    <div className={`mp-content ${wide ? "is-wide" : ""} ${className}`.trim()}>{children}</div>

// Rodapé de estado (contagens, conexão, versão) — a "status bar" das IDEs.
export const StatusBar = ({ left, right, className = "" }: any) =>
    <footer className={`mp-statusbar ${className}`.trim()}>
        <div className="mp-statusbar__left">{left}</div>
        <div className="mp-statusbar__right">{right}</div>
    </footer>
