import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import apiClient from "../services/api";

const formatList = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return "—";
  }

  return value.join(" · ");
};

const formatStructuredValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
};

function DetailRow({ label, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-surface p-4 dark:border-gray-700">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
        {label}
      </div>
      <div className="mt-2 text-sm text-text-primary">{children}</div>
    </div>
  );
}

export default function KanjiDetail() {
  const { kanjiId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState(() => location.state?.item ?? null);
  const [isLoading, setIsLoading] = useState(!location.state?.item);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const loadKanji = async () => {
      if (!kanjiId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await apiClient.get(`/kanji/${kanjiId}`);
        if (!isActive) {
          return;
        }

        setItem(response.data);
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load kanji detail",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadKanji();

    return () => {
      isActive = false;
    };
  }, [kanjiId, location.state]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-2xl border border-gray-200 bg-bg-card px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:border-primary hover:text-primary dark:border-gray-700"
        >
          Back
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          Loading kanji detail...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : item ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-200 bg-bg-card p-6 shadow-sm dark:border-gray-700 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="font-cjk text-7xl leading-none text-text-primary md:text-8xl">
                  {item.kanji}
                </div>
                <h1 className="mt-4 font-display text-3xl text-text-primary md:text-4xl">
                  {item.meaning}
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-text-secondary md:text-base">
                  Detailed kanji reference for study and review.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    JLPT
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    N{item.jlpt_level ?? "—"}
                  </div>
                </div>
                <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Frequency
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    #{item.frequency_rank ?? "—"}
                  </div>
                </div>
                <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Strokes
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    {item.stroke_count ?? "—"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <DetailRow label="Onyomi">
              <div className="font-cjk text-base tracking-wide text-text-primary">
                {formatList(item.onyomi)}
              </div>
              {item.components?.onyomi_examples?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {item.components.onyomi_examples.map((ex, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-2 rounded-xl bg-bg px-3 py-2"
                    >
                      <span className="font-cjk text-sm font-semibold text-text-primary">
                        {ex.example}
                      </span>
                      {ex.reading && (
                        <span className="text-xs text-primary">
                          ({ex.reading})
                        </span>
                      )}
                      {ex.meaning && (
                        <span className="text-xs text-text-muted">
                          {ex.meaning}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DetailRow>
            <DetailRow label="Kunyomi">
              <div className="font-cjk text-base tracking-wide text-text-primary">
                {formatList(item.kunyomi)}
              </div>
              {item.components?.kunyomi_examples?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {item.components.kunyomi_examples.map((ex, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-2 rounded-xl bg-bg px-3 py-2"
                    >
                      <span className="font-cjk text-sm font-semibold text-text-primary">
                        {ex.example}
                      </span>
                      {ex.reading && (
                        <span className="text-xs text-primary">
                          ({ex.reading})
                        </span>
                      )}
                      {ex.meaning && (
                        <span className="text-xs text-text-muted">
                          {ex.meaning}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DetailRow>
            <DetailRow label="Radical">
              {item.components?.radical ? (
                <div className="flex items-center gap-3">
                  <span className="font-cjk text-3xl text-text-primary">
                    {item.components.radical.symbol}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {item.components.radical.meaning}
                  </span>
                </div>
              ) : (
                item.radical || "—"
              )}
            </DetailRow>
            <DetailRow label="Parts">
              {item.components?.parts?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.components.parts.map((part, i) => (
                    <span
                      key={i}
                      className="font-cjk rounded-xl bg-bg px-3 py-1.5 text-lg font-semibold text-text-primary"
                    >
                      {part}
                    </span>
                  ))}
                </div>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Stroke Order">
              {item.stroke_order_gif_uri ? (
                <img
                  src={item.stroke_order_gif_uri}
                  alt={`Stroke order for ${item.kanji}`}
                  className="h-32 w-32 rounded-xl object-contain"
                />
              ) : (
                '—'
              )}
            </DetailRow>
            <DetailRow label="Notes">{item.notes || "—"}</DetailRow>
          </section>
        </div>
      ) : null}
    </div>
  );
}
