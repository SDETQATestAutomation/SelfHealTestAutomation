const db = require('../config/db');
// On application start, ensure a 'users' table exists
db.run(
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )`,
  (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    }
  }
);

class User {
  static create(email, password) {
    return new Promise((resolve, reject) => {
      const query = `INSERT INTO users (email, password) VALUES (?, ?)`;
      db.run(query, [email, password], function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });
  }

  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM users WHERE email = ?`;
      db.get(query, [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
}

module.exports = User;