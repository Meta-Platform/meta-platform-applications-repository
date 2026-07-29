import React, { type HTMLAttributes } from "react"

// Primitivas estruturais. Os controles (Button, Icon, Input…) ficam em
// Controls.tsx / Inputs.tsx — aqui vivem só os invólucros de layout.
export const Surface = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) =>
    <div className={`mp-surface ${className}`.trim()} {...props} />

export const Stack = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) =>
    <div className={`mp-stack ${className}`.trim()} {...props} />

export const Badge = ({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) =>
    <span className={`mp-badge ${className}`.trim()} {...props} />
