// Persistência e layout das posições dos ícones da área de trabalho.
// As posições são salvas por chave de aplicação (executable/namespace) em
// localStorage, para o desktop lembrar onde o usuário largou cada ícone.

export type IconPosition = { x: number, y: number }
export type IconPositions = Record<string, IconPosition>

const STORAGE_KEY = "myd-icon-positions"

// dimensões da célula do layout padrão (grade em colunas, como num desktop)
export const CELL_W = 104
export const CELL_H = 112
export const PAD_X = 12
export const PAD_Y = 12

export const LoadPositions = ():IconPositions => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch(_) { return {} }
}

export const SavePositions = (positions:IconPositions) => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)) } catch(_) {}
}

// Posição padrão (fluxo em colunas, de cima para baixo) para um índice, dado o
// número de linhas que cabem na altura disponível.
export const DefaultPosition = (index:number, rowsPerColumn:number):IconPosition => {
    const rows = Math.max(1, rowsPerColumn)
    const col = Math.floor(index / rows)
    const row = index % rows
    return { x: PAD_X + col * CELL_W, y: PAD_Y + row * CELL_H }
}

export const RowsPerColumn = (surfaceHeight:number):number =>
    Math.max(1, Math.floor((surfaceHeight - PAD_Y * 2) / CELL_H))

// Garante uma posição para cada chave: mantém as salvas e gera padrão (sem
// sobrepor as já ocupadas) para as novas.
export const EnsurePositions = (keys:string[], saved:IconPositions, surfaceHeight:number):IconPositions => {
    const rows = RowsPerColumn(surfaceHeight)
    const result:IconPositions = {}
    const occupied = new Set<string>()

    const cellKey = (p:IconPosition) => `${Math.round(p.x)}:${Math.round(p.y)}`

    keys.forEach((k) => {
        if(saved[k]){
            result[k] = saved[k]
            occupied.add(cellKey(saved[k]))
        }
    })

    let cursor = 0
    keys.forEach((k) => {
        if(result[k]) return
        let pos = DefaultPosition(cursor, rows)
        while(occupied.has(cellKey(pos))) {
            cursor += 1
            pos = DefaultPosition(cursor, rows)
        }
        result[k] = pos
        occupied.add(cellKey(pos))
        cursor += 1
    })

    return result
}
