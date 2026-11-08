(() => {
  "use strict";

  /* =========================================================
       CONFIG & STATE
    ========================================================= */
  const PAGE_LIMIT = 20;
  const SEARCH_DEBOUNCE_MS = 500;

  // 🚨 YAHAN TERI NAYI KEY ID HAI
  const RAZORPAY_KEY = "rzp_live_TxgQpMstY47Wbr";

  const state = {
    page: 0,
    totalPages: 0,
    total: 0,
    category: "All",
    search: "",
    loading: false,
    controller: null,
    categoryKey: "",
  };

  const promptStore = new Map();
  const $ = (id) => document.getElementById(id);

  const el = {
    grid: $("prompt-grid"),
    status: $("status"),
    loadMore: $("load-more"),
    categoryList: $("category-list"),
    search: $("search-input"),
    resultInfo: $("result-info"),
    modal: $("modal"),
    modalTitle: $("modal-title"),
    modalCategory: $("modal-category"),
    modalMeta: $("modal-meta"),
    modalBody: $("modal-body"),
    modalClose: $("modal-close"),
    copyBtn: $("copy-btn"),
    spotlight: $("spotlight"),
    paywall: $("paywall-overlay"),
    buyBtn: $("buy-btn"),
  };

  /* =========================================================
       HELPERS
    ========================================================= */
  const countWords = (text) =>
    text.trim() ? text.trim().split(/\s+/).length : 0;
  function showStatus(html, isError = false) {
    el.status.className = "status" + (isError ? " error" : "");
    el.status.innerHTML = html;
  }
  function clearStatus() {
    el.status.className = "status";
    el.status.textContent = "";
  }

  // --- PAYWALL CHECK ---
  let isUnlocked = localStorage.getItem("vault_unlocked") === "true";

  /* =========================================================
       DATA FETCHING
    ========================================================= */
  async function loadPrompts({ reset = false } = {}) {
    if (state.loading && !reset) return;

    if (reset) {
      if (state.controller) state.controller.abort();
      state.page = 0;
      state.totalPages = 0;
      state.total = 0;
      promptStore.clear();
      el.grid.replaceChildren();
      el.loadMore.hidden = true;
      el.resultInfo.textContent = "";
    }

    const nextPage = reset ? 1 : state.page + 1;
    const controller = new AbortController();
    state.controller = controller;
    state.loading = true;

    if (reset) showStatus('<span class="loader"></span> > EXECUTING QUERY...');
    else {
      el.loadMore.disabled = true;
      el.loadMore.textContent = "[ PROCESSING... ]";
    }

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_LIMIT),
        category: state.category,
        search: state.search,
      });
      const response = await fetch(`/api/prompts?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      let json = null;
      try {
        json = await response.json();
      } catch (_) {}

      if (!response.ok)
        throw new Error(
          (json && json.error) || `Server error: ${response.status}`,
        );
      if (!json || !Array.isArray(json.data))
        throw new Error("Unexpected response.");

      if (controller !== state.controller) return;

      state.page = nextPage;
      state.total = json.total || 0;
      state.totalPages = json.total_pages || 0;

      renderCategories(json.categories || []);
      appendCards(json.data);
      updateResultInfo();
      clearStatus();

      if (state.total === 0)
        showStatus(
          '<span class="big">// NO_DATA_FOUND</span>Try a different keyword.',
        );

      applyPaywallLogic();
    } catch (err) {
      if (err.name === "AbortError") return;
      showStatus(
        `<span class="big">// CONNECTION_ERROR</span>${err.message}`,
        true,
      );
    } finally {
      if (controller === state.controller) {
        state.loading = false;
        updateLoadMoreButton();
      }
    }
  }

  /* =========================================================
       RENDERING
    ========================================================= */
  function renderCategories(categories) {
    const names = ["All", ...categories.filter((c) => c && c !== "All")];
    const key = names.join("|");
    if (key !== state.categoryKey) {
      state.categoryKey = key;
      el.categoryList.replaceChildren();
      names.forEach((name) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "category-btn";
        btn.dataset.category = name;
        btn.textContent = `> ${name.toUpperCase().replace(/\s+/g, "_")}`;
        li.appendChild(btn);
        el.categoryList.appendChild(li);
      });
    }
    highlightActiveCategory();
  }

  function highlightActiveCategory() {
    el.categoryList.querySelectorAll(".category-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === state.category);
    });
  }

  function createCard(item) {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.dataset.id = String(item.id);

    card.innerHTML = `
            <div class="card-scanline"></div>
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
    items.forEach((item) => {
      promptStore.set(String(item.id), item);
      fragment.appendChild(createCard(item));
    });
    el.grid.appendChild(fragment);
  }

  function updateResultInfo() {
    const shown = promptStore.size;
    const parts = [`> ${state.total} prompts found`];
    if (state.category !== "All")
      parts.push(`[CAT: ${state.category.toUpperCase()}]`);
    if (state.search) parts.push(`[SEARCH: "${state.search}"]`);
    if (state.total > 0) parts.push(`(showing ${shown})`);
    el.resultInfo.textContent = parts.join(" ");
  }

  function updateLoadMoreButton() {
    const hasMore = state.page > 0 && state.page < state.totalPages;
    el.loadMore.hidden = !hasMore;
    el.loadMore.disabled = false;
    if (hasMore) {
      const remaining = Math.max(state.total - promptStore.size, 0);
      el.loadMore.textContent = `[ EXECUTE : LOAD_MORE : ${remaining} ]`;
    }
  }

  /* =========================================================
       PAYWALL LOGIC
    ========================================================= */
  function applyPaywallLogic() {
    if (isUnlocked) {
      el.grid.classList.remove("locked");
      if (el.paywall) el.paywall.style.display = "none";
    } else {
      el.grid.classList.add("locked");
      if (el.paywall) el.paywall.style.display = "flex";
    }
  }

  /* =========================================================
       RAZORPAY INTEGRATION
    ========================================================= */
  if (el.buyBtn) {
    el.buyBtn.addEventListener("click", async () => {
      try {
        el.buyBtn.textContent = "PROCESSING...";

        // 1. Backend se order banao
        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 49 }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Server failed to create order");
        }

        const orderData = await res.json();

        // 2. Razorpay Popup
        const options = {
          key: RAZORPAY_KEY,
          amount: orderData.amount,
          currency: "INR",
          name: "Prompt Vault 2.0",
          description: "10,000+ Premium AI Prompts",
          order_id: orderData.id,
          handler: async function (response) {
            try {
              // 3. Payment Verify karo
              const verifyRes = await fetch("/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              const verifyData = await verifyRes.json();

              if (verifyData.status === "success") {
                localStorage.setItem("vault_unlocked", "true");
                isUnlocked = true;
                applyPaywallLogic();
                alert("Payment Successful! Vault Unlocked.");
              } else {
                alert("Payment Verification Failed. Contact support.");
              }
            } catch (verifyErr) {
              console.error("Verification Error:", verifyErr);
              alert("Payment verification failed. Please contact support.");
            }
          },
          theme: { color: "#00ff41" },
        };
        const rzp = new Razorpay(options);
        rzp.on("payment.failed", function (response) {
          console.error("Payment Failed:", response.error);
          alert("Payment Failed: " + response.error.description);
          el.buyBtn.textContent = "UNLOCK NOW FOR ₹49";
        });
        rzp.open();
      } catch (err) {
        console.error("Exact Error:", err);
        alert("ASLI ERROR: " + err.message);
        el.buyBtn.textContent = "UNLOCK NOW FOR ₹49";
      }
    });
  }

  /* =========================================================
       EVENTS
    ========================================================= */
  el.categoryList.addEventListener("click", (e) => {
    const btn = e.target.closest(".category-btn");
    if (!btn) return;
    const category = btn.dataset.category;
    if (category === state.category && promptStore.size > 0) return;
    state.category = category;
    highlightActiveCategory();
    loadPrompts({ reset: true });
  });

  let searchTimer = null;
  function applySearch() {
    clearTimeout(searchTimer);
    const value = el.search.value.trim();
    if (value === state.search) return;
    state.search = value;
    loadPrompts({ reset: true });
  }
  el.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, SEARCH_DEBOUNCE_MS);
  });
  el.search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applySearch();
  });

  el.loadMore.addEventListener("click", () => loadPrompts());

  el.grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) {
      if (!isUnlocked) {
        el.paywall.scrollIntoView({ behavior: "smooth" });
      } else {
        openModal(card.dataset.id, card);
      }
    }
  });

  /* =========================================================
       MODAL LOGIC
    ========================================================= */
  let lastFocused = null,
    copyResetTimer = null;
  function openModal(id, triggerEl) {
    const item = promptStore.get(String(id));
    if (!item) return;
    lastFocused = triggerEl || document.activeElement;
    el.modalCategory.textContent = `// ${item.category.toUpperCase()}`;
    el.modalTitle.textContent = item.title;
    el.modalMeta.textContent = `[ ${countWords(item.prompt)} WORDS ]`;
    el.modalBody.textContent = item.prompt;
    el.modalBody.scrollTop = 0;
    resetCopyButton();
    el.modal.classList.add("open");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    el.modal.classList.remove("open");
    document.body.classList.remove("modal-open");
    if (lastFocused) lastFocused.focus();
  }

  function resetCopyButton() {
    clearTimeout(copyResetTimer);
    el.copyBtn.textContent = "[ EXECUTE : COPY_DATA ]";
    el.copyBtn.classList.remove("copied", "failed");
  }

  el.copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el.modalBody.textContent);
      el.copyBtn.textContent = "[ COPIED \u2713 ]";
      el.copyBtn.classList.add("copied");
      copyResetTimer = setTimeout(resetCopyButton, 2000);
    } catch (_) {
      el.copyBtn.textContent = "[ COPY FAILED ]";
      el.copyBtn.classList.add("failed");
    }
  });

  el.modalClose.addEventListener("click", closeModal);
  el.modal.addEventListener("click", (e) => {
    if (e.target === el.modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.modal.classList.contains("open")) closeModal();
  });

  /* =========================================================
       MATRIX RAIN & SPOTLIGHT & CURSOR
    ========================================================= */
  function initMatrixRain() {
    const canvas = $("matrix-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const FONT_SIZE = 16,
      FRAME_MS = 45;
    const CHARS =
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>{}[]/\\=+*";
    let columns = 0,
      drops = [],
      lastFrame = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.ceil(canvas.width / FONT_SIZE);
      drops = Array.from({ length: columns }, () =>
        Math.floor(Math.random() * -60),
      );
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    function draw(now) {
      requestAnimationFrame(draw);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff41";
      ctx.font = `${FONT_SIZE}px monospace`;
      for (let i = 0; i < columns; i++) {
        const char = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;
        if (y > 0) ctx.fillText(char, x, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(draw);
  }

  function initCursor() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    const dot = $("cursor-dot"),
      outline = $("cursor-outline");
    if (!dot || !outline) return;
    document.body.classList.add("has-custom-cursor");
    let mouseX = 0,
      mouseY = 0,
      outX = 0,
      outY = 0;

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      document.body.classList.add("cursor-visible");
    });

    function animate() {
      outX += (mouseX - outX) * 0.15;
      outY += (mouseY - outY) * 0.15;
      outline.style.transform = `translate3d(${outX}px, ${outY}px, 0)`;
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMatrixRain();
    initCursor();
    loadPrompts({ reset: true });
  });
})();
