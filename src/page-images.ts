import { useEffect, useRef, useState } from "react";
import { readPage, type openArchive } from "./content";

type Entry = Awaited<ReturnType<typeof openArchive>>["entries"][number];
type Resource = { url?: string; error?: string; disposed: boolean };

// Keep only this page and its neighbors decoded, ready for a continuous swipe.
export function usePageImages(entries: Entry[], page: number) {
  const cache = useRef(new Map<Entry, Resource>());
  const [, refresh] = useState(0);
  useEffect(() => {
    const wanted = entries.slice(Math.max(0, page - 1), page + 2);
    for (const [entry, resource] of cache.current) {
      if (!wanted.includes(entry)) {
        resource.disposed = true;
        if (resource.url) URL.revokeObjectURL(resource.url);
        cache.current.delete(entry);
      }
    }
    for (const entry of wanted) {
      if (cache.current.has(entry)) continue;
      const resource: Resource = { disposed: false };
      cache.current.set(entry, resource);
      void readPage(entry)
        .then(async (url) => {
          try {
            const image = new Image();
            image.src = url;
            await image.decode();
            if (resource.disposed) URL.revokeObjectURL(url);
            else resource.url = url;
          } catch {
            URL.revokeObjectURL(url);
            throw new Error("This page image cannot be decoded.");
          }
        })
        .catch((error: unknown) => {
          resource.error =
            error instanceof Error ? error.message : "Cannot load this page.";
        })
        .finally(() => {
          if (!resource.disposed) refresh((n) => n + 1);
        });
    }
  }, [entries, page]);
  useEffect(
    () => () => {
      for (const resource of cache.current.values()) {
        resource.disposed = true;
        if (resource.url) URL.revokeObjectURL(resource.url);
      }
      cache.current.clear();
    },
    [],
  );
  return {
    url: cache.current.get(entries[page])?.url ?? "",
    previous: cache.current.get(entries[page - 1])?.url,
    next: cache.current.get(entries[page + 1])?.url,
    error: cache.current.get(entries[page])?.error ?? "",
  };
}
