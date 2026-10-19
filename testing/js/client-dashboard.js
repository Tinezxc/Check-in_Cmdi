/* ==========================================================
   HAVEN — Guest dashboard
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);

    /* ==========================================
       0) DATA
       Replace GUEST with the logged-in guest from your backend.
       ========================================== */
    const GUEST = {
        name: 'Sofia Reyes',
        registrationId: 'HV-1001',
        guestId: 'TR-1001',
        institution: 'Polytechnic University',
        branch: 'Main Campus',
        room: '201',
        floor: 2,
        maxGuests: 5,
        checkIn: '2026-10-02',
        checkOut: '2026-10-09',
        wifi: { ssid: 'Haven-Guest', password: 'belong2026' },
        amenities: ['4 beds', 'Shared bath', 'A/C', 'Wi-Fi']
    };

    // TODO: put your real front desk number here
    const FRONT_DESK = { phone: '+63 900 000 0000', hours: 'Open 24 hours' };

    const STORAGE_KEY = 'haven-guest-state-v1';
    const DAY = 86400000;

    /* ==========================================
       1) DATE HELPERS (all in local time)
       ========================================== */
    const pad = (n) => String(n).padStart(2, '0');
    const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = () => startOfDay(new Date());
    const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    function fmtWhen(iso) {
        const d = new Date(iso);
        const diff = daysBetween(d, new Date());
        if (diff === 0) return `Today, ${fmtTime(d)}`;
        if (diff === 1) return 'Yesterday';
        return fmtDate(d);
    }

    /* ==========================================
       2) STATE (saved in this browser for the demo)
       ========================================== */
    function seedNotifications() {
        const yesterday = addDays(new Date(), -1);
        yesterday.setHours(10, 15, 0, 0);
        const arrival = parseDate(GUEST.checkIn);
        arrival.setHours(9, 0, 0, 0);
        return [
            { id: 'n-seed-1', text: 'Housekeeping completed your room.', at: yesterday.toISOString(), read: false },
            { id: 'n-seed-2', text: 'Welcome to Haven! Your room is ready.', at: arrival.toISOString(), read: true }
        ];
    }

    const defaultState = () => ({
        checkOut: GUEST.checkOut,
        checkedOutOn: null,
        notifications: seedNotifications()
    });

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { ...defaultState(), ...JSON.parse(raw) };
        } catch (e) { /* ignore */ }
        return defaultState();
    }
    function saveState() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }

    const state = loadState();
    let showAllNotifs = false;
    let wifiVisible = false;

    /* ==========================================
       3) STAY STATUS
       ========================================== */
    function getStay() {
        const checkIn = parseDate(GUEST.checkIn);
        const checkOut = parseDate(state.checkOut);
        const now = today();
        const planned = Math.max(1, daysBetween(checkIn, checkOut));

        if (state.checkedOutOn) {
            return { key: 'checked-out', pill: 'Checked out', pillClass: 'neutral', regLabel: 'Checked out',
                     side: 'Thank you for staying with us', pct: 100, warn: false };
        }
        if (now < checkIn) {
            const d = daysBetween(now, checkIn);
            return { key: 'upcoming', pill: 'Upcoming', pillClass: 'neutral', regLabel: 'Upcoming',
                     side: `Arrives in ${plural(d, 'day')}`, pct: 0, warn: false };
        }
        const left = daysBetween(now, checkOut);
        if (left > 0) {
            const pct = Math.min(100, Math.max(0, (daysBetween(checkIn, now) / planned) * 100));
            return { key: 'staying', pill: 'Checked in', pillClass: 'checked-in', regLabel: 'Checked in',
                     side: `${plural(left, 'night')} remaining`, pct, warn: false };
        }
        if (left === 0) {
            return { key: 'due', pill: 'Check-out today', pillClass: 'warn', regLabel: 'Checked in',
                     side: 'Please check out today or extend', pct: 100, warn: true };
        }
        return { key: 'overdue', pill: `Overdue by ${plural(-left, 'day')}`, pillClass: 'warn', regLabel: 'Checked in',
                 side: 'Extend your stay or request check-out', pct: 100, warn: true };
    }

    /* ==========================================
       4) RENDER
       ========================================== */
    const initials = GUEST.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const firstName = GUEST.name.split(/\s+/)[0];

    function setPill(el, text, cls) {
        el.textContent = text;
        el.className = `status-pill ${cls}`;
    }

    function render() {
        const stay = getStay();
        const checkOutDate = parseDate(state.checkOut);

        const values = {
            initials,
            name: GUEST.name,
            registrationId: GUEST.registrationId,
            guestId: GUEST.guestId,
            institution: GUEST.institution,
            branch: GUEST.branch,
            room: GUEST.room,
            floor: `Floor ${GUEST.floor}`,
            capacity: `Max ${GUEST.maxGuests} guests`,
            ssid: GUEST.wifi.ssid,
            checkIn: fmtDate(parseDate(GUEST.checkIn)),
            checkOut: fmtDate(checkOutDate)
        };
        document.querySelectorAll('[data-bind]').forEach((el) => {
            el.textContent = values[el.dataset.bind] ?? '';
        });

        // Greeting
        const h = new Date().getHours();
        const greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
        $('#heroTitle').textContent = `${greeting}, ${firstName}.`;
        $('#heroSub').textContent = stay.key === 'checked-out'
            ? 'We hope you enjoyed your stay.'
            : "Here's how your stay is going.";

        // Status + progress
        setPill($('#heroPill'), stay.pill, stay.pillClass);
        setPill($('#regPill'), stay.regLabel, stay.key === 'checked-out' || stay.key === 'upcoming' ? 'neutral' : 'checked-in');
        $('#heroRemaining').textContent = stay.side;

        const fill = $('#progressFill');
        fill.style.width = `${stay.pct}%`;
        fill.classList.toggle('warn', stay.warn);
        $('#progressTrack').setAttribute('aria-valuenow', String(Math.round(stay.pct)));
        $('#heroCheckOut').classList.toggle('overdue', stay.warn);

        // Buttons
        const done = stay.key === 'checked-out';
        $('#extendBtn').disabled = done;
        $('#checkoutBtn').disabled = done || stay.key === 'upcoming';
        document.querySelectorAll('[data-action="housekeeping"], [data-action="issue"]').forEach((b) => { b.disabled = done; });

        // Wi-Fi
        $('#wifiPass').textContent = wifiVisible ? GUEST.wifi.password : '••••••••••';
        const wt = $('#wifiToggle');
        wt.textContent = wifiVisible ? 'Hide' : 'Show';
        wt.setAttribute('aria-pressed', String(wifiVisible));
        wt.setAttribute('aria-label', wifiVisible ? 'Hide Wi-Fi password' : 'Show Wi-Fi password');

        // Amenities
        const am = $('#amenities');
        am.replaceChildren();
        GUEST.amenities.forEach((a) => {
            const chip = document.createElement('span');
            chip.className = 'amenity-chip';
            chip.textContent = a;
            am.appendChild(chip);
        });

        renderNotifications();
    }

    /* ==========================================
       5) NOTIFICATIONS
       ========================================== */
    function renderNotifications() {
        const list = $('#notifList');
        list.replaceChildren();

        const sorted = [...state.notifications].sort((a, b) => new Date(b.at) - new Date(a.at));
        const items = showAllNotifs ? sorted : sorted.slice(0, 3);

        if (!items.length) {
            const empty = document.createElement('li');
            empty.className = 'notif-empty';
            empty.textContent = "You're all caught up.";
            list.appendChild(empty);
        }

        items.forEach((n) => {
            const li = document.createElement('li');
            li.className = `notif-item ${n.read ? 'read' : 'unread'}`;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'notif-btn';
            btn.dataset.id = n.id;
            btn.setAttribute('aria-label', `${n.read ? '' : 'Unread: '}${n.text}`);

            const dot = document.createElement('span');
            dot.className = 'notif-dot';

            const body = document.createElement('div');
            const text = document.createElement('p');
            text.className = 'notif-text';
            text.textContent = n.text;
            const time = document.createElement('span');
            time.className = 'notif-time';
            time.textContent = fmtWhen(n.at);
            body.append(text, time);

            btn.append(dot, body);
            li.appendChild(btn);
            list.appendChild(li);
        });

        const unread = state.notifications.filter((n) => !n.read).length;
        const badge = $('#notifCount');
        badge.hidden = unread === 0;
        badge.textContent = String(unread);
        $('#bellDot').hidden = unread === 0;
        $('#markAllRead').disabled = unread === 0;

        const toggle = $('#notifToggle');
        toggle.hidden = sorted.length <= 3;
        toggle.textContent = showAllNotifs ? 'Show less' : `View all (${sorted.length})`;
        toggle.setAttribute('aria-expanded', String(showAllNotifs));
    }

    function addNotification(text) {
        state.notifications.unshift({ id: `n-${Date.now()}`, text, at: new Date().toISOString(), read: false });
        saveState();
        renderNotifications();
    }

    $('#notifList').addEventListener('click', (e) => {
        const btn = e.target.closest('.notif-btn');
        if (!btn) return;
        const n = state.notifications.find((x) => x.id === btn.dataset.id);
        if (n && !n.read) { n.read = true; saveState(); renderNotifications(); }
    });

    $('#markAllRead').addEventListener('click', () => {
        state.notifications.forEach((n) => { n.read = true; });
        saveState();
        renderNotifications();
    });

    $('#notifToggle').addEventListener('click', () => {
        showAllNotifs = !showAllNotifs;
        renderNotifications();
    });

    $('#bellBtn').addEventListener('click', () => {
        const card = $('#notifCard');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.focus({ preventScroll: true });
    });

    /* ==========================================
       6) TOAST + MODAL
       ========================================== */
    function toast(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast${type === 'error' ? ' error' : ''}`;
        el.textContent = message;
        $('#toastRegion').appendChild(el);
        setTimeout(() => el.classList.add('hide'), 3200);
        setTimeout(() => el.remove(), 3600);
    }

    const dialog = $('#modal');
    const modalForm = $('#modalForm');
    const modalBody = $('#modalBody');
    const confirmBtn = $('#modalConfirm');
    let currentSubmit = null;

    function openModal({ title, intro = '', body = '', confirm = 'Confirm', cancel = 'Cancel',
                         hideConfirm = false, onOpen, onSubmit }) {
        $('#modalTitle').textContent = title;
        const introEl = $('#modalIntro');
        introEl.textContent = intro;
        introEl.hidden = !intro;
        modalBody.innerHTML = body; // only trusted, static markup is passed in
        modalBody.hidden = !body;
        confirmBtn.textContent = confirm;
        confirmBtn.hidden = hideConfirm;
        $('#modalCancel').textContent = cancel;
        currentSubmit = onSubmit || null;

        dialog.showModal();
        if (onOpen) onOpen(modalBody);
        const first = modalBody.querySelector('input, select, textarea, a.btn');
        if (first) first.focus();
    }

    modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentSubmit) { dialog.close(); return; }
        if (currentSubmit(modalBody) !== false) dialog.close();
    });
    $('#modalCancel').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

    function fieldError(input, message) {
        const field = input.closest('.field');
        const err = field.querySelector('.field-error');
        field.classList.toggle('invalid', !!message);
        if (err) err.textContent = message || '';
        if (message) input.focus();
    }

    /* ==========================================
       7) STAY ACTIONS
       ========================================== */
    $('#extendBtn').addEventListener('click', () => {
        const current = parseDate(state.checkOut);
        const base = current > today() ? current : today();
        const min = toISO(addDays(base, 1));
        const max = toISO(addDays(base, 30));

        openModal({
            title: 'Extend your stay',
            intro: `Your current check-out is ${fmtDate(current)}. Choose a new date.`,
            confirm: 'Extend stay',
            body: `
                <div class="field">
                    <label for="extDate">New check-out date</label>
                    <input type="date" id="extDate" min="${min}" max="${max}">
                    <span class="field-error"></span>
                </div>
                <p class="modal-note" id="extSummary">Pick a date to see how many nights are added.</p>`,
            onOpen(root) {
                const input = $('#extDate', root);
                const summary = $('#extSummary', root);
                input.addEventListener('input', () => {
                    fieldError(input, '');
                    if (!input.value) { summary.textContent = 'Pick a date to see how many nights are added.'; return; }
                    const nights = daysBetween(current, parseDate(input.value));
                    summary.innerHTML = nights > 0
                        ? `Adds <strong>${plural(nights, 'night')}</strong> to your stay.`
                        : 'Choose a date after your current check-out.';
                });
            },
            onSubmit(root) {
                const input = $('#extDate', root);
                if (!input.value) { fieldError(input, 'Please choose a new check-out date.'); return false; }
                if (input.value < min || input.value > max) {
                    fieldError(input, 'Pick a date within the next 30 days.');
                    return false;
                }
                state.checkOut = input.value;
                saveState();
                render();
                addNotification(`Your stay was extended to ${fmtDate(parseDate(input.value))}.`);
                toast('Stay extended');
            }
        });
    });

    $('#checkoutBtn').addEventListener('click', () => {
        openModal({
            title: 'Request check-out?',
            intro: `You'll be checked out today, ${fmtDate(today())}. Please make sure your belongings are packed and the room key is returned to the front desk.`,
            confirm: 'Request check-out',
            onSubmit() {
                state.checkedOutOn = toISO(today());
                saveState();
                render();
                addNotification('Check-out request received. Thank you for staying with Haven!');
                toast('Check-out requested');
            }
        });
    });

    /* ==========================================
       8) QUICK ACTIONS
       ========================================== */
    const ACTIONS = {
        housekeeping() {
            openModal({
                title: 'Request housekeeping',
                confirm: 'Send request',
                body: `
                    <div class="field">
                        <label for="hkSlot">Preferred time</label>
                        <select id="hkSlot">
                            <option>Morning (8 AM – 12 PM)</option>
                            <option>Afternoon (1 – 5 PM)</option>
                            <option>Any time</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="hkNotes">Notes (optional)</label>
                        <textarea id="hkNotes" maxlength="200" placeholder="e.g. Extra towels, please"></textarea>
                    </div>`,
                onSubmit(root) {
                    const slot = $('#hkSlot', root).value;
                    // TODO: send slot + notes to your backend
                    addNotification(`Housekeeping requested: ${slot}.`);
                    toast('Housekeeping request sent');
                }
            });
        },

        issue() {
            openModal({
                title: 'Report an issue',
                confirm: 'Submit report',
                body: `
                    <div class="field">
                        <label for="issCat">What's the problem about?</label>
                        <select id="issCat">
                            <option>Plumbing</option>
                            <option>Electrical</option>
                            <option>Air-conditioning</option>
                            <option>Wi-Fi</option>
                            <option>Noise</option>
                            <option>Other</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="issDesc">Describe the issue</label>
                        <textarea id="issDesc" maxlength="400" placeholder="Tell us what happened"></textarea>
                        <span class="field-error"></span>
                    </div>`,
                onOpen(root) {
                    const d = $('#issDesc', root);
                    d.addEventListener('input', () => fieldError(d, ''));
                },
                onSubmit(root) {
                    const desc = $('#issDesc', root);
                    if (desc.value.trim().length < 10) {
                        fieldError(desc, 'Please add a little more detail (at least 10 characters).');
                        return false;
                    }
                    const cat = $('#issCat', root).value;
                    // TODO: send category + description to your backend
                    addNotification(`Issue reported (${cat}). Our team will follow up.`);
                    toast('Report submitted');
                }
            });
        },

        frontdesk() {
            const tel = FRONT_DESK.phone.replace(/[^\d+]/g, '');
            openModal({
                title: 'Front desk',
                intro: FRONT_DESK.hours,
                cancel: 'Close',
                hideConfirm: true,
                body: `
                    <p class="desk-phone">${FRONT_DESK.phone}</p>
                    <a class="btn btn-primary" href="tel:${tel}">Call front desk</a>`
            });
        },

        receipt() {
            const stay = getStay();
            const checkIn = parseDate(GUEST.checkIn);
            const end = state.checkedOutOn ? parseDate(state.checkedOutOn) : parseDate(state.checkOut);
            const nights = Math.max(0, daysBetween(checkIn, end));
            const lines = [
                'HAVEN — STAY SUMMARY',
                '====================',
                `Guest:           ${GUEST.name}`,
                `Registration ID: ${GUEST.registrationId}`,
                `Guest ID:        ${GUEST.guestId}`,
                `Institution:     ${GUEST.institution} (${GUEST.branch})`,
                '',
                `Room:            ${GUEST.room} (Floor ${GUEST.floor})`,
                `Check-in:        ${fmtDate(checkIn)}`,
                `Check-out:       ${fmtDate(end)}`,
                `Nights:          ${nights}`,
                `Status:          ${stay.regLabel}`,
                '',
                `Issued: ${fmtDate(new Date())} ${fmtTime(new Date())}`
            ];
            const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `haven-stay-${GUEST.registrationId}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast('Receipt downloaded');
        }
    };

    document.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => ACTIONS[btn.dataset.action]?.());
    });

    /* ==========================================
       9) COPY + WI-FI REVEAL
       ========================================== */
    const COPY_VALUES = {
        registrationId: GUEST.registrationId,
        guestId: GUEST.guestId,
        ssid: GUEST.wifi.ssid,
        wifiPassword: GUEST.wifi.password
    };

    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.copy-btn[data-copy-key]');
        if (!btn) return;
        const value = COPY_VALUES[btn.dataset.copyKey];
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);
        } catch (err) {
            const tmp = document.createElement('textarea');
            tmp.value = value;
            document.body.appendChild(tmp);
            tmp.select();
            try { document.execCommand('copy'); } catch (_) { /* ignore */ }
            tmp.remove();
        }
        const original = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1500);
    });

    $('#wifiToggle').addEventListener('click', () => {
        wifiVisible = !wifiVisible;
        render();
    });

    /* ==========================================
       10) SIDEBAR (mobile) + LOGOUT
       ========================================== */
    const toggle = $('#menuToggle');
    const sidebar = $('#sidebar');
    const overlay = $('#sidebarOverlay');

    function setSidebar(open) {
        sidebar.classList.toggle('open', open);
        overlay.classList.toggle('open', open);
        document.body.classList.toggle('no-scroll', open);
        toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
    overlay.addEventListener('click', () => setSidebar(false));
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a.nav-item:not(.logout)')) setSidebar(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setSidebar(false); });
    window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => { if (e.matches) setSidebar(false); });

    $('#logoutLink').addEventListener('click', (e) => {
        e.preventDefault();
        const href = e.currentTarget.getAttribute('href');
        setSidebar(false);
        openModal({
            title: 'Log out?',
            intro: 'You will need to sign in again to see your stay.',
            confirm: 'Log out',
            onSubmit() {
                try { sessionStorage.clear(); } catch (err) { /* ignore */ }
                window.location.href = href;
            }
        });
    });

    /* ==========================================
       11) DEMO RESET (remove with the demo data)
       ========================================== */
    $('#resetDemo').addEventListener('click', () => {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        window.location.reload();
    });

    /* ==========================================
       GO
       ========================================== */
    render();
    saveState();
});