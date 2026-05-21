import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR = join(homedir(), '.config', 'querky');
const FILE = join(DIR, 'history.json');
const MAX = 1000;

export function loadHistory(): string[] {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as string[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: string[]): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(entries));
  } catch {
    // history is non-critical
  }
}

export function addToHistory(history: string[], query: string): string[] {
  const deduped = history.filter((e) => e !== query);
  return [...deduped, query].slice(-MAX);
}
