// A JavaScript host for rayo.wasm and rayo-simd.wasm (wasm/build.sh). The
// modules import nothing, so this runs in Node, Deno, Bun, Workers and
// browsers alike. docs/WASM.md has an example.
//
//   const rayo = await loadRayo(bytesOrModule);
//   const model = rayo.open(weightsBytes);
//   const [out0, out1] = model.run([Int32Array.from(ids)], { binds: { T: 96 } });
//   model.close();

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();

// What a dtype of the outputs is read as: rayo's outputs are float32 unless
// the model says otherwise, so `run` returns Float32Array views by default.
const VIEWS = { f32: Float32Array, i32: Int32Array, u8: Uint8Array, i8: Int8Array };

// bytes: an ArrayBuffer, a typed array or a WebAssembly.Module.
export async function loadRayo(bytes) {
  const module =
    bytes instanceof WebAssembly.Module ? bytes : await WebAssembly.compile(bytes);
  return fromInstance(await WebAssembly.instantiate(module, {}));
}

export function fromInstance(instance) {
  const x = instance.exports;
  x._initialize();
  const memory = () => x.memory.buffer;
  const sizeSlot = x.rayo_wasm_alloc(4);
  const cstr = (p) => {
    const b = new Uint8Array(memory(), p);
    let n = 0;
    while (b[n]) n++;
    return fromUtf8.decode(b.subarray(0, n));
  };
  const fail = (what) => new Error(`rayo: ${what}: ${cstr(x.rayo_wasm_error())}`);
  const copyIn = (u8) => {
    const p = x.rayo_wasm_alloc(u8.length);
    if (!p) throw new Error("rayo: out of memory");
    new Uint8Array(memory(), p, u8.length).set(u8);
    return p;
  };
  const sizeOut = () => new Uint32Array(memory(), sizeSlot, 1)[0];

  return {
    exports: x,
    memoryBytes: () => memory().byteLength,
    // A model and a session for it; weights: the .weights file's bytes.
    open(weights) {
      const u8 = ArrayBuffer.isView(weights)
        ? new Uint8Array(weights.buffer, weights.byteOffset, weights.byteLength)
        : new Uint8Array(weights);
      const p = copyIn(u8);
      const h = x.rayo_wasm_open(p, u8.length);
      x.rayo_wasm_free(p); // rayo copied what it needs
      if (!h) throw fail("open");
      const bound = new Map();
      const outputs = x.rayo_wasm_outputs(h);
      return {
        inputs: x.rayo_wasm_inputs(h),
        outputs,
        kernels: () => cstr(x.rayo_wasm_kernels(h)),
        // inputs: one typed array per model input, in order, each exactly
        // the input's size at the bound dimensions. Returns a copy of each
        // output (Float32Array unless `as` names other views).
        run(inputs, { binds = {}, as = [] } = {}) {
          for (const [name, value] of Object.entries(binds)) {
            if (bound.get(name) === value) continue;
            const s = copyIn(utf8.encode(name + "\0"));
            const r = x.rayo_wasm_bind(h, s, value);
            x.rayo_wasm_free(s);
            if (r) throw fail(`bind ${name}=${value}`);
            bound.set(name, value);
          }
          inputs.forEach((arr, i) => {
            const p = x.rayo_wasm_input(h, i, sizeSlot);
            const n = sizeOut();
            if (!p) throw new Error(`rayo: no input ${i}`);
            if (n !== arr.byteLength) {
              throw new Error(`rayo: input ${i} is ${n} bytes, got ${arr.byteLength}`);
            }
            new Uint8Array(memory(), p, n).set(new Uint8Array(arr.buffer, arr.byteOffset, n));
          });
          if (x.rayo_wasm_run(h)) throw fail("run");
          const out = [];
          for (let i = 0; i < outputs; i++) {
            const p = x.rayo_wasm_output(h, i, sizeSlot);
            const n = sizeOut();
            const View = VIEWS[as[i] || "f32"];
            out.push(new View(memory().slice(p, p + n)));
          }
          return out;
        },
        close() {
          x.rayo_wasm_close(h);
        },
      };
    },
  };
}
