import { createGlobalStyle } from "styled-components"

// Package Developer — ponte de compatibilidade + estilos específicos do IDE.
// ---------------------------------------------------------------------------
// O sistema de temas (5 variantes light/dark/gray/blue/cyberpunk) vem do
// design system "Meta System Retro-Brutalist UI", importado como CSS no
// index.tsx (tokens.css → CorporateTheme.css → theme-retro-brutalist.css →
// components.css → themes.css). Aquele stack define os tokens --mp-paper/ink/
// line/accent/... e governa Segments, Cards, Menus, Botões, Inputs e Modais.
//
// Este arquivo NÃO reescreve componentes do Semantic UI (o stack acima já faz
// isso). Ele apenas:
//   1. Mantém o vocabulário legado do Package Developer (--mp-bg-*, --mp-text-*,
//      --mp-code-*, etc.) reapontado para os tokens --mp-* do design system,
//      para que os componentes que ainda usam esses nomes (CodeEditor,
//      PackageEditMode, editores) fiquem temáveis sem serem tocados.
//   2. Aplica os estilos que são exclusivos do IDE: scrollbars, os modos
//      data-ide-mode (nav/edit), a rail de edição e o editor de código.
//
// IMPORTANTE: NÃO redefinir aqui os tokens que já pertencem ao design system
// (--mp-success/warning/danger/info, --mp-radius-*, --mp-border-strong) — eles
// são temáveis em themes.css e devem variar junto com o tema.
export default createGlobalStyle`

    :root {
        /* Backgrounds → superfícies paper/surface do design system */
        --mp-bg-canvas:    var(--mp-paper);
        --mp-bg-app:       var(--mp-paper);
        --mp-bg-panel:     var(--mp-surface);
        --mp-bg-panel-alt: var(--mp-paper-2);
        --mp-bg-raised:    var(--mp-surface-2);
        --mp-bg-overlay:   rgba(0, 0, 0, 0.5);

        /* Superfícies interativas */
        --mp-bg-hover:    var(--mp-paper-2);
        --mp-bg-active:   var(--mp-accent-blue-tint);
        --mp-bg-selected: var(--mp-accent-cyan-tint);

        /* Bordas (--mp-border-strong é do design system, não redefinir) */
        --mp-border-subtle:  var(--mp-line-faint);
        --mp-border-default: var(--mp-line-soft);
        --mp-border-focus:   var(--mp-accent-blue);

        /* Texto */
        --mp-text-primary:   var(--mp-ink);
        --mp-text-secondary: var(--mp-ink-2);
        --mp-text-muted:     var(--mp-muted);
        --mp-text-disabled:  var(--mp-muted-2);
        --mp-text-inverse:   var(--mp-paper);

        /* Acento (o teal do Package Developer mapeia no cyan do design system) */
        --mp-accent:        var(--mp-accent-cyan);
        --mp-accent-hover:  var(--mp-accent-cyan);
        --mp-accent-border: var(--mp-accent-cyan);

        /* Editor de código — usa a paleta de terminal (escura em todos os temas) */
        --mp-code-bg:     var(--mp-terminal-bg);
        --mp-code-border: var(--mp-line);

        /* Sombras (duras) e foco */
        --mp-shadow-sm:  var(--mp-shadow-1);
        --mp-shadow-md:  var(--mp-shadow-2);
        --mp-shadow-lg:  var(--mp-shadow-3);
        --mp-focus-ring: 0 0 0 2px var(--mp-accent-cyan);
        --mp-font-code:  var(--mp-font-mono);

        /* altura do topo (menu do app) — usada para preencher a viewport nos
         * modos navegação/edição. Ajuste único aqui reflete em todas as colunas. */
        --pd-header-h: 50px;
    }

    /* ---------- scrollbars ---------- */
    * { scrollbar-width: thin; scrollbar-color: var(--mp-line-soft) var(--mp-paper-2); }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: var(--mp-paper-2); }
    ::-webkit-scrollbar-thumb { background: var(--mp-line-soft); border-radius: 999px; border: 2px solid var(--mp-paper-2); }
    ::-webkit-scrollbar-thumb:hover { background: var(--mp-muted); }

    /* ícones de pasta menos saturados */
    .icon.yellow { color: var(--mp-warning) !important; }

    /* ====================================================================== */
    /* MODOS do IDE (navegação / edição) — específicos do Package Developer    */
    /* ====================================================================== */
    [data-ide-mode="nav"], [data-ide-mode="edit"] { height: calc(100vh - var(--pd-header-h)); overflow: hidden; }
    [data-ide-mode] .ui.header > .icon, [data-ide-mode] .ui.header .icon { color: var(--mp-accent-cyan); }
    .repo-topbar { border-bottom: var(--mp-border) !important; }

    /* editor: rail e área compartilham a base de superfície do tema */
    .edit-rail { background: var(--mp-paper-2) !important; border-right: var(--mp-border); }
    /* O CodeEditor usa overlay: <pre> colorido ATRÁS de um <textarea> transparente.
       O textarea PRECISA ser transparente (bg + texto) senão cobre o pre e o editor
       fica "preto vazio". O fundo escuro e a borda vêm do container do CodeEditor. */
    .code-editor, textarea.code-editor {
        background: transparent !important; color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        caret-color: var(--mp-accent-blue, #2D74C4) !important;
        border: none !important;
    }
    .code-editor:focus, textarea.code-editor:focus { outline: none !important; box-shadow: none !important; }

    /* coluna Repositórios: item em flex para o nome truncar com reticências
       (o layout table-cell padrão do Semantic ignora text-overflow) */
    .repos-list.ui.list > .item { display: flex !important; align-items: center; padding-left: 0 !important; }
    .repos-list.ui.list > .item > i.icon { flex: 0 0 auto; width: auto !important; margin: 0 8px 0 0 !important; padding: 0 !important; }
    .repos-list.ui.list > .item > .content { flex: 1 1 auto !important; min-width: 0 !important; width: auto !important; }

    /* abas de arquivo do editor (modo edição) — visíveis e táteis, estilo eco */
    .edit-tabs.ui.tabular.menu {
        border-bottom: var(--mp-border) !important;
        background: var(--mp-paper-2) !important;
        padding: 6px 6px 0 6px !important;
        min-height: 0 !important;
    }
    .edit-tabs.ui.tabular.menu > .item {
        color: var(--mp-muted) !important;
        background: var(--mp-paper-3) !important;
        border: 1.5px solid var(--mp-line-soft) !important;
        border-bottom: none !important;
        border-radius: var(--mp-radius-sm) var(--mp-radius-sm) 0 0 !important;
        margin: 0 4px 0 0 !important;
        padding: 7px 10px !important;
        font-weight: 700;
        font-family: var(--mp-font-mono);
        font-size: 12px;
    }
    .edit-tabs.ui.tabular.menu > .item:hover {
        background: var(--mp-surface-2) !important;
        color: var(--mp-ink) !important;
        border-color: var(--mp-line) !important;
    }
    .edit-tabs.ui.tabular.menu > .active.item {
        color: var(--mp-ink) !important;
        background: var(--mp-surface) !important;
        border-color: var(--mp-line-strong) !important;
        border-top: 3px solid var(--mp-accent-blue) !important;
        margin-bottom: -2px !important;
        box-shadow: var(--mp-shadow-1);
    }
    .edit-tab-scope { opacity: 0.5; }
    .edit-tabs .active.item .edit-tab-file { font-weight: 800; }
    .edit-tab-dirty { color: var(--mp-warning); margin-left: 6px; font-size: 11px; vertical-align: middle; }
    .edit-tab-close { margin-left: 8px !important; opacity: 0.55; border-radius: 3px; }
    .edit-tab-close:hover { opacity: 1; color: var(--mp-danger) !important; background: var(--mp-danger-tint); }

    /* menu de contexto (botão direito) — mesmo padrão do my-desktop */
    .myd-ctx-scrim { position: fixed; inset: 0; z-index: var(--mp-z-palette); background: transparent; }
    .myd-ctx-menu {
        position: fixed; z-index: calc(var(--mp-z-palette) + 1);
        min-width: 210px; padding: 5px;
        background: var(--mp-surface);
        border: var(--mp-border-strong);
        border-radius: var(--mp-radius-md);
        box-shadow: var(--mp-shadow-2);
    }
    .myd-ctx-item {
        display: flex; align-items: center; gap: 8px; width: 100%;
        padding: 8px 10px; border: none; background: transparent;
        border-radius: var(--mp-radius-sm);
        color: var(--mp-ink); font-size: var(--mp-text-sm); font-weight: 600;
        text-align: left; cursor: pointer;
    }
    .myd-ctx-item .icon { color: var(--mp-muted); margin: 0; }
    .myd-ctx-item:hover { background: var(--mp-accent-blue-tint); }
    .myd-ctx-item:hover .icon { color: var(--mp-ink); }
    .myd-ctx-item--danger { color: var(--mp-danger); }
    .myd-ctx-item--danger .icon { color: var(--mp-danger); }
    .myd-ctx-item--danger:hover { background: var(--mp-danger-tint); }
    .myd-ctx-item:disabled { opacity: .5; cursor: default; }
    .myd-ctx-divider { border-top: 1px solid var(--mp-line-faint); margin: 4px 2px; }
    .myd-ctx-item--open { background: var(--mp-surface-2); }
    .myd-ctx-item--child { padding-left: 30px; }
    .myd-ctx-chevron.icon { margin-left: auto !important; margin-right: 0 !important; color: var(--mp-muted) !important; }
    .myd-ctx-icon-gap { display: inline-block; width: 1.18em; flex: 0 0 auto; }

    /* dock Executar / Console (rodapé da área de edição) */
    .edit-run-dock { border-top: var(--mp-border); background: var(--mp-surface); }
    .edit-run-bar { background: var(--mp-paper-2); border-bottom: 1px solid var(--mp-line-faint); color: var(--mp-ink); }
    .edit-run-bar:hover { background: var(--mp-paper-3); }
`
