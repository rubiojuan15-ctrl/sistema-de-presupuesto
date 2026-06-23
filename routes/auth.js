const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../database/postgres");

const router = express.Router();

router.post("/login", async (req, res) => {
    const usuario = String(req.body.usuario || "").trim();
    const password = String(req.body.password || "");

    if (!usuario || !password) {
        return res.status(400).send("Faltan usuario o contraseña");
    }

    try {
        const resultado = await pool.query(
            "SELECT id, usuario, password FROM usuarios WHERE usuario = $1",
            [usuario]
        );
        const row = resultado.rows[0];

        if (!row || !(await bcrypt.compare(password, row.password))) {
            return res.status(401).send("Usuario o contraseña incorrectos");
        }

        const token = jwt.sign(
            { id: row.id },
            process.env.JWT_SECRET || "secreto123",
            { expiresIn: "7d" }
        );

        res.json({ token, usuario: row.usuario, id: row.id });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al iniciar sesión");
    }
});

router.post("/registro", async (req, res) => {
    const usuario = String(req.body.usuario || "").trim();
    const password = String(req.body.password || "");

    if (usuario.length < 3 || password.length < 6) {
        return res
            .status(400)
            .send("El usuario debe tener 3 caracteres y la contraseña 6");
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const resultado = await pool.query(
            `
            INSERT INTO usuarios (usuario, password)
            VALUES ($1, $2)
            ON CONFLICT (usuario) DO NOTHING
            RETURNING id
            `,
            [usuario, passwordHash]
        );

        if (resultado.rowCount === 0) {
            return res.status(409).send("El usuario ya existe");
        }

        res.status(201).send("Usuario creado");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al crear el usuario");
    }
});

module.exports = router;
