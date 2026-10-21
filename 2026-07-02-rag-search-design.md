# RAG / Embeddings + Search Bar — Design Spec
_Date: 2026-07-02_

## Context

JapanApp est un tuteur de japonais avec un chat IA (Mistral) et une bibliothèque vocabulary/kanji. Deux problèmes à résoudre :

1. **L'IA répond sans contexte de la DB** — elle ignore les mots et kanjis qui existent dans l'app. Ajouter un RAG pour enrichir les réponses avec du contenu pédagogique pertinent, et retourner des liens directs vers les pages vocabulary/kanji.

2. **La search bar est sous-optimale** — les kanjis n'affichent pas leur reading dans les résultats, le classement ignore la pertinence, et il n'y a pas de filtre par type.

---

## Feature 1 : RAG + Liens IA

### Tables Supabase à créer

**`knowledge_document`** — table RAG unifiée, seule table interrogée lors d'une vector search :

```sql
create extension if not exists vector;

create table knowledge_document (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,       -- 'vocabulary_item' | 'kanji_item' | 'grammar_point'
  source_id uuid not null,
  title text,
  content text not null,            -- texte naturel prêt pour l'embedding
  embedding vector(1024),           -- Mistral embed dimensions
  created_at timestamptz default now(),
  unique (source_table, source_id)  -- clé logique pour upsert
);

create index knowledge_embedding_idx
  on knowledge_document
  using hnsw (embedding vector_cosine_ops);
```

**`grammar_point`** — créée maintenant, indexée quand des données sont ajoutées :

```sql
create table grammar_point (
  id uuid primary key default gen_random_uuid(),
  pattern text not null,
  jlpt_level int check (jlpt_level between 1 and 5),
  title text not null,
  meaning text,
  formation text,
  explanation text,
  examples text[],
  common_mistakes text[],
  related_patterns text[],
  embedding vector(1024),
  created_at timestamptz default now()
);
```

### Script d'indexation

**Fichier :** `scripts/indexer.py`

Pipeline générique avec une interface `IndexableSource` :
- `title(row)` → string affiché comme référence
- `content(row)` → texte naturel envoyé à l'embedding

**Sources implémentées :**

_VocabularyIndexer_ — template de contenu :
```
Vocabulary
Japanese: {japanese}
Reading: {reading}
Meaning: {meaning}
Example: {example_sentence}
Translation: {example_translation}
Tags: {tags}
```

_KanjiIndexer_ — template de contenu :
```
Kanji: {kanji}
Meaning: {meaning}
Onyomi: {onyomi}
Kunyomi: {kunyomi}
JLPT: N{jlpt_level}
Radical: {radical}
Notes: {notes}
```

_GrammarIndexer_ — squelette prêt, ne fait rien si `grammar_point` est vide.

**Comportement :**
- Lit chaque table via psycopg2 (même pool que le backend)
- Génère embedding via `mistral-embed` API
- Upsert dans `knowledge_document` sur `(source_table, source_id)`
- Affiche progression : `[12/9000] 食べる...`

**Lancement :**
```bash
cd scripts && python indexer.py
```

### Service RAG

**Nouveau fichier :** `backend/app/services/ai_rag.py`

Deux fonctions publiques :

**`route_query(question: str) -> QueryRoute`**

Routeur heuristique :
- Détecte des caractères japonais dans la question → `route = "hybrid"` (SQL direct + RAG)
- Sinon → `route = "semantic"` (vector search only)

**`get_rag_context(question: str, route: QueryRoute) -> RagResult`**

Retourne :
```python
@dataclass
class RagResult:
    context_text: str            # injecté dans le system_prompt Mistral
    references: list[Reference]  # retournés dans ChatResponse
```

- Route `hybrid` : SQL exact sur `vocabulary_item` / `kanji_item` pour les termes japonais détectés, puis vector search complémentaire (k=3)
- Route `semantic` : embedding de la question → `SELECT ... ORDER BY embedding <=> $1 LIMIT 5`

### Changement API

**`backend/app/models/ai.py`** — `ChatResponse` étendu :

```python
class Reference(BaseModel):
    type: Literal["vocabulary", "kanji"]
    id: str
    title: str

class ChatResponse(BaseModel):
    reply: str
    model: str
    references: list[Reference] = []
```

**`backend/app/routes/ai.py`** — `chat()` et `stream_text()` appellent `get_rag_context()` avant Mistral, injectent le contexte dans le system_prompt, retournent les références.

### Frontend — Chips de référence

**`frontend/src/pages/AIChat.jsx`** — sous chaque message assistant, si `references.length > 0` :

```jsx
<div className="references">
  {message.references.map(ref => (
    <Link to={`/${ref.type}/${ref.id}`} key={ref.id}>
      {ref.title} →
    </Link>
  ))}
</div>
```

Aucun nouveau composant — inline dans AIChat.

---

## Feature 2 : Search Bar

### Problèmes corrigés

1. Kanji `reading = NULL` dans les résultats → exposer onyomi/kunyomi
2. Classement sans pertinence → scoring match exact > préfixe > substring
3. Pas de filtre par type → préfixes `#kanji`, `#vocab`, `#vocabulary`

### Changements backend

**`backend/app/routes/search.py`** — parser le préfixe avant de passer la query au service :

```python
def parse_search_query(q: str) -> tuple[str, str | None]:
    """Returns (cleaned_query, type_filter)."""
    for prefix in ("#kanji",):
        if q.lower().startswith(prefix):
            return q[len(prefix):].strip(), "kanji"
    for prefix in ("#vocabulary", "#vocab"):
        if q.lower().startswith(prefix):
            return q[len(prefix):].strip(), "vocabulary"
    return q, None
```

**`backend/app/services/search.py`** — `search_vocabulary_and_kanji(q, limit, type_filter=None)` :

_Vocabulary SQL — score de pertinence :_
```sql
SELECT id, japanese, reading, meaning, tags, difficulty_level, frequency_rank,
  CASE
    WHEN japanese = %(q)s OR reading = %(q)s OR meaning = %(q)s THEN 1
    WHEN japanese ILIKE %(prefix)s OR reading ILIKE %(prefix)s OR meaning ILIKE %(prefix)s THEN 2
    ELSE 3
  END AS relevance_score
FROM public.vocabulary_item
WHERE japanese ILIKE %(sub)s OR reading ILIKE %(sub)s OR meaning ILIKE %(sub)s
ORDER BY relevance_score ASC, frequency_rank ASC NULLS LAST
LIMIT %(limit)s
```

_Kanji SQL — reading exposé + score :_
```sql
SELECT id, kanji AS japanese,
  COALESCE(
    NULLIF(array_to_string(onyomi, ', '), ''),
    array_to_string(kunyomi, ', ')
  ) AS reading,
  meaning, NULL AS tags, NULL AS difficulty_level, frequency_rank,
  CASE
    WHEN kanji = %(q)s OR meaning = %(q)s THEN 1
    WHEN kanji ILIKE %(prefix)s OR meaning ILIKE %(prefix)s THEN 2
    ELSE 3
  END AS relevance_score
FROM public.kanji_item
WHERE kanji ILIKE %(sub)s OR meaning ILIKE %(sub)s
  OR EXISTS (
    SELECT 1 FROM unnest(
      COALESCE(onyomi, ARRAY[]::text[]) || COALESCE(kunyomi, ARRAY[]::text[])
    ) AS r WHERE r ILIKE %(sub)s
  )
ORDER BY relevance_score ASC, frequency_rank ASC NULLS LAST
LIMIT %(limit)s
```

_Merge :_ `sorted(vocab_results + kanji_results, key=lambda x: x["relevance_score"])[:limit]`

_`type_filter` :_ si `"kanji"` → skip vocab SQL ; si `"vocabulary"` → skip kanji SQL.

### Changement frontend

**`frontend/src/components/Search.jsx`** — placeholder mis à jour :
```jsx
placeholder="Search... (#kanji, #vocab)"
```

Aucun autre changement côté frontend.

---

## Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/add_rag_tables.sql` | Créé |
| `scripts/indexer.py` | Créé (utilise le venv backend — psycopg2 + mistralai déjà présents) |
| `backend/app/services/ai_rag.py` | Créé |
| `backend/app/models/ai.py` | Modifié (Reference + references field) |
| `backend/app/routes/ai.py` | Modifié (appel RAG avant Mistral) |
| `backend/app/routes/search.py` | Modifié (parse_search_query) |
| `backend/app/services/search.py` | Modifié (scoring + kanji reading + type_filter) |
| `frontend/src/pages/AIChat.jsx` | Modifié (chips références) |
| `frontend/src/components/Search.jsx` | Modifié (placeholder hint) |

---

## Vérification

1. **Search bar** : lancer le backend + frontend, taper `食べる` → le mot doit apparaître en 1er. Taper `#kanji 食` → seuls les kanjis apparaissent avec leur reading (ex: "ショク, た"). Taper `#vocab eat` → seuls les vocabulaires.

2. **Indexer** : `python scripts/indexer.py` → doit logger `[N/total] titre...` pour vocabulary et kanji, sans erreur.

3. **RAG** : poser "Why is 食べました polite?" dans le chat → la réponse doit utiliser le contexte RAG (verifiable dans les logs backend) et afficher des chips `食べる →` et/ou `食` → sous le message.

4. **Liens** : cliquer une chip → navigation vers `/vocabulary/:id` ou `/kanji/:id`.
