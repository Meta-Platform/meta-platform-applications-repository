const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Health — adaptador HTTP fino sobre @/project-store.lib.
const HealthController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const Health = async () => {
        return { ok: true, status: "ok", service: "meta-project-manager" }
    }

    return {
        controllerName: "HealthController",
        Health
    }
}

module.exports = HealthController
