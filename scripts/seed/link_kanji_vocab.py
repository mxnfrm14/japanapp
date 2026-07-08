#!/usr/bin/env python3
"""
link_kanji_vocab.py

Parcourt les tables `kanji_item` et `vocabulary_item`, détecte quels kanji
apparaissent dans chaque mot de vocabulaire, et insère les liens correspondants
dans `kanji_vocabulary_link`.

Les vocabs contenant un ou plusieurs caractères kanji (CJK) qui n'existent PAS
dans ta table `kanji_item` sont exclus de l'insertion et listés dans un rapport
CSV pour que tu puisses les ajouter plus tard.

Usage:
    uv run link_kanji_vocab.py                  # exécute et insère les liens
    uv run link_kanji_vocab.py --dry-run         # simulation, aucune écriture
    uv run link_kanji_vocab.py --report missing.csv

Variables d'environnement (via .env ou export):
    DATABASE_URL   # postgresql://user:pass@host:port/dbname
                   # (l'URL de connexion directe Postgres de ton projet Supabase,
                   #  disponible dans Project Settings > Database > Connection string)
"""

import argparse
import csv
import os
import re
import sys
from collections import defaultdict

import psycopg2
import psycopg2.extras

from dotenv import load_dotenv
load_dotenv(override=True) 

# Plage Unicode des idéogrammes CJK unifiés (couvre l'immense majorité des kanji usuels)
KANJI_PATTERN = re.compile(r"[\u4e00-\u9fff]")


def get_connection():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Erreur: la variable d'environnement DATABASE_URL n'est pas définie.", file=sys.stderr)
        sys.exit(1)
    return psycopg2.connect(db_url)


def fetch_kanji_map(cur) -> dict[str, str]:
    """Retourne un dict {caractère_kanji: id} pour tous les kanji en base."""
    cur.execute("SELECT id, kanji FROM kanji_item;")
    rows = cur.fetchall()
    kanji_map = {}
    for row in rows:
        kanji_id, kanji_char = row["id"], row["kanji"]
        if kanji_char in kanji_map:
            print(f"⚠️  Kanji dupliqué en base: {kanji_char} (ids {kanji_map[kanji_char]} et {kanji_id})")
        kanji_map[kanji_char] = kanji_id
    return kanji_map


def fetch_vocab(cur) -> list[dict]:
    cur.execute("SELECT id, japanese, reading FROM vocabulary_item;")
    return cur.fetchall()


def build_links(kanji_map: dict, vocab_rows: list[dict]):
    """
    Retourne:
        links: list of (kanji_id, vocab_id) à insérer (dédupliqués)
        missing: list of dict {vocab_id, japanese, reading, missing_chars}
                 pour les vocabs contenant au moins un kanji absent de kanji_map
    """
    links_set = set()
    missing = []

    for vocab in vocab_rows:
        vocab_id = vocab["id"]
        japanese = vocab["japanese"] or ""
        reading = vocab.get("reading")

        chars_in_word = set(KANJI_PATTERN.findall(japanese))
        if not chars_in_word:
            continue  # mot 100% kana, rien à lier, ce n'est pas une erreur

        found_kanji_ids = []
        missing_chars = []

        for ch in chars_in_word:
            if ch in kanji_map:
                found_kanji_ids.append(kanji_map[ch])
            else:
                missing_chars.append(ch)

        for kanji_id in found_kanji_ids:
            links_set.add((kanji_id, vocab_id))

        if missing_chars:
            missing.append({
                "vocab_id": vocab_id,
                "japanese": japanese,
                "reading": reading,
                "missing_chars": "".join(sorted(missing_chars)),
            })

    return list(links_set), missing


def insert_links(cur, links: list[tuple], dry_run: bool) -> int:
    if not links:
        return 0
    if dry_run:
        return len(links)

    query = """
        INSERT INTO kanji_vocabulary_link (kanji_id, vocabulary_item_id)
        VALUES %s
        ON CONFLICT (kanji_id, vocabulary_item_id) DO NOTHING;
    """
    psycopg2.extras.execute_values(cur, query, links, template="(%s, %s)", page_size=500)
    return cur.rowcount


def write_missing_report(missing: list[dict], path: str):
    if not missing:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["vocab_id", "japanese", "reading", "missing_chars"])
        writer.writeheader()
        writer.writerows(missing)


def main():
    parser = argparse.ArgumentParser(description="Lie les kanji au vocabulaire dans la base JapanApp.")
    parser.add_argument("--dry-run", action="store_true", help="N'écrit rien en base, affiche juste le résumé.")
    parser.add_argument("--report", default="missing_kanji_report.csv", help="Chemin du fichier CSV de rapport.")
    args = parser.parse_args()

    conn = get_connection()
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        print("Chargement des kanji...")
        kanji_map = fetch_kanji_map(cur)
        print(f"  -> {len(kanji_map)} kanji chargés.")

        print("Chargement du vocabulaire...")
        vocab_rows = fetch_vocab(cur)
        print(f"  -> {len(vocab_rows)} entrées de vocabulaire chargées.")

        print("Analyse et construction des liens...")
        links, missing = build_links(kanji_map, vocab_rows)
        print(f"  -> {len(links)} liens kanji-vocab détectés (uniques).")
        print(f"  -> {len(missing)} entrées de vocabulaire contiennent un ou plusieurs kanji absents de la table kanji_item.")

        inserted = insert_links(cur, links, args.dry_run)

        if args.dry_run:
            print(f"\n[DRY RUN] {inserted} liens auraient été insérés (ou ignorés si déjà existants).")
            conn.rollback()
        else:
            conn.commit()
            print(f"\n✅ Insertion terminée. {inserted} nouvelles lignes ajoutées à kanji_vocabulary_link "
                  f"(les doublons existants ont été ignorés).")

        if missing:
            write_missing_report(missing, args.report)
            print(f"\n📄 Rapport des kanji manquants écrit dans: {args.report}")
            # Petit aperçu des caractères manquants les plus fréquents
            char_counts = defaultdict(int)
            for m in missing:
                for ch in m["missing_chars"]:
                    char_counts[ch] += 1
            top = sorted(char_counts.items(), key=lambda x: -x[1])[:20]
            print("Kanji manquants les plus fréquents dans ton vocabulaire:")
            for ch, count in top:
                print(f"   {ch}  ({count} occurrence(s))")
        else:
            print("\n🎉 Aucun kanji manquant, tout le vocabulaire est couvert par ta table kanji_item.")

    except Exception as e:
        conn.rollback()
        print(f"Erreur, rollback effectué: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()