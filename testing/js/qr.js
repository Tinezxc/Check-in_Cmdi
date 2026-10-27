
(() => {
'use strict';

/* ---------- Galois field tables for Reed–Solomon ---------- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

/* Generator polynomial of given degree for RS encoding */
function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
        const next = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
            next[j] ^= poly[j];
            next[j + 1] ^= gmul(poly[j], EXP[i]);
        }
        poly = next;
    }
    return poly;
}

function rsEncode(data, ecCount) {
    const gen = rsGenerator(ecCount);
    const buf = new Uint8Array(data.length + ecCount);
    buf.set(data);
    for (let i = 0; i < data.length; i++) {
        const coef = buf[i];
        if (coef !== 0) {
            for (let j = 0; j < gen.length; j++) {
                buf[i + j] ^= gmul(gen[j], coef);
            }
        }
    }
    return buf.slice(data.length);
}

/* ---------- Version / capacity tables ----------
   Format: [version, { L, M, Q, H }] where each is { ecPerBlock, groups: [[count, dataPerBlock], ...] } */
const VERSIONS = {
    1:  { M: { ec: 10, groups: [[1, 16]] } },
    2:  { M: { ec: 16, groups: [[1, 28]] } },
    3:  { M: { ec: 26, groups: [[1, 44]] } },
    4:  { M: { ec: 18, groups: [[2, 32]] } },
    5:  { M: { ec: 24, groups: [[2, 43]] } },
    6:  { M: { ec: 16, groups: [[4, 27]] } },
    7:  { M: { ec: 18, groups: [[4, 31]] } },
    8:  { M: { ec: 22, groups: [[2, 38], [2, 39]] } },
    9:  { M: { ec: 22, groups: [[3, 36], [2, 37]] } },
    10: { M: { ec: 26, groups: [[4, 43], [1, 44]] } }
};

function pickVersion(len) {
    for (let v = 1; v <= 10; v++) {
        const spec = VERSIONS[v].M;
        const dataCap = spec.groups.reduce((s, [c, d]) => s + c * d, 0);
        // header: 4 bits mode + 8 or 16 bits length. v1–9 = 8 bits, v10+ = 16 bits
        const headerBits = 4 + (v <= 9 ? 8 : 16);
        if (headerBits + len * 8 <= dataCap * 8) return v;
    }
    return null;
}

/* ---------- Bit buffer ---------- */
function toBits(bytes) {
    const bits = [];
    for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    return bits;
}

function encodeData(bytes, version) {
    const spec = VERSIONS[version].M;
    const dataCap = spec.groups.reduce((s, [c, d]) => s + c * d, 0);

    // mode indicator = 0100 (byte)
    const bits = [0, 1, 0, 0];
    // length: 8 bits for v1–9, 16 for v10
    const lenBits = version <= 9 ? 8 : 16;
    for (let i = lenBits - 1; i >= 0; i--) bits.push((bytes.length >> i) & 1);
    bits.push(...toBits(bytes));

    // terminator
    const term = Math.min(4, dataCap * 8 - bits.length);
    for (let i = 0; i < term; i++) bits.push(0);

    // pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // pad with 0xEC, 0x11 alternating
    const out = new Uint8Array(dataCap);
    for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
        out[i / 8] = b;
    }
    let pad = 0;
    for (let i = bits.length / 8; i < dataCap; i++) {
        out[i] = pad % 2 === 0 ? 0xEC : 0x11;
        pad++;
    }
    return out;
}

/* ---------- Split into blocks and RS encode ---------- */
function splitAndEncode(data, version) {
    const spec = VERSIONS[version].M;
    const blocks = [];
    let off = 0;
    for (const [count, perBlock] of spec.groups) {
        for (let i = 0; i < count; i++) {
            const chunk = data.slice(off, off + perBlock);
            off += perBlock;
            blocks.push({ data: chunk, ec: rsEncode(chunk, spec.ec) });
        }
    }
    // interleave data
    const interleaved = [];
    const maxData = Math.max(...blocks.map(b => b.data.length));
    for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) interleaved.push(b.data[i]);
    const maxEc = Math.max(...blocks.map(b => b.ec.length));
    for (let i = 0; i < maxEc; i++) for (const b of blocks) if (i < b.ec.length) interleaved.push(b.ec[i]);
    return new Uint8Array(interleaved);
}

/* ---------- Matrix construction ---------- */
function newMatrix(size) {
    const m = Array.from({ length: size }, () => new Uint8Array(size));
    const r = Array.from({ length: size }, () => new Uint8Array(size));
    return { m, r };
}

function placeFinder(m, r, row, col) {
    for (let y = -1; y <= 7; y++) {
        for (let x = -1; x <= 7; x++) {
            const yy = row + y, xx = col + x;
            if (yy < 0 || yy >= m.length || xx < 0 || xx >= m.length) continue;
            const inRing = (y >= 0 && y <= 6 && x >= 0 && x <= 6) && (y === 0 || y === 6 || x === 0 || x === 6);
            const inCore = (y >= 2 && y <= 4 && x >= 2 && x <= 4);
            m[yy][xx] = (inRing || inCore) ? 1 : 0;
            r[yy][xx] = 1;
        }
    }
}

function placeAlignment(m, r, row, col) {
    for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
            const yy = row + y, xx = col + x;
            const on = (Math.abs(y) === 2 || Math.abs(x) === 2) || (y === 0 && x === 0);
            m[yy][xx] = on ? 1 : 0;
            r[yy][xx] = 1;
        }
    }
}

const ALIGN_POS = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

function buildMatrix(dataBytes, version) {
    const size = 17 + version * 4;
    const { m, r } = newMatrix(size);

    // finder patterns
    placeFinder(m, r, 0, 0);
    placeFinder(m, r, 0, size - 7);
    placeFinder(m, r, size - 7, 0);
    // separators + timing
    for (let i = 8; i < size - 8; i++) {
        if (!r[6][i]) { m[6][i] = (i % 2 === 0) ? 1 : 0; r[6][i] = 1; }
        if (!r[i][6]) { m[i][6] = (i % 2 === 0) ? 1 : 0; r[i][6] = 1; }
    }
    // alignment
    const pos = ALIGN_POS[version];
    for (const y of pos) for (const x of pos) {
        if (!r[y] || !r[y][x]) placeAlignment(m, r, y, x);
    }
    // dark module
    m[size - 8][8] = 1; r[size - 8][8] = 1;
    // reserve format areas
    for (let i = 0; i < 9; i++) {
        if (!r[8][i]) r[8][i] = 1;
        if (!r[i][8]) r[i][8] = 1;
        if (!r[8][size - 1 - i]) r[8][size - 1 - i] = 1;
        if (!r[size - 1 - i][8]) r[size - 1 - i][8] = 1;
    }
    r[size - 8][8] = 1;
    r[8][8] = 1;
    // version info for v7+
    if (version >= 7) {
        const vbits = version;
        let acc = 0;
        for (let i = 0; i < 12; i++) acc = (acc << 1) | ((vbits >> i) & 1);
        let rem = acc;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
        const full = (acc << 12) | (rem & 0xFFF);
        for (let i = 0; i < 18; i++) {
            const bit = (full >> i) & 1;
            const a = Math.floor(i / 3), b = i % 3;
            m[size - 11 + b][a] = bit;
            r[size - 11 + b][a] = 1;
            m[a][size - 11 + b] = bit;
            r[a][size - 11 + b] = 1;
        }
    }

    // place data bits in zigzag
    let bitIdx = 0;
    const totalBits = dataBytes.length * 8;
    let up = true;
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--; // skip timing column
        for (let i = 0; i < size; i++) {
            const row = up ? (size - 1 - i) : i;
            for (let c = 0; c < 2; c++) {
                const xx = col - c;
                if (r[row][xx]) continue;
                if (bitIdx < totalBits) {
                    const byte = dataBytes[bitIdx >> 3];
                    m[row][xx] = (byte >> (7 - (bitIdx & 7))) & 1;
                    bitIdx++;
                } else {
                    m[row][xx] = 0;
                }
            }
        }
        up = !up;
    }

    // mask selection: use mask 0 (checkerboard) — good enough for demo
    const maskFn = (y, x) => (y + x) % 2 === 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (!r[y][x]) m[y][x] ^= maskFn(y, x) ? 1 : 0;
        }
    }

    // format info (mask 0)
    const EC_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
    const formatData = (EC_BITS.M << 3) | 0; // mask 0
    let fmt = formatData << 10;
    for (let i = 14; i >= 10; i--) if ((fmt >> i) & 1) fmt ^= 0x537 << (i - 10);
    fmt = ((formatData << 10) | fmt) ^ 0x5412;
    for (let i = 0; i < 15; i++) {
        const bit = (fmt >> i) & 1;
        // top-left
        if (i < 6) m[8][i] = bit;
        else if (i < 8) m[8][i + 1] = bit;
        else if (i === 8) m[7][8] = bit;
        else m[14 - i][8] = bit;
        // copy to other areas
        if (i < 8) m[size - 1 - i][8] = bit;
        else m[8][size - 15 + i] = bit;
    }
    m[size - 8][8] = 1;

    return m;
}

/* ---------- Public API ---------- */
function build(text) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(String(text));
    const version = pickVersion(bytes.length);
    if (!version) return null;
    const data = encodeData(bytes, version);
    const interleaved = splitAndEncode(data, version);
    return buildMatrix(interleaved, version);
}

function svg(text, size = 240) {
    const m = build(text);
    if (!m) return null;
    const n = m.length;
    const quiet = 4;
    const total = n + quiet * 2;
    const scale = size / total;
    let path = '';
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (m[y][x]) {
                path += `M${(x + quiet) * scale} ${(y + quiet) * scale}h${scale}v${scale}h${-scale}z`;
            }
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="Guest QR code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#111"/></svg>`;
}

function dataURL(text, size = 512) {
    const m = build(text);
    if (!m) return null;
    const n = m.length;
    const quiet = 4;
    const total = n + quiet * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#111';
    const cell = size / total;
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (m[y][x]) ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell + 0.5, cell + 0.5);
        }
    }
    return canvas.toDataURL('image/png');
}

window.QR = {
    svg,
    dataURL,
    isSupported: (text) => build(text) !== null
};
})();