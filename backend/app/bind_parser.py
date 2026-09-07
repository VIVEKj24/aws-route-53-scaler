"""
backend/app/bind_parser.py
Line-based BIND zone file parser (Phase 9 bonus).

Parses lines shaped like:
  <name> [<ttl>] [IN] <TYPE> <rdata>
Skips blank lines, comments (;), and $ORIGIN/$TTL directives.
Unsupported types go into a separate skipped list.
Returns a list of dicts:
  {"name": str, "type": str, "ttl": int, "values": list[str]}
"""
from __future__ import annotations

import re
from typing import Any

# Supported user-creatable record types in Route 53 demo
SUPPORTED_TYPES = frozenset({"A", "AAAA", "CNAME", "MX", "NS", "PTR", "SRV", "TXT"})
CLASSES = frozenset({"IN", "CS", "CH", "HS"})


class ParsedZoneList(list):
    """List of parsed record dicts with an attached `skipped` attribute."""

    def __init__(self, records: list[dict[str, Any]], skipped: list[str]):
        super().__init__(records)
        self.skipped: list[str] = skipped


def _strip_comments(line: str) -> str:
    """Strip comments starting with ';' that are outside quoted strings."""
    in_quote = False
    quote_char = ""
    for idx, char in enumerate(line):
        if char in ('"', "'"):
            if not in_quote:
                in_quote = True
                quote_char = char
            elif char == quote_char:
                in_quote = False
        elif char == ";" and not in_quote:
            return line[:idx].strip()
    return line.strip()


def parse_bind_zone(
    text: str,
    default_origin: str = "",
    skipped_list: list[str] | None = None,
) -> ParsedZoneList:
    """
    Parse a BIND format zone file text.

    Returns ParsedZoneList of dicts:
      [{"name": str, "type": str, "ttl": int, "values": list[str]}]
    and populates `records.skipped` (and `skipped_list` if provided).
    """
    default_ttl = 300
    current_origin = default_origin.rstrip(".")
    last_name = current_origin

    skipped: list[str] = []
    # Map (canonical_name, type, ttl) -> {"name": str, "type": str, "ttl": int, "values": list[str]}
    records_map: dict[tuple[str, str, int], dict[str, Any]] = {}

    lines = text.splitlines()

    for line_num, raw_line in enumerate(lines, 1):
        clean = _strip_comments(raw_line)
        if not clean:
            continue

        # Directives
        upper = clean.upper()
        if upper.startswith("$TTL"):
            parts = clean.split()
            if len(parts) >= 2:
                ttl_str = parts[1]
                # Handle suffixes like 1d, 1h, 1m, 300s
                mult = 1
                if ttl_str.lower().endswith("s"):
                    ttl_str = ttl_str[:-1]
                elif ttl_str.lower().endswith("m"):
                    mult = 60
                    ttl_str = ttl_str[:-1]
                elif ttl_str.lower().endswith("h"):
                    mult = 3600
                    ttl_str = ttl_str[:-1]
                elif ttl_str.lower().endswith("d"):
                    mult = 86400
                    ttl_str = ttl_str[:-1]
                try:
                    default_ttl = int(ttl_str) * mult
                except ValueError:
                    skipped.append(f"Line {line_num}: Invalid $TTL directive '{parts[1]}'")
            continue

        if upper.startswith("$ORIGIN"):
            parts = clean.split()
            if len(parts) >= 2:
                current_origin = parts[1].rstrip(".")
                last_name = current_origin
            continue

        # Check leading whitespace (inherited name)
        has_leading_space = raw_line[0] in (" ", "\t")
        tokens = clean.split()
        if not tokens:
            continue

        token_idx = 0
        if has_leading_space:
            name_token = last_name
        else:
            name_token = tokens[0]
            token_idx = 1

        # Resolve name
        if name_token == "@":
            resolved_name = current_origin or default_origin
        elif name_token.endswith("."):
            resolved_name = name_token.rstrip(".")
        else:
            if current_origin:
                resolved_name = f"{name_token}.{current_origin}"
            else:
                resolved_name = name_token

        last_name = resolved_name

        # Parse TTL and Class and Type
        line_ttl = default_ttl
        rec_type: str | None = None

        while token_idx < len(tokens):
            tok = tokens[token_idx]
            tok_upper = tok.upper()

            if tok.isdigit():
                line_ttl = int(tok)
                token_idx += 1
            elif tok_upper in CLASSES:
                token_idx += 1
            else:
                # First non-TTL non-CLASS token is the TYPE
                rec_type = tok_upper
                token_idx += 1
                break

        if rec_type is None:
            skipped.append(f"Line {line_num}: Missing record type in '{clean}'")
            continue

        rdata_tokens = tokens[token_idx:]
        if not rdata_tokens:
            skipped.append(f"Line {line_num}: Missing rdata for {rec_type} record")
            continue

        rdata = " ".join(rdata_tokens)

        # Check if type is supported
        if rec_type not in SUPPORTED_TYPES:
            skipped.append(
                f"Line {line_num}: Unsupported record type '{rec_type}' for '{resolved_name}'"
            )
            continue

        # In Route 53, standard FQDNs in rdata (like MX or CNAME) might or might not have trailing dot
        key = (resolved_name.lower(), rec_type, line_ttl)
        if key not in records_map:
            records_map[key] = {
                "name": resolved_name,
                "type": rec_type,
                "ttl": line_ttl,
                "values": [rdata],
            }
        else:
            if rdata not in records_map[key]["values"]:
                records_map[key]["values"].append(rdata)

    records = list(records_map.values())
    if skipped_list is not None:
        skipped_list.extend(skipped)

    return ParsedZoneList(records, skipped)
