import { GetSavedTheme, ApplyTheme, DEFAULT_THEME, HasExplicitTheme } from "../src/Utils/theme"

beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute("data-theme")
})

describe("tema padrão", () => {
    it("abre em grayscale quando ninguém escolheu nada", () => {
        expect(DEFAULT_THEME).toBe("gray")
        expect(GetSavedTheme()).toBe("gray")
    })

    it("um tema semeado pelo app antigo não conta como escolha", () => {
        // Versões anteriores gravavam "dark" no boot, sem o usuário pedir.
        window.localStorage.setItem("mp-theme", "dark")
        expect(HasExplicitTheme()).toBe(false)
        expect(GetSavedTheme()).toBe("gray")
    })

    it("a escolha do usuário sobrevive", () => {
        ApplyTheme("cyberpunk")
        expect(HasExplicitTheme()).toBe(true)
        expect(GetSavedTheme()).toBe("cyberpunk")
        expect(document.documentElement.getAttribute("data-theme")).toBe("cyberpunk")
    })

    it("light remove o atributo (é a base dos tokens)", () => {
        ApplyTheme("light")
        expect(document.documentElement.hasAttribute("data-theme")).toBe(false)
        expect(GetSavedTheme()).toBe("light")
    })
})
