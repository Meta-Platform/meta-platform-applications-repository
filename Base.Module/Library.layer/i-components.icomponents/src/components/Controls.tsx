import * as React from "react"
import Icon from "./Icon"

// Botões do design system (§7). Encapsulam a semântica de ação da plataforma
// em cima de <button> nativo + tokens --mp-*: o visual retro-brutalist (borda
// dura + sombra deslocada) não sai do CSS do Semantic, sai daqui.
//
// variantes:
//   primary   ação principal da tela (amarelo de acento)
//   default   ação secundária (superfície)
//   subtle    ação de baixa ênfase (sem borda até o hover)
//   danger    ação destrutiva
//   ghost     só ícone/texto, sem caixa (barras de ferramentas densas)
export type ButtonVariant = "primary" | "default" | "subtle" | "danger" | "ghost"
export type ButtonSize = "sm" | "md" | "lg"

type ButtonProps = {
    variant?: ButtonVariant
    size?: ButtonSize
    icon?: string
    trailingIcon?: string
    loading?: boolean
    block?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export const Button = ({
    variant = "default",
    size = "md",
    icon,
    trailingIcon,
    loading = false,
    block = false,
    disabled,
    className = "",
    children,
    ...props
}: ButtonProps) =>
    <button
        type="button"
        disabled={disabled || loading}
        className={[
            "mp-button",
            `mp-button--${variant}`,
            `mp-button--${size}`,
            block ? "is-block" : "",
            loading ? "is-loading" : "",
            className
        ].filter(Boolean).join(" ")}
        {...props}>
        { loading
            ? <Icon name="circle notch" className="mp-button__spin"/>
            : icon && <Icon name={icon}/> }
        { children && <span className="mp-button__label">{children}</span> }
        { trailingIcon && <Icon name={trailingIcon}/> }
    </button>

// Botão só-ícone: mesma altura dos demais controles, área de clique quadrada e
// `aria-label` OBRIGATÓRIO (o rótulo não existe visualmente).
type IconButtonProps = {
    icon: string
    label: string
    variant?: ButtonVariant
    size?: ButtonSize
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">

export const IconButton = ({ icon, label, variant = "subtle", size = "md", className = "", ...props }: IconButtonProps) =>
    <button
        type="button"
        aria-label={label}
        title={label}
        className={`mp-button mp-button--${variant} mp-button--${size} mp-button--icon ${className}`.trim()}
        {...props}>
        <Icon name={icon}/>
    </button>

// Agrupamento de ações adjacentes (colapsa as bordas internas).
export const ButtonGroup = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    <div role="group" className={`mp-button-group ${className}`.trim()} {...props}/>

// Barra de ferramentas: faixa horizontal de controles com separadores opcionais
// (`<Toolbar.Separator/>`) e empurrão à direita (`<Toolbar.Spacer/>`).
const ToolbarRoot = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    <div className={`mp-toolbar ${className}`.trim()} {...props}/>

const ToolbarSeparator = () => <span className="mp-toolbar__sep" aria-hidden="true"/>
const ToolbarSpacer = () => <span className="mp-toolbar__spacer"/>

export const Toolbar = Object.assign(ToolbarRoot, {
    Separator: ToolbarSeparator,
    Spacer: ToolbarSpacer
})
