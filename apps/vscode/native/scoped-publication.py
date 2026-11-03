"""Bounded Unix text publication. Escrow keeps the displaced inode, never a copy.

The caller owns a stable, private control directory outside the movable trees.
Each operation has durable intent before rename; this is preservation, not CAS.
"""
import json
import os
import stat
import secrets
import sys

LIMIT = 256000
DIR = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def identity(fd):
    value = os.fstat(fd)
    return [value.st_dev, value.st_ino]


def open_directory(absolute):
    if not isinstance(absolute, str) or not absolute.startswith('/') or any(p in ('', '.', '..') for p in absolute.split('/')[1:]):
        raise ValueError('Invalid absolute directory')
    fd = os.open('/', DIR)
    try:
        for part in absolute.split('/')[1:]:
            child = os.open(part, DIR, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def chain(root, relative, create=False, expected=None):
    parts = relative.split('/')
    if not relative or '\\' in relative or '\x00' in relative or any(p in ('', '.', '..', '.git', '.piarre') for p in parts):
        raise ValueError('Invalid scoped path')
    fd = open_directory(root)
    identities = [identity(fd)]
    try:
        if expected is not None and (len(expected) != len(parts) or expected[0] != identities[0]):
            raise ValueError('Reviewed root identity changed')
        for index, part in enumerate(parts[:-1]):
            if create and expected is not None and expected[index + 1] is None:
                try:
                    os.mkdir(part, 0o700, dir_fd=fd)
                    os.fsync(fd)
                except FileExistsError:
                    raise ValueError('Previously absent parent appeared; review required')
            child = os.open(part, DIR, dir_fd=fd)
            os.close(fd)
            fd = child
            identities.append(identity(fd))
            if expected is not None and expected[index + 1] is not None and expected[index + 1] != identities[-1]:
                raise ValueError('Reviewed parent identity changed')
        return fd, parts[-1], identities
    except BaseException:
        os.close(fd)
        raise


def image(fd, name, allow_links=False):
    try:
        entry = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
    except FileNotFoundError:
        return {'content': None, 'mode': None}, None
    try:
        before = os.fstat(entry)
        if not stat.S_ISREG(before.st_mode) or (before.st_nlink != 1 and not allow_links) or before.st_size > LIMIT or before.st_mode & 0o7000:
            raise ValueError('Unsupported bounded ordinary file or hard link')
        if getattr(before, 'st_flags', 0) or (sys.platform != 'darwin' and os.listxattr(entry)):
            raise ValueError('Extended attributes, ACLs, or file flags are unsupported; original entry retained')
        # macOS extended ACLs are not listed by listxattr. Query them explicitly.
        if sys.platform == 'darwin':
            import ctypes
            libc = ctypes.CDLL(None, use_errno=True)
            libc.flistxattr.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int]
            libc.flistxattr.restype = ctypes.c_ssize_t
            length = libc.flistxattr(entry, None, 0, 0)
            if length < 0 or length > 4096:
                raise ValueError('Cannot inspect extended metadata')
            names = ctypes.create_string_buffer(max(1, length))
            if libc.flistxattr(entry, names, length, 0) != length or any(name != b'com.apple.provenance' for name in names.raw[:length].split(b'\0') if name):
                raise ValueError('Extended metadata other than macOS provenance unsupported; original entry retained')
            libc.acl_get_fd_np.argtypes = [ctypes.c_int, ctypes.c_int]
            libc.acl_get_fd_np.restype = ctypes.c_void_p
            acl = libc.acl_get_fd_np(entry, 0x100)
            if not acl and ctypes.get_errno() != 2:
                raise OSError(ctypes.get_errno(), 'Cannot inspect ACL')
            if acl:
                try:
                    item = ctypes.c_void_p()
                    libc.acl_get_entry.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.POINTER(ctypes.c_void_p)]
                    result = libc.acl_get_entry(acl, 0, ctypes.byref(item))
                    if result == 0:
                        raise ValueError('Extended ACLs are unsupported; original entry retained')
                    if ctypes.get_errno() != 22:
                        raise OSError(ctypes.get_errno(), 'Cannot inspect ACL entries')
                finally:
                    libc.acl_free.argtypes = [ctypes.c_void_p]
                    libc.acl_free(acl)
        data = os.read(entry, LIMIT + 1)
        after = os.fstat(entry)
        current = os.stat(name, dir_fd=fd, follow_symlinks=False)
        if len(data) > LIMIT or (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns, before.st_mode) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns, after.st_mode) or (current.st_dev, current.st_ino) != (before.st_dev, before.st_ino):
            raise ValueError('File changed while inspected')
        content = data.decode('utf-8')
        if '\x00' in content:
            raise ValueError('Binary files unsupported')
        return {'content': content, 'mode': stat.S_IMODE(before.st_mode)}, [before.st_dev, before.st_ino]
    finally:
        os.close(entry)


def copy_provenance(parent, name, target):
    import ctypes
    libc = ctypes.CDLL(None, use_errno=True)
    libc.fgetxattr.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
    libc.fgetxattr.restype = ctypes.c_ssize_t
    libc.fsetxattr.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
    source = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        data = ctypes.create_string_buffer(4096)
        length = libc.fgetxattr(source, b'com.apple.provenance', data, len(data), 0, 0)
        if length < 0 and ctypes.get_errno() == 93: return
        if length < 0 or libc.fsetxattr(target, b'com.apple.provenance', data, length, 0, 0) != 0:
            raise ValueError('Cannot preserve macOS provenance; no displacement')
    finally:
        os.close(source)


def write_all(fd, data):
    while data:
        written = os.write(fd, data)
        if written <= 0: raise OSError('Short durable write')
        data = data[written:]


def record(fd, name, value):
    data = json.dumps(value, ensure_ascii=True).encode('utf-8')
    tmp = name + '.next-' + secrets.token_hex(12)
    out = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=fd)
    try:
        write_all(out, data)
        os.fsync(out)
    finally:
        os.close(out)
    os.rename(tmp, name, src_dir_fd=fd, dst_dir_fd=fd)
    os.fsync(fd)


def load(fd, name):
    try:
        entry = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=fd)
    except FileNotFoundError:
        return None
    try:
        s = os.fstat(entry)
        if not stat.S_ISREG(s.st_mode) or s.st_size > 4000000 or s.st_nlink != 1:
            raise ValueError('Invalid publication record')
        return json.loads(os.read(entry, 4000001))
    finally:
        os.close(entry)


def move_to_escrow(parent, name, escrow):
    import ctypes
    libc = ctypes.CDLL(None, use_errno=True)
    if sys.platform == 'darwin':
        rename = libc.renameatx_np
        flag = 0x00000004  # RENAME_EXCL, macOS sys/stdio.h
    else:
        rename = libc.renameat2
        flag = 1  # RENAME_NOREPLACE
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    if rename(parent, os.fsencode(name), escrow, b'displaced', flag) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))


def publish(request, hook=lambda phase: None):
    root, control, key, change = request['root'], request['control'], request['key'], request['change']
    if len(key) != 64 or any(c not in '0123456789abcdef' for c in key):
        raise ValueError('Invalid operation key')
    if control == root or control.startswith(root + '/') or root.startswith(control + '/'):
        raise ValueError('Escrow must be outside the movable target tree')
    for side in ('before', 'after'):
        content, mode = change[side], change[side + 'Mode']
        if content is None:
            if mode is not None: raise ValueError('Absent file permissions')
        elif not isinstance(content, str) or '\x00' in content or len(content.encode('utf-8')) > LIMIT or type(mode) is not int or not 0 <= mode <= 0o777:
            raise ValueError('Invalid bounded text image')
    anchor = open_directory(control)
    parent = step = None
    try:
        owner = os.fstat(anchor)
        if owner.st_uid != os.getuid() or stat.S_IMODE(owner.st_mode) & 0o077:
            raise ValueError('Escrow anchor must be private and owned')
        try:
            os.mkdir('escrow-' + key, 0o700, dir_fd=anchor)
            os.fsync(anchor)
        except FileExistsError:
            pass
        step = os.open('escrow-' + key, DIR, dir_fd=anchor)
        if os.fstat(step).st_uid != os.getuid() or stat.S_IMODE(os.fstat(step).st_mode) & 0o077:
            raise ValueError('Invalid owned escrow')
        previous = load(step, 'intent.json')
        expected = previous['parents'] if previous is not None else request['parents']
        parent, name, parents = chain(root, change['relativePath'], create=previous is None and change['before'] is None, expected=expected)
        if identity(parent)[0] != identity(step)[0]:
            raise ValueError('Escrow and target must be on the same filesystem')
        intent = {'version': 1, 'root': root, 'control': control, 'anchor': identity(anchor), 'parents': parents, 'name': name, 'change': change, 'key': key}
        if previous is not None and previous != intent:
            raise ValueError('Reviewed parent or publication identity changed; retained escrow needs review')
        if previous is None:
            record(step, 'intent.json', intent)
        hook('intent')

        def stable():
            observed, _, current = chain(root, change['relativePath'])
            try:
                if current != parents or identity(observed) != identity(parent):
                    raise ValueError('Target parent relocated; replacement parent untouched')
            finally:
                os.close(observed)
            observed = open_directory(control)
            try:
                if identity(observed) != identity(anchor): raise ValueError('Escrow anchor relocated')
            finally:
                os.close(observed)

        before = {'content': change['before'], 'mode': change['beforeMode']}
        after = {'content': change['after'], 'mode': change['afterMode']}
        receipt = load(step, 'receipt.json')
        if receipt is not None and receipt['phase'] == 'complete':
            stable()
            actual, ident = image(parent, name)
            if actual != after or ident != receipt['published']:
                raise ValueError('Completed publication changed; no replay')
            return {'kind': 'complete', 'escrow': os.path.join(control, 'escrow-' + key), 'preserved': change['before'] is not None}
        staged = load(step, 'prepared.json')
        if after['content'] is not None and staged is None:
            try:
                out = os.open('replacement', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=step)
            except FileExistsError:
                # Only a prepublication artifact without a durable identity can be discarded.
                os.unlink('replacement', dir_fd=step)
                out = os.open('replacement', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=step)
            try:
                write_all(out, after['content'].encode('utf-8'))
                os.fchmod(out, after['mode'])
                if before['content'] is not None and sys.platform == 'darwin':
                    copy_provenance(parent, name, out)
                os.fsync(out)
                staged = {'identity': identity(out)}
            finally:
                os.close(out)
            record(step, 'prepared.json', staged)
        hook('prepared')
        stable()
        displaced, displaced_id = image(step, 'displaced')
        if before['content'] is not None and displaced_id is None:
            actual, actual_id = image(parent, name)
            if actual != before:
                raise ValueError('Before image diverged; no displacement')
            hook('before-displacement')
            # Destination is a new private operation directory. Never reuse an escrow name.
            move_to_escrow(parent, name, step)
            os.fsync(parent)
            os.fsync(step)
            hook('displaced')
            stable()
            displaced, displaced_id = image(step, 'displaced')
            if displaced != before or displaced_id != actual_id:
                raise ValueError('Actual displaced entry differed; retained live inode needs review')
            record(step, 'receipt.json', {'phase': 'displaced', 'preserved': displaced_id})
        elif before['content'] is not None and displaced != before:
            raise ValueError('Preserved live inode changed; review its current bytes before continuing')
        hook('displacement-receipt')
        stable()
        actual, ident = image(parent, name, allow_links=True)
        if after['content'] is not None:
            if actual['content'] is not None:
                if staged is None or ident != staged['identity'] or actual != after:
                    raise ValueError('Destination occupied; never overwrite newer work')
            else:
                hook('before-publication')
                os.link('replacement', name, src_dir_fd=step, dst_dir_fd=parent, follow_symlinks=False)
                os.fsync(parent)
                hook('published')
            stable()
            actual, ident = image(parent, name, allow_links=True)
            if staged is None or ident != staged['identity'] or actual != after:
                raise ValueError('Published entry changed; retained escrow needs review')
            try: os.unlink('replacement', dir_fd=step)
            except FileNotFoundError: pass
            os.fsync(step)
        elif actual['content'] is not None:
            raise ValueError('Deletion destination occupied by newer work')
        stable()
        record(step, 'receipt.json', {'phase': 'complete', 'published': ident, 'preserved': displaced_id})
        hook('complete')
        stable()
        return {'kind': 'complete', 'escrow': os.path.join(control, 'escrow-' + key), 'preserved': displaced_id is not None}
    finally:
        if parent is not None: os.close(parent)
        if step is not None: os.close(step)
        os.close(anchor)


def main():
    if sys.platform not in ('darwin', 'linux'):
        raise ValueError('Supported Unix filesystem required')
    request = json.loads(sys.stdin.buffer.read(4000001))
    if request.get('kind') == 'capability':
        if not all(f in os.supports_dir_fd for f in (os.open, os.rename, os.link, os.stat, os.unlink)):
            raise ValueError('Descriptor relative filesystem calls unavailable')
        print(json.dumps({'kind': 'supported', 'platform': sys.platform, 'version': 1}))
    elif request.get('kind') == 'preflight':
        anchor = open_directory(request['control'])
        root = open_directory(request['root'])
        try:
            if identity(anchor)[0] != identity(root)[0] or request['control'].startswith(request['root'] + '/') or request['root'].startswith(request['control'] + '/') or request['control'] == request['root']:
                raise ValueError('Stable same-filesystem escrow outside target tree required')
            if os.fstat(anchor).st_uid != os.getuid() or stat.S_IMODE(os.fstat(anchor).st_mode) & 0o077:
                raise ValueError('Private owned escrow required')
            for relative in request['paths']:
                try: parent, name, _ = chain(request['root'], relative)
                except FileNotFoundError: continue
                try: image(parent, name)
                finally: os.close(parent)
            print(json.dumps({'kind': 'supported', 'version': 1}))
        finally:
            os.close(anchor); os.close(root)
    else:
        print(json.dumps(publish(request)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'kind': 'unknown', 'reason': str(error)}))
