param(
  [string]$Python = "python",
  [string]$ModelName = "microsoft/trocr-base-handwritten",
  [string]$RuntimeRoot = $env:SMARTFLN_MODEL_RUNTIME_DIR
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) { $RuntimeRoot = $Root }
$RuntimeRoot = [System.IO.Path]::GetFullPath($RuntimeRoot)
$VenvPython = Join-Path $RuntimeRoot ".venv\Scripts\python.exe"
$CacheDir = Join-Path $RuntimeRoot "models\cache"

New-Item -ItemType Directory -Force -Path $RuntimeRoot, $CacheDir | Out-Null

if (!(Test-Path $VenvPython)) {
  & $Python -m venv (Join-Path $RuntimeRoot ".venv")
}

& $VenvPython -m pip install --upgrade pip setuptools wheel
& $VenvPython -m pip install -e "$Root[ocr]"

$env:SMARTFLN_MODEL_OCR_PROVIDER = "trocr"
$env:SMARTFLN_TROCR_MODEL = $ModelName
$env:SMARTFLN_TROCR_LOCAL_FILES_ONLY = "false"
$env:SMARTFLN_TROCR_CACHE_DIR = $CacheDir
$env:HF_HOME = Join-Path $RuntimeRoot "huggingface"
$env:TRANSFORMERS_CACHE = $CacheDir
& $VenvPython -c "from app.pipeline.recognition import _load_trocr; _load_trocr(); print('TrOCR model ready')"
