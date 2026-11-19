/**
 * Who has contributed, and how, from src/data/contributors.json. That file is
 * written by tool/contributors.mjs from the GitHub API; it holds GitHub
 * accounts, public profile names and counts, never an email address.
 */
import data from "./contributors.json";

export interface Contributor {
  login: string;
  /** The public GitHub profile name, when there is one. */
  name: string | null;
  commits: number;
  prs: number;
  /** Short repository names, such as "app". */
  repos: string[];
  /** YYYY-MM-DD. */
  first: string | null;
  latest: string | null;
  /** The picture under public/, or null for initials. */
  avatar: string | null;
}

export const counted: string = data.counted;
export const contributorRepos: readonly string[] = data.repos;
export const contributors: readonly Contributor[] = data.contributors;

/** Up to two letters for someone with no picture. */
export function initials(c: Pick<Contributor, "name" | "login">): string {
  const words = (c.name ?? c.login).split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

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

/** `3 Mar 2026` from `2026-03-03`. */
export function formatDate(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}
