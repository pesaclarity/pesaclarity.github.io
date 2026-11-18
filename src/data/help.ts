/**
 * The help centre's topics. Articles are Markdown files in
 * src/content/help/<topic>/<article>.md, written from the app's own screens
 * (button names as the app shows them).
 */
export interface HelpTopic {
  id: string;
  title: string;
  body: string;
}

export const helpTopics: readonly HelpTopic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    body: "Install the app, pick your accounts and get your first plan.",
  },
  {
    id: "reading-messages",
    title: "Reading your messages",
    body: "Which banks and wallets it reads, and Messages to check.",
  },
  {
    id: "ask",
    title: "Ask",
    body: "Questions about your money, answered on your phone.",
  },
  {
    id: "spaces",
    title: "Spaces",
    body: "Personal, business, household and more, each kept apart.",
  },
  {
    id: "business",
    title: "Business",
    body: "Selling, stock, people who owe you and closing the day.",
  },
  {
    id: "backups",
    title: "Backups and restore",
    body: "Backups only you can open, and moving to a new phone.",
  },
  {
    id: "privacy-controls",
    title: "Privacy controls",
    body: "App lock, Help improve the app, and deleting your data.",
  },
  {
    id: "wrong-amount",
    title: "Fixing a wrong amount",
    body: "When an amount, payee or balance looks wrong.",
  },
];

export const helpTopic = (id: string) => helpTopics.find((t) => t.id === id);
