param(
  [int]$Port = 8090,
  [string]$ModelName = "microsoft/trocr-base-handwritten"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

if (!(Test-Path $VenvPython)) {
  throw "Model virtualenv not found. Run scripts\install_trocr.ps1 first."
}

$env:SMARTFLN_MODEL_OCR_PROVIDER = "trocr"
$env:SMARTFLN_TROCR_MODEL = $ModelName
$env:SMARTFLN_TROCR_LOCAL_FILES_ONLY = "true"
$env:SMARTFLN_TROCR_CACHE_DIR = Join-Path $Root "models\cache"
$env:SMARTFLN_MODEL_PORT = "$Port"
& $VenvPython -m app.main
