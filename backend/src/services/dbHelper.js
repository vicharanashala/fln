const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data/db.json');
const BACKUP_PATH = path.resolve(__dirname, '../../data/db.json.bak');

// Back up the database file on first import if no backup exists
if (fs.existsSync(DB_PATH) && !fs.existsSync(BACKUP_PATH)) {
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
}

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      if (fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(BACKUP_PATH, DB_PATH);
      } else {
        return { users: [], schools: [], students: [], worksheets: [], evaluationReports: [], announcements: [], logs: [] };
      }
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { users: [], schools: [], students: [], worksheets: [], evaluationReports: [], announcements: [], logs: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

function resetDb() {
  try {
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, DB_PATH);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error resetting db.json:', err);
    return false;
  }
}

module.exports = {
  readDb,
  writeDb,
  resetDb
};
