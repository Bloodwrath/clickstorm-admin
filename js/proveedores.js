// proveedores.js
class ProveedoresManager {
    constructor() {
        this.proveedores = [];
        this.editingId = null;
        this.currentImageChunks = null; // Para almacenar los chunks de la imagen actual
        this.initializeEventListeners();
        this.loadProveedores();
    }
    addTelefono(numero = '', contacto = '') {
        const cont = document.getElementById('telefonosContainer');
        const row = document.createElement('div');
        row.className = 'telefono-row';
        row.innerHTML = `
    <input type="tel" value="${numero}" placeholder="Número" required>
    <input type="text" value="${contacto}" placeholder="Nombre de contacto (opcional)">
    <button type="button" class="btn-remove" onclick="proveedoresManager.removeTelefono(this)">
        <i class="fas fa-trash"></i>
    </button>
`;
        cont.appendChild(row);
    }

    removeTelefono(btn) {
        const cont = document.getElementById('telefonosContainer');
        if (cont.querySelectorAll('.telefono-row').length > 1) {
            btn.parentElement.remove();
        } else {
            alert('Debe haber al menos un número de teléfono.');
        }
    }

    initializeEventListeners() {
        // Botón agregar proveedor
        document.getElementById('addProveedorBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Cerrar modal
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // Formulario
        document.getElementById('proveedorForm').addEventListener('submit', (e) => {
            this.handleSubmit(e);
        });

        // Upload de foto
        document.getElementById('fotoPreview').addEventListener('click', () => {
            document.getElementById('fotoInput').click();
        });

        document.getElementById('fotoInput').addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });

        // Búsqueda
        document.getElementById('searchProveedores').addEventListener('input', (e) => {
            this.filterProveedores(e.target.value);
        });

        // Cerrar modal al hacer click fuera
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('proveedorModal');
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

    openModal(proveedor = null) {
        const modal = document.getElementById('proveedorModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('proveedorForm');

        if (proveedor) {
            // Modo edición
            this.editingId = proveedor.id;
            modalTitle.textContent = 'Editar Proveedor';
            this.fillForm(proveedor);
        } else {
            // Modo agregar
            this.editingId = null;
            modalTitle.textContent = 'Agregar Proveedor';
            form.reset();
            this.resetPhotoPreview();
            this.currentImageChunks = null;
        }

        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('proveedorModal');
        modal.style.display = 'none';
        this.editingId = null;
        this.currentImageChunks = null;
        document.getElementById('proveedorForm').reset();
        this.resetPhotoPreview();
    }

    fillForm(proveedor) {
        document.getElementById('nombreNegocio').value = proveedor.nombreNegocio || '';
        document.getElementById('nombreProveedor').value = proveedor.nombreProveedor || '';
        // Limpiar primero
        const cont = document.getElementById('telefonosContainer');
        cont.innerHTML = '';
        if (proveedor.telefonos && proveedor.telefonos.length > 0) {
            proveedor.telefonos.forEach(t => {
                const row = document.createElement('div');
                row.className = 'telefono-row';
                row.innerHTML = `
        <input type="tel" value="${t.numero}" required>
        <input type="text" value="${t.contacto || ''}" placeholder="Nombre de contacto (opcional)">
        <button type="button" class="btn-remove" onclick="proveedoresManager.removeTelefono(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
                cont.appendChild(row);
            });
        } else {
            this.addTelefono(); // mínimo uno
        }
        document.getElementById('correo').value = proveedor.correo || '';
        document.getElementById('sitioWeb').value = proveedor.sitioWeb || '';
        document.getElementById('direccion').value = proveedor.direccion || '';
        document.getElementById('descripcion').value = proveedor.descripcion || '';

        // Reconstruir imagen desde chunks si existe
        if (proveedor.IMAGEN && proveedor.IMAGEN.length > 0) {
            const reconstructedImage = this.reconstructImageFromChunks(proveedor.IMAGEN);
            if (reconstructedImage) {
                this.showPhotoPreview(reconstructedImage);
                this.currentImageChunks = proveedor.IMAGEN; // Mantener chunks existentes
            }
        }
    }

    async handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                // Mostrar indicador de carga
                const preview = document.getElementById('fotoPreview');
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
        const preview = document.getElementById('fotoPreview');
        preview.innerHTML = `<img src="${src}" alt="Preview">`;
    }

    resetPhotoPreview() {
        const preview = document.getElementById('fotoPreview');
        preview.innerHTML = `
        <i class="fas fa-camera"></i>
        <span>Subir foto</span>
    `;
    }

    async handleSubmit(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('saveBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        submitBtn.disabled = true;

        try {
            const formData = this.getFormData();

            if (this.editingId) {
                await this.updateProveedor(this.editingId, formData);
            } else {
                await this.addProveedor(formData);
            }

            this.closeModal();
            this.loadProveedores();
            this.showSuccessMessage(this.editingId ? 'Proveedor actualizado correctamente' : 'Proveedor agregado correctamente');
        } catch (error) {
            console.error('Error al guardar proveedor:', error);
            this.showErrorMessage('Error al guardar el proveedor. Intenta con una imagen más pequeña.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    getFormData() {
        const data = {
            nombreNegocio: document.getElementById('nombreNegocio').value.trim(),
            nombreProveedor: document.getElementById('nombreProveedor').value.trim(),
            telefonos: Array.from(document.querySelectorAll('#telefonosContainer .telefono-row')).map(row => {
                return {
                    numero: row.querySelector('input[type=tel]').value.trim(),
                    contacto: row.querySelector('input[type=text]').value.trim()
                };
            }).filter(t => t.numero !== ''), // al menos uno obligatorio
            correo: document.getElementById('correo').value.trim(),
            sitioWeb: document.getElementById('sitioWeb').value.trim(),
            direccion: document.getElementById('direccion').value.trim(),
            descripcion: document.getElementById('descripcion').value.trim(),
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Solo agregar fechaCreacion si es un nuevo proveedor
        if (!this.editingId) {
            data.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
        }

        // Agregar chunks de imagen si existe
        if (this.currentImageChunks && this.currentImageChunks.length > 0) {
            data.IMAGEN = this.currentImageChunks;
        }

        return data;
    }

    async addProveedor(proveedorData) {
        await db.collection('proveedores').add(proveedorData);
    }

    async updateProveedor(id, proveedorData) {
        await db.collection('proveedores').doc(id).update(proveedorData);
    }

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

            this.renderProveedores();
        } catch (error) {
            console.error('Error al cargar proveedores:', error);
            this.showErrorMessage('Error al cargar los proveedores');
        }
    }

    renderProveedores(filter = '') {
        const grid = document.getElementById('proveedoresGrid');
        const term = (filter || '').toLowerCase().trim();

        const filteredProveedores = this.proveedores.filter(proveedor =>
            (proveedor.nombreNegocio || '').toLowerCase().includes(term) ||
            (proveedor.nombreProveedor || '').toLowerCase().includes(term) ||
            (proveedor.descripcion || '').toLowerCase().includes(term)
        );

        if (filteredProveedores.length === 0) {
            grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-truck" style="font-size: 3rem; color: var(--gris-medio); margin-bottom: 1rem;"></i>
                <p>No hay proveedores registrados</p>
                ${term ? '<p>Prueba con otro término de búsqueda</p>' : '<p>Comienza agregando tu primer proveedor</p>'}
            </div>
        `;
            return;
        }

        grid.innerHTML = filteredProveedores.map(proveedor => this.createProveedorCard(proveedor)).join('');
    }

    createProveedorCard(proveedor) {
        // Reconstruir imagen desde chunks si existe
        let imageSrc = null;
        if (proveedor.IMAGEN && proveedor.IMAGEN.length > 0) {
            imageSrc = this.reconstructImageFromChunks(proveedor.IMAGEN);
        }

        return `
        <div class="proveedor-card">
            <div class="proveedor-header">
                <div class="proveedor-photo">
                    ${imageSrc ?
                `<img src="${imageSrc}" alt="${proveedor.nombreNegocio}">` :
                '<i class="fas fa-store"></i>'
            }
                </div>
                <div class="proveedor-info">
                    <h4>${proveedor.nombreNegocio || 'Sin nombre'}</h4>
                    ${proveedor.nombreProveedor ? `<p>${proveedor.nombreProveedor}</p>` : ''}
                </div>
            </div>
            
            <div class="proveedor-body">
                <div class="proveedor-contact">
                    <div>
                        ${(proveedor.telefonos && proveedor.telefonos.length > 0)
                ? proveedor.telefonos.map(t => `
    <div>
        <i class="fas fa-phone"></i>
        <span>${t.numero}</span> 
        ${t.contacto ? `<small>(${t.contacto})</small>` : ''}
    </div>
  `).join('')
                : '<div><i class="fas fa-phone"></i><span>-</span></div>'
            }
                    </div>
                    ${proveedor.correo ? `
                        <div>
                            <i class="fas fa-envelope"></i>
                            <span>${proveedor.correo}</span>
                        </div>
                    ` : ''}
                    ${proveedor.sitioWeb ? `
                        <div>
                            <i class="fas fa-globe"></i>
                            <a href="${proveedor.sitioWeb}" target="_blank" rel="noopener noreferrer">${proveedor.sitioWeb}</a>
                        </div>
                    ` : ''}
                    <div>
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${proveedor.direccion || '-'}</span>
                    </div>
                </div>
                
                <div class="proveedor-description">
                    <strong>Provee:</strong> ${proveedor.descripcion || '-'}
                </div>
            </div>
            
            <div class="proveedor-actions">
                <button class="btn-whatsapp" onclick="proveedoresManager.sendWhatsApp('${(proveedor.telefono || '').replace(/'/g, "\\'")}', '${(proveedor.nombreNegocio || '').replace(/'/g, "\\'")}')">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
                <button class="btn-edit" onclick="proveedoresManager.editProveedor('${proveedor.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-delete" onclick="proveedoresManager.deleteProveedor('${proveedor.id}', '${(proveedor.nombreNegocio || '').replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
    }

    editProveedor(id) {
        const proveedor = this.proveedores.find(p => p.id === id);
        if (proveedor) {
            this.openModal(proveedor);
        }
    }

    async deleteProveedor(id, nombre) {
        if (confirm(`¿Estás seguro de que quieres eliminar el proveedor "${nombre}"?`)) {
            try {
                await db.collection('proveedores').doc(id).delete();
                this.loadProveedores();
                this.showSuccessMessage('Proveedor eliminado correctamente');
            } catch (error) {
                console.error('Error al eliminar proveedor:', error);
                this.showErrorMessage('Error al eliminar el proveedor');
            }
        }
    }

    filterProveedores(searchTerm) {
        this.renderProveedores(searchTerm);
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

    sendWhatsApp(telefono, nombreNegocio) {
        // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
        let cleanPhone = (telefono || '').replace(/\D/g, '');

        // Si el número no empieza con código de país, agregar el de México (+52)
        if (!cleanPhone.startsWith('52') && cleanPhone.length === 10) {
            cleanPhone = '52' + cleanPhone;
        }

        // Mensaje predeterminado
        const mensaje = `Hola! Somos de Click Storm. Nos gustaría contactarte para hablar sobre los servicios que ofreces.`;

        // Codificar el mensaje para URL
        const mensajeCodificado = encodeURIComponent(mensaje);

        // Crear URL de WhatsApp
        const whatsappURL = `https://wa.me/${cleanPhone}?text=${mensajeCodificado}`;

        // Abrir WhatsApp en nueva ventana
        window.open(whatsappURL, '_blank');
    }
}

// Inicializar el gestor de proveedores cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('proveedores-section')) {
        window.proveedoresManager = new ProveedoresManager();
    }
});