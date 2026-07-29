import React from "react"
import { createRoot } from "react-dom/client"
// semantic.css (não o .min): é a folha que os demais WebGui usam e a que
// resolve as fontes de ícone no build do webpack.
import "semantic-ui-css/semantic.css"
import "@i-components/styles/index.css"
import "@instance-components/styles/index.css"
import "./catalog.css"
import { applySavedTheme } from "@i-components/theme"
import { App } from "./App"

applySavedTheme()
createRoot(document.getElementById("root")!).render(<App />)
