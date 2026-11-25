// Prints the SHA-256 of every file in public/analyser/, as analyser/build.json.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../public/analyser/", import.meta.url);
const files = {};
for (const name of readdirSync(dir).sort()) {
  files[name] = createHash("sha256")
    .update(readFileSync(new URL(name, dir)))
    .digest("hex");
}
console.log(JSON.stringify({ files }, null, 2));
