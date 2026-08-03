// Registra o resolvedor de imports sem extensão (ver ts-resolver.mjs).
// Usado via `node --import ./test/register-resolver.mjs`.
import { register } from "node:module"

register("./ts-resolver.mjs", import.meta.url)
