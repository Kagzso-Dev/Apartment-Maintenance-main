/**
 * auth.js - Handles User Login, Persistence, and Navigation Protection
 */

(function () {
    const LOGIN_KEY = "isLoggedIn";
    const ADMIN_KEY = "isAdmin";
    const ROLE_KEY = "role";

    // Default fallback passwords
    let passwords = {
        UserPassword: "user123",
        AdminPassword: "admin123"
    };

    async function loadPasswords() {
        try {
            if (typeof XLSXLoader !== 'undefined') {
                const configRows = await XLSXLoader.fetchXLSX('./data/Customer_Details.xlsx', 'Config');
                let aptName = 'Kagzso';
                configRows.forEach(row => {
                    if (row.SettingName === 'UserPassword' || row.SettingName === 'AdminPassword') {
                        passwords[row.SettingName] = row.SettingValue;
                    }
                    if (row.SettingName === 'ApartmentName') {
                        aptName = row.SettingValue;
                    }
                });

                // Update UI Labels
                const bannerApt = document.getElementById('bannerApartmentName');
                const loginApt = document.querySelector('.apartment-heading');
                if (bannerApt) bannerApt.textContent = aptName;
                if (loginApt) loginApt.textContent = aptName;

                console.log('[Auth] Config loaded from Excel:', aptName);
            }
        } catch (err) {
            console.warn('[Auth] Could not load config from Excel, using defaults:', err);
        }
    }

    async function initAuth() {
        const topNav = document.querySelector('.top-nav');
        const loginContainer = document.getElementById('loginContainer');
        const dashboardContent = document.getElementById('dashboardContent');
        const loginBtn = document.getElementById('loginBtn');

        // PERMANENT REMOVAL LOGIC: Initialize visibility immediately based on stored state
        const isLoggedIn = localStorage.getItem(LOGIN_KEY) === "true";
        if (isLoggedIn) {
            showDashboard();
        } else {
            showLogin();
        }

        // Load dynamic config in the background
        await loadPasswords();

        // 1. Handle Login
        let loginType = 'user'; // 'user' or 'admin'

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                loginType = 'user';
                showAuthModal();
            });
        }



        if (cardAdminBtn) {
            cardAdminBtn.addEventListener('click', () => {
                loginType = 'admin';
                showAuthModal();
            });
        }

        function showAuthModal() {
            if (adminModal) {
                // Update modal visuals based on who is logging in
                const title = document.getElementById('authModalTitle');
                const label = document.getElementById('authModalLabel');
                const icon = document.getElementById('authModalIcon');

                if (loginType === 'admin') {
                    title.textContent = 'Administrator Access';
                    label.textContent = 'Admin Password';
                    icon.textContent = '🛠️';
                } else {
                    title.textContent = 'Security Access';
                    label.textContent = 'Portal Password';
                    icon.textContent = '🔒';
                }

                adminModal.classList.remove('hidden');
                adminModal.hidden = false;
                adminModalInput.value = '';
                adminModalError.style.display = 'none';
                setTimeout(() => adminModalInput.focus(), 100);
            }
        }

        function handleLogin() {
            const val = adminModalInput.value;
            const targetPass = loginType === 'admin' ? passwords.AdminPassword : passwords.UserPassword;

            if (val === targetPass) {
                const isAdmin = loginType === 'admin';
                localStorage.setItem(LOGIN_KEY, "true");
                if (isAdmin) {
                    localStorage.setItem(ADMIN_KEY, "true");
                    localStorage.setItem(ROLE_KEY, "admin");
                    if (window.state) window.state.isAdmin = true;
                } else {
                    localStorage.removeItem(ADMIN_KEY);
                    localStorage.setItem(ROLE_KEY, "user");
                    if (window.state) window.state.isAdmin = false;
                }

                closeAdminModal();
                showDashboard();
                window.history.pushState({ loggedIn: true, role: localStorage.getItem(ROLE_KEY) }, "");
            } else {
                adminModalError.style.display = 'block';
                adminModalInput.value = '';
                adminModalInput.focus();
            }
        }

        function showDashboard() {
            loginContainer.classList.add('hidden');
            dashboardContent.classList.remove('hidden');
            const role = localStorage.getItem(ROLE_KEY);

            // Sync state.isAdmin with the actual stored role (critical for auto-restore on page reload)
            if (window.state) window.state.isAdmin = (role === 'admin');

            if (topNav) {
                topNav.classList.remove('hidden');

                const dashboardBtn = document.getElementById('dashboardBtn');
                const flatsBtn = document.getElementById('flatsBtn');
                const adminToggle = document.getElementById('adminToggle');
                const userModeStatus = document.getElementById('userModeStatus');

                if (role === 'user') {
                    // Hide admin-only nav elements
                    if (dashboardBtn) dashboardBtn.classList.add('hidden');
                    if (flatsBtn) flatsBtn.classList.add('hidden');
                    if (adminToggle) adminToggle.classList.add('hidden');
                    // Show User Mode badge
                    if (userModeStatus) {
                        userModeStatus.innerHTML = '<span class="user-pulse-dot"></span> User Mode';
                        userModeStatus.className = 'user-mode-status';
                        userModeStatus.hidden = false;
                    }
                } else {
                    // Admin: show it as "Admin Mode"
                    if (userModeStatus) {
                        userModeStatus.innerHTML = '<span class="pulse-dot"></span> Admin Mode';
                        userModeStatus.className = 'admin-status';
                        userModeStatus.hidden = false;
                    }
                }
            }

            addLogoutButton();
            // Start loading dashboard data if not already loaded
            if (typeof loadData === 'function' && !window.dataLoaded) {
                loadData();
                window.dataLoaded = true;
            }
            // Ensure we have a history state so back button works within the app
            if (!window.history.state || !window.history.state.loggedIn) {
                window.history.pushState({ loggedIn: true, view: 'main', role: role }, "");
            }
        }

        function showLogin() {
            loginContainer.classList.remove('hidden');
            dashboardContent.classList.add('hidden');
            if (topNav) topNav.classList.add('hidden');
            removeLogoutButton();
        }

        // --- Back Button Implementation ---
        window.handleSafeBack = function () {
            const dashboardView = document.getElementById('dashboard-view');
            const flatsView = document.getElementById('flats-view');
            const dashboardBtn = document.getElementById('dashboardBtn');
            const flatsBtn = document.getElementById('flatsBtn');

            // If we are in Dashboard View, return to Flats View
            if (dashboardView && !dashboardView.classList.contains('hidden')) {
                dashboardView.classList.add('hidden');
                flatsView.classList.remove('hidden');

                // Mirror the UI state from dashboard.js logic
                if (typeof state !== 'undefined' && state.isAdmin) {
                    dashboardBtn?.classList.remove('hidden');
                    flatsBtn?.classList.add('hidden');
                }

                // Push a new state for the "Back" to be effective again
                window.history.pushState({ loggedIn: true, view: 'flats' }, "");
                return;
            }

            // Fallback for real browser history
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // If deep in a state with no history, just reset to main view
                location.hash = "dashboard";
            }
        };

        function addLogoutButton() {
            if (document.getElementById('logoutBtn')) {
                const btn = document.getElementById('logoutBtn');
                btn.remove();
            }

            // Target the logout-back-group so Logout sits above the ← back button
            const target = document.querySelector('.logout-back-group');

            if (target) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logoutBtn';
                logoutBtn.className = 'btn ghost logout-btn';
                logoutBtn.innerHTML = '<span>Logout</span> <span style="font-size:16px;">🚪</span>';
                logoutBtn.addEventListener('click', () => {
                    localStorage.removeItem(LOGIN_KEY);
                    localStorage.removeItem(ROLE_KEY);
                    localStorage.removeItem(ADMIN_KEY);
                    location.reload();
                });
                target.insertBefore(logoutBtn, target.firstChild);
            }
        }

        function removeLogoutButton() {
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.remove();
        }

        // Global helpers for specialized modal actions
        window.closeAdminModal = () => {
            if (adminModal) {
                adminModal.classList.add('hidden');
                adminModal.hidden = true;
            }
        };

        if (adminModalSubmit) adminModalSubmit.addEventListener('click', handleLogin);
        if (adminModalCancel) adminModalCancel.addEventListener('click', window.closeAdminModal);
        if (adminModalClose) adminModalClose.addEventListener('click', window.closeAdminModal);
        
        if (adminModalInput) {
            adminModalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleLogin();
            });
        }

        if (adminModal) {
            adminModal.addEventListener('click', (e) => {
                if (e.target === adminModal) window.closeAdminModal();
            });
        }

        // Browser Back Protection: Prevent returning to login if session exists
        window.onpopstate = function (event) {
            const isLoggedIn = localStorage.getItem(LOGIN_KEY) === "true";
            if (isLoggedIn) {
                // Safety: if state is empty, it means they tried to go back to login
                if (!event.state || !event.state.loggedIn) {
                    window.history.pushState({ loggedIn: true }, "");
                }

                // Handle internal view switching
                const dashboardView = document.getElementById('dashboard-view');
                const flatsView = document.getElementById('flats-view');
                if (dashboardView && flatsView) {
                    if (event.state && event.state.view === 'dashboard') {
                        // BACKEND REDIRECTION LOGIC: Prevent 'user' from accessing 'dashboard' state
                        if (localStorage.getItem(ROLE_KEY) === 'user') {
                            flatsView.classList.remove('hidden');
                            dashboardView.classList.add('hidden');
                        } else {
                            flatsView.classList.add('hidden');
                            dashboardView.classList.remove('hidden');
                        }
                    } else {
                        dashboardView.classList.add('hidden');
                        flatsView.classList.remove('hidden');
                    }
                }
            }
        };
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }
})();
