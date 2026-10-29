import copy
import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("backlog", ROOT / "scripts" / "backlog.py")
BACKLOG = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(BACKLOG)


class BacklogContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = BACKLOG.load_manifest(ROOT / "planning" / "backlog-v0.2.json")

    def test_manifest_has_verified_totals_and_release_gate(self) -> None:
        totals = BACKLOG.validate(self.manifest)
        self.assertEqual(23, len(self.manifest["stories"]))
        self.assertEqual({"P0": 184, "P1": 84}, totals)

    def test_unknown_dependency_is_rejected(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["stories"][0]["dependsOn"] = ["MISSING"]
        with self.assertRaisesRegex(ValueError, "unknown MISSING"):
            BACKLOG.validate(changed)

    def test_dependency_cycle_is_rejected(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["stories"][0]["dependsOn"] = ["B22"]
        with self.assertRaisesRegex(ValueError, "dependency cycle"):
            BACKLOG.validate(changed)

    def test_p1_work_cannot_bypass_supervised_writer_gate(self) -> None:
        changed = copy.deepcopy(self.manifest)
        by_id = {story["id"]: story for story in changed["stories"]}
        by_id["B16"]["dependsOn"] = ["B14"]
        with self.assertRaisesRegex(ValueError, "B15 release gate"):
            BACKLOG.validate(changed)

    def test_generated_backlog_matches_manifest(self) -> None:
        totals = BACKLOG.validate(self.manifest)
        expected = BACKLOG.render_markdown(self.manifest, totals)
        actual = (ROOT / "docs" / "03_IMPLEMENTATION_BACKLOG.md").read_text(encoding="utf-8")
        self.assertEqual(expected, actual)

    def test_generated_issue_payloads_match_manifest(self) -> None:
        expected = BACKLOG.issue_payloads(self.manifest)
        actual = json.loads((ROOT / ".audit" / "issue-payloads-v0.2.json").read_text(encoding="utf-8"))
        self.assertEqual(expected, actual)


if __name__ == "__main__":
    unittest.main()
