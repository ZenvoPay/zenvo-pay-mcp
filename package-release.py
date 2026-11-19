"""Empacota apenas os arquivos distribuídos ao integrador."""
import json
from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent
version = json.loads((root / "package.json").read_text())["version"]
dest = Path(sys.argv[1]) / f"zenvo-mcp-{version}.zip"
files = ["README.md", "package.json", "package-lock.json", "server.mjs",
         "server.test.mjs", "connector.mjs", "http.mjs", "docs/api-publica.txt", "package-release.py"]
with ZipFile(dest, "w", compression=ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, f"zenvo-mcp/{name}")
print(dest)
