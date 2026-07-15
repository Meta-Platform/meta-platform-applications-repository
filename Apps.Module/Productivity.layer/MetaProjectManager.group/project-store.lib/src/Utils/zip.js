const zlib = require("zlib")

// Escritor de ZIP SEM dependência externa (Node >= 22: zlib.crc32 + deflateRawSync).
// Cobre o suficiente para exportar a documentação: arquivos DEFLATE, nomes UTF-8,
// diretórios implícitos (o path do nome carrega a árvore). Não faz ZIP64 — os
// exports de documentação ficam muito abaixo dos limites de 4 GB / 65535 entradas.
//
// entries: [{ name: "pasta/arquivo.md", data: Buffer|string }]
// retorna: Buffer do .zip

const DOS_TIME = 0            // hora fixa (00:00:00) — export é determinístico
const DOS_DATE = (2026 - 1980) << 9 | (1 << 5) | 1   // 2026-01-01

const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n >>> 0, 0); return b }
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b }

const BuildZip = (entries) => {
    const files = []
    const central = []
    let offset = 0

    for(const entry of entries){
        const nameBuf = Buffer.from(entry.name, "utf8")
        const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), "utf8")
        const crc = zlib.crc32(raw) >>> 0
        const deflated = zlib.deflateRawSync(raw)
        // Guarda o menor entre DEFLATE e STORE (dados já comprimidos podem inchar).
        const useStore = deflated.length >= raw.length
        const method = useStore ? 0 : 8
        const body = useStore ? raw : deflated

        const local = Buffer.concat([
            u32(0x04034b50),          // assinatura local file header
            u16(20),                  // versão necessária
            u16(0x0800),              // flags: nome em UTF-8
            u16(method),              // método de compressão
            u16(DOS_TIME), u16(DOS_DATE),
            u32(crc),
            u32(body.length),         // tamanho comprimido
            u32(raw.length),          // tamanho original
            u16(nameBuf.length),
            u16(0),                   // extra len
            nameBuf
        ])
        files.push(local, body)

        central.push(Buffer.concat([
            u32(0x02014b50),          // assinatura central directory
            u16(20),                  // versão de origem
            u16(20),                  // versão necessária
            u16(0x0800),
            u16(method),
            u16(DOS_TIME), u16(DOS_DATE),
            u32(crc),
            u32(body.length),
            u32(raw.length),
            u16(nameBuf.length),
            u16(0), u16(0),           // extra len, comment len
            u16(0),                   // disk number
            u16(0),                   // internal attrs
            u32(0),                   // external attrs
            u32(offset),              // deslocamento do local header
            nameBuf
        ]))

        offset += local.length + body.length
    }

    const centralBuf = Buffer.concat(central)
    const end = Buffer.concat([
        u32(0x06054b50),              // end of central directory
        u16(0), u16(0),               // disk numbers
        u16(entries.length), u16(entries.length),
        u32(centralBuf.length),
        u32(offset),                  // início do central directory
        u16(0)                        // comment len
    ])

    return Buffer.concat([...files, centralBuf, end])
}

module.exports = { BuildZip }
