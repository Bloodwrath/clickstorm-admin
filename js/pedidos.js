// pedidos.js
class PedidosManager {
    constructor() {
        this.pedidos = [];   // todos los pedidos
        this.carrito = [];   // productos actuales en el pedido
        this.clientes = [];  // clientes disponibles
        this.productos = []; // productos disponibles

        this.initializeEventListeners();
        this.loadClientes();
        this.loadProductos();
        this.loadPedidos();
    }

    initializeEventListeners() {
        // Modal abrir/cerrar
        document.getElementById("addPedidoBtn").addEventListener("click", () => this.openModal());
        document.getElementById("closePedidoModal").addEventListener("click", () => this.closeModal());
        document.getElementById("pedidoCancelBtn").addEventListener("click", () => this.closeModal());
        document.getElementById("pedidoForm").addEventListener("submit", e => this.handleSubmit(e));
        // Buscador de productos
        const input = document.getElementById("searchProductosPedido");

        // Cuando escribe, filtramos
        input.addEventListener("input", e => this.searchProductos(e.target.value));

        // Cuando hace click, mostrar todo (aunque no haya texto) 
        input.addEventListener("focus", () => this.searchProductos(input.value));

        // Cuando pierde foco (click fuera), ocultamos lista después de un pequeño delay
        input.addEventListener("blur", () => {
            setTimeout(() => {
                document.getElementById("productosPedidoResults").style.display = "none";
            }, 200);
        });
    }

    // === Modal ===
    openModal() {
        document.getElementById("pedidoForm").reset();
        this.carrito = [];
        this.updateCarritoDisplay();
        document.getElementById("pedidoModal").style.display = "block";

        // Ocultar cualquier dropdown abierto
        document.getElementById("productosPedidoResults").style.display = "none";
    }
    closeModal() { document.getElementById("pedidoModal").style.display = "none"; }

    // === Cargar clientes ===
    async loadClientes() {
        const qs = await db.collection("clientes").orderBy("nombreCliente").get();
        this.clientes = [];
        let select = document.getElementById("pedidoCliente");
        select.innerHTML = '<option value="">Seleccionar cliente...</option>';
        qs.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            this.clientes.push(data);
            const opt = document.createElement("option");
            opt.value = data.id;
            opt.textContent = data.nombreCliente;
            select.appendChild(opt);
        });
    }

    // === Cargar productos ===
    async loadProductos() {
        const qs = await db.collection("productos").orderBy("nombreProducto").get();
        this.productos = [];

        qs.forEach(doc => {
            const data = { id: doc.id, ...doc.data() }; // 👈 ahora sí definimos 'data'
            console.log("Producto cargado:", data);     // debug correcto
            this.productos.push(data);
        });

        // muestra lista de productos al abrir el modal
        this.searchProductos('');
    }

    // === Listar TODOS los productos + búsqueda ===
    searchProductos(term) {
        const div = document.getElementById("productosPedidoResults");
        const input = document.getElementById("searchProductosPedido");

        // 🔍 Si hay texto, filtra
        const searchTerm = (term || "").toLowerCase().trim();

        // Lista de productos filtrados
        let filtered = this.productos.filter(p =>
            !this.carrito.find(c => c.id === p.id) && // no mostrar los que ya están en el carrito
            (!searchTerm || (p.nombreProducto || "").toLowerCase().includes(searchTerm))
        );

        // Si no hay productos que coincidan
        if (filtered.length === 0) {
            // Si no estás escribiendo nada, oculta la lista
            if (!searchTerm) {
                div.style.display = "none";
                return;
            }
            div.innerHTML = "<div class='search-result-item'>No se encuentran productos</div>";
        } else {
            // Mostrar lista de productos
            div.innerHTML = filtered.map(p => {
                const stock = p.stockActual || 0;
                return `
                <div class="search-result-item" 
                     onclick="pedidosManager.addProductoToPedido('${p.id}')">
                    <strong>${p.nombreProducto}</strong> (${p.tipoProducto})
                    <br><small>Stock: ${stock} | Precio: $${p.precioMenudeo || p.precioUnitario || 0}</small>
                </div>
            `;
            }).join('');
        }

        // Siempre mostrar cuando hay focus o texto en el input
        if (document.activeElement === input || searchTerm) {
            div.style.display = "block";
        } else {
            div.style.display = "none";
        }
    }

    // === Agregar producto al carrito ===
    addProductoToPedido(productoId) {
        const p = this.productos.find(x => x.id === productoId);
        if (!p) return;

        const precio = p.precioMenudeo || p.precioUnitario || 0;
        const stock = p.stockActual || 0;

        // Materia prima no lleva tiempo de producción
        const tiempoProduccion = p.tipoProducto === "materia_prima"
            ? { dias: 0, horas: 0 }
            : p.tiempoProduccion || { dias: 0, horas: 0 };

        this.carrito.push({
            id: p.id,
            nombre: p.nombreProducto,
            tipo: p.tipoProducto,
            cantidad: 1,
            precio,
            subtotal: precio,
            stockDisponible: stock,
            tiempoProduccion
        });

        this.updateCarritoDisplay();
        // oculta el menú después de agregar
        document.getElementById("searchProductosPedido").value = '';
        this.searchProductos('');
    }

    // === Mostrar carrito y calcular totales ===
    updateCarritoDisplay() {
        const div = document.getElementById("carritoPedido");
        if (this.carrito.length === 0) {
            div.innerHTML = "<div class='empty-carrito'>No hay productos</div>";
            return;
        }

        let total = 0;
        let dias = 0, horas = 0;

        div.innerHTML = this.carrito.map((item, idx) => {
            total += item.subtotal;
            // solo sumar tiempo de producción a productos de venta
            if (item.tipo === "producto_venta") {
                dias += (item.tiempoProduccion.dias || 0) * item.cantidad;
                horas += (item.tiempoProduccion.horas || 0) * item.cantidad;
            }

            const stockMsg = item.stockDisponible < item.cantidad
                ? `<span style="color:red;">⚠ Stock insuficiente</span>
                   ${item.tipo === "materia_prima"
                    ? `<br><button type='button' class='btn-whatsapp' 
                            onclick="pedidosManager.enviarWhatsAppStock('${item.nombre}')">
                            <i class='fab fa-whatsapp'></i> Pedir Stock a Empresa
                          </button>` : ''
                }`
                : '';

            return `
            <div class="carrito-item">
              <div class="carrito-item-info">
                <strong>${item.nombre}</strong> x${item.cantidad} - $${item.subtotal.toFixed(2)}
                ${stockMsg}
              </div>
              <div class="carrito-item-controls">
                <input type="number" min="1" value="${item.cantidad}" onchange="pedidosManager.updateCantidad(${idx}, this.value)">
                <button type="button" class="btn-remove" onclick="pedidosManager.removeProducto(${idx})"><i class="fas fa-trash"></i></button>
              </div>
            </div>`;
        }).join('');

        // Normalizar horas en días
        let extraDias = Math.floor(horas / 24);
        dias += extraDias; horas = horas % 24;

        document.getElementById("tiempoProduccionTotal").textContent = `${dias} días ${horas} horas`;
        this.total = total;
        this.tiempoProduccionTotal = { dias, horas };
    }

    // === Enviar WhatsApp a empresa si falta stock en materia prima ===
    enviarWhatsAppStock(nombreProducto) {
        const mensaje = `Hola, necesitamos reabastecimiento de la materia prima: ${nombreProducto}`;
        const url = `https://wa.me/5215647849803?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    }

    updateCantidad(index, newValue) {
        const item = this.carrito[index];
        const cantidad = parseInt(newValue) || 1;
        item.cantidad = cantidad; item.subtotal = item.precio * cantidad;
        this.updateCarritoDisplay();
    }
    removeProducto(index) { this.carrito.splice(index, 1); this.updateCarritoDisplay(); }

    // === Guardar pedido ===
    async handleSubmit(e) {
        e.preventDefault();
        if (this.carrito.length === 0) { alert("Agrega productos"); return; }
        const clienteId = document.getElementById("pedidoCliente").value;
        if (!clienteId) { alert("Selecciona cliente"); return; }
        const fechaEntrega = document.getElementById("fechaEntregaPedido").value;
        const pedido = {
            clienteId,
            productos: this.carrito,
            total: this.total,
            tiempoProduccionTotal: this.tiempoProduccionTotal,
            fechaEntrega,
            estado: "pendiente",
            notas: document.getElementById("pedidoNotas").value,
            direccionEntrega: document.getElementById("direccionEntrega").value,
            costoEntrega: parseFloat(document.getElementById("costoEntrega").value) || 0,
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection("pedidos").add(pedido);
        this.closeModal(); this.loadPedidos(); alert("Pedido guardado!");
    }

    // === Cargar pedidos ===
    async loadPedidos() {
        const qs = await db.collection("pedidos").orderBy("fechaCreacion", "desc").get();
        this.pedidos = []; qs.forEach(doc => this.pedidos.push({ id: doc.id, ...doc.data() }));
        this.renderPedidos();
    }
    renderPedidos() {
        const grid = document.getElementById("pedidosGrid");
        if (this.pedidos.length === 0) { grid.innerHTML = "<p>No hay pedidos</p>"; return; }
        grid.innerHTML = this.pedidos.map(p => `
          <div class="pedido-card">
            <h4>Cliente: ${p.clienteId}</h4>
            <p>Total: $${p.total.toFixed(2)}</p>
            <p>Entrega: ${p.fechaEntrega}</p>
            <p>Estado: ${p.estado}</p>
          </div>`).join('');
    }
}

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("pedidos-section")) window.pedidosManager = new PedidosManager();
});