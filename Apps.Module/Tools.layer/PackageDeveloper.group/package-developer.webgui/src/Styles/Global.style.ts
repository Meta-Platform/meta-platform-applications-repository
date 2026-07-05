import { createGlobalStyle } from "styled-components"

// Design system do Package Developer (Meta Platform): tokens de cor + tema dark
// unificado (slate + acento teal), alto contraste e estados padronizados.
export default createGlobalStyle`

    :root {
        /* Backgrounds */
        --mp-bg-canvas: #0B1118;
        --mp-bg-app: #0F1621;
        --mp-bg-panel: #151D29;
        --mp-bg-panel-alt: #111B24;
        --mp-bg-raised: #1C2633;
        --mp-bg-overlay: rgba(2, 6, 12, 0.68);

        /* Superfícies interativas */
        --mp-bg-hover: #1A2A36;
        --mp-bg-active: #203241;
        --mp-bg-selected: #103A3A;

        /* Bordas */
        --mp-border-subtle: #263241;
        --mp-border-default: #334155;
        --mp-border-strong: #4B5C70;
        --mp-border-focus: #14D6C8;

        /* Texto */
        --mp-text-primary: #F2F7F8;
        --mp-text-secondary: #B5C3CF;
        --mp-text-muted: #8FA1AF;
        --mp-text-disabled: #5F6B78;
        --mp-text-inverse: #0B1118;

        /* Acento */
        --mp-accent: #14D6C8;
        --mp-accent-hover: #1AF0E0;
        --mp-accent-border: rgba(20, 214, 200, 0.42);

        /* Status */
        --mp-success: #46D878;
        --mp-warning: #FFB86B;
        --mp-danger: #FF5C5C;
        --mp-info: #58A6FF;

        /* Editor */
        --mp-code-bg: #0D1117;
        --mp-code-border: #2A3645;

        /* Sombras / raios / foco */
        --mp-shadow-sm: 0 1px 2px rgba(0,0,0,.35);
        --mp-shadow-md: 0 8px 24px rgba(0,0,0,.38);
        --mp-shadow-lg: 0 20px 60px rgba(0,0,0,.48);
        --mp-radius-sm: 4px;
        --mp-radius-md: 6px;
        --mp-radius-lg: 10px;
        --mp-focus-ring: 0 0 0 2px rgba(20,214,200,.38);
        --mp-font-code: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
    }

    /* ---------- scrollbars ---------- */
    * { scrollbar-width: thin; scrollbar-color: #3B4858 var(--mp-bg-panel-alt); }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: var(--mp-bg-panel-alt); }
    ::-webkit-scrollbar-thumb { background: #3B4858; border-radius: 999px; border: 2px solid var(--mp-bg-panel-alt); }
    ::-webkit-scrollbar-thumb:hover { background: #536579; }

    /* ---------- base ---------- */
    body { background: var(--mp-bg-canvas); color: var(--mp-text-primary); }
    a { color: var(--mp-info); }
    code, pre { color: var(--mp-accent); font-family: var(--mp-font-code); }

    /* ---------- texto (contraste AA/AAA) ---------- */
    .ui.header, .ui.card .header, .ui.cards > .card .header, h1, h2, h3, h4, h5 { color: var(--mp-text-primary) !important; }
    .ui.header .sub.header { color: var(--mp-text-muted) !important; }
    .ui.list .item .header, .ui.list .list > .item .header { color: var(--mp-text-primary) !important; }
    .ui.list .item, .ui.list .item > .content, .ui.list .item .content,
    .ui.list .list > .item, .ui.list .list > .item > .content { color: var(--mp-text-secondary) !important; }
    .ui.list .item .description, .ui.card .meta, .ui.card .description { color: var(--mp-text-muted) !important; }

    /* ---------- superfícies ---------- */
    .ui.segment { background: var(--mp-bg-panel); color: var(--mp-text-secondary); border-color: var(--mp-border-subtle); box-shadow: none; }
    .ui.placeholder.segment { background: var(--mp-bg-panel-alt); border-color: var(--mp-border-subtle); }
    .ui.placeholder.segment .header { color: var(--mp-text-primary) !important; }
    .ui.placeholder.segment p, .ui.placeholder.segment .icon { color: var(--mp-text-muted) !important; }

    .ui.card, .ui.cards > .card {
        background: var(--mp-bg-panel) !important; color: var(--mp-text-secondary) !important;
        border: 1px solid var(--mp-border-subtle) !important; box-shadow: var(--mp-shadow-sm) !important;
    }
    .ui.card:hover, .ui.cards > .card:hover {
        background: var(--mp-bg-raised) !important; border-color: var(--mp-accent-border) !important; box-shadow: var(--mp-shadow-md) !important;
    }
    .ui.card > .content, .ui.cards > .card > .content { border-color: var(--mp-border-subtle) !important; }

    /* ---------- menu / tabs ---------- */
    .ui.menu { background: var(--mp-bg-panel-alt); border-color: var(--mp-border-default); box-shadow: none; }
    .ui.menu .item { color: var(--mp-text-muted); }
    .ui.tabular.menu .item { color: var(--mp-text-muted); border-color: transparent; border-bottom: 2px solid transparent; }
    .ui.tabular.menu .active.item {
        background: var(--mp-bg-panel); color: var(--mp-text-primary);
        border-color: var(--mp-border-default); border-bottom: 2px solid var(--mp-accent);
    }

    /* ---------- lists / estados selecionados ---------- */
    .ui.selection.list > .item:hover, .ui.list > .item:hover { background: var(--mp-bg-hover); border-radius: var(--mp-radius-sm); }
    .ui.list > .item.active, .ui.selection.list > .item.active {
        background: var(--mp-bg-selected) !important; color: var(--mp-text-primary) !important;
        box-shadow: inset 3px 0 0 var(--mp-accent); border-radius: var(--mp-radius-sm);
    }
    .ui.divider { color: var(--mp-text-muted); }
    .ui.divider:not(.vertical):not(.horizontal) { border-top-color: var(--mp-border-default); border-bottom-color: var(--mp-border-default); }

    /* ícones de pasta menos saturados */
    .icon.yellow { color: #FFCF70 !important; }

    /* ---------- inputs ---------- */
    .ui.input > input, .ui.form input, .ui.form textarea, textarea,
    .ui.form input:not([type]), input:not([type]), input[type="text"], input[type="password"],
    input[type="number"], input[type="search"], .ui.form .field input {
        background: var(--mp-code-bg) !important; color: var(--mp-text-primary) !important; border-color: var(--mp-border-default) !important;
    }
    .ui.input > input:focus, .ui.form input:focus, textarea:focus, input:focus {
        border-color: var(--mp-border-focus) !important; box-shadow: var(--mp-focus-ring) !important;
    }
    input::placeholder, textarea::placeholder { color: var(--mp-text-disabled) !important; }
    .ui.action.input > .button { background: var(--mp-bg-raised) !important; color: var(--mp-text-secondary) !important; border: 1px solid var(--mp-border-default) !important; }

    /* ---------- botões ---------- */
    .ui.button { transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease; }
    .ui.teal.button, .ui.primary.button {
        background: var(--mp-accent) !important; color: var(--mp-text-inverse) !important; font-weight: 700; box-shadow: none !important;
    }
    .ui.teal.button:hover, .ui.primary.button:hover { background: var(--mp-accent-hover) !important; color: var(--mp-text-inverse) !important; }
    .ui.positive.button { background: var(--mp-success) !important; color: var(--mp-text-inverse) !important; font-weight: 700; box-shadow: none !important; }
    .ui.basic.button, .ui.button {
        background: var(--mp-bg-raised); color: var(--mp-text-secondary); border: 1px solid var(--mp-border-default); box-shadow: none;
    }
    .ui.basic.button { box-shadow: inset 0 0 0 1px var(--mp-border-default) !important; color: var(--mp-text-secondary) !important; background: transparent !important; }
    .ui.basic.button:hover, .ui.button:hover { background: var(--mp-bg-hover) !important; color: var(--mp-text-primary) !important; border-color: var(--mp-border-strong); }
    .ui.red.button, .ui.red.basic.button {
        background: rgba(255,92,92,.12) !important; color: #FFC4C4 !important;
        border: 1px solid rgba(255,92,92,.48) !important; box-shadow: none !important;
    }
    .ui.red.button:hover, .ui.red.basic.button:hover { background: rgba(255,92,92,.20) !important; color: #FFE1E1 !important; border-color: var(--mp-danger) !important; }
    .ui.button:disabled, .ui.disabled.button, .ui.button.disabled {
        background: #151A22 !important; color: var(--mp-text-disabled) !important; border-color: #252E3A !important; opacity: 1 !important;
    }
    /* teal/primary/positive não devem virar "button base" acima */
    .ui.teal.button, .ui.primary.button, .ui.positive.button { border-color: transparent !important; }

    /* ---------- labels / chips ---------- */
    .ui.label { background: var(--mp-bg-raised); color: var(--mp-text-secondary); border: 1px solid var(--mp-border-default); }
    .ui.basic.label { background: transparent; color: var(--mp-text-muted); border: 1px solid var(--mp-border-default); }
    .ui.blue.label, .ui.teal.label { background: rgba(88,166,255,.16); color: #B9DAFF; border: 1px solid rgba(88,166,255,.35); }

    /* ---------- modal + overlay ---------- */
    .ui.dimmer, .ui.page.modals.dimmer.transition, .ui.modals.dimmer { background: var(--mp-bg-overlay) !important; }
    .ui.modal {
        background: var(--mp-bg-raised) !important; color: var(--mp-text-primary) !important;
        border: 1px solid var(--mp-border-default) !important; border-radius: var(--mp-radius-lg) !important; box-shadow: var(--mp-shadow-lg) !important;
    }
    .ui.modal > .header { background: var(--mp-bg-raised) !important; color: var(--mp-text-primary) !important; border-bottom: 1px solid var(--mp-border-subtle) !important; }
    .ui.modal > .content { background: var(--mp-bg-raised) !important; color: var(--mp-text-secondary) !important; }
    .ui.modal > .actions { background: var(--mp-bg-panel) !important; border-top: 1px solid var(--mp-border-subtle) !important; }
    .ui.modal > .close { top: .85rem; right: 1rem; color: var(--mp-text-muted); }
    .ui.modal > .close:hover { color: var(--mp-text-primary); }

    /* ====================================================================== */
    /* MODOS unificados (mesma base slate + teal em navegação e edição)       */
    /* ====================================================================== */
    [data-ide-mode="nav"], [data-ide-mode="edit"] { background: var(--mp-bg-canvas); min-height: 84vh; }
    [data-ide-mode] .ui.header > .icon, [data-ide-mode] .ui.header .icon { color: var(--mp-accent); }
    .repo-topbar { border-bottom: 1px solid var(--mp-border-default) !important; }

    /* editor: rail e área compartilham a base slate (sem vinho) */
    .edit-rail { background: var(--mp-bg-panel-alt) !important; border-right: 1px solid var(--mp-border-default); }
    .code-editor, [data-ide-mode="edit"] textarea, textarea.code-editor {
        background: var(--mp-code-bg) !important; color: var(--mp-text-primary) !important;
        border: 1px solid var(--mp-code-border) !important; border-radius: var(--mp-radius-md);
        font-family: var(--mp-font-code) !important; font-size: 13px; line-height: 1.55;
    }
    .code-editor:focus, [data-ide-mode="edit"] textarea:focus { border-color: var(--mp-border-focus) !important; box-shadow: var(--mp-focus-ring) !important; }
`
