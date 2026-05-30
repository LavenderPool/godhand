import type { StorageAdapter } from "./interfaces.js";

export class SqliteStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async get<T>(key: string): Promise<T | null> {
    const val = this.store.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
}

export class PostgresStorageAdapter implements StorageAdapter {
  async get<T>(_key: string): Promise<T | null> {
    throw new Error("PostgresStorageAdapter not implemented");
  }

  async set<T>(_key: string, _value: T): Promise<void> {
    throw new Error("PostgresStorageAdapter not implemented");
  }

  async delete(_key: string): Promise<void> {
    throw new Error("PostgresStorageAdapter not implemented");
  }

  async list(_prefix: string): Promise<string[]> {
    throw new Error("PostgresStorageAdapter not implemented");
  }
}
