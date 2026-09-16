import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI!;
const HTML_DIR = path.resolve(__dirname, '../../FLN SVG HTML files(22-59)');

function parseLevelNumber(fileName: string): number {
  const match = fileName.match(/level(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseTitle(htmlContent: string): string {
  const match = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
}

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  const db = client.db();
  console.log('Connected.\n');

  const files = fs.readdirSync(HTML_DIR).filter(f => f.endsWith('.html')).sort();
  console.log(`Found ${files.length} HTML files in ${HTML_DIR}\n`);

  const templates = files.map(fileName => {
    const filePath = path.join(HTML_DIR, fileName);
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const levelNumber = parseLevelNumber(fileName);
    const title = parseTitle(htmlContent) || `Level ${levelNumber}`;
    return {
      levelNumber,
      title,
      fileName,
      htmlContent,
      createdAt: new Date().toISOString(),
    };
  });

  const coll = db.collection('levelHtmlTemplates');
  await coll.deleteMany({});
  console.log('Cleared existing levelHtmlTemplates.');

  const result = await coll.insertMany(templates);
  console.log(`Inserted ${result.insertedCount} level HTML templates into MongoDB.`);

  await coll.createIndex({ levelNumber: 1 }, { unique: true });
  console.log('Created unique index on levelNumber.');

  for (const t of templates) {
    console.log(`  Level ${String(t.levelNumber).padStart(2, ' ')}: ${t.title} (${t.fileName})`);
  }

  await client.close();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
