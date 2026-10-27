document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================
       1) MOBILE SIDEBAR
       ========================================== */
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    const closeSidebar = () => {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('open');
        toggle?.setAttribute('aria-expanded', 'false');
    };

    toggle?.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        overlay.classList.toggle('open', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));
    });
    overlay?.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });

    /* ==========================================
       2) TOASTS
       ========================================== */
    const toastContainer = document.getElementById('toastContainer');

    function showToast(type, title, message, timeout = 3500) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'status');
        toast.innerHTML = `
            <span class="toast-icon" aria-hidden="true">
                ${type === 'success'
                    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e5a3a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9b1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`}
            </span>
            <div class="toast-text"><strong>${title}</strong>${message}</div>
        `;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 250);
        }, timeout);
    }
    window.showToast = showToast;

    /* ==========================================
       3) HELPERS
       ========================================== */
    const initialsOf = (name) => (name || '')
        .split(/\s+/).filter(Boolean).slice(0, 2)
        .map((p) => p[0].toUpperCase()).join('');

    function readSession() {
        try {
            const raw = localStorage.getItem('haven.session');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function formatDisplayDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatLongDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function maskValue(val) {
        if (!val) return '— — — —';
        return '•••• ••' + String(val).slice(-3);
    }

    /* ==========================================
       4) HYDRATE FROM SESSION
       ========================================== */
    function hydrateProfile() {
        const session = readSession();
        const p = session?.profile;

        if (!p) {
            // No session — leave the placeholder state
            return;
        }

        // ---- Sidebar + topbar avatars ----
        const ini = initialsOf(p.name);
        ['mobileAvatar', 'chipAvatar', 'topAvatar', 'avatarLarge'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = ini || '—';
        });

        // ---- Sidebar chip ----
        const chipName = document.getElementById('chipName');
        const chipRole = document.getElementById('chipRole');
        if (chipName) chipName.textContent = p.name || 'Guest';
        if (chipRole) chipRole.textContent = p.guestId ? `Guest · ${p.guestId}` : 'Guest';

        // ---- Header ----
        const title = document.getElementById('profileTitle');
        if (title) title.textContent = p.name || 'Guest';

        // ---- Guest ID chip + status pill ----
        const guestChip = document.getElementById('guestIdChip');
        if (guestChip) {
            guestChip.textContent = '';
            guestChip.append(`Guest ID · ${p.guestId || '—'}`);
            if (p.guestId) {
                const copy = document.createElement('button');
                copy.className = 'copy-btn';
                copy.setAttribute('aria-label', 'Copy Guest ID');
                copy.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                copy.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try { await navigator.clipboard.writeText(p.guestId); }
                    catch { /* ignore */ }
                    showToast('success', 'Copied', `${p.guestId} copied.`);
                });
                guestChip.append(copy);
            }
        }

        const pill = document.getElementById('statusPill');
        if (pill) {
            const dot = document.createElement('span');
            dot.className = 'dot';
            let cls = 'neutral', label = 'Not checked in';
            if (p.status === 'checked-in') { cls = 'checked-in'; label = 'Checked in'; }
            else if (p.status === 'overdue') { cls = 'overdue'; label = 'Overdue'; }
            else if (p.status === 'arriving') { cls = 'arriving'; label = 'Arriving'; }
            pill.className = `status-pill ${cls}`;
            pill.replaceChildren(dot, document.createTextNode(' ' + label));
        }

        // ---- Stay summary ----
        const setSummary = (key, value) => {
            const el = document.querySelector(`[data-summary="${key}"]`);
            if (!el) return;
            el.classList.toggle('muted', !value);
            if (key === 'regId') {
                el.textContent = '';
                el.append(value || '—');
                if (value) {
                    const copy = document.createElement('button');
                    copy.className = 'copy-btn';
                    copy.setAttribute('aria-label', 'Copy Registration ID');
                    copy.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                    copy.addEventListener('click', async (e) => {
                        e.preventDefault();
                        try { await navigator.clipboard.writeText(value); }
                        catch { /* ignore */ }
                        showToast('success', 'Copied', `${value} copied.`);
                    });
                    el.append(copy);
                }
                const tag = document.createElement('span');
                tag.className = 'readonly-tag';
                tag.textContent = 'Read-only';
                el.append(tag);
            } else {
                el.textContent = value || '—';
            }
        };

        setSummary('institution', p.institution);
        setSummary('branch', p.branch);
        setSummary('room', p.room ? `${p.room}${p.floor ? ` · Floor ${p.floor}` : ''}` : null);
        setSummary('checkIn', p.checkIn ? formatDisplayDate(p.checkIn) : null);
        setSummary('checkOut',
            p.checkOut
                ? (p.status === 'overdue'
                    ? `${formatDisplayDate(p.checkOut)} (Overdue)`
                    : formatDisplayDate(p.checkOut))
                : null);
        setSummary('regId', p.regId);

        // ---- Personal information (view mode) ----
        const setField = (name, value, isDate) => {
            const el = document.querySelector(`.field-value[data-name="${name}"]`);
            if (!el) return;
            const empty = value == null || value === '';
            el.textContent = empty ? '—' : (isDate ? formatLongDate(value) : value);
            el.classList.toggle('muted', empty);
        };
        setField('fullname', p.name);
        setField('email', p.email);
        setField('phone', p.phone);
        setField('dob', p.dob, true);
        setField('nationality', p.nationality);
        setField('institution', p.institution);
        setField('idType', p.idType);

        // Masked ID
        const masked = document.querySelector('.masked');
        if (masked) {
            if (p.idNumber) {
                masked.dataset.mask = p.idNumber;
                masked.textContent = maskValue(p.idNumber);
            } else {
                masked.textContent = '— — — —';
            }
        }

        // Verified badge
        const badge = document.getElementById('verifiedBadge');
        if (badge) {
            if (p.idNumber) {
                badge.classList.remove('pending');
                badge.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Verified`;
            } else {
                badge.classList.add('pending');
                badge.textContent = 'Not yet verified';
            }
        }

        // ---- Edit-mode inputs ----
        const setInput = (name, value) => {
            const el = document.querySelector(`form.edit-mode [name="${name}"]`);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = !!value;
            else el.value = value == null ? '' : value;
        };
        setInput('fullname', p.name);
        setInput('email', p.email);
        setInput('phone', p.phone);
        setInput('dob', p.dob);
        setInput('nationality', p.nationality);
        setInput('institution', p.institution);
        setInput('idType', p.idType);
        setInput('idNumber', p.idNumber);

        // ---- Completeness ----
        renderCompleteness(false);
    }

    /* ==========================================
       5) COPY-TO-CLIPBOARD (data-copy buttons)
       ========================================== */
    document.querySelectorAll('.copy-btn[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const value = btn.dataset.copy;
            if (!value) return;
            try {
                await navigator.clipboard.writeText(value);
            } catch {
                const tmp = document.createElement('textarea');
                tmp.value = value;
                tmp.style.position = 'fixed';
                tmp.style.opacity = '0';
                document.body.appendChild(tmp);
                tmp.select();
                try { document.execCommand('copy'); } catch { /* ignore */ }
                document.body.removeChild(tmp);
            }
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1200);
            showToast('success', 'Copied', `"${value}" copied.`);
        });
    });

    /* ==========================================
       6) MASKED ID TOGGLE
       ========================================== */
    const ID_REVEAL_MS = 15000;
    document.querySelectorAll('[data-toggle-mask]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.section-card');
            const masked = card?.querySelector('.masked');
            if (!masked) return;
            const real = masked.dataset.mask;
            if (!real) return;
            const isHidden = masked.textContent.includes('•');
            masked.textContent = isHidden ? real : maskValue(real);
            btn.setAttribute('aria-label', isHidden ? 'Hide ID number' : 'Show ID number');
            clearTimeout(masked._hideTimer);
            if (isHidden) {
                masked._hideTimer = setTimeout(() => {
                    masked.textContent = maskValue(real);
                    btn.setAttribute('aria-label', 'Show ID number');
                }, ID_REVEAL_MS);
            }
        });
    });

    /* ==========================================
       7) INLINE EDIT / CANCEL / SAVE
       ========================================== */
    const dirtySections = new Set();

    function snapshotForm(card) {
        const form = card.querySelector('form.edit-mode');
        if (!form) return;
        const snap = {};
        form.querySelectorAll('input, select').forEach((input) => {
            snap[input.name] = input.type === 'checkbox' ? input.checked : input.value;
        });
        card._snapshot = snap;
    }

    function isFormDirty(card) {
        if (!card._snapshot) return false;
        const form = card.querySelector('form.edit-mode');
        if (!form) return false;
        for (const input of form.querySelectorAll('input, select')) {
            const original = card._snapshot[input.name];
            const current = input.type === 'checkbox' ? input.checked : input.value;
            if (current !== original) return true;
        }
        return false;
    }

    function markDirty(sectionName, card) {
        const dirty = isFormDirty(card);
        if (dirty) dirtySections.add(sectionName);
        else dirtySections.delete(sectionName);
        updateSaveBar();
    }

    function markClean(sectionName) {
        dirtySections.delete(sectionName);
        updateSaveBar();
    }

    document.querySelectorAll('.section-card').forEach((card) => {
        const sectionName = card.dataset.section;
        const editBtn = card.querySelector('[data-action="edit"]');
        const cancelBtn = card.querySelector('[data-action="cancel"]');
        const form = card.querySelector('form.edit-mode');

        editBtn?.addEventListener('click', () => {
            snapshotForm(card);
            card.classList.add('editing');
            setTimeout(() => form?.querySelector('input, select')?.focus(), 0);
        });

        cancelBtn?.addEventListener('click', () => {
            if (!card._snapshot) {
                card.classList.remove('editing');
                return;
            }
            form?.querySelectorAll('input, select').forEach((input) => {
                const original = card._snapshot[input.name];
                if (input.type === 'checkbox') input.checked = !!original;
                else input.value = original;
            });
            clearErrors(form);
            card.classList.remove('editing');
            markClean(sectionName);
        });

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const errors = validateForm(form);
            if (errors.length) {
                showToast('error', 'Please fix the errors', 'Some fields need your attention.');
                return;
            }

            // Write back to view mode
            form.querySelectorAll('input, select').forEach((input) => {
                const viewEl = card.querySelector(`.field-value[data-name="${input.name}"]`);
                if (!viewEl) return;
                if (input.type === 'checkbox') {
                    viewEl.textContent = input.checked ? 'On' : 'Off';
                } else if (input.type === 'date') {
                    viewEl.dataset.raw = input.value;
                    viewEl.textContent = input.value ? formatLongDate(input.value) : '—';
                } else {
                    viewEl.textContent = input.value || '—';
                }
                viewEl.classList.toggle('muted', !input.value);
            });

            // Masked ID
            const idInput = form.querySelector('[name="idNumber"]');
            const masked = card.querySelector('.masked');
            if (idInput && masked) {
                masked.dataset.mask = idInput.value;
                masked.textContent = maskValue(idInput.value);
                const eye = card.querySelector('[data-toggle-mask]');
                eye?.setAttribute('aria-label', 'Show ID number');
            }

            // Persist to session
            saveSessionEdits(sectionName, form);

            const changes = changedFields(card, form);
            snapshotForm(card);

            card.classList.remove('editing');
            markClean(sectionName);
            showToast('success', 'Saved', 'Your changes have been saved.');
        });

        form?.querySelectorAll('input, select').forEach((input) => {
            input.addEventListener('input', () => markDirty(sectionName, card));
            input.addEventListener('change', () => markDirty(sectionName, card));
        });
    });

    function saveSessionEdits(sectionName, form) {
        const session = readSession();
        if (!session || !session.profile) return;
        const p = session.profile;

        const get = (n) => form.querySelector(`[name="${n}"]`);
        const val = (n) => {
            const el = get(n);
            if (!el) return undefined;
            return el.type === 'checkbox' ? el.checked : el.value;
        };

        if (sectionName === 'personal') {
            p.name = val('fullname') || p.name;
            p.email = val('email');
            p.phone = val('phone');
            p.dob = val('dob');
            p.nationality = val('nationality');
            localStorage.setItem('haven.guestName', p.name || '');
        } else if (sectionName === 'institution') {
            p.institution = val('institution');
            p.idType = val('idType');
            p.idNumber = val('idNumber');
        } else if (sectionName === 'emergency') {
            p.emName = val('emName');
            p.emRel = val('emRel');
            p.emPhone = val('emPhone');
        } else if (sectionName === 'preferences') {
            p.access = val('access');
            p.requests = val('requests');
            p.notifEmail = val('notifEmail');
            p.notifSms = val('notifSms');
        }

        try {
            localStorage.setItem('haven.session', JSON.stringify(session));
            localStorage.setItem('haven.guestProfile', JSON.stringify(p));
            // Also update the master accounts record
            const accountsRaw = localStorage.getItem('haven.accounts');
            if (accountsRaw) {
                const accounts = JSON.parse(accountsRaw);
                const key = Object.keys(accounts).find((k) => k.toLowerCase() === (p.loginId || '').toLowerCase());
                if (key) {
                    accounts[key].profile = p;
                    localStorage.setItem('haven.accounts', JSON.stringify(accounts));
                }
            }
        } catch { /* ignore */ }

        // Also update the header if the name changed
        if (p.name) {
            const ini = initialsOf(p.name);
            ['mobileAvatar', 'chipAvatar', 'topAvatar', 'avatarLarge'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.textContent = ini;
            });
            const title = document.getElementById('profileTitle');
            if (title) title.textContent = p.name;
            const chipName = document.getElementById('chipName');
            if (chipName) chipName.textContent = p.name;
        }
    }

    function changedFields(card, form) {
        const snap = card._snapshot || {};
        const out = [];
        form.querySelectorAll('input, select').forEach((input) => {
            const was = snap[input.name];
            const now = input.type === 'checkbox' ? input.checked : input.value;
            if (was !== undefined && was !== now) out.push({ name: input.name, now });
        });
        return out;
    }

    /* ==========================================
       8) VALIDATION
       ========================================== */
    function validateForm(form) {
        clearErrors(form);
        const errors = [];
        form.querySelectorAll('input, select').forEach((input) => {
            const group = input.closest('.form-group');
            const msgEl = group?.querySelector('.error-msg');
            let error = '';

            if (input.required && !input.value.trim()) {
                error = 'This field is required.';
            } else if (input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
                error = 'Please enter a valid email address.';
            } else if (input.type === 'tel' && input.value && !/^[\d\s+\-()]{7,}$/.test(input.value)) {
                error = 'Please enter a valid phone number.';
            }

            if (error) {
                group?.classList.add('error');
                if (msgEl) msgEl.textContent = error;
                input.setAttribute('aria-invalid', 'true');
                errors.push({ input, error });
            }
        });
        if (errors.length) errors[0].input.focus();
        return errors;
    }

    function clearErrors(form) {
        form?.querySelectorAll('.form-group').forEach((g) => {
            g.classList.remove('error');
            const msg = g.querySelector('.error-msg');
            if (msg) msg.textContent = '';
            const input = g.querySelector('input, select');
            input?.removeAttribute('aria-invalid');
        });
    }

    /* ==========================================
       9) STICKY SAVE BAR
       ========================================== */
    const saveBar = document.getElementById('saveBar');
    const saveBarCount = document.getElementById('saveBarCount');
    const saveBarPlural = document.getElementById('saveBarPlural');

    function updateSaveBar() {
        if (!saveBar) return;
        const n = dirtySections.size;
        if (n === 0) {
            saveBar.classList.remove('visible');
            setTimeout(() => {
                if (dirtySections.size === 0) saveBar.hidden = true;
            }, 250);
        } else {
            saveBar.hidden = false;
            if (saveBarCount) saveBarCount.textContent = n;
            if (saveBarPlural) saveBarPlural.textContent = n === 1 ? '' : 's';
            requestAnimationFrame(() => saveBar.classList.add('visible'));
        }
    }

    document.getElementById('saveAll')?.addEventListener('click', async () => {
        const cards = [...document.querySelectorAll('.section-card.editing')];
        if (!cards.length) return;
        for (const card of cards) {
            const form = card.querySelector('form.edit-mode');
            if (!form) continue;
            const errors = validateForm(form);
            if (errors.length) {
                showToast('error', 'Cannot save all', 'Fix the highlighted errors first.');
                errors[0].input.focus();
                return;
            }
            form.requestSubmit();
            await new Promise((r) => setTimeout(r, 50));
        }
        showToast('success', 'All saved', 'Your changes have been saved.');
    });

    document.getElementById('discardAll')?.addEventListener('click', () => {
        document.querySelectorAll('.section-card.editing').forEach((card) => {
            card.querySelector('[data-action="cancel"]')?.click();
        });
        dirtySections.clear();
        updateSaveBar();
        showToast('success', 'Discarded', 'Unsaved changes have been discarded.');
    });

    window.addEventListener('beforeunload', (e) => {
        if (dirtySections.size > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    /* ==========================================
       10) COMPLETENESS
       ========================================== */
    function measureCompleteness() {
        const fields = [...document.querySelectorAll('.section-card form.edit-mode input:not([type="checkbox"]), .section-card form.edit-mode select')];
        const filled = fields.filter((f) => f.value.trim() !== '').length;
        const pct = fields.length ? Math.round((filled / fields.length) * 100) : 100;
        const missing = fields.find((f) => f.value.trim() === '');
        return {
            pct,
            field: (missing?.closest('.form-group')?.querySelector('label')?.textContent || 'a missing field').trim().toLowerCase(),
            section: (missing?.closest('.section-card')?.querySelector('.card-header h3')?.textContent || 'your profile').trim().toLowerCase()
        };
    }

    function renderCompleteness() {
        const { pct, field, section } = measureCompleteness();
        const value = document.getElementById('completenessValue');
        const fill = document.getElementById('completenessFill');
        const track = document.getElementById('completenessTrack');
        const hint = document.getElementById('completenessHint');
        if (value) value.textContent = pct + '%';
        if (fill) fill.style.width = pct + '%';
        track?.setAttribute('aria-valuenow', String(pct));
        if (hint) hint.textContent = pct === 100 ? 'Your profile is complete.' : `Add ${field} in ${section} to reach 100%.`;
    }

    /* ==========================================
       11) PROFILE PHOTO
       ========================================== */
    const AVATAR_KEY = 'haven.avatar';
    const readAvatar = () => { try { return localStorage.getItem(AVATAR_KEY) || ''; } catch { return ''; } };

    function applyAvatar(url) {
        document.querySelectorAll('.avatar-lg, .guest-chip-avatar, .topbar-avatar').forEach((el) => {
            el.style.backgroundImage = url ? `url("${url}")` : '';
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.color = url ? 'transparent' : '';
        });
    }

    function resizeImage(file, size = 256) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('read failed'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('decode failed'));
                img.onload = () => {
                    const side = Math.min(img.width, img.height);
                    const canvas = document.createElement('canvas');
                    canvas.width = canvas.height = size;
                    canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    const photoPicker = document.createElement('input');
    photoPicker.type = 'file';
    photoPicker.accept = 'image/*';
    photoPicker.hidden = true;
    document.body.appendChild(photoPicker);

    document.querySelector('.avatar-edit')?.addEventListener('click', () => {
        if (readAvatar() && window.confirm('Remove your current photo? Press Cancel to choose a new one instead.')) {
            try { localStorage.removeItem(AVATAR_KEY); } catch { /* ignore */ }
            applyAvatar('');
            showToast('success', 'Photo removed', 'Your initials are showing again.');
            return;
        }
        photoPicker.value = '';
        photoPicker.click();
    });

    photoPicker.addEventListener('change', async () => {
        const file = photoPicker.files && photoPicker.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('error', 'Not an image', 'Please choose a JPG or PNG file.'); return; }
        if (file.size > 5 * 1024 * 1024) { showToast('error', 'File too large', 'Choose an image under 5 MB.'); return; }
        try {
            const url = await resizeImage(file);
            localStorage.setItem(AVATAR_KEY, url);
            applyAvatar(url);
            showToast('success', 'Photo updated', 'Your new photo is showing across Haven.');
        } catch {
            showToast('error', 'Could not use that image', 'Please try a different file.');
        }
    });

    /* ==========================================
       12) LOGOUT — clear session
       ========================================== */
    document.getElementById('logoutLink')?.addEventListener('click', (e) => {
        if (dirtySections.size > 0) {
            if (!window.confirm('You have unsaved changes. Log out anyway?')) {
                e.preventDefault();
                return;
            }
        }
        try {
            localStorage.removeItem('haven.session');
            localStorage.removeItem('haven.guestName');
            localStorage.removeItem('haven.guestProfile');
        } catch { /* ignore */ }
        // navigation happens naturally
    });

    /* ==========================================
       13) INIT
       ========================================== */
    hydrateProfile();
    applyAvatar(readAvatar());
    renderCompleteness();

});