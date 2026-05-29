const db =
require("../database/db");

const {
    presupuestos
} = require(
    "../services/presupuestosService"
);

function obtenerPresupuestos(
    usuarioId,
    busqueda,
    estado,
    callback
) {

    db.all(
        `
        SELECT *
        FROM presupuestos
        WHERE usuarioId = ?
        AND
        (
            cliente LIKE ?
            OR trabajo LIKE ?
        )
        AND estado LIKE ?
        ORDER BY id DESC
        `,
        [
            usuarioId,
            "%" + busqueda + "%",
            "%" + busqueda + "%",
            "%" + estado + "%"
        ],
        callback
    );

}

module.exports = {

    obtenerPresupuestos

};