// Kana -> Hepburn romaji.
//
// Only *kana* can be transliterated mechanically, so this is used on readings
// (which the backend stores in kana), never on `japanese` or example sentences —
// those contain kanji, whose reading is not derivable from the character alone.
// Any non-kana character is passed through untouched.

const DIGRAPHS = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  しぇ: 'she', ちぇ: 'che', じぇ: 'je',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
}

const MONOGRAPHS = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
  '　': ' ',
}

const KATAKANA_START = 0x30a1
const KATAKANA_END = 0x30f6
const KANA_OFFSET = 0x60

/** Katakana -> hiragana so a single table covers both syllabaries. */
const toHiragana = (text) =>
  Array.from(String(text || ''))
    .map((char) => {
      const code = char.codePointAt(0)
      return code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCodePoint(code - KANA_OFFSET)
        : char
    })
    .join('')

/**
 * Transliterate a kana reading to Hepburn romaji.
 * Returns '' when the input holds no kana at all (e.g. a kanji-only string),
 * so callers can simply skip rendering rather than show garbage.
 */
export function toRomaji(reading) {
  const kana = toHiragana(reading)
  // A kanji has no mechanical reading — half-transliterating would be worse
  // than showing nothing at all.
  if (!kana || /[一-龯㐀-䶿]/.test(kana)) return ''

  let out = ''
  let sawKana = false
  let i = 0

  while (i < kana.length) {
    const pair = kana.slice(i, i + 2)

    if (DIGRAPHS[pair]) {
      out += DIGRAPHS[pair]
      sawKana = true
      i += 2
      continue
    }

    const char = kana[i]

    // Sokuon: geminate the consonant that follows.
    if (char === 'っ') {
      const next = DIGRAPHS[kana.slice(i + 1, i + 3)] || MONOGRAPHS[kana[i + 1]] || ''
      const consonant = next[0]
      // っち -> tchi, per Hepburn.
      if (next.startsWith('ch')) out += 't'
      else if (consonant && !'aeiou'.includes(consonant)) out += consonant
      sawKana = true
      i += 1
      continue
    }

    // Chōonpu: lengthen the previous vowel.
    if (char === 'ー') {
      const previous = out[out.length - 1]
      if (previous && 'aeiou'.includes(previous)) out += previous
      i += 1
      continue
    }

    if (MONOGRAPHS[char]) {
      // ん before a vowel or y needs an apostrophe: きんえん -> kin'en.
      if (char === 'ん') {
        const following = DIGRAPHS[kana.slice(i + 1, i + 3)] || MONOGRAPHS[kana[i + 1]] || ''
        out += 'aeiouy'.includes(following[0]) ? "n'" : 'n'
      } else {
        out += MONOGRAPHS[char]
      }
      sawKana = true
      i += 1
      continue
    }

    out += char
    i += 1
  }

  return sawKana ? out : ''
}
