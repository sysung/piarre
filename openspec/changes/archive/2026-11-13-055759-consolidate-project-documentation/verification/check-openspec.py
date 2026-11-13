"""Exercise local-root, archive, collision and chronology behavior in disposable fixtures."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

cli = os.environ.get('OPENSPEC_BIN') or shutil.which('openspec')
if not cli:
    raise SystemExit('Set OPENSPEC_BIN or install OpenSpec on PATH.')
results = []
with tempfile.TemporaryDirectory(prefix='piarre-openspec-') as temporary:
    root = Path(temporary)
    env = dict(os.environ, XDG_CONFIG_HOME=str(root/'config'), XDG_DATA_HOME=str(root/'data'))
    repo = root/'repo'
    repo.mkdir()
    def run(arguments, cwd=repo, success=True):
        result = subprocess.run([cli, *arguments], cwd=cwd, env=env, capture_output=True, text=True)
        results.append(dict(arguments=arguments, exit=result.returncode, stdout=result.stdout, stderr=result.stderr))
        assert not success or result.returncode == 0, result.stdout + result.stderr
        return result
    run(['init', '--tools', 'none'])
    (repo/'child').mkdir()
    for cwd in [repo, repo/'child']:
        for args in [['context', '--json'], ['list', '--json'], ['doctor', '--json']]:
            result = run(args, cwd)
            if args[0] in ['context', 'list']:
                assert Path(json.loads(result.stdout)['root']['path']).resolve() == repo.resolve()
    spec = repo/'openspec/specs/preservation/spec.md'
    spec.parent.mkdir(parents=True)
    spec.write_text('# Preservation\n\n## Purpose\nPreserve an existing contract.\n\n## Requirements\n\n### Requirement: Original\nThe fixture MUST preserve original bytes.\n\n#### Scenario: preservation\n- **WHEN** history is archived\n- **THEN** this requirement remains unchanged\n')
    original = spec.read_bytes()
    names = ['2026-11-13-010000-first', '2026-11-13-020000-second']
    for name in names:
        run(['new', 'change', name])
        change = repo/'openspec/changes'/name
        (change/'proposal.md').write_text('# Proposal\n\n## Why\nExplore a discarded alternative.\n\n## What Changes\n- Propose an alternate behavior.\n\n## Capabilities\n\n### Modified Capabilities\n- `preservation`: discarded alternative.\n\n## Impact\nNot adopted.\n\n## History\nOutcome: abandoned.\n')
        (change/'tasks.md').write_text('# Tasks\n\n## 1. Experiment\n- [ ] 1.1 Unfinished experiment remains unfinished.\n')
        delta = change/'specs/preservation/spec.md'
        delta.parent.mkdir(parents=True)
        delta.write_text('## ADDED Requirements\n\n### Requirement: Obsolete\nThe fixture MUST adopt an obsolete alternative.\n\n#### Scenario: alternative\n- **WHEN** this proposal applies\n- **THEN** behavior changes\n')
        snapshot = (change/'proposal.md').read_bytes()
        assert run(['new', 'change', name], success=False).returncode != 0
        assert (change/'proposal.md').read_bytes() == snapshot
    for index, name in enumerate(reversed(names)):
        run(['archive', name, '--skip-specs', '--yes', '--json'])
        archived = repo/'openspec/changes/archive'/name
        assert archived.exists() and '- [ ]' in (archived/'tasks.md').read_text()
        assert 'Outcome: abandoned.' in (archived/'proposal.md').read_text()
        assert spec.read_bytes() == original
        with (archived/'proposal.md').open('a') as stream:
            stream.write(f'Simulated lifecycle event order: {index + 1}. This is fixture chronology, not product adoption.\n')
    listed = json.loads(run(['list', '--all', '--sort', 'name', '--json']).stdout)
    assert [change['name'] for change in listed['changes']] == names
print(json.dumps(dict(status='passed', checks=['local root and child context', 'duplicate ID preservation', 'skip-sync obsolete deltas', 'truthful abandoned tasks', 'stable IDs and reverse lifecycle order'], commands=results), indent=2))
