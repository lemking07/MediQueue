const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(
    path.join(__dirname, "mediqueue.db")
);

// Enable database integrity checks.
db.exec("PRAGMA foreign_keys = ON;");

// Patient accounts
db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

// Patient visit history
db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        department_id INTEGER NOT NULL,
        department_name TEXT NOT NULL,
        queue_number TEXT NOT NULL,
        room_number TEXT,
        queue_issued_at TEXT NOT NULL,
        called_at TEXT,
        completed_at TEXT,
        status TEXT NOT NULL DEFAULT 'waiting',
        FOREIGN KEY (patient_id) REFERENCES patients(id)
    );
`);

db.close();

console.log("MediQueue database initialized successfully!");