// clientes.js
class ClientesManager {
    constructor() {
        this.clientes = [];
        this.editingId = null;
        this.currentImageChunks = null;
        this.initializeEventListeners();
        this.loadClientes();
    }
    initializeEventListeners() {
        document.getElementById('addClienteBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeClienteModal').addEventListener('click', () => this.closeModal());
        document.getElementById('clienteCancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('clienteForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('clienteFotoPreview').addEventListener('click', () => document.getElementById('clienteFotoInput').click());
        document.getElementById('clienteFotoInput').addEventListener('change', (e) => this.handlePhotoUpload(e));
        document.getElementById('searchClientes').addEventListener('input', (e) => this.filterClientes(e.target.value));

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('clienteModal');
            if (e.target === modal) this.closeModal();
        });
    }

    divideImageIntoChunks(base64String) {
        const maxChunkSize = 1048487;
        const chunks = [];
        for (let i = 0; i < base64String.length; i += maxChunkSize) {
            chunks.push(base64String.slice(i, i + maxChunkSize));
        }
        return chunks;
    }

    reconstructImageFromChunks(chunks) {
        if (!chunks || !Array.isArray(chunks) || chunks.length === 0) return null;
        return chunks.join('');
    }

    compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            const objectURL = URL.createObjectURL(file);

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
            this.editingId = cliente.id;
            modalTitle.textContent = 'Editar Cliente';
            this.fillForm(cliente);
        } else {
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

        if (cliente.IMAGEN && cliente.IMAGEN.length > 0) {
            const reconstructedImage = this.reconstructImageFromChunks(cliente.IMAGEN);
            if (reconstructedImage) {
                this.showPhotoPreview(reconstructedImage);
                this.currentImageChunks = cliente.IMAGEN;
            }
        }
    }

    async handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                const preview = document.getElementById('clienteFotoPreview');
                preview.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Procesando imagen...</span>`;

                const compressedBase64 = await this.compressImage(file);
                if (!compressedBase64) throw new Error('No se pudo procesar la imagen');

                this.currentImageChunks = this.divideImageIntoChunks(compressedBase64);
                this.showPhotoPreview(compressedBase64);
            } catch (error) {
                console.error('Error al procesar imagen:', error);
                showError("Error", "No se pudo procesar la imagen");
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
        preview.innerHTML = `<i class="fas fa-camera"></i><span>Subir foto</span>`;
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
                showSuccess("Actualizado", "Cliente actualizado correctamente.");
            } else {
                await this.addCliente(formData);
                showSuccess("Agregado", "Cliente agregado correctamente.");
            }
            this.closeModal();
            this.loadClientes();
        } catch (error) {
            console.error('Error al guardar cliente:', error);
            showError("Error", "No se pudo guardar el cliente. Intenta con una imagen más pequeña.");
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
        if (!this.editingId) {
            data.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
        }
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
                this.clientes.push({ id: doc.id, ...doc.data() });
            });
            this.renderClientes();
        } catch (error) {
            console.error('Error al cargar clientes:', error);
            showError("Error", "No se pudieron cargar los clientes.");
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
        let imageSrc = null;
        if (cliente.IMAGEN && cliente.IMAGEN.length > 0) {
            imageSrc = this.reconstructImageFromChunks(cliente.IMAGEN);
        }
        return `
        <div class="cliente-card">
            <div class="cliente-header">
                <div class="cliente-photo">
                    ${imageSrc ? `<img src="${imageSrc}" alt="${cliente.nombreCliente || 'Cliente'}">` : '<i class="fas fa-user"></i>'}
                </div>
                <div class="cliente-info">
                    <h4>${cliente.nombreCliente || 'Sin nombre'}</h4>
                </div>
            </div>
            <div class="cliente-body">
                <div class="cliente-contact">
                    <div><i class="fas fa-phone"></i> <span>${cliente.telefono || '-'}</span></div>
                    ${cliente.correo ? `<div><i class="fas fa-envelope"></i> <span>${cliente.correo}</span></div>` : ''}
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
        if (cliente) this.openModal(cliente);
    }

    async deleteCliente(id, nombre) {
        confirmDelete(
            "cliente",
            `Estás a punto de borrar al cliente "${nombre}".`,
            async () => {
                try {
                    await db.collection("clientes").doc(id).delete();
                    this.loadClientes();
                    showSuccess("Eliminado", `El cliente "${nombre}" ha sido eliminado.`);
                } catch (error) {
                    console.error("Error al eliminar cliente:", error);
                    showError("Error", "No se pudo eliminar el cliente.");
                }
            }
        );
    }

    filterClientes(searchTerm) {
        this.renderClientes(searchTerm);
    }

    sendWhatsApp(telefono, nombreCliente) {
        let cleanPhone = (telefono || '').replace(/\D/g, '');
        if (!cleanPhone.startsWith('52') && cleanPhone.length === 10) {
            cleanPhone = '52' + cleanPhone;
        }
        const mensaje = `Hola ${nombreCliente || ''}! Somos de Click Storm. Nos gustaría contactarte para ofrecerte nuestros servicios de publicidad, grabado láser y sublimación.`;
        const mensajeCodificado = encodeURIComponent(mensaje);
        const whatsappURL = `https://wa.me/${cleanPhone}?text=${mensajeCodificado}`;
        window.open(whatsappURL, '_blank');
    }

}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('clientes-section')) {
        window.clientesManager = new ClientesManager();
    }
});