import "@testing-library/jest-dom"

// jsdom não implementa matchMedia (usado pelo layout responsivo do explorador).
if(!window.matchMedia)
    (window as any).matchMedia = (query:string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false
    })

// ResizeObserver é exigido por componentes de layout/diagrama.
if(!(window as any).ResizeObserver)
    (window as any).ResizeObserver = class {
        observe(){}
        unobserve(){}
        disconnect(){}
    }
