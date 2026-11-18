/**
 * The developer docs' sections. Their pages are copied from each
 * repository by tool/sync-sources.mjs (listed in tool/sources.json) into
 * src/content/docs/<section>/.
 */
export interface DocSection {
  id: string;
  title: string;
  /** The section's name in the side navigation, when shorter. */
  short?: string;
  body: string;
  /** Where its pages come from, as shown on the card. */
  sources: readonly string[];
}

export const docSections: readonly DocSection[] = [
  {
    id: "app",
    title: "How the app works",
    body: "From an SMS to a daily plan, all on the phone: the repositories, the speed budget, and how the app reads and sorts money.",
    sources: ["pesaclarity-app/docs", "docs"],
  },
  {
    id: "parser-packs",
    title: "Write a parser pack",
    short: "Parser packs (ujumbe)",
    body: "Add your bank: pack.yaml, named groups, synthetic samples and the checks a pack must pass.",
    sources: ["ujumbe-parsers"],
  },
  {
    id: "rayo",
    title: "rayo",
    body: "The small on-device runtime: its ops, the model converter and format, and running small language models in little memory.",
    sources: ["rayo/docs"],
  },
  {
    id: "ml",
    title: "ML and privacy",
    body: "The models behind the message reader and Ask, differential privacy limits, and the privacy audit.",
    sources: ["pesaclarity-ml/docs"],
  },
  {
    id: "server",
    title: "Server API (ngome)",
    short: "Server (ngome)",
    body: "Sign-in, the encrypted backup vault, update notices and secure aggregation of model updates, and how it is deployed.",
    sources: ["pesaclarity-backend/docs"],
  },
  {
    id: "security",
    title: "Security model",
    body: "How to report a vulnerability, pinned certificate authorities, and the plan for federated learning.",
    sources: [".github/SECURITY.md", "docs"],
  },
  {
    id: "verify",
    title: "Verify a reproducible build",
    short: "Verify a build",
    body: "Rebuild the F-Droid APK from source and compare it with the release, and how releases are made.",
    sources: ["pesaclarity-app/docs"],
  },
  {
    id: "contribute",
    title: "Contribute",
    body: "What every contribution needs, the code of conduct, and the checks that run before you push.",
    sources: [".github/CONTRIBUTING.md"],
  },
];

export const docSection = (id: string) => docSections.find((s) => s.id === id);
