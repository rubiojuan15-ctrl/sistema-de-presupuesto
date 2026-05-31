const sqlite3 =
    require("sqlite3").verbose();

const db =
    new sqlite3.Database(
        "presupuestos.db"
    );
db.run(`
ALTER TABLE presupuestos
ADD COLUMN sena INTEGER DEFAULT 0
`, () => {});

db.run(`
ALTER TABLE presupuestos
ADD COLUMN saldo INTEGER DEFAULT 0
`, () => {});
module.exports = db;