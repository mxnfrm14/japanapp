# JapanApp — Pipeline de Seed

Scripts pour peupler la base de données depuis les sources ouvertes.

## Sources

| Source | Usage |
|--------|-------|
| [JLPT_Vocabulary (Bluskyo)](https://github.com/Bluskyo/JLPT_Vocabulary) | Vocabulaire N1-N5 (japanese + reading + level) |
| [unofficial-jisho-api (mistval)](https://github.com/mistval/unofficial-jisho-api) | Enrichissement (meaning, examples, kanji data) |
| Hardcodé | Kana (hiragana + katakana) |

---

## Prérequis

### Fichiers de données
Télécharge le [latest release](https://github.com/Bluskyo/JLPT_Vocabulary/releases/latest) de JLPT_Vocabulary.  
Extrais les fichiers JSON dans un dossier `data/` à la racine de ce dossier :

```
seed/
├── data/
│   ├── n1_vocab_cleaned.json
│   ├── n2_vocab_cleaned.json
│   ├── n3_vocab_cleaned.json
│   ├── n4_vocab_cleaned.json
│   └── n5_vocab_cleaned.json
├── 01_seed_vocabulary.py
├── 02_enrich_vocabulary.mjs
├── 03_seed_kanji.mjs
├── 04_link_kanji_vocab.py
├── 05_seed_kana.py
└── 06_verify_and_patch.py
```

### Variables d'environnement
Crée un fichier `.env` à la racine de `seed/` :

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   # Service role key (pas la clé anon)
```

> ⚠️ Utilise obligatoirement la **service role key** pour bypasser le RLS pendant le seed.  
> Ne l'expose jamais côté frontend.

### Dépendances Python
```bash
pip install supabase python-dotenv
```

### Dépendances Node.js
```bash
npm install unofficial-jisho-api @supabase/supabase-js dotenv
```

---

## Exécution

Lance les scripts dans l'ordre. Chaque script est **idempotent** — relançable sans risque.

### Phase 1 — Seed vocabulary (quelques secondes)
```bash
python 01_seed_vocabulary.py
```
Insère ~9000 mots depuis les fichiers JSON JLPT avec japanese + reading + difficulty_level.  
`meaning` reste NULL à ce stade — c'est intentionnel.

---

### Phase 2 — Enrichissement vocabulary (~3h)
```bash
node 02_enrich_vocabulary.mjs
```
Pour chaque mot sans `meaning`, appelle Jisho et remplit :
- `meaning` (définition anglaise)
- `tags` (part of speech)
- `example_sentence` + `example_translation`
- `frequency_rank`

Rate-limited à 1 req/s. Laisse tourner en arrière-plan (tmux recommandé).  
Si le script est interrompu, relance-le — il reprend là où il s'est arrêté.

---

### Phase 3a — Seed kanji (~30-40min)
```bash
node 03_seed_kanji.mjs
```
Extrait tous les kanji uniques de `vocabulary_item.japanese`, appelle Jisho pour chacun,  
et remplit `kanji_item` avec meaning, readings, strokes, radical, components, jlpt_level, stokes gif.

---

### Phase 3b — Liens kanji ↔ vocabulary (quelques secondes)
```bash
python 04_link_kanji_vocab.py
```
Parse chaque `vocabulary_item.japanese` pour détecter les kanji présents  
et crée les rows `kanji_vocabulary_link` correspondantes.

---

### Phase 4 — Seed kana (quelques secondes)
```bash
python 05_seed_kana.py
```
Insère les 46 hiragana + 46 katakana de base + youon + dakuten + katakana spéciaux.  
Données hardcodées — pas d'appel réseau.

---

### Phase 5 — Vérification + patch NOT NULL
```bash
python 06_verify_and_patch.py
```
Vérifie que tout est rempli et affiche le SQL DDL à copier dans le Supabase SQL Editor  
pour repasser `meaning` en `NOT NULL`.

---

## Durée totale estimée

| Phase | Durée |
|-------|-------|
| Phase 1 | < 1 min |
| Phase 2 | ~3h (rate limit Jisho) |
| Phase 3a | ~35 min |
| Phase 3b | < 1 min |
| Phase 4 | < 1 min |
| Phase 5 | < 1 min |
| **Total** | **~3h30** |

---

## Résultat attendu

| Table | Rows |
|-------|------|
| `vocabulary_item` | ~9 000 |
| `kanji_item` | ~2 000 |
| `kana_item` | ~200 |
| `kanji_vocabulary_link` | ~15 000–20 000 |

---

## Notes

- Les scripts Python utilisent le client Supabase Python (`supabase-py`).
- Les scripts Node utilisent `@supabase/supabase-js` v2.
- Tous les inserts utilisent `upsert` avec `ignore_duplicates=true` — safe à relancer.
- Le script d'enrichissement met un placeholder `[mot]` pour les mots non trouvés sur Jisho.  
  Le script de vérification les supprime avant d'appliquer le NOT NULL.
