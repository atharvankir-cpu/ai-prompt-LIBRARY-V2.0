(() => {
    'use strict';

    /* =========================================================
       CONFIG & STATE
    ========================================================= */
    const PAGE_LIMIT = 20;
    const SEARCH_DEBOUNCE_MS = 500;

    const state = {
        page: 0, totalPages: 0, total: 0,
        category: 'All', search: '',
        loading: false, controller: null, categoryKey: '',
    };

    const promptStore = new Map();
    const $ = (id) => document.getElementById(id);
    const el = {
        grid: $('prompt-grid'), status: $('status'), loadMore: $('load-more'),
        categoryList: $('category-list'), search: $('search-input'), resultInfo: $('result-info'),
        modal: $('modal'), modalTitle: $('modal-title'), modalCategory: $('modal-category'),
        modalMeta: $('modal-meta'), modalBody: $('modal-body'), modalClose: $('modal-close'),
        copyBtn: $('copy-btn'), spotlight: $('spotlight')
    };

    /* =========================================================
       HELPERS
    ========================================================= */
    const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);
    function escapeHtml(str) { const div = document.createElement('div'); div.textContent = String(str); return div.innerHTML; }
    function showStatus(html, isError = false) { el.status.className = 'status' + (isError ? ' error' : ''); el.status.innerHTML = html; }
    function clearStatus() { el.status.className = 'status'; el.status.textContent = ''; }

    /* =========================================================
       DATA FETCHING
    ========================================================= */
    async function loadPrompts({ reset = false } = {}) {
        if (state.loading && !reset) return;

        if (reset) {
            if (state.controller) state.controller.abort();
            state.page = 0; state.totalPages = 0; state.total = 0;
            promptStore.clear(); el.grid.replaceChildren();
            el.loadMore.hidden = true; el.resultInfo.textContent = '';
        }

        const nextPage = reset ? 1 : state.page + 1;
        const controller = new AbortController();
        state.controller = controller; state.loading = true;

        if (reset) {
            showStatus('<span class="loader"></span> > EXECUTING QUERY...');
        } else {
            el.loadMore.disabled = true; el.loadMore.textContent = '[ PROCESSING... ]';
        }

        try {
            const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_LIMIT), category: state.category, search: state.search });
            const response = await fetch(`/api/prompts?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
            let json = null; try { json = await response.json(); } catch (_) { }

            if (!response.ok) throw new Error((json && json.error) || `Server error: ${response.status}`);
            if (!json || !Array.isArray(json.data)) throw new Error('Unexpected response.');

            if (controller !== state.controller) return;

            state.page = nextPage; state.total = json.total || 0; state.totalPages = json.total_pages || 0;

            renderCategories(json.categories || []);
            appendCards(json.data);
            updateResultInfo();
            clearStatus();

            if (state.total === 0) showStatus('<span class="big">// NO_DATA_FOUND</span>Try a different keyword.');
        } catch (err) {
            if (err.name === 'AbortError') return;
            showStatus(`<span class="big">// CONNECTION_ERROR</span>${escapeHtml(err.message)}`, true);
        } finally {
            if (controller === state.controller) { state.loading = false; updateLoadMoreButton(); }
        }
    }

    /* =========================================================
       RENDERING
    ========================================================= */
    function renderCategories(categories) {
        const names = ['All', ...categories.filter((c) => c && c !== 'All')];
        const key = names.join('|');
        if (key !== state.categoryKey) {
            state.categoryKey = key;
            el.categoryList.replaceChildren();
            names.forEach((name) => {
                const li = document.createElement('li');
                const btn = document.createElement('button');
                btn.type = 'button'; btn.className = 'category-btn'; btn.dataset.category = name;
                btn.textContent = `> ${name.toUpperCase().replace(/\s+/g, '_')}`;
                li.appendChild(btn); el.categoryList.appendChild(li);
            });
        }
        highlightActiveCategory();
    }

    function highlightActiveCategory() {
        el.categoryList.querySelectorAll('.category-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.category === state.category);
        });
    }

    function createCard(item) {
        const card = document.createElement('article');
        card.className = 'card'; card.tabIndex = 0; card.setAttribute('role', 'button'); card.dataset.id = String(item.id);
        card.innerHTML = `
            <span class="card-tag">[ ${item.category.toUpperCase()} ]</span>
            <h3 class="card-title">${item.title}</h3>
            <p class="card-text">${item.prompt}</p>
            <div class="card-footer">
                <span>${countWords(item.prompt)} words</span>
                <span>[ ACCESS ]</span>
            </div>
        `;
        return card;
    }

    function appendCards(items) {
        const fragment = document.createDocumentFragment();
        items.forEach((item) => { promptStore.set(String(item.id), item); fragment.appendChild(createCard(item)); });
        el.grid.appendChild(fragment);
    }

    function updateResultInfo() {
        const shown = promptStore.size;
        const parts = [`> ${state.total} prompts found`];
        if (state.category !== 'All') parts.push(`[CAT: ${state.category.toUpperCase()}]`);
        if (state.search) parts.push(`[SEARCH: "${state.search}"]`);
        if (state.total > 0) parts.push(`(showing ${shown})`);
        el.resultInfo.textContent = parts.join(' ');
    }

    function updateLoadMoreButton() {
        const hasMore = state.page > 0 && state.page < state.totalPages;
        el.loadMore.hidden = !hasMore; el.loadMore.disabled = false;
        if (hasMore) {
            const remaining = Math.max(state.total - promptStore.size, 0);
            el.loadMore.textContent = `[ EXECUTE : LOAD_MORE : ${remaining} ]`;
        }
    }

    /* =========================================================
       EVENTS
    ========================================================= */
    el.categoryList.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn'); if (!btn) return;
        const category = btn.dataset.category;
        if (category === state.category && promptStore.size > 0) return;
        state.category = category; highlightActiveCategory(); loadPrompts({ reset: true });
    });

    let searchTimer = null;
    function applySearch() {
        clearTimeout(searchTimer);
        const value = el.search.value.trim();
        if (value === state.search) return;
        state.search = value; loadPrompts({ reset: true });
    }
    el.search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(applySearch, SEARCH_DEBOUNCE_MS); });
    el.search.addEventListener('keydown', (e) => { if (e.key === 'Enter') applySearch(); });

    el.loadMore.addEventListener('click', () => loadPrompts());

    el.grid.addEventListener('click', (e) => {
        const card = e.target.closest('.card'); if (card) openModal(card.dataset.id, card);
    });
    el.grid.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest('.card');
        if (card) { e.preventDefault(); openModal(card.dataset.id, card); }
    });

    /* =========================================================
       MODAL WITH DECRYPT EFFECT
    ========================================================= */
    let lastFocused = null, copyResetTimer = null;

    function openModal(id, triggerEl) {
        const item = promptStore.get(String(id)); if (!item) return;
        lastFocused = triggerEl || document.activeElement;
        
        el.modalCategory.textContent = `// ${item.category.toUpperCase()}`;
        el.modalTitle.textContent = item.title;
        el.modalMeta.textContent = `[ ${countWords(item.prompt)} WORDS ]`;
        
        // Decryption Effect
        el.modalBody.innerHTML = `<div class="decrypt-overlay">> DECRYPTING DATA...</div>`;
        setTimeout(() => {
            el.modalBody.textContent = item.prompt;
            el.modalBody.scrollTop = 0;
        }, 1500);

        resetCopyButton();
        el.modal.classList.add('open'); el.modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open'); el.modalClose.focus({ preventScroll: true });
    }

    function closeModal() {
        el.modal.classList.remove('open'); el.modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus({ preventScroll: true });
    }

    function resetCopyButton() {
        clearTimeout(copyResetTimer);
        el.copyBtn.textContent = '[ EXECUTE : COPY_DATA ]';
        el.copyBtn.classList.remove('copied', 'failed');
    }

    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text); return true;
            }
        } catch (_) { }
        try {
            const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;'; document.body.appendChild(ta);
            ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
        } catch (_) { return false; }
    }

    el.copyBtn.addEventListener('click', async () => {
        const ok = await copyToClipboard(el.modalBody.textContent);
        resetCopyButton(); el.copyBtn.textContent = ok ? '[ COPIED \u2713 ]' : '[ COPY FAILED ]';
        el.copyBtn.classList.add(ok ? 'copied' : 'failed');
        copyResetTimer = setTimeout(resetCopyButton, 2000);
    });

    el.modalClose.addEventListener('click', closeModal);
    el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.modal.classList.contains('open')) closeModal(); });

    /* =========================================================
       MATRIX RAIN & SPOTLIGHT
    ========================================================= */
    function initMatrixRain() {
        const canvas = $('matrix-canvas'); if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const FONT_SIZE = 16, FRAME_MS = 45;
        const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>{}[]/\\=+*';
        let columns = 0, drops = [], lastFrame = 0;

        function resize() {
            canvas.width = window.innerWidth; canvas.height = window.innerHeight;
            columns = Math.ceil(canvas.width / FONT_SIZE);
            drops = Array.from({ length: columns }, () => Math.floor(Math.random() * -60));
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        function draw(now) {
            requestAnimationFrame(draw);
            if (now - lastFrame < FRAME_MS) return; lastFrame = now;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#00ff41'; ctx.font = `${FONT_SIZE}px monospace`;
            for (let i = 0; i < columns; i++) {
                const char = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
                const x = i * FONT_SIZE; const y = drops[i] * FONT_SIZE;
                if (y > 0) ctx.fillText(char, x, y);
                if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
        }
        let resizeTimer;
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });
        resize();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        requestAnimationFrame(draw);
    }

    function initSpotlight() {
        if (!el.spotlight) return;
        window.addEventListener('mousemove', (e) => {
            el.spotlight.style.left = e.clientX + 'px';
            el.spotlight.style.top = e.clientY + 'px';
        });
    }

    /* =========================================================
       SMOOTH CUSTOM CURSOR
    ========================================================= */
    function initCursor() {
        const canFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (!canFinePointer) return;
        const dot = $('cursor-dot'), outline = $('cursor-outline'); if (!dot || !outline) return;
        document.body.classList.add('has-custom-cursor');
        let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
        let dotX = mouseX, dotY = mouseY, outX = mouseX, outY = mouseY;
        const DOT_EASE = 0.55, OUTLINE_EASE = 0.14;
        window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; document.body.classList.add('cursor-visible'); });
        document.addEventListener('mouseleave', () => document.body.classList.remove('cursor-visible'));
        document.addEventListener('mouseenter', () => document.body.classList.add('cursor-visible'));
        window.addEventListener('mousedown', () => document.body.classList.add('cursor-down'));
        window.addEventListener('mouseup', () => document.body.classList.remove('cursor-down'));
        const INTERACTIVE = 'a, button, input, textarea, .card, .category-btn, [role="button"]';
        document.addEventListener('mouseover', (e) => { document.body.classList.toggle('cursor-hover', !!e.target.closest(INTERACTIVE)); });
        function animate() {
            dotX += (mouseX - dotX) * DOT_EASE; dotY += (mouseY - dotY) * DOT_EASE;
            outX += (mouseX - outX) * OUTLINE_EASE; outY += (mouseY - outY) * OUTLINE_EASE;
            dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0)`;
            outline.style.transform = `translate3d(${outX}px, ${outY}px, 0)`;
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }

    /* =========================================================
       INIT
    ========================================================= */
    document.addEventListener('DOMContentLoaded', () => {
        initMatrixRain(); initCursor(); initSpotlight();
        loadPrompts({ reset: true });
    });
})();
    // --- PAYWALL LOGIC ---
    let isUnlocked = false;
    const paywallOverlay = document.getElementById('paywall-overlay');
    const promptGrid = document.getElementById('prompt-grid');
    const buyBtn = document.getElementById('buy-btn');

    // Check if user already unlocked (stored in browser local storage)
    if(localStorage.getItem('vault_unlocked') === 'true') {
        isUnlocked = true;
    }

    function applyPaywall() {
        if (!isUnlocked) {
            promptGrid.classList.add('locked');
            paywallOverlay.style.height = 'auto';
            paywallOverlay.style.marginTop = '-150px'; // Pull up to overlap the blur
        } else {
            promptGrid.classList.remove('locked');
            paywallOverlay.style.display = 'none';
        }
    }

    // Call this after rendering prompts
    const originalRender = renderPrompts;
    renderPrompts = function(data) {
        originalRender(data);
        applyPaywall();
    };

    // --- RAZORPAY PAYMENT INTEGRATION ---
    buyBtn.addEventListener('click', async () => {
        try {
            buyBtn.innerText = "PROCESSING...";
            
            // 1. Backend se order ID mangwao
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 49 }) // Price ₹49
            });
            const orderData = await response.json();

            if(orderData.error) {
                alert("Error: " + orderData.error);
                buyBtn.innerText = "UNLOCK NOW FOR ₹49";
                return;
            }

            // 2. Razorpay Popup
            const options = {
                key: "YOUR_RAZORPAY_KEY_ID", // YAHAN APNI LIVE KEY ID DAAL
                amount: orderData.amount,
                currency: "INR",
                name: "Prompt Vault 2.0",
                description: "10,000+ Premium AI Prompts",
                order_id: orderData.id,
                handler: async function (response) {
                    // 3. Payment Verify
                    const verifyRes = await fetch('/api/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });
                    
                    const verifyData = await verifyRes.json();
                    
                    if (verifyData.status === 'success') {
                        // Unlock the vault!
                        localStorage.setItem('vault_unlocked', 'true');
                        isUnlocked = true;
                        applyPaywall();
                        alert("Payment Successful! Vault Unlocked.");
                    } else {
                        alert("Payment Verification Failed. Contact Support.");
                        buyBtn.innerText = "UNLOCK NOW FOR ₹49";
                    }
                },
                theme: { color: "#00ff41" }
            };
            
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (response){
                alert("Payment Failed: " + response.error.description);
                buyBtn.innerText = "UNLOCK NOW FOR ₹49";
            });
            rzp.open();

        } catch (error) {
            console.error(error);
            alert("Something went wrong.");
            buyBtn.innerText = "UNLOCK NOW FOR ₹49";
        }
    });

    // Trigger on load
    applyPaywall();