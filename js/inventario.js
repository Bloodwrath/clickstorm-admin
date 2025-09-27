// inventario.js
class InventarioManager {
    constructor() {
        this.productos = [];
        this.proveedores = [];
        this.materiasPrimasDisponibles = [];
        this.carritoMateriasPrimas = [];
        this.editingId = null;
        this.currentImageChunks = null;
        this.shouldRestoreProductModal = false; // Para controlar la restauración del modal
        this.currentViewingProduct = null; // Producto que se está viendo en detalles

        // Definir subcategorías por categoría
        this.subcategorias = {
            sublimacion: [
                'Tazas cerámicas', 'Tazas de polímero', 'Playeras poliéster',
                'Playeras algodón-poliéster', 'Mouse pads', 'Placas de metal',
                'Papel de sublimación', 'Tinta de sublimación', 'Protector térmico',
                'Termos', 'Platos', 'Azulejos', 'Cojines', 'Gorras'
            ],
            grabado_laser: [
                'Madera MDF', 'Madera pino', 'Acrílico transparente', 'Acrílico de color',
                'Metal aluminio', 'Acero inoxidable', 'Cuero natural', 'Cuero sintético',
                'Vidrio', 'Papel cartón', 'Goma EVA', 'Corcho', 'Bambú'
            ],
            publicidad: [
                'Vinil adhesivo', 'Lona', 'Papel couché', 'Cartulina',
                'Foam board', 'Banner', 'Microperforado', 'Vinil textil',
                'Papel fotográfico', 'Canvas', 'Backlight', 'One way'
            ]
        };

        this.initializeEventListeners();
        this.loadProveedores();
        this.loadProductos();
        this.loadMateriasPrimas();
    }

    initializeEventListeners() {
        // Botón agregar producto
        document.getElementById('addProductoBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Cerrar modal
        document.getElementById('closeProductoModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('productoCancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // Formulario
        document.getElementById('productoForm').addEventListener('submit', (e) => {
            this.handleSubmit(e);
        });

        // Upload de foto
        document.getElementById('productoFotoPreview').addEventListener('click', () => {
            document.getElementById('productoFotoInput').click();
        });

        document.getElementById('productoFotoInput').addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });

        // Cambios en tipo de producto
        document.getElementById('tipoProducto').addEventListener('change', (e) => {
            this.toggleProductSections(e.target.value);
        });

        // Cambios en categoría
        document.getElementById('categoria').addEventListener('change', (e) => {
            this.loadSubcategorias(e.target.value);
        });

        // Cambios en proveedor
        document.getElementById('proveedorSelect').addEventListener('change', (e) => {
            if (e.target.value === 'agregar_nuevo') {
                this.openProveedorModal();
            }
        });

        // Cálculos automáticos para materia prima
        document.getElementById('costoTotal').addEventListener('input', () => {
            this.calcularPrecioUnitario();
        });

        document.getElementById('cantidadAgregar').addEventListener('input', () => {
            this.calcularPrecioUnitario();
        });

        // Checkbox personalizable
        document.getElementById('esPersonalizable').addEventListener('change', (e) => {
            this.toggleDimensiones(e.target.checked);
        });

        // Búsqueda de materia prima
        document.getElementById('searchMateriaPrima').addEventListener('input', (e) => {
            this.searchMateriasPrimas(e.target.value);
        });

        // Filtros
        document.getElementById('searchInventario').addEventListener('input', (e) => {
            this.filterProductos();
        });

        document.getElementById('filterTipoProducto').addEventListener('change', () => {
            this.filterProductos();
        });

        document.getElementById('filterCategoria').addEventListener('change', () => {
            this.filterProductos();
        });

        // Escáner de código de barras
        document.getElementById('scanBarcodeBtn').addEventListener('click', () => {
            this.initBarcodeScanner();
        });

        // Cerrar modal al hacer click fuera
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('productoModal');
            if (e.target === modal) {
                this.closeModal();
            }

            const detallesModal = document.getElementById('detallesProductoModal');
            if (e.target === detallesModal) {
                this.closeDetallesModal();
            }
        });

        // Modal de detalles
        document.getElementById('closeDetallesModal').addEventListener('click', () => {
            this.closeDetallesModal();
        });

        document.getElementById('closeDetallesBtn').addEventListener('click', () => {
            this.closeDetallesModal();
        });
    }

    // Funciones de imágenes (reutilizadas de proveedores)
    divideImageIntoChunks(base64String) {
        const maxChunkSize = 1048487;
        const chunks = [];

        for (let i = 0; i < base64String.length; i += maxChunkSize) {
            chunks.push(base64String.slice(i, i + maxChunkSize));
        }

        return chunks;
    }

    reconstructImageFromChunks(chunks) {
        if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            return null;
        }
        return chunks.join('');
    }

    compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    async handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                const preview = document.getElementById('productoFotoPreview');
                preview.innerHTML = `
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Procesando imagen...</span>
                `;

                const compressedBase64 = await this.compressImage(file);
                this.currentImageChunks = this.divideImageIntoChunks(compressedBase64);
                this.showPhotoPreview(compressedBase64);

                console.log(`Imagen procesada: ${this.currentImageChunks.length} chunks`);
            } catch (error) {
                console.error('Error al procesar imagen:', error);
                this.showErrorMessage('Error al procesar la imagen');
                this.resetPhotoPreview();
            }
        }
    }

    showPhotoPreview(src) {
        const preview = document.getElementById('productoFotoPreview');
        preview.innerHTML = `<img src="${src}" alt="Preview">`;
    }

    resetPhotoPreview() {
        const preview = document.getElementById('productoFotoPreview');
        preview.innerHTML = `
            <i class="fas fa-camera"></i>
            <span>Subir foto</span>
        `;
    }

    // Cargar proveedores para el dropdown
    async loadProveedores() {
        try {
            const querySnapshot = await db.collection('proveedores').orderBy('nombreNegocio').get();
            this.proveedores = [];

            querySnapshot.forEach((doc) => {
                this.proveedores.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.updateProveedorSelect();
        } catch (error) {
            console.error('Error al cargar proveedores:', error);
        }
    }

    updateProveedorSelect() {
        const select = document.getElementById('proveedorSelect');
        const currentValue = select.value;

        // Limpiar opciones excepto las por defecto
        select.innerHTML = `
            <option value="">Seleccionar proveedor...</option>
            <option value="agregar_nuevo">+ Agregar nuevo proveedor</option>
        `;

        // Agregar proveedores
        this.proveedores.forEach(proveedor => {
            const option = document.createElement('option');
            option.value = proveedor.id;
            option.textContent = proveedor.nombreNegocio;
            select.appendChild(option);
        });

        // Restaurar valor si existía
        if (currentValue && currentValue !== 'agregar_nuevo') {
            select.value = currentValue;
        }
    }

    openProveedorModal() {
        // Abrir modal de proveedor desde inventario
        if (window.proveedoresManager) {
            // Ocultar temporalmente el modal de producto
            const productoModal = document.getElementById('productoModal');
            productoModal.style.display = 'none';

            // Opcional: Mostrar indicador
            const indicator = document.createElement('div');
            indicator.className = 'modal-indicator';
            indicator.id = 'modalIndicator';
            indicator.innerHTML = '<i class="fas fa-info-circle"></i> Agregando proveedor...';
            document.body.appendChild(indicator);



            // Marcar que debemos restaurar el modal de producto
            this.shouldRestoreProductModal = true;

            // Abrir modal de proveedor
            window.proveedoresManager.openModal();

            // Escuchar cuando se cierre el modal de proveedor
            const originalCloseModal = window.proveedoresManager.closeModal;
            const originalHandleSubmit = window.proveedoresManager.handleSubmit;

            // Sobrescribir función de cierre
            window.proveedoresManager.closeModal = () => {
                originalCloseModal.call(window.proveedoresManager);
                this.restoreProductModal();

                // Restaurar función original
                window.proveedoresManager.closeModal = originalCloseModal;
                window.proveedoresManager.handleSubmit = originalHandleSubmit;
            };

            // Sobrescribir función de submit para también recargar proveedores
            window.proveedoresManager.handleSubmit = async (e) => {
                e.preventDefault();

                const submitBtn = document.getElementById('saveBtn');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
                submitBtn.disabled = true;

                try {
                    const formData = window.proveedoresManager.getFormData();

                    if (window.proveedoresManager.editingId) {
                        await window.proveedoresManager.updateProveedor(window.proveedoresManager.editingId, formData);
                    } else {
                        await window.proveedoresManager.addProveedor(formData);
                    }

                    window.proveedoresManager.closeModal(); // Esto llamará a la función modificada arriba
                    // No necesitamos loadProveedores aquí porque se llamará en restoreProductModal
                    window.proveedoresManager.showSuccessMessage(window.proveedoresManager.editingId ? 'Proveedor actualizado correctamente' : 'Proveedor agregado correctamente');
                } catch (error) {
                    console.error('Error al guardar proveedor:', error);
                    window.proveedoresManager.showErrorMessage('Error al guardar el proveedor. Intenta con una imagen más pequeña.');
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            };
        }
    }

    restoreProductModal() {
        if (this.shouldRestoreProductModal) {
            // Opcional: Quitar indicador
            const indicator = document.getElementById('modalIndicator');
            if (indicator) {
                indicator.remove();
            }

            // Restaurar el modal de producto
            const productoModal = document.getElementById('productoModal');
            productoModal.style.display = 'block';

            // Recargar proveedores en el dropdown
            setTimeout(() => {
                this.loadProveedores();
            }, 300);

            // Resetear bandera
            this.shouldRestoreProductModal = false;
        }
    }

    toggleProductSections(tipoProducto) {
        const materiaPrimaSection = document.getElementById('materiaPrimaSection');
        const productoVentaSection = document.getElementById('productoVentaSection');

        if (tipoProducto === 'materia_prima') {
            materiaPrimaSection.style.display = 'block';
            productoVentaSection.style.display = 'none';
            this.setRequired(['costoTotal', 'cantidadAgregar'], true);
            this.setRequired(['precioMenudeoVenta', 'precioMayoreoVenta'], false);
        } else if (tipoProducto === 'producto_venta') {
            materiaPrimaSection.style.display = 'none';
            productoVentaSection.style.display = 'block';
            this.setRequired(['costoTotal', 'cantidadAgregar'], false);
            this.setRequired(['precioMenudeoVenta', 'precioMayoreoVenta'], true);
        } else {
            materiaPrimaSection.style.display = 'none';
            productoVentaSection.style.display = 'none';
            this.setRequired(['costoTotal', 'cantidadAgregar', 'precioMenudeoVenta', 'precioMayoreoVenta'], false);
        }
    }

    setRequired(fieldIds, required) {
        fieldIds.forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                field.required = required;
            }
        });
    }

    loadSubcategorias(categoria) {
        const subcategoriaSelect = document.getElementById('subcategoria');
        subcategoriaSelect.innerHTML = '<option value="">Seleccionar subcategoría...</option>';

        if (categoria && this.subcategorias[categoria]) {
            this.subcategorias[categoria].forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.toLowerCase().replace(/\s+/g, '_');
                option.textContent = sub;
                subcategoriaSelect.appendChild(option);
            });
        }
    }

    calcularPrecioUnitario() {
        const costoTotal = parseFloat(document.getElementById('costoTotal').value) || 0;
        const cantidad = parseInt(document.getElementById('cantidadAgregar').value) || 0;

        if (costoTotal > 0 && cantidad > 0) {
            const precioUnitario = costoTotal / cantidad;
            document.getElementById('precioUnitario').value = precioUnitario.toFixed(2);
        } else {
            document.getElementById('precioUnitario').value = '';
        }
    }

    toggleDimensiones(show) {
        const dimensionesRow = document.getElementById('dimensionesRow');
        dimensionesRow.style.display = show ? 'flex' : 'none';
    }

    // Cargar materias primas para búsqueda
    async loadMateriasPrimas() {
        try {
            const querySnapshot = await db.collection('productos')
                .where('tipoProducto', '==', 'materia_prima')
                .get();

            this.materiasPrimasDisponibles = [];
            querySnapshot.forEach((doc) => {
                this.materiasPrimasDisponibles.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        } catch (error) {
            console.error('Error al cargar materias primas:', error);
        }
    }

    searchMateriasPrimas(searchTerm) {
        const resultsDiv = document.getElementById('materiaPrimaResults');

        if (searchTerm.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        // Búsqueda flexible (no importa el orden de las palabras)
        const terms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
        const filtered = this.materiasPrimasDisponibles.filter(mp => {
            const nombreCompleto = mp.nombreProducto.toLowerCase();
            return terms.every(term => nombreCompleto.includes(term));
        });

        if (filtered.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item">No se encontraron materias primas</div>';
        } else {
            resultsDiv.innerHTML = filtered.map(mp => `
                <div class="search-result-item" onclick="inventarioManager.addMateriaPrimaToCarrito('${mp.id}')">
                    <strong>${mp.nombreProducto}</strong>
                    <br><small>Stock: ${mp.stockActual || 0} | Precio: $${mp.precioUnitario || 0}</small>
                </div>
            `).join('');
        }

        resultsDiv.style.display = 'block';
    }

    addMateriaPrimaToCarrito(materiaPrimaId) {
        const materiaPrima = this.materiasPrimasDisponibles.find(mp => mp.id === materiaPrimaId);
        if (!materiaPrima) return;

        // Verificar si ya está en el carrito
        const existingIndex = this.carritoMateriasPrimas.findIndex(item => item.id === materiaPrimaId);

        if (existingIndex >= 0) {
            // Ya existe, incrementar cantidad
            this.carritoMateriasPrimas[existingIndex].cantidad += 1;
        } else {
            // Agregar nuevo
            this.carritoMateriasPrimas.push({
                id: materiaPrimaId,
                nombre: materiaPrima.nombreProducto,
                precioUnitario: materiaPrima.precioUnitario || 0,
                cantidad: 1
            });
        }

        this.updateCarritoDisplay();
        this.calcularCostoProduccion();

        // Limpiar búsqueda
        document.getElementById('searchMateriaPrima').value = '';
        document.getElementById('materiaPrimaResults').style.display = 'none';
    }

    updateCarritoDisplay() {
        const carritoDiv = document.getElementById('carritoMateriasPrimas');

        if (this.carritoMateriasPrimas.length === 0) {
            carritoDiv.innerHTML = '<div class="empty-carrito">No hay materias primas agregadas</div>';
            return;
        }

        carritoDiv.innerHTML = this.carritoMateriasPrimas.map((item, index) => `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <strong>${item.nombre}</strong>
                    <br><small>$${item.precioUnitario} c/u</small>
                </div>
                <div class="carrito-item-controls">
                    <input type="number" class="cantidad-input" value="${item.cantidad}" 
                           min="1" onchange="inventarioManager.updateCantidadCarrito(${index}, this.value)">
                    <button type="button" class="btn-remove" onclick="inventarioManager.removeFromCarrito(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateCantidadCarrito(index, nuevaCantidad) {
        if (nuevaCantidad < 1) return;
        this.carritoMateriasPrimas[index].cantidad = parseInt(nuevaCantidad);
        this.calcularCostoProduccion();
    }

    removeFromCarrito(index) {
        this.carritoMateriasPrimas.splice(index, 1);
        this.updateCarritoDisplay();
        this.calcularCostoProduccion();
    }

    calcularCostoProduccion() {
        const total = this.carritoMateriasPrimas.reduce((sum, item) => {
            return sum + (item.precioUnitario * item.cantidad);
        }, 0);

        document.getElementById('costoProduccionTotal').textContent = total.toFixed(2);
    }

    // Función placeholder para escáner de código de barras
    initBarcodeScanner() {
        // Aquí se implementaría la funcionalidad del escáner
        // Por ahora solo mostramos un alert
        alert('Funcionalidad de escáner en desarrollo. Por ahora puedes escribir el código manualmente.');

        // Implementación futura con QuaggaJS o similar:
        /*
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Implementar escáner con cámara
        } else {
            alert('Tu navegador no soporta el acceso a la cámara');
        }
        */
    }

    openModal(producto = null) {
        const modal = document.getElementById('productoModal');
        const modalTitle = document.getElementById('productoModalTitle');
        const form = document.getElementById('productoForm');

        if (producto) {
            this.editingId = producto.id;
            modalTitle.textContent = 'Editar Producto';
            this.fillForm(producto);
        } else {
            this.editingId = null;
            modalTitle.textContent = 'Agregar Producto';
            form.reset();
            this.resetPhotoPreview();
            this.currentImageChunks = null;
            this.carritoMateriasPrimas = [];
            this.updateCarritoDisplay();
            this.calcularCostoProduccion();
        }

        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('productoModal');
        modal.style.display = 'none';
        this.editingId = null;
        this.currentImageChunks = null;
        this.carritoMateriasPrimas = [];
        this.shouldRestoreProductModal = false; // Resetear bandera al cerrar
        document.getElementById('productoForm').reset();
        this.resetPhotoPreview();
        this.toggleProductSections('');
    }

    fillForm(producto) {
        // Llenar campos básicos
        document.getElementById('nombreProducto').value = producto.nombreProducto || '';
        document.getElementById('codigoBarras').value = producto.codigoBarras || '';
        document.getElementById('proveedorSelect').value = producto.proveedorId || '';
        document.getElementById('tipoProducto').value = producto.tipoProducto || '';
        document.getElementById('categoria').value = producto.categoria || '';

        // Cargar subcategorías y seleccionar
        if (producto.categoria) {
            this.loadSubcategorias(producto.categoria);
            setTimeout(() => {
                document.getElementById('subcategoria').value = producto.subcategoria || '';
            }, 100);
        }

        // Mostrar sección apropiada
        this.toggleProductSections(producto.tipoProducto);

        // Llenar campos específicos según el tipo
        if (producto.tipoProducto === 'materia_prima') {
            document.getElementById('stockActual').value = producto.stockActual || 0;
            document.getElementById('precioUnitario').value = producto.precioUnitario || '';
            document.getElementById('costoMenudeo').value = producto.costoMenudeo || '';
            document.getElementById('costoMayoreo').value = producto.costoMayoreo || '';
            document.getElementById('esPersonalizable').checked = producto.esPersonalizable || false;

            if (producto.esPersonalizable) {
                this.toggleDimensiones(true);
                document.getElementById('anchoPersonalizable').value = producto.anchoPersonalizable || '';
                document.getElementById('altoPersonalizable').value = producto.altoPersonalizable || '';
            }
        } else if (producto.tipoProducto === 'producto_venta') {
            document.getElementById('precioMenudeoVenta').value = producto.precioMenudeo || '';
            document.getElementById('precioMayoreoVenta').value = producto.precioMayoreo || '';

            if (producto.materiasPrimas) {
                this.carritoMateriasPrimas = producto.materiasPrimas;
                this.updateCarritoDisplay();
                this.calcularCostoProduccion();
            }
        }

        // Mostrar imagen si existe
        if (producto.IMAGEN && producto.IMAGEN.length > 0) {
            const reconstructedImage = this.reconstructImageFromChunks(producto.IMAGEN);
            if (reconstructedImage) {
                this.showPhotoPreview(reconstructedImage);
                this.currentImageChunks = producto.IMAGEN;
            }
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('productoSaveBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        submitBtn.disabled = true;

        try {
            const formData = this.getFormData();

            if (this.editingId) {
                await this.updateProducto(this.editingId, formData);
            } else {
                await this.addProducto(formData);
            }

            // Verificar si se debe agregar compra
            const debeAgregarCompra = document.getElementById('agregarCompra').checked;
            const esNuevoProducto = !this.editingId;

            this.closeModal();
            this.loadProductos();
            this.loadMateriasPrimas(); // Recargar materias primas

            // Si es materia prima nueva y se marcó agregar compra
            if (esNuevoProducto && debeAgregarCompra && formData.tipoProducto === 'materia_prima') {
                // Guardar historial de precios
                await this.saveHistorialPrecios(formData, null); // null porque es nuevo producto

                // Abrir modal de compras con datos precargados
                setTimeout(() => {
                    if (window.comprasManager) {
                        window.comprasManager.openCompraFromProduct(formData);
                    }
                }, 500);

                this.showSuccessMessage('Producto agregado correctamente. Abriendo formulario de compra...');
            } else {
                this.showSuccessMessage(this.editingId ? 'Producto actualizado correctamente' : 'Producto agregado correctamente');
            }
        } catch (error) {
            console.error('Error al guardar producto:', error);
            this.showErrorMessage('Error al guardar el producto');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    getFormData() {
        const tipoProducto = document.getElementById('tipoProducto').value;

        const data = {
            nombreProducto: document.getElementById('nombreProducto').value.trim(),
            codigoBarras: document.getElementById('codigoBarras').value.trim(),
            proveedorId: document.getElementById('proveedorSelect').value || null,
            tipoProducto: tipoProducto,
            categoria: document.getElementById('categoria').value,
            subcategoria: document.getElementById('subcategoria').value || null,
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Solo agregar fechaCreacion si es nuevo
        if (!this.editingId) {
            data.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
        }

        // Agregar imagen si existe
        if (this.currentImageChunks && this.currentImageChunks.length > 0) {
            data.IMAGEN = this.currentImageChunks;
        }

        // Datos específicos según el tipo
        if (tipoProducto === 'materia_prima') {
            const costoTotal = parseFloat(document.getElementById('costoTotal').value) || 0;
            const cantidadAgregar = parseInt(document.getElementById('cantidadAgregar').value) || 0;
            const stockActual = parseInt(document.getElementById('stockActual').value) || 0;

            data.costoTotal = costoTotal;
            data.cantidadComprada = cantidadAgregar;
            data.stockActual = this.editingId ? stockActual + cantidadAgregar : cantidadAgregar;
            data.precioUnitario = costoTotal > 0 && cantidadAgregar > 0 ? costoTotal / cantidadAgregar : 0;
            data.costoMenudeo = parseFloat(document.getElementById('costoMenudeo').value) || null;
            data.costoMayoreo = parseFloat(document.getElementById('costoMayoreo').value) || null;
            data.esPersonalizable = document.getElementById('esPersonalizable').checked;

            if (data.esPersonalizable) {
                data.anchoPersonalizable = parseFloat(document.getElementById('anchoPersonalizable').value) || null;
                data.altoPersonalizable = parseFloat(document.getElementById('altoPersonalizable').value) || null;
            }
        } else if (tipoProducto === 'producto_venta') {
            data.precioMenudeo = parseFloat(document.getElementById('precioMenudeoVenta').value) || 0;
            data.precioMayoreo = parseFloat(document.getElementById('precioMayoreoVenta').value) || 0;
            data.materiasPrimas = this.carritoMateriasPrimas;
            data.costoProduccion = this.carritoMateriasPrimas.reduce((sum, item) => {
                return sum + (item.precioUnitario * item.cantidad);
            }, 0);
        }

        return data;
    }

    async addProducto(productoData) {
        await db.collection('productos').add(productoData);
    }

    async updateProducto(id, productoData) {
        await db.collection('productos').doc(id).update(productoData);
    }


    async saveHistorialPrecios(productoData, productoId) {
        if (productoData.tipoProducto === 'materia_prima' && productoData.costoTotal && productoData.cantidadComprada) {
            try {
                const historialData = {
                    productoId: productoId || 'nuevo', // Si es nuevo producto, se actualizará después
                    nombreProducto: productoData.nombreProducto,
                    costoTotal: productoData.costoTotal,
                    cantidad: productoData.cantidadComprada,
                    fechaCompra: firebase.firestore.FieldValue.serverTimestamp(),
                    fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('historial_precios').add(historialData);
            } catch (error) {
                console.error('Error al guardar historial:', error);
            }
        }
    }

    async loadProductos() {
        try {
            const querySnapshot = await db.collection('productos').orderBy('nombreProducto').get();
            this.productos = [];

            querySnapshot.forEach((doc) => {
                this.productos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderProductos();
        } catch (error) {
            console.error('Error al cargar productos:', error);
            this.showErrorMessage('Error al cargar los productos');
        }
    }

    filterProductos() {
        const searchTerm = document.getElementById('searchInventario').value.toLowerCase();
        const tipoFilter = document.getElementById('filterTipoProducto').value;
        const categoriaFilter = document.getElementById('filterCategoria').value;

        let filtered = this.productos.filter(producto => {
            const matchesSearch = producto.nombreProducto.toLowerCase().includes(searchTerm) ||
                (producto.codigoBarras && producto.codigoBarras.includes(searchTerm));
            const matchesTipo = !tipoFilter || producto.tipoProducto === tipoFilter;
            const matchesCategoria = !categoriaFilter || producto.categoria === categoriaFilter;

            return matchesSearch && matchesTipo && matchesCategoria;
        });

        this.renderProductos(filtered);
    }

    renderProductos(productosList = null) {
        const grid = document.getElementById('inventarioGrid');
        const productos = productosList || this.productos;

        if (productos.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-boxes" style="font-size: 3rem; color: var(--gris-medio); margin-bottom: 1rem;"></i>
                    <p>No hay productos registrados</p>
                    <p>Comienza agregando tu primer producto</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = productos.map(producto => this.createProductoCard(producto)).join('');
    }

    createProductoCard(producto) {
        // Reconstruir imagen si existe
        let imageSrc = null;
        if (producto.IMAGEN && producto.IMAGEN.length > 0) {
            imageSrc = this.reconstructImageFromChunks(producto.IMAGEN);
        }

        // Obtener nombre del proveedor
        const proveedor = this.proveedores.find(p => p.id === producto.proveedorId);
        const nombreProveedor = proveedor ? proveedor.nombreNegocio : 'Sin proveedor';

        // Determinar estado del stock
        const stockClass = producto.tipoProducto === 'materia_prima' ?
            (producto.stockActual <= 5 ? 'stock-low' : 'stock-normal') : '';

        // Información específica según el tipo
        let detallesEspecificos = '';
        if (producto.tipoProducto === 'materia_prima') {
            detallesEspecificos = `
                <div><strong>Stock:</strong> <span class="${stockClass}">${producto.stockActual || 0}</span></div>
                <div><strong>Precio unitario:</strong> $${producto.precioUnitario || 0}</div>
                ${producto.costoMenudeo ? `<div><strong>Menudeo:</strong> $${producto.costoMenudeo}</div>` : ''}
                ${producto.costoMayoreo ? `<div><strong>Mayoreo:</strong> $${producto.costoMayoreo}</div>` : ''}
            `;
        } else if (producto.tipoProducto === 'producto_venta') {
            detallesEspecificos = `
                <div><strong>Precio menudeo:</strong> $${producto.precioMenudeo || 0}</div>
                <div><strong>Precio mayoreo:</strong> $${producto.precioMayoreo || 0}</div>
                <div><strong>Costo producción:</strong> $${producto.costoProduccion || 0}</div>
            `;
        }

        return `
            <div class="producto-card clickable-product" onclick="inventarioManager.openDetallesModal('${producto.id}')">
                <div class="producto-header">
                    ${imageSrc ?
                `<img src="${imageSrc}" alt="${producto.nombreProducto}" class="producto-image">` :
                '<i class="fas fa-cube producto-placeholder"></i>'
            }
                    <div class="producto-tipo-badge ${producto.tipoProducto === 'materia_prima' ? 'badge-materia-prima' : 'badge-producto-venta'}">
                        ${producto.tipoProducto === 'materia_prima' ? 'Materia Prima' : 'Producto de Venta'}
                    </div>
                </div>
                
                <div class="producto-info">
                    <h4>${producto.nombreProducto}</h4>
                    <div class="producto-categoria">${this.getCategoriaDisplay(producto.categoria)}</div>
                    
                    <div class="producto-details">
                        ${producto.codigoBarras ? `<div><strong>Código:</strong> ${producto.codigoBarras}</div>` : ''}
                        <div><strong>Proveedor:</strong> ${nombreProveedor}</div>
                        ${detallesEspecificos}
                    </div>
                </div>
                
                <div class="producto-actions">
                    <button class="btn-edit" onclick="inventarioManager.editProducto('${producto.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="inventarioManager.deleteProducto('${producto.id}', '${producto.nombreProducto}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    }

    getCategoriaDisplay(categoria) {
        const categorias = {
            'sublimacion': 'Sublimación',
            'grabado_laser': 'Grabado Láser',
            'publicidad': 'Publicidad'
        };
        return categorias[categoria] || categoria;
    }

    editProducto(id) {
        const producto = this.productos.find(p => p.id === id);
        if (producto) {
            this.openModal(producto);
        }
    }

    async deleteProducto(id, nombre) {
        if (confirm(`¿Estás seguro de que quieres eliminar el producto "${nombre}"?`)) {
            try {
                await db.collection('productos').doc(id).delete();
                this.loadProductos();
                this.loadMateriasPrimas(); // Recargar materias primas
                this.showSuccessMessage('Producto eliminado correctamente');
            } catch (error) {
                console.error('Error al eliminar producto:', error);
                this.showErrorMessage('Error al eliminar el producto');
            }
        }
    }

    showSuccessMessage(message) {
        alert(message);
    }

    showErrorMessage(message) {
        alert(message);
    }

    // Funciones para modal de detalles
    openDetallesModal(productoId) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) return;

        this.currentViewingProduct = producto;

        // Llenar información básica
        document.getElementById('detallesNombre').textContent = producto.nombreProducto;
        document.getElementById('detallesTipo').textContent = producto.tipoProducto === 'materia_prima' ? 'Materia Prima' : 'Producto de Venta';
        document.getElementById('detallesTipo').className = `badge tipo-${producto.tipoProducto.replace('_', '-')}`;
        document.getElementById('detallesCategoria').textContent = this.getCategoriaDisplay(producto.categoria);
        document.getElementById('detallesCategoria').className = 'badge categoria';

        document.getElementById('detallesCodigoBarra').textContent = producto.codigoBarras || '-';

        // Proveedor
        const proveedor = this.proveedores.find(p => p.id === producto.proveedorId);
        document.getElementById('detallesProveedor').textContent = proveedor ? proveedor.nombreNegocio : 'Sin proveedor';

        // Imagen
        const imageLarge = document.getElementById('productoImageLarge');
        if (producto.IMAGEN && producto.IMAGEN.length > 0) {
            const imageSrc = this.reconstructImageFromChunks(producto.IMAGEN);
            imageLarge.innerHTML = `<img src="${imageSrc}" alt="${producto.nombreProducto}">`;
        } else {
            imageLarge.innerHTML = '<i class="fas fa-cube"></i>';
        }

        // Información específica según tipo
        if (producto.tipoProducto === 'materia_prima') {
            document.getElementById('stockInfo').style.display = 'block';
            document.getElementById('detallesStock').textContent = producto.stockActual || 0;

            let preciosHTML = '';
            if (producto.precioUnitario) preciosHTML += `<div>Unitario: $${producto.precioUnitario}</div>`;
            if (producto.costoMenudeo) preciosHTML += `<div>Menudeo: $${producto.costoMenudeo}</div>`;
            if (producto.costoMayoreo) preciosHTML += `<div>Mayoreo: $${producto.costoMayoreo}</div>`;
            document.getElementById('detallesPrecios').innerHTML = preciosHTML || 'No configurado';
        } else {
            document.getElementById('stockInfo').style.display = 'none';

            let preciosHTML = '';
            if (producto.precioMenudeo) preciosHTML += `<div>Menudeo: $${producto.precioMenudeo}</div>`;
            if (producto.precioMayoreo) preciosHTML += `<div>Mayoreo: $${producto.precioMayoreo}</div>`;
            if (producto.costoProduccion) preciosHTML += `<div>Costo Producción: $${producto.costoProduccion}</div>`;
            document.getElementById('detallesPrecios').innerHTML = preciosHTML || 'No configurado';
        }

        // Cargar historial de precios
        this.loadHistorialPrecios(productoId);

        // Mostrar modal
        document.getElementById('detallesProductoModal').style.display = 'block';
    }

    closeDetallesModal() {
        document.getElementById('detallesProductoModal').style.display = 'none';
        this.currentViewingProduct = null;
    }

    async loadHistorialPrecios(productoId) {
        try {
            const querySnapshot = await db.collection('historial_precios')
                .where('productoId', '==', productoId)
                .orderBy('fechaCompra', 'desc')
                .get();

            let historialHTML = '';

            if (querySnapshot.empty) {
                historialHTML = '<p style="text-align: center; color: var(--gris-medio);">No hay historial de precios</p>';
            } else {
                querySnapshot.forEach((doc) => {
                    const historial = doc.data();
                    const fecha = historial.fechaCompra.toDate ? historial.fechaCompra.toDate() : new Date(historial.fechaCompra);
                    const fechaFormateada = fecha.toLocaleDateString('es-MX');

                    const precioUnitario = historial.costoTotal && historial.cantidad ?
                        (historial.costoTotal / historial.cantidad).toFixed(2) : 'N/A';

                    historialHTML += `
                        <div class="historial-item">
                            <div class="historial-item-header">
                                <span class="historial-fecha">${fechaFormateada}</span>
                            </div>
                            <div class="historial-detalles">
                                <div><span>Costo Total:</span><span>$${historial.costoTotal || 0}</span></div>
                                <div><span>Cantidad:</span><span>${historial.cantidad || 0} piezas</span></div>
                                <div><span>Precio Unitario:</span><span>$${precioUnitario}</span></div>
                            </div>
                        </div>
                    `;
                });
            }

            document.getElementById('historialPrecios').innerHTML = historialHTML;
        } catch (error) {
            console.error('Error al cargar historial:', error);
            document.getElementById('historialPrecios').innerHTML = '<p style="color: var(--rojo-error);">Error al cargar historial</p>';
        }
    }
}

// Inicializar el gestor de inventario
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('inventario-section')) {
        window.inventarioManager = new InventarioManager();
    }
});