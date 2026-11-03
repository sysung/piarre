import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('publication', Path(__file__).with_name('scoped-publication.py'))
publication = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication)

class Crash(BaseException): pass

class PublicationTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.base = Path(os.path.realpath(self.directory.name))
        self.root = self.base / 'source'
        self.control = self.base / 'control'
        self.root.mkdir(mode=0o700); self.control.mkdir(mode=0o700)
        self.file = self.root / 'file'
        self.file.write_text('\ufeffbefore\r\n', newline='') if hasattr(Path, 'is_junction') else self.file.write_bytes('\ufeffbefore\r\n'.encode())
        self.file.chmod(0o755)
    def tearDown(self): self.directory.cleanup()
    def request(self, before='\ufeffbefore\r\n', after='\ufeffafter\r\n', relative='file', key='a'):
        fd, _, parents = publication.chain(str(self.root), relative)
        os.close(fd)
        return {'root': str(self.root), 'control': str(self.control), 'key': key * 64, 'parents': parents, 'change': {'relativePath': relative, 'before': before, 'after': after, 'beforeMode': None if before is None else 0o755, 'afterMode': None if after is None else 0o755}}
    def test_replace_preserves_actual_open_inode_and_exact_bytes_mode(self):
        with self.file.open('r+b') as writer:
            old = os.fstat(writer.fileno()).st_ino
            result = publication.publish(self.request())
            writer.seek(0); writer.write(b'later FD work'); writer.truncate(); writer.flush(); os.fsync(writer.fileno())
            saved = Path(result['escrow']) / 'displaced'
            self.assertEqual(saved.stat().st_ino, old)
            self.assertEqual(saved.read_bytes(), b'later FD work')
            self.assertEqual(self.file.read_bytes(), '\ufeffafter\r\n'.encode())
            self.assertEqual(self.file.stat().st_mode & 0o777, 0o755)
    def test_create_and_delete(self):
        self.file.unlink()
        publication.publish(self.request(before=None))
        self.assertEqual(self.file.read_bytes(), '\ufeffafter\r\n'.encode())
        result = publication.publish(self.request(before='\ufeffafter\r\n', after=None, key='b'))
        self.assertFalse(self.file.exists())
        self.assertEqual((Path(result['escrow']) / 'displaced').read_bytes(), '\ufeffafter\r\n'.encode())
    def test_restart_every_durable_phase(self):
        phases = ['intent', 'prepared', 'before-displacement', 'displaced', 'displacement-receipt', 'before-publication', 'published', 'complete']
        for index, phase in enumerate(phases):
            with self.subTest(phase=phase):
                req = self.request(key=format(index, 'x'))
                def crash(current):
                    if current == phase: raise Crash()
                with self.assertRaises(Crash): publication.publish(req, crash)
                # Fresh process reads only durable intent/receipts, no in-memory identities.
                result = subprocess.run(['/usr/bin/python3', '-I', str(Path(__file__).with_name('scoped-publication.py'))], input=json.dumps(req), text=True, capture_output=True, check=True)
                self.assertEqual(json.loads(result.stdout)['kind'], 'complete', result.stdout)
                self.assertEqual(self.file.read_bytes(), '\ufeffafter\r\n'.encode())
                self.file.unlink(); self.file.write_bytes('\ufeffbefore\r\n'.encode()); self.file.chmod(0o755)
    def test_actual_racing_entry_is_preserved_without_publication(self):
        def race(phase):
            if phase == 'before-displacement':
                self.file.rename(self.root / 'external-original')
                self.file.write_text('manual racing entry'); self.file.chmod(0o755)
        with self.assertRaisesRegex(ValueError, 'Actual displaced'): publication.publish(self.request(), race)
        self.assertFalse(self.file.exists())
        self.assertEqual((self.control / ('escrow-' + 'a'*64) / 'displaced').read_text(), 'manual racing entry')
    def test_escrow_reoccupied_is_never_clobbered(self):
        def race(phase):
            if phase == 'before-displacement':
                (self.control / ('escrow-' + 'a'*64) / 'displaced').write_text('existing preserved entry')
        with self.assertRaises(FileExistsError): publication.publish(self.request(), race)
        self.assertEqual(self.file.read_bytes(), '\ufeffbefore\r\n'.encode())
        self.assertEqual((self.control / ('escrow-' + 'a'*64) / 'displaced').read_text(), 'existing preserved entry')

    def test_destination_reoccupied_is_never_clobbered(self):
        def race(phase):
            if phase == 'before-publication': self.file.write_text('new untracked work')
        with self.assertRaises(FileExistsError): publication.publish(self.request(), race)
        self.assertEqual(self.file.read_text(), 'new untracked work')
    def test_parent_relocation_before_and_after_displacement(self):
        for index, phase in enumerate(['before-displacement', 'displaced', 'before-publication', 'published', 'complete']):
            with self.subTest(phase=phase):
                req = self.request(key=format(index, 'x'))
                moved = self.base / ('moved-' + str(index))
                def relocate(current):
                    if current == phase:
                        self.root.rename(moved); self.root.mkdir(); self.file.write_text('replacement-parent-work')
                with self.assertRaises(ValueError): publication.publish(req, relocate)
                self.assertEqual(self.file.read_text(), 'replacement-parent-work')
                escrow = self.control / ('escrow-' + format(index, 'x')*64)
                self.assertEqual((escrow / 'displaced').read_bytes(), '\ufeffbefore\r\n'.encode())
                with self.assertRaises(ValueError): publication.publish(req)
                self.assertEqual(self.file.read_text(), 'replacement-parent-work')
                self.file.unlink(); self.root.rmdir(); moved.rename(self.root)
                self.file.unlink(missing_ok=True); self.file.write_bytes('\ufeffbefore\r\n'.encode()); self.file.chmod(0o755)
    def test_relocated_parent_before_helper_opens_is_blocked_by_reviewed_identity(self):
        req = self.request(); self.root.rename(self.base / 'moved'); self.root.mkdir(); self.file.write_bytes('\ufeffbefore\r\n'.encode()); self.file.chmod(0o755)
        with self.assertRaisesRegex(ValueError, 'Reviewed root'): publication.publish(req)
        self.assertEqual(self.file.read_bytes(), '\ufeffbefore\r\n'.encode())
    def test_missing_root_does_not_hide_preserved_inode_after_restart(self):
        with self.file.open('r+b') as writer:
            req = self.request()
            def crash(phase):
                if phase == 'displaced': self.root.rename(self.base / 'moved'); raise Crash()
            with self.assertRaises(Crash): publication.publish(req, crash)
            writer.seek(0); writer.write(b'newer'); writer.truncate(); writer.flush()
            intent = json.loads((self.control / ('escrow-'+'a'*64) / 'intent.json').read_text())
            self.assertEqual(intent['control'], str(self.control))
            self.assertEqual((self.control / ('escrow-'+'a'*64) / 'displaced').read_bytes(), b'newer')
            with self.assertRaises(FileNotFoundError): publication.publish(req)
    def test_completed_operation_never_rewrites_later_edits(self):
        req = self.request(); publication.publish(req); self.file.write_text('new work')
        with self.assertRaisesRegex(ValueError, 'no replay'): publication.publish(req)
        self.assertEqual(self.file.read_text(), 'new work')
    def test_acl_and_xattr_rejected_without_displacement(self):
        if os.uname().sysname != 'Darwin': self.skipTest('macOS metadata')
        subprocess.run(['/usr/bin/xattr', '-w', 'user.piarre-test', 'metadata', str(self.file)], check=True)
        with self.assertRaisesRegex(ValueError, 'metadata'): publication.publish(self.request())
        self.assertTrue(self.file.exists())
        subprocess.run(['/usr/bin/xattr', '-d', 'user.piarre-test', str(self.file)], check=True)
        subprocess.run(['/bin/chmod', '+a', 'everyone allow read', str(self.file)], check=True)
        with self.assertRaisesRegex(ValueError, 'ACL'): publication.publish(self.request(key='b'))
        self.assertTrue(self.file.exists())

    def test_full_storage_after_displacement_retains_actual_inode_and_can_resume(self):
        req = self.request()
        original = publication.record
        def full(fd, name, value):
            if name == 'receipt.json': raise OSError(28, 'No space left on device')
            return original(fd, name, value)
        publication.record = full
        try:
            with self.assertRaises(OSError): publication.publish(req)
        finally:
            publication.record = original
        self.assertFalse(self.file.exists())
        self.assertEqual((self.control / ('escrow-'+'a'*64) / 'displaced').read_bytes(), '\ufeffbefore\r\n'.encode())
        self.assertEqual(publication.publish(req)['kind'], 'complete')


if __name__ == '__main__': unittest.main(verbosity=2)
