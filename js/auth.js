// auth.js
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    // Verificar si el usuario ya está autenticado
    auth.onAuthStateChanged(function (user) {
        if (user && window.location.pathname.includes('index.html')) {
            window.location.href = 'dashboard.html';
        } else if (!user && window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'index.html';
        }
    });

    // Manejar el formulario de login
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Mostrar loading
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
            submitBtn.disabled = true;

            // Intentar iniciar sesión
            auth.signInWithEmailAndPassword(email, password)
                .then(function (userCredential) {
                    console.log('Usuario autenticado:', userCredential.user);
                    window.location.href = 'dashboard.html';
                })
                .catch(function (error) {
                    console.error('Error de autenticación:', error);
                    showError('Credenciales incorrectas. Por favor, verifica tu email y contraseña.');
                })
                .finally(function () {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                });
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
});