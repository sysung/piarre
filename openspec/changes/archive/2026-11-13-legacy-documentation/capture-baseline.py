from argparse import ArgumentParser
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re
import subprocess

output = Path(__file__).resolve().parent
target = "8a8b7ab38d9cb0d272389ef89a089e5cee9b7832"
planning = "a16447a9dbeac224d1ffc1c793fb1a14ea12576a"
repository = "https://github.com/sysung/piarre.git"
docs = ["README.md", "docs/00_README.md", "docs/01_PRODUCT_PRD.md",
        "docs/02_TECHNICAL_DESIGN.md", "docs/03_USER_DESIGN_PRINCIPLES.md"]
acceptance = ["test/acceptance/catalog.json", "test/acceptance/principles.json",
              "test/acceptance/retrieval-fixture.json"]

def git(*args):
    return subprocess.check_output(["git", "-C", str(code), *args])

def digest(data):
    return sha256(data).hexdigest()

def verify_saved_inventory(code_checkout=None, documentation_root=None):
    manifest = json.loads((output / "source-manifest.json").read_text())
    for entry in manifest["snapshots"]:
        data = (output / entry["snapshot"]).read_bytes()
        assert digest(data) == entry["sha256"] and len(data) == entry["bytes"], entry["snapshot"]

    disposition = (output / "disposition.md").read_text()
    sections = re.findall(r"^## Target (?:root )?`([^`]+)`\n(.*?)(?=^## |\Z)", disposition, re.M | re.S)
    assert {path for path, _ in sections} == set(docs)
    for path, content in sections:
        covered = []
        for start, end in re.findall(r"^\| (\d+)(?:–(\d+))? \|", content, re.M):
            covered.extend(range(int(start), int(end or start) + 1))
        source_lines = (output / "sources" / "target" / path).read_text().splitlines()
        assert len(set(covered)) == len(covered) and max(covered) == len(source_lines), path
        assert all(i in covered for i, line in enumerate(source_lines, 1) if line.strip()), path

    catalog = json.loads((output / "sources" / "target" / acceptance[0]).read_text())
    scenarios = catalog["scenarios"]
    coverage = (output / "catalog-coverage.md").read_text()
    mapped = re.findall(r"^\| ([a-z][a-z-]+) \| (C\d{2}) \| (Automated|Pending) \|", coverage, re.M)
    assert mapped == [(s["id"], s["owner"], s["verification"]["kind"].capitalize()) for s in scenarios]
    print(f"Verified {len(manifest['snapshots'])} snapshot hashes, disposition coverage, and {len(scenarios)} catalog rows")

    if code_checkout:
        for entry in manifest["historicalPrincipleSources"] + manifest["historicalRetrievalSources"]:
            ref = f"{entry['sourceRevision']}:{entry['path']}"
            object_id = subprocess.check_output(["git", "-C", str(code_checkout), "rev-parse", "--verify", ref])
            data = subprocess.check_output(["git", "-C", str(code_checkout), "cat-file", "blob", ref])
            assert object_id.decode().strip() == entry["gitBlob"] and digest(data) == entry["sha256"], ref
        for path in acceptance[1:]:
            assert (code_checkout / path).read_bytes() == (output / "sources" / "target" / path).read_bytes(), path
        print("Verified 12 historical Git source objects and byte-identical historical inventories")

    if documentation_root:
        baseline = (documentation_root / "openspec/specs/imported-acceptance-baseline/spec.md").read_text()
        pending = (documentation_root / "openspec/changes/2026-11-13-061200-retained-delivery-scope/design.md").read_text()
        for scenario in scenarios:
            identifier, owner, requirement, verification = (
                scenario[key] for key in ("id", "owner", "requirement", "verification"))
            if verification["kind"] == "automated":
                section = re.search(rf"^### Requirement: {identifier}\n(.*?)(?=^### Requirement: |\Z)", baseline, re.M | re.S)
                assert section and f"#### Scenario: {identifier} verification" in section[1], identifier
                assert re.findall(r"^- (?!\*\*)(.*)$", section[1], re.M) == verification["tests"], identifier
            else:
                section = re.search(rf"^## {identifier}\n(.*?)(?=^## |\Z)", pending, re.M | re.S)
                assert section and f"Status: pending. Verification: {verification['criterion']}" in section[1], identifier
            assert f"\n{requirement}\n" in section[1] and f"\nOwner: {owner}\n" in section[1], identifier
        print("Verified all local catalog requirements, owners, and verification text against the target snapshot")

arguments = ArgumentParser(description="Verify preserved inventory or capture it from the original migration inputs.")
arguments.add_argument("--code", type=Path, help="Piarre code checkout containing the source Git history")
arguments.add_argument("--documentation-root", type=Path, help="Piarre checkout to compare with the catalog")
arguments.add_argument("--capture", type=Path, metavar="ORIGINAL_INPUT_DIR",
                       help="Write snapshots beside this script from --code, original-README.md, and original-docs")
args = arguments.parse_args()
if args.capture is None:
    verify_saved_inventory(args.code, args.documentation_root)
    raise SystemExit
if args.code is None:
    arguments.error("--capture requires --code")
root = args.capture.resolve()
code = args.code.resolve()

def read_blob(revision, path):
    ref = f"{revision}:{path}"
    return git("rev-parse", "--verify", ref).decode().strip(), git("cat-file", "blob", ref)

def record_snapshot(source, path, data, revision=None, blob=None):
    snapshot = Path("sources") / source / path
    destination = output / snapshot
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    assert digest(destination.read_bytes()) == digest(data)
    return {"source": source, "path": path, "sourceRevision": revision,
            "gitBlob": blob, "sha256": digest(data), "bytes": len(data),
            "snapshot": snapshot.as_posix()}

snapshots = []
for kind, revision, paths in [("target", target, docs + acceptance),
                              ("planning-head", planning, docs)]:
    for path in paths:
        blob, data = read_blob(revision, path)
        snapshots.append(record_snapshot(kind, path, data, revision, blob))

dirty_docs = root / "original-docs"
dirty_files = {"README.md": root / "original-README.md"}
dirty_files.update({
    "docs/" + p.relative_to(dirty_docs).as_posix(): p
    for p in dirty_docs.rglob("*") if p.is_file()
})
for path, original in sorted(dirty_files.items()):
    snapshots.append(record_snapshot("planning-working", path, original.read_bytes(), planning))

specs = {}
spec_root = code / "openspec" / "specs"
for spec in sorted(spec_root.glob("*/spec.md")):
    path = spec.relative_to(code).as_posix()
    data = spec.read_bytes()
    snapshots.append(record_snapshot("planning-draft", path, data))
    requirements = {}
    for line in data.decode().splitlines():
        if line.startswith("### Requirement: "):
            requirement = line.removeprefix("### Requirement: ")
            requirements[requirement] = []
        if line.startswith("#### Scenario: "):
            requirements[requirement].append(line.removeprefix("#### Scenario: "))
    specs[path] = requirements

source_records = {}
for path in acceptance:
    blob, data = read_blob(target, path)
    source_records[path] = json.loads(data)
catalog, principles, retrieval = (source_records[path] for path in acceptance)
catalog_kinds = Counter(scenario["verification"]["kind"] for scenario in catalog["scenarios"])
assert len(catalog["scenarios"]) == len({s["id"] for s in catalog["scenarios"]}) == 21
assert catalog_kinds == {"automated": 4, "pending": 17}
_, planning_catalog = read_blob(planning, acceptance[0])
assert json.loads(planning_catalog) == catalog
assert len(specs) == 7 and sum(len(r) for r in specs.values()) == 17

principle_sources = defaultdict(list)
for entry in principles["principles"]:
    source = entry["source"]
    if source["kind"] == "product":
        principle_sources[source["revision"], source["path"], source["sha256"]].append(entry["id"])

def verify_source(revision, path, expected=None):
    blob, data = read_blob(revision, path)
    computed = digest(data)
    assert expected is None or expected == computed
    return {"sourceRevision": revision, "path": path, "gitBlob": blob,
            "sha256": computed, "recordedSha256": expected, "bytes": len(data)}

historical_principles = [
    {**verify_source(revision, path, expected), "principles": ids}
    for (revision, path, expected), ids in sorted(principle_sources.items())
]
historical_retrieval = [verify_source(retrieval["revision"], path) for path in retrieval["paths"]]
assert len(historical_principles) == 2 and sum(len(p["principles"]) for p in historical_principles) == 11
assert len(historical_retrieval) == 10 and len(set(retrieval["paths"])) == 10
for path in acceptance[1:]:
    _, baseline_data = read_blob(target, path)
    assert (code / path).read_bytes() == baseline_data
    _, planning_data = read_blob(planning, path)
    assert planning_data == baseline_data

manifest = {"sourceRepository": repository, "targetCodeRevision": target,
            "planningCodeRevision": planning, "catalogVerificationKinds": dict(catalog_kinds),
            "draftSpecs": specs, "snapshots": snapshots,
            "historicalPrincipleSources": historical_principles,
            "historicalRetrievalSources": historical_retrieval}
(output / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Verified {len(snapshots)} snapshots, 7 draft specs, 17 requirements and 21 catalog scenarios")
print("Verified 11 product-principle entries over two Git blobs and 10 pinned retrieval inputs")
