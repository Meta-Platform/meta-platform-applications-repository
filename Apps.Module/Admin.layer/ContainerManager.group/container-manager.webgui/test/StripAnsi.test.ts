/*
    Contrato da limpeza de ANSI (CTMG-21).

    Existe porque um prompt de bash REAL, visto na tela, expôs um defeito de
    ordem: o padrão de CSI aceita `]`, dígitos e `;` no meio, então ele casava
    o começo de uma sequência OSC (`ESC ] 0 ; título BEL`, que o bash usa para
    nomear a janela) e consumia como terminador a PRIMEIRA letra do título —
    que é texto do usuário. O prompt `myecosystem@...` aparecia como
    `yecosystem@...`, com o resto da sequência sobrando na tela.

    Limpar demais é pior do que não limpar: some com informação sem avisar.

    Rodar com: npm test
*/
import assert from "node:assert/strict"
import test from "node:test"

import { StripAnsi } from "../src/Utils/StripAnsi.ts"

const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)

test("o título OSC some inteiro, sem comer a letra seguinte", () => {
    const prompt = `${ESC}]0;myecosystem@d493dc9eff32: ~${BEL}myecosystem@d493dc9eff32:~$ `
    assert.equal(StripAnsi(prompt), "myecosystem@d493dc9eff32:~$ ")
})

test("bracketed paste some por inteiro", () => {
    assert.equal(StripAnsi(`${ESC}[?2004hcomando${ESC}[?2004l`), "comando")
})

test("cor some e o texto fica", () => {
    assert.equal(StripAnsi(`${ESC}[32mverde${ESC}[0m`), "verde")
})

test("limpeza de linha e movimento de cursor somem", () => {
    assert.equal(StripAnsi(`${ESC}[2K${ESC}[1Gprompt`), "prompt")
})

test("OSC cortado no fim do fluxo não deixa resto na tela", () => {
    // O stream pode terminar no meio de uma sequência: sem esta regra, o
    // pedaço solto apareceria como lixo.
    assert.equal(StripAnsi(`saida${ESC}]0;titulo sem fim`), "saida")
})

test("texto sem ANSI passa intacto, inclusive acentuado", () => {
    assert.equal(StripAnsi("conexão estabelecida\n"), "conexão estabelecida\n")
})

test("valor que não é texto não quebra a limpeza", () => {
    assert.equal(StripAnsi(undefined as any), "")
    assert.equal(StripAnsi(null as any), "")
})
