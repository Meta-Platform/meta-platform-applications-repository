// Registro CENTRAL dos tipos de item (MPMB-58).
//
// Antes, a identidade de cada tipo estava espalhada: o rótulo em `Utils/labels.ts`,
// a cor em `Utils/format.ts` (typeClass) e nenhum ícone. Isso deixava a semântica
// depender só de cor + texto. Aqui há UMA fonte para ícone + rótulo + cor +
// categoria + hierarquia + ordem, e todo o resto (badge, labels, classe de cor,
// ordenação) deriva daqui.
//
// A fonte da verdade dos IDS de tipo continua sendo `project-store.lib/src/Config.js`
// (`WORK_ITEM_TYPES`). Este arquivo só acrescenta a CAMADA DE APRESENTAÇÃO por tipo,
// mantendo exatamente os 13 tipos atuais (sem inventar `initiative`/`release`).

export type WorkItemCategory =
    "discovery" | "planning" | "delivery" | "quality" | "knowledge" | "governance"

export interface WorkItemTypeDefinition {
    id: string
    label: string          // rótulo pt-br ("épico")
    shortLabel: string     // versão curta p/ espaços apertados
    icon: string           // nome do ícone semantic-ui
    colorClass: string     // classe CSS de cor da badge (.mpm-badge--type-*)
    category: WorkItemCategory
    hierarchyLevel: number // 1 (épico) … 4 (subtarefa) — quanto menor, mais alto
    listOrder: number      // ordem estável em filtros/legendas
    canHaveProgress: boolean       // agrega progresso de filhos
    allowedChildTypes: string[]    // hierarquia recomendada (ainda não imposta)
    canBeConvertedTo: string[]     // destinos de conversão sugeridos
}

// Ordem: do mais alto (épico) ao mais específico, agrupando afins.
const DEFS: WorkItemTypeDefinition[] = [
    { id: "epic",          label: "épico",         shortLabel: "épico",  icon: "clone",                 colorClass: "mpm-badge--type-epic",       category: "planning",   hierarchyLevel: 1, listOrder: 1,  canHaveProgress: true,  allowedChildTypes: ["feature", "story", "task", "bug", "research"], canBeConvertedTo: ["feature", "story"] },
    { id: "feature",       label: "funcionalidade", shortLabel: "feat",  icon: "cube",                  colorClass: "mpm-badge--type-feature",    category: "planning",   hierarchyLevel: 2, listOrder: 2,  canHaveProgress: true,  allowedChildTypes: ["story", "task", "bug"], canBeConvertedTo: ["epic", "story"] },
    { id: "story",         label: "história",      shortLabel: "hist.",  icon: "bookmark",              colorClass: "mpm-badge--type-story",      category: "planning",   hierarchyLevel: 2, listOrder: 3,  canHaveProgress: true,  allowedChildTypes: ["task", "subtask", "bug"], canBeConvertedTo: ["task", "feature"] },
    { id: "task",          label: "tarefa",        shortLabel: "tarefa", icon: "check square outline",  colorClass: "mpm-badge--type-task",       category: "delivery",   hierarchyLevel: 3, listOrder: 4,  canHaveProgress: false, allowedChildTypes: ["subtask"], canBeConvertedTo: ["story", "bug", "subtask"] },
    { id: "subtask",       label: "subtarefa",     shortLabel: "sub",    icon: "level down alternate",  colorClass: "mpm-badge--type-subtask",    category: "delivery",   hierarchyLevel: 4, listOrder: 5,  canHaveProgress: false, allowedChildTypes: [], canBeConvertedTo: ["task"] },
    { id: "bug",           label: "bug",           shortLabel: "bug",    icon: "bug",                   colorClass: "mpm-badge--type-bug",        category: "quality",    hierarchyLevel: 3, listOrder: 6,  canHaveProgress: false, allowedChildTypes: ["subtask"], canBeConvertedTo: ["task"] },
    { id: "improvement",   label: "melhoria",      shortLabel: "melh.",  icon: "arrow up",              colorClass: "mpm-badge--type-story",      category: "delivery",   hierarchyLevel: 3, listOrder: 7,  canHaveProgress: false, allowedChildTypes: ["subtask"], canBeConvertedTo: ["task", "story"] },
    { id: "refactor",      label: "refatoração",   shortLabel: "refac.", icon: "recycle",               colorClass: "mpm-badge--type-refactor",   category: "delivery",   hierarchyLevel: 3, listOrder: 8,  canHaveProgress: false, allowedChildTypes: ["subtask"], canBeConvertedTo: ["task", "tech-debt"] },
    { id: "tech-debt",     label: "dívida técnica", shortLabel: "dívida", icon: "wrench",               colorClass: "mpm-badge--type-bug",        category: "quality",    hierarchyLevel: 3, listOrder: 9,  canHaveProgress: false, allowedChildTypes: ["subtask"], canBeConvertedTo: ["task", "refactor"] },
    { id: "research",      label: "investigação",  shortLabel: "pesq.",  icon: "search",                colorClass: "mpm-badge--type-research",   category: "discovery",  hierarchyLevel: 3, listOrder: 10, canHaveProgress: false, allowedChildTypes: ["task"], canBeConvertedTo: ["decision", "task", "story"] },
    { id: "documentation", label: "documentação",  shortLabel: "docs",   icon: "file alternate outline", colorClass: "mpm-badge--type-doc",      category: "knowledge",  hierarchyLevel: 3, listOrder: 11, canHaveProgress: false, allowedChildTypes: ["subtask"], canBeConvertedTo: ["task"] },
    { id: "decision",      label: "decisão",       shortLabel: "decis.", icon: "balance scale",         colorClass: "mpm-badge--type-decision",   category: "governance", hierarchyLevel: 3, listOrder: 12, canHaveProgress: false, allowedChildTypes: [], canBeConvertedTo: ["documentation"] },
    { id: "automation",    label: "automação",     shortLabel: "auto.",  icon: "cogs",                  colorClass: "mpm-badge--type-automation", category: "delivery",   hierarchyLevel: 3, listOrder: 13, canHaveProgress: false, allowedChildTypes: ["subtask"], canBeConvertedTo: ["task"] }
]

const BY_ID: { [id: string]: WorkItemTypeDefinition } = {}
DEFS.forEach((d) => { BY_ID[d.id] = d })

// Fallback = tarefa (o mesmo default do domínio), mas preservando um id
// desconhecido no rótulo em vez de sumir com ele.
const TASK = BY_ID["task"]

export const WORK_ITEM_TYPE_DEFS: WorkItemTypeDefinition[] = DEFS

// Definição de um tipo. Para id desconhecido, devolve uma definição derivada do
// task (mesmo ícone/cor) mas com o rótulo = o próprio id "humanizado".
export const workItemType = (type?: string): WorkItemTypeDefinition => {
    const id = (type || "task").toLowerCase()
    if (BY_ID[id]) return BY_ID[id]
    const humanized = id.replace(/[-_]/g, " ")
    return { ...TASK, id, label: humanized, shortLabel: humanized }
}

export const typeIcon = (type?: string): string => workItemType(type).icon
export const typeColorClass = (type?: string): string => workItemType(type).colorClass
export const typeCategory = (type?: string): WorkItemCategory => workItemType(type).category

// Comparador estável por ordem de tipo (para ordenar listas/legendas por tipo).
export const compareByTypeOrder = (a?: string, b?: string): number =>
    workItemType(a).listOrder - workItemType(b).listOrder
