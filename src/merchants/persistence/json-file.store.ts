import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const DATE_FIELD_NAMES = new Set([
  'createdAt',
  'updatedAt',
  'connectedAt',
  'collectedAt',
  'expiresAt',
]);

export function resolveMerchantDataDir(): string {
  return process.env.MERCHANT_DATA_DIR ?? join(process.cwd(), 'data');
}

export function reviveDates<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (DATE_FIELD_NAMES.has(key) && typeof nested === 'string') {
        result[key] = new Date(nested);
      } else {
        result[key] = reviveDates(nested);
      }
    }
    return result as T;
  }

  return value as T;
}

export class JsonFileStore<T> {
  constructor(
    private readonly fileName: string,
    private readonly defaultValue: T,
  ) {}

  private filePath(): string {
    return join(resolveMerchantDataDir(), this.fileName);
  }

  read(): T {
    const path = this.filePath();
    if (!existsSync(path)) {
      return this.defaultValue;
    }

    try {
      const raw = readFileSync(path, 'utf8');
      return reviveDates<T>(JSON.parse(raw));
    } catch {
      return this.defaultValue;
    }
  }

  write(data: T): void {
    const path = this.filePath();
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${path}.tmp`;
    writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tempPath, path);
  }
}
