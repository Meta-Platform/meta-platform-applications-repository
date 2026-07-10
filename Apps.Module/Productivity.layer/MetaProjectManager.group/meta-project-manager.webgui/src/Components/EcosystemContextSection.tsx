import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { EcosystemPackage, ItemPackage, PackageRole, WorkItem } from "../api/types"
import { ErrorBanner } from "./Primitives"

interface EcosystemContextSectionProps {
    item: WorkItem
    // Escopo do projeto: usado para sugerir os pacotes certos primeiro.
    scope?: { repository?: string; module?: string; layer?: string; group?: string }
    onChanged?: () => void
}

// "Onde eu mexo?" — a resposta na Meta Platform é um PACOTE dentro da hierarquia
// Repositório → Módulo → Camada → Grupo → Pacote. Um item real costuma atravessar
// vários (store, webservice, MCP, GUI), então a relação é N:N.
//
// A lista vem do catálogo indexado do disco: escolher de uma lista real evita o
// nome digitado errado, que é o que acontecia com os campos de texto livre.
const ROLE_LABEL: Record<PackageRole, string> = {
    primary: "principal",
    touched: "também muda"
}

const EcosystemContextSection = ({ item, scope, onChanged }: EcosystemContextSectionProps) => {
    const api = useApi()
    const [packages, setPackages] = useState<ItemPackage[]>(item.packages || [])
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<EcosystemPackage[]>([])
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const boxRef = useRef<HTMLDivElement>(null)

    useEffect(() => { setPackages(item.packages || []) }, [item.id, item.packages])

    // Sugestões do catálogo. Sem texto, mostra o que está no escopo do projeto.
    useEffect(() => {
        if (!open) return
        let alive = true
        const timer = setTimeout(() => {
            api.ecosystem.listPackages({
                text: query.trim() || undefined,
                group: query.trim() ? undefined : scope?.group,
                layer: query.trim() ? undefined : scope?.layer,
                limit: "12"
            })
                .then((l) => { if (alive) setResults(l || []) })
                .catch(() => { if (alive) setResults([]) })
        }, 160)
        return () => { alive = false; clearTimeout(timer) }
    }, [query, open, api, scope])

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
        }
        window.addEventListener("mousedown", onDown)
        return () => window.removeEventListener("mousedown", onDown)
    }, [open])

    const save = async (next: ItemPackage[]) => {
        setBusy(true); setError(null)
        try {
            const saved = await api.ecosystem.setItemPackages(item.id,
                next.map((p) => ({ package: p.ref, role: p.role, note: p.note })))
            setPackages(saved || [])
            onChanged && onChanged()
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const add = (pkg: EcosystemPackage) => {
        if (packages.some((p) => p.ref === pkg.ref)) { setOpen(false); setQuery(""); return }
        // O primeiro pacote escolhido é o principal; os demais, "também muda".
        const role: PackageRole = packages.length === 0 ? "primary" : "touched"
        save([...packages, { ...(pkg as any), ref: pkg.ref, role, workItemId: item.id } as ItemPackage])
        setQuery(""); setOpen(false)
    }

    const remove = (ref: string) => save(packages.filter((p) => p.ref !== ref))

    const toggleRole = (ref: string) =>
        save(packages.map((p) => p.ref === ref
            ? { ...p, role: p.role === "primary" ? "touched" : "primary" }
            : p))

    return <div className="mpm-col">
        <div className="mpm-section-title" title="Repositório → Módulo → Camada → Grupo → Pacote">
            <Icon name="cubes" /> Contexto do ecossistema
        </div>
        <ErrorBanner error={error} />

        {packages.length === 0
            ? <div className="mpm-muted" style={{ fontSize: "12px" }}>
                Nenhum pacote. Um item de plataforma quase sempre toca pelo menos um.
            </div>
            : <div className="mpm-col mpm-gap-2">
                {packages.map((p) =>
                    <div key={p.ref} className={`mpm-pkg ${p.role === "primary" ? "is-primary" : ""}`}>
                        <div className="mpm-pkg__main">
                            <div className="mpm-pkg__name">
                                <span className="mpm-chip mpm-chip--neutral" title="tipo do pacote">{p.packageType}</span>
                                <strong>{p.packageName}</strong>
                            </div>
                            <div className="mpm-pkg__path mpm-mono" title={p.ref}>
                                {[p.repositoryName, p.moduleName, p.layerName, p.groupName].filter(Boolean).join(" / ")}
                            </div>
                        </div>
                        <button className={`mpm-chip ${p.role === "primary" ? "mpm-chip--info" : "mpm-chip--neutral"}`}
                            title="Alternar entre principal e “também muda”"
                            disabled={busy} onClick={() => toggleRole(p.ref)}>
                            {ROLE_LABEL[p.role]}
                        </button>
                        <span className="mpm-iconbtn" title="Desvincular" onClick={() => remove(p.ref)}>
                            <Icon name="close" />
                        </span>
                    </div>)}
            </div>}

        <div className="mpm-pkg-picker" ref={boxRef}>
            <div className="mpm-row">
                <Icon name="search" className="mpm-muted" />
                <input className="mpm-input" style={{ flex: 1 }}
                    placeholder="Adicionar pacote (nome, grupo, camada, tipo…)"
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true) }} />
            </div>

            {open
                ? <div className="mpm-pkg-picker__menu">
                    {results.length === 0
                        ? <div className="mpm-muted" style={{ padding: "var(--mp-space-2) var(--mp-space-3)", fontSize: "12px" }}>
                            nenhum pacote encontrado
                        </div>
                        : results.map((pkg) =>
                            <div key={pkg.ref} className="mpm-pkg-picker__item" onClick={() => add(pkg)}>
                                <span className="mpm-chip mpm-chip--neutral">{pkg.packageType}</span>
                                <span className="mpm-pkg-picker__name">{pkg.packageName}</span>
                                <span className="mpm-pkg-picker__where mpm-mono mpm-muted">
                                    {[pkg.repositoryName, pkg.groupName || pkg.layerName].filter(Boolean).join(" / ")}
                                </span>
                            </div>)}
                </div>
                : null}
        </div>
    </div>
}

export default EcosystemContextSection
