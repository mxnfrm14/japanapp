/**
 * Phase 3a — Seed kanji_item via Jisho
 * ======================================
 * Source API : https://github.com/mistval/unofficial-jisho-api
 *
 * Usage :
 *   node 03_seed_kanji.mjs
 *
 * Ce script :
 *   1. Extrait tous les kanji uniques présents dans vocabulary_item.japanese
 *   2. Pour chaque kanji, appelle jisho.searchForKanji()
 *   3. Insère dans kanji_item avec meaning, readings, strokes, radical, components, jlpt_level
 *
 * Rate limit : 1 req/s.
 * Durée estimée : ~30-40min pour ~2000 kanji uniques.
 * Idempotent — utilise upsert sur kanji (UNIQUE constraint).
 */

import JishoAPI from 'unofficial-jisho-api';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const jisho = new JishoAPI();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const RATE_LIMIT_MS = 1100;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Regex pour détecter les kanji Unicode (CJK Unified Ideographs)
const KANJI_REGEX = /[\u4e00-\u9faf\u3400-\u4dbf]/g;

// Extrait tous les kanji uniques depuis vocabulary_item.japanese
async function extractUniqueKanji() {
  console.log('Extraction des kanji depuis vocabulary_item...');

  const { data, error } = await supabase
    .from('vocabulary_item')
    .select('japanese');

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);

  const kanjiSet = new Set();
  for (const row of data) {
    const matches = row.japanese.match(KANJI_REGEX) || [];
    for (const k of matches) kanjiSet.add(k);
  }

  const result = [...kanjiSet].sort();
  console.log(`${result.length} kanji uniques trouvés dans vocabulary_item`);
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

// Mappe un JLPT level string Jisho → int
function parseJlptLevel(raw) {
  if (!raw) return null;
  // Jisho retourne "N5", "N4", etc.
  const match = raw.match(/N(\d)/i);
  return match ? parseInt(match[1]) : null;
}

// Parse le résultat Jisho → row kanji_item
function parseKanjiResult(kanji, result) {
  if (!result?.found) return null;

  return {
    kanji,
    meaning: result.meaning || null,
    onyomi: result.onyomi || [],
    kunyomi: result.kunyomi || [],
    stroke_count: result.strokeCount || null,
    radical: result.radical?.symbol || null,
    jlpt_level: parseJlptLevel(result.jlptLevel),
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
  console.log('='.repeat(50));
  console.log('JapanApp — Phase 3a : Seed kanji_item');
  console.log('='.repeat(50));

  const allKanji = await extractUniqueKanji();
  const existingKanji = await fetchExistingKanji();

  const toProcess = allKanji.filter(k => !existingKanji.has(k));
  console.log(`${existingKanji.size} kanji déjà en base — ${toProcess.length} à fetcher\n`);

  let totalSuccess = 0;
  let totalNotFound = 0;
  let totalError = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const kanji = toProcess[i];
    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${kanji} ... `);

    await sleep(RATE_LIMIT_MS);

    try {
      const result = await fetchKanjiData(kanji);
      const row = parseKanjiResult(kanji, result);

      if (!row) {
        // Kanji non trouvé sur Jisho (rare, kanji très obscur ou non-standard)
        // On insère quand même une row minimale pour ne pas bloquer les links
        await supabase.from('kanji_item').upsert(
          { kanji, meaning: null, onyomi: [], kunyomi: [] },
          { onConflict: 'kanji', ignoreDuplicates: true }
        ).execute();
        console.log('NOT FOUND — row minimale insérée');
        totalNotFound++;
        continue;
      }

      const { error } = await supabase
        .from('kanji_item')
        .upsert(row, { onConflict: 'kanji' });

      if (error) throw new Error(error.message);

      const preview = row.meaning?.substring(0, 30) || '—';
      console.log(`OK — "${preview}" JLPT:N${row.jlpt_level || '?'} strokes:${row.stroke_count || '?'}`);
      totalSuccess++;

    } catch (err) {
      console.log(`ERROR — ${err.message}`);
      totalError++;
      await sleep(RATE_LIMIT_MS * 2);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Phase 3a terminée');
  console.log(`  Succès    : ${totalSuccess}`);
  console.log(`  Not found : ${totalNotFound}`);
  console.log(`  Erreurs   : ${totalError}`);
  console.log('\nProchaine étape : node 04_link_kanji_vocab.mjs');
  console.log('='.repeat(50));
}

main().catch(console.error);
