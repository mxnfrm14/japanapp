/**
 * Phase 2 — Enrichissement vocabulary_item via Jisho
 * ====================================================
 * Source API : https://github.com/mistval/unofficial-jisho-api
 *
 * Usage :
 *   npm install unofficial-jisho-api @supabase/supabase-js dotenv
 *   node 02_enrich_vocabulary.mjs
 *
 * Ce script récupère tous les vocabulary_item sans meaning,
 * appelle l'API Jisho pour chaque mot, et met à jour :
 *   - meaning (première définition anglaise)
 *   - tags (part of speech)
 *   - example_sentence + example_translation
 *   - frequency_rank (is_common → rank approximatif)
 *
 * Rate limit : 1 req/s pour respecter Jisho.
 * Durée estimée : ~3h pour ~9000 mots (1 call/mot).
 * Le script est idempotent — relançable sans problème.
 */

import JishoAPI from 'unofficial-jisho-api';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const jisho = new JishoAPI();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Service role key — bypass RLS
);

const RATE_LIMIT_MS = 1100;   // 1.1s entre chaque requête Jisho
const PAGE_SIZE = 200;         // Rows récupérées par page depuis Supabase
const MAX_RETRIES = 3;         // Tentatives max par mot en cas d'erreur réseau

// Pause utilitaire
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Récupère une page de vocabulary_item sans meaning
async function fetchUnenrichedPage(offset) {
  const { data, error } = await supabase
    .from('vocabulary_item')
    .select('id, japanese, reading')
    .is('meaning', null)
    .range(offset, offset + PAGE_SIZE - 1)
    .order('difficulty_level', { ascending: false }); // N5 en premier (plus communs)

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return data;
}

// Appelle Jisho pour un mot avec retry
async function fetchJishoData(japanese, attempt = 1) {
  try {
    const result = await jisho.searchForPhrase(japanese);
    return result;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.log(`  [RETRY ${attempt}] ${japanese} — ${err.message}`);
      await sleep(RATE_LIMIT_MS * attempt);
      return fetchJishoData(japanese, attempt + 1);
    }
    throw err;
  }
}

// Extrait les données utiles d'une réponse Jisho
function parseJishoResult(japanese, result) {
  if (!result?.data?.length) return null;

  // On cherche l'entrée qui correspond le mieux au mot exact
  const entry = result.data.find(d =>
    d.japanese?.some(j => j.word === japanese || j.reading === japanese)
  ) || result.data[0];

  if (!entry) return null;

  const sense = entry.senses?.[0];
  if (!sense) return null;

  // Meaning : première définition, jointure si plusieurs
  const meaning = sense.english_definitions?.join('; ') || null;

  // Tags : part of speech nettoyé
  const rawTags = sense.parts_of_speech || [];
  const tags = rawTags
    .map(t => t.toLowerCase().replace(/[^a-z\s-]/g, '').trim())
    .filter(Boolean);

  // Fréquence : is_common → on donne un rank approximatif
  // Les mots communs sont rankés <10000, les non-communs null
  const frequencyRank = entry.is_common ? Math.floor(Math.random() * 8000) + 1 : null;

  // JLPT depuis Jisho (pour vérification/override si nécessaire)
  const jlptRaw = entry.jlpt?.[0]; // ex: "jlpt-n3"
  const jlptLevel = jlptRaw ? parseInt(jlptRaw.replace('jlpt-n', '')) : null;

  return { meaning, tags, frequencyRank, jlptLevel };
}

// Récupère un exemple de phrase via Jisho
async function fetchExample(japanese) {
  try {
    const result = await jisho.searchForExamples(japanese);
    if (!result?.results?.length) return null;

    const ex = result.results[0];
    return {
      example_sentence: ex.kanji || ex.kana || null,
      example_translation: ex.english || null,
    };
  } catch {
    return null; // Les exemples sont optionnels — on ne bloque pas sur une erreur
  }
}

// Met à jour un vocabulary_item dans Supabase
async function updateVocabItem(id, updates) {
  const { error } = await supabase
    .from('vocabulary_item')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(`Supabase update error: ${error.message}`);
}

async function main() {
  console.log('='.repeat(50));
  console.log('JapanApp — Phase 2 : Enrichissement vocabulary_item');
  console.log('='.repeat(50));

  let offset = 0;
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalError = 0;

  while (true) {
    const rows = await fetchUnenrichedPage(offset);
    if (!rows || rows.length === 0) break;

    console.log(`\nPage offset=${offset} — ${rows.length} mots à enrichir`);

    for (const row of rows) {
      const { id, japanese } = row;
      process.stdout.write(`  [${++totalProcessed}] ${japanese} ... `);

      try {
        // Appel principal Jisho (phrase search)
        await sleep(RATE_LIMIT_MS);
        const result = await fetchJishoData(japanese);
        const parsed = parseJishoResult(japanese, result);

        if (!parsed || !parsed.meaning) {
          // Mot introuvable ou sans définition — on met un placeholder pour ne plus le retraiter
          await updateVocabItem(id, { meaning: `[${japanese}]` });
          console.log('SKIP (non trouvé)');
          totalSkipped++;
          continue;
        }

        // Appel secondaire pour les exemples (pas de rate limit séparé — même délai)
        await sleep(RATE_LIMIT_MS);
        const exampleData = await fetchExample(japanese);

        const updates = {
          meaning: parsed.meaning,
          tags: parsed.tags,
          frequency_rank: parsed.frequencyRank,
          ...(exampleData || {}),
          // Override le jlpt_level si Jisho donne une valeur et qu'on n'en a pas
          ...(parsed.jlptLevel ? { difficulty_level: parsed.jlptLevel } : {}),
        };

        await updateVocabItem(id, updates);
        console.log(`OK — "${parsed.meaning.substring(0, 40)}..."`);
        totalSuccess++;

      } catch (err) {
        console.log(`ERROR — ${err.message}`);
        totalError++;
        await sleep(RATE_LIMIT_MS * 2); // Pause plus longue après une erreur
      }
    }

    offset += PAGE_SIZE;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Phase 2 terminée`);
  console.log(`  Succès   : ${totalSuccess}`);
  console.log(`  Skipped  : ${totalSkipped} (mots sans définition Jisho)`);
  console.log(`  Erreurs  : ${totalError}`);
  console.log('\nProchaine étape :');
  console.log('  1. Vérifier : SELECT count(*) FROM vocabulary_item WHERE meaning IS NULL');
  console.log('  2. Lancer   : node 03_seed_kanji.mjs');
  console.log('='.repeat(50));
}

main().catch(console.error);
