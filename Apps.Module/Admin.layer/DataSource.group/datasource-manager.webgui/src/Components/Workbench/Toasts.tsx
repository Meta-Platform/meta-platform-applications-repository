import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import { toast, Toast } from "../../Utils/toast"

// Pilha de toasts no canto inferior direito.
const Toasts = () => {
    const [items, setItems] = useState<Toast[]>([])
    useEffect(() => toast.subscribe(setItems), [])

    return <div className="ds-toasts">
        {items.map((t) =>
            <div key={t.id} className={`ds-toast ${t.kind}`}>
                <Icon name={t.kind === "ok" ? "check circle" : "warning circle"} fitted/>
                <span>{t.text}</span>
            </div>)}
    </div>
}

export default Toasts
