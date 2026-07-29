import * as React from "react"
import Icon from "./Icon"

// Controles de entrada do design system (§7.4). Todos compartilham a mesma
// altura, borda e foco (outline de acento), e todos aceitam o par
// rótulo/mensagem de erro por `FormField` — os aplicativos não montam mais
// <Form.Field> do Semantic caso a caso.

type FieldProps = {
    label?: string
    hint?: string
    error?: string
    required?: boolean
    htmlFor?: string
    children: React.ReactNode
}

export const FormField = ({ label, hint, error, required, htmlFor, children }: FieldProps) =>
    <div className={`mp-field ${error ? "has-error" : ""}`.trim()}>
        { label &&
            <label className="mp-field__label" htmlFor={htmlFor}>
                {label}
                { required && <span className="mp-field__required" aria-hidden="true">*</span> }
            </label> }
        <div className="mp-field__control">{children}</div>
        { error
            ? <div className="mp-field__error" role="alert">{error}</div>
            : hint && <div className="mp-field__hint">{hint}</div> }
    </div>

export const TextInput = ({ className = "", invalid = false, ...props }: any) =>
    <input
        type="text"
        className={`mp-input ${invalid ? "is-invalid" : ""} ${className}`.trim()}
        {...props}/>

export const TextArea = ({ className = "", invalid = false, rows = 4, ...props }: any) =>
    <textarea
        rows={rows}
        className={`mp-input mp-input--area ${invalid ? "is-invalid" : ""} ${className}`.trim()}
        {...props}/>

// options: [{ value, label, disabled }] — a lista chega como DADO, não como
// árvore de <Dropdown.Item>, para que a mesma fonte alimente form e catálogo.
export type SelectOption = { value: string, label: string, disabled?: boolean }

export const SelectInput = ({ options = [], placeholder, className = "", invalid = false, ...props }: any) =>
    <div className={`mp-select ${invalid ? "is-invalid" : ""} ${className}`.trim()}>
        <select className="mp-select__el" {...props}>
            { placeholder && <option value="">{placeholder}</option> }
            { (options as SelectOption[]).map((option) =>
                <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                </option>) }
        </select>
        <Icon name="chevron down" className="mp-select__caret" tone="muted"/>
    </div>

export const CheckboxInput = ({ label, className = "", ...props }: any) =>
    <label className={`mp-checkbox ${className}`.trim()}>
        <input type="checkbox" {...props}/>
        <span className="mp-checkbox__box" aria-hidden="true"><Icon name="check"/></span>
        { label && <span className="mp-checkbox__label">{label}</span> }
    </label>

export const RadioInput = ({ label, className = "", ...props }: any) =>
    <label className={`mp-checkbox mp-checkbox--radio ${className}`.trim()}>
        <input type="radio" {...props}/>
        <span className="mp-checkbox__box" aria-hidden="true"/>
        { label && <span className="mp-checkbox__label">{label}</span> }
    </label>

// Busca com ícone embutido e botão de limpar — o padrão que cada app
// reimplementava (explorer, board, catálogo de pacotes).
export const SearchInput = ({ value, onValueChange, placeholder = "Buscar…", className = "", ...props }: any) =>
    <div className={`mp-search ${className}`.trim()}>
        <Icon name="search" tone="muted" className="mp-search__icon"/>
        <input
            type="search"
            className="mp-search__el"
            value={value}
            placeholder={placeholder}
            onChange={(event) => onValueChange && onValueChange(event.target.value)}
            {...props}/>
        { value
            ? <button
                type="button"
                className="mp-search__clear"
                aria-label="limpar busca"
                onClick={() => onValueChange && onValueChange("")}>
                <Icon name="times"/>
            </button>
            : null }
    </div>
