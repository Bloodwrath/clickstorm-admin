// compras.js
class ComprasManager {
    constructor() {
        this.tarjetas = [];
        this.compras = [];
        this.editingTarjetaId = null;
        this.editingCompraId = null;
        this.currentTarjetaId = null; // Para modal de compra
        this.currentTarjetaModal = null; // Para modal de compras de tarjeta
        this.currentCalendarDate = new Date();
        this.initializeEventListeners();
        this.loadTarjetas();
    }

    initializeEventListeners() {
        // Botón agregar tarjeta
        document.getElementById('addTarjetaBtn').addEventListener('click', () => {
            this.openTarjetaModal();
        });

        // Cerrar modales
        document.getElementById('closeTarjetaModal').addEventListener('click', () => {
            this.closeTarjetaModal();
        });

        document.getElementById('tarjetaCancelBtn').addEventListener('click', () => {
            this.closeTarjetaModal();
        });

        document.getElementById('closeCompraModal').addEventListener('click', () => {
            this.closeCompraModal();
        });

        document.getElementById('compraCancelBtn').addEventListener('click', () => {
            this.closeCompraModal();
        });

        // Formularios
        document.getElementById('tarjetaForm').addEventListener('submit', (e) => {
            this.handleTarjetaSubmit(e);
        });

        document.getElementById('compraForm').addEventListener('submit', (e) => {
            this.handleCompraSubmit(e);
        });

        // Cálculos automáticos para compras
        document.getElementById('costoTotalCompra').addEventListener('input', () => {
            this.calcularCostoUnitario();
            this.calcularPagoMensual();
        });

        document.getElementById('cantidadCompra').addEventListener('input', () => {
            this.calcularCostoUnitario();
        });

        document.getElementById('esMesesSinIntereses').addEventListener('change', (e) => {
            this.toggleMesesSinIntereses(e.target.checked);
        });

        document.getElementById('numeroMeses').addEventListener('change', () => {
            this.calcularPagoMensual();
        });

        // Filtros
        document.getElementById('searchCompras').addEventListener('input', () => {
            this.filterCompras();
        });

        document.getElementById('filterTarjeta').addEventListener('change', () => {
            this.filterCompras();
        });

        document.getElementById('filterMes').addEventListener('change', () => {
            this.filterCompras();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Cerrar modales al hacer click fuera
        window.addEventListener('click', (e) => {
            const tarjetaModal = document.getElementById('tarjetaModal');
            const compraModal = document.getElementById('compraModal');

            if (e.target === tarjetaModal) {
                this.closeTarjetaModal();
            }
            if (e.target === compraModal) {
                this.closeCompraModal();
            }
        });

        // Fecha por defecto
        document.getElementById('fechaCompra').value = new Date().toISOString().split('T')[0];

        // Modal de compras de tarjeta
        document.getElementById('closeComprasTarjetaModal').addEventListener('click', () => {
            this.closeComprasTarjetaModal();
        });

        // Navegación del calendario
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.changeMonth(-1);
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.changeMonth(1);
        });

        // Cerrar modal de compras de tarjeta al hacer click fuera
        window.addEventListener('click', (e) => {
            const comprasTarjetaModal = document.getElementById('comprasTarjetaModal');
            if (e.target === comprasTarjetaModal) {
                this.closeComprasTarjetaModal();
            }
        });
    }

    // FUNCIONES DE TARJETAS
    openTarjetaModal(tarjeta = null) {
        const modal = document.getElementById('tarjetaModal');
        const modalTitle = document.getElementById('tarjetaModalTitle');
        const form = document.getElementById('tarjetaForm');

        if (tarjeta) {
            this.editingTarjetaId = tarjeta.id;
            modalTitle.textContent = 'Editar Tarjeta';
            this.fillTarjetaForm(tarjeta);
        } else {
            this.editingTarjetaId = null;
            modalTitle.textContent = 'Agregar Tarjeta';
            form.reset();
        }

        modal.style.display = 'block';
    }

    closeTarjetaModal() {
        document.getElementById('tarjetaModal').style.display = 'none';
        this.editingTarjetaId = null;
        document.getElementById('tarjetaForm').reset();
    }

    fillTarjetaForm(tarjeta) {
        document.getElementById('nombreTarjeta').value = tarjeta.nombre || '';
        document.getElementById('tipoTarjeta').value = tarjeta.tipo || '';
        document.getElementById('limiteCredito').value = tarjeta.limiteCredito || '';
        document.getElementById('ultimos4Digitos').value = tarjeta.ultimos4Digitos || '';
        document.getElementById('fechaCorte').value = tarjeta.fechaCorte || '';
        document.getElementById('diasPago').value = tarjeta.diasPago || '';
        document.getElementById('colorTarjeta').value = tarjeta.color || 'blue';
    }

    async handleTarjetaSubmit(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('tarjetaSaveBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        submitBtn.disabled = true;

        try {
            const formData = this.getTarjetaFormData();

            if (this.editingTarjetaId) {
                await this.updateTarjeta(this.editingTarjetaId, formData);
            } else {
                await this.addTarjeta(formData);
            }

            this.closeTarjetaModal();
            this.loadTarjetas();
            this.showSuccessMessage(this.editingTarjetaId ? 'Tarjeta actualizada correctamente' : 'Tarjeta agregada correctamente');
        } catch (error) {
            console.error('Error al guardar tarjeta:', error);
            this.showErrorMessage('Error al guardar la tarjeta');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    getTarjetaFormData() {
        return {
            nombre: document.getElementById('nombreTarjeta').value.trim(),
            tipo: document.getElementById('tipoTarjeta').value,
            limiteCredito: parseFloat(document.getElementById('limiteCredito').value) || 0,
            ultimos4Digitos: document.getElementById('ultimos4Digitos').value.trim(),
            fechaCorte: parseInt(document.getElementById('fechaCorte').value) || null,
            diasPago: parseInt(document.getElementById('diasPago').value) || null,
            color: document.getElementById('colorTarjeta').value,
            fechaCreacion: this.editingTarjetaId ? undefined : firebase.firestore.FieldValue.serverTimestamp(),
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    async addTarjeta(tarjetaData) {
        await db.collection('tarjetas').add(tarjetaData);
    }

    async updateTarjeta(id, tarjetaData) {
        await db.collection('tarjetas').doc(id).update(tarjetaData);
    }

    async loadTarjetas() {
        try {
            const querySnapshot = await db.collection('tarjetas').orderBy('nombre').get();
            this.tarjetas = [];

            querySnapshot.forEach((doc) => {
                this.tarjetas.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.updateTarjetaFilter();
            this.loadCompras();
        } catch (error) {
            console.error('Error al cargar tarjetas:', error);
            this.showErrorMessage('Error al cargar las tarjetas');
        }
    }

    updateTarjetaFilter() {
        const select = document.getElementById('filterTarjeta');
        const currentValue = select.value;

        select.innerHTML = '<option value="">Todas las tarjetas</option>';

        this.tarjetas.forEach(tarjeta => {
            const option = document.createElement('option');
            option.value = tarjeta.id;
            option.textContent = tarjeta.nombre;
            select.appendChild(option);
        });

        if (currentValue) {
            select.value = currentValue;
        }
    }

    // FUNCIONES DE COMPRAS
    openCompraModal(compra = null, tarjetaId = null) {
        const modal = document.getElementById('compraModal');
        const modalTitle = document.getElementById('compraModalTitle');
        const form = document.getElementById('compraForm');

        if (compra) {
            this.editingCompraId = compra.id;
            modalTitle.textContent = 'Editar Compra';
            this.fillCompraForm(compra);
        } else {
            this.editingCompraId = null;
            modalTitle.textContent = 'Agregar Compra';
            form.reset();
            document.getElementById('fechaCompra').value = new Date().toISOString().split('T')[0];
            if (tarjetaId) {
                document.getElementById('tarjetaIdCompra').value = tarjetaId;
            }
        }

        modal.style.display = 'block';
    }

    closeCompraModal() {
        document.getElementById('compraModal').style.display = 'none';
        this.editingCompraId = null;
        this.currentTarjetaId = null;
        document.getElementById('compraForm').reset();
        this.toggleMesesSinIntereses(false);
    }

    fillCompraForm(compra) {
        document.getElementById('nombreProductoCompra').value = compra.nombreProducto || '';
        document.getElementById('fechaCompra').value = compra.fechaCompra || '';
        document.getElementById('costoTotalCompra').value = compra.costoTotal || '';
        document.getElementById('cantidadCompra').value = compra.cantidad || '';
        document.getElementById('categoriaCompra').value = compra.categoria || '';
        document.getElementById('esMesesSinIntereses').checked = compra.esMesesSinIntereses || false;
        document.getElementById('numeroMeses').value = compra.numeroMeses || '';
        document.getElementById('notasCompra').value = compra.notas || '';
        document.getElementById('tarjetaIdCompra').value = compra.tarjetaId || '';

        this.toggleMesesSinIntereses(compra.esMesesSinIntereses || false);
        this.calcularCostoUnitario();
        this.calcularPagoMensual();
    }

    async handleCompraSubmit(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('compraSaveBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        submitBtn.disabled = true;

        try {
            const formData = this.getCompraFormData();

            if (this.editingCompraId) {
                await this.updateCompra(this.editingCompraId, formData);
            } else {
                await this.addCompra(formData);
            }

            this.closeCompraModal();
            this.loadCompras();
            this.showSuccessMessage(this.editingCompraId ? 'Compra actualizada correctamente' : 'Compra agregada correctamente');
        } catch (error) {
            console.error('Error al guardar compra:', error);
            this.showErrorMessage('Error al guardar la compra');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    getCompraFormData() {
        const costoTotal = parseFloat(document.getElementById('costoTotalCompra').value) || 0;
        const cantidad = parseInt(document.getElementById('cantidadCompra').value) || 1;
        const esMSI = document.getElementById('esMesesSinIntereses').checked;
        const numeroMeses = parseInt(document.getElementById('numeroMeses').value) || null;

        return {
            nombreProducto: document.getElementById('nombreProductoCompra').value.trim(),
            fechaCompra: document.getElementById('fechaCompra').value,
            costoTotal: costoTotal,
            cantidad: cantidad,
            costoUnitario: costoTotal / cantidad,
            categoria: document.getElementById('categoriaCompra').value,
            esMesesSinIntereses: esMSI,
            numeroMeses: esMSI ? numeroMeses : null,
            pagoMensual: esMSI && numeroMeses ? costoTotal / numeroMeses : null,
            notas: document.getElementById('notasCompra').value.trim(),
            tarjetaId: document.getElementById('tarjetaIdCompra').value,
            fechaCreacion: this.editingCompraId ? undefined : firebase.firestore.FieldValue.serverTimestamp(),
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    async addCompra(compraData) {
        await db.collection('compras').add(compraData);
    }

    async updateCompra(id, compraData) {
        await db.collection('compras').doc(id).update(compraData);
    }

    async loadCompras() {
        try {
            const querySnapshot = await db.collection('compras').orderBy('fechaCompra', 'desc').get();
            this.compras = [];

            querySnapshot.forEach((doc) => {
                this.compras.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderTarjetas();
            this.initializeCalendar();
        } catch (error) {
            console.error('Error al cargar compras:', error);
            this.showErrorMessage('Error al cargar las compras');
        }
    }

    // FUNCIONES DE CÁLCULO
    calcularCostoUnitario() {
        const costoTotal = parseFloat(document.getElementById('costoTotalCompra').value) || 0;
        const cantidad = parseInt(document.getElementById('cantidadCompra').value) || 1;

        const costoUnitario = cantidad > 0 ? costoTotal / cantidad : 0;
        document.getElementById('costoUnitarioCompra').value = costoUnitario.toFixed(2);
    }

    calcularPagoMensual() {
        const costoTotal = parseFloat(document.getElementById('costoTotalCompra').value) || 0;
        const numeroMeses = parseInt(document.getElementById('numeroMeses').value) || 1;
        const esMSI = document.getElementById('esMesesSinIntereses').checked;

        if (esMSI && numeroMeses > 0) {
            const pagoMensual = costoTotal / numeroMeses;
            document.getElementById('pagoMensual').value = pagoMensual.toFixed(2);
        } else {
            document.getElementById('pagoMensual').value = '';
        }
    }

    toggleMesesSinIntereses(show) {
        const mesesRow = document.getElementById('mesesSinInteresesRow');
        mesesRow.style.display = show ? 'flex' : 'none';

        if (!show) {
            document.getElementById('numeroMeses').value = '';
            document.getElementById('pagoMensual').value = '';
        }
    }

    // FUNCIONES DE RENDERIZADO
    renderTarjetas() {
        const grid = document.getElementById('tarjetasGrid');

        if (this.tarjetas.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-credit-card" style="font-size: 3rem; color: var(--gris-medio); margin-bottom: 1rem;"></i>
                    <p>No hay tarjetas registradas</p>
                    <p>Comienza agregando tu primera tarjeta</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.tarjetas.map(tarjeta => this.createTarjetaCard(tarjeta)).join('');
    }

    createTarjetaCard(tarjeta) {
        const comprasTarjeta = this.compras.filter(c => c.tarjetaId === tarjeta.id);
        const totalGastado = comprasTarjeta.reduce((sum, c) => sum + (c.costoTotal || 0), 0);
        const compraMSI = comprasTarjeta.filter(c => c.esMesesSinIntereses);

        const fechaProximoPago = this.calcularProximoPago(tarjeta);
        const disponible = tarjeta.limiteCredito ? tarjeta.limiteCredito - totalGastado : null;

        return `
            <div class="tarjeta-card color-${tarjeta.color || 'blue'}" onclick="comprasManager.openComprasTarjetaModal('${tarjeta.id}')">
                <div class="tarjeta-header">
                    <div class="tarjeta-tipo">${tarjeta.tipo === 'credito' ? 'CRÉDITO' : 'DÉBITO'}</div>
                    <div class="tarjeta-nombre">${tarjeta.nombre}</div>
                    ${tarjeta.ultimos4Digitos ? `<div class="tarjeta-numero">**** **** **** ${tarjeta.ultimos4Digitos}</div>` : ''}
                </div>
                
                <div class="tarjeta-info">
                    ${tarjeta.limiteCredito ? `
                        <div class="tarjeta-info-item">
                            <label>Límite</label>
                            <span>$${tarjeta.limiteCredito.toLocaleString()}</span>
                        </div>
                        <div class="tarjeta-info-item">
                            <label>Disponible</label>
                            <span>$${disponible ? disponible.toLocaleString() : '0'}</span>
                        </div>
                    ` : ''}
                    ${tarjeta.fechaCorte ? `
                        <div class="tarjeta-info-item">
                            <label>Corte</label>
                            <span>Día ${tarjeta.fechaCorte}</span>
                        </div>
                    ` : ''}
                    ${fechaProximoPago ? `
                        <div class="tarjeta-info-item">
                            <label>Próximo Pago</label>
                            <span>${fechaProximoPago}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="tarjeta-resumen">
                    <div class="resumen-item">
                        <span>Total Gastado:</span>
                        <span>$${totalGastado.toLocaleString()}</span>
                    </div>
                    <div class="resumen-item">
                        <span>Compras:</span>
                        <span>${comprasTarjeta.length}</span>
                    </div>
                    ${compraMSI.length > 0 ? `
                        <div class="resumen-item">
                            <span>MSI Activos:</span>
                            <span>${compraMSI.length}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="tarjeta-actions" onclick="event.stopPropagation()">
                    <button class="btn-tarjeta" onclick="comprasManager.openCompraModal(null, '${tarjeta.id}')">
                        <i class="fas fa-plus"></i> Compra
                    </button>
                    <button class="btn-tarjeta" onclick="comprasManager.openTarjetaModal({id: '${tarjeta.id}', ...${JSON.stringify(tarjeta).replace(/"/g, '&quot;')}})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-tarjeta" onclick="comprasManager.deleteTarjeta('${tarjeta.id}', '${tarjeta.nombre}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    }

    createCompraItem(compra) {
        const fecha = new Date(compra.fechaCompra).toLocaleDateString('es-MX');

        return `
            <div class="compra-item" onclick="comprasManager.openCompraModal({id: '${compra.id}', ...${JSON.stringify(compra).replace(/"/g, '&quot;')}})">
                <div class="compra-header">
                    <span class="compra-nombre">${compra.nombreProducto}</span>
                    <span class="compra-fecha">${fecha}</span>
                </div>
                <div class="compra-details">
                    <div>Total: $${compra.costoTotal ? compra.costoTotal.toLocaleString() : '0'}</div>
                    <div>Cantidad: ${compra.cantidad || 0}</div>
                </div>
                ${compra.esMesesSinIntereses ? `<span class="compra-msi">${compra.numeroMeses} MSI</span>` : ''}
            </div>
        `;
    }

    calcularProximoPago(tarjeta) {
        if (!tarjeta.fechaCorte || !tarjeta.diasPago) return null;

        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const añoActual = hoy.getFullYear();

        let fechaCorte = new Date(añoActual, mesActual, tarjeta.fechaCorte);

        // Si ya pasó el corte de este mes, calcular para el siguiente
        if (hoy > fechaCorte) {
            fechaCorte = new Date(añoActual, mesActual + 1, tarjeta.fechaCorte);
        }

        const fechaPago = new Date(fechaCorte);
        fechaPago.setDate(fechaPago.getDate() + tarjeta.diasPago);

        return fechaPago.toLocaleDateString('es-MX');
    }

    // FUNCIONES DE FILTROS
    filterCompras() {
        // Por ahora solo renderizar todas las tarjetas
        // Se puede implementar filtrado más avanzado aquí
        this.renderTarjetas();
    }

    clearFilters() {
        document.getElementById('searchCompras').value = '';
        document.getElementById('filterTarjeta').value = '';
        document.getElementById('filterMes').value = '';
        this.filterCompras();
    }

    // FUNCIONES DE ELIMINACIÓN
    async deleteTarjeta(id, nombre) {
        const comprasTarjeta = this.compras.filter(c => c.tarjetaId === id);

        if (comprasTarjeta.length > 0) {
            if (!confirm(`La tarjeta "${nombre}" tiene ${comprasTarjeta.length} compras asociadas. ¿Estás seguro de eliminarla? Esto también eliminará todas las compras.`)) {
                return;
            }

            // Eliminar todas las compras de la tarjeta
            for (const compra of comprasTarjeta) {
                await db.collection('compras').doc(compra.id).delete();
            }
        } else {
            if (!confirm(`¿Estás seguro de que quieres eliminar la tarjeta "${nombre}"?`)) {
                return;
            }
        }

        try {
            await db.collection('tarjetas').doc(id).delete();
            this.loadTarjetas();
            this.showSuccessMessage('Tarjeta eliminada correctamente');
        } catch (error) {
            console.error('Error al eliminar tarjeta:', error);
            this.showErrorMessage('Error al eliminar la tarjeta');
        }
    }

    // INTEGRACIÓN CON INVENTARIO
    openCompraFromProduct(productData) {
        // Esta función será llamada desde inventario
        this.openCompraModal();

        // Prellenar datos del producto
        document.getElementById('nombreProductoCompra').value = productData.nombreProducto || '';
        document.getElementById('costoTotalCompra').value = productData.costoTotal || '';
        document.getElementById('cantidadCompra').value = productData.cantidadComprada || '';
        document.getElementById('categoriaCompra').value = productData.categoria || '';

        // Calcular costo unitario
        this.calcularCostoUnitario();
    }

    showSuccessMessage(message) {
        alert(message);
    }

    showErrorMessage(message) {
        alert(message);
    }

    // FUNCIONES DEL MODAL DE COMPRAS DE TARJETA
    openComprasTarjetaModal(tarjetaId) {
        const tarjeta = this.tarjetas.find(t => t.id === tarjetaId);
        if (!tarjeta) return;

        this.currentTarjetaModal = tarjeta;
        const comprasTarjeta = this.compras.filter(c => c.tarjetaId === tarjetaId);

        // Actualizar título
        document.getElementById('comprasTarjetaTitle').textContent = `Compras - ${tarjeta.nombre}`;

        // Llenar información de la tarjeta
        this.fillTarjetaInfoModal(tarjeta);

        // Llenar estadísticas
        this.fillTarjetaStatsModal(tarjeta, comprasTarjeta);

        // Llenar lista de compras
        this.fillComprasListModal(comprasTarjeta);

        // Mostrar modal
        document.getElementById('comprasTarjetaModal').style.display = 'block';
    }

    closeComprasTarjetaModal() {
        document.getElementById('comprasTarjetaModal').style.display = 'none';
        this.currentTarjetaModal = null;
    }

    fillTarjetaInfoModal(tarjeta) {
        const totalGastado = this.compras.filter(c => c.tarjetaId === tarjeta.id)
            .reduce((sum, c) => sum + (c.costoTotal || 0), 0);
        const disponible = tarjeta.limiteCredito ? tarjeta.limiteCredito - totalGastado : null;

        document.getElementById('tarjetaInfoModal').innerHTML = `
            <h4>${tarjeta.nombre} - ${tarjeta.tipo === 'credito' ? 'Crédito' : 'Débito'}</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                ${tarjeta.ultimos4Digitos ? `<div><strong>Número:</strong> **** **** **** ${tarjeta.ultimos4Digitos}</div>` : ''}
                ${tarjeta.limiteCredito ? `<div><strong>Límite:</strong> $${tarjeta.limiteCredito.toLocaleString()}</div>` : ''}
                ${disponible !== null ? `<div><strong>Disponible:</strong> $${disponible.toLocaleString()}</div>` : ''}
                ${tarjeta.fechaCorte ? `<div><strong>Corte:</strong> Día ${tarjeta.fechaCorte}</div>` : ''}
                ${tarjeta.diasPago ? `<div><strong>Días para pago:</strong> ${tarjeta.diasPago} días</div>` : ''}
            </div>
        `;
    }

    fillTarjetaStatsModal(tarjeta, comprasTarjeta) {
        const totalGastado = comprasTarjeta.reduce((sum, c) => sum + (c.costoTotal || 0), 0);
        const compraMSI = comprasTarjeta.filter(c => c.esMesesSinIntereses);
        const pagosPendientes = this.calcularPagosPendientes(comprasTarjeta);

        document.getElementById('tarjetaStatsModal').innerHTML = `
            <div class="stat-item">
                <h4>Total Gastado</h4>
                <div class="amount">$${totalGastado.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <h4>Compras Realizadas</h4>
                <div class="amount">${comprasTarjeta.length}</div>
            </div>
            <div class="stat-item">
                <h4>MSI Activos</h4>
                <div class="amount">${compraMSI.length}</div>
            </div>
            <div class="stat-item">
                <h4>Pagos Pendientes</h4>
                <div class="amount">$${pagosPendientes.toLocaleString()}</div>
            </div>
        `;
    }

    fillComprasListModal(comprasTarjeta) {
        const content = document.getElementById('comprasListContent');

        if (comprasTarjeta.length === 0) {
            content.innerHTML = `
                <div class="empty-compras-modal">
                    <i class="fas fa-shopping-cart"></i>
                    <p>No hay compras registradas en esta tarjeta</p>
                </div>
            `;
            return;
        }

        content.innerHTML = comprasTarjeta.map(compra => {
            const fecha = new Date(compra.fechaCompra).toLocaleDateString('es-MX');
            return `
                <div class="compra-item-modal">
                    <div class="compra-header-modal">
                        <div class="compra-info-modal">
                            <h5>${compra.nombreProducto}</h5>
                            <div class="compra-fecha-modal">${fecha}</div>
                        </div>
                        <div class="compra-amount">
                            <div class="total">$${compra.costoTotal ? compra.costoTotal.toLocaleString() : '0'}</div>
                            ${compra.esMesesSinIntereses ? `<span class="compra-msi-modal">${compra.numeroMeses} MSI</span>` : ''}
                        </div>
                    </div>
                    <div class="compra-details-modal">
                        <div class="detail-item">
                            <label>Cantidad</label>
                            <span>${compra.cantidad || 0}</span>
                        </div>
                        <div class="detail-item">
                            <label>Precio Unitario</label>
                            <span>$${compra.costoUnitario ? compra.costoUnitario.toFixed(2) : '0'}</span>
                        </div>
                        ${compra.categoria ? `
                            <div class="detail-item">
                                <label>Categoría</label>
                                <span>${compra.categoria}</span>
                            </div>
                        ` : ''}
                        ${compra.esMesesSinIntereses && compra.pagoMensual ? `
                            <div class="detail-item">
                                <label>Pago Mensual</label>
                                <span>$${compra.pagoMensual.toFixed(2)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    calcularPagosPendientes(comprasTarjeta) {
        return comprasTarjeta.filter(c => c.esMesesSinIntereses)
            .reduce((sum, c) => sum + (c.costoTotal || 0), 0);
    }

    // FUNCIONES DEL CALENDARIO
    initializeCalendar() {
        this.renderCalendar();
    }

    changeMonth(direction) {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + direction);
        this.renderCalendar();
    }

    renderCalendar() {
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();

        // Actualizar título del mes
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

        // Generar días del calendario
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        let calendarHTML = `
            <div class="calendario-header-day">Dom</div>
            <div class="calendario-header-day">Lun</div>
            <div class="calendario-header-day">Mar</div>
            <div class="calendario-header-day">Mié</div>
            <div class="calendario-header-day">Jue</div>
            <div class="calendario-header-day">Vie</div>
            <div class="calendario-header-day">Sáb</div>
        `;

        // Días del mes anterior
        const prevMonth = new Date(year, month - 1, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            calendarHTML += `<div class="calendario-day other-month">
                <div class="day-number">${prevMonth - i}</div>
            </div>`;
        }

        // Días del mes actual
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const isToday = currentDate.toDateString() === today.toDateString();
            const payments = this.getPaymentsForDate(currentDate);
            const cortes = this.getCortesForDate(currentDate);

            let dayClass = 'calendario-day';
            if (isToday) dayClass += ' today';
            if (payments.length > 0) dayClass += ' has-payment';
            if (cortes.length > 0) dayClass += ' has-corte';

            let eventsHTML = '';
            payments.forEach(payment => {
                eventsHTML += `<div class="payment-item" title="${payment.descripcion}">$${payment.monto.toLocaleString()}</div>`;
            });
            cortes.forEach(corte => {
                eventsHTML += `<div class="corte-item" title="Corte ${corte.tarjeta}">Corte</div>`;
            });

            calendarHTML += `<div class="${dayClass}">
                <div class="day-number">${day}</div>
                ${eventsHTML}
            </div>`;
        }

        // Días del mes siguiente
        const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
        const remainingCells = totalCells - firstDay - daysInMonth;
        for (let day = 1; day <= remainingCells; day++) {
            calendarHTML += `<div class="calendario-day other-month">
                <div class="day-number">${day}</div>
            </div>`;
        }

        document.getElementById('calendarioGrid').innerHTML = calendarHTML;
    }

    getPaymentsForDate(date) {
        const payments = [];
        const day = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();

        // Buscar pagos de tarjetas regulares
        this.tarjetas.forEach(tarjeta => {
            if (tarjeta.fechaCorte && tarjeta.diasPago) {
                const fechaPago = this.calcularFechaPago(tarjeta, date);
                if (fechaPago && fechaPago.getDate() === day && fechaPago.getMonth() === month && fechaPago.getFullYear() === year) {
                    const montoTotal = this.compras.filter(c => c.tarjetaId === tarjeta.id && !c.esMesesSinIntereses)
                        .reduce((sum, c) => sum + (c.costoTotal || 0), 0);
                    if (montoTotal > 0) {
                        payments.push({
                            descripcion: `Pago ${tarjeta.nombre}`,
                            monto: montoTotal,
                            tipo: 'pago_regular'
                        });
                    }
                }
            }
        });

        // Buscar pagos de MSI
        this.compras.filter(c => c.esMesesSinIntereses).forEach(compra => {
            const fechaCompra = new Date(compra.fechaCompra);
            const mesesPagados = this.calcularMesesPagados(fechaCompra, date);

            if (mesesPagados < compra.numeroMeses) {
                const fechaPagoMSI = new Date(fechaCompra.getFullYear(), fechaCompra.getMonth() + mesesPagados + 1, fechaCompra.getDate());
                if (fechaPagoMSI.getDate() === day && fechaPagoMSI.getMonth() === month && fechaPagoMSI.getFullYear() === year) {
                    payments.push({
                        descripcion: `MSI ${compra.nombreProducto}`,
                        monto: compra.pagoMensual || 0,
                        tipo: 'pago_msi'
                    });
                }
            }
        });

        return payments;
    }

    getCortesForDate(date) {
        const cortes = [];
        const day = date.getDate();

        this.tarjetas.forEach(tarjeta => {
            if (tarjeta.fechaCorte && tarjeta.fechaCorte === day) {
                cortes.push({
                    tarjeta: tarjeta.nombre,
                    fecha: tarjeta.fechaCorte
                });
            }
        });

        return cortes;
    }

    calcularFechaPago(tarjeta, fechaReferencia) {
        if (!tarjeta.fechaCorte || !tarjeta.diasPago) return null;

        const year = fechaReferencia.getFullYear();
        const month = fechaReferencia.getMonth();

        let fechaCorte = new Date(year, month, tarjeta.fechaCorte);

        // Si la fecha de corte ya pasó este mes, usar el siguiente
        if (fechaCorte < fechaReferencia) {
            fechaCorte = new Date(year, month + 1, tarjeta.fechaCorte);
        }

        const fechaPago = new Date(fechaCorte);
        fechaPago.setDate(fechaPago.getDate() + tarjeta.diasPago);

        return fechaPago;
    }

    calcularMesesPagados(fechaCompra, fechaActual) {
        const diffTime = fechaActual - fechaCompra;
        const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
        return Math.max(0, diffMonths);
    }
}

// Inicializar el gestor de compras
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('compras-section')) {
        window.comprasManager = new ComprasManager();
    }
});