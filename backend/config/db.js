const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Define the directory and database file path
const dbDir = path.resolve(__dirname, '../database');
const dbPath = path.join(dbDir, 'mydb.sqlite');

// Check if the directory exists, and create it if it doesn't
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created directory: ${dbDir}`);
}

// Connect or create the SQLite database file
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database.');
  }
});

module.exports = db;