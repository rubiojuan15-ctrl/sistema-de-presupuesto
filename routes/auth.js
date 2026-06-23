const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../database/postgres");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
    return EMAIL_RE.test(email);
}

router.post("/login", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const usuario = String(req.body.usuario || "").trim();
    const password = String(req.body.password || "");

    if (!password || (!email && !usuario)) {
        return res.status(400).send("Faltan credenciales o contraseña");
    }

    try {
        const resultado = email
            ? await pool.query(
                  "SELECT id, usuario, email, password FROM usuarios WHERE LOWER(email) = $1",
                  [email]
              )
            : await pool.query(
                  "SELECT id, usuario, email, password FROM usuarios WHERE usuario = $1",
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

        res.json({
            token,
            usuario: row.usuario,
            email: row.email || "",
            id: row.id
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al iniciar sesión");
    }
});

router.post("/registro", async (req, res) => {
    const usuario = String(req.body.usuario || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (usuario.length < 3 || password.length < 6) {
        return res
            .status(400)
            .send("El usuario debe tener 3 caracteres y la contraseña 6");
    }

    if (!email || !isValidEmail(email)) {
        return res.status(400).send("Ingresá un email válido");
    }

    try {
        const existente = await pool.query(
            `
            SELECT usuario, email
            FROM usuarios
            WHERE usuario = $1 OR LOWER(email) = $2
            LIMIT 1
            `,
            [usuario, email]
        );

        if (existente.rowCount > 0) {
            const row = existente.rows[0];
            if (row.usuario === usuario) {
                return res.status(409).send("El usuario ya existe");
            }
            return res.status(409).send("El email ya está registrado");
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query(
            `
            INSERT INTO usuarios (usuario, email, password)
            VALUES ($1, $2, $3)
            `,
            [usuario, email, passwordHash]
        );

        res.status(201).send("Usuario creado");
    } catch (error) {
        console.error(error);
        const detalle = error.code === "42703"
            ? "Falta actualizar la base de datos (columna email)"
            : "Error al crear el usuario";
        res.status(500).send(detalle);
    }
});

module.exports = router;
