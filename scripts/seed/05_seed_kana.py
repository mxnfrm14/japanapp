"""
Phase 4 — Seed kana_item (hiragana + katakana)
===============================================
Pas de source externe — les kana sont stables et complets.
Ce script hardcode les 46 hiragana + 46 katakana de base
plus les combinaisons (youon) les plus courantes.

Usage :
    python 05_seed_kana.py
"""

import os
import uuid
import time
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Données kana ────────────────────────────────────────────────────────────
# Format : (character, romaji, group_name, stroke_count)
# order_index est attribué automatiquement à l'insertion

HIRAGANA = [
    # Voyelles
    ("あ", "a",   "vowels", 3),
    ("い", "i",   "vowels", 2),
    ("う", "u",   "vowels", 2),
    ("え", "e",   "vowels", 2),
    ("お", "o",   "vowels", 3),
    # K
    ("か", "ka",  "k", 3), ("き", "ki", "k", 4), ("く", "ku", "k", 1),
    ("け", "ke",  "k", 3), ("こ", "ko", "k", 2),
    # S
    ("さ", "sa",  "s", 2), ("し", "shi","s", 1), ("す", "su", "s", 2),
    ("せ", "se",  "s", 3), ("そ", "so", "s", 2),
    # T
    ("た", "ta",  "t", 4), ("ち", "chi","t", 2), ("つ", "tsu","t", 1),
    ("て", "te",  "t", 2), ("と", "to", "t", 2),
    # N
    ("な", "na",  "n", 4), ("に", "ni", "n", 3), ("ぬ", "nu", "n", 2),
    ("ね", "ne",  "n", 2), ("の", "no", "n", 1),
    # H
    ("は", "ha",  "h", 3), ("ひ", "hi", "h", 2), ("ふ", "fu", "h", 1),
    ("へ", "he",  "h", 1), ("ほ", "ho", "h", 4),
    # M
    ("ま", "ma",  "m", 3), ("み", "mi", "m", 3), ("む", "mu", "m", 3),
    ("め", "me",  "m", 2), ("も", "mo", "m", 3),
    # Y
    ("や", "ya",  "y", 2), ("ゆ", "yu", "y", 2), ("よ", "yo", "y", 2),
    # R
    ("ら", "ra",  "r", 2), ("り", "ri", "r", 2), ("る", "ru", "r", 1),
    ("れ", "re",  "r", 2), ("ろ", "ro", "r", 1),
    # W
    ("わ", "wa",  "w", 2), ("を", "wo", "w", 2),
    # N seul
    ("ん", "n",   "n_alone", 1),
    # Dakuten (sonores)
    ("が", "ga",  "g", 4), ("ぎ", "gi", "g", 5), ("ぐ", "gu", "g", 2),
    ("げ", "ge",  "g", 4), ("ご", "go", "g", 3),
    ("ざ", "za",  "z", 3), ("じ", "ji", "z", 2), ("ず", "zu", "z", 3),
    ("ぜ", "ze",  "z", 4), ("ぞ", "zo", "z", 3),
    ("だ", "da",  "d", 5), ("ぢ", "di", "d", 3), ("づ", "du", "d", 2),
    ("で", "de",  "d", 3), ("ど", "do", "d", 3),
    ("ば", "ba",  "b", 4), ("び", "bi", "b", 3), ("ぶ", "bu", "b", 2),
    ("べ", "be",  "b", 4), ("ぼ", "bo", "b", 5),
    # Handakuten (semi-sonores)
    ("ぱ", "pa",  "p", 4), ("ぴ", "pi", "p", 3), ("ぷ", "pu", "p", 2),
    ("ぺ", "pe",  "p", 4), ("ぽ", "po", "p", 5),
    # Youon (combinaisons)
    ("きゃ", "kya", "youon", 7), ("きゅ", "kyu", "youon", 6), ("きょ", "kyo", "youon", 6),
    ("しゃ", "sha", "youon", 3), ("しゅ", "shu", "youon", 2), ("しょ", "sho", "youon", 2),
    ("ちゃ", "cha", "youon", 4), ("ちゅ", "chu", "youon", 3), ("ちょ", "cho", "youon", 3),
    ("にゃ", "nya", "youon", 6), ("にゅ", "nyu", "youon", 5), ("にょ", "nyo", "youon", 5),
    ("ひゃ", "hya", "youon", 5), ("ひゅ", "hyu", "youon", 4), ("ひょ", "hyo", "youon", 6),
    ("みゃ", "mya", "youon", 6), ("みゅ", "myu", "youon", 6), ("みょ", "myo", "youon", 6),
    ("りゃ", "rya", "youon", 4), ("りゅ", "ryu", "youon", 4), ("りょ", "ryo", "youon", 3),
    ("ぎゃ", "gya", "youon", 8), ("ぎゅ", "gyu", "youon", 7), ("ぎょ", "gyo", "youon", 7),
    ("じゃ", "ja",  "youon", 4), ("じゅ", "ju",  "youon", 3), ("じょ", "jo",  "youon", 3),
    ("びゃ", "bya", "youon", 6), ("びゅ", "byu", "youon", 6), ("びょ", "byo", "youon", 7),
    ("ぴゃ", "pya", "youon", 6), ("ぴゅ", "pyu", "youon", 6), ("ぴょ", "pyo", "youon", 7),
]

KATAKANA = [
    # Voyelles
    ("ア", "a",   "vowels", 2),
    ("イ", "i",   "vowels", 2),
    ("ウ", "u",   "vowels", 3),
    ("エ", "e",   "vowels", 2),
    ("オ", "o",   "vowels", 3),
    # K
    ("カ", "ka",  "k", 2), ("キ", "ki", "k", 3), ("ク", "ku", "k", 2),
    ("ケ", "ke",  "k", 3), ("コ", "ko", "k", 2),
    # S
    ("サ", "sa",  "s", 3), ("シ", "shi","s", 3), ("ス", "su", "s", 2),
    ("セ", "se",  "s", 3), ("ソ", "so", "s", 2),
    # T
    ("タ", "ta",  "t", 3), ("チ", "chi","t", 3), ("ツ", "tsu","t", 3),
    ("テ", "te",  "t", 3), ("ト", "to", "t", 2),
    # N
    ("ナ", "na",  "n", 2), ("ニ", "ni", "n", 3), ("ヌ", "nu", "n", 2),
    ("ネ", "ne",  "n", 4), ("ノ", "no", "n", 1),
    # H
    ("ハ", "ha",  "h", 3), ("ヒ", "hi", "h", 2), ("フ", "fu", "h", 1),
    ("ヘ", "he",  "h", 1), ("ホ", "ho", "h", 4),
    # M
    ("マ", "ma",  "m", 2), ("ミ", "mi", "m", 3), ("ム", "mu", "m", 2),
    ("メ", "me",  "m", 2), ("モ", "mo", "m", 3),
    # Y
    ("ヤ", "ya",  "y", 2), ("ユ", "yu", "y", 2), ("ヨ", "yo", "y", 3),
    # R
    ("ラ", "ra",  "r", 2), ("リ", "ri", "r", 2), ("ル", "ru", "r", 2),
    ("レ", "re",  "r", 1), ("ロ", "ro", "r", 3),
    # W
    ("ワ", "wa",  "w", 2), ("ヲ", "wo", "w", 3),
    # N seul
    ("ン", "n",   "n_alone", 2),
    # Dakuten
    ("ガ", "ga",  "g", 3), ("ギ", "gi", "g", 4), ("グ", "gu", "g", 3),
    ("ゲ", "ge",  "g", 4), ("ゴ", "go", "g", 3),
    ("ザ", "za",  "z", 4), ("ジ", "ji", "z", 4), ("ズ", "zu", "z", 3),
    ("ゼ", "ze",  "z", 4), ("ゾ", "zo", "z", 3),
    ("ダ", "da",  "d", 4), ("ヂ", "di", "d", 4), ("ヅ", "du", "d", 4),
    ("デ", "de",  "d", 4), ("ド", "do", "d", 3),
    ("バ", "ba",  "b", 4), ("ビ", "bi", "b", 3), ("ブ", "bu", "b", 2),
    ("ベ", "be",  "b", 2), ("ボ", "bo", "b", 5),
    # Handakuten
    ("パ", "pa",  "p", 4), ("ピ", "pi", "p", 3), ("プ", "pu", "p", 2),
    ("ペ", "pe",  "p", 2), ("ポ", "po", "p", 5),
    # Youon
    ("キャ", "kya", "youon", 5), ("キュ", "kyu", "youon", 5), ("キョ", "kyo", "youon", 6),
    ("シャ", "sha", "youon", 6), ("シュ", "shu", "youon", 5), ("ショ", "sho", "youon", 5),
    ("チャ", "cha", "youon", 6), ("チュ", "chu", "youon", 6), ("チョ", "cho", "youon", 6),
    ("ニャ", "nya", "youon", 5), ("ニュ", "nyu", "youon", 5), ("ニョ", "nyo", "youon", 6),
    ("ヒャ", "hya", "youon", 5), ("ヒュ", "hyu", "youon", 4), ("ヒョ", "hyo", "youon", 5),
    ("ミャ", "mya", "youon", 5), ("ミュ", "myu", "youon", 5), ("ミョ", "myo", "youon", 6),
    ("リャ", "rya", "youon", 4), ("リュ", "ryu", "youon", 4), ("リョ", "ryo", "youon", 4),
    ("ギャ", "gya", "youon", 6), ("ギュ", "gyu", "youon", 6), ("ギョ", "gyo", "youon", 7),
    ("ジャ", "ja",  "youon", 7), ("ジュ", "ju",  "youon", 6), ("ジョ", "jo",  "youon", 6),
    ("ビャ", "bya", "youon", 6), ("ビュ", "byu", "youon", 5), ("ビョ", "byo", "youon", 6),
    ("ピャ", "pya", "youon", 6), ("ピュ", "pyu", "youon", 5), ("ピョ", "pyo", "youon", 6),
    # Katakana spéciaux (mots étrangers courants)
    ("ヴ", "vu",  "special", 4),
    ("ファ", "fa", "special", 4), ("フィ", "fi", "special", 4),
    ("フェ", "fe", "special", 4), ("フォ", "fo", "special", 4),
    ("ティ", "ti", "special", 5), ("ディ", "di", "special", 5),
    ("ウィ", "wi", "special", 5), ("ウェ", "we", "special", 5), ("ウォ", "wo2","special", 6),
]


def build_rows(kana_list: list, script_type: str) -> list[dict]:
    rows = []
    for idx, (char, romaji, group, strokes) in enumerate(kana_list):
        rows.append({
            "id": str(uuid.uuid4()),
            "script_type": script_type,
            "character": char,
            "romaji": romaji,
            "group_name": group,
            "stroke_count": strokes,
            "order_index": idx,
        })
    return rows


def seed_kana(rows: list[dict], script_type: str) -> int:
    print(f"\n--- {script_type} ({len(rows)} caractères) ---")
    total = 0
    BATCH = 50
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        try:
            supabase.table("kana_item").upsert(
                batch,
                on_conflict="script_type,character",
                ignore_duplicates=True
            ).execute()
            total += len(batch)
            print(f"  Batch {i // BATCH + 1} — {len(batch)} rows insérées")
        except Exception as e:
            print(f"  [ERROR] : {e}")
        time.sleep(0.05)
    return total


def main():
    print("=" * 50)
    print("JapanApp — Phase 4 : Seed kana_item")
    print("=" * 50)

    hira_rows = build_rows(HIRAGANA, "hiragana")
    kata_rows = build_rows(KATAKANA, "katakana")

    total = 0
    total += seed_kana(hira_rows, "hiragana")
    total += seed_kana(kata_rows, "katakana")

    print(f"\n{'=' * 50}")
    print(f"Phase 4 terminée — {total} kana insérés")
    print("\nProchaine étape : python 06_apply_not_null_patch.py")
    print("(après vérification que meaning est rempli partout)")
    print("=" * 50)


if __name__ == "__main__":
    main()
