import type { Schema } from '../db/schema.js';

export type { Schema };

export function fuzzyScore(token: string, candidate: string): number {
  if (token.length === 0) return 0;
  let score = 0;
  let ti = 0;
  let run = 0;
  for (let ci = 0; ci < candidate.length && ti < token.length; ci++) {
    if (candidate[ci] === token[ti]) {
      run++;
      score += run * 2;
      score += candidate.length - ci;
      ti++;
    } else {
      run = 0;
    }
  }
  if (ti < token.length) return -1;
  if (candidate.startsWith(token)) score += 100;
  return score;
}

export function fuzzyMatchPositions(token: string, candidate: string): number[] {
  const positions: number[] = [];
  let ti = 0;
  for (let ci = 0; ci < candidate.length && ti < token.length; ci++) {
    if (candidate[ci] === token[ti]) { positions.push(ci); ti++; }
  }
  return ti === token.length ? positions : [];
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE', 'BETWEEN', 'IS', 'NULL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
  'DROP', 'ALTER', 'ADD', 'COLUMN', 'ORDER', 'BY', 'GROUP', 'HAVING',
  'LIMIT', 'OFFSET', 'DISTINCT', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'UNION', 'ALL', 'EXISTS', 'WITH', 'RETURNING',
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COALESCE', 'NULLIF', 'CAST',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CONSTRAINT',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'EXPLAIN', 'ANALYZE',
];

const TABLE_CONTEXT = new Set(['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE']);
const COLUMN_CONTEXT = new Set(['SELECT', 'WHERE', 'ON', 'SET', 'HAVING', 'BY', 'AND', 'OR']);

export function getCurrentToken(value: string, cursor: number): string {
  const before = value.slice(0, cursor);
  const dotMatch = before.match(/\w+\.(\w*)$/);
  if (dotMatch) return dotMatch[1];
  const match = before.match(/(\w+)$/);
  return match ? match[1] : '';
}

function getQualifiedTable(value: string, cursor: number): string | null {
  const before = value.slice(0, cursor);
  const match = before.match(/(\w+)\.\w*$/);
  return match ? match[1] : null;
}

function getContextKeyword(value: string, cursor: number): string {
  const before = value.slice(0, cursor).replace(/\w*$/, '');
  // If parentheses are balanced, we've closed a list and are back at keyword level
  const opens = (before.match(/\(/g) ?? []).length;
  const closes = (before.match(/\)/g) ?? []).length;
  if (opens > 0 && closes >= opens) return '';
  const tokens = before.trim().split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].toUpperCase().replace(/[^A-Z]/g, '');
    if (TABLE_CONTEXT.has(t) || COLUMN_CONTEXT.has(t)) return t;
  }
  return '';
}

function matchCase(keyword: string, token: string): string {
  const isLower = token === token.toLowerCase();
  return isLower ? keyword.toLowerCase() : keyword.toUpperCase();
}

export function getSqlCompletions(value: string, cursor: number, schema: Schema): string[] {
  const token = getCurrentToken(value, cursor);
  const tokenLower = token.toLowerCase();
  const ctx = getContextKeyword(value, cursor).toUpperCase();

  function fuzzyRank<T extends string>(items: T[]): T[] {
    return items
      .map((item) => ({ item, score: fuzzyScore(tokenLower, item.toLowerCase()) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }

  // Qualified column: table.col — need at least the dot present
  const qualTable = getQualifiedTable(value, cursor);
  if (qualTable) {
    const cols = schema.columns[qualTable] ?? schema.columns[qualTable.toLowerCase()] ?? [];
    return token.length === 0 ? cols.slice(0, 8) : fuzzyRank(cols).slice(0, 8);
  }

  // After FROM / JOIN / INTO / UPDATE: show table names, even with an empty token
  if (TABLE_CONTEXT.has(ctx)) {
    return token.length === 0 ? schema.tables.slice(0, 8) : fuzzyRank(schema.tables).slice(0, 8);
  }

  // Need at least 1 char for everything else
  if (token.length < 1) return [];

  if (COLUMN_CONTEXT.has(ctx)) {
    const allCols = [...new Set(Object.values(schema.columns).flat())];
    const matchingCols = fuzzyRank(allCols);
    const matchingTables = fuzzyRank(schema.tables);
    const matchingKw = SQL_KEYWORDS
      .filter((k) => k.toLowerCase().startsWith(tokenLower))
      .map((k) => matchCase(k, token));
    return [...matchingTables, ...matchingCols, ...matchingKw].slice(0, 8);
  }

  // Default: keywords (startsWith) + fuzzy tables + fuzzy columns
  const matchingKw = SQL_KEYWORDS
    .filter((k) => k.toLowerCase().startsWith(tokenLower))
    .map((k) => matchCase(k, token));
  const matchingTables = fuzzyRank(schema.tables);
  const allCols = [...new Set(Object.values(schema.columns).flat())];
  const matchingCols = fuzzyRank(allCols);
  return [...matchingKw, ...matchingTables, ...matchingCols].slice(0, 8);
}

// Replaces the current token in `value` at `cursor` with `completion`.
export function applyCompletion(value: string, cursor: number, completion: string): { value: string; cursor: number } {
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const dotMatch = before.match(/^([\s\S]*\w+\.)(\w*)$/);
  if (dotMatch) {
    const newBefore = dotMatch[1] + completion;
    return { value: newBefore + after, cursor: newBefore.length };
  }
  const tokenMatch = before.match(/^([\s\S]*?)(\w+)$/);
  if (tokenMatch) {
    const newBefore = tokenMatch[1] + completion;
    return { value: newBefore + after, cursor: newBefore.length };
  }
  return { value: before + completion + after, cursor: cursor + completion.length };
}
