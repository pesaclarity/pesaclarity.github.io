// The analyser's Web Worker (a module worker). The page sends it the PDF and
// the password; it answers with the analysis. The file and the password
// stay in this worker's memory and are never sent anywhere or stored.
//
//   page -> worker  {id, type: "analyse", bytes: ArrayBuffer, password?}
//   worker -> page  {type: "ready", kernels, modelRefused}
//                   {id, type: "progress", step: "reading" | "categorising"}
//                   {id, type: "result", analysis}
//                   {id, type: "error", error: "password" | "wrong_password"
//                                             | "unreadable" | "engine"}
import {
  createAnalyser,
  PasswordRequired,
  WrongPassword,
  Unreadable,
} from "./core.mjs";

const here = new URL(".", import.meta.url);
const load = async (name) => {
  const response = await fetch(new URL(name, here), {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

const ready = createAnalyser(load);
ready.then(
  (a) =>
    postMessage({
      type: "ready",
      kernels: a.kernels,
      modelRefused: a.modelRefused,
    }),
  (e) => postMessage({ type: "error", error: "engine", detail: String(e) }),
);

onmessage = async ({ data }) => {
  if (data?.type !== "analyse") return;
  const { id } = data;
  try {
    const analyser = await ready;
    postMessage({ id, type: "progress", step: "reading" });
    const analysis = await analyser.analyse(
      new Uint8Array(data.bytes),
      data.password,
    );
    postMessage({ id, type: "result", analysis });
  } catch (e) {
    const error =
      e instanceof PasswordRequired
        ? "password"
        : e instanceof WrongPassword
          ? "wrong_password"
          : e instanceof Unreadable
            ? "unreadable"
            : "engine";
    postMessage({ id, type: "error", error });
  }
};
