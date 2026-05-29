const pool = require("./database/postgres");

async function test() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log(result.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();