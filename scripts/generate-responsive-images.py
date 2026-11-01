#!/usr/bin/env python3
"""Generate a small native-srcset manifest from an explicit source allowlist.

Run in the project root:
    python3 scripts/generate-responsive-images.py
Requires Pillow with WebP support. All originals are read-only.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import tempfile

from PIL import Image, __version__ as pillow_version, features

PHOTO_WIDTHS = (640, 960, 1440, 1920)
ARTWORK_WIDTHS = (320, 640, 960, 1440)
QUALITY = 86
METHOD = 5
PIPELINE = "responsive-images-v1"
MIN_REDUCTION = 0.9  # Avoid a near-duplicate 960 next to an original 1024.
FORMAT_EXTENSIONS = {".webp", ".png", ".jpg", ".jpeg"}


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        try:
            handle.write(data)
            handle.close()
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def public_file(project: Path, src: str) -> Path:
    if not src.startswith("/assets/") or "?" in src or "#" in src:
        raise ValueError(f"Only local /assets/ sources are supported: {src}")
    public = (project / "public").resolve()
    path = (public / src.lstrip("/")).resolve()
    if not path.is_relative_to(public) or path.suffix.lower() not in FORMAT_EXTENSIONS:
        raise ValueError(f"Invalid raster source: {src}")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true", help="Verify current sources and generated files without encoding")
    args = parser.parse_args()
    project = args.project_root.resolve()
    config_file = project / "scripts/responsive-image-sources.json"
    manifest_file = project / "src/data/responsive-images.json"
    sources = json.loads(config_file.read_text())
    if not isinstance(sources, list) or len({item["src"] for item in sources}) != len(sources):
        raise ValueError("Source allowlist must contain unique src entries")
    if not features.check("webp"):
        raise RuntimeError("Pillow was built without WebP support")
    codec = f"Pillow {pillow_version}; WebP {features.version_module('webp')}"
    previous = json.loads(manifest_file.read_text()) if manifest_file.exists() else {}
    result = {}
    counts = {"sources": len(sources), "generated": 0, "reused": 0, "variants": 0}
    unique_outputs = {}
    for spec in sorted(sources, key=lambda item: item["src"]):
        src = spec["src"]
        source_file = public_file(project, src)
        original_data = source_file.read_bytes()
        source_hash = sha256(original_data).hexdigest()
        kind = spec.get("kind", "photo")
        if kind not in {"photo", "artwork"}:
            raise ValueError(f"Unsupported image kind: {kind}")
        lossless = kind == "artwork"
        with Image.open(BytesIO(original_data)) as opened:
            if getattr(opened, "is_animated", False):
                raise ValueError(f"Animated artwork must remain original: {src}")
            if opened.getexif().get(274, 1) != 1:
                raise ValueError(f"Normalize EXIF orientation explicitly before opting in: {src}")
            width, height = opened.size
            # Keep the original canvas and transparency. No crop, fit or artwork edits.
            source = opened.convert("RGBA" if "A" in opened.getbands() or "transparency" in opened.info else "RGB")
            icc = opened.info.get("icc_profile")
        requested = sorted(set(spec.get("widths", ARTWORK_WIDTHS if lossless else PHOTO_WIDTHS)))
        if any(not isinstance(value, int) or value <= 0 for value in requested):
            raise ValueError(f"Invalid widths for {src}")
        widths = [value for value in requested if value <= width * MIN_REDUCTION]
        settings = f"{PIPELINE}|{codec}|{kind}|q{QUALITY}|m{METHOD}|icc-preserved"
        digest = sha256((source_hash + settings).encode()).hexdigest()[:20]
        entry = {"width": width, "height": height, "bytes": len(original_data), "sourceHash": source_hash,
                 "kind": kind, "encoder": codec, "variants": []}
        if args.check:
            saved = previous.get(src)
            if not saved or any(saved.get(key) != entry[key] for key in entry if key != "variants"):
                raise RuntimeError(f"Manifest is missing or stale for {src}; run the generator")
            for variant in saved["variants"]:
                expected_src = f"/assets/responsive/{digest}-w{variant['width']}.webp"
                if variant["src"] != expected_src or variant["width"] not in widths:
                    raise RuntimeError(f"Unexpected variant for {src}: {variant['src']}")
                candidate = public_file(project, variant["src"])
                if candidate.stat().st_size != variant["bytes"]:
                    raise RuntimeError(f"Missing or changed derivative: {candidate}")
                with Image.open(candidate) as image:
                    if image.size != (variant["width"], variant["height"]):
                        raise RuntimeError(f"Derivative dimensions changed: {candidate}")
                unique_outputs[variant["src"]] = variant["bytes"]
            result[src] = saved
            counts["variants"] += len(saved["variants"])
            source.close()
            continue
        for target_width in widths:
            target_height = max(1, round(height * target_width / width))
            target_src = f"/assets/responsive/{digest}-w{target_width}.webp"
            destination = public_file(project, target_src)
            if destination.exists():
                with Image.open(destination) as image:
                    if image.size != (target_width, target_height):
                        raise RuntimeError(f"Unexpected existing derivative: {destination}")
                byte_count = destination.stat().st_size
                counts["reused"] += 1
            else:
                resized = source.resize((target_width, target_height), Image.Resampling.LANCZOS)
                buffer = BytesIO()
                options = {"format": "WEBP", "lossless": lossless, "quality": 100 if lossless else QUALITY,
                           "method": METHOD, "exact": True}
                if icc:
                    options["icc_profile"] = icc
                resized.save(buffer, **options)
                encoded = buffer.getvalue()
                byte_count = len(encoded)
                # A lossless logo/plan derivative can exceed a compressed original.
                # Preserve the original candidate instead of adding a heavier file.
                if byte_count >= len(original_data):
                    continue
                write_atomic(destination, encoded)
                counts["generated"] += 1
            if byte_count >= len(original_data):
                continue
            entry["variants"].append({"src": target_src, "width": target_width, "height": target_height, "bytes": byte_count})
            unique_outputs[target_src] = byte_count
        source.close()
        counts["variants"] += len(entry["variants"])
        result[src] = entry
    if args.check:
        if set(previous) != set(result):
            raise RuntimeError("Manifest sources differ from the allowlist; run the generator")
    else:
        write_atomic(manifest_file, (json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True) + "\n").encode())
    counts["unique_files"] = len(unique_outputs)
    counts["variant_bytes"] = sum(unique_outputs.values())
    counts["mode"] = "check" if args.check else "generate"
    print(json.dumps(counts, sort_keys=True))


if __name__ == "__main__":
    main()
