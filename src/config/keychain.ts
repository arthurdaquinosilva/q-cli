const SERVICE = 'querky';

function accountKey(driver: string, user: string, host: string, port: number): string {
  return `${driver}:${user}@${host}:${port}`;
}

export async function savePassword(driver: string, user: string, host: string, port: number, password: string): Promise<void> {
  if (!password) return;
  try {
    const keytar = await import('keytar');
    await keytar.default.setPassword(SERVICE, accountKey(driver, user, host, port), password);
  } catch {
    // keytar unavailable — silently skip
  }
}

export async function getPassword(driver: string, user: string, host: string, port: number): Promise<string | null> {
  try {
    const keytar = await import('keytar');
    return await keytar.default.getPassword(SERVICE, accountKey(driver, user, host, port));
  } catch {
    return null;
  }
}
