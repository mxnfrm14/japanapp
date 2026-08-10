/**
 * Phase 3c — Complète les jlpt_level manquants de kanji_item via Jisho
 * ====================================================================
 * Source API : https://jisho.org/api/v1/search/words?keyword=<kanji>
 *              (via jisho.searchForPhrase de unofficial-jisho-api)
 *
 * Contexte :
 *   Les kanji ajoutés hors liste JLPT officielle (cf. 03b_seed_missing_kanji.mjs)
 *   ont un jlpt_level null. Ce script parcourt kanji_item, et pour chaque row
 *   dont jlpt_level est null, interroge Jisho et met à jour la row si un
 *   niveau est trouvé.
 *
 * Pourquoi l'API "words" et pas searchForKanji() :
 *   Jisho a retiré la ligne JLPT de ses pages kanji — searchForKanji() renvoie
 *   désormais jlptLevel: undefined pour tout le monde. L'API words, elle,
 *   expose encore des tags jlpt (ex: ["jlpt-n3"]) par entrée de dictionnaire.
 *
 * Heuristique :
 *   On ne garde que les entrées dont le mot est exactement le kanji seul, puis
 *   on retient le niveau le plus FACILE parmi elles (N5 > N4 > ... > N1), car
 *   un kanji est acquis au niveau de son usage le plus élémentaire. C'est le
 *   JLPT du *mot*, pas du kanji : bonne approximation, pas une source
 *   autoritaire (celle-ci reste data/JLPT_kanji_ALL.json, cf. Phase 3).
 *
 * Usage :
 *   node 03c_fill_kanji_jlpt.mjs [--dry-run] [--limit=N]
 *
 * Rate limit : 1 req/s.
 * Idempotent — ne touche que les rows dont jlpt_level est null, et ne les
 * modifie que si Jisho fournit un niveau exploitable.
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
const PAGE_SIZE = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const arg = process.argv.find(a => a.startsWith('--limit='));
  return arg ? parseInt(arg.split('=')[1]) : null;
})();

// Récupère toutes les rows kanji_item avec jlpt_level null (paginé)
async function fetchKanjiWithoutJlpt() {
  console.log('Récupération des kanji sans jlpt_level...');

  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('kanji_item')
      .select('id, kanji')
      .is('jlpt_level', null)
      .order('kanji')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Supabase fetch error: ${error.message}`);

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`${rows.length} kanji sans jlpt_level trouvés\n`);
  return rows;
}

// Appelle l'API words de Jisho avec retry
async function fetchWordsData(kanji, attempt = 1) {
  try {
    return await jisho.searchForPhrase(kanji);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(RATE_LIMIT_MS * attempt);
      return fetchWordsData(kanji, attempt + 1);
    }
    throw err;
  }
}

// Extrait le niveau JLPT le plus facile parmi les entrées "mot == kanji seul"
// Ex: ["jlpt-n3"] + ["jlpt-n1"] -> 3
function extractJlptLevel(kanji, response) {
  const entries = (response?.data || []).filter(entry =>
    (entry.japanese || []).some(w => w.word === kanji)
  );

  const levels = entries
    .flatMap(entry => entry.jlpt || [])
    .map(tag => /n([1-5])/i.exec(tag))
    .filter(Boolean)
    .map(match => parseInt(match[1]));

  return levels.length ? Math.max(...levels) : null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('JapanApp — Phase 3c : Complétion des jlpt_level (Jisho words API)');
  if (DRY_RUN) console.log('MODE DRY-RUN — aucune écriture en base');
  console.log('='.repeat(60));

  let toProcess = await fetchKanjiWithoutJlpt();
  if (LIMIT) {
    toProcess = toProcess.slice(0, LIMIT);
    console.log(`--limit=${LIMIT} → ${toProcess.length} kanji traités\n`);
  }

  let totalUpdated = 0;
  let totalNoLevel = 0;
  let totalError = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const { id, kanji } = toProcess[i];
    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${kanji} ... `);

    await sleep(RATE_LIMIT_MS);

    try {
      const response = await fetchWordsData(kanji);
      const jlptLevel = extractJlptLevel(kanji, response);

      if (jlptLevel === null) {
        console.log('pas de tag JLPT sur Jisho — inchangé');
        totalNoLevel++;
        continue;
      }

      if (!DRY_RUN) {
        const { error } = await supabase
          .from('kanji_item')
          .update({ jlpt_level: jlptLevel })
          .eq('id', id);

        if (error) throw new Error(error.message);
      }

      console.log(`OK — N${jlptLevel}${DRY_RUN ? ' (dry-run)' : ''}`);
      totalUpdated++;

    } catch (err) {
      console.log(`ERROR — ${err.message}`);
      totalError++;
      await sleep(RATE_LIMIT_MS * 2);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Phase 3c terminée');
  console.log(`  ✓ Mis à jour    : ${totalUpdated}${DRY_RUN ? ' (dry-run, non écrit)' : ''}`);
  console.log(`  ⚠ Sans tag JLPT : ${totalNoLevel}`);
  console.log(`  ✗ Erreurs       : ${totalError}`);
  console.log(`  ────────────────`);
  console.log(`  Total examiné   : ${toProcess.length}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
