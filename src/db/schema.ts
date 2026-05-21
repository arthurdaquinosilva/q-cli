import type { DbClient, Driver } from './client.js';

export interface Schema {
  tables: string[];
  columns: Record<string, string[]>;
}

const TABLE_QUERY: Record<Driver, string> = {
  postgresql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  mysql: `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name`,
  sqlite: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
};

const COLUMN_QUERY: Record<Driver, string | null> = {
  postgresql: `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
  mysql: `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position`,
  sqlite: null,
};

export async function fetchSchema(client: DbClient, driver: Driver): Promise<Schema> {
  try {
    const tableResult = await client.query(TABLE_QUERY[driver]);
    const tables = tableResult.rows
      .map((r) => String(Object.values(r)[0] ?? ''))
      .filter(Boolean);

    const columns: Record<string, string[]> = {};

    if (driver === 'sqlite') {
      for (const table of tables) {
        try {
          const info = await client.query(`PRAGMA table_info("${table}")`);
          columns[table] = info.rows.map((r) => String(r['name'] ?? '')).filter(Boolean);
        } catch { /* skip */ }
      }
    } else {
      const colQuery = COLUMN_QUERY[driver];
      if (colQuery) {
        const colResult = await client.query(colQuery);
        for (const row of colResult.rows) {
          const table = String(row['table_name'] ?? '');
          const col = String(row['column_name'] ?? '');
          if (table && col) {
            columns[table] ??= [];
            columns[table].push(col);
          }
        }
      }
    }

    return { tables, columns };
  } catch {
    return { tables: [], columns: {} };
  }
}
