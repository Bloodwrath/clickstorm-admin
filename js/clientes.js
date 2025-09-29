// clientes.js
class ClientesManager {
    constructor() {
        this.clientes = [];
        this.editingId = null;
        this.currentImageChunks = null; // Para almacenar los chunks de la imagen actual
        this.initializeEventListeners();
        this.loadClientes();
    }

    initializeEventListeners() {
        // Botón agregar cliente
        document.getElementById('addClienteBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Cerrar modal
        document.getElementById('closeClienteModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('clienteCancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // Formulario
        document.getElementById('clienteForm').addEventListener('submit', (e) => {
            this.handleSubmit(e);
        });

        // Upload de foto
        document.getElementById('clienteFotoPreview').addEventListener('click', () => {
            document.getElementById('clienteFotoInput').click();
        });

        document.getElementById('clienteFotoInput').addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });

        // Búsqueda
        document.getElementById('searchClientes').addEventListener('input', (e) => {
            this.filterClientes(e.target.value);
        });

        // Cerrar modal al hacer click fuera
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('clienteModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    // Función para dividir base64 en chunks
    divideImageIntoChunks(base64String) {
        const maxChunkSize = 1048487; // Máximo tamaño por chunk
        const chunks = [];

        for (let i = 0; i < base64String.length; i += maxChunkSize) {
            chunks.push(base64String.slice(i, i + maxChunkSize));
        }

        return chunks;
    }

    // Función para reconstruir imagen desde chunks
    reconstructImageFromChunks(chunks) {
        if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            return null;
        }
        return chunks.join('');
    }

    // Función para comprimir imagen antes de convertir a base64 (con revoke del ObjectURL)
    compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            const objectURL = URL.createObjectURL(file);

            img.onload = () => {
                // Calcular nuevas dimensiones manteniendo aspecto
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                // Dibujar imagen redimensionada
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a base64 con calidad especificada
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                URL.revokeObjectURL(objectURL);
                resolve(compressedBase64);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectURL);
                resolve(null);
            };

            img.src = objectURL;
        });
    }

    openModal(cliente = null) {
        const modal = document.getElementById('clienteModal');
        const modalTitle = document.getElementById('clienteModalTitle');
        const form = document.getElementById('clienteForm');

        if (cliente) {
            // Modo edición
            this.editingId = cliente.id;
            modalTitle.textContent = 'Editar Cliente';
            this.fillForm(cliente);
        } else {
            // Modo agregar
            this.editingId = null;
            modalTitle.textContent = 'Agregar Cliente';
            form.reset();
            this.resetPhotoPreview();
            this.currentImageChunks = null;
        }

        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('clienteModal');
        modal.style.display = 'none';
        this.editingId = null;
        this.currentImageChunks = null;
        document.getElementById('clienteForm').reset();
        this.resetPhotoPreview();
    }

    fillForm(cliente) {
        document.getElementById('nombreCliente').value = cliente.nombreCliente || '';
        document.getElementById('telefonoCliente').value = cliente.telefono || '';
        document.getElementById('correoCliente').value = cliente.correo || '';

        // Reconstruir imagen desde chunks si existe
        if (cliente.IMAGEN && cliente.IMAGEN.length > 0) {
            const reconstructedImage = this.reconstructImageFromChunks(cliente.IMAGEN);
            if (reconstructedImage) {
                this.showPhotoPreview(reconstructedImage);
                this.currentImageChunks = cliente.IMAGEN; // Mantener chunks existentes
            }
        }
    }

    async handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                // Mostrar indicador de carga
                const preview = document.getElementById('clienteFotoPreview');
                preview.innerHTML = `
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Procesando imagen...</span>
                `;

                // Comprimir imagen
                const compressedBase64 = await this.compressImage(file);
                if (!compressedBase64) {
                    throw new Error('No se pudo procesar la imagen');
                }

                // Dividir en chunks
                this.currentImageChunks = this.divideImageIntoChunks(compressedBase64);

                // Mostrar preview
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
        const preview = document.getElementById('clienteFotoPreview');
        preview.innerHTML = `<img src="${src}" alt="Preview">`;
    }

    resetPhotoPreview() {
        const preview = document.getElementById('clienteFotoPreview');
        preview.innerHTML = `
            <i class="fas fa-camera"></i>
            <span>Subir foto</span>
        `;
    }

    async handleSubmit(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('clienteSaveBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        submitBtn.disabled = true;

        try {
            const formData = this.getFormData();

            if (this.editingId) {
                await this.updateCliente(this.editingId, formData);
            } else {
                await this.addCliente(formData);
            }

            this.closeModal();
            this.loadClientes();
            this.showSuccessMessage(this.editingId ? 'Cliente actualizado correctamente' : 'Cliente agregado correctamente');
        } catch (error) {
            console.error('Error al guardar cliente:', error);
            this.showErrorMessage('Error al guardar el cliente. Intenta con una imagen más pequeña.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    getFormData() {
        const data = {
            nombreCliente: document.getElementById('nombreCliente').value.trim(),
            telefono: document.getElementById('telefonoCliente').value.trim(),
            correo: document.getElementById('correoCliente').value.trim(),
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Solo agregar fechaCreacion si es un nuevo cliente
        if (!this.editingId) {
            data.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
        }

        // Agregar chunks de imagen si existe
        if (this.currentImageChunks && this.currentImageChunks.length > 0) {
            data.IMAGEN = this.currentImageChunks;
        }

        return data;
    }

    async addCliente(clienteData) {
        await db.collection('clientes').add(clienteData);
    }

    async updateCliente(id, clienteData) {
        await db.collection('clientes').doc(id).update(clienteData);
    }

    async loadClientes() {
        try {
            const querySnapshot = await db.collection('clientes').orderBy('nombreCliente').get();
            this.clientes = [];

            querySnapshot.forEach((doc) => {
                this.clientes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderClientes();
        } catch (error) {
            console.error('Error al cargar clientes:', error);
            this.showErrorMessage('Error al cargar los clientes');
        }
    }

    renderClientes(filter = '') {
        const grid = document.getElementById('clientesGrid');
        const term = (filter || '').toLowerCase().trim();

        const filteredClientes = this.clientes.filter(cliente =>
            (cliente.nombreCliente || '').toLowerCase().includes(term) ||
            (cliente.telefono || '').toLowerCase().includes(term) ||
            (cliente.correo || '').toLowerCase().includes(term)
        );

        if (filteredClientes.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users" style="font-size: 3rem; color: var(--gris-medio); margin-bottom: 1rem;"></i>
                    <p>No hay clientes registrados</p>
                    ${term ? '<p>Prueba con otro término de búsqueda</p>' : '<p>Comienza agregando tu primer cliente</p>'}
                </div>
            `;
            return;
        }

        grid.innerHTML = filteredClientes.map(cliente => this.createClienteCard(cliente)).join('');
    }

    createClienteCard(cliente) {
        // Reconstruir imagen desde chunks si existe
        let imageSrc = null;
        if (cliente.IMAGEN && cliente.IMAGEN.length > 0) {
            imageSrc = this.reconstructImageFromChunks(cliente.IMAGEN);
        }

        return `
            <div class="cliente-card">
                <div class="cliente-header">
                    <div class="cliente-photo">
                        ${imageSrc ?
                `<img src="${imageSrc}" alt="${cliente.nombreCliente || 'Cliente'}">` :
                '<i class="fas fa-user"></i>'
            }
                    </div>
                    <div class="cliente-info">
                        <h4>${cliente.nombreCliente || 'Sin nombre'}</h4>
                    </div>
                </div>
                
                <div class="cliente-body">
                    <div class="cliente-contact">
                        <div>
                            <i class="fas fa-phone"></i>
                            <span>${cliente.telefono || '-'}</span>
                        </div>
                        ${cliente.correo ? `
                            <div>
                                <i class="fas fa-envelope"></i>
                                <span>${cliente.correo}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="cliente-actions">
                    <button class="btn-whatsapp" onclick="clientesManager.sendWhatsApp('${(cliente.telefono || '').replace(/'/g, "\\'")}', '${(cliente.nombreCliente || '').replace(/'/g, "\\'")}')">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                    <button class="btn-edit" onclick="clientesManager.editCliente('${cliente.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="clientesManager.deleteCliente('${cliente.id}', '${(cliente.nombreCliente || '').replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    }

    editCliente(id) {
        const cliente = this.clientes.find(c => c.id === id);
        if (cliente) {
            this.openModal(cliente);
        }
    }

    async deleteCliente(id, nombre) {
        if (confirm(`¿Estás seguro de que quieres eliminar el cliente "${nombre}"?`)) {
            try {
                await db.collection('clientes').doc(id).delete();
                this.loadClientes();
                this.showSuccessMessage('Cliente eliminado correctamente');
            } catch (error) {
                console.error('Error al eliminar cliente:', error);
                this.showErrorMessage('Error al eliminar el cliente');
            }
        }
    }

    filterClientes(searchTerm) {
        this.renderClientes(searchTerm);
    }

    sendWhatsApp(telefono, nombreCliente) {
        // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
        let cleanPhone = (telefono || '').replace(/\D/g, '');

        // Si el número no empieza con código de país, agregar el de México (+52)
        if (!cleanPhone.startsWith('52') && cleanPhone.length === 10) {
            cleanPhone = '52' + cleanPhone;
        }

        // Mensaje predeterminado
        const mensaje = `Hola ${nombreCliente || ''}! Somos de Click Storm. Nos gustaría contactarte para ofrecerte nuestros servicios de publicidad, grabado láser y sublimación.`;

        // Codificar el mensaje para URL
        const mensajeCodificado = encodeURIComponent(mensaje);

        // Crear URL de WhatsApp
        const whatsappURL = `https://wa.me/${cleanPhone}?text=${mensajeCodificado}`;

        // Abrir WhatsApp en nueva ventana
        window.open(whatsappURL, '_blank');
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
}

// Inicializar el gestor de clientes cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('clientes-section')) {
        window.clientesManager = new ClientesManager();
    }
});