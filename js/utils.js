// utils.js
function confirmDelete(entityName, extraText = '', onConfirm) {
    Swal.fire({
        title: `¿Eliminar ${entityName}?`,
        text: extraText || `Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            onConfirm();
        }
    });
}

function confirmSave(actionName = 'guardar', onConfirm) {
    Swal.fire({
        title: `¿Seguro que deseas ${actionName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1E90FF',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            onConfirm();
        }
    });
}

function showSuccess(title, message) {
    Swal.fire({
        title: title || "Éxito",
        text: message || "",
        icon: "success",
        confirmButtonColor: '#1E90FF',
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false
    });
}

function showError(title, message) {
    Swal.fire({
        title: title || "Error",
        text: message || "",
        icon: "error",
        confirmButtonColor: '#d33'
    });
}