"""Age helpers and age-pool segregation constants.

Safety model (see U-AGE in IMPROVEMENTS.md):
- Registration is allowed from ``min_reg_age`` (config, default 16).
- Users are split into age pools at 18: minors (<18) only ever see other minors,
  adults only see adults. Adult<->minor matching is impossible by construction.
- The 18+ *content* mode (erotica / disappearing media) is gated by
  ``adult_mode_min_age`` (config, default 18) AND verification.
"""
from datetime import date


HARD_FLOOR_AGE = 14  # absolute minimum the API will accept at all


def calc_age(birth: date | None) -> int | None:
    if not birth:
        return None
    t = date.today()
    return t.year - birth.year - ((t.month, t.day) < (birth.month, birth.day))


def birthdate_n_years_ago(n: int) -> date:
    t = date.today()
    try:
        return t.replace(year=t.year - n)
    except ValueError:  # Feb 29
        return t.replace(year=t.year - n, day=28)
