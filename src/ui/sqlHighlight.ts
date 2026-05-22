const SQL_KW = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','LIKE','BETWEEN','EXISTS',
  'CASE','WHEN','THEN','ELSE','END','JOIN','INNER','LEFT','RIGHT','FULL','OUTER',
  'CROSS','ON','AS','DISTINCT','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET',
  'INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP','ALTER',
  'ADD','COLUMN','PRIMARY','KEY','FOREIGN','REFERENCES','INDEX','UNIQUE','DEFAULT',
  'CONSTRAINT','WITH','UNION','ALL','EXCEPT','INTERSECT','RETURNING','TRUE','FALSE',
  'ASC','DESC','NULLS','FIRST','LAST','ILIKE','SIMILAR','TO','CAST','COALESCE',
  'NULLIF','COUNT','SUM','AVG','MIN','MAX','GREATEST','LEAST','OVER','PARTITION',
  'WINDOW','FILTER','LATERAL','USING','NATURAL','EXPLAIN','ANALYZE','VERBOSE',
]);

export type TokenType = 'keyword' | 'string' | 'number' | 'comment' | 'plain';

export interface Token {
  type: TokenType;
  text: string;
}

export function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    // Line comment
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? sql.length : nl;
      tokens.push({ type: 'comment', text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // Block comment
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      const end = close === -1 ? sql.length : close + 2;
      tokens.push({ type: 'comment', text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // String literal (single-quoted, handles '' escapes)
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      tokens.push({ type: 'string', text: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Number
    if (/[0-9]/.test(sql[i])) {
      let j = i + 1;
      while (j < sql.length && /[0-9.]/.test(sql[j])) j++;
      tokens.push({ type: 'number', text: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(sql[i])) {
      let j = i + 1;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      tokens.push({ type: SQL_KW.has(word.toUpperCase()) ? 'keyword' : 'plain', text: word });
      i = j;
      continue;
    }

    // Whitespace, operators, punctuation — one char at a time as plain
    tokens.push({ type: 'plain', text: sql[i] });
    i++;
  }

  return tokens;
}
