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
        const loginInput = document.getElementById('loginInput');
        const loginError = document.getElementById('loginError');
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

        // Handle Login
        function handleLogin() {
            const val = loginInput.value;
            if (val === passwords.UserPassword || val === passwords.AdminPassword) {
                const isAdmin = val === passwords.AdminPassword;
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

                showDashboard();
                // Push state to prevent back button from logging out
                window.history.pushState({ loggedIn: true, role: localStorage.getItem(ROLE_KEY) }, "");
            } else {
                loginError.style.display = 'block';
                loginInput.value = '';
            }
        }

        loginBtn.addEventListener('click', () => handleLogin());

        // Submit on Enter
        loginInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });

        function showDashboard() {
            loginContainer.classList.add('hidden');
            dashboardContent.classList.remove('hidden');
            const role = localStorage.getItem(ROLE_KEY);

            // OPTION 1: Conditional Rendering (adapted for Vanilla JS)
            // Remove the top header exclusively for the 'user' dashboard
            if (topNav) {
                if (role === 'user') {
                    topNav.classList.add('hidden');
                } else {
                    topNav.classList.remove('hidden');
                }
            }

            // Ensure correct button visibility
            const adminToggle = document.getElementById('adminToggle');
            if (adminToggle) {
                if (role === 'user') {
                    adminToggle.classList.add('hidden');
                } else if (role === 'admin') {
                    adminToggle.classList.remove('hidden');
                }
            }

            addLogoutButton(role);
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

            // Restore Admin button visibility for the next session if needed
            const adminToggle = document.getElementById('adminToggle');
            if (adminToggle) adminToggle.classList.remove('hidden');
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

        function addLogoutButton(role) {
            if (document.getElementById('logoutBtn')) {
                // If it already exists, ensure it's in the right parent for the current role
                const btn = document.getElementById('logoutBtn');
                btn.remove();
            }

            // Determine the target container (Admin header vs User dashboard header)
            let target;
            if (role === 'user') {
                // For users, we put logout in the flats view header since top-nav is hidden
                target = document.querySelector('#flats-view .selectors');
            } else {
                // For admins, keep it in the top-nav admin section
                target = document.querySelector('.admin-section');
            }

            if (target) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logoutBtn';
                logoutBtn.className = 'btn ghost logout-btn';
                logoutBtn.style.marginLeft = role === 'user' ? 'auto' : '12px';
                logoutBtn.innerHTML = '<span>Logout</span> <span style="font-size:16px;">🚪</span>';
                logoutBtn.addEventListener('click', () => {
                    localStorage.removeItem(LOGIN_KEY);
                    localStorage.removeItem(ROLE_KEY);
                    localStorage.removeItem(ADMIN_KEY);
                    location.reload();
                });
                target.appendChild(logoutBtn);
            }
        }

        function removeLogoutButton() {
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.remove();
        }

        // Handle Admin Login Button in Header and on Card
        const adminToggle = document.getElementById('adminToggle');
        const cardAdminBtn = document.getElementById('cardAdminBtn');

        const triggerAdminPrompt = () => {
            const pass = prompt("Enter Admin Password:");
            if (pass === passwords.AdminPassword) {
                localStorage.setItem(ADMIN_KEY, "true");
                localStorage.setItem(LOGIN_KEY, "true");
                localStorage.setItem(ROLE_KEY, "admin");
                if (window.state) window.state.isAdmin = true;
                location.reload();
            } else if (pass) {
                alert("Invalid Admin Password");
            }
        };

        if (adminToggle) {
            adminToggle.addEventListener('click', () => {
                if (localStorage.getItem(LOGIN_KEY) !== "true") {
                    showLogin();
                    loginInput.focus();
                } else if (localStorage.getItem(ADMIN_KEY) !== "true") {
                    triggerAdminPrompt();
                }
            });
        }

        if (cardAdminBtn) {
            cardAdminBtn.addEventListener('click', triggerAdminPrompt);
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
