import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { openArchive, type Translation, type TextItem } from "./content";
import { usePageImages } from "./page-images";
import { loadProgress, saveProgress } from "./storage";
import "./style.css";
import {
  useFullscreen,
  usePageSwipe,
  useTabletLayout,
} from "./reader-controls";
type Book = Awaited<ReturnType<typeof openArchive>> & {
  translation: Translation;
  name: string;
  initialPage: number;
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
function App() {
  const tablet = useTabletLayout();
  const [cbz, setCbz] = useState<File>();
  const [book, setBook] = useState<Book>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  async function open() {
    if (!cbz) return;
    setBusy(true);
    setError("");
    let archive: Awaited<ReturnType<typeof openArchive>> | undefined;
    try {
      archive = await openArchive(cbz);
      const translation = archive.translation;
      let initialPage = 0;
      try {
        const saved = await loadProgress(translation.bookId);
        initialPage = Math.max(
          0,
          Math.min(archive.entries.length - 1, saved?.page ?? 0),
        );
      } catch {
        setStorageWarning(
          "Reading progress cannot be saved in this browser session.",
        );
      }
      setBook({ ...archive, translation, name: cbz.name, initialPage });
    } catch (e) {
      if (archive) await archive.close();
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header
        className="brand"
        style={tablet && book ? { display: "none" } : undefined}
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            if (book) {
              void book.close();
              setBook(undefined);
            }
          }}
        >
          <span className="brand-mark">cb</span>
          <span>
            CB <strong>Lang</strong>
          </span>
        </a>
        <span className="eyebrow">A LITTLE READING. A NEW LANGUAGE.</span>
      </header>
      {book ? (
        <Reader
          key={book.name + book.translation.bookId}
          book={book}
          tablet={tablet}
          warning={storageWarning}
          onStorageError={() =>
            setStorageWarning(
              "Reading progress cannot be saved in this browser session.",
            )
          }
          onClose={() => {
            void book.close();
            setBook(undefined);
          }}
        />
      ) : (
        <main className="welcome">
          <section className="intro">
            <div className="eyebrow">YOUR COMICS, ANOTHER LANGUAGE</div>
            <h1>
              A story in every panel.
              <br />
              <em>A word at a time.</em>
            </h1>
            <p>
              Read your favourite comics. Tap a text bubble to discover its
              translation in your chosen language, and keep the story moving.
            </p>
            <div className="features">
              <span>01 &nbsp; Open a comic</span>
              <span>02 &nbsp; Tap a text bubble</span>
              <span>03 &nbsp; Start exploring</span>
            </div>
          </section>
          <section className="import-card" aria-labelledby="open-title">
            <div className="card-number">LET’S TURN THE FIRST PAGE</div>
            <h2 id="open-title">Open your comic</h2>
            <p className="muted">Choose a comic with translations included.</p>
            <FilePicker
              label="Comic archive"
              hint=".cbz"
              accept=".cbz"
              file={cbz}
              disabled={busy}
              onFile={setCbz}
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="primary"
              disabled={!cbz || busy}
              onClick={() => void open()}
            >
              {busy ? "Opening your comic…" : "Start reading →"}
            </button>
            <p className="privacy">
              {tablet && <>Tap the page to show reading controls. </>}
              Your comic stays on this device. Reopen the comic to resume
              reading.
            </p>
          </section>
        </main>
      )}
    </>
  );
}
function FilePicker({
  label,
  hint,
  accept,
  file,
  disabled,
  onFile,
}: {
  label: string;
  hint: string;
  accept: string;
  file?: File;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      className={"file-picker " + (dragging ? "dragging" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f && !disabled) onFile(f);
      }}
    >
      <span className="file-icon">{hint === ".cbz" ? "▤" : "文"}</span>
      <span className="file-copy">
        <strong>{label}</strong>
        <span>{file ? file.name : `Choose or drop a ${hint} file`}</span>
      </span>
      <span className="file-type">{file ? "✓" : hint}</span>
      <input
        type="file"
        accept={accept}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.[0]) onFile(e.target.files[0]);
        }}
      />
    </label>
  );
}
function Reader({
  book,
  tablet,
  warning,
  onStorageError,
  onClose,
}: {
  book: Book;
  tablet: boolean;
  warning: string;
  onStorageError: () => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(book.initialPage);
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsToggle = useRef<HTMLButtonElement>(null);
  const [language, setLanguage] = useState(
    book.translation.languages.translations[0],
  );
  const languageName = (tag: string) =>
    new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag;
  const translatedText = (item: TextItem) =>
    item.translations[language] ??
    "Translation not available in this language yet.";
  const [zoom, setZoom] = useState(100);
  const { url, previous, next, error } = usePageImages(book.entries, page);
  const [selected, setSelected] = useState<TextItem>();
  const [highlights, setHighlights] = useState(true);
  const [naturalWidth, setNaturalWidth] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const { panel, fullscreen, pending, toggle } = useFullscreen();
  const [stageWidth, setStageWidth] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const entry = book.entries[page];
  const translatedPage = book.translation.pages.find(
    (p) => p.image === entry.filename,
  );
  const items = [...(translatedPage?.items ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const swipe = usePageSwipe(
    zoom === 100 && Boolean(url),
    (direction) => navigate(page + direction),
    page,
    book.entries.length,
  );
  function navigate(next: number) {
    if (
      tablet &&
      panel.current?.querySelector(".toolbar")?.contains(document.activeElement)
    ) {
      controlsToggle.current?.focus({ preventScroll: true });
    }
    setSelected(undefined);
    setControlsVisible(false);
    setPage(Math.max(0, Math.min(book.entries.length - 1, next)));
  }
  useEffect(() => {
    if (!tablet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [tablet]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    viewport.current?.scrollTo(0, 0);
  }, [entry]);
  useEffect(() => {
    void saveProgress({
      bookId: book.translation.bookId,
      page,
      fileName: book.name,
      updated: Date.now(),
    }).catch(onStorageError);
  }, [book, page]);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) =>
      setStageWidth(entries[0].contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [url]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLElement &&
        /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
      )
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(page - 1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate(page + 1);
      }
      if (e.key === "Escape") {
        setSelected(undefined);
        setControlsVisible(false);
        if (tablet) controlsToggle.current?.focus({ preventScroll: true });
      }
      if (tablet && e.key.toLowerCase() === "m") setControlsVisible((v) => !v);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [page, book, tablet]);
  return (
    <main className={`reader ${tablet ? "tablet-reader" : ""}`}>
      <div className="reader-heading">
        <div>
          <div className="eyebrow">YOUR READING ROOM</div>
          <h1>{book.name.replace(/\.cbz$/i, "")}</h1>
        </div>
        <button className="secondary" onClick={onClose}>
          Change comic
        </button>
      </div>
      {warning && (
        <p role="status" className="notice">
          {warning}
        </p>
      )}
      {book.translation.draft && (
        <p className="notice">
          Draft translations · {book.translation.pages.length} of{" "}
          {book.entries.length} pages included. Text and tap areas may need
          review.
        </p>
      )}
      <div className="reader-grid">
        <section
          ref={panel}
          className={`canvas-panel ${fullscreen ? "reading-fullscreen" : ""}`}
          aria-label="Comic reader"
        >
          {tablet && (
            <button
              ref={controlsToggle}
              className="reader-controls-toggle"
              aria-label="Show reading controls"
              aria-expanded={controlsVisible}
              onClick={() => setControlsVisible((v) => !v)}
            >
              ☰
            </button>
          )}
          {(!tablet || controlsVisible) && (
            <div className="toolbar">
              {tablet && (
                <div className="tablet-actions">
                  <button onClick={onClose}>Change comic</button>
                  <span className="tablet-book-title">
                    {book.name.replace(/\.cbz$/i, "")}
                  </span>
                  <button
                    aria-label="Hide reading controls"
                    onClick={() => {
                      setControlsVisible(false);
                      controlsToggle.current?.focus({ preventScroll: true });
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="page-controls">
                <button
                  aria-label="Previous page"
                  disabled={page === 0}
                  onClick={() => navigate(page - 1)}
                >
                  ←
                </button>
                <label>
                  Page{" "}
                  <select
                    aria-label="Page"
                    value={page}
                    onChange={(e) => navigate(Number(e.target.value))}
                  >
                    {book.entries.map((_, i) => (
                      <option key={i} value={i}>
                        {i + 1}
                      </option>
                    ))}
                  </select>{" "}
                  / {book.entries.length}
                </label>
                <button
                  aria-label="Next page"
                  disabled={page === book.entries.length - 1}
                  onClick={() => navigate(page + 1)}
                >
                  →
                </button>
              </div>
              <label className="language-control">
                Translate to
                <select
                  aria-label="Translation language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  {book.translation.languages.translations.map((tag) => (
                    <option key={tag} value={tag}>
                      {languageName(tag)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="zoom-controls">
                <button
                  className="fullscreen-toggle"
                  aria-label={
                    fullscreen ? "Exit fullscreen" : "Enter fullscreen"
                  }
                  aria-pressed={fullscreen}
                  disabled={pending}
                  onClick={() => void toggle()}
                >
                  {fullscreen ? "↙ Exit" : "⛶"}
                </button>
                <button
                  aria-label="Zoom out"
                  disabled={zoom === 100}
                  onClick={() => setZoom((z) => Math.max(100, z - 25))}
                >
                  −
                </button>
                <button aria-label="Reset zoom" onClick={() => setZoom(100)}>
                  {zoom}%
                </button>
                <button
                  aria-label="Zoom in"
                  disabled={zoom === 250}
                  onClick={() => setZoom((z) => Math.min(250, z + 25))}
                >
                  +
                </button>
              </div>
            </div>
          )}
          <div
            className={`viewport ${zoom === 100 ? "swipe-viewport" : ""}`}
            ref={viewport}
            {...swipe.handlers}
            onClick={
              tablet
                ? (event) => {
                    if ((event.target as HTMLElement).closest("button")) return;
                    if (selected) setSelected(undefined);
                    else setControlsVisible((v) => !v);
                  }
                : undefined
            }
            style={{ touchAction: zoom === 100 ? "pan-y pinch-zoom" : "auto" }}
          >
            {error ? (
              <p role="alert" className="error">
                {error}
              </p>
            ) : !url ? (
              <p role="status" className="loading">
                Loading page…
              </p>
            ) : (
              <div
                ref={stage}
                className={`page-stage ${swipe.motion.settling ? "swipe-settling" : ""}`}
                style={{
                  transform: `translate3d(${swipe.motion.offset}px, 0, 0)`,
                  width:
                    fullscreen || tablet
                      ? (Math.min(
                          viewportSize.width,
                          (viewportSize.height * naturalWidth) / naturalHeight,
                        ) *
                          zoom) /
                        100
                      : zoom + "%",
                }}
              >
                <img
                  src={url}
                  alt={`Comic page ${page + 1}`}
                  onLoad={(e) => {
                    setNaturalWidth(e.currentTarget.naturalWidth);
                    setNaturalHeight(e.currentTarget.naturalHeight);
                  }}
                />
                {zoom === 100 && previous && (
                  <img
                    className="swipe-neighbor"
                    src={previous}
                    alt=""
                    aria-hidden="true"
                    style={{
                      transform: `translateX(-${swipe.motion.width || viewport.current?.clientWidth || 0}px)`,
                    }}
                  />
                )}
                {zoom === 100 && next && (
                  <img
                    className="swipe-neighbor"
                    src={next}
                    alt=""
                    aria-hidden="true"
                    style={{
                      transform: `translateX(${swipe.motion.width || viewport.current?.clientWidth || 0}px)`,
                    }}
                  />
                )}
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={`hotspot ${highlights ? "outlined" : ""} ${selected?.id === item.id ? "selected" : ""}`}
                    aria-label={`Translate: ${item.original}`}
                    aria-pressed={selected?.id === item.id}
                    style={{
                      left: item.rect.x * 100 + "%",
                      top: item.rect.y * 100 + "%",
                      width: item.rect.width * 100 + "%",
                      height: item.rect.height * 100 + "%",
                    }}
                    onClick={() =>
                      setSelected(selected?.id === item.id ? undefined : item)
                    }
                  >
                    {selected?.id === item.id && (
                      <span
                        lang={language}
                        dir="auto"
                        style={{
                          fontFamily: item.font || "inherit",
                          fontSize: item.fontSize
                            ? Math.max(
                                10,
                                (item.fontSize * stageWidth) / naturalWidth,
                              )
                            : 14,
                        }}
                      >
                        {translatedText(item)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(!tablet || controlsVisible) && (
            <div className="canvas-footer">
              <label>
                <input
                  type="checkbox"
                  checked={highlights}
                  onChange={(e) => setHighlights(e.target.checked)}
                />{" "}
                Show text regions
              </label>
              <span>
                {zoom === 100
                  ? "Swipe or use ← → to turn pages"
                  : "Scroll to pan · Reset zoom to swipe"}
              </span>
              {tablet && (warning || book.translation.draft) && (
                <p className="tablet-status" role="status">
                  {warning ||
                    `Draft translations · ${book.translation.pages.length} of ${book.entries.length} pages included.`}
                </p>
              )}
            </div>
          )}
          {(fullscreen || tablet) && selected && (
            <div className="fullscreen-caption" aria-live="polite">
              <p lang={language} dir="auto">
                {translatedText(selected)}
              </p>
              <button
                aria-label="Dismiss translation"
                onClick={() => setSelected(undefined)}
              >
                ×
              </button>
            </div>
          )}
        </section>
        <aside className="translation-panel">
          <div className="eyebrow">BETWEEN THE LINES</div>
          <h2>Explore the words</h2>
          <p className="muted">
            Tap a region on the page or choose a line below.
          </p>
          {selected && (
            <section className="translation-card" aria-live="polite">
              <div className="translation-label">
                {languageName(book.translation.languages.original)}{" "}
                <button
                  aria-label="Close translation"
                  onClick={() => setSelected(undefined)}
                >
                  ×
                </button>
              </div>
              <p lang={book.translation.languages.original} dir="auto">
                {selected.original}
              </p>
              <div className="translation-label">{languageName(language)}</div>
              <p lang={language} dir="auto" className="translated-text">
                {translatedText(selected)}
              </p>
            </section>
          )}
          <div className="region-header">
            <span>PAGE {page + 1}</span>
            <span>{items.length} text regions</span>
          </div>
          {items.length ? (
            <ol className="region-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className={selected?.id === item.id ? "active" : ""}
                    aria-pressed={selected?.id === item.id}
                    onClick={() => setSelected(item)}
                  >
                    <span>{String(item.order).padStart(2, "0")}</span>
                    <span>{item.original}</span>
                    <span>↗</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty">
              <span>✧</span>
              <p>
                {translatedPage
                  ? "No translated text on this page."
                  : "This page hasn’t been translated yet."}
              </p>
              <p className="muted">Keep reading with the arrows above.</p>
            </div>
          )}
          <div className="reader-note">
            One panel. One discovery.
            <br />
            Read at your own pace.
          </div>
        </aside>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
