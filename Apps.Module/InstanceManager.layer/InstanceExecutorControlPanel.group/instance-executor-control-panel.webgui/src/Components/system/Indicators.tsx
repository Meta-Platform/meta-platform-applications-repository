import * as React from "react"

import { Icon } from "@i-components"

// Indicadores de DOMÍNIO do Instance Executor: selo de tipo de instância, de
// versão em execução, de origem do executável e medidor de utilização.
//
// O que era genérico saiu daqui e vem do kit (@i-components): estado de tarefa
// é `StatusBadge`, cartão é `Panel`, contador é `Tile`, lista de propriedades é
// `KeyValueList`, vazio é `EmptyState`, busca é `SearchInput`. O que sobrou é o
// que só faz sentido dentro de um monitor de execução.

const KIND_META: any = {
    app:     { icon: "cube",                    label: "app" },
    desktop: { icon: "window maximize outline", label: "desktop" },
    cli:     { icon: "terminal",                label: "cli" },
    // Processo que se anunciou ao daemon sem ter sido lançado por ele (ex.: o
    // servidor MCP, subido pelo cliente de IA). O daemon observa, não controla.
    external: { icon: "plug",                   label: "externa" }
}

/**
 * "A versão que está rodando é a que está no disco?"
 *
 * O painel mostrava o pacote no ar sem dizer QUAL versão dele — e a pergunta
 * que se faz depois de um `repo update` é justamente essa. O daemon grava a
 * identidade da execução no attach; aqui ela vira um selo legível.
 */
export const VersionTag = ({ identity, installedVersion }: any) => {
    if(!identity) return null
    const running = identity.version
    if(!running) return <span className="iep-tag" title="o pacote não declara versão">sem versão</span>
    const outdated = installedVersion && installedVersion !== running
    return <span className={`iep-tag ${outdated ? "iep-tag--warn" : ""}`}
        title={outdated
            ? `em execução: ${running} · instalada agora: ${installedVersion} — reinicie para pegar a nova`
            : `versão em execução: ${running}`}>
        <Icon name={outdated ? "warning sign" : "tag"}/>
        v{running}{outdated ? ` (disco: ${installedVersion})` : ""}
    </span>
}

// De onde o processo está rodando: fonte provisionada, binário empacotado ou
// release baixado. É o que denuncia "está rodando o binário velho".
const ORIGIN_LABEL: any = {
    source: "fonte provisionada",
    "pkg-binary": "binário empacotado",
    release: "release"
}
export const OriginTag = ({ identity }: any) => {
    if(!identity || !identity.origin) return null
    return <span className="iep-tag" title={identity.executablePath || identity.packagePath}>
        <Icon name="hdd outline"/>
        {ORIGIN_LABEL[identity.origin] || identity.origin}
    </span>
}

export const KindTag = ({ kind }: any) => {
    const meta = KIND_META[kind] || { icon: "circle outline", label: kind || "—" }
    return <span className={`iep-tag iep-tag--${kind}`}>
        <Icon name={meta.icon}/>
        {meta.label}
    </span>
}

export const KindIcon = ({ kind, ...rest }: any) => {
    const meta = KIND_META[kind] || { icon: "circle outline" }
    return <Icon name={meta.icon} {...rest}/>
}

/**
 * Barra de utilização no espírito do htop.
 *
 * `percent` acima de 100 é possível e legítimo: CPU por processo é relativa a
 * UM núcleo, e um processo multithread passa de 100% sem nada de errado. A
 * barra satura visualmente, mas o número exibido continua o real — esconder
 * isso enganaria quem está diagnosticando consumo.
 *
 * Não é o `ProgressBar` do kit: aqui rótulo, barra e valor ficam na MESMA
 * linha, porque o medidor entra em célula de grid e em linha de lista, onde
 * não há altura para o rótulo acima da barra.
 */
export const Meter = ({ label, percent, value, tone }: any) => {
    const hasValue = percent !== undefined && percent !== null && !Number.isNaN(percent)
    const width    = hasValue ? Math.min(100, Math.max(0, percent)) : 0

    const severity = tone
        || (!hasValue ? "" : percent >= 90 ? "danger" : percent >= 70 ? "warning" : "")

    return <div className="iep-meter">
        {label && <span className="iep-meter__label">{label}</span>}
        <span className="iep-meter__track">
            <span
                className={`iep-meter__fill${severity ? ` iep-meter__fill--${severity}` : ""}`}
                style={{ width: `${width}%` }}/>
        </span>
        <span className="iep-meter__value">{value !== undefined ? value : hasValue ? `${percent.toFixed(0)}%` : "—"}</span>
    </div>
}
