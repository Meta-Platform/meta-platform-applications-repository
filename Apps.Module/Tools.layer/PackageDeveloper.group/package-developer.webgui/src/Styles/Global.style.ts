import { createGlobalStyle } from "styled-components"

// Tema dark do Package Developer. Base neutra escura + acentos por modo:
// navegação = azul/verde; edição = vinho/laranja.
// Texto com bom contraste (o semantic default é quase-preto -> forçamos claro).
export default createGlobalStyle`

    body {
        background-color: #14161b;
        color: #dfe3ea;
    }

    a { color: #6cb2ea; }
    code { color: #f0a15e; }

    /* ---------- texto base (contraste no dark) ---------- */
    .ui.header, .ui.card .header, h1, h2, h3, h4, h5 { color: #f2f4f8 !important; }
    .ui.header .sub.header, .ui.header .content .sub.header { color: #aeb6c2 !important; }

    .ui.list .item, .ui.list .item > .content, .ui.list .item .content,
    .ui.list .list > .item, .ui.list .list > .item > .content { color: #dfe3ea !important; }
    .ui.list .item .header, .ui.list .list > .item .header { color: #f2f4f8 !important; }
    .ui.list .item .description, .ui.card .meta, .ui.card .description { color: #a7afbc !important; }

    p, span, strong, label, td, th, div { color: inherit; }
    .ui.menu .item, .ui.menu { color: #ccd2dc; }
    .ui.label { color: #e2e6ec; }
    .ui.basic.label { color: #b8c0cc; }

    /* ---------- superfícies ---------- */
    .ui.segment {
        background: #1e2027; color: #dfe3ea; border-color: #2b2f38; box-shadow: none;
    }
    .ui.placeholder.segment { background: #191b21; border-color: #2b2f38; }
    .ui.placeholder.segment .header, .ui.placeholder.segment p { color: #cdd3dc !important; }

    .ui.card, .ui.cards > .card {
        background: #1e2027 !important; color: #dfe3ea !important;
        box-shadow: 0 1px 3px rgba(0,0,0,.45) !important;
    }
    .ui.card > .content, .ui.cards > .card > .content { border-color: #2b2f38 !important; }

    /* ---------- menu / tabs ---------- */
    .ui.menu { background: #1e2027; border-color: #2b2f38; box-shadow: none; }
    .ui.tabular.menu .item { color: #b8c0cc; border-color: transparent; }
    .ui.tabular.menu .active.item { background: #1e2027; color: #f2f4f8; border-color: #2b2f38; border-bottom-color: #1e2027; }
    .ui.tab.segment, .ui.bottom.attached.segment.tab { background: #1e2027; }

    /* ---------- lists (seleção) ---------- */
    .ui.selection.list > .item:hover, .ui.list > .item.active { background: #282c35; border-radius: 4px; }
    .ui.divider { color: #aeb6c2; }
    .ui.divider:not(.vertical):not(.horizontal) { border-top-color: #2b2f38; border-bottom-color: #2b2f38; }

    /* ---------- inputs ---------- */
    .ui.input > input, .ui.form input, .ui.form textarea, textarea,
    .ui.form input:not([type]), .ui.form .field input:not([type]),
    input:not([type]), input[type="text"], input[type="password"], input[type="number"], input[type="search"],
    .ui.form .field input, .ui.modal input, .ui.dropdown {
        background: #14161b !important; color: #dfe3ea !important; border-color: #2b2f38 !important;
    }
    input::placeholder { color: #7b828e !important; }
    .ui.action.input > .button { background: #262a33 !important; color: #dfe3ea !important; }

    /* ---------- modal ---------- */
    .ui.modal, .ui.modal > .content, .ui.modal > .actions {
        background: #1e2027 !important; color: #dfe3ea !important; border-color: #2b2f38 !important;
    }
    .ui.modal > .header { background: #1e2027 !important; color: #f2f4f8 !important; border-color: #2b2f38 !important; }
    .ui.modal .content, .ui.modal .content * { color: #dfe3ea; }

    /* ====================================================================== */
    /* MODO NAVEGAÇÃO — dark azul/verde                                       */
    /* ====================================================================== */
    [data-ide-mode="nav"] { background: #101a1c; min-height: 84vh; }
    [data-ide-mode="nav"] .ui.header > .icon, [data-ide-mode="nav"] .ui.header .icon { color: #35c7b6; }
    [data-ide-mode="nav"] .ui.list > .item.active, [data-ide-mode="nav"] .ui.selection.list > .item.active {
        background: #123434; box-shadow: inset 3px 0 0 #35c7b6;
    }
    [data-ide-mode="nav"] .ui.segment { background: #14201f; border-color: #1e3330; }
    [data-ide-mode="nav"] .repo-topbar { border-bottom: 2px solid #35c7b6 !important; }

    /* ====================================================================== */
    /* MODO EDIÇÃO — dark vinho/laranja                                       */
    /* ====================================================================== */
    [data-ide-mode="edit"] { background: #1a1013; }
    [data-ide-mode="edit"] .edit-rail { background: #3a1420 !important; }
    [data-ide-mode="edit"] .ui.menu { background: #211318; border-color: #3a1f26; }
    [data-ide-mode="edit"] .ui.tabular.menu .active.item {
        background: #211318; color: #f0a15e; border-color: #3a1f26; border-top: 2px solid #e8823a;
    }
    [data-ide-mode="edit"] .ui.header .icon { color: #e8823a; }
    [data-ide-mode="edit"] .ui.list > .item.active { background: #3a1420; box-shadow: inset 3px 0 0 #e8823a; }
`
