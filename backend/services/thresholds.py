"""Safe ranges for the readings of a batch, chosen by its crop type.

The ranges are approximate fruiting-stage values from common growing guides, meant as sensible
starting points rather than agronomic advice: a grower's own substrate, strain and room will
shift them. They are kept in code, in one table, so they are easy to review and to test; a batch
whose crop is not recognised gets the default (oyster) ranges, and says so.
"""

from typing import Dict, Tuple

Thresholds = Dict[str, Dict[str, float]]

# The ranges the application used before they depended on the crop. Still the fallback.
DEFAULT_THRESHOLDS: Thresholds = {
    "temperature": {"min": 20.0, "max": 25.0},
    "humidity": {"min": 85.0, "max": 95.0},
    "ph_level": {"min": 6.0, "max": 7.5},
    "moisture": {"min": 75.0, "max": 90.0},
}

SHIITAKE: Thresholds = {
    "temperature": {"min": 12.0, "max": 18.0},
    "humidity": {"min": 80.0, "max": 90.0},
    "ph_level": {"min": 5.5, "max": 6.5},
    "moisture": {"min": 55.0, "max": 65.0},
}

LIONS_MANE: Thresholds = {
    "temperature": {"min": 15.0, "max": 20.0},
    "humidity": {"min": 85.0, "max": 95.0},
    "ph_level": {"min": 5.5, "max": 6.5},
    "moisture": {"min": 60.0, "max": 70.0},
}

# (words to look for in the crop type, preset name, ranges). First match wins.
_PRESETS: Tuple[Tuple[Tuple[str, ...], str, Thresholds], ...] = (
    (("shiitake",), "shiitake", SHIITAKE),
    (("lion", "melena", "hericium"), "lion's mane", LIONS_MANE),
    (("oyster", "ostra", "pleurotus"), "oyster", DEFAULT_THRESHOLDS),
)


def thresholds_for(crop_type: str | None) -> Thresholds:
    """The safe ranges for a crop type."""
    return preset_for(crop_type)[1]


def preset_for(crop_type: str | None) -> Tuple[str, Thresholds]:
    """(name of the preset used, its ranges). Unknown crops fall back to the oyster ranges."""
    text = (crop_type or "").lower()
    for words, name, ranges in _PRESETS:
        if any(word in text for word in words):
            return name, ranges
    return "default (oyster)", DEFAULT_THRESHOLDS
