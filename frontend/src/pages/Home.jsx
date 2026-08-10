import React from "react";
import DailyWordCard from "../components/DailyWordCard";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">
            Welcome to JapanApp <span className="font-cjk text-2xl text-text-secondary">日本語学習アプリ</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            A gentle place to learn kana, kanji and vocabulary.
          </p>
        </div>
      </header>

      <div className="mb-6">
        <DailyWordCard />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg p-4 shadow-sm bg-surface">
          <h3 className="text-text-primary">Start Learning</h3>
          <p className="text-text-secondary">
            Choose a lesson to begin.
          </p>
        </div>

        <div className="rounded-lg p-4 shadow-sm bg-surface">
          <h3 className="text-text-primary">Flashcards</h3>
          <p className="text-text-secondary">
            Practice active recall.
          </p>
        </div>

        <div className="rounded-lg p-4 shadow-sm bg-surface">
          <h3 className="text-text-primary">AI Tutor</h3>
          <p className="text-text-secondary">
            Get conversational help from the AI chat.
          </p>
        </div>

        <div className="card bg-surface w-96 shadow-sm">
          
          <div className="card-body">
            <h2 className="card-title">
              Card Title
              <div className="badge badge-primary">NEW</div>
            </h2>
            <p>A card component has a figure, a body part, and inside body there are title and actions parts</p>
            <div className="card-actions justify-end">
              <div className="badge badge-outline">Fashion</div>
              <div className="badge badge-outline">Products</div>
            </div>
          </div>
        </div>

      </section>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        <div className="bg-info-subtle rounded-lg p-4 border border-info">
          <div className="text-info mt-4">
          <p>
            JapanApp is a learning platform for Japanese language and culture.
            It offers lessons, flashcards, and an AI tutor to help you on your
            language learning journey.
          </p>
          </div>
        </div>
       

        <div className="bg-warning-subtle rounded-lg p-4 border border-warning">
          <div className="text-warning mt-4">
            <p>
              JapanApp is a learning platform for Japanese language and culture.
              It offers lessons, flashcards, and an AI tutor to help you on your
              language learning journey.
            </p>
          </div>
        </div>

        <div className="bg-success-subtle rounded-lg p-4 border border-success">
          <div className="text-success mt-4">
            <p>
              JapanApp is a learning platform for Japanese language and culture.
              It offers lessons, flashcards, and an AI tutor to help you on your
              language learning journey.
            </p>
          </div>
        </div>
        <div className="bg-error-subtle rounded-lg p-4 border border-error">
          <div className="text-error mt-4">
            <p>
              JapanApp is a learning platform for Japanese language and culture.
              It offers lessons, flashcards, and an AI tutor to help you on your
              language learning journey.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <button className="btn bg-primary text-white">Get Started</button>
      </section>
    </div>
  );
}
