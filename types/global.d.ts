/**
 * Globais do runtime da plataforma, vistos deste repositório.
 *
 * A declaração de `Log` e das cores de `String` vive no EssentialRepo, junto da
 * logger.lib que as cumpre — este arquivo apenas a referencia. Redeclarar aqui
 * criaria duas versões do mesmo acordo, e elas divergiriam na primeira mudança.
 *
 * O caminho relativo vale só no workspace de desenvolvimento, onde a checagem
 * roda; ver o comentário do tsconfig.base.json ao lado.
 */

/// <reference path="../../essential-repository/types/global.d.ts" />
