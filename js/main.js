/* ============================================
   Magyarország MarkDex — main.js
   ============================================ */

(() => {
    'use strict';

    // ===== Config =====
    // Set ONE of these. Leave the other empty/null.
    // Option 1: Formspree / Getform / similar (static hosting)
    const FORMSPREE_URL = ''; // e.g. 'https://formspree.io/f/xxxxxxxx'
    // Option 2: PHP handler on the same server (shared hosting)
    const PHP_ENDPOINT  = 'php/send.php';

    // ===== Year in footer =====
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ===== Header scroll state =====
    const header = document.getElementById('header');
    const onScroll = () => {
        if (window.scrollY > 20) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ===== Mobile nav =====
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.nav');
    if (navToggle && nav) {
        navToggle.addEventListener('click', () => {
            const open = nav.classList.toggle('is-open');
            navToggle.setAttribute('aria-expanded', open);
        });
        nav.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                nav.classList.remove('is-open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ===== Reveal on scroll =====
    document.documentElement.classList.add('js-reveal');
    const revealTargets = document.querySelectorAll(
        '.section__head, .steps__item, .card, .crypto, .quote, .accordion__item, .hero__stats, .platform-card, .cta-final__inner'
    );
    revealTargets.forEach(el => el.classList.add('reveal'));

    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    setTimeout(() => entry.target.classList.add('is-visible'), i * 40);
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
        revealTargets.forEach(el => io.observe(el));
    } else {
        revealTargets.forEach(el => el.classList.add('is-visible'));
    }

    // ===== Accordion: close siblings =====
    const accItems = document.querySelectorAll('.accordion__item');
    accItems.forEach(item => {
        item.addEventListener('toggle', () => {
            if (item.open) {
                accItems.forEach(other => {
                    if (other !== item) other.open = false;
                });
            }
        });
    });

    // ===== Live price simulation on the platform card =====
    const priceRows = document.querySelectorAll('.price-row');
    if (priceRows.length) {
        setInterval(() => {
            priceRows.forEach(row => {
                const valEl = row.querySelector('.price-row__value');
                const chgEl = row.querySelector('.price-row__change');
                if (!valEl || !chgEl) return;
                const current = parseFloat(valEl.textContent.replace(/\s/g, '').replace(',', '.'));
                if (isNaN(current)) return;
                const drift = (Math.random() - 0.48) * 0.004;
                const next = current * (1 + drift);
                const chg = parseFloat(chgEl.textContent.replace(/[^\-0-9,.]/g, '').replace(',', '.'));
                const newChg = chg + drift * 100;
                valEl.textContent = Math.round(next).toLocaleString('hu-HU').replace(/,/g, ' ');
                const sign = newChg >= 0 ? '+' : '−';
                chgEl.textContent = `${sign}${Math.abs(newChg).toFixed(2).replace('.', ',')}%`;
                chgEl.classList.toggle('up', newChg >= 0);
                chgEl.classList.toggle('down', newChg < 0);
            });
        }, 2600);
    }

    // ===== Form validation & submission =====
    const form = document.getElementById('signup-form');
    if (!form) return;

    const statusEl = form.querySelector('.form__status');
    const submitBtn = form.querySelector('button[type="submit"]');
    const toast = document.getElementById('toast');

    const validators = {
        firstName: v => v.trim().length >= 2 || 'Adjon meg legalább 2 karaktert.',
        lastName:  v => v.trim().length >= 2 || 'Adjon meg legalább 2 karaktert.',
        email:     v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Érvénytelen e-mail cím.',
        phone:     v => /^[+0-9\s\-()]{7,}$/.test(v.trim()) || 'Érvénytelen telefonszám.',
        consent:   (_, el) => el.checked || 'A folytatáshoz el kell fogadnia a feltételeket.'
    };

    const setError = (name, msg) => {
        const input = form.querySelector(`[name="${name}"]`);
        const err = form.querySelector(`[data-error-for="${name}"]`);
        if (input) input.classList.toggle('is-invalid', !!msg);
        if (err) err.textContent = msg || '';
    };

    const validateField = (name) => {
        const input = form.querySelector(`[name="${name}"]`);
        if (!input) return true;
        const value = input.type === 'checkbox' ? input.checked : input.value;
        const result = validators[name](value, input);
        if (result === true) { setError(name, ''); return true; }
        setError(name, result);
        return false;
    };

    Object.keys(validators).forEach(name => {
        const input = form.querySelector(`[name="${name}"]`);
        if (!input) return;
        input.addEventListener('blur', () => validateField(name));
        input.addEventListener('input', () => {
            if (input.classList.contains('is-invalid')) validateField(name);
        });
    });

    const showStatus = (kind, msg) => {
        statusEl.className = 'form__status is-' + kind;
        statusEl.textContent = msg;
    };
    const showToast = (kind, msg) => {
        if (!toast) return;
        toast.className = 'toast is-' + kind + ' is-visible';
        toast.textContent = msg;
        setTimeout(() => toast.classList.remove('is-visible'), 4500);
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Honeypot
        if (form.website && form.website.value) return;

        const valid = Object.keys(validators).every(validateField);
        if (!valid) {
            showStatus('error', 'Kérjük, javítsa a pirossal jelölt mezőket.');
            form.querySelector('.is-invalid')?.focus();
            return;
        }

        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
        statusEl.style.display = 'none';

        const data = new FormData(form);
        const endpoint = FORMSPREE_URL || PHP_ENDPOINT;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: FORMSPREE_URL ? { 'Accept': 'application/json' } : {},
                body: data
            });

            let ok = res.ok;
            let message = '';
            try {
                const json = await res.json();
                if (json && typeof json === 'object') {
                    if ('ok' in json) ok = json.ok;
                    message = json.message || '';
                }
            } catch { /* non-JSON response, rely on HTTP status */ }

            if (ok) {
                showStatus('success', message || 'Köszönjük! Hamarosan felvesszük Önnel a kapcsolatot.');
                showToast('success', 'Sikeres regisztráció!');
                form.reset();
            } else {
                showStatus('error', message || 'Hiba történt a küldés során. Próbálja újra később.');
                showToast('error', 'Hiba történt.');
            }
        } catch (err) {
            showStatus('error', 'Hálózati hiba. Ellenőrizze a kapcsolatot és próbálja újra.');
            showToast('error', 'Hálózati hiba.');
        } finally {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
        }
    });
})();
