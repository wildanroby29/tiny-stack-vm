// tiny stack VM — exact ISA implementation (practice 1,000,000)
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode -> imm*16 + pops*4 + pushes (ISA.md + generator/subject/vm.mjs).
const T = { 0: 0, 1: 17, 2: 65, 3: 4, 4: 6, 5: 10, 6: 11, 7: 15, 16: 9, 17: 9, 18: 9, 19: 9, 20: 9, 21: 9, 22: 9, 23: 5, 24: 9, 25: 9, 26: 9, 27: 5, 28: 9, 29: 9, 30: 9, 32: 9, 33: 9, 34: 9, 48: 32, 49: 36, 50: 36, 51: 32, 52: 0, 64: 5, 65: 8, 80: 4, 81: 4, 82: 1, 83: 4 };

function run(p, q) {
  const D = new Int32Array(256);
  let s = 0;
  const C = new Int32Array(64);
  let c = 0;
  const M = new Int32Array(256);
  const o = new Uint8Array(65536);
  let l = 0, ip = 0, pc = 0, st = 0;
  const n = p.length;
  const enc = new TextEncoder();
  const done = (e) => ({ out: o.slice(0, l), code: e });
  for (;;) {
    if (st === 1000000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = p[pc];
    const t = T[op];
    if (t === undefined) return done(5);
    const imm = t >> 4, pops = (t >> 2) & 3, pushes = t & 3;
    if (pc + imm >= n) return done(9);
    st++;
    const nx = pc + 1 + imm;
    if (s < pops) return done(2);
    if (s - pops + pushes > 256) return done(3);
    pc = nx;
    switch (op) {
      case 0: return done(0);
      case 1: D[s++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[s++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const x = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = x; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const x = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = x; break; }
      case 23: D[s - 1] = -D[s - 1] | 0; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = D[s - 1], a = D[s - 2];
        let r;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (b === 0) return done(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (b === 0) return done(4); r = b === -1 ? 0 : a % b | 0; }
        else if (op === 21) { if (b === 0) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (b === 0) return done(4); r = (a >>> 0) % (b >>> 0) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = a >>> 0 < b >>> 0 ? 1 : 0;
        s -= 2; D[s++] = r;
        break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = D[--s]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (c === 64) return done(7);
        C[c++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 52:
        if (c === 0) return done(8);
        pc = C[--c];
        break;
      case 64: {
        const ad = D[s - 1];
        if (ad < 0 || ad >= 256) return done(6);
        D[s - 1] = M[ad];
        break;
      }
      case 65: {
        const ad = D[s - 1], v = D[s - 2];
        if (ad < 0 || ad >= 256) return done(6);
        s -= 2; M[ad] = v;
        break;
      }
      case 80: {
        const by = enc.encode(String(D[s - 1]));
        if (l + by.length > 65536) return done(11);
        s--; o.set(by, l); l += by.length;
        break;
      }
      case 81:
        if (l + 1 > 65536) return done(11);
        o[l++] = D[--s] & 255;
        break;
      case 82:
        D[s++] = ip < q.length ? q[ip++] : -1;
        break;
      case 83:
        return done(D[--s] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), r.code + '\n');
}
