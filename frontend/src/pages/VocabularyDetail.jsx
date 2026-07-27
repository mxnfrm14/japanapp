import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import apiClient from "../services/api";
import { ArrowUpRightIcon, ToteSimpleIcon } from "@phosphor-icons/react";

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

export default function VocabularyDetail() {
  const { vocabularyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState(() => location.state?.item ?? null);
  const [isLoading, setIsLoading] = useState(!location.state?.item);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const loadVocabularyItem = async () => {
      if (!vocabularyId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await apiClient.get(`/vocabulary/${vocabularyId}`);

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
            : "Failed to load vocabulary detail",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadVocabularyItem();

    return () => {
      isActive = false;
    };
  }, [vocabularyId]);

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
          Loading vocabulary detail...
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
                <div className="font-display text-5xl text-text-primary md:text-6xl">
                  {item.japanese}
                </div>
                <div className="mt-2 text-base text-text-secondary md:text-lg">
                  {item.reading || "—"}
                </div>
                <h1 className="mt-4 font-display text-3xl text-text-primary md:text-4xl">
                  {item.meaning || "No meaning provided."}
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-text-secondary md:text-base">
                  Detailed vocabulary reference for study and review.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Level
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    N{item.difficulty_level ?? "—"}
                  </div>
                </div>

                {/* button to jisho url */}
                {item.jisho_url && (
                  <button
                    type="button"
                    onClick={() => window.open(item.jisho_url, "_blank")}
                    className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-text-inverse shadow-sm transition-colors hover:bg-primary-hover"
                  >
                    Open in Jisho <ArrowUpRightIcon size={20} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="">
            <DetailRow label="Example Sentence">
              <div className="flex items-baseline gap-2 flex-wrap">
                {item.example_sentence && (
                  <span className="text-primary text-2xl">
                    {item.example_sentence}
                  </span>
                )}
                {item.example_translation && (
                  <span className="text-xs text-text-secondary">
                    {item.example_translation}
                  </span>
                )}
              </div>
            </DetailRow>
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            <DetailRow label="Tags">
              <div className="flex flex-wrap gap-2">
                {(item.tags || []).length > 0
                  ? item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-gray-200 bg-bg px-3 py-1 text-xs font-medium text-text-secondary dark:border-gray-700"
                      >
                        {tag}
                      </span>
                    ))
                  : "—"}
              </div>
            </DetailRow>
            <DetailRow label="Linked Kanji">
              {item.linked_kanjis && item.linked_kanjis.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.linked_kanjis.map((kanji) => (
                    <button
                      onClick={() => navigate(`/kanji/${kanji.kanji_id}`)}
                      type="button"
                      key={kanji.id}
                      className="rounded-full border border-gray-200 bg-bg px-3 py-1 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary"
                    >
                      {kanji.kanji}
                    </button>
                  ))}
                </div>
              )}
            </DetailRow>
          </section>
        </div>
      ) : null}
    </div>
  );
}
