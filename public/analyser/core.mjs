// The analyser's engine, joined up: pdf.js for the characters, the app's
// Dart (compiled to wasm) for the statement and the categories, and rayo
// (wasm) for the categoriser model. Used by worker.mjs in the browser and by
// the golden tests in Node; nothing here touches the network except
// `load` reading the analyser's own files.
import { extractPages } from "./extract.mjs";
import { loadRayo } from "./rayo.mjs";

export { PasswordRequired, WrongPassword, Unreadable } from "./extract.mjs";

// Whether this engine has WebAssembly SIMD128, for rayo-simd.wasm.
const SIMD = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8,
  0, 65, 0, 253, 15, 253, 98, 11,
]);

// load(name) -> Promise<Uint8Array>: one of the analyser's files.
export async function createAnalyser(load, { simd } = {}) {
  const useSimd = simd ?? WebAssembly.validate(SIMD);
  const [pdfjs, worker, dart, engineWasm, rayoWasm, weights, manifest, labels] =
    await Promise.all([
      import("./pdf.min.mjs"),
      import("./pdf.worker.min.mjs"),
      import("./engine.mjs"),
      load("engine.wasm"),
      load(useSimd ? "rayo-simd.wasm" : "rayo.wasm"),
      load("categoriser.weights"),
      load("model-manifest.json"),
      load("labels.json"),
    ]);
  // pdf.js runs its parser on this thread (we already are a worker), from
  // the module just imported, instead of starting a worker of its own.
  globalThis.pdfjsWorker = worker;

  const app = await dart.compile(engineWasm);
  const instance = await app.instantiate({});
  instance.invokeMain();
  const engine = globalThis.pesaclarityEngine;

  const rayo = await loadRayo(rayoWasm);
  const model = rayo.open(weights);
  const outputSize = JSON.parse(text(labels)).labels.length;
  const refused = engine.loadModel(text(manifest), text(labels), {
    outputSize,
    run: (row) => model.run([row])[0],
  });

  return {
    kernels: model.kernels(),
    simd: useSimd,
    // Why the model was refused (the rules alone then categorise), or null.
    modelRefused: refused ?? null,
    // The pages as the engine sees them, for checks.
    async pages(bytes, password) {
      return extractPages(pdfjs, bytes, password);
    },
    // bytes: the PDF; throws PasswordRequired, WrongPassword or Unreadable.
    async analyse(bytes, password) {
      const pages = await extractPages(pdfjs, bytes, password);
      return JSON.parse(engine.analyse(JSON.stringify(pages)));
    },
    pageWords: (pages) => JSON.parse(engine.pageWords(JSON.stringify(pages))),
    pageText: (pages) => JSON.parse(engine.pageText(JSON.stringify(pages))),
    // input: an object, or its JSON text (to pass integers past 2^53 exactly).
    encodeFeatures: (input) =>
      JSON.parse(
        engine.encodeFeatures(
          typeof input === "string" ? input : JSON.stringify(input),
        ),
      ),
    encodeMessage: (message) => JSON.parse(engine.encodeMessage(message)),
    runCategoriser: (row) => Array.from(model.run([Int32Array.from(row)])[0]),
  };
}

const text = (u8) => new TextDecoder().decode(u8);
