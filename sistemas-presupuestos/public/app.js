const sistema = document.getElementById("sistema");
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

const lista = document.getElementById("lista");

const estado = document.getElementById("estado");

const filtroEstado = document.getElementById("filtroEstado");
const filtroVencimiento = document.getElementById("filtroVencimiento");

const usuario =
    document.getElementById("usuario");

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

function token() {

    return localStorage.getItem("token") || "";

}



function calcularTotal() {

    let resultado =
        Number(materiales.value) +
        Number(manoDeObra.value);

    total.innerText = "Total: $" + resultado;

    return resultado;
}

materiales.addEventListener("input", calcularTotal);

manoDeObra.addEventListener("input", calcularTotal);

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
        
        console.log(imagen.files);
       for (let file of imagen.files) {        
        formData.append(
            "imagen",
            file
        );

}
if (idEditando) {

    const respuesta = await fetch("/presupuestos/editar-presupuesto/" + idEditando, {

        method: "PUT",

        headers: {
            "Content-Type": "application/json",
            authorization: token()
        },

        body: JSON.stringify({

            cliente: cliente.value,

            telefono: telefono.value,

            direccion: direccion.value,

            trabajo: trabajo.value,

            observaciones: observaciones.value,

            materiales: materiales.value,

            manoDeObra: manoDeObra.value,

            total: calcularTotal(),

            fecha: new Date().toLocaleDateString(),

            fechaVencimiento: fechaVencimiento.value,

            estado: estado.value

        })
    });
      if (!respuesta.ok) {
            alert ("Error al editar")
            return;
        }

    idEditando = null;

}     
else {

        const respuesta = await fetch("/presupuestos/guardar-presupuesto", {

            method: "POST",
             headers: {

            authorization:
                localStorage.getItem(
                    "token"
                )

        },
            body: formData

        });
        alert("Presupuesto guardado");
    }

    cargarPresupuestos();
}

//cargar presupuestos
async function cargarPresupuestos() {

    const respuesta = await fetch("/presupuestos/obtener-presupuestos?busqueda=" +

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

    const presupuestos =
        await respuesta.json();

    lista.innerHTML = "";
    
    let totalgeneral = 0;
    const pendientes =

    presupuestos.filter(

        p => p.estado !== "Cobrado total"

    );
    presupuestos.forEach(p => {

        totalgeneral += p.total;

    });

    totalFacturado.textContent =
        "$" + totalgeneral;

    cantidadPresupuestos.textContent =
        presupuestos.length;

    let promedioTotal = 0;

    if (presupuestos.length > 0) {

        promedioTotal =
            totalgeneral / presupuestos.length;

    }

    promedio.textContent ="$" + promedioTotal.toFixed(0);
    if (pendientes.length > 0) {

    mostrarNotificacion(

        `Tenés ${pendientes.length} trabajos pendientes`

    );

}
    presupuestos.forEach(p => {

    lista.innerHTML += `

        <tr>

            <td data-label="Cliente">${p.cliente}</td>

            <td data-label="Telefono">${p.telefono || "-"}</td>

            <td data-label="Direccion">${p.direccion || ""}</td>

            <td data-label="Trabajo">${p.trabajo}</td>

            <td data-label="Observaciones de trabajo">${p.observaciones || "-"}</td>

            <td data-label="Total">$${p.total}</td>
            
            <td data-label="Fecha">${p.fecha}</td>
            <td data-label="Vencimiento">${p.fechaVencimiento || "-"}</td>
            <td data-label="Imagen">
                 <div class="galeria">
                    ${p.imagenes
                        ? p.imagenes
                            .split(",")
                            .map(img => `

                                <img
                                    src="${img}"
                                    class="preview"
                                    onclick="abrirImagen('${img}')"
                                >

                            `)
                            .join("")
                        : ""
                    }

                </div>
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

                <button onclick="editarPresupuesto(${p.id})">
                    Editar
                </button>

                <button onclick="eliminarPresupuesto(${p.id})">
                    Eliminar
                </button>

                <button onclick="descargarPDF(${p.id})">
                    PDF
                </button>
                <button onclick="enviarWhatsApp(${p.id})">
                    WhatsApp
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

    const respuesta = await fetch("/presupuestos/obtener-presupuestos?usuarioId=" +
            localStorage.getItem("usuarioId")
        ,
        {
            headers: {
                authorization: token()
            }
        }
        );

    const presupuestos =
        await respuesta.json();

    const presupuesto =
        presupuestos.find(p => p.id == id);

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

    calcularTotal();

    idEditando = id;

}
async function eliminarPresupuesto(id) {
    if (!confirm("Eliminar presupuesto?")) {
        return;
    }
    await fetch("/presupuestos/eliminar-presupuesto/" + id, {

        method: "DELETE",

        headers: {
            authorization: token()
        }

    });
    cargarPresupuestos();
}
function descargarPDF(id) {

    window.open(
        "/presupuestos/generar-pdf/" + id,
        "_blank"
    );

}
async function cambiarEstado(id, estado) {

    await fetch("/presupuestos/cambiar-estado/" + id,
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
        await fetch("/login", {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                usuario:
                    usuario.value,

                password:
                    password.value

            })

        });
    const datos = await respuesta.json();
    if (respuesta.ok) {

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
        document
        .getElementById("login")
        .style.display = "none";

    document
        .getElementById("sistema")
        .style.display = "block";    
        cargarPresupuestos();
    } else {

        alert("Usuario incorrecto");

    }

}
async function registrarse() {

    const respuesta =
        await fetch("/registro", {

            method: "POST",

            headers: {
                
                "Content-Type":
                    "application/json",
                      authorization:
                localStorage.getItem(
                    "token"
                )        
            },

            body: JSON.stringify({

                usuario:
                    usuario.value,

                password:
                    password.value

            })

        });

    if (respuesta.ok) {

        alert("Usuario creado");

    } else {

        alert("Error");

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

}
function logout() {
    localStorage.removeItem("logueado");
    
    localStorage.removeItem("token");

    localStorage.removeItem("usuarioId");

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
    function exportarExcel() {

    window.location =
        "/exportar-excel";

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
            await fetch("/presupuestos/obtener-presupuestos?usuarioId=" +

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

        const presupuestos =
            await respuesta.json();

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
