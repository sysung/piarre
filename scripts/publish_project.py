#!/usr/bin/env python3
"""Publish, verify, and retire Piarre GitHub Project plans."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from pathlib import Path
from typing import Any

import backlog

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "planning" / "backlog-v0.2.json"
AUDIT = ROOT / ".audit"
OWNER = "sysung"
REPO = "piarre"


def gh(*args: str, json_output: bool = False) -> Any:
    result = subprocess.run(
        ["gh", *args], check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if json_output:
        return json.loads(result.stdout)
    return result.stdout.strip()


def project_items() -> dict[str, Any]:
    return gh("project", "item-list", "8", "--owner", "@me", "--limit", "100", "--format", "json", json_output=True)


def project_fields() -> dict[str, Any]:
    return gh("project", "field-list", "8", "--owner", "@me", "--format", "json", json_output=True)


def save(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def snapshot() -> None:
    value = {"project": gh("project", "view", "8", "--owner", "@me", "--format", "json", json_output=True), "fields": project_fields(), "items": project_items()}
    save(AUDIT / "project8-before-v0.2.json", value)
    print(f"snapshot {value['items']['totalCount']} items")


def existing_issues() -> dict[str, dict[str, Any]]:
    issues = gh("api", "--paginate", f"repos/{OWNER}/{REPO}/issues?state=all&per_page=100", json_output=True)
    found: dict[str, dict[str, Any]] = {}
    for issue in issues:
        if "pull_request" in issue:
            continue
        match = re.search(r"<!-- piarre-backlog:(B\d{2}):v0\.2 -->", issue.get("body") or "")
        if match:
            found[match.group(1)] = issue
    return found


def field_schema() -> tuple[str, dict[str, dict[str, Any]]]:
    project = gh("project", "view", "8", "--owner", "@me", "--format", "json", json_output=True)
    fields = {field["name"]: field for field in project_fields()["fields"]}
    return project["id"], fields


def set_field(project_id: str, item_id: str, field: dict[str, Any], value: Any) -> None:
    command = ["project", "item-edit", "--id", item_id, "--project-id", project_id, "--field-id", field["id"]]
    if field["type"] == "ProjectV2SingleSelectField":
        option_id = next(option["id"] for option in field["options"] if option["name"] == value)
        command.extend(["--single-select-option-id", option_id])
    else:
        command.extend(["--number", str(value)])
    gh(*command)


def publish() -> None:
    manifest = backlog.load_manifest(MANIFEST_PATH)
    backlog.validate(manifest)
    defaults = manifest["publicationDefaults"]
    gh("label", "create", defaults["labels"][0], "--repo", f"{OWNER}/{REPO}", "--color", "8250DF", "--description", "Piarre v0.2 implementation plan", "--force")
    issues = existing_issues()
    for payload in backlog.issue_payloads(manifest):
        if payload["id"] in issues:
            issue = issues[payload["id"]]
            gh("issue", "edit", str(issue["number"]), "--repo", f"{OWNER}/{REPO}", "--title", payload["title"], "--body", payload["body"], "--add-label", defaults["labels"][0])
        else:
            url = gh("issue", "create", "--repo", f"{OWNER}/{REPO}", "--title", payload["title"], "--body", payload["body"], "--label", defaults["labels"][0])
            number = int(url.rsplit("/", 1)[1])
            issue = gh("api", f"repos/{OWNER}/{REPO}/issues/{number}", json_output=True)
            issues[payload["id"]] = issue
        time.sleep(0.2)

    project_id, fields = field_schema()
    items = project_items()["items"]
    item_by_url = {item["content"]["url"]: item for item in items if item.get("content", {}).get("url")}
    for story in manifest["stories"]:
        issue = issues[story["id"]]
        item = item_by_url.get(issue["html_url"])
        if item is None:
            item = gh("project", "item-add", "8", "--owner", "@me", "--url", issue["html_url"], "--format", "json", json_output=True)
        set_field(project_id, item["id"], fields["Status"], defaults["status"])
        set_field(project_id, item["id"], fields["Priority"], story["priority"])
        set_field(project_id, item["id"], fields["Size"], story["size"])
        set_field(project_id, item["id"], fields["Estimate"], story["estimateHours"])

    for story in manifest["stories"]:
        blocked = issues[story["id"]]
        current = gh("api", "-H", "X-GitHub-Api-Version: 2026-03-10", f"repos/{OWNER}/{REPO}/issues/{blocked['number']}/dependencies/blocked_by", json_output=True)
        current_ids = {issue["id"] for issue in current}
        for dependency in story["dependsOn"]:
            blocker = issues[dependency]
            if blocker["id"] not in current_ids:
                gh("api", "--method", "POST", "-H", "X-GitHub-Api-Version: 2026-03-10", f"repos/{OWNER}/{REPO}/issues/{blocked['number']}/dependencies/blocked_by", "-F", f"issue_id={blocker['id']}")
                time.sleep(0.2)
    print(f"published {len(issues)} B-series issues")


def verify() -> None:
    manifest = backlog.load_manifest(MANIFEST_PATH)
    totals = backlog.validate(manifest)
    issues = existing_issues()
    items = project_items()["items"]
    item_by_url = {item["content"]["url"]: item for item in items if item.get("content", {}).get("url")}
    failures: list[str] = []
    edges = 0
    for story in manifest["stories"]:
        issue = issues.get(story["id"])
        if not issue:
            failures.append(f"missing issue {story['id']}")
            continue
        item = item_by_url.get(issue["html_url"])
        if not item:
            failures.append(f"missing project item {story['id']}")
            continue
        expected = {"status": "Backlog", "priority": story["priority"], "size": story["size"], "estimate": story["estimateHours"]}
        for key, value in expected.items():
            if item.get(key) != value:
                failures.append(f"{story['id']} {key}: {item.get(key)!r} != {value!r}")
        current = gh("api", "-H", "X-GitHub-Api-Version: 2026-03-10", f"repos/{OWNER}/{REPO}/issues/{issue['number']}/dependencies/blocked_by", json_output=True)
        actual = {dependency["number"] for dependency in current}
        wanted = {issues[dependency]["number"] for dependency in story["dependsOn"]}
        if actual != wanted:
            failures.append(f"{story['id']} dependencies: {sorted(actual)} != {sorted(wanted)}")
        edges += len(actual)
    report = {"stories": len(issues), "edges": edges, "totals": totals, "failures": failures, "issues": {key: value["html_url"] for key, value in sorted(issues.items())}}
    save(AUDIT / "project8-verification-v0.2.json", report)
    if failures:
        raise SystemExit("\n".join(failures))
    print(json.dumps({"stories": len(issues), "edges": edges, "totals": totals}, sort_keys=True))


def retire() -> None:
    items = project_items()["items"]
    legacy = [item for item in items if re.fullmatch(r"\[A(0\d|1[0-7])\].*", item.get("title", ""))]
    if len(legacy) != 18:
        raise SystemExit(f"expected 18 legacy items, found {len(legacy)}")
    for item in legacy:
        number = item["content"]["number"]
        gh("project", "item-delete", "8", "--owner", "@me", "--id", item["id"])
        gh("issue", "close", str(number), "--repo", f"{OWNER}/{REPO}", "--reason", "not planned", "--comment", "Superseded by the verified Piarre v0.2 B-series plan in Project 8. Historical context remains available in this issue.")
        time.sleep(0.2)
    print("retired 18 A-series items")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("snapshot", "publish", "verify", "retire"))
    args = parser.parse_args()
    {"snapshot": snapshot, "publish": publish, "verify": verify, "retire": retire}[args.command]()


if __name__ == "__main__":
    main()
