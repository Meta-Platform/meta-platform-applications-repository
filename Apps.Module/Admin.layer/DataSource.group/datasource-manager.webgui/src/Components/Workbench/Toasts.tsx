import * as React from "react"
import { useEffect, useState } from "react"

import { ToastStack, ToastItem } from "@i-components"

import { toast, Toast } from "../../Utils/toast"

// Pilha de toasts no canto inferior direito. A vida do aviso continua sendo do
// aplicativo (Utils/toast); a apresentação é a do kit.
const Toasts = () => {

    const [items, setItems] = useState<Toast[]>([])

    useEffect(() => toast.subscribe(setItems), [])

    const stack:ToastItem[] = items.map((t) => ({
        id      : String(t.id),
        tone    : t.kind === "ok" ? "success" : "danger",
        message : t.text
    }))

    return <ToastStack toasts={stack}/>
}

export default Toasts
