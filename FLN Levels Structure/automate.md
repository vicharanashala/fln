### Sources
The five authoritative inputs: NIPUN Bharat, NCERT chapter order, PARAKH CBE, your FLN diagnostic sheets (Class 1/2/3), and the state syllabus coverage index.

### Ingestion 
Everything gets parsed once into the source library. It also reads your existing 23 approved levels as few-shot examples, and derives the gap list (shapes, measurement, money, time, data handling) from comparing those 23 against the full NIPUN ceiling.

### Decision 
The AI concept selector picks the next concept using: the next open gap in the NIPUN/NCERT sequence, the difficulty score from the diagnostic Q bank, and the state coverage matrix. It assigns the level to Phase 3/4/5 depending on which class ceiling it belongs to.

### Generation 
Claude drafts the full level in JSON: all metadata fields, the main level body, and sub-levels sized by the difficulty-score rule (1–3 → 1 sub, 4–6 → 2, 7+ → 3).

### Review loop 
Draft appears in the console. You edit inline, or send feedback and Claude revises. The loop repeats until you approve. If you start over it re-proposes from scratch.

### Output 
JSZip assembles the exact folder/file structure your repo uses, downloads as Level_N_files.zip, and the console advances its counter to N+1, ready for the next round.

![image](image/fln_level_creation_pipeline.svg) 
