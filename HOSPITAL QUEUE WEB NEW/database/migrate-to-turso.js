"use strict";

const path = require("node:path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const { DatabaseSync } = require("node:sqlite");
const { createClient } = require("@libsql/client");

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN.");
    process.exit(1);
}

const local = new DatabaseSync(path.join(__dirname, "mediqueue.db"));
const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

const schema = [
    `CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL, department_id INTEGER NOT NULL, department_name TEXT NOT NULL, queue_number TEXT NOT NULL, room_number TEXT, queue_issued_at TEXT NOT NULL, called_at TEXT, completed_at TEXT, status TEXT NOT NULL DEFAULT 'waiting', FOREIGN KEY(patient_id) REFERENCES patients(id))`,
    `CREATE TABLE IF NOT EXISTS staff_accounts (id INTEGER PRIMARY KEY, staff_id TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff', approved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS staff_shifts (id INTEGER PRIMARY KEY, staff_id INTEGER NOT NULL, clock_in TEXT NOT NULL, clock_out TEXT, FOREIGN KEY(staff_id) REFERENCES staff_accounts(id))`,
    `CREATE TABLE IF NOT EXISTS staff_actions (id INTEGER PRIMARY KEY, staff_id INTEGER NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', happened_at TEXT NOT NULL, FOREIGN KEY(staff_id) REFERENCES staff_accounts(id))`,
    `CREATE TABLE IF NOT EXISTS staff_department_permissions (staff_account_id INTEGER NOT NULL, department_id INTEGER NOT NULL, PRIMARY KEY(staff_account_id,department_id), FOREIGN KEY(staff_account_id) REFERENCES staff_accounts(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS appointment_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, department_id INTEGER NOT NULL, appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 100), created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(department_id,appointment_date,appointment_time))`,
    `CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, slot_id INTEGER NOT NULL REFERENCES appointment_slots(id), patient_id INTEGER NOT NULL REFERENCES patients(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
];

const tables = [
    ["patients", ["id", "full_name", "username", "password_hash", "created_at"]],
    ["staff_accounts", ["id", "staff_id", "full_name", "username", "password_hash", "role", "approved", "created_at"]],
    ["staff_shifts", ["id", "staff_id", "clock_in", "clock_out"]],
    ["staff_actions", ["id", "staff_id", "action", "details", "happened_at"]],
    ["staff_department_permissions", ["staff_account_id", "department_id"]],
    ["visits", ["id", "patient_id", "department_id", "department_name", "queue_number", "room_number", "queue_issued_at", "called_at", "completed_at", "status"]],
    ["appointment_slots", ["id", "department_id", "appointment_date", "appointment_time", "capacity", "created_by", "created_at"]],
    ["appointments", ["id", "slot_id", "patient_id", "status", "created_at", "updated_at"]]
];

async function main() {
    // Stop if any destination table already contains data.
    for (const [table] of tables) {
        const existing = await turso.execute(`SELECT COUNT(*) AS count FROM ${table}`);
        if (Number(existing.rows[0].count) > 0) {
            throw new Error(`Turso table '${table}' is not empty. Migration stopped to avoid duplicates.`);
        }
    }

    await turso.batch(schema, "write");

    const statements = [];
    for (const [table, columns] of tables) {
        const rows = local.prepare(`SELECT ${columns.join(",")} FROM ${table}`).all();
        if (!rows.length) continue;

        const placeholders = columns.map(() => "?").join(",");
        const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`;
        for (const row of rows) {
            statements.push([sql, columns.map(column => row[column] ?? null)]);
        }
        console.log(`Prepared ${rows.length} ${table} row(s).`);
    }

    if (statements.length) {
        await turso.batch(statements, "write");
    }

    console.log("Migration completed successfully.");
}

main()
    .catch(error => {
        console.error("Migration failed:", error.message || error);
        process.exitCode = 1;
    })
    .finally(() => local.close());
