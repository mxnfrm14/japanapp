/**
 * Phase 3 — Seed kanji_item via JSON local + Jisho enrichment
 * ============================================================
 * Source JSON : data/JLPT_kanji_ALL.json (kanji + JLPT levels)
 * Source API  : https://github.com/mistval/unofficial-jisho-api
 *
 * Usage :
 *   node 03_seed_kanji.mjs
 *
 * Ce script :
 *   1. Charge le JSON JLPT_kanji_ALL.json (liste complète des kanji JLPT)
 *   2. Pour chaque kanji, appelle jisho.searchForKanji() pour enrichir
 *   3. Insère dans kanji_item avec meaning, readings, strokes, etc.
 *   4. Utilise le JLPT level du JSON local (source autoritaire)
 *   5. Évite les doublons via upsert
 *
 * Rate limit : 1 req/s.
 * Durée estimée : ~35-40min pour ~2000 kanji.
 * Idempotent — utilise upsert sur kanji (UNIQUE constraint).
 */

import JishoAPI from 'unofficial-jisho-api';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
dotenv.config();

const jisho = new JishoAPI();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const RATE_LIMIT_MS = 1100;
const MAX_RETRIES = 3;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Charge le JSON local JLPT_kanji_ALL.json
async function loadJLPTKanjiData() {
  console.log('Chargement du JSON JLPT_kanji_ALL.json...');

  const jsonPath = path.join(__dirname, 'data', 'JLPT_kanji_ALL.json');
  const rawData = await fs.readFile(jsonPath, 'utf-8');
  const kanjiData = JSON.parse(rawData);

  const result = Object.entries(kanjiData).map(([kanji, level]) => ({
    kanji,
    jlpt_level: parseInt(level),
  }));

  console.log(`${result.length} kanji chargés depuis le JSON\n`);
  return result;
}

// Récupère les kanji déjà en base pour éviter les re-fetches inutiles
async function fetchExistingKanji() {
  const { data, error } = await supabase
    .from('kanji_item')
    .select('kanji');

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return new Set(data.map(r => r.kanji));
}

// Appelle Jisho pour un kanji avec retry
async function fetchKanjiData(kanji, attempt = 1) {
  try {
    return await jisho.searchForKanji(kanji);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(RATE_LIMIT_MS * attempt);
      return fetchKanjiData(kanji, attempt + 1);
    }
    throw err;
  }
}

// Parse le résultat Jisho → row kanji_item
// Le JLPT level vient du JSON local (source authoritative), pas de Jisho
function parseKanjiResult(kanji, jlptLevelFromJSON, result) {
  if (!result?.found) {
    // Kanji non trouvé sur Jisho — on crée une row minimale avec le level du JSON
    return {
      kanji,
      meaning: null,
      onyomi: [],
      kunyomi: [],
      stroke_count: null,
      radical: null,
      jlpt_level: jlptLevelFromJSON,
      frequency_rank: null,
      stroke_order_gif_uri: null,
      components: null,
      notes: `[Imported from JLPT JSON, not found on Jisho]`,
    };
  }

  return {
    kanji,
    meaning: result.meaning || null,
    onyomi: result.onyomi || [],
    kunyomi: result.kunyomi || [],
    stroke_count: result.strokeCount || null,
    radical: result.radical?.symbol || null,
    jlpt_level: jlptLevelFromJSON, // Utilise le level du JSON, pas celui de Jisho
    frequency_rank: result.newspaperFrequencyRank
      ? parseInt(result.newspaperFrequencyRank)
      : null,
    stroke_order_gif_uri: result.strokeOrderGifUri || null,
    // components : on stocke parts (décomposition) + radical dans un jsonb structuré
    components: result.parts?.length
      ? {
          parts: result.parts,
          radical: result.radical || null,
          onyomi_examples: (result.onyomiExamples || []).slice(0, 3),
          kunyomi_examples: (result.kunyomiExamples || []).slice(0, 3),
        }
      : null,
    notes: null,
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('JapanApp — Phase 3 : Seed kanji_item (JSON + Jisho)');
  console.log('='.repeat(60));

  const jlptKanji = await loadJLPTKanjiData();
  const existingKanji = await fetchExistingKanji();

  const toProcess = jlptKanji.filter(k => !existingKanji.has(k.kanji));
  console.log(`${existingKanji.size} kanji déjà en base — ${toProcess.length} à fetcher/enrichir\n`);

  let totalSuccess = 0;
  let totalNotFound = 0;
  let totalError = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const { kanji, jlpt_level } = toProcess[i];
    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${kanji} (N${jlpt_level}) ... `);

    await sleep(RATE_LIMIT_MS);

    try {
      const result = await fetchKanjiData(kanji);
      const row = parseKanjiResult(kanji, jlpt_level, result);

      const { error } = await supabase
        .from('kanji_item')
        .upsert(row, { onConflict: 'kanji' });

      if (error) throw new Error(error.message);

      const preview = row.meaning?.substring(0, 25) || '—';
      console.log(`OK — "${preview}"`);
      totalSuccess++;

    } catch (err) {
      console.log(`ERROR — ${err.message}`);
      totalError++;
      await sleep(RATE_LIMIT_MS * 2);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Phase 3 terminée');
  console.log(`  ✓ Succès        : ${totalSuccess}`);
  console.log(`  ✗ Erreurs       : ${totalError}`);
  console.log(`  ℹ Déjà en base  : ${existingKanji.size}`);
  console.log(`  ────────────────`);
  console.log(`  Total kanji     : ${existingKanji.size + totalSuccess}`);
  console.log('\nProchaine étape : python 04_link_kanji_vocab.py');
  console.log('='.repeat(60));
}

main().catch(console.error);
