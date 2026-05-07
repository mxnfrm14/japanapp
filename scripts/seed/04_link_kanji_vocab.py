"""
Phase 3b — Lier kanji ↔ vocabulary_item
=========================================
Ce script remplit la table kanji_vocabulary_link en parsant
vocabulary_item.japanese pour y détecter les kanji présents dans kanji_item.

Usage :
    python 04_link_kanji_vocab.py

Rapide (~quelques secondes) — pas d'appel réseau externe, tout se fait en base.
Idempotent grâce à la contrainte UNIQUE (kanji_id, vocabulary_item_id).
"""

import os
import re
import time
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

KANJI_REGEX = re.compile(r'[\u4e00-\u9faf\u3400-\u4dbf]')
BATCH_SIZE = 200


def fetch_all_kanji_map() -> dict[str, str]:
    """Retourne un dict {kanji_char: kanji_id} pour tous les kanji en base."""
    print("Chargement de kanji_item...")
    result = supabase.table("kanji_item").select("id, kanji").execute()
    kanji_map = {row["kanji"]: row["id"] for row in result.data}
    print(f"  {len(kanji_map)} kanji chargés")
    return kanji_map


def fetch_all_vocabulary(page_size: int = 1000) -> list[dict]:
    """Retourne tous les vocabulary_item (id + japanese)."""
    print("Chargement de vocabulary_item...")
    all_rows = []
    offset = 0
    while True:
        result = (
            supabase.table("vocabulary_item")
            .select("id, japanese")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not result.data:
            break
        all_rows.extend(result.data)
        offset += page_size
        if len(result.data) < page_size:
            break
    print(f"  {len(all_rows)} vocabulary_item chargés")
    return all_rows


def build_links(vocab_rows: list[dict], kanji_map: dict[str, str]) -> list[dict]:
    """
    Pour chaque vocabulary_item, détecte les kanji dans japanese
    et crée les rows kanji_vocabulary_link correspondantes.
    """
    links = []
    seen = set()  # Déduplication (kanji_id, vocab_id)

    for row in vocab_rows:
        vocab_id = row["id"]
        japanese = row["japanese"]

        kanji_chars = KANJI_REGEX.findall(japanese)
        for char in kanji_chars:
            kanji_id = kanji_map.get(char)
            if not kanji_id:
                continue  # Kanji non en base (très rare)

            key = (kanji_id, vocab_id)
            if key in seen:
                continue
            seen.add(key)

            # is_common = True si le kanji est le premier caractère du mot
            # (heuristique simple : le kanji principal d'un mot est souvent en tête)
            is_common = japanese.startswith(char)

            links.append({
                "id": str(uuid.uuid4()),
                "kanji_id": kanji_id,
                "vocabulary_item_id": vocab_id,
                "is_common": is_common,
            })

    return links


def insert_links(links: list[dict]) -> int:
    """Insert les liens en batches avec ignore_duplicates pour idempotence."""
    total = 0
    for i in range(0, len(links), BATCH_SIZE):
        batch = links[i:i + BATCH_SIZE]
        try:
            supabase.table("kanji_vocabulary_link").upsert(
                batch,
                on_conflict="kanji_id,vocabulary_item_id",
                ignore_duplicates=True
            ).execute()
            total += len(batch)
            print(f"  Batch {i // BATCH_SIZE + 1} — {len(batch)} liens insérés (total: {total})")
        except Exception as e:
            print(f"  [ERROR] Batch {i // BATCH_SIZE + 1} : {e}")
        time.sleep(0.05)
    return total


def main():
    print("=" * 50)
    print("JapanApp — Phase 3b : Liens kanji ↔ vocabulary")
    print("=" * 50)

    kanji_map = fetch_all_kanji_map()
    vocab_rows = fetch_all_vocabulary()

    print("\nConstruction des liens...")
    links = build_links(vocab_rows, kanji_map)
    print(f"  {len(links)} liens à insérer")

    if not links:
        print("  Rien à insérer — déjà fait ou pas de kanji trouvés.")
        return

    print("\nInsertion dans kanji_vocabulary_link...")
    total = insert_links(links)

    print(f"\n{'=' * 50}")
    print(f"Phase 3b terminée — {total} liens insérés")
    print("\nProchaine étape : python 05_seed_kana.py")
    print("=" * 50)


if __name__ == "__main__":
    main()
