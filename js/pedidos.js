// pedidos.js
class PedidosManager {
    constructor() {
        this.pedidos = [];
        this.carrito = [];
        this.clientes = [];
        this.productos = [];
        this.initializeEventListeners();
        this.loadClientes();
        this.loadProductos();
        this.loadPedidos();
    }

    initializeEventListeners() {
        document.getElementById("addPedidoBtn").addEventListener("click", () => this.openModal());
        document.getElementById("closePedidoModal").addEventListener("click", () => this.closeModal());
        document.getElementById("pedidoCancelBtn").addEventListener("click", () => this.closeModal());
        document.getElementById("pedidoForm").addEventListener("submit", e => this.handleSubmit(e));

        const input = document.getElementById("searchProductosPedido");
        input.addEventListener("input", e => this.searchProductos(e.target.value));
        input.addEventListener("focus", () => this.searchProductos(input.value));
        input.addEventListener("blur", () => {
            setTimeout(() => {
                document.getElementById("productosPedidoResults").style.display = "none";
            }, 200);
        });
    }

    openModal() {
        document.getElementById("pedidoForm").reset();
        this.carrito = [];
        this.updateCarritoDisplay();
        document.getElementById("pedidoModal").style.display = "block";
        document.getElementById("productosPedidoResults").style.display = "none";
        this.editingPedidoId = null;
    }

    closeModal() {
        document.getElementById("pedidoModal").style.display = "none";
    }

    // === Modal de detalles ===
    openDetallesModal(pedidoId) {
        const pedido = this.pedidos.find(p => p.id === pedidoId);
        if (!pedido) return;

        this.currentViewingPedido = pedido;
        document.getElementById("detallesPedidoTitle").textContent = `Pedido #${pedido.id}`;
        document.getElementById("detallesPedidoCliente").textContent = pedido.nombreCliente;
        document.getElementById("detallesPedidoCliente").onclick = () => {
            const cliente = this.clientes.find(c => c.id === pedido.clienteId);
            if (cliente && window.clientesManager) {
                clientesManager.openModal(cliente);
            } else {
                showError("Error", "No se encontró información del cliente");
            }
        };
        document.getElementById("detallesPedidoEntrega").textContent = pedido.fechaEntrega || 'Sin fecha';
        document.getElementById("detallesPedidoDireccion").textContent = pedido.direccionEntrega || 'No especificada';
        document.getElementById("detallesPedidoNotas").textContent = pedido.notas || 'Sin notas';
        document.getElementById("detallesPedidoTotal").textContent = `$${pedido.total.toFixed(2)}`;

        const productosHTML = pedido.productos.map(prod => `
        <div class="producto-detalle">
          <span>${prod.nombre} x${prod.cantidad}</span>
          <span>$${prod.subtotal.toFixed(2)}</span>
        </div>
    `).join('');
        document.getElementById("detallesPedidoProductos").innerHTML = productosHTML;

        document.getElementById("detallesPedidoEstado").value = pedido.estado;
        document.getElementById("detallesPedidoModal").style.display = "block";
    }

    closeDetallesModal() {
        document.getElementById("detallesPedidoModal").style.display = "none";
        this.currentViewingPedido = null;
    }

    async updateEstadoPedido() {
        if (!this.currentViewingPedido) return;
        const nuevoEstado = document.getElementById("detallesPedidoEstado").value;
        try {
            await db.collection("pedidos").doc(this.currentViewingPedido.id).update({ estado: nuevoEstado });
            this.currentViewingPedido.estado = nuevoEstado;
            this.loadPedidos();
            showSuccess("Éxito", "Estado actualizado correctamente");
        } catch (e) {
            console.error(e);
            showError("Error", "No se pudo actualizar el estado");
        }
    }

    editPedido() {
        if (!this.currentViewingPedido) return;
        const pedido = this.currentViewingPedido;
        this.closeDetallesModal();

        this.openModal();
        document.getElementById("pedidoCliente").value = pedido.clienteId;
        document.getElementById("fechaEntregaPedido").value = pedido.fechaEntrega;
        document.getElementById("pedidoNotas").value = pedido.notas;
        document.getElementById("direccionEntrega").value = pedido.direccionEntrega;
        document.getElementById("costoEntrega").value = pedido.costoEntrega || 0;

        this.carrito = pedido.productos;
        this.updateCarritoDisplay();

        this.editingPedidoId = pedido.id;
    }

    // === Guardar pedido (nuevo o editar) ===
    async handleSubmit(e) {
        e.preventDefault();
        if (this.carrito.length === 0) {
            showError("Error", "Debes agregar productos al pedido");
            return;
        }
        const clienteId = document.getElementById("pedidoCliente").value;
        if (!clienteId) {
            showError("Error", "Selecciona un cliente");
            return;
        }

        const pedidoData = {
            clienteId,
            productos: this.carrito,
            nombreCliente: this.clientes.find(c => c.id === clienteId)?.nombreCliente || 'Cliente',
            total: this.total,
            tiempoProduccionTotal: this.tiempoProduccionTotal,
            fechaEntrega: document.getElementById("fechaEntregaPedido").value,
            estado: "pendiente",
            notas: document.getElementById("pedidoNotas").value,
            direccionEntrega: document.getElementById("direccionEntrega").value,
            costoEntrega: parseFloat(document.getElementById("costoEntrega").value) || 0,
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (this.editingPedidoId) {
                await db.collection("pedidos").doc(this.editingPedidoId).update(pedidoData);
                showSuccess("Éxito", "Pedido actualizado correctamente");
            } else {
                pedidoData.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection("pedidos").add(pedidoData);
                showSuccess("Éxito", "Pedido guardado correctamente");
            }
            this.closeModal();
            this.loadPedidos();
        } catch (error) {
            console.error("Error guardando pedido:", error);
            showError("Error", "No se pudo guardar el pedido");
        }
    }

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
            const data = { id: doc.id, ...doc.data() };
            this.productos.push(data);
        });
        this.searchProductos('');
    }

    searchProductos(term) {
        const div = document.getElementById("productosPedidoResults");
        const input = document.getElementById("searchProductosPedido");
        const searchTerm = (term || "").toLowerCase().trim();

        let filtered = this.productos.filter(p =>
            !this.carrito.find(c => c.id === p.id) &&
            (!searchTerm || (p.nombreProducto || "").toLowerCase().includes(searchTerm))
        );

        if (filtered.length === 0) {
            if (!searchTerm) {
                div.style.display = "none";
                return;
            }
            div.innerHTML = "<div class='search-result-item'>No se encuentran productos</div>";
        } else {
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
        if (document.activeElement === input || searchTerm) {
            div.style.display = "block";
        } else {
            div.style.display = "none";
        }
    }

    addProductoToPedido(productoId) {
        const p = this.productos.find(x => x.id === productoId);
        if (!p) return;

        let precio = p.precioMenudeo || p.precioUnitario || 0;
        let cantidadMinMayoreo = p.cantidadMinimaMayoreo || 0;
        if (cantidadMinMayoreo > 0 && 1 >= cantidadMinMayoreo) {
            precio = p.precioMenudeo || p.precioUnitario || 0;
        } else {
            precio = p.precioMayoreo || p.precioUnitario || 0;
        }
        const stock = p.stockActual || 0;

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
            tiempoProduccion,
            precioMenudeo: p.precioMenudeo || p.precioUnitario,
            precioMayoreo: p.precioMayoreo || p.precioUnitario,
            cantidadMinimaMayoreo: cantidadMinMayoreo
        });

        this.updateCarritoDisplay();
        document.getElementById("searchProductosPedido").value = '';
        this.searchProductos('');
    }

    updateCarritoDisplay() {
        const div = document.getElementById("carritoPedido");
        if (this.carrito.length === 0) {
            div.innerHTML = "<p class='empty-state'><i class='fas fa-clipboard-list'></i> No hay productos en el pedido</p>";
            return;
        }
        let total = 0;
        let dias = 0, horas = 0;

        div.innerHTML = this.carrito.map((item, idx) => {
            total += item.subtotal;
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

        let extraDias = Math.floor(horas / 24);
        dias += extraDias; horas = horas % 24;

        document.getElementById("tiempoProduccionTotal").textContent = `${dias} días ${horas} horas`;
        this.total = total;
        this.tiempoProduccionTotal = { dias, horas };
    }

    enviarWhatsAppStock(nombreProducto) {
        const mensaje = `Hola, necesitamos reabastecimiento de la materia prima: ${nombreProducto}`;
        const url = `https://wa.me/5215647849803?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    }

    updateCantidad(index, newValue) {
        const item = this.carrito[index];
        const cantidad = parseInt(newValue) || 1;
        item.cantidad = cantidad;

        const min = item.cantidadMinimaMayoreo || 0;
        if (min && cantidad >= min) {
            item.precio = item.precioMayoreo || item.precioUnitario;
        } else {
            item.precio = item.precioMenudeo || item.precioUnitario;
        }
        item.subtotal = item.precio * cantidad;
        this.updateCarritoDisplay();
    }

    removeProducto(index) {
        this.carrito.splice(index, 1);
        this.updateCarritoDisplay();
    }

    async deletePedido(id, nombreCliente) {
        confirmDelete(
            "pedido",
            `Estás a punto de borrar el pedido de "${nombreCliente}".`,
            async () => {
                try {
                    await db.collection("pedidos").doc(id).delete();
                    this.loadPedidos();
                    showSuccess("Eliminado", `El pedido de "${nombreCliente}" ha sido eliminado correctamente.`);
                } catch (error) {
                    console.error("Error al eliminar pedido:", error);
                    showError("Error", "No se pudo eliminar el pedido, por favor intenta de nuevo.");
                }
            }
        );
    }

    async loadPedidos() {
        const qs = await db.collection("pedidos").orderBy("fechaCreacion", "desc").get();
        this.pedidos = [];
        qs.forEach(doc => this.pedidos.push({ id: doc.id, ...doc.data() }));
        this.renderPedidos();
    }

    renderPedidos() {
        const grid = document.getElementById("pedidosGrid");
        if (this.pedidos.length === 0) {
            grid.innerHTML = "<p class='empty-state'><i class='fas fa-clipboard-list'></i> No hay pedidos registrados</p>";
            return;
        }
        grid.innerHTML = this.pedidos.map(p => `
      <div class="pedido-card estado-${p.estado}">
        <div class="pedido-header">
            <h4><i class="fas fa-user"></i> ${p.nombreCliente || p.clienteId}</h4>
            <span class="pedido-estado">${p.estado}</span>
        </div>
        <div class="pedido-body">
            <div class="pedido-info">
                <i class="fas fa-calendar-alt"></i>
                <span><strong>Entrega:</strong> ${p.fechaEntrega}</span>
            </div>
            <div class="pedido-info">
                <i class="fas fa-coins"></i>
                <span><strong>Total:</strong> $${p.total.toFixed(2)}</span>
            </div>
        </div>
        <div class="pedido-footer">
            <button class="btn-primary" onclick="pedidosManager.openDetallesModal('${p.id}')">
              <i class="fas fa-eye"></i> Ver Detalles
            </button>
            <button class="btn-delete" onclick="pedidosManager.deletePedido('${p.id}', '${(p.nombreCliente || 'Cliente')}')">
              <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
      </div>`).join('');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("pedidos-section")) window.pedidosManager = new PedidosManager();
});