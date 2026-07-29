import React from "react"
import { createRoot } from "react-dom/client"
import "semantic-ui-css/semantic.min.css"
import "@i-components/styles/index.css"
import "@instance-components/styles/index.css"
import "./catalog.css"
import { applySavedTheme } from "@i-components/theme"
import { App } from "./App"

applySavedTheme()
createRoot(document.getElementById("root")!).render(<App />)
