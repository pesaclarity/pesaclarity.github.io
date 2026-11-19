// The problem Pesa Clarity solves and the UN Sustainable Development Goals it
// aims to contribute to, for the Impact page and the home page.
//
// The problem restates pesaclarity/docs: spec/PRODUCT-SPEC.md (problem and
// users, principles), spec/income-for-everyone.md and spec/business-money.md.
// Each target's wording is quoted word for word from its goal's page on
// sdgs.un.org, as the UN prints it (with no full stop). Change them together.
import { withBase } from "../lib/paths";
import { links } from "./site";

export interface Problem {
  title: string;
  body: string;
}

export const problems: readonly Problem[] = [
  {
    title: "Every message, no picture",
    body: "In Kenya, money moves through M-Pesa and bank SMS. Each message says what just happened. Together they don't say where the month went, what's due, or how long the money will last.",
  },
  {
    title: "Money doesn't come on payday",
    body: "Students, gig workers, farmers and shopkeepers are paid at uneven gaps. A budget built around a monthly salary doesn't fit them.",
  },
  {
    title: "A business needs books",
    body: "An owner needs to know what sold today, who owes them and whether the drawer is right, and to have proper books to show a Sacco, a bank or an accountant.",
  },
  {
    title: "Without giving your data away",
    body: "No bank logins, no ads, no account needed, and your data is never sold. Every feature is free for everyone.",
  },
];

export interface Goal {
  /** The goal's number, which also picks its colour (--color-sdg-<n>). */
  n: 1 | 8 | 10;
  goal: string;
  target: string;
  /** The target's wording, verbatim from `source`. */
  wording: string;
  source: string;
  how: string;
  features: string;
  href: string;
}

export const goals: readonly Goal[] = [
  {
    n: 1,
    goal: "No poverty",
    target: "1.4",
    wording:
      "By 2030, ensure that all men and women, in particular the poor and the vulnerable, have equal rights to economic resources, as well as access to basic services, ownership and control over land and other forms of property, inheritance, natural resources, appropriate new technology and financial services, including microfinance",
    source: "https://sdgs.un.org/goals/goal1",
    how: "Helps people understand and plan the money they already hold in M-Pesa and the bank, with a daily amount that lasts until the next money comes.",
    features: "Safe to spend today, Until the next money, Debts and Insights",
    href: withBase("/features/#personal"),
  },
  {
    n: 8,
    goal: "Decent work and economic growth",
    target: "8.3",
    wording:
      "Promote development-oriented policies that support productive activities, decent job creation, entrepreneurship, creativity and innovation, and encourage the formalization and growth of micro-, small- and medium-sized enterprises, including through access to financial services",
    source: "https://sdgs.un.org/goals/goal8",
    how: "Gives micro and small businesses proper books in plain words, with receipts, invoices, tax estimates and reports they can take to a Sacco, a bank or an accountant.",
    features:
      "Business space, Sell, Proper books, Receipts and invoices, Tax estimates",
    href: withBase("/features/#business"),
  },
  {
    n: 10,
    goal: "Reduced inequalities",
    target: "10.2",
    wording:
      "By 2030, empower and promote the social, economic and political inclusion of all, irrespective of age, sex, disability, race, ethnicity, origin, religion or economic or other status",
    source: "https://sdgs.un.org/goals/goal10",
    how: "Every feature is free for everyone, it runs on older 32-bit and Android Go phones and works without internet, and its plans fit money that doesn't come monthly.",
    features:
      "Free for everyone, 32-bit builds, works offline, Until the next money",
    href: withBase("/install/"),
  },
];

/** Said wherever the goals appear. */
export const notEndorsed =
  "It is an independent project, not endorsed by or affiliated with the United Nations.";

export const sources: readonly { label: string; href: string }[] = [
  {
    label: "The product spec: the problem, its users and our principles",
    href: `${links.github}/docs/tree/main/spec`,
  },
  {
    label: "Income for everyone: money without a payday",
    href: `${links.github}/docs/blob/main/spec/income-for-everyone.md`,
  },
  {
    label: "Business: records, books, receipts and tax",
    href: `${links.github}/docs/blob/main/spec/business-money.md`,
  },
  ...goals.map((g) => ({
    label: `UN: Goal ${g.n}, ${g.goal}, and its targets`,
    href: g.source,
  })),
];
