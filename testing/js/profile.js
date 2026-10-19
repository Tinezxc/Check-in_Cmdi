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
       2) TOASTS (defined first so everything can use it)
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
    window.showToast = showToast; // expose for reuse

    /* ==========================================
       3) COPY-TO-CLIPBOARD
       ========================================== */
    document.querySelectorAll('.copy-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const value = btn.dataset.copy;
            if (!value) return;
            let ok = true;
            try {
                await navigator.clipboard.writeText(value);
            } catch {
                // Fallback for insecure contexts
                try {
                    const tmp = document.createElement('textarea');
                    tmp.value = value;
                    tmp.style.position = 'fixed';
                    tmp.style.opacity = '0';
                    document.body.appendChild(tmp);
                    tmp.select();
                    document.execCommand('copy');
                    document.body.removeChild(tmp);
                } catch {
                    ok = false;
                }
            }
            if (!ok) {
                showToast('error', 'Copy failed', 'Please copy manually.');
                return;
            }
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1200);
            showToast('success', 'Copied', `"${value}" copied to clipboard.`);
        });
    });

    /* ==========================================
       4) MASKED ID TOGGLE
       ========================================== */
    const maskValue = (val) => '•••• ••' + String(val).slice(-3);
    const ID_REVEAL_MS = 15000; // revealed ID hides itself again after this long

    document.querySelectorAll('[data-toggle-mask]').forEach((btn) => {
        btn.addEventListener('click', () => {
            // Find the masked element inside the same section-card
            const card = btn.closest('.section-card');
            const masked = card?.querySelector('.masked');
            if (!masked) return;
            const real = masked.dataset.mask;
            const isHidden = masked.textContent.includes('•');
            masked.textContent = isHidden ? real : maskValue(real);
            btn.setAttribute('aria-label', isHidden ? 'Hide ID number' : 'Show ID number');

            // Re-hide automatically so the number is not left on screen
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
       5) INLINE EDIT / CANCEL / SAVE
       Uses a snapshot of input values captured when entering edit mode.
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

        // Enter edit mode → snapshot current values
        editBtn?.addEventListener('click', () => {
            snapshotForm(card);
            card.classList.add('editing');
            setTimeout(() => form?.querySelector('input, select')?.focus(), 0);
        });

        // Cancel → revert inputs to snapshot and exit edit mode
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

        // Save → validate, write back to view mode, exit edit mode
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
                    // Display as human readable while keeping raw ISO value
                    viewEl.dataset.raw = input.value;
                    viewEl.textContent = formatDate(input.value);
                } else {
                    viewEl.textContent = input.value;
                }
            });

            // The ID number lives in a masked element, not a .field-value
            const idInput = form.querySelector('[name="idNumber"]');
            const masked = card.querySelector('.masked');
            if (idInput && masked) {
                masked.dataset.mask = idInput.value;
                masked.textContent = maskValue(idInput.value);
                const eye = card.querySelector('[data-toggle-mask]');
                eye?.setAttribute('aria-label', 'Show ID number');
            }

            // Work out what changed BEFORE the snapshot is replaced
            const changes = changedFields(card, form);

            // Update snapshot so dirty check is now against the new values
            snapshotForm(card);

            card.classList.remove('editing');
            markClean(sectionName);
            showToast('success', 'Saved', changes.length ? 'Your changes have been saved.' : 'Nothing was changed.');

            notifyProfileChange(sectionName, card, form, changes);
            syncGuestName(form);
            renderCompleteness(true);
        });

        // Track dirty state on input
        form?.querySelectorAll('input, select').forEach((input) => {
            input.addEventListener('input', () => markDirty(sectionName, card));
            input.addEventListener('change', () => markDirty(sectionName, card));
        });
    });

    /* ==========================================
       6) VALIDATION
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
       7) STICKY SAVE BAR
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

    /* Save all → sequentially submit each editing form, abort on first error */
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
            // Tiny gap so async handlers settle
            await new Promise((r) => setTimeout(r, 50));
        }
        showToast('success', 'All saved', 'Your changes have been saved.');
    });

    /* Discard all */
    document.getElementById('discardAll')?.addEventListener('click', () => {
        document.querySelectorAll('.section-card.editing').forEach((card) => {
            card.querySelector('[data-action="cancel"]')?.click();
        });
        dirtySections.clear();
        updateSaveBar();
        showToast('success', 'Discarded', 'Unsaved changes have been discarded.');
    });

    /* Warn before leaving with unsaved changes */
    window.addEventListener('beforeunload', (e) => {
        if (dirtySections.size > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    /* Warn when navigating via sidebar links */
    document.querySelectorAll('.sidebar-nav a').forEach((link) => {
        link.addEventListener('click', (e) => {
            if (dirtySections.size > 0) {
                const proceed = window.confirm('You have unsaved changes. Leave anyway?');
                if (!proceed) e.preventDefault();
            }
        });
    });

    /* ==========================================
       8) HELPERS
       ========================================== */
    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    /* ==========================================
       9) IDENTITY SYNC
       Saving the name updates the header, sidebar chip and avatars here, and
       stores it so the accommodation page shows the same name.
       ========================================== */
    const GUEST_NAME_KEY = 'haven.guestName';
    const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

    function applyIdentity(name) {
        if (!name) return;
        const ini = initialsOf(name);
        document.querySelectorAll('.guest-chip-name, .profile-name').forEach((el) => { el.textContent = name; });
        document.querySelectorAll('.guest-chip-avatar, .topbar-avatar, .avatar-lg').forEach((el) => { el.textContent = ini; });
    }

    function syncGuestName(form) {
        const val = (n) => form.querySelector(`[name="${n}"]`)?.value.trim() || '';
        const name = val('fullname') || val('fullName') || val('name')
            || [val('firstName'), val('lastName')].filter(Boolean).join(' ');
        if (!name) return;
        try { localStorage.setItem(GUEST_NAME_KEY, name); } catch { /* storage unavailable */ }
        applyIdentity(name);
    }

    /* ==========================================
       10) KEYBOARD SHORTCUTS
       Ctrl/Cmd+S saves every section being edited; Esc cancels the focused one.
       ========================================== */
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            if (document.querySelector('.section-card.editing')) {
                e.preventDefault();
                document.getElementById('saveAll')?.click();
            }
        } else if (e.key === 'Escape') {
            const card = document.activeElement?.closest?.('.section-card.editing');
            card?.querySelector('[data-action="cancel"]')?.click();
        }
    });

    /* ==========================================
       10b) PROFILE NOTIFICATIONS
       Each save posts a typed notification that says what actually changed.
       Changing ID details sends the profile back to "pending review".
       ========================================== */
    const ID_REVIEW_DEMO_MS = 20000;           // demo: staff "verify" the ID after this long. 0 = stay pending.
    const ID_PENDING_KEY = 'haven.idPendingSince';
    const notify = (o) => window.HavenNotify?.add(o);

    function labelOf(input) {
        const byFor = input.id && document.querySelector(`label[for="${input.id}"]`);
        const group = input.closest('.form-group');
        return (byFor?.textContent || group?.querySelector('.field-label')?.textContent || input.name).trim();
    }

    function changedFields(card, form) {
        const snap = card._snapshot || {};
        const out = [];
        form.querySelectorAll('input, select').forEach((input) => {
            const was = snap[input.name];
            const now = input.type === 'checkbox' ? input.checked : input.value;
            if (was !== undefined && was !== now) out.push({ name: input.name, label: labelOf(input), now, checkbox: input.type === 'checkbox' });
        });
        return out;
    }

    function setVerification(pending) {
        const badge = document.querySelector('.verified-badge');
        if (!badge) return;
        const text = [...badge.childNodes].reverse().find((n) => n.nodeType === 3);
        if (text) text.textContent = pending ? ' Pending review' : ' Verified';
        badge.style.background = pending ? 'var(--status-amber-bg)' : '';
        badge.style.color = pending ? 'var(--status-amber-fg)' : '';
    }

    function startIdReview() {
        try { localStorage.setItem(ID_PENDING_KEY, String(Date.now())); } catch { /* ignore */ }
        setVerification(true);
        scheduleIdReview();
    }

    let idReviewTimer = null;
    function scheduleIdReview() {
        clearTimeout(idReviewTimer);
        let since = 0;
        try { since = Number(localStorage.getItem(ID_PENDING_KEY)) || 0; } catch { /* ignore */ }
        if (!since) { setVerification(false); return; }
        setVerification(true);
        if (!ID_REVIEW_DEMO_MS) return;
        idReviewTimer = setTimeout(() => {
            try { localStorage.removeItem(ID_PENDING_KEY); } catch { /* ignore */ }
            setVerification(false);
            notify({ type: 'success', title: 'ID verified', body: 'The front desk confirmed your updated ID details.', target: '.section-card[data-section="institution"]' });
        }, Math.max(0, since + ID_REVIEW_DEMO_MS - Date.now()));
    }

    function notifyProfileChange(sectionName, card, form, changes) {
        if (!changes.length) return;
        const target = `.section-card[data-section="${sectionName}"]`;
        const names = changes.map((c) => c.label).join(', ');

        if (sectionName === 'institution') {
            startIdReview();
            notify({ type: 'warn', title: 'ID details need review', body: `You changed: ${names}. The front desk will verify them again.`, target });
        } else if (sectionName === 'preferences') {
            const flag = (n) => form.querySelector(`[name="${n}"]`)?.checked ? 'on' : 'off';
            const toggled = changes.some((c) => c.checkbox);
            notify({
                type: 'info',
                title: toggled ? 'Notification settings changed' : 'Preferences updated',
                body: toggled ? `Email notifications are ${flag('notifEmail')}, SMS notifications are ${flag('notifSms')}.` : `You changed: ${names}.`,
                target,
            });
        } else if (sectionName === 'emergency') {
            notify({ type: 'success', title: 'Emergency contact updated', body: `You changed: ${names}.`, target });
        } else if (sectionName === 'personal') {
            const emailChanged = changes.some((c) => c.name === 'email');
            notify({
                type: emailChanged ? 'warn' : 'success',
                title: emailChanged ? 'Email address changed' : 'Personal details updated',
                body: emailChanged ? `Your sign-in email is now ${form.querySelector('[name="email"]').value}. If this wasn't you, contact the front desk.` : `You changed: ${names}.`,
                target,
            });
        } else {
            const heading = (card.querySelector('h3')?.textContent || 'profile').trim().toLowerCase();
            notify({ type: 'success', title: 'Profile updated', body: `Your ${heading} was saved.`, target });
        }
    }

    // "Notification settings" in the bell opens the Preferences card for editing
    function openPreferences() {
        const card = document.querySelector('.section-card[data-section="preferences"]');
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!card.classList.contains('editing')) card.querySelector('[data-action="edit"]')?.click();
    }
    window.HavenNotify?.onSettings(openPreferences);

    // Gentle reminders for things that are missing
    function profileReminders() {
        const emptyEmergency = [...document.querySelectorAll('.section-card[data-section="emergency"] form.edit-mode input')]
            .some((i) => i.value.trim() === '');
        if (emptyEmergency) {
            notify({ key: 'emergency-missing', type: 'warn', title: 'Add an emergency contact', body: 'The dorm office needs someone to reach in an emergency.', target: '.section-card[data-section="emergency"]' });
        }
    }

    /* ==========================================
       11) PROFILE PHOTO
       "Change photo" picks an image, crops it square, shrinks it and stores it,
       then shows it on every avatar. Click again to remove it.
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
            window.HavenNotify?.add({ title: 'Profile photo updated', body: 'Your new photo is showing across Haven.', target: '.profile-header' });
        } catch {
            showToast('error', 'Could not use that image', 'Please try a different file.');
        }
    });

    /* ==========================================
       12) LIVE PROFILE COMPLETENESS
       Percentage of filled text fields; the hint names the next empty one.
       ========================================== */
    let lastCompleteness = null;

    function measureCompleteness() {
        const fields = [...document.querySelectorAll('.section-card form.edit-mode input:not([type="checkbox"]), .section-card form.edit-mode select')];
        const filled = fields.filter((f) => f.value.trim() !== '').length;
        const pct = fields.length ? Math.round((filled / fields.length) * 100) : 100;
        const missing = fields.find((f) => f.value.trim() === '');
        return {
            pct,
            field: (missing?.closest('.form-group')?.querySelector('label')?.textContent || 'a missing field').trim().toLowerCase(),
            section: (missing?.closest('.section-card')?.querySelector('.card-header h3')?.textContent || 'your profile').trim().toLowerCase(),
        };
    }

    function renderCompleteness(announce) {
        const { pct, field, section } = measureCompleteness();
        const value = document.querySelector('.completeness-value');
        const fill = document.querySelector('.completeness .progress-fill');
        const track = document.querySelector('.completeness .progress-track');
        const hint = document.querySelector('.completeness-hint');
        if (value) value.textContent = pct + '%';
        if (fill) fill.style.width = pct + '%';
        track?.setAttribute('aria-valuenow', String(pct));
        if (hint) hint.textContent = pct === 100 ? 'Your profile is complete.' : `Add ${field} in ${section} to reach 100%.`;
        if (announce && lastCompleteness !== null && lastCompleteness < 100 && pct === 100) {
            window.HavenNotify?.add({ key: 'profile-complete', title: 'Profile complete', body: 'Every field is filled in. Thank you!', target: '.profile-header' });
        }
        lastCompleteness = pct;
    }

    /* ==========================================
       13) STAY SUMMARY FROM THE ACCOMMODATION PAGE
       Check-in / check-out dates and the status pill follow the stay saved by
       the accommodation page (extensions, check-out requests, overdue).
       ========================================== */
    const STAY_KEY = 'haven.accommodation.v1';

    function syncStay() {
        let st = null;
        try { st = JSON.parse(localStorage.getItem(STAY_KEY)); } catch { st = null; }
        if (!st || !st.checkIn || !st.checkOut) return;

        const parse = (v) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
        const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const checkIn = parse(st.checkIn);
        const requested = !!(st.checkoutRequest && st.checkoutRequest.date);
        const out = parse(requested ? st.checkoutRequest.date : st.checkOut);
        const overdue = !requested && today > out;

        const rowValue = (label) => [...document.querySelectorAll('.summary-row')]
            .find((r) => r.querySelector('.summary-label')?.textContent.trim() === label)
            ?.querySelector('.summary-value');
        const ci = rowValue('Check-in');
        if (ci) ci.textContent = fmt(checkIn);
        const co = rowValue('Check-out');
        if (co) {
            co.textContent = fmt(out) + (overdue ? ' (Overdue)' : requested ? ' (Requested)' : '');
            co.classList.toggle('overdue', overdue);
        }

        const pill = document.querySelector('.profile-chips .status-pill');
        if (pill) {
            let text = 'Checked in', cls = 'checked-in', neutral = false;
            if (requested) { text = 'Check-out requested'; cls = 'overdue'; }
            else if (overdue) { text = 'Overdue'; cls = 'overdue'; }
            else if (today < checkIn) { text = 'Upcoming'; neutral = true; }
            const dot = document.createElement('span');
            dot.className = 'dot';
            pill.className = `status-pill ${neutral ? '' : cls}`.trim();
            pill.style.background = neutral ? 'var(--status-gray-bg)' : '';
            pill.style.color = neutral ? 'var(--status-gray-fg)' : '';
            pill.replaceChildren(dot, document.createTextNode(' ' + text));
        }
    }

    window.addEventListener('storage', (e) => {
        if (e.key === STAY_KEY) syncStay();
        if (e.key === AVATAR_KEY) applyAvatar(readAvatar());
        if (e.key === GUEST_NAME_KEY && e.newValue) applyIdentity(e.newValue);
    });
    window.addEventListener('focus', syncStay);

    /* ==========================================
       14) INIT
       ========================================== */
    (function init() {
        const savedName = document.querySelector('.field-value[data-name="fullname"]')?.textContent.trim();
        if (savedName) { try { localStorage.setItem(GUEST_NAME_KEY, savedName); } catch { /* ignore */ } }
        applyAvatar(readAvatar());
        renderCompleteness(false);
        syncStay();
        scheduleIdReview();
        profileReminders();
        if (location.hash === '#preferences') openPreferences();
    })();

    /* ==========================================
       15) SKELETON (demo — uncomment to preview)
       ========================================== */
    // document.querySelectorAll('.field-value').forEach((el) => el.classList.add('skeleton'));

});