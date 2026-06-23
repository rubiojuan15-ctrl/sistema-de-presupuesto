const path = require("path");
const sqlite3 = require("sqlite3").verbose();

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const pool = require("../database/postgres");
const ensureSchema = require("../database/schema");

const sqlitePath = path.resolve(
    process.argv.find((arg) => arg.endsWith(".db")) ||
        path.join(__dirname, "..", "presupuestos.db")
);
const dryRun = process.argv.includes("--dry-run");

function openSqlite(filename) {
    return new sqlite3.Database(filename, sqlite3.OPEN_READONLY);
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) reject(error);
            else resolve(rows);
        });
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function money(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

function normalizeBudget(row, mappedUserId) {
    const total = Math.max(0, money(row.total));
    let sena = Math.max(0, Math.min(total, money(row.sena)));
    let saldo = Math.max(0, total - sena);
    const estado = row.estado === "Cobrado" ? "Cobrado total" : row.estado;

    if (estado === "Cobrado total") {
        sena = total;
        saldo = 0;
    }

    return {
        cliente: row.cliente || "",
        telefono: row.telefono || "",
        direccion: row.direccion || "",
        trabajo: row.trabajo || "",
        observaciones: row.observaciones || "",
        materiales: Math.max(0, money(row.materiales)),
        manoDeObra: Math.max(0, money(row.manoDeObra)),
        total,
        sena,
        saldo,
        fecha: row.fecha || "",
        fechaVencimiento: row.fechaVencimiento || "",
        estado: estado || "Pendiente",
        imagenes: row.imagenes || "",
        usuarioId: mappedUserId || null
    };
}

async function migrate() {
    const sqlite = openSqlite(sqlitePath);
    const client = await pool.connect();
    const report = {
        sqlitePath,
        dryRun,
        usuarios: { inserted: 0, reused: 0 },
        presupuestos: { inserted: 0, reused: 0 },
        pagos: { inserted: 0, reused: 0, preservedOrphans: 0 },
        gastos: { inserted: 0, reused: 0 }
    };

    try {
        const [usuarios, presupuestos, pagos, gastos] = await Promise.all([
            all(sqlite, "SELECT * FROM usuarios ORDER BY id"),
            all(sqlite, "SELECT * FROM presupuestos ORDER BY id"),
            all(sqlite, "SELECT * FROM pagos ORDER BY id"),
            all(sqlite, "SELECT * FROM gastos ORDER BY id")
        ]);

        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [872341]);
        await ensureSchema(client);

        const userMap = new Map();
        for (const user of usuarios) {
            const username = String(user.usuario || "").trim();
            if (!username || !user.password) continue;

            const existing = await client.query(
                "SELECT id FROM usuarios WHERE usuario = $1",
                [username]
            );
            let id;
            if (existing.rowCount > 0) {
                id = existing.rows[0].id;
                report.usuarios.reused += 1;
            } else {
                const inserted = await client.query(
                    `
                    INSERT INTO usuarios (usuario, password)
                    VALUES ($1, $2)
                    RETURNING id
                    `,
                    [username, user.password]
                );
                id = inserted.rows[0].id;
                report.usuarios.inserted += 1;
            }
            userMap.set(user.id, id);
        }

        const budgetMap = new Map();
        for (const source of presupuestos) {
            const budget = normalizeBudget(source, userMap.get(source.usuarioId));
            const values = [
                budget.cliente,
                budget.telefono,
                budget.direccion,
                budget.trabajo,
                budget.observaciones,
                budget.materiales,
                budget.manoDeObra,
                budget.total,
                budget.sena,
                budget.saldo,
                budget.fecha,
                budget.fechaVencimiento,
                budget.estado,
                budget.imagenes,
                budget.usuarioId
            ];
            const existing = await client.query(
                `
                SELECT id
                FROM presupuestos
                WHERE cliente IS NOT DISTINCT FROM $1
                  AND telefono IS NOT DISTINCT FROM $2
                  AND direccion IS NOT DISTINCT FROM $3
                  AND trabajo IS NOT DISTINCT FROM $4
                  AND observaciones IS NOT DISTINCT FROM $5
                  AND materiales IS NOT DISTINCT FROM $6
                  AND manodeobra IS NOT DISTINCT FROM $7
                  AND total IS NOT DISTINCT FROM $8
                  AND sena IS NOT DISTINCT FROM $9
                  AND saldo IS NOT DISTINCT FROM $10
                  AND fecha IS NOT DISTINCT FROM $11
                  AND fechavencimiento IS NOT DISTINCT FROM $12
                  AND estado IS NOT DISTINCT FROM $13
                  AND imagenes IS NOT DISTINCT FROM $14
                  AND usuarioid IS NOT DISTINCT FROM $15
                LIMIT 1
                `,
                values
            );
            let id;
            if (existing.rowCount > 0) {
                id = existing.rows[0].id;
                report.presupuestos.reused += 1;
            } else {
                const inserted = await client.query(
                    `
                    INSERT INTO presupuestos (
                        cliente, telefono, direccion, trabajo, observaciones,
                        materiales, manodeobra, total, sena, saldo, fecha,
                        fechavencimiento, estado, imagenes, usuarioid
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15
                    )
                    RETURNING id
                    `,
                    values
                );
                id = inserted.rows[0].id;
                report.presupuestos.inserted += 1;
            }
            budgetMap.set(source.id, id);
        }

        for (const payment of pagos) {
            const budgetId = budgetMap.get(payment.presupuestoId);
            if (!budgetId) {
                await client.query(
                    `
                    INSERT INTO pagos_huerfanos_migracion (
                        sqlite_pago_id,
                        sqlite_presupuesto_id,
                        fecha,
                        monto,
                        motivo
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (sqlite_pago_id, sqlite_presupuesto_id)
                    DO NOTHING
                    `,
                    [
                        payment.id,
                        payment.presupuestoId,
                        payment.fecha || "",
                        money(payment.monto),
                        "El presupuesto referido ya no existe en SQLite"
                    ]
                );
                report.pagos.preservedOrphans += 1;
                continue;
            }
            const amount = money(payment.monto);
            const existing = await client.query(
                `
                SELECT id FROM pagos
                WHERE presupuestoid = $1 AND fecha = $2 AND monto = $3
                LIMIT 1
                `,
                [budgetId, payment.fecha || "", amount]
            );
            if (existing.rowCount > 0) {
                report.pagos.reused += 1;
            } else if (amount > 0) {
                await client.query(
                    `
                    INSERT INTO pagos (presupuestoid, fecha, monto)
                    VALUES ($1, $2, $3)
                    `,
                    [budgetId, payment.fecha || "", amount]
                );
                report.pagos.inserted += 1;
            } else {
                await client.query(
                    `
                    INSERT INTO pagos_huerfanos_migracion (
                        sqlite_pago_id,
                        sqlite_presupuesto_id,
                        fecha,
                        monto,
                        motivo
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (sqlite_pago_id, sqlite_presupuesto_id)
                    DO NOTHING
                    `,
                    [
                        payment.id,
                        payment.presupuestoId,
                        payment.fecha || "",
                        amount,
                        "El pago no tiene un monto positivo"
                    ]
                );
                report.pagos.preservedOrphans += 1;
            }
        }

        for (const expense of gastos) {
            const userId = userMap.get(expense.usuarioId) || null;
            const amount = Math.max(0, money(expense.monto));
            const values = [
                expense.fecha || "",
                expense.concepto || "",
                amount,
                userId
            ];
            const existing = await client.query(
                `
                SELECT id FROM gastos
                WHERE fecha IS NOT DISTINCT FROM $1
                  AND concepto IS NOT DISTINCT FROM $2
                  AND monto IS NOT DISTINCT FROM $3
                  AND usuarioid IS NOT DISTINCT FROM $4
                LIMIT 1
                `,
                values
            );
            if (existing.rowCount > 0) {
                report.gastos.reused += 1;
            } else {
                await client.query(
                    `
                    INSERT INTO gastos (fecha, concepto, monto, usuarioid)
                    VALUES ($1, $2, $3, $4)
                    `,
                    values
                );
                report.gastos.inserted += 1;
            }
        }

        for (const table of ["usuarios", "presupuestos", "pagos", "gastos"]) {
            await client.query(
                `
                SELECT setval(
                    pg_get_serial_sequence($1, 'id'),
                    COALESCE((SELECT MAX(id) FROM ${table}), 1),
                    true
                )
                `,
                [table]
            );
        }

        if (dryRun) {
            await client.query("ROLLBACK");
        } else {
            await client.query("COMMIT");
        }

        console.log(JSON.stringify(report, null, 2));
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        await close(sqlite);
        client.release();
        await pool.end();
    }
}

migrate().catch((error) => {
    console.error("La migración falló:", error);
    process.exitCode = 1;
});
