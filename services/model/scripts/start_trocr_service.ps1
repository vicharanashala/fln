param(
  [int]$Port = 8090,
  [string]$ModelName = "microsoft/trocr-base-handwritten",
  [string]$RuntimeRoot = $env:SMARTFLN_MODEL_RUNTIME_DIR
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) { $RuntimeRoot = $Root }
$RuntimeRoot = [System.IO.Path]::GetFullPath($RuntimeRoot)
$VenvPython = Join-Path $RuntimeRoot ".venv\Scripts\python.exe"

if (!(Test-Path $VenvPython)) {
  throw "Model virtualenv not found. Run scripts\install_trocr.ps1 first."
}

$env:SMARTFLN_MODEL_OCR_PROVIDER = "trocr"
$env:SMARTFLN_TROCR_MODEL = $ModelName
$env:SMARTFLN_TROCR_LOCAL_FILES_ONLY = "true"
$env:SMARTFLN_TROCR_CACHE_DIR = Join-Path $RuntimeRoot "models\cache"
$env:HF_HOME = Join-Path $RuntimeRoot "huggingface"
$env:TRANSFORMERS_CACHE = $env:SMARTFLN_TROCR_CACHE_DIR
$env:SMARTFLN_MODEL_PORT = "$Port"
& $VenvPython -m app.main
