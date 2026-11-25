// The web analyser's engine against the app (decision 0034): the same
// transactions and categories as the app on the synthetic statements, the
// same encoder output as the app's own test vectors, and the committed
// build matching analyser/build.json. All statements here are made up.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const json = (path) => JSON.parse(read(path));
const load = async (name) => new Uint8Array(read(`public/analyser/${name}`));

const { createAnalyser, PasswordRequired, WrongPassword } = await import(
  new URL("public/analyser/core.mjs", root)
);
const analysers = {
  simd: await createAnalyser(load, { simd: true }),
  generic: await createAnalyser(load, { simd: false }),
};

test("the committed build is the one analyser/build.json lists", () => {
  const want = json("analyser/build.json").files;
  const names = readdirSync(new URL("public/analyser/", root)).sort();
  assert.deepEqual(names, Object.keys(want).sort());
  for (const name of names) {
    const sha = createHash("sha256")
      .update(read(`public/analyser/${name}`))
      .digest("hex");
    assert.equal(sha, want[name], name);
  }
});

test("the app's model loads, on the kernel asked for", () => {
  for (const [kind, a] of Object.entries(analysers)) {
    assert.equal(a.modelRefused, null, kind);
    assert.equal(a.simd, kind === "simd");
  }
});

const statements = json("analyser/fixtures/statements.json");
for (const { file, password } of statements) {
  const golden = json(
    `analyser/goldens/${file.replace(".pdf", ".golden.json")}`,
  );
  for (const [kind, analyser] of Object.entries(analysers)) {
    test(`${file} (${kind}): the app's transactions and categories`, async () => {
      const bytes = () => new Uint8Array(read(`analyser/fixtures/${file}`));
      if (password) {
        await assert.rejects(analyser.analyse(bytes()), PasswordRequired);
        await assert.rejects(
          analyser.analyse(bytes(), `${password}9`),
          WrongPassword,
        );
      }
      const got = await analyser.analyse(bytes(), password);
      assert.equal(got.status, "read");
      assert.equal(got.institution, golden.institution);
      for (const k of [
        "periodStart",
        "periodEnd",
        "openingBalanceMinor",
        "closingBalanceMinor",
        "unreadCount",
      ]) {
        assert.equal(got[k], golden[k], k);
      }
      assert.equal(
        got.transactions.length,
        golden.transactions.length,
        "count",
      );
      got.transactions.forEach((t, i) => {
        const want = golden.transactions[i];
        const { confidence, ...rest } = t;
        const { confidence: wantConfidence, ...wantRest } = want;
        assert.deepEqual(rest, wantRest, `transaction ${i}`);
        // float32 outputs, bit for bit: the JSON double of the same float.
        assert.equal(confidence, wantConfidence, `confidence ${i}`);
      });
    });
  }
}

test("a file that is not a PDF is unreadable", async () => {
  await assert.rejects(
    analysers.simd.analyse(new TextEncoder().encode("not a pdf")),
    (e) => e.constructor.name === "Unreadable",
  );
});

// pesaclarity-app test/fixtures, copied unchanged.
test("categoriser encoder: the app's feature vectors", () => {
  // Integers past 2^53 (amount_int64_max) kept exact, as the engine reads
  // them: as BigInt here, and written back as the same digits.
  const vectors = JSON.parse(
    read("analyser/goldens/app/feature_vectors.v1.json"),
    (k, v, ctx) =>
      Number.isInteger(v) && !Number.isSafeInteger(v) ? BigInt(ctx.source) : v,
  );
  const exact = (input) =>
    JSON.stringify(input, (k, v) =>
      typeof v === "bigint" ? `#${v}#` : v,
    ).replace(/"#(-?\d+)#"/g, "$1");
  assert.equal(vectors.cases.length, 60);
  for (const c of vectors.cases) {
    const got = analysers.simd.encodeFeatures(exact(c.input));
    assert.deepEqual(got.tokens, c.expected.tokens, c.id);
    assert.deepEqual(got.features, c.expected.features, c.id);
  }
});

test("message reader encoder: the app's reader vectors", () => {
  const vectors = json("analyser/goldens/app/reader_vectors.v1.json");
  for (const c of vectors.cases) {
    const got = analysers.simd.encodeMessage(c.message);
    assert.equal(got.token_count, c.expected.token_count, c.id);
    c.expected.tokens.forEach((want, i) =>
      assert.deepEqual(got.tokens[i], want, `${c.id} ${i}`),
    );
    assert.deepEqual(got.input, c.expected.input, c.id);
  }
});

test("categoriser on rayo wasm: the app's recorded outputs, bit for bit", () => {
  const { readings } = json("analyser/goldens/app/categoriser_decodes.json");
  assert.equal(readings.length, 60);
  for (const [kind, a] of Object.entries(analysers)) {
    for (const r of readings) {
      const got = a.runCategoriser(r.input);
      // The goldens print each float32 in its shortest decimal form.
      assert.deepEqual(got, r.category.map(Math.fround), `${kind} ${r.id}`);
    }
  }
});

test("lib/app is the app's code unchanged (analyser/engine/app_sources.json)", () => {
  const { files } = json("analyser/engine/app_sources.json");
  const sha = (path) => createHash("sha256").update(read(path)).digest("hex");
  for (const [path, want] of Object.entries(files)) {
    const file = /^(models|goldens)\//.test(path)
      ? `analyser/${path}`
      : `analyser/engine/lib/app/${path}`;
    assert.equal(sha(file), want, path);
  }
  const listed = new Set(
    Object.keys(files).filter((p) => !/^(models|goldens)\//.test(p)),
  );
  const walk = (dir, prefix = "") =>
    readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(`${dir}${e.name}/`, `${prefix}${e.name}/`)
        : [`${prefix}${e.name}`],
    );
  assert.deepEqual(walk("analyser/engine/lib/app/").sort(), [...listed].sort());
  // Every file in goldens/app is the app's, copied by sync_app.dart.
  assert.deepEqual(
    walk("analyser/goldens/app/", "goldens/app/").sort(),
    Object.keys(files)
      .filter((p) => p.startsWith("goldens/"))
      .sort(),
  );
  // The models the build serves are the app's.
  for (const m of [
    "categoriser.weights",
    "labels.json",
    "model-manifest.json",
  ]) {
    assert.equal(sha(`public/analyser/${m}`), files[`models/${m}`], m);
  }
});
