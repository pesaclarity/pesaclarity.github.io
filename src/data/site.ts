/** Site-wide names, links and copy that more than one page uses. */

import { fetchAppRelease, formatSize } from "./release.mjs";

const org = "https://github.com/pesaclarity";

export const site = {
  name: "Pesa Clarity",
  promise: "Know where your pesa goes.",
  description:
    "Your M-Pesa and bank SMS, turned into a simple daily budget. Free, private, and on your phone.",
  locale: "en_KE",
} as const;

/** Who answers data protection requests, as the privacy policy names them. */
export const dpo = {
  name: "Dan Njuguna",
  email: "njugunahdann@gmail.com",
} as const;

export const links = {
  github: org,
  releases: `${org}/pesaclarity-app/releases`,
  appIssues: `${org}/pesaclarity-app/issues`,
  // The app repo: the star that shows people the project is alive.
  star: `${org}/pesaclarity-app`,
  brand: `${org}/docs/blob/main/BRAND.md`,
  contributing: `${org}/pesaclarity-web/blob/main/CONTRIBUTING.md`,
  // The guide every repo shares.
  contribute: `${org}/.github/blob/main/CONTRIBUTING.md`,
  parserContributing: `${org}/ujumbe-parsers/blob/main/CONTRIBUTING.md`,
  parserIssues: `${org}/ujumbe-parsers/issues`,
  // Where the message rules live, so anyone can add their bank.
  parsers: `${org}/ujumbe-parsers`,
  webSource: `${org}/pesaclarity-web`,
} as const;

// The app release the download buttons point to: a tag such as v0.2.0, or
// "latest" for the newest full release. Until the first one, the test build.
export const releaseTag: string =
  import.meta.env.APP_RELEASE_TAG || "test-build";
const releaseFiles =
  releaseTag === "latest"
    ? `${links.releases}/latest/download`
    : `${links.releases}/download/${releaseTag}`;

/**
 * APKs on the app's GitHub Releases, one per flavour and chip: the plain
 * name is for most phones (64-bit), `-32bit` for older ones.
 */
export const apkFiles = {
  android: "pesaclarity-play.apk",
  android32: "pesaclarity-play-32bit.apk",
  fdroid: "pesaclarity-foss.apk",
  fdroid32: "pesaclarity-foss-32bit.apk",
} as const;

export const downloads = {
  android: `${releaseFiles}/${apkFiles.android}`,
  android32: `${releaseFiles}/${apkFiles.android32}`,
  fdroid: `${releaseFiles}/${apkFiles.fdroid}`,
  fdroid32: `${releaseFiles}/${apkFiles.fdroid32}`,
  testBuild: releaseTag === "test-build",
} as const;

/** A download on the install page: what it is for, and its file. */
export interface Apk {
  label: string;
  body: string;
  href: string;
  /** The release asset's name, which its size is read by. */
  file: string;
}

/** Every APK, in plain words. */
export const apks: readonly Apk[] = [
  {
    label: "For most phones",
    body: "With Google sign-in. Start here.",
    href: downloads.android,
    file: apkFiles.android,
  },
  {
    label: "For older phones",
    body: "For 32-bit and Android Go phones.",
    href: downloads.android32,
    file: apkFiles.android32,
  },
  {
    label: "F-Droid build",
    body: "Free of Google services.",
    href: downloads.fdroid,
    file: apkFiles.fdroid,
  },
  {
    label: "F-Droid, older phones",
    body: "The F-Droid build for 32-bit phones.",
    href: downloads.fdroid32,
    file: apkFiles.fdroid32,
  },
];

/** Headings for what's new in the build the buttons offer. */
export const whatsNew = {
  title: (version: string) => `What's new in ${version}`,
  /** How many changes the home page shows. */
  homeCount: 3,
  more: "See all that's new",
} as const;

/**
 * The release the buttons offer, read once when the site is built: its
 * version, date, sizes and what's new. Null when the build has no network.
 */
export const appRelease = await fetchAppRelease(releaseTag, {
  token: import.meta.env.GITHUB_TOKEN,
});

/** `19.4 MB`, the file most phones take; null when the size is unknown. */
export const mainApkSize: string | null = formatSize(
  appRelease?.sizes[apkFiles.android] ?? NaN,
);

export interface Account {
  name: string;
  /** Shown under the name, for accounts that still need a hand. */
  note?: string;
}

const learning =
  "You check new messages once while the app learns their wording.";

/** Banks and wallets whose SMS the app reads. */
export const accounts: readonly Account[] = [
  { name: "M-Pesa" },
  { name: "Airtel Money", note: learning },
  { name: "Equity Bank" },
  { name: "I&M Bank" },
  { name: "KCB" },
  { name: "Loop", note: learning },
];

/** A card: a short title and one line under it. */
export interface Item {
  title: string;
  body: string;
}

/** How big the Android download is, from the release, else in words. */
export const downloadSize = mainApkSize
  ? `${mainApkSize} on most phones`
  : "A small download";

/** What makes Pesa Clarity different. */
export const different: readonly Item[] = [
  {
    title: "On your phone",
    body: "Your records and every sum stay on your phone, and work without internet.",
  },
  {
    title: "Private by design",
    body: "Only you see your money. Backups are encrypted so only you can open them.",
  },
  { title: "Free for everyone", body: "Every feature, ad-free." },
  {
    title: "Open source",
    body: "Anyone can check the code that handles their money.",
  },
  { title: "Plain English", body: "Clear words, and one number first." },
  {
    title: "Made for Kenyan money",
    body: "M-Pesa, Fuliza, Saccos, banks, KES and KRA tax estimates.",
  },
  {
    title: "Small download",
    body: mainApkSize
      ? `${mainApkSize} on most phones.`
      : "Quick to get, even on mobile data.",
  },
  {
    title: "For every part of life",
    body: "You, your home, your business, your group and more, each kept apart.",
  },
];

/** The kinds of space, in the app's own words. */
export const spaces: readonly Item[] = [
  { title: "Personal", body: "Your own money and plan" },
  {
    title: "Business",
    body: "Sales, stock, wages and profit, for products, services or both",
  },
  { title: "Household", body: "Shared home costs with family" },
  { title: "Savings group", body: "Contributions, payouts and loans" },
  { title: "Rental property", body: "Rent in, repairs and profit" },
  { title: "Farm", body: "Inputs, labour and harvest sales" },
  { title: "Something else", body: "A project or anything to keep apart" },
];

/** Everyday money, in every space. */
export const moneyFeatures: readonly Item[] = [
  {
    title: "Reads your SMS",
    body: "M-Pesa, Airtel Money and bank alerts become your records, on your phone.",
  },
  {
    title: "Past months from a statement",
    body: "Import an M-Pesa or bank statement to start with your history.",
  },
  {
    title: "Safe to spend today",
    body: "One number for today that still covers your bills.",
  },
  {
    title: "Until the next money",
    body: "For gigs, family support or seasonal money, a daily amount that lasts.",
  },
  {
    title: "A payday plan",
    body: "Split money across bills, debts, savings and living.",
  },
  {
    title: "Week by week",
    body: "This week against a usual one, for business and gig money.",
  },
  {
    title: "Rainy day fund",
    body: "Set money aside in good weeks and use it in lean ones.",
  },
  { title: "Goals", body: "Save for what matters, with a date to get there." },
  {
    title: "Debts",
    body: "Your debt-free date, a Fuliza tracker and who owes who.",
  },
  { title: "Bills and reminders", body: "What's due, in good time." },
  {
    title: "Subscriptions",
    body: "Every repeat payment and what it costs a year.",
  },
  {
    title: "Money health score",
    body: "A score with what helps each part of it.",
  },
  {
    title: "Insights",
    body: "What changed this month and where money goes. Tap any figure to see why.",
  },
  {
    title: "Message reader",
    body: "New message wording gets its amount and payee suggested for you to check.",
  },
  {
    title: "Learns your categories",
    body: "Suggestions improve from your choices, on your phone.",
  },
  {
    title: "Encrypted backups",
    body: "Back up each space so only you can open it.",
  },
  { title: "App lock", body: "A PIN or your fingerprint keeps it yours." },
];

/** What a business space adds. */
export const businessFeatures: readonly Item[] = [
  {
    title: "Today",
    body: "Sell, Bought, Got paid and Paid, one tap each, with today's profit.",
  },
  {
    title: "Sell and Pay",
    body: "Tap items or type an amount, take any way of paying, and share a receipt.",
  },
  {
    title: "Money",
    body: "What Cash, M-Pesa and Bank hold, with each day's money in and out.",
  },
  {
    title: "People",
    body: "Customers who owe you and suppliers you owe, with statements.",
  },
  {
    title: "Reminders",
    body: "Friendly messages you can change, sent by SMS, WhatsApp or any app.",
  },
  {
    title: "Stock",
    body: "Items, prices, restocks and counts, with a nudge when running low.",
  },
  { title: "Close the day", body: "Count the drawer and see that it matches." },
  {
    title: "Pay yourself",
    body: "Move your pay to Personal, so business and home stay apart.",
  },
  {
    title: "Proper books, plain words",
    body: "Every sale and payment is recorded properly, in everyday words.",
  },
  {
    title: "Insights and reports",
    body: "How the business is doing, and reports for a Sacco, a loan or an accountant.",
  },
  {
    title: "Tax estimates",
    body: "Turnover Tax, VAT and income tax estimates from your records, with rules that ship with the app.",
  },
  { title: "Receipts", body: "After every sale, as a picture, a PDF or text." },
  {
    title: "Invoices",
    body: "From items or hours, with withholding tax worked out, your M-PESA QR and attached documents.",
  },
  { title: "Hours", body: "Log hours by day and week, then bill them." },
  {
    title: "Products, services or both",
    body: "The tabs fit what you sell.",
  },
];

/** How the app and its documents look. */
export const lookFeatures: readonly Item[] = [
  {
    title: "Light or dark",
    body: "Follow your phone, or always light or dark.",
  },
  { title: "Text fields", body: "Underlined or boxed, across the app." },
  {
    title: "Reports and documents",
    body: "Choose the cover, colour, charts, wording and branding.",
  },
];

/** A titled group of items, with a line under the title. */
export interface Highlight {
  title: string;
  lead: string;
  items: readonly Item[];
}

/** Selling in a business space: the phone as the shop counter. */
export const selling: Highlight = {
  title: "Selling (POS)",
  lead: "Sell from your phone: tap what you sell or type an amount, take any way of paying, and share a receipt.",
  items: [
    {
      title: "Tap items or type an amount",
      body: "A tile for each item with its price and stock, or a number pad for a quick sale.",
    },
    {
      title: "Cash, M-Pesa, bank, credit or split",
      body: "Cash works out the change. Credit keeps who owes and when. Split takes part now and the rest another way.",
    },
    {
      title: "M-Pesa matched to the sale",
      body: "Each sale waits for its M-Pesa message and matches it on its own.",
    },
    {
      title: "A receipt for every sale",
      body: "Share it as a picture, a PDF or text, with the M-Pesa code on it.",
    },
    {
      title: "Stock that counts down",
      body: "Each sale takes its items out of stock, with a nudge when one runs low.",
    },
    {
      title: "Close the day",
      body: "Count the drawer, see that it matches, and match each payment to its sale.",
    },
  ],
};

/** Money in more than one currency, in every space. */
export const currencies: Highlight = {
  title: "Many currencies",
  lead: "For your own money and a business alike.",
  items: [
    {
      title: "Your base currency",
      body: "Pick the currency you count in. The app suggests your phone's.",
    },
    {
      title: "Each amount as it was paid",
      body: "Every payment keeps the currency its message shows, with your base amount under it.",
    },
    {
      title: "Accounts kept apart",
      body: "Two accounts at one bank, such as KES and USD at Equity, stay apart by account number.",
    },
    {
      title: "Totals in one currency",
      body: "Totals add everything up in your base currency, at the rate of each day.",
    },
    {
      title: "The rate you got",
      body: "Use the rate you were given for a payment in place of the day's rate.",
    },
    {
      title: "Currency converter",
      body: "Convert any amount between two currencies, with the last rates when offline.",
    },
  ],
};

/** The two halves of the features page. */
export const featureSides = {
  personal: {
    title: "Personal",
    lead: "Your own money, from your M-Pesa and bank SMS: what is safe to spend, what is due and where it goes.",
  },
  business: {
    title: "Business",
    lead: "A business space keeps its money apart from yours, with selling, stock, customers, suppliers and tax.",
  },
} as const;

/** A screen from the app, as an image in public/screens/. */
export interface Screen {
  /** The file name, without `.webp`. */
  file: string;
  name: string;
  alt: string;
}

/**
 * Every app screen the site shows: the app's own screens, filled with
 * made-up records (Home, Plan, Goals, Debts and Insights come from the app
 * design canvas).
 * All are 780 × 1688 WebP (390 × 844 at 2x). Regenerate them when the app
 * changes.
 */
export const screens = {
  home: {
    file: "home",
    name: "Home",
    alt: "Pesa Clarity home screen showing safe to spend today, money left this month and upcoming bills",
  },
  activity: {
    file: "activity",
    name: "Activity",
    alt: "Activity screen with a search bar, drop-downs for account and type, this week's money out and in, and transactions grouped by day, one waiting for its payee's name",
  },
  plan: {
    file: "plan",
    name: "Plan",
    alt: "Plan screen showing planned income split by debt, tax, living and school, and spending by category",
  },
  goals: {
    file: "goals",
    name: "Goals",
    alt: "Goals screen with the debt-free date, progress on each debt, savings goals and net worth",
  },
  debts: {
    file: "debts",
    name: "Debts",
    alt: "Debts screen with the payoff strategy, this payday's split, the Fuliza tracker and a what-if slider",
  },
  insights: {
    file: "insights",
    name: "Insights",
    alt: "Insights screen with what changed this month, spending by category and spending so far against last month",
  },
  accounts: {
    file: "accounts",
    name: "My accounts",
    alt: "My accounts screen with totals in USD, M-Pesa in KES, two Equity Bank accounts told apart by account number, one in KES and one in USD, and cash in SSP",
  },
  currencies: {
    file: "currencies",
    name: "Activity",
    alt: "Activity screen with a note that 23 amounts at Equity Bank are now in its USD account, this week's totals in USD, a KES 25,000 rent payment with about USD 193.50 under it, and a USD salary",
  },
  today: {
    file: "today",
    name: "Today",
    alt: "Business Today screen with sales today split by cash, M-Pesa and credit, up on a usual Thursday, buttons for Bought, Got paid, Paid and Close the day, and an M-Pesa sale waiting for its message",
  },
  sell: {
    file: "sell",
    name: "Sell",
    alt: "Sell screen with a group drop-down, a tile for each item showing its price and stock left, three items picked and the total ready to pay",
  },
  sellKeypad: {
    file: "sell-keypad",
    name: "Sell by amount",
    alt: "Sell screen with a number pad, KES 350 typed for mixed vegetables and a Pay button",
  },
  pay: {
    file: "pay",
    name: "Pay",
    alt: "Pay sheet with the items and their plus and minus buttons, and the way-to-pay menu open: cash, M-Pesa, bank, on credit or split",
  },
  receipt: {
    file: "receipt",
    name: "Receipt",
    alt: "Sale saved with its receipt: two items, the total, paid by M-Pesa with its code, Send as set to a picture, and a Share receipt button",
  },
  money: {
    file: "money",
    name: "Money",
    alt: "Money in and out screen with what cash, M-Pesa and the bank hold, and today's sales with the account and time of each",
  },
  people: {
    file: "people",
    name: "People",
    alt: "People screen with what customers owe in all, each customer's amount and a Remind button for each",
  },
  stock: {
    file: "stock",
    name: "Stock",
    alt: "Stock screen with the stock value, items running low, a drop-down to show products or services, and each item with its price, cost and how much is left",
  },
  closeDay: {
    file: "close-day",
    name: "Close the day",
    alt: "Close the day screen showing what should be in the drawer, the cash counted matching it, an M-Pesa payment to match and today's total sales",
  },
  tax: {
    file: "tax",
    name: "Tax",
    alt: "Tax screen with a Turnover Tax estimate, last month's sales, what is left to pay and its due date",
  },
} as const satisfies Record<string, Screen>;

/** The personal screens, on the features page. */
export const personalScreens: readonly Screen[] = [
  screens.home,
  screens.activity,
  screens.plan,
  screens.goals,
  screens.debts,
  screens.insights,
];

/** Many currencies, under Personal on the features page. */
export const currencyScreens: readonly Screen[] = [
  screens.accounts,
  screens.currencies,
];

/** The business screens, on the features page. */
export const businessScreens: readonly Screen[] = [
  screens.today,
  screens.sell,
  screens.pay,
  screens.receipt,
  screens.money,
  screens.people,
  screens.stock,
  screens.closeDay,
  screens.tax,
];

/** The home page's screens, under the one at the top. */
export const homeScreens: readonly Screen[] = [
  screens.activity,
  screens.plan,
  screens.debts,
  screens.insights,
];

/** The two sides of the app, on the home page. */
export interface Side {
  title: string;
  body: string;
  link: string;
  /** Where on the features page it leads. */
  anchor: string;
  screen: Screen;
}

export const sides: { title: string; items: readonly Side[] } = {
  title: "For your money and your business",
  items: [
    {
      title: "Your own money",
      body: "Safe to spend today, bills, goals, debts and insights, from your M-Pesa and bank SMS.",
      link: "Personal features",
      anchor: "personal",
      screen: screens.goals,
    },
    {
      title: "Your business",
      body: "Sell from your phone, take cash, M-Pesa or credit, keep stock and close the day.",
      link: "Business features",
      anchor: "business",
      screen: screens.sell,
    },
  ],
};

export interface Faq {
  q: string;
  a: string;
}

export const faqs: readonly Faq[] = [
  { q: "Is it free?", a: "Yes, every feature." },
  { q: "Does it need my PIN?", a: "It reads only your SMS." },
  { q: "Who sees my money?", a: "Only you." },
  { q: "iPhone?", a: "Coming after the Android beta." },
  { q: "When can I start?", a: "Today. Download it for Android." },
  {
    q: "Does it work without internet?",
    a: "Yes. Your records and sums are on your phone.",
  },
  {
    q: "Can I use it for my business?",
    a: "Yes. Add a business space to sell, keep stock and see who owes you.",
  },
  {
    q: "How big is the download?",
    a: mainApkSize
      ? `${mainApkSize} on most phones.`
      : "A small download, quick on mobile data.",
  },
  {
    q: "Which download?",
    a: "Android has Google sign-in. F-Droid has no Google services.",
  },
];
