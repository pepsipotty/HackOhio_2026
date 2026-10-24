"""Remove animation objects from a binary FBX without re-encoding asset data."""
import argparse
import collections
import struct
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('destination', type=Path)
args = parser.parse_args()
if args.destination.exists():
    parser.error('Destination already exists; choose a new path.')
data = args.source.read_bytes()
if data[:23] != b'Kaydara FBX Binary  \x00\x1a\x00':
    parser.error('Only binary FBX is supported.')
version = struct.unpack_from('<I', data, 23)[0]
fmt = '<QQQB' if version >= 7500 else '<IIIB'
header_size = struct.calcsize(fmt)

class Node:
    def __init__(self, name, count, props, children, terminator):
        self.name, self.count, self.props = name, count, props
        self.children, self.terminator = children, terminator

def read_node(pos):
    end, count, length, name_len = struct.unpack_from(fmt, data, pos)
    if end == 0:
        assert data[pos:pos + header_size] == bytes(header_size)
        return None, pos + header_size
    pos += header_size
    name = data[pos:pos + name_len]
    pos += name_len
    props = data[pos:pos + length]
    pos += length
    children, terminator = [], False
    while pos < end:
        child, pos = read_node(pos)
        if child is None:
            terminator = True
            break
        children.append(child)
    assert pos == end, (name, pos, end)
    return Node(name, count, props, children, terminator), end

nodes, pos = [], 27
while True:
    node, pos = read_node(pos)
    if node is None:
        break
    nodes.append(node)
footer = data[pos:]
objects = next(n for n in nodes if n.name == b'Objects')
removed = [n for n in objects.children if n.name.startswith(b'Animation')]
ids = {struct.unpack_from('<q', n.props, 1)[0] for n in removed}
assert all(n.props[:1] == b'L' for n in removed)
objects.children = [n for n in objects.children if n not in removed]
connections = next(n for n in nodes if n.name == b'Connections')
def keep_connection(n):
    if n.name != b'C':
        return True
    assert n.props[:1] == b'S'
    offset = 5 + struct.unpack_from('<I', n.props, 1)[0]
    assert n.props[offset:offset+1] == b'L' and n.props[offset+9:offset+10] == b'L'
    source = struct.unpack_from('<q', n.props, offset+1)[0]
    target = struct.unpack_from('<q', n.props, offset+10)[0]
    return source not in ids and target not in ids
connections.children = [n for n in connections.children if keep_connection(n)]
nodes = [n for n in nodes if n.name != b'Takes']
# Drop obsolete object definitions and update the declared object count.
for n in nodes:
    if n.name == b'Definitions':
        n.children = [c for c in n.children if not (c.name == b'ObjectType' and c.props.startswith(b'S') and c.props[5:].startswith(b'Animation'))]
        for c in n.children:
            if c.name == b'Count':
                assert c.props[:1] == b'I'
                c.props = b'I' + struct.pack('<i', len(objects.children))
# Remove document references to a formerly active animation stack.
def clear_active(n):
    if n.name == b'ActiveAnimStackName':
        n.props, n.count = b'S' + struct.pack('<I', 0), 1
    for child in n.children:
        clear_active(child)
for n in nodes:
    clear_active(n)

out = bytearray(data[:27])
def write_node(n):
    start = len(out)
    out.extend(bytes(header_size))
    out.extend(n.name)
    out.extend(n.props)
    for child in n.children:
        write_node(child)
    if n.terminator:
        out.extend(bytes(header_size))
    struct.pack_into(fmt, out, start, len(out), n.count, len(n.props), len(n.name))
for n in nodes:
    write_node(n)
out.extend(bytes(header_size))
# FBX footer: 16-byte marker, zero padding to a 16-byte boundary,
# followed by version and reserved/signature fields. Retain marker and tail.
assert len(footer) >= 160
old_padding = 16 - ((pos + 16) % 16)
new_padding = 16 - ((len(out) + 16) % 16)
assert footer[16:16+old_padding] == bytes(old_padding)
out.extend(footer[:16] + bytes(new_padding) + footer[16+old_padding:])
args.destination.write_bytes(out)
print('Removed:', dict(collections.Counter(n.name.decode() for n in removed)))
print(f'Wrote {args.destination} ({len(out):,} bytes)')
