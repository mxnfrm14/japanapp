"""Diary correction: builds the correction prompt and validates the AI's reply.

The prompt is lifted from frontend/src/services/diaryCorrection.js — this is product
logic (the "never force ます" rule is the feature), not something that should live in
the browser where it ships to every user and can't be versioned or tested.
"""

import re
from datetime import date
from typing import Any

from pydantic import ValidationError

from app.models.diary import CorrectionResponse
from app.services.ai import generate_json_reply
from app.services.diary import fetch_recent_diary_entries

MAX_TOKENS_CAP = 8000
CONTEXT_ENTRY_COUNT = 3
HISTORY_ENTRY_COUNT = 20
CORRECTION_TIMEOUT_SECONDS = 60.0
MAX_RETRIES = 2

REGISTER_INSTRUCTIONS = {
	"auto": (
		"The writer has NOT chosen a target register. Detect the register they used and correct\n"
		"*within* it. If they wrote plain form, the corrected text must stay plain form. If they\n"
		"wrote です・ます, keep です・ます. Report a register problem ONLY when the entry is\n"
		"internally inconsistent (e.g. 見た in one sentence and 見ました in the next) — and then\n"
		"normalise toward whichever register dominates the entry, not toward politeness."
	),
	"plain": (
		"The writer has chosen plain form (だ体) as their target. Keep the corrected text in plain\n"
		"form throughout. If they slipped into です・ます, convert it back to plain form and add\n"
		"one note explaining the slip."
	),
	"polite": (
		"The writer has chosen です・ます as their target. Keep the corrected text polite\n"
		"throughout. If they slipped into plain form, convert it to です・ます and add one note\n"
		"explaining the slip."
	),
}

# Ported from frontend/src/utils/japaneseStyle.js — keep both in sync.
_SENTENCE_SPLIT = re.compile(r"[。．！？!?\n]+")
_TRAILING_PARTICLES = re.compile(r"[ねよかなわぞぜさっ、,\s]+$")
_POLITE_TAIL = re.compile(r"(です|でした|でしょう|ます|ました|ません|ませんでした|ましょう|ください|でございます)$")
_PLAIN_TAIL = re.compile(r"(だ|だった|である|であった|た|る|う|い|ない|なかった|くない|よう|ろ)$")


def _detect_register(text: str) -> str:
	sentences = [s.strip() for s in _SENTENCE_SPLIT.split(text or "") if s.strip()]

	polite = 0
	plain = 0
	for sentence in sentences:
		tail = _TRAILING_PARTICLES.sub("", sentence)
		if not tail:
			continue
		# Polite is tested first: ました also ends in た.
		if _POLITE_TAIL.search(tail):
			polite += 1
		elif _PLAIN_TAIL.search(tail):
			plain += 1

	total = polite + plain
	if total == 0:
		return "unknown"

	polite_ratio = polite / total
	if polite_ratio >= 0.8:
		return "polite"
	if polite_ratio <= 0.2:
		return "plain"
	return "mixed"


def _summarise_style(entries: list[dict[str, Any]]) -> str:
	"""Dominant register across a set of past entries — the writer's habitual voice."""
	tally = {"plain": 0, "polite": 0, "mixed": 0}
	for entry in entries:
		register = _detect_register(entry.get("text", ""))
		if register in tally:
			tally[register] += 1

	if sum(tally.values()) == 0:
		return "unknown"

	return max(tally, key=lambda key: tally[key])


def _build_system_prompt(style_mode: str, habitual_register: str) -> str:
	habit_line = (
		f"\nAcross their previous entries this writer habitually writes in {habitual_register} form. "
		"Treat that as their voice, not as something to fix."
		if habitual_register and habitual_register != "unknown"
		else ""
	)
	register_instruction = REGISTER_INSTRUCTIONS.get(style_mode, REGISTER_INSTRUCTIONS["auto"])

	return f"""You are a Japanese writing tutor correcting a learner's diary entry (日記).

## The one rule that matters most
Register (politeness level) is the WRITER'S CHOICE, not a mistake.
Plain form (だ体 / である体) is the normal, idiomatic register for a diary. Never rewrite
plain form into です・ます. Never tell the writer they "should" use ます. Never list a
correct plain-form ending as an error.
{register_instruction}{habit_line}

## What to correct
Correct only genuine errors: wrong particles, wrong conjugation or tense, wrong word
choice, unnatural phrasing a native speaker would not write, and kana/kanji mistakes.

## What to leave alone
- Their voice, sentence rhythm, and vocabulary level. Do not "improve" correct Japanese.
- Simple sentences. A beginner writing simply is not making a mistake.
- Personal names, place names, and invented words.
- Anything you are unsure about — say nothing rather than guessing.
If the entry is already correct, return it unchanged with an empty notes array.

## Output
Reply with a single JSON object and nothing else — no prose, no markdown fences.

{{
  "detected_register": "plain" | "polite" | "mixed" | "unknown",
  "register_note": "One short sentence naming the register they used. Neutral, never corrective, unless the entry mixes registers.",
  "corrected": "The full corrected entry. Preserve their line breaks. If nothing is wrong, repeat the entry verbatim.",
  "notes": [
    {{
      "original": "the exact substring from their entry",
      "corrected": "what it should be",
      "kind": "particle" | "conjugation" | "word choice" | "naturalness" | "orthography",
      "explanation": "One or two sentences in English explaining WHY. Name the rule so it transfers to the next entry."
    }}
  ],
  "encouragement": "One specific sentence in English about something they did well. Reference actual content from the entry, not generic praise."
}}

Explanations and encouragement are in English. The corrected text and the note
original/corrected fields stay in Japanese."""


def _build_user_prompt(text: str, context_entries: list[dict[str, Any]]) -> str:
	if context_entries:
		lines = "\n".join(f"[{entry['date']}] {entry['text'][:200]}" for entry in context_entries)
		context = (
			"Previous entries by the same writer, for voice and level reference only — "
			f"do not correct these:\n{lines}\n\n"
		)
	else:
		context = ""

	return f'{context}Today\'s entry to correct:\n"""\n{text}\n"""'


def request_correction(user_id: str, text: str, style_mode: str, entry_date: date | None) -> CorrectionResponse:
	"""Correct one diary entry via a structured, JSON-mode Mistral completion.

	Raises TimeoutError on a request timeout, RuntimeError otherwise (unreachable
	AI service, or its reply failing CorrectionResponse validation after one retry).
	"""
	recent_entries: list[dict[str, Any]] = []
	if entry_date is not None:
		recent_entries = fetch_recent_diary_entries(user_id, entry_date, limit=HISTORY_ENTRY_COUNT)

	habitual_register = _summarise_style(recent_entries)
	system_prompt = _build_system_prompt(style_mode, habitual_register)
	user_prompt = _build_user_prompt(text, recent_entries[:CONTEXT_ENTRY_COUNT])

	messages = [
		{"role": "system", "content": system_prompt},
		{"role": "user", "content": user_prompt},
	]
	max_tokens = min(MAX_TOKENS_CAP, 2000 + len(text) * 6)

	last_error: Exception | None = None
	for _ in range(MAX_RETRIES):
		try:
			raw = generate_json_reply(
				messages=messages,
				temperature=0.2,
				max_tokens=max_tokens,
				timeout=CORRECTION_TIMEOUT_SECONDS,
			)
			return CorrectionResponse.model_validate(raw)
		except TimeoutError:
			raise
		except (RuntimeError, ValidationError) as exc:
			last_error = exc

	raise RuntimeError("AI service returned an invalid correction") from last_error
