"""Fetch vocabulary using the Jisho sources used by the seed pipeline."""

from html.parser import HTMLParser
import logging
import random
import re
from threading import Lock
import time
from typing import Any
from urllib.parse import quote

import httpx
from pydantic import BaseModel, Field


logger = logging.getLogger(__name__)
JISHO_API_URL = "https://jisho.org/api/v1/search/words"
REQUEST_INTERVAL = 1.1
_request_lock = Lock()
_last_request_at = 0.0


class _JapaneseForm(BaseModel):
    word: str | None = None
    reading: str | None = None


class _Sense(BaseModel):
    english_definitions: list[str] = Field(default_factory=list)
    parts_of_speech: list[str] = Field(default_factory=list)


class _Entry(BaseModel):
    japanese: list[_JapaneseForm] = Field(default_factory=list)
    senses: list[_Sense] = Field(default_factory=list)
    jlpt: list[str] = Field(default_factory=list)
    is_common: bool = False


class _Response(BaseModel):
    data: list[_Entry] = Field(default_factory=list)


class _ExampleParser(HTMLParser):
    """Read the first sentence, excluding furigana from its Japanese text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._stack: list[set[str]] = []
        self._sentence_depth: int | None = None
        self._done = False
        self.japanese: list[str] = []
        self.english: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            return
        classes = set((dict(attrs).get("class") or "").split())
        self._stack.append(classes)
        if not self._done and self._sentence_depth is None and "sentence_content" in classes:
            self._sentence_depth = len(self._stack)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        pass

    def handle_endtag(self, tag: str) -> None:
        if self._sentence_depth == len(self._stack):
            self._sentence_depth = None
            self._done = True
        if self._stack:
            self._stack.pop()

    def handle_data(self, data: str) -> None:
        if self._sentence_depth is None or self._done:
            return
        classes = set().union(*self._stack[self._sentence_depth:])
        if "english" in classes or "translation" in classes:
            self.english.append(data)
        elif ("japanese_sentence" in classes or "text" in classes) and "furigana" not in classes:
            self.japanese.append(data.strip())


def _request(client: httpx.Client, url: str, **kwargs: Any) -> httpx.Response:
    """Space requests within each backend process, as in the seed scripts."""
    global _last_request_at
    with _request_lock:
        delay = REQUEST_INTERVAL - (time.monotonic() - _last_request_at)
        if delay > 0:
            time.sleep(delay)
        _last_request_at = time.monotonic()
    response = client.get(url, **kwargs)
    response.raise_for_status()
    return response


def _parse_vocabulary(q: str, entries: list[_Entry]) -> dict[str, Any] | None:
    if not entries:
        return None
    entry = next(
        (entry for entry in entries if any(q in (form.word, form.reading) for form in entry.japanese)),
        entries[0],
    )
    if not entry.japanese or not entry.senses:
        return None
    form = next(
        (form for form in entry.japanese if q in (form.word, form.reading)),
        entry.japanese[0],
    )
    japanese = (form.word or form.reading or "").strip()
    sense = entry.senses[0]
    meaning = "; ".join(definition.strip() for definition in sense.english_definitions if definition.strip())
    if not japanese or not meaning:
        return None
    tags = [re.sub(r"[^a-z\s-]", "", tag.lower()).strip() for tag in sense.parts_of_speech]
    jlpt = next((int(level[-1]) for level in entry.jlpt if re.fullmatch(r"jlpt-n[1-5]", level)), None)
    return {
        "japanese": japanese,
        "reading": form.reading or None,
        "meaning": meaning,
        "tags": [tag for tag in tags if tag],
        "difficulty_level": jlpt,
        # Same approximate common-word ranking as 02_enrich_vocabulary.mjs.
        "frequency_rank": random.randint(1, 8000) if entry.is_common else None,
        "jisho_url": f"https://jisho.org/search/{quote(japanese, safe='')}",
        "example_sentence": None,
        "example_translation": None,
    }


def fetch_jisho_vocabulary(q: str) -> dict[str, Any] | None:
    """Return the closest defined word, or None when Jisho is unavailable/empty."""
    with httpx.Client(
        timeout=httpx.Timeout(5.0, connect=2.0),
        follow_redirects=True,
        headers={"User-Agent": "JapanApp (Jisho vocabulary lookup)"},
    ) as client:
        try:
            response = _request(client, JISHO_API_URL, params={"keyword": q})
            vocabulary = _parse_vocabulary(q, _Response.model_validate(response.json()).data)
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Jisho vocabulary lookup failed (%s)", type(exc).__name__)
            return None

        if vocabulary is None:
            return None

        # Examples are optional, just as in the seed enrichment step.
        try:
            url = f"{vocabulary['jisho_url']}%23sentences"
            response = _request(client, url)
            parser = _ExampleParser()
            parser.feed(response.text)
            vocabulary["example_sentence"] = "".join(parser.japanese).strip() or None
            vocabulary["example_translation"] = "".join(parser.english).strip() or None
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Jisho example lookup failed (%s)", type(exc).__name__)

    return vocabulary
