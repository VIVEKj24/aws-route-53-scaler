"""
backend/app/validators/records.py
Per-record-type value validators.

Each validator accepts a single string value and raises ValueError with a
human-readable message on failure.

RECORD_VALIDATORS maps each supported type to its validator function.
validate_record(record_type, values) runs the mapped validator over every
value in the list, and additionally enforces CNAME cardinality (exactly 1).
"""
import ipaddress
import re
from collections.abc import Callable

# ─── Individual validators ────────────────────────────────────────────────────

# Hostname shape: labels separated by dots, each label 1-63 chars (letters,
# digits, hyphens), no leading/trailing hyphen per label.
_HOSTNAME_RE = re.compile(
    r"^(?:[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)*"
    r"[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.?$"
)


def _valid_hostname(value: str) -> bool:
    return bool(_HOSTNAME_RE.match(value)) and len(value) <= 253


def validate_a(value: str) -> None:
    """Value must be a valid IPv4 address."""
    try:
        ipaddress.IPv4Address(value)
    except ValueError:
        raise ValueError(f"'{value}' is not a valid IPv4 address")


def validate_aaaa(value: str) -> None:
    """Value must be a valid IPv6 address."""
    try:
        ipaddress.IPv6Address(value)
    except ValueError:
        raise ValueError(f"'{value}' is not a valid IPv6 address")


def validate_cname(value: str) -> None:
    """Value must be a valid hostname (CNAME target)."""
    if not _valid_hostname(value):
        raise ValueError(f"'{value}' is not a valid hostname for a CNAME record")


def validate_ns(value: str) -> None:
    """Value must be a valid hostname (nameserver)."""
    if not _valid_hostname(value):
        raise ValueError(f"'{value}' is not a valid hostname for an NS record")


def validate_ptr(value: str) -> None:
    """Value must be a valid hostname (PTR target)."""
    if not _valid_hostname(value):
        raise ValueError(f"'{value}' is not a valid hostname for a PTR record")


def validate_txt(value: str) -> None:
    """Value must be a non-empty string."""
    if not value.strip():
        raise ValueError("TXT record value must not be empty")


_MX_RE = re.compile(r"^\d+\s+\S+$")


def validate_mx(value: str) -> None:
    """Value must be '<priority> <hostname>' e.g. '10 mail.example.com'."""
    if not _MX_RE.match(value):
        raise ValueError(
            f"'{value}' is not a valid MX value — expected '<priority> <hostname>' "
            f"e.g. '10 mail.example.com'"
        )


_SRV_RE = re.compile(r"^\d+\s+\d+\s+\d+\s+\S+$")


def validate_srv(value: str) -> None:
    """Value must be '<priority> <weight> <port> <target>'."""
    if not _SRV_RE.match(value):
        raise ValueError(
            f"'{value}' is not a valid SRV value — expected "
            f"'<priority> <weight> <port> <target>'"
        )


_CAA_RE = re.compile(r"^\d+\s+(issue|issuewild|iodef)\s+\S+$")


def validate_caa(value: str) -> None:
    """Value must be '<flags> <tag> <value>' where tag in {issue,issuewild,iodef}."""
    if not _CAA_RE.match(value):
        raise ValueError(
            f"'{value}' is not a valid CAA value — expected "
            f"'<flags> issue|issuewild|iodef <value>'"
        )


# ─── Registry ─────────────────────────────────────────────────────────────────

RECORD_VALIDATORS: dict[str, Callable[[str], None]] = {
    "A":     validate_a,
    "AAAA":  validate_aaaa,
    "CNAME": validate_cname,
    "MX":    validate_mx,
    "NS":    validate_ns,
    "PTR":   validate_ptr,
    "SRV":   validate_srv,
    "TXT":   validate_txt,
    "CAA":   validate_caa,
}

# Types that user-created records may use (SOA is system-only)
USER_ALLOWED_TYPES = frozenset(RECORD_VALIDATORS.keys()) - {"SOA"}


# ─── Composite validator ──────────────────────────────────────────────────────

def validate_record(record_type: str, values: list[str]) -> None:
    """
    Run the per-type validator over every value in *values*.

    Additional rule:
    - CNAME records must have exactly one value.

    Raises ValueError with a human-readable message on the first failure.
    """
    if record_type == "CNAME" and len(values) != 1:
        raise ValueError("CNAME records must have exactly one value")

    validator = RECORD_VALIDATORS.get(record_type)
    if validator is None:
        raise ValueError(f"Unsupported record type '{record_type}'")

    for v in values:
        validator(v)
