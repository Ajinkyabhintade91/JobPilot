"""Seeds companies from seeds/companies_ca.csv:
    name,ats_type,ats_slug,website,hq_city,verified_at,notes
"""
import csv
from pathlib import Path

from ..db import pool


def load_companies(csv_path: str | Path) -> dict:
    inserted = updated = 0
    with open(csv_path, newline="", encoding="utf-8") as f, pool().connection() as conn:
        for row in csv.DictReader(f):
            if not row.get("ats_slug"):
                continue
            cur = conn.execute(
                """
                INSERT INTO companies (name, ats_type, ats_slug, domain, hq_city, notes)
                VALUES (%(name)s, %(ats_type)s, %(ats_slug)s, %(website)s, %(hq_city)s, %(notes)s)
                ON CONFLICT (ats_type, ats_slug) DO UPDATE
                    SET name = EXCLUDED.name, domain = EXCLUDED.domain,
                        hq_city = EXCLUDED.hq_city
                RETURNING (xmax = 0)
                """,
                {k: row.get(k, "") or None for k in
                 ("name", "ats_type", "ats_slug", "website", "hq_city", "notes")},
            )
            if cur.fetchone()[0]:
                inserted += 1
            else:
                updated += 1
    return {"inserted": inserted, "updated": updated}
