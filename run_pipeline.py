import subprocess, sys
from pathlib import Path

p = Path(__file__).resolve().parent / "evaluation_metrics" / "run_pipeline.py"
args = sys.argv[1:] if len(sys.argv) > 1 else ["1", "phrase_1", "STU_001_phrase1"]
subprocess.run([sys.executable, str(p)] + args)
