"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

class TursoSyncDatabase {
    constructor(projectDir) {
        this.projectDir = projectDir;
        this.worker = path.join(projectDir, "database", "turso-worker.js");
    }

    _call(payload) {
        const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
        const result = spawnSync(process.execPath, [this.worker, encoded], {
            cwd: this.projectDir,
            env: process.env,
            encoding: "utf8",
            maxBuffer: 16 * 1024 * 1024
        });

        if (result.error) throw result.error;
        if (result.status !== 0) {
            const message = (result.stderr || result.stdout || "Turso database operation failed.").trim();
            throw new Error(message);
        }

        let parsed;
        try {
            parsed = JSON.parse(result.stdout || "{}");
        } catch (error) {
            throw new Error(`Invalid response from Turso worker: ${result.stdout || error.message}`);
        }

        if (!parsed.ok) throw new Error(parsed.error || "Turso database operation failed.");
        return parsed.result;
    }

    exec(sql) {
        return this._call({ op: "exec", sql });
    }

    prepare(sql) {
        return new TursoStatement(this, sql);
    }
}

class TursoStatement {
    constructor(db, sql) {
        this.db = db;
        this.sql = sql;
    }

    get(...args) {
        return this.db._call({ op: "get", sql: this.sql, args });
    }

    all(...args) {
        return this.db._call({ op: "all", sql: this.sql, args });
    }

    run(...args) {
        return this.db._call({ op: "run", sql: this.sql, args });
    }
}

function createSyncDatabase(projectDir) {
    return new TursoSyncDatabase(projectDir);
}

module.exports = { createSyncDatabase };
