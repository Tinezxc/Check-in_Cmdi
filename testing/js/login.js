/* ==========================================================
   HAVEN — Login page functions
   One login for everyone. The server decides the account type
   (client, staff or admin) and the page sends them to the
   matching dashboard.
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const idInput = document.getElementById('registration-id');
    const pwInput = document.getElementById('password');
    const alertBox = document.getElementById('loginAlert');
    const card = document.getElementById('loginCard');

    // Where each account type goes after signing in (change to your pages)
    const DASHBOARDS = {
        client: 'client-dashboard.html',
        staff: 'staff-dashboard.html',
        admin: 'admin-dashboard.html'
    };

    /* ==========================================
       1) AFTER REGISTER — success notice + prefill ID
       register.js redirects to index.html?registered=1&id=HV-1001
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

        // Never trim the password
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

    // Caps Lock hint
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
       4) SIGN IN
       ========================================== */
    function shake() {
        if (!card) return;
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
    }

    // ---- DEMO ACCOUNTS (testing only) --------------------------------
    // Delete this list when your backend is ready. Passwords must never be
    // stored in front-end code on a real site.
    const DEMO_ACCOUNTS = [
        { id: 'HV-1001',   password: 'Client#2026', role: 'client' },
        { id: 'STAFF-204', password: 'Staff#2026',  role: 'staff'  },
        { id: 'admin',     password: 'Admin#2026',  role: 'admin'  }
    ];

    // Replace this with a real request to your backend. It should resolve to
    //   { ok: true, role: 'client' | 'staff' | 'admin' }   or   { ok: false }
    // e.g. fetch('/api/login', { method: 'POST',
    //        headers: { 'Content-Type': 'application/json' },
    //        body: JSON.stringify({ id, password }) }).then((r) => r.json());
    function loginRequest(id, password) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const user = DEMO_ACCOUNTS.find(
                    (u) => u.id.toLowerCase() === id.toLowerCase() && u.password === password
                );
                resolve(user ? { ok: true, role: user.role } : { ok: false });
            }, 900);
        });
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
       5) SHAKE ANIMATION (inject once)
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