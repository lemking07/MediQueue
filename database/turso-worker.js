"use strict";

const { createClient } = require("@libsql/client/http");

function decodePayload(value) {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function splitSqlScript(sql) {
    const statements = [];
    let start = 0;
    let quote = null;
    let escaped = false;

    for (let i = 0; i < sql.length; i += 1) {
        const ch = sql[i];

        if (quote) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === quote) {
                if (sql[i + 1] === quote) {
                    i += 1;
                } else {
                    quote = null;
                }
            }
            continue;
        }

        if (ch === "'" || ch === '"' || ch === "`") {
            quote = ch;
        } else if (ch === ";") {
            const statement = sql.slice(start, i).trim();
            if (statement) statements.push(statement);
            start = i + 1;
        }
    }

    const last = sql.slice(start).trim();
    if (last) statements.push(last);
    return statements;
}

function jsonSafe(value) {
    if (typeof value === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
    if (Array.isArray(value)) return value.map(jsonSafe);
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, item] of Object.entries(value)) out[key] = jsonSafe(item);
        return out;
    }
    return value;
}

async function main() {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
        throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.");
    }

    const payload = decodePayload(process.argv[2]);
    const rawUrl = process.env.TURSO_DATABASE_URL;
    const url = rawUrl.replace(/^libsql:\/\//i, "https://");
    const client = createClient({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    // Transaction commands cannot span multiple short-lived worker processes.
    // The existing application uses them only around small validation/write blocks;
    // individual writes remain atomic in Turso.
    const normalized = String(payload.sql || "").trim();
    if (/^(BEGIN(?:\s+IMMEDIATE)?|COMMIT|ROLLBACK)\s*;?$/i.test(normalized)) {
        return null;
    }

    // PRAGMA is local-connection configuration and is not required for the
    // application schema; ignore the old SQLite foreign-key PRAGMA.
    if (/^PRAGMA\s+foreign_keys\s*=\s*ON\s*;?$/i.test(normalized)) {
        return null;
    }

    if (payload.op === "exec") {
        const statements = splitSqlScript(payload.sql);
        if (!statements.length) return null;
        await client.batch(statements, "write");
        return null;
    }

    const result = await client.execute({
        sql: payload.sql,
        args: Array.isArray(payload.args) ? payload.args : []
    });

    if (payload.op === "get") {
        return result.rows.length ? jsonSafe(result.rows[0]) : undefined;
    }

    if (payload.op === "all") {
        return jsonSafe(result.rows);
    }

    if (payload.op === "run") {
        return jsonSafe({
            changes: Number(result.rowsAffected || 0),
            lastInsertRowid: result.lastInsertRowid == null ? 0 : jsonSafe(result.lastInsertRowid)
        });
    }

    throw new Error(`Unsupported database operation: ${payload.op}`);
}

main()
    .then(result => {
        process.stdout.write(JSON.stringify({ ok: true, result: jsonSafe(result) }));
    })
    .catch(error => {
        process.stderr.write(error && error.stack ? error.stack : String(error));
        process.exitCode = 1;
    });
