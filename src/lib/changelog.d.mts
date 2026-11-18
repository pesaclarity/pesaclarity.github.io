export interface Change {
  text: string;
  children: string[];
}
export interface Group {
  title: string;
  changes: Change[];
}
export interface Release {
  version: string | null;
  date: string | null;
  compare: string | null;
  groups: Group[];
}
export function parseChangelog(markdown: string): Release[];
export function tidy(text: string): string;
export function sentenceCase(text: string): string;
export function summary(text: string): string;
export function inlineHtml(text: string): string;
