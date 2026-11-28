export interface MediaStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  delete(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

const DEFAULT_DB_NAME = "agritech-media";
const DEFAULT_STORE_NAME = "blobs";

export function createMemoryMediaStore(): MediaStore {
  const map = new Map<string, Blob>();
  return {
    async put(id, blob) {
      map.set(id, blob);
    },
    async get(id) {
      return map.get(id) ?? null;
    },
    async delete(id) {
      map.delete(id);
    },
    async clearAll() {
      map.clear();
    },
  };
}

function openMediaDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB."));
  });
}

function runStoreTx<T>(
  dbName: string,
  storeName: string,
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openMediaDb(dbName, storeName).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = op(store);
        let result: T;
        req.onsuccess = () => {
          result = req.result;
        };
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB transaction failed."));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB transaction aborted."));
        };
      })
  );
}

export function createIndexedDbMediaStore(
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME
): MediaStore {
  return {
    async put(id, blob) {
      await runStoreTx(dbName, storeName, "readwrite", (store) => store.put(blob, id));
    },
    async get(id) {
      const val = await runStoreTx<Blob | undefined>(dbName, storeName, "readonly", (store) =>
        store.get(id)
      );
      return val instanceof Blob ? val : null;
    },
    async delete(id) {
      await runStoreTx(dbName, storeName, "readwrite", (store) => store.delete(id));
    },
    async clearAll() {
      await runStoreTx(dbName, storeName, "readwrite", (store) => store.clear());
    },
  };
}

let cachedDefaultStore: MediaStore | null = null;

export function getDefaultMediaStore(): MediaStore {
  if (cachedDefaultStore) return cachedDefaultStore;
  cachedDefaultStore =
    typeof indexedDB !== "undefined" ? createIndexedDbMediaStore() : createMemoryMediaStore();
  return cachedDefaultStore;
}
