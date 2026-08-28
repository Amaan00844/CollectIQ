"""
Action logger — writes collection actions to JSONL format.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

OUTPUT_DIR = Path(__file__).parent.parent / "output"


def write_action(action: dict[str, Any], output_file: Path) -> None:
    """Append a single action as a JSON line."""
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(action, ensure_ascii=False) + "\n")


def write_risk_report(report: list[dict], output_file: Path) -> None:
    """Write risk report as a JSON array."""
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


def clear_output(output_file: Path) -> None:
    """Clear an output file before a fresh replay run."""
    if output_file.exists():
        output_file.unlink()
