import json
import os
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent

from _api import groq_api_call

class ReportGenerator:
    def __init__(self, model="llama-3.1-8b-instant", api_key=None):
        self.model = model
        self.api_key = api_key
        self.report = None

    def generate(self, evaluation_file, student_name="Student"):
        print("\n" + "="*60)
        print("REPORT CARD GENERATION")
        print("="*60 + "\n")

        with open(evaluation_file) as f:
            eval_data = json.load(f)

        if eval_data.get('decision') == 'RETEST':
            self.report = self._generate_retest_report(eval_data, student_name)
        elif eval_data.get('decision') == 'PASS':
            self.report = self._generate_pass_report(eval_data, student_name)
        else:
            self.report = self._generate_ai_report(eval_data, student_name)

        print(self.report)
        self._save_report(eval_data, student_name)

    def _generate_retest_report(self, eval_data, student_name):
        report = f"""
{'='*60}
         FLN ASSESSMENT - RETEST NOTIFICATION
{'='*60}

Student Name: {student_name}
Student ID: {eval_data.get('student_id')}
Test Date: {eval_data.get('test_date')}

DECISION: RETEST REQUIRED
{'-'*50}

Reason: {eval_data.get('reason')}

The child made minor mistakes (< 10% wrong) in the EASY 
section of the test. This suggests careless errors rather 
than gaps in understanding.

RETEST SCHEDULE
{'-'*50}
Retest Date: {eval_data.get('retest_date')}
Exam: Same assessment (different numbers)

RECOMMENDATION
{'-'*50}
{eval_data.get('recommendation')}

{'='*60}
"""
        return report

    def _generate_pass_report(self, eval_data, student_name):
        perf = eval_data.get('performance_by_difficulty', {})
        perf_lines = ""
        for d, s in perf.items():
            pct = (s.get('correct', 0) / max(s.get('attempted', 1), 1)) * 100
            perf_lines += f"\n  {d.capitalize()}: {s.get('correct', 0)}/{s.get('attempted', 0)} ({pct:.0f}%)"
        return f"""
{'='*60}
            FLN ASSESSMENT REPORT CARD
{'='*60}

Student Name: {student_name}
Student ID: {eval_data.get('student_id')}
Enrolled Class: {eval_data.get('enrolled_class')}
Test Date: {eval_data.get('test_date')}

 FLN ASSESSMENT STATUS
{'-'*50}
Result: PASS
Class: {eval_data.get('enrolled_class')}
Confidence: {eval_data.get('confidence_score', 0)*100:.0f}%

 PERFORMANCE BY DIFFICULTY
{'-'*50}{perf_lines}

 PERFORMANCE CHECK
{'-'*50}
  Easy: need >= 90% {'Met' if perf.get('easy', {}).get('correct', 0) / max(perf.get('easy', {}).get('attempted', 1), 1) * 100 >= 90 else 'Not Met'}
  Medium: need >= 50% {'Met' if perf.get('medium', {}).get('correct', 0) / max(perf.get('medium', {}).get('attempted', 1), 1) * 100 >= 50 else 'Not Met'}
  Hard: need >= 40% {'Met' if perf.get('hard', {}).get('correct', 0) / max(perf.get('hard', {}).get('attempted', 1), 1) * 100 >= 40 else 'Not Met'}

 RESULT
{'-'*50}
The child has mastered the foundational concepts required for Class {eval_data.get('enrolled_class')}.

 NEXT STEPS
{'-'*50}
{eval_data.get('recommendation')}

{'='*60}
"""

    def _generate_ai_report(self, eval_data, student_name):
        try:
            with open(BASE_DIR / "prompts/generate_report.txt", encoding='utf-8') as f:
                prompt_template = f.read()

            input_data = {
                "student_id": eval_data.get('student_id'),
                "student_name": student_name,
                "enrolled_class": eval_data.get('enrolled_class'),
                "test_date": eval_data.get('test_date'),
                "evaluation": {
                    "demonstrated_level": eval_data.get('demonstrated_level'),
                    "boundary_level": eval_data.get('boundary_level'),
                    "confidence_score": eval_data.get('confidence_score'),
                    "error_type": eval_data.get('error_type'),
                    "root_causes": eval_data.get('root_causes', []),
                    "topics_to_focus": eval_data.get('topics_to_focus', []),
                    "prerequisites_to_check": eval_data.get('prerequisites_to_check', []),
                    "recommendation": eval_data.get('recommendation'),
                    "next_level_assignment": eval_data.get('next_level_assignment')
                }
            }

            prompt = prompt_template.replace(
                "{evaluation_data}",
                json.dumps(input_data, indent=2)
            )

            result = groq_api_call(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an FLN assessment report generator. Return only the report text, no extra commentary."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1500,
                timeout=300,
                api_key=self.api_key,
                max_retries=5
            )

            if result is not None:
                output = result["choices"][0]["message"]["content"].strip()
                if output:
                    return output

        except Exception as e:
            print(f"AI report generation failed: {e}")
            print("Falling back to template report...\n")

        return self._generate_template_report(eval_data, student_name)

    def _generate_template_report(self, eval_data, student_name):
        assigned_level = eval_data.get('demonstrated_level', 'Unknown')
        boundary_level = eval_data.get('boundary_level', 'Unknown')
        assign_reason = eval_data.get('assign_reason', 'Minimum failure level rule applied')
        levels_failed = eval_data.get('levels_failed', [])
        confidence = eval_data.get('confidence_score', 0)
        root_causes = eval_data.get('root_causes', [])
        recommendation = eval_data.get('recommendation', 'Continue current practice')

        dash = " - "
        no_areas = "\n  No specific areas identified"
        no_perf = "\n  Not available"
        check = "[OK]"
        levels_failed_lines = ""
        conceptual = []
        careless = []
        for rc in root_causes:
            lvl = rc.get('fln_level', '?')
            topic = rc.get('topic', '?')
            etype = rc.get('error_type', '?')
            analysis = rc.get('analysis', '')
            line = f"  Level {lvl}{dash}{topic}{dash}Error: {etype}"
            levels_failed_lines += f"\n{line}"
            if etype == 'conceptual' or etype == 'prerequisite':
                conceptual.append((lvl, topic, analysis))
            else:
                careless.append((lvl, topic, analysis))

        growth_lines = ""
        for lvl, topic, analysis in conceptual:
            growth_lines += f"\n  Level {lvl}: {topic}{dash}{analysis}"
        for lvl, topic, analysis in careless:
            growth_lines += f"\n  Level {lvl}: {topic}{dash}{analysis} (careless)"

        prereqs = eval_data.get('prerequisites_to_check', [])
        prereq_lines = "\n".join([f"  * {p}" for p in prereqs]) if prereqs else "  None identified"

        topics_focus = ', '.join(eval_data.get('topics_to_focus', []))

        perf_lines = ""
        for d, s in eval_data.get('performance_by_difficulty', {}).items():
            perf_lines += f"\n  {d.capitalize()}: {s.get('correct', '?')}/{s.get('attempted', '?')} correct"

        return f"""
{'='*60}
            FLN ASSESSMENT REPORT CARD
{'='*60}

Student Name: {student_name}
Student ID: {eval_data.get('student_id')}
Enrolled Class: {eval_data.get('enrolled_class')}
Test Date: {eval_data.get('test_date')}

 PLACEMENT
{'-'*50}
Assigned Level: {assigned_level}
Reason: {assign_reason}
Confidence: {confidence*100:.0f}%

 AREAS OF WEAKNESS BY LEVEL
{'-'*50}{levels_failed_lines}

Assigned to {assigned_level} as the starting point for remediation.

  WHAT YOUR CHILD CAN DO
{'-'*50}
  {check} Skills at or below {assigned_level} are being developed

  AREAS FOR GROWTH (BY LEVEL)
{'-'*50}{growth_lines if growth_lines else no_areas}

 ROOT CAUSE ANALYSIS
{'-'*50}
Topics to Focus: {topics_focus}
Prerequisites to Review:
{prereq_lines}
Performance by Difficulty:{perf_lines if perf_lines else no_perf}

 NEXT STEPS FOR TEACHER
{'-'*50}
SHORT-TERM (Next 1-2 weeks) - Focus on {assigned_level}:
1. Remediate {topics_focus} using concrete objects and visual aids
2. Practice 15-20 minutes daily on {assigned_level} skills
3. Use worksheets and hands-on activities

MEDIUM-TERM (Next month):
- Master {assigned_level} first, then reassess for next level
- Expected next target: {boundary_level}

{recommendation}

{'='*60}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
{'='*60}
"""

    def _get_can_do_list(self, level):
        skills = {
            "Class 1": """
  * Count objects up to 20
  * Perform single-digit addition (up to 18)
  * Perform single-digit subtraction (up to 9)
  * Recognize and read numerals up to 99
  * Compare numbers using greater than/less than
  * Identify basic 3D shapes
  * Understand place value (tens and ones) for numbers up to 20
  * Measure using non-standard units
""",
            "Class 2": """
  * Count and recognize numbers up to 999
  * Perform two-digit addition and subtraction
  * Understand place value (tens, ones, hundreds)
  * Know multiplication facts for 2, 3, 4
  * Perform basic division (equal sharing)
  * Work with money up to Rs.100
  * Identify 2D shapes and their properties
  * Interpret simple data (tally marks, pictures)
  * Use calendar and identify days/months
""",
            "Class 3": """
  * Read and write numbers up to 9999
  * Perform two-digit addition/subtraction with regrouping
  * Know multiplication facts for 5-10
  * Perform division with algorithm
  * Work with money up to Rs.500
  * Measure using standard units (cm, m, g, kg, litres)
  * Understand fractions (1/4, 3/4)
  * Identify patterns in sequences
  * Record and interpret data
"""
        }

        return skills.get(level, "  [OK] Foundational mathematics skills")

    def _save_report(self, eval_data, student_name):
        output_file = BASE_DIR / f"evaluation_reports/{eval_data['student_id']}_report_{eval_data['test_date']}.txt"
        output_file.parent.mkdir(exist_ok=True)

        with open(output_file, 'w') as f:
            f.write(self.report)

        print(f"[OK] Report saved: {output_file}")
        print("="*60 + "\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python scripts/3_generate_report.py <evaluation_file> [student_name]")
        print("Example: python scripts/3_generate_report.py evaluation_reports/STU_001_evaluation_2025-01-15.json Aditya")
        sys.exit(1)

    evaluation_file = sys.argv[1]
    student_name = sys.argv[2] if len(sys.argv) > 2 else "Student"

    if not Path(evaluation_file).exists():
        print(f"\u2717 Evaluation file not found: {evaluation_file}")
        sys.exit(1)

    generator = ReportGenerator()
    generator.generate(evaluation_file, student_name)
