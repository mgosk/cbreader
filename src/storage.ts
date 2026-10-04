export type Progress = {
  bookId: string;
  page: number;
  fileName: string;
  updated: number;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("CBreader", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("progress", { keyPath: "bookId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadProgress(
  bookId: string,
): Promise<Progress | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("progress");
    const request = transaction.objectStore("progress").get(bookId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}
export async function saveProgress(progress: Progress) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("progress", "readwrite");
    transaction.objectStore("progress").put(progress);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
