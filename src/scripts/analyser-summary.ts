/*
 * Turns the engine's analysis (analyser/web/worker.mjs) into what the
 * statement analyser page shows. Pure: no DOM, no network.
 */

export interface Txn {
  time: string;
  direction: "inflow" | "outflow";
  kind: string;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  counterparty: string | null;
  counterpartyKind: string | null;
  role: string;
  category: string | null;
}

export interface Analysis {
  status: "read" | "not_read" | "no_text";
  institution?: string;
  bankName?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  unreadCount?: number;
  transactions?: Txn[];
}

/** The app's category names (default_categories.dart). */
export const categoryNames: Record<string, string> = {
  salary: "Salary",
  business_income: "Business income",
  money_received: "Money received from people",
  support_received: "Support from family",
  allowance_bursary: "Allowance and bursary",
  gifts_received: "Gifts received",
  groceries: "Groceries and household",
  eating_out: "Eating out",
  snacks: "Snacks",
  transport: "Transport",
  fuel: "Fuel",
  airtime_data: "Airtime and data",
  rent: "Rent and housing",
  utilities: "Electricity, water and internet",
  school_fees: "School fees and education",
  health: "Health and insurance",
  family_support: "Family support",
  friends_social: "Friends and social",
  lifestyle: "Lifestyle and entertainment",
  betting: "Betting and gaming",
  shopping: "Shopping and clothing",
  giving: "Church, giving and fundraisers",
  fees_charges: "Fees and charges",
  loan_repayment: "Loan repayment",
  fuliza_repayment: "Fuliza repayment",
  savings: "Savings, SACCO and money market",
  tax: "Tax",
  own_transfer: "Own transfer",
};
export const uncategorised = "Not sorted yet";

const institutionNames: Record<string, string> = {
  mpesa: "M-Pesa",
  kcb: "KCB",
};

const kindNames: Record<string, string> = {
  till: "Till",
  paybill: "Pay Bill",
  sent: "Sent",
  received: "Received",
  airtime: "Airtime",
  withdrawal: "Withdrawal",
  bank: "Bank",
  loanRepayment: "Loan",
};

const feeNames: Record<string, [string, string]> = {
  sent: ["transfer charge", "transfer charges"],
  withdrawal: ["withdrawal charge", "withdrawal charges"],
  paybill: ["Pay Bill charge", "Pay Bill charges"],
  till: ["till charge", "till charges"],
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const longMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Times are read in Kenya (UTC+3, no daylight saving). */
function local(iso: string): { y: number; m: number; d: number } {
  const t = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}
/** Period dates are calendar dates (midnight UTC). */
function day(iso: string): { y: number; m: number; d: number } {
  const t = new Date(iso);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}
const daysIn = (y: number, m: number) =>
  new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Whole shillings, with thousands separators. */
export const money = (minor: number) =>
  Math.round(minor / 100).toLocaleString("en-KE");

export interface Row {
  label: string;
  detail?: string;
  minor: number;
}
export interface Bar {
  label: string;
  inMinor: number;
  outMinor: number;
}

export interface Summary {
  title: string;
  subtitle: string;
  institution: string;
  count: number;
  inMinor: number;
  outMinor: number;
  inDetail: string;
  outDetail: string;
  chartTitle: string;
  bars: Bar[];
  categories: Row[];
  payees: Row[];
  feesMinor: number;
  feesDetail: string;
  unreadCount: number;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function summarise(a: Analysis): Summary {
  const txns = a.transactions ?? [];
  const institution =
    institutionNames[a.institution ?? ""] ?? a.institution ?? "Statement";

  // The span: the statement's period, or else its transactions' dates.
  const dates = txns.map((t) => local(t.time));
  const first = a.periodStart
    ? day(a.periodStart)
    : dates.reduce((p, c) => (key(c) < key(p) ? c : p), dates[0]);
  const last = a.periodEnd
    ? day(a.periodEnd)
    : dates.reduce((p, c) => (key(c) > key(p) ? c : p), dates[0]);
  const oneMonth = !first || (first.y === last.y && first.m === last.m);

  let inMinor = 0;
  let outMinor = 0;
  let feesMinor = 0;
  const inSources = new Map<string, number>();
  const cats = new Map<string, number>();
  const payees = new Map<string, { minor: number; n: number; kind: string }>();
  const fees = new Map<string, number>();
  for (const t of txns) {
    if (t.direction === "inflow") {
      inMinor += t.amountMinor;
      const source =
        t.category === "salary" ? "salary" : (t.counterparty ?? "other");
      inSources.set(source, (inSources.get(source) ?? 0) + 1);
    } else {
      outMinor += t.amountMinor + t.feeMinor;
      const cat = t.category ?? "";
      cats.set(cat, (cats.get(cat) ?? 0) + t.amountMinor);
      const name = t.counterparty?.trim();
      if (name) {
        const p = payees.get(name) ?? { minor: 0, n: 0, kind: t.kind };
        p.minor += t.amountMinor;
        p.n += 1;
        payees.set(name, p);
      }
    }
    if (t.feeMinor > 0) {
      feesMinor += t.feeMinor;
      fees.set(t.kind, (fees.get(t.kind) ?? 0) + 1);
    }
  }

  // "Salary and 3 people": where the money in came from.
  const people = [...inSources.keys()].filter((s) => s !== "salary").length;
  const inParts = [
    ...(inSources.has("salary") ? ["Salary"] : []),
    ...(people ? [plural(people, "other", "others")] : []),
  ];
  const inDetail = inSources.has("salary")
    ? inParts.join(" and ")
    : plural(people, "source", "sources");
  const diff = outMinor - inMinor;
  const outDetail =
    diff === 0
      ? "The same as in"
      : `${money(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than in`;

  const bars: Bar[] = [];
  if (first && oneMonth) {
    const end = daysIn(first.y, first.m);
    for (const [s, e] of [
      [1, 7],
      [8, 14],
      [15, 21],
      [22, end],
    ]) {
      bars.push({
        label: `${s}–${e} ${months[first.m]}`,
        inMinor: 0,
        outMinor: 0,
      });
    }
    for (const t of txns) {
      const d = local(t.time);
      if (d.y !== first.y || d.m !== first.m) continue;
      const bar = bars[Math.min(3, Math.floor((d.d - 1) / 7))];
      add(bar, t);
    }
  } else if (first) {
    const index = new Map<number, Bar>();
    for (let y = first.y, m = first.m; y * 12 + m <= last.y * 12 + last.m;) {
      const bar = {
        label: `${months[m]}${first.y === last.y ? "" : ` ${String(y).slice(2)}`}`,
        inMinor: 0,
        outMinor: 0,
      };
      bars.push(bar);
      index.set(y * 12 + m, bar);
      m += 1;
      if (m === 12) [y, m] = [y + 1, 0];
    }
    for (const t of txns) {
      const d = local(t.time);
      const bar = index.get(d.y * 12 + d.m);
      if (bar) add(bar, t);
    }
  }

  const title = !first
    ? `${institution} statement`
    : oneMonth
      ? `${longMonths[first.m]} ${first.y}`
      : `${months[first.m]} ${first.y} to ${months[last.m]} ${last.y}`;
  const span = !first
    ? ""
    : oneMonth
      ? `${first.d} to ${last.d} ${months[first.m]}`
      : `${first.d} ${months[first.m]} to ${last.d} ${months[last.m]}`;

  const feeParts = [...fees.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => {
      const [one, many] = feeNames[k] ?? ["charge", "charges"];
      return plural(n, one, many);
    });

  return {
    title,
    subtitle: [
      institution,
      span,
      plural(txns.length, "transaction", "transactions"),
    ]
      .filter(Boolean)
      .join(" · "),
    institution,
    count: txns.length,
    inMinor,
    outMinor,
    inDetail,
    outDetail,
    chartTitle: oneMonth
      ? "Week by week, KES thousands"
      : "Month by month, KES thousands",
    bars,
    categories: [...cats.entries()]
      .map(([k, minor]) => ({
        label: k ? (categoryNames[k] ?? k) : uncategorised,
        minor,
      }))
      .sort((a, b) => b.minor - a.minor),
    payees: [...payees.entries()]
      .map(([label, p]) => ({
        label,
        detail: `${kindNames[p.kind] ?? "Paid"} · ${plural(p.n, "payment", "payments")}`,
        minor: p.minor,
      }))
      .sort((a, b) => b.minor - a.minor),
    feesMinor,
    feesDetail: feeParts.join(", ") || "No charges",
    unreadCount: a.unreadCount ?? 0,
  };
}

function key(d: { y: number; m: number; d: number }) {
  return d.y * 10000 + d.m * 100 + d.d;
}
function add(bar: Bar, t: Txn) {
  if (t.direction === "inflow") bar.inMinor += t.amountMinor;
  else bar.outMinor += t.amountMinor + t.feeMinor;
}
