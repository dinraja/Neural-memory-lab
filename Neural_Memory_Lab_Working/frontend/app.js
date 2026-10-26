(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const landing = $("#landing");
  const lab = $("#lab-app");
  const header = $(".site-header");
  const sidebar = $(".sidebar");
  const nav = $(".main-nav");
  const toast = $(".toast");
  const dialog = $(".help-dialog");
  let toastTimer = null;
  let currentView = "overview";

  const STORAGE_KEY = "nml_demo_runs_v1";
  let running = false;
  let stopRequested = false;
  let runTimer = null;

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function showLab(view = "overview") {
    if (landing) landing.classList.add("hidden");
    if (header) header.classList.add("hidden");
    if (lab) lab.classList.remove("hidden");
    switchView(view);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    document.title = "Laboratory — Neural Memory Efficiency Lab";
  }

  function showLanding() {
    if (lab) lab.classList.add("hidden");
    if (landing) landing.classList.remove("hidden");
    if (header) header.classList.remove("hidden");
    if (sidebar) sidebar.classList.remove("mobile-open");
    if (nav) nav.classList.remove("open");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    document.title = "Neural Memory Efficiency Lab";
  }

  function switchView(view) {
    const known = ["overview", "compare", "experiments", "memory", "history"];
    currentView = known.includes(view) ? view : "overview";
    $$(".lab-view").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === currentView));
    $$(".side-link").forEach(button => button.classList.toggle("active", button.dataset.view === currentView));
    const breadcrumb = $("#breadcrumb-current");
    if (breadcrumb) breadcrumb.textContent = currentView.replace("-", " ").toUpperCase();
    if (sidebar) sidebar.classList.remove("mobile-open");
    if (window.innerWidth <= 760) document.body.classList.remove("menu-open");
  }

  $$("[data-launch]").forEach(button => button.addEventListener("click", () => showLab("overview")));
  $$("[data-home]").forEach(button => button.addEventListener("click", showLanding));
  $$(".side-link").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$("[data-view-go]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.viewGo)));
  $$("[data-help]").forEach(button => button.addEventListener("click", () => {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else notify("Open Experiments to run the client-side simulation.");
  }));
  $(".dialog-close")?.addEventListener("click", () => dialog.close());
  $(".dialog-ok")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  $(".mobile-menu")?.addEventListener("click", event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    nav?.classList.toggle("open", !expanded);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      nav?.classList.remove("open");
      sidebar?.classList.remove("mobile-open");
      document.body.classList.remove("menu-open");
    }
  });

  // Progressive reveal
  const revealElements = $$(".reveal");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -25px 0px" });
    revealElements.forEach(el => observer.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add("is-visible"));
  }
  $$(".hero .reveal").forEach((el, i) => setTimeout(() => el.classList.add("is-visible"), 80 + i * 110));

  // Canvas network animation
  const canvas = $("#neural-canvas");
  const ctx = canvas?.getContext("2d", { alpha: true });
  if (canvas && ctx) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0, height = 0, dpr = 1, nodes = [], raf = 0, lastDraw = 0;
    const pointer = { x: -1000, y: -1000 };
    function makeNodes() {
      const count = Math.min(78, Math.max(28, Math.floor(width / 17)));
      nodes = Array.from({ length: count }, (_, i) => ({
        x: width * (0.42 + Math.random() * 0.56),
        y: height * (0.08 + Math.random() * 0.82),
        ox: 0, oy: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.12 + Math.random() * 0.3,
        radius: Math.random() > .91 ? 2.2 : 1 + Math.random() * .65,
        layer: i % 4
      }));
      nodes.forEach(n => { n.ox = n.x; n.oy = n.y; });
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeNodes();
      draw(performance.now(), true);
    }
    function draw(time, staticFrame = false) {
      if (!ctx) return;
      if (!staticFrame && time - lastDraw < 32) { raf = requestAnimationFrame(draw); return; }
      lastDraw = time;
      ctx.clearRect(0, 0, width, height);
      const t = reduceMotion ? 0 : time * 0.00035;
      const visibleNodes = nodes;
      for (let i = 0; i < visibleNodes.length; i++) {
        const a = visibleNodes[i];
        const ax = a.ox + (reduceMotion ? 0 : Math.sin(t + a.phase) * 8);
        const ay = a.oy + (reduceMotion ? 0 : Math.cos(t * a.speed + a.phase) * 8);
        for (let j = i + 1; j < visibleNodes.length; j++) {
          const b = visibleNodes[j];
          const bx = b.ox + (reduceMotion ? 0 : Math.sin(t + b.phase) * 8);
          const by = b.oy + (reduceMotion ? 0 : Math.cos(t * b.speed + b.phase) * 8);
          const dx = ax - bx, dy = ay - by, dist = Math.hypot(dx, dy);
          if (dist < 115) {
            const alpha = (1 - dist / 115) * 0.2;
            ctx.strokeStyle = `rgba(147,174,216,${alpha})`;
            ctx.lineWidth = .65;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
        }
        const pd = Math.hypot(pointer.x - ax, pointer.y - ay);
        const glow = pd < 130 ? (1 - pd / 130) * .7 : 0;
        ctx.fillStyle = glow > 0 ? `rgba(207,222,245,${.55 + glow})` : "rgba(157,181,218,.68)";
        ctx.beginPath(); ctx.arc(ax, ay, a.radius + glow, 0, Math.PI * 2); ctx.fill();
        if (a.radius > 2) {
          ctx.strokeStyle = "rgba(151,178,220,.18)";
          ctx.beginPath(); ctx.arc(ax, ay, 6 + glow * 3, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (!staticFrame && !reduceMotion) raf = requestAnimationFrame(draw);
    }
    canvas.addEventListener("pointermove", event => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top;
    }, { passive: true });
    canvas.addEventListener("pointerleave", () => { pointer.x = -1000; pointer.y = -1000; }, { passive: true });
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { cancelAnimationFrame(raf); resize(); if (!reduceMotion) raf = requestAnimationFrame(draw); }, 100);
    }, { passive: true });
    resize();
    if (!reduceMotion) raf = requestAnimationFrame(draw);
  }

  $$(".main-nav a").forEach(link => link.addEventListener("click", () => {
    nav?.classList.remove("open");
    $(".mobile-menu")?.setAttribute("aria-expanded", "false");
  }));

  // ========== Simulation engine ==========
  function loadRuns() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveRuns(runs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, 20)));
  }

  // Deterministic pseudo-random from seed
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function simulateRows(seed, batchFocus, variants) {
    const rand = mulberry32(seed >>> 0);
    const batches = batchFocus === "all" ? [1, 8, 16, 32, 64] : [Number(batchFocus)];
    const rows = [];

    // Baseline FP32 characteristics for a small MLP on digits (plausible demo numbers)
    const fp32SizeMb = 0.14 + rand() * 0.02;
    const fp32Acc = 0.965 + rand() * 0.025;
    const baseLat1 = 0.85 + rand() * 0.25; // ms at batch 1

    for (const batch of batches) {
      if (variants === "both" || variants === "fp32") {
        const scale = 1 + Math.log2(batch) * 0.55;
        const lat = baseLat1 * scale * (0.96 + rand() * 0.08);
        const rss = 18 + batch * 0.35 + rand() * 2.2;
        rows.push({
          variant: "FP32",
          batch,
          fileSizeMb: +fp32SizeMb.toFixed(3),
          peakRssMb: +rss.toFixed(2),
          accuracy: +(Math.min(0.995, fp32Acc + (rand() - 0.5) * 0.008)).toFixed(4),
          latencyMs: +lat.toFixed(2)
        });
      }
      if (variants === "both" || variants === "int8") {
        const scale = 1 + Math.log2(batch) * 0.48;
        const lat = baseLat1 * 0.72 * scale * (0.96 + rand() * 0.08);
        const rss = 11 + batch * 0.22 + rand() * 1.6;
        rows.push({
          variant: "INT8",
          batch,
          fileSizeMb: +(fp32SizeMb * 0.32).toFixed(3),
          peakRssMb: +rss.toFixed(2),
          accuracy: +(Math.min(0.992, fp32Acc - 0.008 + (rand() - 0.5) * 0.01)).toFixed(4),
          latencyMs: +lat.toFixed(2)
        });
      }
    }
    return rows;
  }

  function setProgress(pct, label) {
    const fill = $("#exp-progress-fill");
    const pctEl = $("#exp-progress-pct");
    const labelEl = $("#exp-progress-label");
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    if (labelEl) labelEl.textContent = label;
  }

  function renderResultsTable(rows) {
    const tbody = $("#results-tbody");
    if (!tbody) return;
    tbody.innerHTML = rows.map(r =>
      `<tr>
        <td>${r.variant}</td>
        <td>${r.batch}</td>
        <td>${r.fileSizeMb} MB</td>
        <td>${r.peakRssMb} MB</td>
        <td>${(r.accuracy * 100).toFixed(2)}%</td>
        <td>${r.latencyMs} ms</td>
      </tr>`
    ).join("");
  }

  function drawBarChart(canvas, rows) {
    if (!canvas || !rows.length) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 560;
    const cssH = canvas.clientHeight || 200;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW, H = cssH;
    c.clearRect(0, 0, W, H);

    // Group by batch for side-by-side FP32 / INT8
    const batches = [...new Set(rows.map(r => r.batch))].sort((a, b) => a - b);
    const pad = { t: 18, r: 16, b: 32, l: 42 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const maxLat = Math.max(...rows.map(r => r.latencyMs), 1) * 1.15;

    // axes
    c.strokeStyle = "rgba(140,164,200,0.2)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(pad.l, pad.t);
    c.lineTo(pad.l, pad.t + plotH);
    c.lineTo(pad.l + plotW, pad.t + plotH);
    c.stroke();

    const groupW = plotW / Math.max(batches.length, 1);
    const barW = Math.min(22, groupW * 0.28);

    batches.forEach((batch, i) => {
      const cx = pad.l + groupW * (i + 0.5);
      const fp = rows.find(r => r.variant === "FP32" && r.batch === batch);
      const iq = rows.find(r => r.variant === "INT8" && r.batch === batch);

      if (fp) {
        const h = (fp.latencyMs / maxLat) * plotH;
        c.fillStyle = "rgba(168,196,234,0.85)";
        c.fillRect(cx - barW - 3, pad.t + plotH - h, barW, h);
      }
      if (iq) {
        const h = (iq.latencyMs / maxLat) * plotH;
        c.fillStyle = "rgba(109,191,140,0.8)";
        c.fillRect(cx + 3, pad.t + plotH - h, barW, h);
      }

      c.fillStyle = "rgba(180,198,224,0.6)";
      c.font = "11px DM Mono, monospace";
      c.textAlign = "center";
      c.fillText(String(batch), cx, H - 12);
    });

    c.fillStyle = "rgba(180,198,224,0.45)";
    c.font = "10px DM Mono, monospace";
    c.textAlign = "right";
    c.fillText(`${maxLat.toFixed(1)} ms`, pad.l - 6, pad.t + 10);
    c.fillText("0", pad.l - 6, pad.t + plotH);

    // legend
    c.fillStyle = "rgba(168,196,234,0.85)";
    c.fillRect(pad.l + plotW - 120, 6, 10, 10);
    c.fillStyle = "rgba(180,198,224,0.7)";
    c.font = "11px Manrope, sans-serif";
    c.textAlign = "left";
    c.fillText("FP32 latency", pad.l + plotW - 106, 15);
    c.fillStyle = "rgba(109,191,140,0.8)";
    c.fillRect(pad.l + plotW - 120, 22, 10, 10);
    c.fillStyle = "rgba(180,198,224,0.7)";
    c.fillText("INT8 latency", pad.l + plotW - 106, 31);
  }

  function updateOverview(runs) {
    const latest = runs[0];
    const expEl = $("#metric-experiments");
    const varEl = $("#metric-variants");
    const savEl = $("#metric-savings");
    const accEl = $("#metric-accuracy");
    if (!expEl) return;

    if (!runs.length) {
      expEl.textContent = "—";
      $("#metric-experiments-foot").textContent = "No completed runs yet";
      varEl.textContent = "—";
      $("#metric-variants-foot").textContent = "No measured variants yet";
      savEl.textContent = "—";
      $("#metric-savings-foot").textContent = "Calculated from valid results";
      accEl.textContent = "—";
      $("#metric-accuracy-foot").textContent = "Awaiting evaluation";
      const empty = $("#overview-empty");
      const chart = $("#overview-chart");
      if (empty) empty.hidden = false;
      if (chart) chart.hidden = true;
      const st = $("#overview-chart-state");
      if (st) st.textContent = "NO DATA";
      return;
    }

    expEl.textContent = String(runs.length);
    $("#metric-experiments-foot").textContent = "Stored in localStorage";
    const variants = new Set();
    runs.forEach(r => r.rows.forEach(row => variants.add(row.variant)));
    varEl.textContent = String(variants.size);
    $("#metric-variants-foot").textContent = [...variants].join(" · ");

    // memory savings from latest both-variant run if available
    let savings = null;
    for (const run of runs) {
      const fp = run.rows.find(r => r.variant === "FP32");
      const iq = run.rows.find(r => r.variant === "INT8");
      if (fp && iq) {
        savings = ((fp.fileSizeMb - iq.fileSizeMb) / fp.fileSizeMb) * 100;
        break;
      }
    }
    if (savings != null) {
      savEl.textContent = `${savings.toFixed(0)}%`;
      $("#metric-savings-foot").textContent = "File-size reduction (sim)";
    } else {
      savEl.textContent = "—";
      $("#metric-savings-foot").textContent = "Need FP32 + INT8";
    }

    const bestAcc = Math.max(...runs.flatMap(r => r.rows.map(x => x.accuracy)));
    accEl.textContent = `${(bestAcc * 100).toFixed(1)}%`;
    $("#metric-accuracy-foot").textContent = "Best simulated accuracy";

    const empty = $("#overview-empty");
    const chart = $("#overview-chart");
    if (empty) empty.hidden = true;
    if (chart) {
      chart.hidden = false;
      drawBarChart(chart, latest.rows);
    }
    const st = $("#overview-chart-state");
    if (st) st.textContent = "SIMULATED";
  }

  function updateCompare(runs) {
    const latest = runs[0];
    const aPh = $("#model-a-placeholder");
    const bPh = $("#model-b-placeholder");
    const aMet = $("#model-a-metrics");
    const bMet = $("#model-b-metrics");
    if (!latest) {
      if (aPh) aPh.hidden = false;
      if (bPh) bPh.hidden = false;
      if (aMet) aMet.hidden = true;
      if (bMet) bMet.hidden = true;
      return;
    }
    const fpRows = latest.rows.filter(r => r.variant === "FP32");
    const iqRows = latest.rows.filter(r => r.variant === "INT8");
    const pick = (arr) => arr.sort((a, b) => a.batch - b.batch)[Math.floor(arr.length / 2)] || arr[0];

    function fill(side, row, title, tag) {
      const ph = $(`#model-${side}-placeholder`);
      const met = $(`#model-${side}-metrics`);
      const tEl = $(`#model-${side}-title`);
      const tagEl = $(`#model-${side}-tag`);
      if (!row) {
        if (ph) ph.hidden = false;
        if (met) met.hidden = true;
        return;
      }
      if (ph) ph.hidden = true;
      if (met) met.hidden = false;
      if (tEl) tEl.textContent = title;
      if (tagEl) tagEl.textContent = tag;
      $(`#m${side[0]}-size`).textContent = `${row.fileSizeMb} MB`;
      $(`#m${side[0]}-rss`).textContent = `${row.peakRssMb} MB`;
      $(`#m${side[0]}-acc`).textContent = `${(row.accuracy * 100).toFixed(2)}%`;
      $(`#m${side[0]}-lat`).textContent = `${row.latencyMs} ms`;
    }

    fill("a", pick(fpRows.length ? fpRows : latest.rows), fpRows.length ? "FP32 MLP" : latest.rows[0].variant, "SIMULATED");
    fill("b", pick(iqRows.length ? iqRows : (fpRows.length ? [] : latest.rows.slice(1))), iqRows.length ? "INT8 MLP" : "—", iqRows.length ? "SIMULATED" : "—");
  }

  function updateHistory(runs) {
    const list = $("#history-list");
    const empty = $("#history-empty");
    const count = $("#history-count");
    if (!list) return;
    if (count) count.textContent = `${runs.length} RECORDED`;
    if (!runs.length) {
      if (empty) empty.hidden = false;
      list.hidden = true;
      list.innerHTML = "";
      return;
    }
    if (empty) empty.hidden = true;
    list.hidden = false;
    list.innerHTML = runs.map((run, idx) => {
      const when = new Date(run.ts).toLocaleString();
      const variants = [...new Set(run.rows.map(r => r.variant))].join(" + ");
      const best = Math.max(...run.rows.map(r => r.accuracy));
      return `<li class="history-item">
        <div>
          <strong>Run #${runs.length - idx} · ${variants}</strong>
          <span>Seed ${run.seed} · ${run.rows.length} measurements · best ${(best * 100).toFixed(1)}%</span>
        </div>
        <div class="history-meta">${when}<br>SIMULATED</div>
      </li>`;
    }).join("");
  }

  function refreshUI() {
    const runs = loadRuns();
    updateOverview(runs);
    updateCompare(runs);
    updateHistory(runs);
    if (runs[0]) {
      const live = $("#exp-live-results");
      if (live) live.hidden = false;
      renderResultsTable(runs[0].rows);
      const chart = $("#results-chart");
      if (chart) drawBarChart(chart, runs[0].rows);
      const st = $("#live-result-state");
      if (st) st.textContent = "SIMULATED";
    }
  }

  async function runSimulation() {
    if (running) return;
    const seedInput = $("#seed-input");
    const batchSelect = $("#batch-select");
    const variantSelect = $("#variant-select");
    const seed = Number(seedInput?.value);
    if (!Number.isFinite(seed) || seed < 0 || seed > 9999) {
      notify("Please enter a seed between 0 and 9999.");
      return;
    }

    running = true;
    stopRequested = false;
    const btnRun = $("#btn-run-exp");
    const btnStop = $("#btn-stop-exp");
    if (btnRun) btnRun.disabled = true;
    if (btnStop) btnStop.disabled = false;
    const wrap = $("#exp-progress-wrap");
    if (wrap) wrap.hidden = false;
    const panelState = $("#exp-panel-state");
    if (panelState) panelState.textContent = "RUNNING";
    const live = $("#exp-live-results");
    if (live) live.hidden = false;
    $("#results-tbody").innerHTML = "";
    setProgress(0, "Preparing workload…");

    const stages = [
      { pct: 12, label: "Loading digits sample data…" },
      { pct: 28, label: "Encoding features (simulation)…" },
      { pct: 48, label: "Simulating FP32 inference path…" },
      { pct: 68, label: "Simulating INT8 path (if selected)…" },
      { pct: 85, label: "Aggregating memory & latency…" },
      { pct: 100, label: "Finalizing results…" }
    ];

    for (const stage of stages) {
      if (stopRequested) break;
      setProgress(stage.pct, stage.label);
      await new Promise(r => { runTimer = setTimeout(r, 320 + Math.random() * 280); });
    }

    if (stopRequested) {
      setProgress(0, "Stopped by user");
      if (panelState) panelState.textContent = "STOPPED";
      notify("Simulation stopped.");
    } else {
      const rows = simulateRows(seed, batchSelect.value, variantSelect.value);
      const run = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        ts: Date.now(),
        seed,
        batchFocus: batchSelect.value,
        variants: variantSelect.value,
        rows,
        simulated: true
      };
      const runs = loadRuns();
      runs.unshift(run);
      saveRuns(runs);
      renderResultsTable(rows);
      drawBarChart($("#results-chart"), rows);
      refreshUI();
      setProgress(100, "Complete — results are simulated");
      if (panelState) panelState.textContent = "COMPLETE";
      notify("Simulation finished. Results saved locally.");
    }

    running = false;
    if (btnRun) btnRun.disabled = false;
    if (btnStop) btnStop.disabled = true;
  }

  function stopSimulation() {
    if (!running) return;
    stopRequested = true;
    if (runTimer) clearTimeout(runTimer);
    notify("Stopping…");
  }

  function resetSimulation() {
    stopRequested = true;
    if (runTimer) clearTimeout(runTimer);
    running = false;
    localStorage.removeItem(STORAGE_KEY);
    $("#results-tbody").innerHTML = "";
    const live = $("#exp-live-results");
    if (live) live.hidden = true;
    const wrap = $("#exp-progress-wrap");
    if (wrap) wrap.hidden = true;
    setProgress(0, "Ready");
    const panelState = $("#exp-panel-state");
    if (panelState) panelState.textContent = "DEMO READY";
    $("#btn-run-exp").disabled = false;
    $("#btn-stop-exp").disabled = true;
    refreshUI();
    notify("All local simulation data cleared.");
  }

  $("#btn-run-exp")?.addEventListener("click", runSimulation);
  $("#btn-stop-exp")?.addEventListener("click", stopSimulation);
  $("#btn-reset-exp")?.addEventListener("click", resetSimulation);

  // Mobile sidebar toggle for lab (if hamburger used inside lab)
  $(".sidebar-help")?.addEventListener("click", () => {
    if (typeof dialog.showModal === "function") dialog.showModal();
  });

  // Initial paint from any stored runs
  refreshUI();

  window.addEventListener("beforeunload", () => clearTimeout(toastTimer));
})();
