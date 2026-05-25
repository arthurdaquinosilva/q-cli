import type { DbClient, Driver } from './client.js';

export interface ErdColumn {
  name: string;
  type: string;
  isPk: boolean;
  fkTable?: string;
}

export interface ErdTable {
  name: string;
  columns: ErdColumn[];
}

export interface ErdData {
  tables: ErdTable[];
}

function erdSql(driver: Driver): string {
  if (driver === 'postgresql') {
    return `
      SELECT c.table_name, c.column_name, c.data_type,
        (pk.column_name IS NOT NULL) AS is_pk,
        fk.foreign_table AS fk_table
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name, ccu.table_name AS foreign_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `;
  }

  if (driver === 'mysql') {
    return `
      SELECT c.TABLE_NAME AS table_name, c.COLUMN_NAME AS column_name,
        c.DATA_TYPE AS data_type,
        (c.COLUMN_KEY = 'PRI') AS is_pk,
        kcu.REFERENCED_TABLE_NAME AS fk_table
      FROM information_schema.COLUMNS c
      LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
        ON kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
        AND kcu.TABLE_NAME = c.TABLE_NAME
        AND kcu.COLUMN_NAME = c.COLUMN_NAME
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      WHERE c.TABLE_SCHEMA = DATABASE()
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `;
  }

  return `
    SELECT m.name AS table_name, p.name AS column_name,
      p.type AS data_type,
      (p.pk > 0) AS is_pk,
      f."table" AS fk_table
    FROM sqlite_master m
    JOIN pragma_table_info(m.name) p
    LEFT JOIN pragma_foreign_key_list(m.name) f ON f."from" = p.name
    WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%'
    ORDER BY m.name, p.cid
  `;
}

export async function fetchErd(client: DbClient, driver: Driver): Promise<ErdData> {
  const result = await client.query(erdSql(driver));

  const tableMap = new Map<string, ErdColumn[]>();
  for (const row of result.rows) {
    const tableName = String(row['table_name'] ?? '');
    if (!tableMap.has(tableName)) tableMap.set(tableName, []);
    const cols = tableMap.get(tableName)!;
    const colName = String(row['column_name'] ?? '');
    if (cols.some((c) => c.name === colName)) continue; // deduplicate (sqlite FK join)
    cols.push({
      name: colName,
      type: String(row['data_type'] ?? ''),
      isPk: Boolean(row['is_pk']),
      fkTable: row['fk_table'] ? String(row['fk_table']) : undefined,
    });
  }

  return {
    tables: Array.from(tableMap.entries()).map(([name, columns]) => ({ name, columns })),
  };
}
