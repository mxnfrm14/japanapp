"""
Phase 1 — Seed vocabulary_item
================================
Source : https://github.com/Bluskyo/JLPT_Vocabulary (releases/latest)

Format du fichier source (un seul fichier JSON unifié) :
{
    "嗚呼": [{ "reading": "ああ", "level": 1 }],
    "相":   [{ "reading": "あい", "level": 1 }],
    ...
}

Le champ "level" correspond au niveau JLPT (1=N1 difficile, 5=N5 facile),
ce qui mappe directement sur difficulty_level dans le schéma.

Usage :
    1. Place le fichier JSON dans ./data/ (renomme-le vocab.json)
    2. pip install supabase python-dotenv
    3. Crée un .env avec SUPABASE_URL et SUPABASE_SERVICE_KEY
    4. python 01_seed_vocabulary.py
"""

import json
import os
import time
import uuid
from pathlib import Path
from urllib.parse import quote
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]  # Service role key — bypass RLS

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

VOCAB_FILE = Path("scripts\\seed\\data\\vocab.json")  # Renomme selon le nom exact du fichier téléchargé
BATCH_SIZE = 100


def build_jisho_url(japanese: str) -> str:
    return f"https://jisho.org/search/{quote(japanese)}"


def main():
    print("=" * 50)
    print("JapanApp — Phase 1 : Seed vocabulary_item")
    print("=" * 50)

    if not VOCAB_FILE.exists():
        print(f"[ERROR] Fichier introuvable : {VOCAB_FILE}")
        print("Télécharge le JSON depuis https://github.com/Bluskyo/JLPT_Vocabulary/releases/latest")
        print("et place-le dans data/ en le renommant vocab.json")
        return

    print(f"Chargement de {VOCAB_FILE}...")
    with open(VOCAB_FILE, encoding="utf-8") as f:
        data = json.load(f)
    print(f"  {len(data)} entrées trouvées dans le fichier")

    # Stats par niveau
    level_counts = {}
    for entries in data.values():
        for e in entries:
            lvl = e.get("level")
            level_counts[lvl] = level_counts.get(lvl, 0) + 1
    for lvl in sorted(level_counts):
        print(f"  N{lvl} : {level_counts[lvl]} mots")

    print("\nConstruction des rows...")
    rows = []
    seen = set()

    for japanese, entries in data.items():
        japanese = japanese.strip()
        if not japanese or not entries:
            continue

        # Si un mot a plusieurs entrées (plusieurs lectures/niveaux),
        # on prend celle avec le niveau le plus élevé (N5=5, le plus accessible)
        best_entry = max(entries, key=lambda e: e.get("level", 0))
        reading = best_entry.get("reading", "").strip() or None
        level = best_entry.get("level")

        if level not in (1, 2, 3, 4, 5):
            print(f"  [WARN] Niveau invalide pour '{japanese}' : {level} — skippé")
            continue

        if japanese in seen:
            continue
        seen.add(japanese)

        rows.append({
            "id": str(uuid.uuid4()),
            "japanese": japanese,
            "reading": reading,
            "difficulty_level": level,
            "jisho_url": build_jisho_url(japanese),
            # meaning=null intentionnel — rempli par Phase 2 (02_enrich_vocabulary.mjs)
        })

    print(f"  {len(rows)} rows valides à insérer\n")

    total_inserted = 0
    total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        try:
            supabase.table("vocabulary_item").upsert(
                batch,
                on_conflict="japanese",
                ignore_duplicates=True
            ).execute()
            total_inserted += len(batch)
            print(f"  Batch {batch_num}/{total_batches} — {len(batch)} rows OK (total: {total_inserted})")
        except Exception as e:
            print(f"  [ERROR] Batch {batch_num} : {e}")
        time.sleep(0.1)

    print(f"\n{'=' * 50}")
    print(f"Phase 1 terminée — {total_inserted} rows insérées")
    print("Prochaine étape : node 02_enrich_vocabulary.mjs")
    print("=" * 50)


if __name__ == "__main__":
    main()