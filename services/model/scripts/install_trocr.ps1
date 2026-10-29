param(
  [string]$Python = "python",
  [string]$ModelName = "microsoft/trocr-base-handwritten"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

if (!(Test-Path $VenvPython)) {
  & $Python -m venv (Join-Path $Root ".venv")
}

& $VenvPython -m pip install --upgrade pip setuptools wheel
& $VenvPython -m pip install -e "$Root[ocr]"

$env:SMARTFLN_MODEL_OCR_PROVIDER = "trocr"
$env:SMARTFLN_TROCR_MODEL = $ModelName
$env:SMARTFLN_TROCR_LOCAL_FILES_ONLY = "false"
& $VenvPython -c "from app.pipeline.recognition import _load_trocr; _load_trocr(); print('TrOCR model ready')"
