const Filesystem = window.Capacitor?.Plugins?.Filesystem;

const sistema = document.getElementById("sistema");
const API = "https://sistema-de-presupuesto.onrender.com";
const busqueda = document.getElementById("busqueda");
const cliente = document.getElementById("cliente");
const telefono = document.getElementById("telefono");
const direccion = document.getElementById("direccion");
const imagen = document.getElementById("imagen");
const trabajo = document.getElementById("trabajo");
const observaciones = document.getElementById("observaciones");
const fechaVencimiento = document.getElementById("fechaVencimiento");

const materiales = document.getElementById("materiales");

const manoDeObra = document.getElementById("manoDeObra");

const total = document.getElementById("total");

const sena = document.getElementById("sena");

const saldo = document.getElementById("saldo");

const lista = document.getElementById("lista");

const estado = document.getElementById("estado");

const filtroEstado = document.getElementById("filtroEstado");
const filtroVencimiento = document.getElementById("filtroVencimiento");

const usuario =
    document.getElementById("usuario");

const email =
    document.getElementById("email");

const password =
    document.getElementById("password");

let idEditando = null;
let grafico = null;
let graficoMensual = null;

const totalFacturado =
    document.getElementById("totalFacturado");

const cantidadPresupuestos =
    document.getElementById("cantidadPresupuestos");

const promedio =
    document.getElementById("promedio");

const cantidadPendientes = document.getElementById("cantidadPendientes");


function token() {

    return localStorage.getItem("token") || "";

}
function calcularTotal() {

    let resultado =
        Number(materiales.value) +
        Number(manoDeObra.value);

    let valorSena =
        Number(sena.value) || 0;

    let saldoPendiente =
        resultado - valorSena;

    total.innerText =
        "Total: $" + resultado;

    saldo.innerText =
        "Saldo: $" + saldoPendiente;

    return resultado;
}

materiales.addEventListener("input", calcularTotal);

manoDeObra.addEventListener("input", calcularTotal);

sena.addEventListener("input", calcularTotal);

busqueda.addEventListener(
    "input",
    cargarPresupuestos
);

filtroEstado.addEventListener(
    "change",
    cargarPresupuestos
);

filtroVencimiento.addEventListener(
    "change",
    cargarPresupuestos
);
function limpiarFormulario() {

    cliente.value = "";
    telefono.value = "";
    direccion.value = "";
    trabajo.value = "";
    observaciones.value = "";
    fechaVencimiento.value = "";

    materiales.value = "";
    manoDeObra.value = "";
    sena.value = "";

    estado.value = "Pendiente";

    imagen.value = "";

    total.innerText = "Total: $0";
    saldo.innerText = "Saldo: $0";

    idEditando = null;

}
//guardar presupuestos
async function guardarPresupuesto() {
    if (
        cliente.value === "" ||
        trabajo.value === "" ||
        materiales.value === "" ||
        manoDeObra.value === ""
    ) {
            alert("Completa todos los campos");
            return;
        }
    const formData = new FormData();

        formData.append(
            "cliente",
            cliente.value
        );

        formData.append(
            "telefono",
            telefono.value
        );

        formData.append(
            "direccion",
            direccion.value
        );

        formData.append(
            "trabajo",
            trabajo.value
        );

        formData.append(
            "observaciones",
            observaciones.value
        );

        formData.append(
            "materiales",
            materiales.value
        );

        formData.append(
            "manoDeObra",
            manoDeObra.value
        );

        formData.append(
            "total",
            calcularTotal()
        );

        formData.append(
            "fecha",
            new Date().toLocaleDateString()
        );

        formData.append(
            "fechaVencimiento",
            fechaVencimiento.value
        );

        formData.append(
            "estado",
            estado.value
        );
        formData.append(
            "sena",
            sena.value || 0
        );

        formData.append(
            "saldo",
            calcularTotal() -
            (Number(sena.value) || 0)
        );
        
        
        console.log(imagen.files);
       for (let file of imagen.files) {        
        formData.append(
            "imagen",
            file
        );

    }
    if (idEditando) {
        

    const respuesta = await fetch(API + "/presupuestos/editar-presupuesto/" + idEditando, {

        method: "PUT",

        headers: {
            "Content-Type": "application/json",
            authorization: token()
        },
            //PUT
        body: JSON.stringify({

            cliente: cliente.value,

            telefono: telefono.value,

            direccion: direccion.value,

            trabajo: trabajo.value,

            observaciones: observaciones.value,

            materiales: materiales.value,

            manoDeObra: manoDeObra.value,

            total: calcularTotal(),

            sena: sena.value || 0,

            saldo: calcularTotal() - (Number(sena.value) || 0),

            fecha: new Date().toLocaleDateString(),

            fechaVencimiento: fechaVencimiento.value,

            estado: estado.value

        })
    });
      if (!respuesta.ok) {
            alert ("Error al editar")
            return;
        }
        alert("Presupuesto actualizado");
        idEditando = null;
        limpiarFormulario();
    }     
    else {

        const respuesta = await fetch(API + "/presupuestos/guardar-presupuesto", {

            method: "POST",
             headers: {

            authorization:
                localStorage.getItem(
                    "token"
                )

        },
            body: formData

        });
        if (!respuesta.ok) {
            alert(await respuesta.text() || "Error al guardar");
            return;
        }
        alert("Presupuesto guardado");
    }
    limpiarFormulario();
    cargarPresupuestos();
    cargarResumenGastos();
    cargarGastos();
    cargarResumenMensual();
}

//cargar presupuestos
async function cargarPresupuestos() {

    const respuesta = await fetch(API + "/presupuestos/obtener-presupuestos?busqueda=" +

        busqueda.value +
        
        "&estado=" +

        filtroEstado.value +

        "&vencimiento=" +

        filtroVencimiento.value +

            "&usuarioId=" +

        localStorage.getItem(
            "usuarioId"
        ),
        {
            headers: {
                authorization: token()
            }
        }
    );

    if (!respuesta.ok) {
        if (respuesta.status === 401) {
            logout();
        }
        return;
    }

    const presupuestos = await respuesta.json();
    
    const hoy = new Date();

            const mesActual =
                hoy.getMonth() + 1;

            const anioActual =
                hoy.getFullYear();

            const facturacionMes =
                presupuestos
                    .filter(p => {

            if (!p.fecha) return false;

            const partes =
                p.fecha.split("/");

            const mes =
                Number(partes[1]);

            const anio =
                Number(partes[2]);

            return (
                mes === mesActual &&
                anio === anioActual
            );

        })
        .reduce(
            (total, p) =>
                total + Number(p.total || 0),
            0
        );

document.getElementById("facturacionMes").textContent = "$" +
    facturacionMes.toLocaleString(
        "es-AR"
    );
    
    const clientes = {};

        presupuestos.forEach(p => {

            if (!p.cliente) return;

            if (!clientes[p.cliente]) {

                clientes[p.cliente] = 0;

            }

            clientes[p.cliente] += Number(
                p.total || 0
            );

        });

        let mejorCliente = "-";
        let mayorMonto = 0;

        Object.entries(clientes).forEach(

            ([cliente, monto]) => {

                if (monto > mayorMonto) {

                    mayorMonto = monto;
                    mejorCliente = cliente;

                }

            }

        );
        console.log(document.getElementById("mejorCliente")
);
        document.getElementById("mejorCliente").textContent = mejorCliente;
        document.getElementById("montoMejorCliente").textContent = "$" + mayorMonto.toLocaleString("es-AR");
        const meses = {};

            presupuestos.forEach(p => {

                if (!p.fecha) return;

                const partes = p.fecha.split("/");

                const clave =
                    partes[1] + "/" + partes[2];

                if (!meses[clave]) {

                    meses[clave] = 0;

                }

                meses[clave] += Number(
                    p.total || 0
                );

            });

            let mejorMes = "-";
            let mayorFacturacion = 0;

            Object.entries(meses).forEach(

                ([mes, monto]) => {

                    if (monto > mayorFacturacion) {

                        mayorFacturacion = monto;
                        mejorMes = mes;

                    }

                }

            );

            document.getElementById(
                "mejorMes"
            ).textContent = mejorMes;

            document.getElementById(
                "montoMejorMes"
            ).textContent =
                "$" +
                mayorFacturacion.toLocaleString(
                    "es-AR"
                );
    const porCobrar = presupuestos
    .filter(
        p =>
            p.estado !== "Cobrado total" &&
            p.estado !== "Cobrado"
    )
    .reduce(
        (total, p) =>
            total + Number(p.saldo || 0),
        0
    );
    console.log(
    document.getElementById("dashPorCobrar")
);
            console.log("POR COBRAR:", porCobrar);
            console.log(presupuestos);

        document.getElementById(
            "dashPorCobrar"
        ).textContent =
            "$" +
            porCobrar.toLocaleString("es-AR");
    
    const resumenRespuesta = await fetch(API + "/presupuestos/resumen",
        {
            headers: {
                authorization: token()
            }
        }
    );

        const resumen = await resumenRespuesta.json();

        console.log(resumen);

        document.getElementById(
            "dashPresupuestado"
        ).textContent =
            "$" +
            Number(
                resumen.totalPresupuestado
            ).toLocaleString("es-AR");

        document.getElementById(
            "dashCobrado"
        ).textContent =
            "$" +
            Number(
                resumen.totalCobrado
            ).toLocaleString("es-AR");

        document.getElementById(
            "dashPendiente"
        ).textContent =
            "$" +
            Number(
                resumen.saldoPendiente
            ).toLocaleString("es-AR");

        document.getElementById(
            "dashVencidos"
        ).textContent =
            resumen.vencidos;
        const gastosRespuesta =
            await fetch(API + "/gastos/resumen", {
                headers: { authorization: token() }
            });

        const gastosDatos =
            await gastosRespuesta.json();

        const ganancia =
            Number(resumen.totalCobrado || 0)
            -
            Number(gastosDatos.totalGastos || 0);

        document.getElementById(
            "gananciaReal"
        ).textContent =
            "$" +
            ganancia.toLocaleString("es-AR");   
    const fechaHoy = new Date()
        .toISOString()
        .split("T")[0];

    const alertas =
    document.getElementById(
        "alertas"
    );

    alertas.innerHTML = "";

    presupuestos.forEach(p => {

    if (!p.fechaVencimiento) {

        return;

    }

    if (
        p.fechaVencimiento === fechaHoy
    ) {

        alertas.innerHTML += `
            <div class="alerta">
                ⚠️ Vence hoy:
                ${p.cliente}
            </div>
        `;

    }

    if (
        p.fechaVencimiento < fechaHoy
        &&
        p.estado !==
        "Cobrado total"
    ) {

        alertas.innerHTML += `
            <div class="
                alerta
                alerta-atrasada
            ">
                🚨 Atrasado:
                ${p.cliente}
            </div>
        `;

    }

    });

    lista.innerHTML = "";
    const pendientesCantidad =
    presupuestos.filter(
        p => p.estado === "Pendiente"
    ).length;

    const enProceso =
    presupuestos.filter(
        p => p.estado === "En proceso"
    ).length;

    const totalFacturadoMonto =
    presupuestos.reduce(
        (total, p) =>
        total + Number(p.total || 0),
        0
    );
    document.getElementById(
        "totalFacturado"
    ).textContent =
    "$" +
    totalFacturadoMonto.toLocaleString(
        "es-AR"
    );
 
    const trabajosPendientes = presupuestos.filter(
        p => p.estado !== "Cobrado total"
    );

    document.querySelectorAll("#totalFacturado").forEach(elemento => {
        elemento.textContent =
            "$" + totalFacturadoMonto.toLocaleString("es-AR");
    });

    cantidadPresupuestos.textContent =
        presupuestos.length;

    const promedioTotal = presupuestos.length > 0
        ? totalFacturadoMonto / presupuestos.length
        : 0;

    promedio.textContent = "$" + promedioTotal.toFixed(0);

    cantidadPendientes.textContent = trabajosPendientes.length;

    if (trabajosPendientes.length > 0) {

    mostrarNotificacion(

        `Tenes ${trabajosPendientes.length} trabajos pendientes`

    );

}
    presupuestos.forEach(p => {

    lista.innerHTML += `
        
        <tr>
            <td data-label="Cliente">
                ${p.cliente}
            </td>

            <td data-label="Trabajo">
                ${p.trabajo}
            </td>

            <td data-label="Total">
                $${Number(p.total).toLocaleString("es-AR")}
            </td>

            <td data-label="Seña">
                $${Number(p.sena || 0).toLocaleString("es-AR")}
            </td>

            <td data-label="Saldo">
                $${Number(p.saldo || p.total).toLocaleString("es-AR")}
            </td>

            <td data-label="Vencimiento">
                ${p.fechaVencimiento || "-"}
            </td>
            <td data-label="Estado">

                <select
                    onchange="
                        cambiarEstado(
                            ${p.id},
                            this.value
                        )
                    "
                >

                    <option
                        value="Pendiente"
                        ${p.estado === "Pendiente"
                            ? "selected"
                            : ""}
                    >
                        Pendiente
                    </option>

                    <option
                        value="En proceso"
                        ${p.estado === "En proceso"
                            ? "selected"
                            : ""}
                    >
                        En proceso
                    </option>

                    <option
                        value="Entregado"
                        ${p.estado === "Entregado"
                            ? "selected"
                            : ""}
                    >
                        Entregado
                    </option>

                    <option
                        value="Seña"
                        ${p.estado === "Seña"
                            ? "selected"
                            : ""}
                    >
                        Seña
                    </option>

                    <option
                        value="Saldo pendiente"
                        ${p.estado === "Saldo pendiente"
                            ? "selected"
                            : ""}
                    >
                        Saldo pendiente
                    </option>

                    <option
                        value="Cobrado total"
                        ${p.estado === "Cobrado total" || p.estado === "Cobrado"
                            ? "selected"
                            : ""}
                    >
                        Cobrado total
                    </option>

                </select>

            </td>

            <td data-label="Acciones">

                <button onclick="verDetalle(${p.id})">
                    👁
                </button>

                <button onclick="editarPresupuesto(${p.id})">
                    ✏️
                </button>

                <button onclick="masAcciones(${p.id})">
                    ⚙️
                </button>

            </td>

        </tr>
                          
    `;

});

crearGrafico(presupuestos);

crearGraficoMensual(
    presupuestos
)

};
//editar presupuestos
async function editarPresupuesto(id) {

    const respuesta = await fetch(API + "/presupuestos/obtener-presupuestos?usuarioId=" +
            localStorage.getItem("usuarioId")
        ,
        {
            headers: {
                authorization: token()
            }
        }
        );

    const presupuestos = await respuesta.json();
    

    const presupuesto = presupuestos.find(p => p.id == id);

    if (!presupuesto) {

        alert("No se encontró presupuesto");

        return;

    }

    cliente.value = presupuesto.cliente;

    telefono.value = presupuesto.telefono || "";

    direccion.value = presupuesto.direccion || "";

    trabajo.value = presupuesto.trabajo;

    observaciones.value = presupuesto.observaciones || "";

    fechaVencimiento.value = presupuesto.fechaVencimiento || "";

    materiales.value = presupuesto.materiales;

    manoDeObra.value = presupuesto.manoDeObra;

    estado.value = presupuesto.estado;

    sena.value = presupuesto.sena || 0;
    saldo.value = presupuesto.saldo || presupuesto.total;

    calcularTotal();

    idEditando = id;
        window.scrollTo({

        top: 0,

        behavior: "smooth"

    });
    cliente.focus();

}
async function registrarPago(id) {

      const monto = Number(
        prompt("Ingrese monto cobrado:")
    );

    if (isNaN(monto) || monto <= 0) {

        alert("Monto inválido");

        return;

    }

    const respuesta = await fetch(API + "/presupuestos/cobrar/" + id,

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json",

                authorization:
                    token()

            },

            body: JSON.stringify({

                monto: Number(monto)

            })

        }

    );

    if (!respuesta.ok) {

        alert("Error al registrar pago");

        return;

    }
    

    alert("Pago registrado");
    cargarResumenGastos();
    cargarPresupuestos();
    cargarGastos();
    cargarResumenMensual();

}

async function eliminarPresupuesto(id) {
    if (!confirm("Eliminar presupuesto?")) {
        return;
    }
    await fetch(API + "/presupuestos/eliminar-presupuesto/" + id, {

        method: "DELETE",

        headers: {
            authorization: token()
        }

    });
    cargarPresupuestos();
}
function descargarPDF(id) {

    window.open(
    API + "/presupuestos/generar-pdf/" + id +
        "?token=" + encodeURIComponent(token()),
        "_blank"
    );

}
async function cambiarEstado(id, estado) {

    await fetch(API + "/presupuestos/cambiar-estado/" + id,
        {

            method: "PUT",

            headers: {
                "Content-Type":
                    "application/json",
                authorization:
                    token()
            },

            body: JSON.stringify({
                estado
            })

        }
    );

    cargarPresupuestos();

}
function crearGrafico(presupuestos) {

    const canvas =
        document.getElementById("grafico");

    const ctx =
        canvas.getContext("2d");

    const cobrados =
        presupuestos
            .filter(
                p => p.estado === "Cobrado total" || p.estado === "Cobrado"
            )
            .reduce(
                (acc, p) => acc + p.total,
                0
            );

    const pendientes =
        presupuestos
            .filter(
                p => p.estado === "Pendiente"
            )
            .reduce(
                (acc, p) => acc + p.total,
                0
            );

    if (grafico) {

        grafico.destroy();

    }

    grafico = new Chart(ctx, {

        type: "doughnut",

        data: {

            labels: [
                "Cobrado total",
                "Pendientes"
            ],

            datasets: [{

                data: [
                    cobrados,
                    pendientes
                ]

            }]

        }

    });

}

function crearGraficoMensual(presupuestos) {

    const meses = {};

    presupuestos.forEach(p => {

        const partes =
            p.fecha.split("/");

        const mes =
            partes[1] + "/" + partes[2];

        if (!meses[mes]) {

            meses[mes] = 0;

        }

        meses[mes] += p.total;

    });

    const labels =
        Object.keys(meses);

    const datos =
        Object.values(meses);

    const canvas =
        document.getElementById(
            "graficoMensual"
        );

    const ctx =
        canvas.getContext("2d");

    if (graficoMensual) {

        graficoMensual.destroy();

    }

    graficoMensual = new Chart(ctx, {

        type: "bar",

        data: {

            labels,

            datasets: [{

                label: "Facturación mensual",

                data: datos

            }]

        }

    });

}
async function login() {

    const respuesta =
        await fetch(API +"/login", {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                usuario:
                    usuario.value.trim(),

                email:
                    email.value.trim(),

                password:
                    password.value

            })

        });
    if (respuesta.ok) {
        const datos = await respuesta.json();

        alert("Bienvenido");
        localStorage.setItem(
            "logueado",
            "si"
        );
        localStorage.setItem(
            "token",
            datos.token
        );
        localStorage.setItem(
            "usuarioId",
            datos.id
        );
        if (datos.email) {
            localStorage.setItem("email", datos.email);
        }
        document
        .getElementById("login")
        .style.display = "none";

    document
        .getElementById("sistema")
        .style.display = "block";    
        cargarPresupuestos();
    } else {

        alert(await respuesta.text() || "Usuario incorrecto");

    }
    cargarPresupuestos();
    cargarResumenGastos();
    cargarGastos();
    cargarResumenMensual();
}
async function registrarse() {
    const usuarioVal = usuario.value.trim();
    const emailVal = email.value.trim();
    const passwordVal = password.value;

    if (usuarioVal.length < 3) {
        alert("El usuario debe tener al menos 3 caracteres");
        return;
    }

    if (passwordVal.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres");
        return;
    }

    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        alert("Ingresá un email válido");
        return;
    }

    try {
        const respuesta = await fetch(API + "/registro", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                usuario: usuarioVal,
                email: emailVal,
                password: passwordVal
            })
        });

        const mensaje = await respuesta.text();

        if (respuesta.ok) {
            alert("Usuario creado. Ahora podés iniciar sesión.");
            return;
        }

        alert(mensaje || "No se pudo crear el usuario");
    } catch (error) {
        console.error(error);
        alert("No se pudo conectar con el servidor");
    }
}
if (
    localStorage.getItem("logueado")
    === "si"
) {

    document
        .getElementById("login")
        .style.display = "none";

    document
        .getElementById("sistema")
        .style.display = "block";

    cargarPresupuestos();
    cargarResumenGastos();
    cargarGastos();

} else {

    document
        .getElementById("login")
        .style.display = "block";

    document
        .getElementById("sistema")
        .style.display = "none";

}
function logout() {

    alert("LOGOUT EJECUTADO");

    localStorage.removeItem("logueado");

    localStorage.removeItem("token");

    localStorage.removeItem("usuarioId");

    localStorage.removeItem("email");

    location.reload();

}
function abrirImagen(src) {

    document
        .getElementById("modalImagen")
        .style.display = "flex";

    document
        .getElementById("imagenGrande")
        .src = src;

}

document
    .getElementById("modalImagen")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById("modalImagen")
                .style.display = "none";

        }
    )
    async function exportarExcel() {

    const url =
        "https://sistema-de-presupuesto.onrender.com/exportar-excel?token=" +
        encodeURIComponent(token());

    window.open(
        url,
        "_system"
    );

}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {

            registrations.forEach((registration) => {

                registration.unregister();

            });

        });

    navigator.serviceWorker
        .register("/service-worker.js")
        .then(() => {

            console.log(
                "PWA lista"
            );

        });

    navigator.serviceWorker.ready.then((registration) => {

        registration.update();

    });

}
function compararImagenes(
    antes,
    despues
) {

    document
        .getElementById("comparador")
        .style.display = "flex";

    document
        .getElementById("antes")
        .src = antes;

    document
        .getElementById("despues")
        .src = despues;

}
document
    .getElementById("sliderComparador")
    .addEventListener(
        "input",
        (e) => {

            document
                .getElementById("despues")
                .style.clipPath =

                `inset(
                    0
                    ${100 - e.target.value}%
                    0
                    0
                )`;

        }
    );
    document
    .getElementById("comparador")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById("comparador")
                .style.display = "none";

        }
    );

    function normalizarTelefonoWhatsApp(valor) {

        let numero = String(valor || "")
            .replace(/\D/g, "");

        if (numero.startsWith("00")) {

            numero = numero.slice(2);

        }

        if (numero.startsWith("0")) {

            numero = numero.slice(1);

        }

        if (numero.startsWith("15")) {

            numero = numero.slice(2);

        }

        if (numero.startsWith("54") && !numero.startsWith("549")) {

            numero = "549" + numero.slice(2);

        }

        if (!numero.startsWith("54")) {

            numero = "549" + numero;

        }

        return numero;

    }

    async function enviarWhatsApp(id) {
        const respuesta =
            await fetch(API + "/presupuestos/obtener-presupuestos?usuarioId=" +

                localStorage.getItem(
                    "usuarioId"
                ),

                {

                    headers: {

                        authorization:
                            localStorage.getItem(
                                "token"
                            )

                    }

                }

            );

        const presupuestos = await respuesta.json();
        

        const p =
            presupuestos.find(
                x => x.id === id
            );

        if (!p) {

            alert("No se encontró presupuesto");

            return;

        }

        const telefonoWhatsApp =
            normalizarTelefonoWhatsApp(p.telefono);

        if (!telefonoWhatsApp) {

            alert("Este cliente no tiene telefono cargado");

            return;

        }

        const mensaje =

    `Hola ${p.cliente},

    Te envío tu presupuesto.

    Telefono:
    ${p.telefono || "-"}

    Direccion:
    ${p.direccion || "-"}

    Trabajo:
    ${p.trabajo}

    Observaciones de trabajo:
    ${p.observaciones || "-"}

    Vencimiento:
    ${p.fechaVencimiento || "-"}

    Total:
    $${p.total}

    Estado:
    ${p.estado}`;

        const url =

            "https://wa.me/" +

            telefonoWhatsApp +

            "?text=" +

            encodeURIComponent(
                mensaje
            );

        window.open(
            url,
            "_blank"
        );

    }
function mostrarNotificacion(texto) {

    const n =
        document.getElementById(
            "notificacion"
        );

    n.innerText = texto;

    n.style.display = "block";

    setTimeout(() => {

        n.style.display = "none";

    }, 4000);

}
async function verHistorial(id) {

    const respuesta = await fetch(API + "/presupuestos/pagos/" + id,

        {

            headers: {

                authorization:
                    token()

            }

        }

    );

    const pagos =
        await respuesta.json();

    if (!pagos.length) {

        alert(
            "No hay pagos registrados"
        );

        return;

    }

    let texto = "";

    pagos.forEach((p) => {

        texto +=

            p.fecha +

            "  +$" +

            Number(
                p.monto
            ).toLocaleString("es-AR")

            +

            "\n";

    });

    alert(texto);

}
async function verDetalle(id) {

    const respuesta = await fetch(API + "/presupuestos/obtener-presupuestos?usuarioId=" +
        localStorage.getItem("usuarioId"),
        {
            headers: {
                authorization: token()
            }
        }
    );

    const presupuestos = await respuesta.json();

    const p =
        presupuestos.find(
            x => x.id == id
        );

    if (!p) return;

    alert(

`Cliente: ${p.cliente}

Telefono: ${p.telefono || "-"}

Direccion: ${p.direccion || "-"}

Observaciones:
${p.observaciones || "-"}

Fecha:
${p.fecha || "-"}`

    );

}   
function masAcciones(id) {

    const opcion = prompt(

`1 = Cobrar

2 = Historial

3 = PDF

4 = WhatsApp

5 = Eliminar`

    );

    if (opcion === "1") {

        registrarPago(id);

    }

    else if (opcion === "2") {

        verHistorial(id);

    }

    else if (opcion === "3") {

        descargarPDF(id);

    }

    else if (opcion === "4") {

        enviarWhatsApp(id);

    }

    else if (opcion === "5") {

        eliminarPresupuesto(id);

    }

}
function mostrarFormularioGasto() {

    document
        .getElementById("formularioGasto")
        .style.display = "block";

}
async function guardarGasto() {

    const concepto =
        document.getElementById("conceptoGasto").value;

    const monto =
        Number(
            document.getElementById("montoGasto").value
        );

    const respuesta = await fetch(API + "/gastos", {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                authorization: token()
            },

            body: JSON.stringify({

                fecha: new Date()
                    .toISOString()
                    .slice(0, 10),

                concepto,

                monto

            })

        });

    if (!respuesta.ok) {
        alert(await respuesta.text() || "Error al guardar el gasto");
        return;
    }

    const datos = await respuesta.json();

    alert(
        "Gasto guardado. ID: " +
        datos.id
    );
    cargarGastos();
    cargarResumenGastos();
    cargarPresupuestos();

}
async function cargarResumenGastos() {

    const respuesta =
        await fetch(API + "/gastos/resumen", {
            headers: { authorization: token() }
        });

    const datos =
        await respuesta.json();

    const gastos =
        Number(datos.totalGastos || 0);

    document.getElementById(
        "totalGastos"
    ).textContent =
        "$" +
        gastos.toLocaleString("es-AR");

}
async function cargarGastos() {

    const respuesta =
        await fetch(API + "/gastos", {
            headers: { authorization: token() }
        });

    const gastos =
        await respuesta.json();

    const lista =
        document.getElementById("listaGastos");

    lista.innerHTML = "";

    gastos.forEach(gasto => {

        const fecha =
            new Date(gasto.fecha)
            .toLocaleDateString("es-AR");

        lista.innerHTML += `
            <tr>
                <td>${fecha}</td>
                <td>${gasto.concepto}</td>
                <td>$${Number(gasto.monto).toLocaleString("es-AR")}</td>
                <td>
                    <button onclick="eliminarGasto(${gasto.id})">
                        🗑
                    </button>
                </td>
            </tr>
        `;

    });

}
async function eliminarGasto(id) {

    if (!confirm("¿Eliminar gasto?")) {
        return;
    }

    await fetch(API + `/gastos/${id}`, {
        method: "DELETE",
        headers: { authorization: token() }
    });

    cargarGastos();
    cargarResumenGastos();
    cargarPresupuestos();
    cargarResumenMensual();

}
async function cargarResumenMensual() {

    const gastosRespuesta =
        await fetch(API + "/gastos/resumen-mensual", {
            headers: { authorization: token() }
        });

    const gastosDatos =
        await gastosRespuesta.json();

    const gastosMes =
        Number(gastosDatos.totalGastosMes || 0);

    document.getElementById(
        "gastosMes"
    ).textContent =
        "$" +
        gastosMes.toLocaleString("es-AR");

    const cobradoRespuesta =
        await fetch(API +  "/presupuestos/resumen-mensual",
            {
                headers: { authorization: token() }
            }
        );

    const cobradoDatos =
        await cobradoRespuesta.json();

    const cobradoMes =
        Number(
            cobradoDatos.totalCobradoMes || 0
        );

    const gananciaMes =
        cobradoMes - gastosMes;

    document.getElementById(
        "gananciaMes"
    ).textContent =
        "$" +
        gananciaMes.toLocaleString("es-AR");

}
async function descargarBackup() {

    const url =
        "https://sistema-de-presupuesto.onrender.com/backup?token=" +
        encodeURIComponent(token());

    window.open(url, "_blank");

}
document
    .getElementById("busqueda")
    .addEventListener(
        "input",
        cargarPresupuestos
    );

document
    .getElementById("filtroEstado")
    .addEventListener(
        "change",
        cargarPresupuestos
    );

document
    .getElementById("filtroVencimiento")
    .addEventListener(
        "change",
        cargarPresupuestos
    );
async function probarCapacitor() {

    alert(typeof window.Capacitor);

    console.log(window.Capacitor);

    if (window.Capacitor) {

        alert("Capacitor OK");

    } else {

        alert("Capacitor NO");

    }

}
async function descargarArchivoInvisible() {
    
  const url = "https://sistema-de-presupuesto.onrender.com/exportar-excel?token=" + encodeURIComponent(token());

  try {
        const response = await fetch(url);
        const blob = await response.blob();

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Data = reader.result.split(',')[1];
          const nombreArchivo = `Archivo_${Date.now()}.xlsx`; 

          // Usamos el plugin desde window.Capacitor y pasamos 'DOCUMENTS' como string
          await window.Capacitor.Plugins.Filesystem.writeFile({
            path: nombreArchivo,
            data: base64Data,
            directory: 'DOCUMENTS' 
          });

          alert(`Descarga completa. Guardado en Documentos/${nombreArchivo}`);
        };
  }
  catch (error) {
        console.error("Error al descargar en segundo plano:", error);
        alert("Hubo un error al guardar el archivo.");
  }
}
// --- EXPORTAR FUNCIONES AL HTML ---
// Esto permite que los onclick="" del HTML sigan funcionando como antes

window.login = login;
window.registrarse = registrarse;
window.logout = logout;
window.guardarPresupuesto = guardarPresupuesto;
window.limpiarFormulario = limpiarFormulario;
window.cambiarEstado = cambiarEstado;
window.verDetalle = verDetalle;
window.editarPresupuesto = editarPresupuesto;
window.masAcciones = masAcciones;
window.exportarExcel = exportarExcel;
window.descargarBackup = descargarBackup;
window.descargarArchivoInvisible = descargarArchivoInvisible;
window.abrirImagen = abrirImagen;
window.mostrarFormularioGasto = mostrarFormularioGasto;
window.guardarGasto = guardarGasto;
window.eliminarGasto = eliminarGasto;
window.probarCapacitor = probarCapacitor;