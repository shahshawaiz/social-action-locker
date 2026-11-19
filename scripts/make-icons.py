#!/usr/bin/env python3
"""Draw the padlock icons (16/48/128 px) with only the standard library.

Run from the repository root:  python3 scripts/make-icons.py
"""
import struct
import zlib
from pathlib import Path

BG = (37, 99, 235)      # blue-600
FG = (255, 255, 255)
SS = 4                  # supersampling factor for smooth edges


def inside(x, y):
    """Shape test in a 0..1 unit square. Returns 'fg', 'bg' or None (transparent)."""
    # Rounded-square background.
    r = 0.22
    cx = min(max(x, r), 1 - r)
    cy = min(max(y, r), 1 - r)
    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
        return None
    # Lock body.
    if 0.26 <= x <= 0.74 and 0.46 <= y <= 0.80:
        # Keyhole.
        if (x - 0.5) ** 2 + (y - 0.59) ** 2 <= 0.055 ** 2 or (0.475 <= x <= 0.525 and 0.59 <= y <= 0.70):
            return 'bg'
        return 'fg'
    # Shackle: ring between radii, upper half only, plus the two legs.
    dx, dy = x - 0.5, y - 0.38
    d2 = dx * dx + dy * dy
    if y <= 0.38 and 0.13 ** 2 <= d2 <= 0.205 ** 2:
        return 'fg'
    if 0.38 <= y <= 0.46 and (0.295 <= x <= 0.37 or 0.63 <= x <= 0.705):
        return 'fg'
    return 'bg'


def render(size):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    kind = inside((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)
                    if kind is None:
                        continue
                    c = FG if kind == 'fg' else BG
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            n = SS * SS
            a = acc[3] // n
            if a:
                cover = acc[3] // 255
                row += bytes([acc[0] // cover, acc[1] // cover, acc[2] // cover, a])
            else:
                row += bytes(4)
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))


if __name__ == '__main__':
    out = Path('icons')
    out.mkdir(exist_ok=True)
    for s in (16, 48, 128):
        (out / f'icon{s}.png').write_bytes(render(s))
        print(f'icons/icon{s}.png')
