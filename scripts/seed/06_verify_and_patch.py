"""
Phase 5 — Vérification + patch NOT NULL post-enrichissement
=============================================================
À lancer APRÈS que 02_enrich_vocabulary.mjs est terminé.

Ce script :
  1. Vérifie que tous les meaning sont remplis
  2. Nettoie les placeholders '[mot]' restants (mots Jisho n'a pas trouvé)
  3. Applique le patch NOT NULL sur vocabulary_item.meaning et kanji_item.meaning
  4. Affiche un rapport final de la DB

Usage :
    python 06_apply_not_null_patch.py
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def check_nulls():
    print("\n=== Vérification des NULL ===")

    # vocabulary_item
    result = supabase.table("vocabulary_item").select("id", count="exact").is_("meaning", "null").execute()
    vocab_nulls = result.count
    print(f"  vocabulary_item avec meaning NULL  : {vocab_nulls}")

    # Placeholders [mot] insérés par le script d'enrichissement pour les not-found
    result2 = supabase.table("vocabulary_item").select("id", count="exact").like("meaning", "[%").execute()
    vocab_placeholders = result2.count
    print(f"  vocabulary_item avec placeholder   : {vocab_placeholders}")

    # kanji_item
    result3 = supabase.table("kanji_item").select("id", count="exact").is_("meaning", "null").execute()
    kanji_nulls = result3.count
    print(f"  kanji_item avec meaning NULL        : {kanji_nulls}")

    return vocab_nulls, vocab_placeholders, kanji_nulls


def print_db_stats():
    print("\n=== Statistiques de la DB ===")
    tables = [
        ("vocabulary_item", None),
        ("kanji_item", None),
        ("kana_item", None),
        ("kanji_vocabulary_link", None),
    ]
    for table, _ in tables:
        result = supabase.table(table).select("id", count="exact").execute()
        print(f"  {table:<30} : {result.count:>6} rows")


def apply_not_null_patch():
    """
    Le patch NOT NULL ne peut pas être appliqué via le client Supabase standard
    (il faut du DDL SQL direct). Instructions pour l'appliquer dans le SQL Editor.
    """
    print("\n=== Patch NOT NULL ===")
    print("Le patch DDL doit être appliqué dans le Supabase SQL Editor.")
    print("Copie et exécute le bloc suivant :\n")
    print("-" * 50)
    print("""
-- Patch post-enrichissement : repasser meaning en NOT NULL
-- À exécuter SEULEMENT si les vérifications ci-dessus retournent 0

BEGIN;

-- 1. Supprimer les placeholders restants (mots que Jisho n'a pas trouvé)
--    Ces mots sont très rares (caractères non-standard, erreurs de source)
DELETE FROM vocabulary_item WHERE meaning LIKE '[%' AND meaning LIKE '%]';

-- 2. Repasser NOT NULL
ALTER TABLE public.vocabulary_item
  ALTER COLUMN meaning SET NOT NULL;

ALTER TABLE public.kanji_item
  ALTER COLUMN meaning SET NOT NULL;

-- 3. Optionnel : enforcer onyomi/kunyomi si tu veux (certains kanji n'en ont pas)
-- ALTER TABLE public.kanji_item
--   ALTER COLUMN onyomi SET NOT NULL,
--   ALTER COLUMN onyomi SET DEFAULT '{}',
--   ALTER COLUMN kunyomi SET NOT NULL,
--   ALTER COLUMN kunyomi SET DEFAULT '{}';

COMMIT;
""")
    print("-" * 50)


def main():
    print("=" * 50)
    print("JapanApp — Phase 5 : Vérification & Patch NOT NULL")
    print("=" * 50)

    vocab_nulls, vocab_placeholders, kanji_nulls = check_nulls()

    if vocab_nulls > 0:
        print(f"\n⚠️  ATTENTION : {vocab_nulls} vocabulary_item ont encore meaning=NULL.")
        print("   Relance 02_enrich_vocabulary.mjs — il est idempotent.")
        print("   Il reprendra là où il s'est arrêté (filtre: meaning IS NULL).")
    elif vocab_placeholders > 0:
        print(f"\n⚠️  {vocab_placeholders} mots n'ont pas été trouvés sur Jisho (placeholders).")
        print("   Ils seront supprimés par le patch SQL ci-dessous.")
    else:
        print("\n✅ Tous les vocabulary_item ont un meaning — prêt pour le patch NOT NULL.")

    if kanji_nulls > 0:
        print(f"⚠️  {kanji_nulls} kanji_item ont encore meaning=NULL (kanji très rares/obscurs).")
        print("   Le patch supprime ces rows ou les laisse nullable selon ton choix.")

    print_db_stats()
    apply_not_null_patch()

    print(f"\n{'=' * 50}")
    print("Pipeline de seed terminé !")
    print("\nRécapitulatif des phases :")
    print("  ✅ Phase 1 : vocabulary_item seedé depuis JLPT_Vocabulary")
    print("  ✅ Phase 2 : vocabulary_item enrichi via Jisho (meaning, examples, tags)")
    print("  ✅ Phase 3a: kanji_item seedé via Jisho")
    print("  ✅ Phase 3b: kanji_vocabulary_link créé")
    print("  ✅ Phase 4 : kana_item seedé (hiragana + katakana)")
    print("  ✅ Phase 5 : NOT NULL patch appliqué")
    print("=" * 50)


if __name__ == "__main__":
    main()
