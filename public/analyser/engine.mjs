// Compiles a dart2wasm-generated main module from `source` which can then
// be instantiated via the `instantiate` method.
//
// `source` needs to be a `Response` object (or promise thereof) e.g. created
// via the `fetch()` JS API.
export async function compileStreaming(source) {
  const builtins = {builtins: ['js-string'], importedStringConstants: ''};
  return new CompiledApp(
      await _compileStreaming(source, builtins), builtins);
}

// Compiles a dart2wasm-generated wasm module from `bytes` which is then
// instantiable via the `instantiate` method.
export async function compile(bytes) {
  const builtins = {builtins: ['js-string'], importedStringConstants: ''};
  return new CompiledApp(await WebAssembly.compile(bytes, builtins), builtins);
}

let _isCompileStreamingSupported;
async function _compileStreaming(source, builtins) {
  _isCompileStreamingSupported ??= WebAssembly.compileStreaming(
    new Response(
      new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,2,23,1,14,119,97,115,109,58,106,115,45,115,116,114,105,110,103,4,99,97,115,116,0,0]),
      {headers: {'Content-Type': 'application/wasm'}},
    ),
    builtins,
  ).then(() => false, (e) => e instanceof WebAssembly.CompileError);
  if (await _isCompileStreamingSupported) {
    return WebAssembly.compileStreaming(source, builtins);
  }
  return WebAssembly.compile(await (await source).arrayBuffer(), builtins);
}

class CompiledApp {
  constructor(module, builtins) {
    this.module = module;
    this.builtins = builtins;
  }

  // The second argument is an options object containing:
  // `loadDeferredModules` is a JS function that takes an array of module names
  //   matching wasm files produced by the dart2wasm compiler. It also takes a
  //   callback that should be invoked for each loaded module with 2 arguments:
  //   (1) the module name, (2) the loaded module in a format supported by
  //   `WebAssembly.compile` or `WebAssembly.compileStreaming`. The callback
  //   returns a Promise that resolves when the module is instantiated.
  //   loadDeferredModules should return a Promise that resolves when all the
  //   modules have been loaded and the callback promises have resolved.
  // `loadDeferredId` is a JS function that takes load ID produced by the
  //   compiler when the `use-load-ids` option is passed. Each load ID maps to
  //   one or more wasm files as specified in the emitted JSON file. It also
  //   takes a callback that should be invoked for each loaded module with 2
  //   arguments: (1) the module name, (2) the loaded module in a format
  //   supported by `WebAssembly.compile` or `WebAssembly.compileStreaming`.
  //   The callback returns a Promise that resolves when the module is
  //   instantiated.
  //   loadDeferredId should return a Promise that resolves when all the
  //   modules have been loaded and the callback promises have resolved.
  async instantiate(additionalImports, {loadDeferredModules, loadDeferredId} = {}) {
    let dartInstance;

    // Prints to the console
    function printToConsole(value) {
      if (typeof dartPrint == "function") {
        dartPrint(value);
        return;
      }
      if (typeof console == "object" && typeof console.log != "undefined") {
        console.log(value);
        return;
      }
      if (typeof print == "function") {
        print(value);
        return;
      }

      throw "Unable to print message: " + value;
    }

    // A special symbol attached to functions that wrap Dart functions.
    const jsWrappedDartFunctionSymbol = Symbol("JSWrappedDartFunction");

    function finalizeWrapper(dartFunction, wrapped) {
      wrapped.dartFunction = dartFunction;
      wrapped[jsWrappedDartFunctionSymbol] = true;
      return wrapped;
    }

    // Imports
    const dart2wasm = {
            AB: Function.prototype.call.bind(DataView.prototype.getUint32),
      B: s => printToConsole(s),
      BB: Function.prototype.call.bind(DataView.prototype.getInt32),
      C: Function.prototype.call.bind(Number.prototype.toString),
      CB: Function.prototype.call.bind(DataView.prototype.getUint16),
      D: Function.prototype.call.bind(BigInt.prototype.toString),
      DB: Function.prototype.call.bind(DataView.prototype.getInt16),
      E: (exn) => {
        let stackString = exn.toString();
        let frames = stackString.split('\n');
        let drop = 4;
        if (frames[0].startsWith('Error')) {
            drop += 1;
        }
        return frames.slice(drop).join('\n');
      },
      EB: Function.prototype.call.bind(DataView.prototype.getUint8),
      F: () => new Error().stack,
      FB: Function.prototype.call.bind(DataView.prototype.getInt8),
      G: s => JSON.stringify(s),
      GB: (o, i) => o[i],
      H: Function.prototype.call.bind(Number.prototype.toString),
      HB: o => o.length,
      I: Function.prototype.call.bind(String.prototype.indexOf),
      IB: o => {
        if (o === undefined) return 1;
        var type = typeof o;
        if (type === 'boolean') return 2;
        if (type === 'number') return 3;
        if (type === 'string') return 4;
        if (o instanceof Array) return 5;
        if (ArrayBuffer.isView(o)) {
          if (o instanceof Int8Array) return 6;
          if (o instanceof Uint8Array) return 7;
          if (o instanceof Uint8ClampedArray) return 8;
          if (o instanceof Int16Array) return 9;
          if (o instanceof Uint16Array) return 10;
          if (o instanceof Int32Array) return 11;
          if (o instanceof Uint32Array) return 12;
          if (o instanceof Float32Array) return 13;
          if (o instanceof Float64Array) return 14;
          if (o instanceof DataView) return 15;
        }
        if (o instanceof ArrayBuffer) return 16;
        // Feature check for `SharedArrayBuffer` before doing a type-check.
        if (globalThis.SharedArrayBuffer !== undefined &&
            o instanceof SharedArrayBuffer) {
            return 17;
        }
        if (o instanceof Promise) return 18;
        return 19;
      },
      J: (s, p, i) => s.lastIndexOf(p, i),
      JB: Function.prototype.call.bind(DataView.prototype.setFloat64),
      K: (exn) => {
        if (exn instanceof Error) {
          return exn.stack;
        } else {
          return null;
        }
      },
      KB: Function.prototype.call.bind(DataView.prototype.setFloat32),
      L: o => o === undefined,
      LB: Function.prototype.call.bind(DataView.prototype.setInt32),
      M: o => String(o),
      MB: Function.prototype.call.bind(DataView.prototype.setUint32),
      N: (wasmFunction,f) => finalizeWrapper(f, function(x0,x1,x2) { return wasmFunction(f,arguments.length,x0,x1,x2) }),
      NB: Function.prototype.call.bind(DataView.prototype.setInt16),
      O: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      OB: Function.prototype.call.bind(DataView.prototype.setUint16),
      P: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      PB: Function.prototype.call.bind(DataView.prototype.setUint8),
      Q: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      QB: Function.prototype.call.bind(DataView.prototype.setInt8),
      R: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      RB: o => o.buffer,
      S: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      SB: (s) => +s,
      T: () => globalThis,
      TB: s => {
        if (!/^\s*[+-]?(?:Infinity|NaN|(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][+-]?\d+)?)\s*$/.test(s)) {
          return NaN;
        }
        return parseFloat(s);
      },
      U: (l, r) => l === r,
      UB: s => s.trim(),
      V: x0 => x0.random(),
      VB: s => s.toUpperCase(),
      W: o => o,
      WB: Object.is,
      X: o => {
        if (o === undefined || o === null) return 0;
        if (typeof o === 'number') return 1;
        return 2;
      },
      XB: (o, p, r) => o.replace(p, () => r),
      Y: () => globalThis.Math,
      YB: (o, p, r) => o.replaceAll(p, () => r),
      Z: (x0,x1) => x0.test(x1),
      ZB: (o, p) => p in o,
      a: o => o,
      aB: (o, p) => o[p],
      b: o => {
        if (o === undefined || o === null) return 0;
        if (typeof o === 'boolean') return 1;
        return 2;
      },
      bB: x0 => x0.groups,
      c: (x0,x1) => x0[x1],
      cB: x0 => globalThis.Object.keys(x0),
      d: o => o,
      dB: Function.prototype.call.bind(String.prototype.toLowerCase),
      e: x0 => x0.index,
      eB: o => o.byteOffset,
      f: x0 => x0.length,
      fB: (o, offsetInBytes, lengthInBytes) => {
        var dst = new ArrayBuffer(lengthInBytes);
        new Uint8Array(dst).set(new Uint8Array(o, offsetInBytes, lengthInBytes));
        return new DataView(dst);
      },
      g: x0 => x0.unicode,
      gB: (string, token) => string.split(token),
      h: (x0,x1) => x0.exec(x1),
      hB: o => o instanceof Array,
      i: (x0,x1) => { x0.lastIndex = x1 },
      iB: (a, i) => a[i],
      j: (s, m) => {
        try {
          return new RegExp(s, m);
        } catch (e) {
          return String(e);
        }
      },
      jB: (a, s, e) => a.slice(s, e),
      k: o => o instanceof RegExp,
      kB: (a, s) => a.join(s),
      l: (string, times) => string.repeat(times),
      lB: (a, i, v) => a[i] = v,
      m: x0 => x0.dotAll,
      mB: a => a.length,
      n: x0 => x0.ignoreCase,
      nB: s => {
        if (/[[\]{}()*+?.\\^$|]/.test(s)) {
            s = s.replace(/[[\]{}()*+?.\\^$|]/g, '\\$&');
        }
        return s;
      },
      o: x0 => x0.multiline,
      oB: () => {
        return typeof process != "undefined" &&
               Object.prototype.toString.call(process) == "[object process]" &&
               process.platform == "win32"
      },
      p: x0 => x0.flags,
      pB: () => {
        // On browsers return `globalThis.location.href`
        if (globalThis.location != null) {
          return globalThis.location.href;
        }
        return null;
      },
      q: o => typeof o === 'function' && o[jsWrappedDartFunctionSymbol] === true,
      qB: (x0,x1) => x0.run(x1),
      r: f => f.dartFunction,
      rB: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Float32Array) return 1;
        return 2;
      },
      s: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      sB: x0 => new Int32Array(x0),
      t: (wasmFunction,f) => finalizeWrapper(f, function(x0,x1) { return wasmFunction(f,arguments.length,x0,x1) }),
      tB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmI32ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      u: (p, s, f) => p.then(s, (e) => f(e, e === undefined)),
      uB: (o, p, v) => o[p] = v,
      v: (c) =>
      queueMicrotask(() => dartInstance.exports.$invokeCallback(c)),
      vB: x0 => x0.outputSize,
      w: Function.prototype.call.bind(Object.getOwnPropertyDescriptor(DataView.prototype, 'byteLength').get),
      wB: () => ({}),
      x: (o) => new DataView(o.buffer, o.byteOffset, o.byteLength),
      y: Function.prototype.call.bind(DataView.prototype.getFloat64),
      z: Function.prototype.call.bind(DataView.prototype.getFloat32),

    };

    const baseImports = {
      _: dart2wasm,
      Math: Math,
      Date: Date,
      Object: Object,
      Array: Array,
      Reflect: Reflect,
      WebAssembly: {
        JSTag: WebAssembly.JSTag,
      },
      "": new Proxy({}, { get(_, prop) { return prop; } }),

    };

    

    dartInstance = await WebAssembly.instantiate(this.module, {
      ...baseImports,
      ...additionalImports,
      
    });

    return new InstantiatedApp(this, dartInstance);
  }
}

class InstantiatedApp {
  constructor(compiledApp, instantiatedModule) {
    this.compiledApp = compiledApp;
    this.instantiatedModule = instantiatedModule;
  }

  // Call the main function with the given arguments.
  invokeMain(...args) {
    this.instantiatedModule.exports.$invokeMain(args);
  }
}
