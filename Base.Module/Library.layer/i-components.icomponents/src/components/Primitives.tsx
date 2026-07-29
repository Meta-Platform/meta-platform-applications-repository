import React, { type HTMLAttributes, type ButtonHTMLAttributes } from "react"

export const Surface = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) =>
    <div className={`mp-surface ${className}`.trim()} {...props} />

export const Stack = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) =>
    <div className={`mp-stack ${className}`.trim()} {...props} />

export const Badge = ({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) =>
    <span className={`mp-badge ${className}`.trim()} {...props} />

export const Button = ({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
    <button className={`mp-button ${className}`.trim()} {...props} />
