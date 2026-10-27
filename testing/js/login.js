/* ==========================================================
   HAVEN — Login page
   One login for everyone. The server decides the account
   type (client, staff or admin) and the page sends them to
   the matching dashboard.
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const idInput = document.getElementById('registration-id');
    const pwInput = document.getElementById('password');
    const alertBox = document.getElementById('loginAlert');
    const card = document.getElementById('loginCard');

    const DASHBOARDS = {
        client: 'client-dashboard.html',
        staff: 'staff-dashboard.html',
        admin: 'admin-dashboard.html'
    };

    /* ==========================================
       1) AFTER REGISTER — success notice + prefill ID
       ========================================== */
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1') {
        const notice = document.getElementById('registeredNotice');
        if (notice) notice.hidden = false;

        const id = params.get('id');
        if (id && idInput) idInput.value = id;

        if (pwInput) pwInput.focus();
        history.replaceState(null, '', window.location.pathname);
    }

    /* ==========================================
       2) VALIDATION
       ========================================== */
    const rules = {
        'registration-id': {
            pattern: /^[A-Za-z0-9._\-@]{3,}$/,
            messages: {
                required: 'ID / Username is required.',
                pattern: 'Use at least 3 letters, numbers, hyphens or underscores.'
            }
        },
        'password': {
            messages: { required: 'Password is required.' }
        }
    };

    function showError(fieldId, message) {
        const group = document.getElementById(fieldId)?.closest('.form-group');
        const err = document.querySelector(`[data-error-for="${fieldId}"]`);
        if (group) group.classList.add('error');
        if (err) err.textContent = message || '';
    }
    function clearError(fieldId) {
        const group = document.getElementById(fieldId)?.closest('.form-group');
        const err = document.querySelector(`[data-error-for="${fieldId}"]`);
        if (group) group.classList.remove('error');
        if (err) err.textContent = '';
    }
    function hideAlert() {
        if (alertBox) { alertBox.hidden = true; alertBox.textContent = ''; }
    }
    function showAlert(message) {
        if (!alertBox) return;
        alertBox.textContent = message;
        alertBox.hidden = false;
    }

    function validateField(fieldId) {
        const rule = rules[fieldId];
        const input = document.getElementById(fieldId);
        if (!rule || !input) return true;

        const value = fieldId === 'password' ? input.value : input.value.trim();

        if (!value) {
            showError(fieldId, rule.messages.required);
            return false;
        }
        if (rule.pattern && !rule.pattern.test(value)) {
            showError(fieldId, rule.messages.pattern);
            return false;
        }
        clearError(fieldId);
        return true;
    }

    function validateForm() {
        let firstInvalid = null;
        Object.keys(rules).forEach((fieldId) => {
            if (!validateField(fieldId) && !firstInvalid) {
                firstInvalid = document.getElementById(fieldId);
            }
        });
        if (firstInvalid) firstInvalid.focus();
        return !firstInvalid;
    }

    Object.keys(rules).forEach((fieldId) => {
        const input = document.getElementById(fieldId);
        if (!input) return;
        input.addEventListener('blur', () => validateField(fieldId));
        input.addEventListener('input', () => {
            hideAlert();
            const group = input.closest('.form-group');
            if (group && group.classList.contains('error')) validateField(fieldId);
        });
    });

    /* ==========================================
       3) SHOW / HIDE PASSWORD
       ========================================== */
    document.querySelectorAll('.toggle-pw').forEach((btn) => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.classList.toggle('is-visible', show);
            btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            btn.setAttribute('aria-pressed', String(show));
        });
    });

    const capsHint = document.querySelector('[data-error-for="password"]');
    pwInput?.addEventListener('keyup', (e) => {
        if (!e.getModifierState || !capsHint) return;
        const group = pwInput.closest('.form-group');
        if (e.getModifierState('CapsLock')) {
            if (!group.classList.contains('error')) capsHint.textContent = 'Caps Lock is on.';
        } else if (capsHint.textContent === 'Caps Lock is on.') {
            capsHint.textContent = '';
        }
    });

    /* ==========================================
       4) DEMO STAFF/ADMIN ACCOUNTS
       ========================================== */
    const DEMO_ACCOUNTS = [
        { id: 'STAFF-204', password: 'Staff#2026', role: 'staff' },
        { id: 'admin',     password: 'Admin#2026', role: 'admin' }
    ];

    /* ==========================================
       5) LOGIN REQUEST — reads registered accounts first
       ========================================== */
    function loginRequest(id, password) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const lower = id.toLowerCase();

                // 1) Registered accounts
                let accounts = {};
                try {
                    accounts = JSON.parse(localStorage.getItem('haven.accounts') || '{}');
                } catch { accounts = {}; }

                const accountKey = Object.keys(accounts).find((k) => k.toLowerCase() === lower);
                if (accountKey) {
                    const account = accounts[accountKey];
                    if (account.password === password) {
                        resolve({ ok: true, role: 'client', profile: account.profile });
                        return;
                    }
                    resolve({ ok: false });
                    return;
                }

                // 2) Demo staff/admin
                const user = DEMO_ACCOUNTS.find(
                    (u) => u.id.toLowerCase() === lower && u.password === password
                );
                resolve(user ? { ok: true, role: user.role, profile: null } : { ok: false });
            }, 900);
        });
    }

    /* ==========================================
       6) SIGN IN
       ========================================== */
    function shake() {
        if (!card) return;
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
    }

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        if (!validateForm()) { shake(); return; }

        const label = loginBtn.querySelector('.btn-label');
        const spinner = loginBtn.querySelector('.btn-spinner');
        const setLoading = (on) => {
            loginBtn.disabled = on;
            if (label) label.hidden = on;
            if (spinner) spinner.hidden = !on;
        };

        setLoading(true);
        try {
            const result = await loginRequest(idInput.value.trim(), pwInput.value);

            if (result && result.ok && DASHBOARDS[result.role]) {
                try {
                    const session = {
                        role: result.role,
                        profile: result.profile || null,
                        loggedInAt: Date.now()
                    };
                    localStorage.setItem('haven.session', JSON.stringify(session));

                    if (result.profile) {
                        localStorage.setItem('haven.guestName', result.profile.name || '');
                        localStorage.setItem('haven.guestProfile', JSON.stringify(result.profile));

                        const stayKey = 'haven.accommodation.v1';
                        let existing = null;
                        try { existing = JSON.parse(localStorage.getItem(stayKey) || 'null'); } catch { existing = null; }
                        if (!existing) {
                            const checkIn = result.profile.checkIn || new Date().toISOString().slice(0, 10);
                            const checkOut = result.profile.checkOut
                                || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
                            localStorage.setItem(stayKey, JSON.stringify({
                                checkIn,
                                checkOut,
                                checkoutRequest: null,
                                notifications: [],
                                requests: []
                            }));
                        }
                    }
                } catch (err) { console.warn('Session save failed:', err); }

                window.location.href = DASHBOARDS[result.role];
                return;
            }
            showAlert('Incorrect ID or password. Please try again.');
        } catch (err) {
            showAlert('Something went wrong. Please try again.');
        }

        setLoading(false);
        shake();
    });

    /* ==========================================
       7) SHAKE ANIMATION (inject once)
       ========================================== */
    if (!document.getElementById('loginShakeCSS')) {
        const style = document.createElement('style');
        style.id = 'loginShakeCSS';
        style.textContent = `
            @keyframes haven-shake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-6px); }
                40% { transform: translateX(6px); }
                60% { transform: translateX(-4px); }
                80% { transform: translateX(4px); }
            }
            .login-card.shake { animation: haven-shake 0.4s ease; }
        `;
        document.head.appendChild(style);
    }
});