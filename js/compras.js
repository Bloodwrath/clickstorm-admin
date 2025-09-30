// compras.js
class ComprasManager {
    // Funciones de formato de números
    formatCurrency(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '$0.00';
        }

        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount).replace('MX$', '$');
    }

    formatNumber(number) {
        if (number === null || number === undefined || isNaN(number)) {
            return '0';
        }

        return new Intl.NumberFormat('es-MX').format(number);
    }

    // Helpers de fecha
    formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    sameYMD(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    // Fecha de corte para una compra dada la tarjeta
    calcularPeriodoCorte(fechaCompra, fechaCorte) {
        const compra = new Date(fechaCompra);
        const year = compra.getFullYear();
        const month = compra.getMonth();

        const corteDelMes = new Date(year, month, fechaCorte);
        if (compra > corteDelMes) {
            return new Date(year, month + 1, fechaCorte);
        } else {
            return corteDelMes;
        }
    }

    // Fecha de pago de una compra regular (no MSI)
    getRegularPaymentDate(compra, tarjeta) {
        if (!tarjeta || !tarjeta.fechaCorte || !tarjeta.diasPago) return null;
        const corte = this.calcularPeriodoCorte(compra.fechaCompra, tarjeta.fechaCorte);
        const fechaPago = new Date(corte.getFullYear(), corte.getMonth(), corte.getDate());
        fechaPago.setDate(fechaPago.getDate() + tarjeta.diasPago);
        return new Date(fechaPago.getFullYear(), fechaPago.getMonth(), fechaPago.getDate());
    }

    // Debug opcional
    debugPeriodoCorte(fechaCompra, fechaCorte, diasPago) {
        const compra = new Date(fechaCompra);
        const corte = this.calcularPeriodoCorte(fechaCompra, fechaCorte);
        const pago = new Date(corte);
        pago.setDate(pago.getDate() + diasPago);

        console.log({
            fechaCompra: compra.toLocaleDateString('es-MX'),
            fechaCorte: corte.toLocaleDateString('es-MX'),
            fechaPago: pago.toLocaleDateString('es-MX'),
            diasDespuesCorte: diasPago
        });
    }

    constructor() {
        this.tarjetas = [];
        this.compras = [];
        this.pagos = [];
        this.pagosRegularSet = new Set(); // keys: regular|tarjetaId|YYYY-MM-DD
        this.pagosMSISet = new Set();     // keys: msi|compraId|mesIndex
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
        const data = {
            nombre: document.getElementById('nombreTarjeta').value.trim(),
            tipo: document.getElementById('tipoTarjeta').value,
            limiteCredito: parseFloat(document.getElementById('limiteCredito').value) || 0,
            ultimos4Digitos: document.getElementById('ultimos4Digitos').value.trim(),
            fechaCorte: parseInt(document.getElementById('fechaCorte').value) || null,
            diasPago: parseInt(document.getElementById('diasPago').value) || null,
            color: document.getElementById('colorTarjeta').value,
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        return data;
    }

    async addTarjeta(tarjetaData) {
        await db.collection('tarjetas').add({
            ...tarjetaData,
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async updateTarjeta(id, tarjetaData) {
        Object.keys(tarjetaData).forEach(k => tarjetaData[k] === undefined && delete tarjetaData[k]);
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
            await this.loadCompras();
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
            const isEdit = !!this.editingCompraId;
            const formData = this.getCompraFormData();

            if (!isEdit) {
                formData.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
            }

            Object.keys(formData).forEach(k => formData[k] === undefined && delete formData[k]);

            if (isEdit) {
                await this.updateCompra(this.editingCompraId, formData);
            } else {
                await this.addCompra(formData);
            }

            this.closeCompraModal();
            await this.loadCompras();
            this.showSuccessMessage(isEdit ? 'Compra actualizada correctamente' : 'Compra agregada correctamente');
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
            costoUnitario: cantidad > 0 ? (costoTotal / cantidad) : 0,
            categoria: document.getElementById('categoriaCompra').value,
            esMesesSinIntereses: esMSI,
            numeroMeses: esMSI ? numeroMeses : null,
            pagoMensual: esMSI && numeroMeses ? costoTotal / numeroMeses : null,
            notas: document.getElementById('notasCompra').value.trim(),
            tarjetaId: document.getElementById('tarjetaIdCompra').value,
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

            await this.loadPagos();

            this.renderTarjetas();
            this.initializeCalendar();
        } catch (error) {
            console.error('Error al cargar compras:', error);
            this.showErrorMessage('Error al cargar las compras');
        }
    }

    // Cargar pagos marcados como "pagados"
    async loadPagos() {
        try {
            const qs = await db.collection('pagos').get();
            this.pagos = [];
            this.pagosRegularSet.clear();
            this.pagosMSISet.clear();

            qs.forEach(doc => {
                const data = doc.data();
                this.pagos.push({ id: doc.id, ...data });

                if (data.type === 'regular' && data.tarjetaId && data.fechaPago) {
                    this.pagosRegularSet.add(`regular|${data.tarjetaId}|${data.fechaPago}`);
                } else if (data.type === 'msi' && data.compraId && (data.mesIndex !== undefined)) {
                    this.pagosMSISet.add(`msi|${data.compraId}|${data.mesIndex}`);
                }
            });
        } catch (e) {
            console.error('Error al cargar pagos:', e);
        }
    }

    isRegularPaid(tarjetaId, fechaISO) {
        return this.pagosRegularSet.has(`regular|${tarjetaId}|${fechaISO}`);
    }

    isMSIPaid(compraId, mesIndex) {
        return this.pagosMSISet.has(`msi|${compraId}|${mesIndex}`);
    }

    // Marcar pagos como pagados
    async markRegularPaymentPaid(tarjetaId, fechaISO, amount) {
        try {
            if (this.isRegularPaid(tarjetaId, fechaISO)) return;
            await db.collection('pagos').add({
                type: 'regular',
                tarjetaId,
                fechaPago: fechaISO,
                amount: amount || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.loadPagos();
            this.renderCalendar();

            // Reabrir detalles del día
            const [y, m, d] = fechaISO.split('-').map(Number);
            this.reopenDayDetails(y, m - 1, d);
        } catch (e) {
            console.error('Error al marcar pago regular como pagado:', e);
            this.showErrorMessage('No se pudo marcar como pagado');
        }
    }

    async markMSIPaymentPaid(compraId, mesIndex, fechaISO, amount) {
        try {
            if (this.isMSIPaid(compraId, mesIndex)) return;
            const compra = this.compras.find(c => c.id === compraId);
            const tarjetaId = compra ? compra.tarjetaId : null;

            await db.collection('pagos').add({
                type: 'msi',
                compraId,
                tarjetaId,
                mesIndex,
                fechaPago: fechaISO,
                amount: amount || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.loadPagos();
            this.renderCalendar();

            const [y, m, d] = fechaISO.split('-').map(Number);
            this.reopenDayDetails(y, m - 1, d);
        } catch (e) {
            console.error('Error al marcar MSI como pagado:', e);
            this.showErrorMessage('No se pudo marcar como pagado');
        }
    }

    reopenDayDetails(year, monthIndex, day) {
        // Cerrar overlay actual si está abierto
        const overlay = document.querySelector('.day-details-overlay');
        if (overlay) overlay.remove();

        // Reabrir
        this.openDayDetails(`${year}-${monthIndex}-${day}`, String(day));
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
    renderTarjetas(comprasFiltradas = null) {
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

        grid.innerHTML = this.tarjetas.map(tarjeta => {
            const comprasAsociadas = comprasFiltradas
                ? comprasFiltradas.filter(c => c.tarjetaId === tarjeta.id)
                : this.compras.filter(c => c.tarjetaId === tarjeta.id);
            return this.createTarjetaCard(tarjeta, comprasAsociadas);
        }).join('');
    }

    createTarjetaCard(tarjeta, comprasTarjeta = null) {
        comprasTarjeta = comprasTarjeta || this.compras.filter(c => c.tarjetaId === tarjeta.id);
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
                    <span>${this.formatCurrency(tarjeta.limiteCredito)}</span>
                </div>
                <div class="tarjeta-info-item">
                    <label>Disponible</label>
                    <span>${this.formatCurrency(disponible || 0)}</span>
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
                <span>${this.formatCurrency(totalGastado)}</span>
            </div>
            <div class="resumen-item">
                <span>Compras:</span>
                <span>${this.formatNumber(comprasTarjeta.length)}</span>
            </div>
            ${compraMSI.length > 0 ? `
                <div class="resumen-item">
                    <span>MSI Activos:</span>
                    <span>${this.formatNumber(compraMSI.length)}</span>
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
            <button class="btn-tarjeta" onclick="comprasManager.deleteTarjeta('${tarjeta.id}', '${(tarjeta.nombre || '').replace(/'/g, "\\'")}')">
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
            <div>Total: ${this.formatCurrency(compra.costoTotal || 0)}</div>
            <div>Cantidad: ${this.formatNumber(compra.cantidad || 0)}</div>
        </div>
        ${compra.esMesesSinIntereses ? `<span class="compra-msi">${compra.numeroMeses} MSI</span>` : ''}
    </div>
`;
    }

    // Cálculo de próximo pago basado en fecha fija mensual (mostrar en tarjeta)
    calcularProximoPago(tarjeta) {
        if (!tarjeta.fechaCorte || !tarjeta.diasPago) return null;

        const comprasRelacionadas = this.compras.filter(c =>
            c.tarjetaId === tarjeta.id
        );
        if (comprasRelacionadas.length === 0) return null;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let fechaCorte = new Date(now.getFullYear(), now.getMonth(), tarjeta.fechaCorte);
        let fechaPago = new Date(fechaCorte);
        fechaPago.setDate(fechaPago.getDate() + tarjeta.diasPago);

        if (fechaPago < today) {
            fechaCorte = new Date(now.getFullYear(), now.getMonth() + 1, tarjeta.fechaCorte);
            fechaPago = new Date(fechaCorte);
            fechaPago.setDate(fechaPago.getDate() + tarjeta.diasPago);
        }

        return fechaPago.toLocaleDateString('es-MX');
    }

    // FUNCIONES DE FILTROS
    filterCompras() {
        const term = (document.getElementById('searchCompras').value || '').toLowerCase();
        const tarjetaId = document.getElementById('filterTarjeta').value;
        const mes = document.getElementById('filterMes').value; // formato YYYY-MM

        let filtered = this.compras;

        if (term) {
            filtered = filtered.filter(c =>
                (c.nombreProducto || '').toLowerCase().includes(term) ||
                (c.categoria || '').toLowerCase().includes(term)
            );
        }

        if (tarjetaId) {
            filtered = filtered.filter(c => c.tarjetaId === tarjetaId);
        }

        if (mes) {
            filtered = filtered.filter(c => (c.fechaCompra || '').startsWith(mes));
        }

        // Guardamos solo las compras filtradas para renderizado
        this.renderTarjetasConCompras(filtered);
    }

    clearFilters() {
        document.getElementById('searchCompras').value = '';
        document.getElementById('filterTarjeta').value = '';
        document.getElementById('filterMes').value = '';
        this.renderTarjetas(); // Mostrar todas otra vez
    }

    // FUNCIONES DE ELIMINACIÓN
    async deleteTarjeta(id, nombre) {
        const comprasTarjeta = this.compras.filter(c => c.tarjetaId === id);

        if (comprasTarjeta.length > 0) {
            if (!confirm(`La tarjeta "${nombre}" tiene ${comprasTarjeta.length} compras asociadas. ¿Estás seguro de eliminarla? Esto también eliminará todas las compras.`)) {
                return;
            }

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
        this.openCompraModal();

        document.getElementById('nombreProductoCompra').value = productData.nombreProducto || '';
        document.getElementById('costoTotalCompra').value = productData.costoTotal || '';
        document.getElementById('cantidadCompra').value = productData.cantidadComprada || '';
        document.getElementById('categoriaCompra').value = productData.categoria || '';
        this.calcularCostoUnitario();
    }

    showSuccessMessage(message) {
        const msg = document.createElement('div');
        msg.className = 'modal-indicator';
        msg.style.background = 'var(--verde-exito)';
        msg.textContent = message;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    showErrorMessage(message) {
        const msg = document.createElement('div');
        msg.className = 'modal-indicator';
        msg.style.background = 'var(--rojo-error)';
        msg.textContent = message;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    // MODAL DE COMPRAS DE TARJETA
    openComprasTarjetaModal(tarjetaId) {
        const tarjeta = this.tarjetas.find(t => t.id === tarjetaId);
        if (!tarjeta) return;

        this.currentTarjetaModal = tarjeta;
        const comprasTarjeta = this.compras.filter(c => c.tarjetaId === tarjetaId);

        document.getElementById('comprasTarjetaTitle').textContent = `Compras - ${tarjeta.nombre}`;
        this.fillTarjetaInfoModal(tarjeta);
        this.fillTarjetaStatsModal(tarjeta, comprasTarjeta);
        this.fillComprasListModal(comprasTarjeta);

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
            ${tarjeta.limiteCredito ? `<div><strong>Límite:</strong> ${this.formatCurrency(tarjeta.limiteCredito)}</div>` : ''}
            ${disponible !== null ? `<div><strong>Disponible:</strong> ${this.formatCurrency(disponible)}</div>` : ''}
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
        <div class="amount">${this.formatCurrency(totalGastado)}</div>
    </div>
    <div class="stat-item">
        <h4>Compras Realizadas</h4>
        <div class="amount">${this.formatNumber(comprasTarjeta.length)}</div>
    </div>
    <div class="stat-item">
        <h4>MSI Activos</h4>
        <div class="amount">${this.formatNumber(compraMSI.length)}</div>
    </div>
    <div class="stat-item">
        <h4>Pagos Pendientes</h4>
        <div class="amount">${this.formatCurrency(pagosPendientes)}</div>
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
                        <div class="total">${this.formatCurrency(compra.costoTotal || 0)}</div>
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
                        <span>${this.formatCurrency(compra.costoUnitario || 0)}</span>
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
                            <span>${this.formatCurrency(compra.pagoMensual)}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="compra-actions-modal">
                    <button class="btn-edit-small" onclick="comprasManager.editCompraFromModal('${compra.id}')" title="Editar compra">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete-small" onclick="comprasManager.deleteCompraFromModal('${compra.id}', '${(compra.nombreProducto || '').replace(/'/g, "\\'")}')" title="Eliminar compra">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    // Pagos pendientes MSI considerando meses no pagados desde HOY
    calcularPagosPendientes(comprasTarjeta) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        let total = 0;

        comprasTarjeta
            .filter(c => c.esMesesSinIntereses && c.numeroMeses && c.pagoMensual && c.tarjetaId)
            .forEach(compra => {
                const tarjeta = this.tarjetas.find(t => t.id === compra.tarjetaId);
                if (!tarjeta || !tarjeta.fechaCorte || !tarjeta.diasPago) return;

                const fechaCompra = new Date(compra.fechaCompra);

                // Primer corte después de la compra
                let fechaPrimerCorte = new Date(fechaCompra.getFullYear(), fechaCompra.getMonth(), tarjeta.fechaCorte);
                if (fechaCompra > fechaPrimerCorte) {
                    fechaPrimerCorte = new Date(fechaCompra.getFullYear(), fechaCompra.getMonth() + 1, tarjeta.fechaCorte);
                }

                const fechaPrimerPago = new Date(fechaPrimerCorte);
                fechaPrimerPago.setDate(fechaPrimerPago.getDate() + tarjeta.diasPago);

                for (let i = 0; i < compra.numeroMeses; i++) {
                    const fechaPagoMSI = new Date(fechaPrimerPago);
                    fechaPagoMSI.setMonth(fechaPrimerPago.getMonth() + i);
                    fechaPagoMSI.setHours(0, 0, 0, 0);

                    const iso = this.formatDateISO(fechaPagoMSI);
                    const pagado = this.isMSIPaid(compra.id, i + 1);

                    if (fechaPagoMSI >= hoy && !pagado) {
                        total += (compra.pagoMensual || 0);
                    }
                }
            });

        return total;
    }

    // CALENDARIO
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

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

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

        // Días mes anterior
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

            // Mostrar total del día si hay múltiples pagos
            if (payments.length > 0) {
                const totalDelDia = payments.reduce((sum, p) => sum + (p.monto || 0), 0);

                if (payments.length === 1) {
                    const payment = payments[0];
                    eventsHTML += `<div class="payment-item" title="${payment.descripcion}">${this.formatCurrency(payment.monto)}</div>`;
                } else {
                    const descripcionTotal = payments.map(p =>
                        `${p.tipo === 'pago_regular' ? 'Pago regular' : 'MSI'}: ${this.formatCurrency(p.monto)}`
                    ).join('\n');

                    eventsHTML += `<div class="payment-item payment-multiple" title="${descripcionTotal}">
                    <strong>${this.formatCurrency(totalDelDia)}</strong>
                    <small>(${payments.length} pagos)</small>
                </div>`;
                }
            }

            cortes.forEach(corte => {
                eventsHTML += `<div class="corte-item" title="Corte ${corte.tarjeta}">Corte</div>`;
            });

            calendarHTML += `<div class="${dayClass}" onclick="comprasManager.openDayDetails('${year}-${month}-${day}', '${day}')">
            <div class="day-number">${day}</div>
            ${eventsHTML}
        </div>`;
        }

        // Días del siguiente mes
        const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
        const remainingCells = totalCells - firstDay - daysInMonth;
        for (let day = 1; day <= remainingCells; day++) {
            calendarHTML += `<div class="calendario-day other-month">
            <div class="day-number">${day}</div>
        </div>`;
        }

        document.getElementById('calendarioGrid').innerHTML = calendarHTML;
    }

    // Obtener pagos para una fecha específica (arreglado para no repetir cargos regulares cada mes)
    getPaymentsForDate(date) {
        const payments = [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaISO = this.formatDateISO(date);

        // REGULARES: agrupar por tarjeta sólo compras cuyo pago coincide exactamente con esta fecha
        this.tarjetas.forEach(tarjeta => {
            const comprasRegulares = this.compras.filter(c => c.tarjetaId === tarjeta.id && !c.esMesesSinIntereses);

            const comprasDeEsteDia = [];
            comprasRegulares.forEach(c => {
                const fechaPago = this.getRegularPaymentDate(c, tarjeta);
                if (fechaPago && this.sameYMD(fechaPago, date)) {
                    comprasDeEsteDia.push(c);
                }
            });

            if (comprasDeEsteDia.length > 0) {
                const totalPago = comprasDeEsteDia.reduce((sum, c) => sum + (c.costoTotal || 0), 0);
                const pagado = this.isRegularPaid(tarjeta.id, fechaISO);

                payments.push({
                    descripcion: `Pago ${tarjeta.nombre}`,
                    monto: totalPago,
                    tipo: 'pago_regular',
                    tarjeta: tarjeta.nombre,
                    tarjetaId: tarjeta.id,
                    fechaPagoISO: fechaISO,
                    pagaderoDesdeHoy: date <= hoy,
                    paid: pagado,
                    compras: comprasDeEsteDia
                });
            }
        });

        // MSI: generar la cuota del mes si coincide con esta fecha, por compra
        this.compras
            .filter(c => c.esMesesSinIntereses && c.numeroMeses && c.pagoMensual && c.tarjetaId)
            .forEach(compra => {
                const tarjeta = this.tarjetas.find(t => t.id === compra.tarjetaId);
                if (!tarjeta || !tarjeta.fechaCorte || !tarjeta.diasPago) return;

                const fechaCompra = new Date(compra.fechaCompra);
                let fechaPrimerCorte = new Date(fechaCompra.getFullYear(), fechaCompra.getMonth(), tarjeta.fechaCorte);
                if (fechaCompra > fechaPrimerCorte) {
                    fechaPrimerCorte = new Date(fechaCompra.getFullYear(), fechaCompra.getMonth() + 1, tarjeta.fechaCorte);
                }

                const fechaPrimerPago = new Date(fechaPrimerCorte);
                fechaPrimerPago.setDate(fechaPrimerPago.getDate() + tarjeta.diasPago);

                for (let i = 0; i < compra.numeroMeses; i++) {
                    const fechaPagoMSI = new Date(fechaPrimerPago);
                    fechaPagoMSI.setMonth(fechaPrimerPago.getMonth() + i);

                    if (this.sameYMD(fechaPagoMSI, date)) {
                        const iso = this.formatDateISO(fechaPagoMSI);
                        const pagado = this.isMSIPaid(compra.id, i + 1);

                        payments.push({
                            descripcion: `MSI ${compra.nombreProducto} (${i + 1}/${compra.numeroMeses})`,
                            monto: compra.pagoMensual,
                            tipo: 'pago_msi',
                            compraId: compra.id,
                            tarjetaId: compra.tarjetaId,
                            mesActual: i + 1,
                            fechaPagoISO: iso,
                            pagaderoDesdeHoy: fechaPagoMSI <= hoy,
                            paid: pagado
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

    // Detalles del día con botón "Marcar pagado" cuando corresponda
    openDayDetails(dateKey, day) {
        const [year, month] = dateKey.split('-').map(Number);
        const date = new Date(year, month, parseInt(day));
        const payments = this.getPaymentsForDate(date);
        const cortes = this.getCortesForDate(date);

        if (payments.length === 0 && cortes.length === 0) return;

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        let detailsHTML = `
        <div class="day-details-modal">
            <div class="day-details-header">
                <h3>Detalles del ${day} de ${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month]} ${year}</h3>
                <span class="close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
            </div>
            <div class="day-details-content">
    `;

        if (payments.length > 0) {
            detailsHTML += '<h4>Pagos programados:</h4>';
            payments.forEach(payment => {
                const puedeMarcar = !payment.paid && (new Date(payment.fechaPagoISO) <= hoy);

                detailsHTML += `
                <div class="payment-detail">
                    <div class="payment-detail-header">
                        <strong>${payment.descripcion}</strong>
                        <span class="payment-amount">${this.formatCurrency(payment.monto)}</span>
                    </div>
            `;

                if (payment.tipo === 'pago_regular' && payment.compras) {
                    detailsHTML += '<div class="payment-breakdown"><h5>Compras incluidas:</h5>';
                    payment.compras.forEach(compra => {
                        const fecha = new Date(compra.fechaCompra).toLocaleDateString('es-MX');
                        detailsHTML += `
                        <div class="compra-breakdown-item">
                            <span>${compra.nombreProducto}</span>
                            <span>${fecha}</span>
                            <span>${this.formatCurrency(compra.costoTotal)}</span>
                        </div>
                    `;
                    });
                    detailsHTML += '</div>';
                }

                // Botón/estado de pago
                detailsHTML += `
                <div class="compra-actions-modal">
                    ${payment.paid ? `
                        <span style="font-weight:600; color: #28A745; display:inline-flex; align-items:center; gap:6px;">
                            <i class="fas fa-check-circle"></i> Pagado
                        </span>
                    ` : (puedeMarcar ? `
                        ${payment.tipo === 'pago_regular' ? `
                            <button class="btn-edit-small" onclick="comprasManager.markRegularPaymentPaid('${payment.tarjetaId}', '${payment.fechaPagoISO}', ${payment.monto || 0})" title="Marcar como pagado">
                                <i class="fas fa-check"></i> Marcar pagado
                            </button>
                        ` : `
                            <button class="btn-edit-small" onclick="comprasManager.markMSIPaymentPaid('${payment.compraId}', ${payment.mesActual}, '${payment.fechaPagoISO}', ${payment.monto || 0})" title="Marcar como pagado">
                                <i class="fas fa-check"></i> Marcar pagado
                            </button>
                        `}
                    ` : `
                        <small style="opacity:.7;">Aún no es fecha de pago</small>
                    `)}
                </div>
            `;

                detailsHTML += '</div>';
            });
        }

        if (cortes.length > 0) {
            detailsHTML += '<h4>Fechas de corte:</h4>';
            cortes.forEach(corte => {
                detailsHTML += `<div class="corte-detail">Corte de tarjeta: ${corte.tarjeta}</div>`;
            });
        }

        detailsHTML += '</div></div>';

        const modal = document.createElement('div');
        modal.className = 'day-details-overlay';
        modal.innerHTML = detailsHTML;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Editar compra desde modal (historial)
    async editCompraFromModal(compraId) {
        const compra = this.compras.find(c => c.id === compraId);
        if (compra) {
            this.closeComprasTarjetaModal();
            this.openCompraModal(compra);
        }
    }

    // Eliminar compra desde modal (historial)
    async deleteCompraFromModal(compraId, nombreProducto) {
        if (confirm(`¿Estás seguro de que quieres eliminar la compra "${nombreProducto}"?`)) {
            try {
                await db.collection('compras').doc(compraId).delete();

                // Recargar datos
                await this.loadCompras();

                // Si el modal de tarjeta sigue abierto, actualizarlo
                if (this.currentTarjetaModal) {
                    const comprasTarjeta = this.compras.filter(c => c.tarjetaId === this.currentTarjetaModal.id);
                    this.fillTarjetaStatsModal(this.currentTarjetaModal, comprasTarjeta);
                    this.fillComprasListModal(comprasTarjeta);
                }

                this.showSuccessMessage('Compra eliminada correctamente');
            } catch (error) {
                console.error('Error al eliminar compra:', error);
                this.showErrorMessage('Error al eliminar la compra');
            }
        }
    }
}

// Inicializar el gestor de compras
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('compras-section')) {
        window.comprasManager = new ComprasManager();
    }
});