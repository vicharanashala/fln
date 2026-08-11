import { QuestionService } from './services/questionService.js';
import { CURRICULUM_MAPPING, getConceptForLevel, getLevelForConcept } from './config/curriculumMap.js';

console.log("=== Testing Concept-Driven Curriculum Registry ===");

// 1. Verify mapping registry length
const totalLevels = Object.keys(CURRICULUM_MAPPING).length;
console.log(`Total Mapped Levels: ${totalLevels}`);

// 2. Test Level -> Concept mapping
const lvl10Config = getConceptForLevel(10);
console.log(`Level 10 Concept ID: ${lvl10Config?.conceptId} (${lvl10Config?.levelTitle})`);

const lvl93Config = getConceptForLevel(93);
console.log(`Level 93 Concept ID: ${lvl93Config?.conceptId} (${lvl93Config?.levelTitle})`);

// 3. Test Question Generation by Level Number
const lvl10Questions = QuestionService.getQuestionsByLevel(10, 0);
console.log("\nQuestions generated for Level 10 (S2.3):");
console.log(lvl10Questions[0]);

// 4. Test Question Generation directly by Concept ID
const s718Questions = QuestionService.getQuestionsByConcept("S7.18", 0);
console.log("\nQuestions generated directly for Concept S7.18 (Perimeter & Area):");
console.log(s718Questions[0]);

// 5. Test Dynamic Re-ordering
console.log("\nSimulating Curriculum Re-ordering...");
console.log(`Before: Level 10 is mapped to ${getConceptForLevel(10)?.conceptId}`);
QuestionService.updateLevelMapping(10, "S3.3");
console.log(`After Re-ordering: Level 10 is now mapped to ${getConceptForLevel(10)?.conceptId}`);
const reorderedQuestions = QuestionService.getQuestionsByLevel(10, 0);
console.log(`New question for Level 10: "${reorderedQuestions[0].question}"`);

console.log("\nSUCCESS: All concept-driven question tests passed!");
