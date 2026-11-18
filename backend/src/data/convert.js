import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Paths point directly inside the current 'data' folder
const jsonPath = path.join(__dirname, 'question_bank_seed.json');
const csvPath = path.join(__dirname, 'question_template.csv');

// 3. Check if the seed file is accessible
if (!fs.existsSync(jsonPath)) {
    console.error(`Error: Target file not found at:\n${jsonPath}`);
    process.exit(1);
}

// 4. Read and parse the target JSON file
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// 5. Define all expected column headers
const headers = [
    "question_id", "question", "answer", "answer_type", "choices",
    "topic", "subtopic", "difficulty", "source_level", 
    "representation", "context", "subskills"
];

let csvContent = headers.join(',') + '\n';

// 6. Extract and transform items into rows
data.forEach(row => {
    const values = headers.map(header => {
        let value = row[header];
        
        if (value === undefined || value === null) {
            value = '';
        }
        
        if (Array.isArray(value)) {
            value = value.join('|');
        }
        
        let stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
    });
    
    csvContent += values.join(',') + '\n';
});

// 7. Write the final file out
fs.writeFileSync(csvPath, csvContent, 'utf8');

console.log("Successfully generated question_template.csv!");
