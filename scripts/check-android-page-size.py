"""Verify ELF segment alignment of the native 64-bit libraries packaged in an APK or AAB."""
import struct
import sys
from pathlib import PurePosixPath
from zipfile import ZipFile

PAGE = 16 * 1024
ABIS = {"arm64-v8a", "x86_64"}


def inspect(archive):
    checked = 0
    failed = []
    with ZipFile(archive) as package:
        for filename in package.namelist():
            path = PurePosixPath(filename)
            if (
                path.suffix != ".so"
                or path.parent.name not in ABIS
                or path.parent.parent.name != "lib"
            ):
                continue
            checked += 1
            payload = package.read(filename)
            if payload[:6] != b"\x7fELF\x02\x01" or len(payload) < 64:
                failed.append(f"{filename}: invalid little-endian ELF64")
                continue
            start = struct.unpack_from("<Q", payload, 32)[0]
            size, count = struct.unpack_from("<HH", payload, 54)
            if size < 56 or count < 1 or start + size * count > len(payload):
                failed.append(f"{filename}: missing or invalid program headers")
                continue
            loads = 0
            for index in range(count):
                kind, _, offset, address, _, _, _, alignment = struct.unpack_from(
                    "<IIQQQQQQ", payload, start + size * index
                )
                if kind != 1:
                    continue
                loads += 1
                if alignment < PAGE or offset % PAGE != address % PAGE:
                    failed.append(
                        f"{filename}: LOAD {index} alignment {alignment:#x} cannot use 16 KB pages"
                    )
            if not loads:
                failed.append(f"{filename}: no LOAD segments")
    print(f"{archive}: {checked} native 64-bit libraries checked", flush=True)
    for issue in failed:
        print(issue, file=sys.stderr)
    return not failed


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: check-android-page-size.py <apk-or-aab>")
    sys.exit(0 if inspect(sys.argv[1]) else 1)
