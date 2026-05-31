const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("Sistema de presupuestos");
});

app.listen(3000, () => {
    console.log("Servidor corriendo en puerto 3000");
});

let presupuesto = {
    cliente: "Juan",
    trabajo: "restauracion de mueble",
    materiales: 55000,
    manodeobra: 15000
};

let presupuestoJSON = JSON.stringify(presupuesto);

let presupuestos = [];

presupuestos.push({
    cliente: "Juan",
    trabajo: "restauracion de mueble",
    total: 70000
});

presupuestos.push({
    cliente: "Ana",
    trabajo: "tapizado de sillas",
    total: 35000
});

function calcularpresupuesto(materiales, manodeobra) {

    let subtotal = materiales + manodeobra;

    let ganancia = subtotal * 0.3;

    let total = subtotal + ganancia;

    return total;
}

let total = calcularpresupuesto(55000, 15000);

console.log(presupuesto.cliente);
console.log(presupuesto.trabajo);

console.log(total);

console.log(presupuestoJSON);

console.log(presupuestos);