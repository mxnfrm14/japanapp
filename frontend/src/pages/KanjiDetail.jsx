import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import apiClient from "../services/api";
import { useFavoriteItems } from "../hooks/useFavorites";
import FavoriteButton from "../components/FavoriteButton";
import FavoritesNotice from "../components/FavoritesNotice";

const formatList = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return "—";
  }

  return value.join(" · ");
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
  const favorites = useFavoriteItems('kanji', [kanjiId]);

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

      <FavoritesNotice favorites={favorites} />
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
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="min-w-0 break-words">
                <div className="font-cjk text-7xl leading-none text-text-primary md:text-8xl">
                  {item.kanji}
                </div>
                <h1 className="mt-4 font-display text-3xl text-text-primary md:text-4xl">
                  {item.meaning}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
                <FavoriteButton {...favorites.forItem(kanjiId)} />
                {[
                  { label: "JLPT", value: item.jlpt_level != null ? `N${item.jlpt_level}` : "—" },
                  { label: "Frequency", value: item.frequency_rank != null ? `#${item.frequency_rank}` : "—" },
                  { label: "Strokes", value: item.stroke_count ?? "—" },
                ].map(({ label, value }) => (
                  <dl
                    key={label}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-surface px-2 shadow-sm sm:px-3"
                  >
                    <dt className="text-xs text-text-secondary">{label}</dt>
                    <dd className="text-sm font-semibold leading-tight text-text-primary">{value}</dd>
                  </dl>
                ))}
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
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl bg-bg px-3 py-2"
                    >
                      <span className="shrink-0 whitespace-nowrap font-cjk text-sm font-semibold text-text-primary">
                        {ex.example}
                      </span>
                      {ex.reading && (
                        <span className="shrink-0 whitespace-nowrap text-xs text-primary">
                          ({ex.reading})
                        </span>
                      )}
                      {ex.meaning && (
                        <span className="min-w-0 flex-1 basis-40 break-words text-xs text-text-muted">
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
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl bg-bg px-3 py-2"
                    >
                      <span className="shrink-0 whitespace-nowrap font-cjk text-sm font-semibold text-text-primary">
                        {ex.example}
                      </span>
                      {ex.reading && (
                        <span className="shrink-0 whitespace-nowrap text-xs text-primary">
                          ({ex.reading})
                        </span>
                      )}
                      {ex.meaning && (
                        <span className="min-w-0 flex-1 basis-40 break-words text-xs text-text-muted">
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
