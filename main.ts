// Tiny stack VM (make.fun tiny-stack-vm-01, ISA v1): runs every program.bin
// in MAKEFUN_INPUT_DIR (default /input) on its input.bin, writes
// /output/<id>/stdout.bin + exit.txt. From ISA.md; reference VM: vm.mjs.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode table: [byte, immediate bytes, pops, pushes]. Absent = no opcode.
const T = new Uint8Array(256);
for (const q of [
  [0x00, 0, 0, 0], [0x01, 1, 0, 1], [0x02, 4, 0, 1], [0x03, 0, 1, 0],
  [0x04, 0, 1, 2], [0x05, 0, 2, 2], [0x06, 0, 2, 3], [0x07, 0, 3, 3],
  [0x10, 0, 2, 1], [0x11, 0, 2, 1], [0x12, 0, 2, 1], [0x13, 0, 2, 1],
  [0x14, 0, 2, 1], [0x15, 0, 2, 1], [0x16, 0, 2, 1], [0x17, 0, 1, 1],
  [0x18, 0, 2, 1], [0x19, 0, 2, 1], [0x1a, 0, 2, 1], [0x1b, 0, 1, 1],
  [0x1c, 0, 2, 1], [0x1d, 0, 2, 1], [0x1e, 0, 2, 1], [0x20, 0, 2, 1],
  [0x21, 0, 2, 1], [0x22, 0, 2, 1],
  [0x30, 2, 0, 0], [0x31, 2, 1, 0], [0x32, 2, 1, 0], [0x33, 2, 0, 0],
  [0x34, 0, 0, 0], [0x40, 0, 1, 1], [0x41, 0, 2, 0],
  [0x50, 0, 1, 0], [0x51, 0, 1, 0], [0x52, 0, 0, 1], [0x53, 0, 1, 0],
]) T[q[0]] = q[1] * 16 + q[2] * 4 + q[3] + 1;

// Run one program on its input. Returns [output bytes, exit code].
// Trap codes: 2 underflow, 3 overflow, 4 div by zero, 5 bad opcode,
// 6 bad memory address, 7 call depth, 8 empty RET, 9 bad pc, 10 steps, 11 output.
function run(p, inp) {
  const n = p.length, st = new Int32Array(256), cs = new Int32Array(64),
    mem = new Int32Array(256), out = [];
  let sp = 0, cp = 0, ip = 0, pc = 0, steps = 0;
  for (;;) {
    if (steps === 1000000) return [out, 10];
    if (pc < 0 || pc >= n) return [out, 9];
    const op = p[pc], t = T[op];
    if (!t) return [out, 5];
    const c = t - 1, imm = c >> 4, pops = (c >> 2) & 3, push = c & 3;
    if (pc + imm >= n) return [out, 9];
    steps++;
    const nx = pc + 1 + imm;
    if (sp < pops) return [out, 2];
    if (sp - pops + push > 256) return [out, 3];
    pc = nx;
    switch (op) {
      case 0x00: return [out, 0];
      case 0x01: st[sp++] = (p[nx - 1] << 24) >> 24; break; // PUSH8, sign-extended
      case 0x02: st[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 0x03: sp--; break;
      case 0x04: st[sp] = st[sp - 1]; sp++; break;
      case 0x05: { const v = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = v; break; }
      case 0x06: st[sp] = st[sp - 2]; sp++; break;
      case 0x07: { const a = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = a; break; }
      case 0x17: st[sp - 1] = -st[sp - 1] | 0; break;
      case 0x1b: st[sp - 1] = ~st[sp - 1]; break;
      case 0x30: case 0x31: case 0x32: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 0x30) { const v = st[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 0x33:
        if (cp === 64) return [out, 7];
        cs[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return [out, 8];
        pc = cs[--cp];
        break;
      case 0x40: {
        const a = st[sp - 1];
        if (a < 0 || a > 255) return [out, 6];
        st[sp - 1] = mem[a];
        break;
      }
      case 0x41: {
        const a = st[sp - 1], v = st[sp - 2];
        if (a < 0 || a > 255) return [out, 6];
        sp -= 2;
        mem[a] = v;
        break;
      }
      case 0x50: {
        const s = String(st[sp - 1]);
        if (out.length + s.length > 65536) return [out, 11];
        sp--;
        for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
        break;
      }
      case 0x51:
        if (out.length + 1 > 65536) return [out, 11];
        out.push(st[--sp] & 255);
        break;
      case 0x52: st[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 0x53: return [out, st[--sp] & 255];
      default: {
        const b = st[sp - 1], a = st[sp - 2];
        let r;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) {
          if (b === 0) return [out, 4];
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 0x14) {
          if (b === 0) return [out, 4];
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 0x15) {
          if (b === 0) return [out, 4];
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 0x16) {
          if (b === 0) return [out, 4];
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        st[sp++] = r;
        break;
      }
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  try {
    let prog, inp;
    try { prog = readFileSync(join(I, id, 'program.bin')); } catch { prog = Buffer.alloc(0); }
    try { inp = readFileSync(join(I, id, 'input.bin')); } catch { inp = Buffer.alloc(0); }
    const [o, e] = run(prog, inp);
    mkdirSync(join(O, id), { recursive: true });
    writeFileSync(join(O, id, 'stdout.bin'), Buffer.from(o));
    writeFileSync(join(O, id, 'exit.txt'), e + '\n');
  } catch { /* one bad instance must not lose the other 39 */ }
}
