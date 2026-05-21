import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.config', 'querky');
const ALIASES_FILE = join(CONFIG_DIR, 'aliases.json');

type AliasStore = Record<string, Record<string, string>>;

function load(): AliasStore {
  try {
    return JSON.parse(readFileSync(ALIASES_FILE, 'utf8')) as AliasStore;
  } catch {
    return {};
  }
}

function persist(store: AliasStore): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(ALIASES_FILE, JSON.stringify(store, null, 2));
}

export function makeScope(driver: string, user: string, host: string, database: string): string {
  return `${driver}:${user}@${host}/${database}`;
}

export function getAllAliases(scope: string): Record<string, string> {
  return load()[scope] ?? {};
}

export function saveAlias(scope: string, name: string, query: string): void {
  const store = load();
  store[scope] ??= {};
  store[scope][name] = query;
  persist(store);
}

export function deleteAlias(scope: string, name: string): boolean {
  const store = load();
  if (!store[scope]?.[name]) return false;
  delete store[scope][name];
  persist(store);
  return true;
}

// Supports positional ($1, $2) and named (:param) placeholders.
// Named params: invoked as key=value or key="quoted value" pairs.
// Positional params: invoked as space-separated values.
export function expandAlias(template: string, rawArgs: string): string {
  if (/:([a-zA-Z_]\w*)/.test(template)) {
    const named: Record<string, string> = {};
    const re = /(\w+)=("(?:[^"\\]|\\.)*"|\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawArgs)) !== null) {
      named[m[1]] = m[2].replace(/^"|"$/g, '').replace(/\\"/g, '"');
    }
    return template.replace(/:([a-zA-Z_]\w*)/g, (_, k: string) => named[k] ?? `:${k}`);
  }
  const args = rawArgs ? (rawArgs.match(/("(?:[^"\\]|\\.)*"|\S+)/g) ?? []) : [];
  return template.replace(/\$(\d+)/g, (_, n: string) => {
    const val = args[Number(n) - 1];
    return val !== undefined ? val.replace(/^"|"$/g, '') : `$${n}`;
  });
}
