import { z } from "zod";
import {
  BlobReader,
  BlobWriter,
  ZipReader,
  type FileEntry,
} from "@zip.js/zip.js";
const rect = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(
    (r) => r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001,
    "Rectangle extends beyond the page",
  );
const languageTag = z.string().refine((tag) => {
  try {
    return Intl.getCanonicalLocales(tag)[0] === tag;
  } catch {
    return false;
  }
}, "Use a canonical language tag, such as en, pl, or pt-BR");
const item = z.object({
  id: z.string().min(1),
  kind: z.enum(["speech", "caption", "sign", "sound_effect"]),
  order: z.number().int().positive(),
  rect,
  original: z.string().trim().min(1),
  translations: z.record(languageTag, z.string().trim().min(1)),
  font: z.string().min(1).optional(),
  fontSize: z.number().positive().optional(),
});
const schema = z.object({
  schemaVersion: z.literal(2),
  draft: z.boolean().optional(),
  bookId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  languages: z.object({
    original: languageTag,
    translations: z.array(languageTag).min(1),
  }),
  pages: z
    .array(
      z.object({
        number: z.number().int().positive(),
        image: z.string().min(1),
        items: z.array(item),
      }),
    )
    .min(1),
});
export type Translation = z.infer<typeof schema>;
export type TextItem = z.infer<typeof item>;
export function parseTranslation(value: unknown): Translation {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Error(
      "Invalid translation: " +
        result.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
    );
  const data = result.data;
  const targets = data.languages.translations;
  if (
    new Set(targets).size !== targets.length ||
    targets.includes(data.languages.original)
  )
    throw new Error(
      "Translation languages must be unique and different from the original language.",
    );
  const ids = new Set<string>(),
    paths = new Set<string>();
  let last = 0;
  for (const page of data.pages) {
    if (page.number <= last || (!data.draft && page.number !== last + 1))
      throw new Error(
        "Page numbers must be ordered and unique; release pages must be consecutive.",
      );
    last = page.number;
    if (paths.has(page.image))
      throw new Error("Duplicate image path: " + page.image);
    paths.add(page.image);
    const orders = page.items.map((i) => i.order).sort((a, b) => a - b);
    if (orders.some((n, i) => n !== i + 1))
      throw new Error(`Invalid reading order on page ${page.number}.`);
    for (const region of page.items) {
      if (
        Object.keys(region.translations).some((tag) => !targets.includes(tag))
      )
        throw new Error("Item contains an undeclared translation language.");
      if (!data.draft && targets.some((tag) => !region.translations[tag]))
        throw new Error(
          "Release items must include every declared translation language.",
        );
      if (ids.has(region.id))
        throw new Error("Duplicate text ID: " + region.id);
      ids.add(region.id);
    }
  }
  return data;
}
export function matchTranslation(data: Translation, paths: string[]) {
  for (const page of data.pages)
    if (paths[page.number - 1] !== page.image)
      throw new Error(
        `Page ${page.number} does not match this CBZ: ${page.image}`,
      );
  if (!data.draft && data.pages.length !== paths.length)
    throw new Error("Release translation must include every page.");
}
export async function openArchive(file: File) {
  const reader = new ZipReader(new BlobReader(file));
  try {
    const allEntries = await reader.getEntries();
    const candidates = allEntries.filter(
      (e): e is FileEntry => !e.directory && e.filename === "translations.json",
    );
    if (candidates.length !== 1)
      throw new Error(
        candidates.length
          ? "Duplicate translations.json entries."
          : "This CBZ is missing translations.json. Add a translation before opening it.",
      );
    const embedded = candidates[0];
    if (embedded.encrypted)
      throw new Error("Password-protected translations are not supported.");
    const limit = 10 * 1024 * 1024;
    if (embedded.uncompressedSize > limit)
      throw new Error("Translation file exceeds 10 MB.");
    let length = 0;
    const chunks: Uint8Array[] = [];
    const output = new WritableStream<Uint8Array>({
      write(chunk) {
        length += chunk.length;
        if (length > limit) throw new Error("Translation file exceeds 10 MB.");
        chunks.push(chunk);
      },
    });
    await embedded.getData(output);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let value: unknown;
    try {
      value = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new Error("translations.json must contain valid UTF-8 JSON.");
    }
    const translation = parseTranslation(value);
    const entries = allEntries.filter(
      (e): e is FileEntry =>
        !e.directory && /\.(jpe?g|png|webp|gif|avif)$/i.test(e.filename),
    );
    if (!entries.length)
      throw new Error("This archive contains no supported page images.");
    if (new Set(entries.map((e) => e.filename)).size !== entries.length)
      throw new Error("The archive contains duplicate image paths.");
    if (entries.some((e) => e.encrypted))
      throw new Error("Password-protected archives are not supported.");
    matchTranslation(
      translation,
      entries.map((e) => e.filename),
    );
    return { entries, translation, close: () => reader.close() };
  } catch (error) {
    await reader.close();
    throw error;
  }
}
export async function readPage(entry: FileEntry) {
  if (entry.uncompressedSize > 50 * 1024 * 1024)
    throw new Error("This page is too large to display (50 MB maximum).");
  const ext = entry.filename.split(".").pop()!.toLowerCase();
  const blob = await entry.getData(
    new BlobWriter("image/" + (ext === "jpg" ? "jpeg" : ext)),
  );
  return URL.createObjectURL(blob);
}
