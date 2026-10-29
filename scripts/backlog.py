#!/usr/bin/env python3
"""Validate and render the Piarre implementation backlog."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "planning" / "backlog-v0.2.json"


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate(manifest: dict[str, Any]) -> dict[str, int]:
    stories = manifest["stories"]
    ids = [story["id"] for story in stories]
    if len(ids) != len(set(ids)):
        raise ValueError("story IDs must be unique")

    by_id = {story["id"]: story for story in stories}
    milestone_ids = {milestone["id"] for milestone in manifest["milestones"]}
    for story in stories:
        if story["milestone"] not in milestone_ids:
            raise ValueError(f"{story['id']} has an unknown milestone")
        if not story["acceptance"] or not story["evidence"]:
            raise ValueError(f"{story['id']} needs acceptance criteria and evidence")
        for dependency in story["dependsOn"]:
            if dependency not in by_id:
                raise ValueError(f"{story['id']} depends on unknown {dependency}")
            if dependency == story["id"]:
                raise ValueError(f"{story['id']} depends on itself")

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(story_id: str) -> None:
        if story_id in visiting:
            raise ValueError(f"dependency cycle includes {story_id}")
        if story_id in visited:
            return
        visiting.add(story_id)
        for dependency in by_id[story_id]["dependsOn"]:
            visit(dependency)
        visiting.remove(story_id)
        visited.add(story_id)

    for story_id in ids:
        visit(story_id)

    p1_stories = [story for story in stories if story["priority"] == "P1"]
    if any("B15" not in ancestors(story["id"], by_id) for story in p1_stories):
        raise ValueError("every P1 story must transitively depend on the B15 release gate")

    return {
        priority: sum(story["estimateHours"] for story in stories if story["priority"] == priority)
        for priority in ("P0", "P1")
    }


def ancestors(story_id: str, by_id: dict[str, dict[str, Any]]) -> set[str]:
    found: set[str] = set()
    pending = list(by_id[story_id]["dependsOn"])
    while pending:
        current = pending.pop()
        if current in found:
            continue
        found.add(current)
        pending.extend(by_id[current]["dependsOn"])
    return found


def issue_body(manifest: dict[str, Any], story: dict[str, Any]) -> str:
    dependencies = ", ".join(story["dependsOn"]) or "None"
    acceptance = "\n".join(f"- [ ] {item}" for item in story["acceptance"])
    evidence = "\n".join(f"- {item}" for item in story["evidence"])
    return f"""<!-- piarre-backlog:{story['id']}:v{manifest['planVersion']} -->

## Outcome

{story['claim']}

## Acceptance criteria

{acceptance}

## Required evidence

{evidence}

## Planning metadata

- Priority: {story['priority']}
- Milestone: {story['milestone']}
- Size: {story['size']}
- Estimate: {story['estimateHours']} focused engineering hours
- Depends on: {dependencies}
- Status: {manifest['publicationDefaults']['status']}
- Labels: {', '.join(manifest['publicationDefaults']['labels'])}

Estimates are planning inputs, not measured throughput. Re-estimate when current adapter evidence changes the assumptions.
"""


def render_markdown(manifest: dict[str, Any], totals: dict[str, int]) -> str:
    rows = []
    for story in manifest["stories"]:
        dependencies = ", ".join(story["dependsOn"]) or "None"
        rows.append(
            f"| {story['id']} | {story['priority']} | {story['milestone']} | {story['size']} | "
            f"{story['estimateHours']}h | {dependencies} | {story['title']} |"
        )
    milestones = "\n".join(
        f"- **{item['id']} {item['title']}.** {item['exit']}" for item in manifest["milestones"]
    )
    return f"""# Implementation backlog

This document is generated from `planning/backlog-v0.2.json`. Edit the manifest, then run `python3 scripts/backlog.py render`.

## Estimate basis

{manifest['estimateBasis']}

P0 totals **{totals['P0']} hours**. P1 totals **{totals['P1']} hours**. The combined planning sum is **{totals['P0'] + totals['P1']} hours**. These are arithmetic sums, not measured delivery time. Re-estimate after {', '.join(manifest['reestimateAfter'])}.

## Milestones

{milestones}

## Stories

| ID | Priority | Milestone | Size | Estimate | Dependencies | Story |
|---|---|---|---|---:|---|---|
{chr(10).join(rows)}

## Publication contract

Every GitHub issue is generated from the same manifest. Its marker is `piarre-backlog:<ID>:v{manifest['planVersion']}`. The publication verifier must read back issue markers, fields, estimates, and native dependency edges. New B-series items must pass verification before old A-series items are retired.

## Delivery rule

P0 permits one supervised writer. B15 is the release gate. P1 work is invalid unless it transitively depends on B15. P1 introduces a read-only worker before isolated coding writers. No coding workers share a write root.
"""


def issue_payloads(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    defaults = manifest["publicationDefaults"]
    return [
        {
            "id": story["id"],
            "title": f"[{story['id']}] {story['title']}",
            "body": issue_body(manifest, story),
            "labels": defaults["labels"],
            "status": defaults["status"],
            "priority": story["priority"],
            "size": story["size"],
            "estimateHours": story["estimateHours"],
            "dependsOn": story["dependsOn"],
        }
        for story in manifest["stories"]
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("validate", "render", "issues"))
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    manifest = load_manifest(args.manifest)
    totals = validate(manifest)
    if args.command == "validate":
        print(json.dumps({"stories": len(manifest["stories"]), "totals": totals}, sort_keys=True))
        return
    if args.command == "render":
        output = args.output or ROOT / "docs" / "03_IMPLEMENTATION_BACKLOG.md"
        output.write_text(render_markdown(manifest, totals), encoding="utf-8")
        print(output)
        return

    payloads = issue_payloads(manifest)
    serialized = json.dumps(payloads, indent=2) + "\n"
    if args.output:
        args.output.write_text(serialized, encoding="utf-8")
        print(args.output)
        return
    print(serialized, end="")


if __name__ == "__main__":
    main()
