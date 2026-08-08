import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { dbStore } from '../db';
import { ExamBlueprint } from '../models/ExamBlueprint.model';

export async function parseAndSeedBlueprints() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    console.log("Mongoose not connected to MongoDB. Skipping database content ingestion parser.");
    return;
  }
  console.log("=== STARTING AUTOMATED CONTENT INGESTION PARSER ===");
  
  let levelsDir = path.resolve(process.cwd(), 'FLN Levels Structure');
  try {
    await fs.access(levelsDir);
  } catch {
    levelsDir = path.resolve(process.cwd(), '..', 'FLN Levels Structure');
  }
  
  try {
    const dirs = await fs.readdir(levelsDir);
    const targetLevels = dirs.filter(d => d.startsWith('Level 1_') || d.startsWith('Level 2_'));
    
    console.log(`Found target level folders for parsing:`, targetLevels);
    
    const worksheets = await dbStore.getWorksheets();
    
    for (const ws of worksheets) {
      if (!ws.questions) continue;
      
      for (let i = 0; i < ws.questions.length; i++) {
        const q = ws.questions[i];
        const qNo = i + 1;
        
        let blueprintData: any = null;
        
        // Fields now strictly match the Part 4 Schema Discriminators
        if (q.source_level === 1) {
          blueprintData = {
            questionNum: qNo,
            concept: 'Quantity Comparison',
            explanation: 'Identify the larger numeric value.',
            type: 'NUMERIC', // Uppercase match
            templateText: 'Compare the quantities: Is {a} greater than {b}?',
            variableConstraints: {
              a: { min: 1, max: 15 },
              b: { min: 1, max: 15 }
            }
          };
        } else if (q.source_level === 2) {
          blueprintData = {
            questionNum: qNo,
            concept: 'Odd One Out',
            explanation: 'Find the element that does not belong to the semantic group.',
            type: 'MATRIX', // Uppercase match
            templateText: 'Identify the odd one out from the group.',
            matrixArrays: {
              targetGroup: ['apple', 'banana', 'orange', 'mango'],
              foilGroup: ['chair', 'table', 'desk', 'bed']
            }
          };
        }
        
        if (blueprintData) {
          try {
            // Find parent document and upsert into subdocument array securely
            await ExamBlueprint.findOneAndUpdate(
              { examId: ws.id },
              { $pull: { questions: { questionNum: qNo } } } // Evict old copies
            ).exec();

            await ExamBlueprint.findOneAndUpdate(
              { examId: ws.id },
              { 
                $setOnInsert: { id: `eb_${ws.id}` },
                $set: { examName: ws.cycle || 'Standard Exam' },
                $push: { questions: blueprintData } 
              },
              { upsert: true, new: true }
            ).exec();
            
            console.log(`Seeded rule map for Worksheet ${ws.id} Q#${qNo} (Level ${q.source_level})`);
          } catch (dbErr: any) {
            console.error(`Failed to upsert blueprint rule for Q#${qNo}:`, dbErr.message);
          }
        }
      }
    }
    console.log("=== INGESTION SEEDING COMPLETED ===");
  } catch (err: any) {
    console.error("Content Ingestion Parser failed:", err.message);
  }
}
