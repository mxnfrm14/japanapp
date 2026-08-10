/**
 * Phase 3b — Seed kanji_item manquants via CSV local + Jisho enrichment
 * =======================================================================
 * Source CSV  : missing_kanji_report.csv (généré par link_kanji_vocab.py)
 * Source API  : https://github.com/mistval/unofficial-jisho-api
 *
 * Contexte :
 *   Après avoir fait tourner link_kanji_vocab.py, certains mots de
 *   vocabulaire contiennent des kanji absents de kanji_item. Ce script
 *   les récupère, les enrichit via Jisho, et les insère dans kanji_item.
 *
 * Usage :
 *   npm install csv-parse   (si pas déjà installé)
 *   node 03b_seed_missing_kanji.mjs [chemin/vers/missing_kanji_report.csv]
 *
 * Ce script :
 *   1. Charge le CSV missing_kanji_report.csv (colonne missing_chars)
 *   2. Extrait l'ensemble unique des caractères kanji manquants
 *   3. Ignore ceux déjà présents en base (au cas où ajoutés entre-temps)
 *   4. Pour chaque kanji, appelle jisho.searchForKanji() pour enrichir
 *   5. Insère dans kanji_item avec meaning, readings, strokes, etc.
 *   6. jlpt_level vient de Jisho si disponible (ex: "N3" -> 3), sinon null
 *      (ces kanji ne viennent pas de la liste JLPT officielle, donc pas
 *      de source autoritaire comme en Phase 3 — à corriger manuellement
 *      si besoin après coup)
 *
 * Rate limit : 1 req/s.
 * Idempotent — utilise upsert sur kanji (UNIQUE constraint).
 *
 * Prochaine étape après ce script : rejouer link_kanji_vocab.py pour
 * créer les liens vers les kanji nouvellement ajoutés.
 */

import JishoAPI from 'unofficial-jisho-api';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
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

// Charge le CSV et extrait l'ensemble unique des caractères kanji manquants
async function loadMissingKanjiFromCSV(csvPath) {
  console.log(`Chargement du CSV ${csvPath}...`);

  const rawData = await fs.readFile(csvPath, 'utf-8');
  const records = parse(rawData, {
    columns: true,
    skip_empty_lines: true,
  });

  const kanjiSet = new Set();
  for (const row of records) {
    const missingChars = row.missing_chars || '';
    for (const ch of missingChars) {
      kanjiSet.add(ch);
    }
  }

  const result = Array.from(kanjiSet);
  console.log(`${records.length} lignes lues — ${result.length} kanji uniques manquants trouvés\n`);
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

// Convertit le jlptLevel renvoyé par Jisho (ex: "N3", "None") en entier ou null
function parseJlptLevel(jlptLevelRaw) {
  if (!jlptLevelRaw) return null;
  const match = /N([1-5])/i.exec(jlptLevelRaw);
  return match ? parseInt(match[1]) : null;
}

// Parse le résultat Jisho → row kanji_item
function parseKanjiResult(kanji, result) {
  if (!result?.found) {
    return {
      kanji,
      meaning: null,
      onyomi: [],
      kunyomi: [],
      stroke_count: null,
      radical: null,
      jlpt_level: null,
      frequency_rank: null,
      stroke_order_gif_uri: null,
      components: null,
      notes: `[Imported from missing_kanji_report.csv, not found on Jisho]`,
    };
  }

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
  const csvPath = process.argv[2] || path.join(process.cwd(), 'missing_kanji_report.csv');

  console.log('='.repeat(60));
  console.log('JapanApp — Phase 3b : Seed kanji manquants (CSV + Jisho)');
  console.log('='.repeat(60));

  const missingKanji = await loadMissingKanjiFromCSV(csvPath);
  const existingKanji = await fetchExistingKanji();

  const toProcess = missingKanji.filter(k => !existingKanji.has(k));
  console.log(`${existingKanji.size} kanji déjà en base — ${toProcess.length} à fetcher/enrichir\n`);

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

      if (!result?.found) totalNotFound++;

      const { error } = await supabase
        .from('kanji_item')
        .upsert(row, { onConflict: 'kanji' });

      if (error) throw new Error(error.message);

      const preview = row.meaning?.substring(0, 25) || '— not found —';
      console.log(`OK — "${preview}"`);
      totalSuccess++;

    } catch (err) {
      console.log(`ERROR — ${err.message}`);
      totalError++;
      await sleep(RATE_LIMIT_MS * 2);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Phase 3b terminée');
  console.log(`  ✓ Succès        : ${totalSuccess}`);
  console.log(`  ⚠ Non trouvés   : ${totalNotFound} (row minimale créée quand même)`);
  console.log(`  ✗ Erreurs       : ${totalError}`);
  console.log(`  ℹ Déjà en base  : ${existingKanji.size}`);
  console.log(`  ────────────────`);
  console.log(`  Total traité    : ${existingKanji.size + totalSuccess}`);
  console.log('\nProchaine étape : rejouer link_kanji_vocab.py pour créer les liens manquants.');
  console.log('='.repeat(60));
}

main().catch(console.error);
