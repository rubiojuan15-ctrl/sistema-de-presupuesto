console.log("AUTH NUEVO");

const express = require("express");

const router = express.Router();

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const db = require("../database/db");
router.post("/login", (req, res) => {

    const {
        usuario,
        password
    } = req.body;

    db.get(
        `
        SELECT *
        FROM usuarios
        WHERE usuario = ?
        `,
        [usuario],
        async (err, row) => {

            if (err || !row) {

                return res
                    .status(401)
                    .send("Incorrecto");

            }

            const correcta =
                await bcrypt.compare(
                    password,
                    row.password
                );

            if (!correcta) {

                return res
                    .status(401)
                    .send("Incorrecto");

            }

            const token = jwt.sign(
                {
                    id: row.id
                },

                "secreto123",

                {
                    expiresIn: "7d"
                }

            );
            res.json({

                token,

                usuario: row.usuario,

                id: row.id

            });
            
        }
    );

});
router.post("/registro", async (req, res) => {

    const {
        usuario,
        password
    } = req.body;

    const passwordHash =
        await bcrypt.hash(password, 10);

    db.run(
        `
        INSERT INTO usuarios
        (
            usuario,
            password
        )
        VALUES (?, ?)
        `,
        [
            usuario,
            passwordHash
        ],
        function(err) {

            if (err) {

                return res
                    .status(500)
                    .send("Error");

            }

            res.send("Usuario creado");

        }
    );

});
module.exports = router;