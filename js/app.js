// app.js
document.addEventListener('DOMContentLoaded', function () {
    // Verificar autenticación
    auth.onAuthStateChanged(function (user) {
        if (user) {
            document.getElementById('userEmail').textContent = user.email;
            initializeDashboard();
        } else {
            window.location.href = 'index.html';
        }
    });

    function initializeDashboard() {
        // Inicializar elementos del dashboard
        initializeSidebar();
        initializeNavigation();
        initializeLogout();
        loadDashboardData();
    }

    function initializeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const mobileToggle = document.getElementById('mobileToggle');

        // Toggle sidebar en desktop
        sidebarToggle.addEventListener('click', function () {
            sidebar.classList.toggle('collapsed');
        });

        // Toggle sidebar en mobile
        mobileToggle.addEventListener('click', function () {
            sidebar.classList.toggle('show');
        });

        // Cerrar sidebar al hacer click fuera (mobile)
        document.addEventListener('click', function (e) {
            if (window.innerWidth <= 768 &&
                !sidebar.contains(e.target) &&
                !mobileToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });
    }

    function initializeNavigation() {
        const menuItems = document.querySelectorAll('.menu-item a');
        const contentSections = document.querySelectorAll('.content-section');
        const pageTitle = document.getElementById('pageTitle');

        menuItems.forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.preventDefault();

                const sectionName = this.getAttribute('data-section');

                // Actualizar menu activo
                document.querySelector('.menu-item.active').classList.remove('active');
                this.parentElement.classList.add('active');

                // Mostrar sección correspondiente
                contentSections.forEach(function (section) {
                    section.classList.remove('active');
                });

                const targetSection = document.getElementById(sectionName + '-section');
                if (targetSection) {
                    targetSection.classList.add('active');
                }

                // Actualizar título
                const titleMap = {
                    'dashboard': 'Dashboard',
                    'inventario': 'Inventario',
                    'clientes': 'Clientes',
                    'proveedores': 'Proveedores',
                    'pedidos': 'Pedidos',
                    'compras': 'Compras'
                };

                pageTitle.textContent = titleMap[sectionName] || 'Dashboard';

                // Cerrar sidebar en mobile después de navegar
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('show');
                }
            });
        });
    }

    function initializeLogout() {
        const logoutBtn = document.getElementById('logoutBtn');

        logoutBtn.addEventListener('click', function () {
            if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                auth.signOut().then(function () {
                    window.location.href = 'index.html';
                }).catch(function (error) {
                    console.error('Error al cerrar sesión:', error);
                });
            }
        });
    }

    function loadDashboardData() {
        // Aquí cargaremos los datos del dashboard desde Firestore
        // Por ahora solo simularemos datos
        console.log('Cargando datos del dashboard...');

        // Ejemplo de cómo cargar datos de Firestore:
        /*
        db.collection('ventas').get().then(function(querySnapshot) {
            let totalVentas = 0;
            querySnapshot.forEach(function(doc) {
                totalVentas += doc.data().monto;
            });
            document.querySelector('.stat-number').textContent = '$' + totalVentas.toLocaleString();
        });
        */
    }
});