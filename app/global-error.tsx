"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p>{error.message || "An unexpected error occurred."}</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
