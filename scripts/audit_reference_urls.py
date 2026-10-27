"""Read-only URL feasibility audit. Run from backend with its virtualenv Python."""

import json
import os
from pathlib import Path
import sys
import unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
os.environ.setdefault("PGCONNECT_TIMEOUT", "10")
os.environ["DEBUG"] = "false"

from psycopg2 import sql


def summarize(values):
    counts = Counter(values)
    duplicates = [(value, count) for value, count in counts.items() if count > 1]
    duplicates.sort(key=lambda pair: (-pair[1], pair[0] or ""))
    strings = [value for value in counts if value is not None]
    issues = {
        "empty_or_whitespace": lambda value: not value.strip(),
        "leading_or_trailing_whitespace": lambda value: value != value.strip(),
        "url_special_characters": lambda value: any(c in value for c in "/?#%\\"),
        "dot_segments": lambda value: value in (".", ".."),
        "control_or_format_characters": lambda value: any(
            unicodedata.category(c) in ("Cc", "Cf") for c in value
        ),
        "reserved_api_names": lambda value: value in ("list", "tags"),
    }
    normalization = {}
    for form in ("NFC", "NFKC"):
        groups = defaultdict(list)
        for value in strings:
            groups[unicodedata.normalize(form, value)].append(value)
        collisions = [variants for variants in groups.values() if len(variants) > 1]
        normalization[form] = {
            "changed_rows": sum(counts[v] for v in strings if unicodedata.normalize(form, v) != v),
            "collision_groups": len(collisions),
            "examples": collisions[:10],
        }
    return {
        "rows": sum(counts.values()),
        "null_rows": counts.get(None, 0),
        "distinct_non_null_values": len(strings),
        "duplicate_groups": len(duplicates),
        "extra_duplicate_rows": sum(count - 1 for _, count in duplicates),
        "duplicate_examples": duplicates[:12],
        "issues": {
            name: {
                "rows": sum(counts[v] for v in strings if predicate(v)),
                "examples": [v for v in strings if predicate(v)][:10],
            }
            for name, predicate in issues.items()
        },
        "normalization": normalization,
    }


def audit_rest():
    import httpx
    from app.config import settings
    from app.services.services import get_supabase_admin_headers

    report = {"access": "Supabase REST, GET requests only", "indexes": "not inspected via REST"}
    with httpx.Client(
        base_url=settings.supabase_url.rstrip("/"),
        headers={**get_supabase_admin_headers(), "Prefer": "count=exact"},
        timeout=30.0,
    ) as client:
        for table, column in (("kanji_item", "kanji"), ("vocabulary_item", "japanese")):
            values = []
            offset = 0
            expected_total = None
            while True:
                response = client.get(
                    f"/rest/v1/{table}",
                    params={"select": f"id,{column}", "order": "id.asc", "limit": 1000, "offset": offset},
                )
                response.raise_for_status()
                total = int(response.headers["content-range"].rsplit("/", 1)[1])
                if expected_total is None:
                    expected_total = total
                if total != expected_total:
                    raise RuntimeError("Catalog size changed during audit; retry")
                rows = response.json()
                values.extend(row[column] for row in rows)
                offset += len(rows)
                if offset >= total:
                    break
                if not rows:
                    raise RuntimeError("Incomplete catalog response")
            if len(values) != expected_total:
                raise RuntimeError("Catalog row count mismatch")
            report[table] = summarize(values)
            print(f"Audited {table}: {len(values)} rows", file=sys.stderr, flush=True)
    return report


def audit_postgres():
    from app.services.db import get_db_cursor

    report = {}
    with get_db_cursor() as cursor:
        cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        cursor.execute("SET LOCAL statement_timeout = '30s'")
        cursor.execute("SHOW transaction_read_only")
        report["transaction_read_only"] = cursor.fetchone()["transaction_read_only"]
        for table, column in (("kanji_item", "kanji"), ("vocabulary_item", "japanese")):
            values = []
            offset = 0
            while True:
                cursor.execute(
                    sql.SQL("SELECT {} AS value FROM public.{} ORDER BY id LIMIT %s OFFSET %s").format(
                        sql.Identifier(column), sql.Identifier(table)
                    ),
                    [1000, offset],
                )
                rows = cursor.fetchall()
                values.extend(row["value"] for row in rows)
                if len(rows) < 1000:
                    break
                offset += 1000
            report[table] = summarize(values)
            cursor.execute(
                "SELECT indexname, indexdef FROM pg_indexes "
                "WHERE schemaname = %s AND tablename = %s ORDER BY indexname",
                ["public", table],
            )
            report[table]["indexes"] = [dict(row) for row in cursor.fetchall()]
    return report


if __name__ == "__main__":
    try:
        report = audit_rest() if "--rest" in sys.argv[1:] else audit_postgres()
        print(json.dumps(report, ensure_ascii=True, indent=2))
    except Exception as error:
        # Connection errors can contain credentials or infrastructure details.
        message = str(error).lower()
        known_causes = {
            "dns_resolution_failed": ("could not translate host name", "could not resolve hostname"),
            "network_unreachable": ("network is unreachable", "no route to host"),
            "connection_timeout": ("timed out", "timeout expired"),
            "connection_refused": ("connection refused", "actively refused"),
            "authentication_failed": ("password authentication failed", "tenant or user not found", "no password supplied"),
            "invalid_connection_string": ("invalid dsn", "invalid connection option"),
            "ssl_error": ("ssl error", "ssl connection", "certificate verify failed"),
        }
        causes = [name for name, patterns in known_causes.items() if any(p in message for p in patterns)]
        print(json.dumps({
            "error_type": type(error).__name__,
            "sqlstate": getattr(error, "pgcode", None),
            "causes": causes or ["unclassified_connection_error"],
        }))
        sys.exit(1)
