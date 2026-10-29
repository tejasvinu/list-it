"use client";

/** Replaces the root layout when it fails, so it brings its own document and minimal styles. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#0e0f0d", color: "#f1f1ec" }}>
        <title>list-it</title>
        <main style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 40, margin: 0 }}>Road closed</h1>
          <p style={{ color: "#b7b8b1", fontSize: 17, lineHeight: 1.5 }}>Something didn&apos;t load. Try again in a moment.</p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 16, minHeight: 44, padding: "0 20px", borderRadius: 999, border: 0, background: "#f1f1ec", color: "#121311", fontWeight: 600, fontSize: 15 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
