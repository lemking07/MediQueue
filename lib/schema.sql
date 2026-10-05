CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL, department_id INTEGER NOT NULL, department_name TEXT NOT NULL, queue_number TEXT NOT NULL, room_number TEXT, queue_issued_at TEXT NOT NULL, called_at TEXT, completed_at TEXT, status TEXT NOT NULL DEFAULT 'waiting', FOREIGN KEY(patient_id) REFERENCES patients(id));

CREATE TABLE IF NOT EXISTS app_sessions (sid TEXT PRIMARY KEY,data TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS app_sessions_expiry ON app_sessions(expires_at);
CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS queue_state (id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS staff_accounts (id INTEGER PRIMARY KEY, staff_id TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff', approved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS staff_shifts (id INTEGER PRIMARY KEY, staff_id INTEGER NOT NULL, clock_in TEXT NOT NULL, clock_out TEXT, FOREIGN KEY(staff_id) REFERENCES staff_accounts(id));
CREATE TABLE IF NOT EXISTS staff_actions (id INTEGER PRIMARY KEY, staff_id INTEGER NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', happened_at TEXT NOT NULL, FOREIGN KEY(staff_id) REFERENCES staff_accounts(id));

CREATE TABLE IF NOT EXISTS staff_department_permissions (
 staff_account_id INTEGER NOT NULL,
 department_id INTEGER NOT NULL,
 PRIMARY KEY(staff_account_id,department_id),
 FOREIGN KEY(staff_account_id) REFERENCES staff_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointment_slots (
 id INTEGER PRIMARY KEY AUTOINCREMENT, department_id INTEGER NOT NULL, appointment_date TEXT NOT NULL,
 appointment_time TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 100),
 created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(department_id,appointment_date,appointment_time));
CREATE TABLE IF NOT EXISTS appointments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, slot_id INTEGER NOT NULL REFERENCES appointment_slots(id),
 patient_id INTEGER NOT NULL REFERENCES patients(id), status TEXT NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','confirmed','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS appointment_patient_idx ON appointments(patient_id,created_at);
CREATE INDEX IF NOT EXISTS appointment_slot_idx ON appointments(slot_id,status);
