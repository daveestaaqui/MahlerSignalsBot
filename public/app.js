<<<<<<< HEAD
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function formatPercent(n) {
  if (typeof n !== "number" || !isFinite(n)) return "";
  const val = Math.round(n * 10) / 10;
  return `${val}%`;
}

function timeframeLabel(text) {
  if (!text) return "over the stated horizon";
  const t = String(text).toLowerCase();
  if (t.includes("hour") || t.includes("day")) return `(${text})`;
  if (t.includes("week")) return `(${text})`;
  return text;
}

function ensureScenarioLanguage(text, symbol, timeframe) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (/potential|scenario|could|might/i.test(cleaned)) return cleaned;
  return `${symbol} ${timeframeLabel(timeframe)} potential move: ${cleaned} (not guaranteed).`;
}

function buildMoveSentence(signal) {
  const symbol = signal.symbol || "This asset";
  const move = signal.expectedMove || {};
  const range = move.rangePct || {};
  const horizon = move.horizon || signal.timeframe || "the stated horizon";
  const bias = (move.directionBias || "").toLowerCase();
  const biasLabel =
    bias === "bullish" ? "constructive" : bias === "bearish" ? "defensive" : "balanced";

  if (typeof range.min === "number" && typeof range.max === "number") {
    return `${symbol} ${timeframeLabel(horizon)} could see a ${biasLabel} potential move of ${formatPercent(
      range.min
    )} to ${formatPercent(range.max)} if current conditions persist; outcomes are uncertain.`;
=======
const SHORT_DISCLAIMER =
  "This system provides automated market analysis for informational purposes only and does not constitute personalized financial, investment, or trading advice.";
const DEFAULT_API_BASE = "https://api.manysignals.finance";
const API_BASE = resolveApiBase();

document.addEventListener("DOMContentLoaded", () => {
  hydrateSystemStatus();
  hydrateSignals();
  hydrateBlog();
  wireNavLinks();
  wireCheckoutButtons();
  wireModal();
});

function resolveApiBase() {
  if (typeof window !== "undefined" && window.__MANY_SIGNALS_API__) {
    const explicit = String(window.__MANY_SIGNALS_API__).trim();
    if (explicit) return explicit;
  }
  const attr = typeof document !== "undefined" ? document.documentElement?.dataset?.apiBase : "";
  if (attr && attr.trim()) return attr.trim();
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }
  return DEFAULT_API_BASE;
}

function api(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE.replace(/\/$/, "")}${suffix}`;
}

async function hydrateSystemStatus() {
  const statusEl = document.getElementById("system-status");
  if (!statusEl) return;
  try {
    const res = await fetch(api("/status"));
    if (!res.ok) throw new Error("status_unavailable");
    const payload = await res.json();
    const ts = payload?.ts ? new Date(payload.ts) : new Date();
    statusEl.innerHTML = `<span class="status-dot"></span> Online • ${ts.toISOString().split("T").join(" ").slice(0, 19)} UTC`;
  } catch (error) {
    statusEl.textContent = "Status unavailable";
>>>>>>> 27a214a (feat(prod): manysignals.finance integration, CORS, Stripe, marketing, docs)
  }

  if (move.note) {
    return ensureScenarioLanguage(move.note, symbol, horizon);
  }

  return `${symbol} ${timeframeLabel(
    horizon
  )} scenario is forming; outcomes remain uncertain until the next refresh.`;
}

function renderSignals(signals) {
  const container = document.querySelector("#today-signals");
  if (!container) return;
<<<<<<< HEAD
  container.classList.remove("signals-grid--loading");
=======
  container.innerHTML = `<p class="empty">Loading signals…</p>`;
  if (errorEl) errorEl.textContent = "";

  try {
    const res = await fetch(api("/signals/today"));
    if (!res.ok) throw new Error("signals_fetch_failed");
    const payload = await res.json();
    const signals = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.signals)
      ? payload.signals
      : [];
    if (!signals.length) {
      container.innerHTML = '<p class="empty">No scenarios to highlight right now; check back later.</p>';
      return;
    }
    renderSignals(container, signals.slice(0, 6));
  } catch (error) {
    container.innerHTML =
      '<p class="empty">Signals are temporarily unavailable. Please try again later.</p>';
    if (errorEl) {
      errorEl.textContent = "Signal feed paused; refresh in a moment.";
    }
  }
}

function renderSignals(container, signals) {
>>>>>>> 27a214a (feat(prod): manysignals.finance integration, CORS, Stripe, marketing, docs)
  container.innerHTML = "";

<<<<<<< HEAD
  if (!Array.isArray(signals) || signals.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "signals-placeholder";
    placeholder.innerHTML = `<p>No scenarios are available right now. This can happen if upstream data providers are unavailable or filters are very strict.</p>`;
    container.appendChild(placeholder);
    return;
  }

  const subset = signals.slice(0, 4);
  for (const s of subset) {
    const card = document.createElement("article");
    card.className = "signal-card";

    const identity = document.createElement("div");
    identity.className = "signal-card__identity";

    const title = document.createElement("h3");
    title.textContent = s.symbol || "Unlabeled asset";

    const badge = document.createElement("span");
    badge.className = "signal-card__badge";
    badge.textContent = (s.assetClass || "asset").toUpperCase();

    identity.appendChild(title);
    identity.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "signal-card__meta";
    const tf = document.createElement("span");
    tf.textContent = s.timeframe || s.expectedMove?.horizon || "Horizon pending";
    meta.appendChild(tf);

    if (Array.isArray(s.dataSources) && s.dataSources.length > 0) {
      const src = document.createElement("span");
      src.textContent = `Data: ${s.dataSources.join(", ")}`;
      meta.appendChild(src);
    }

    const body = document.createElement("div");
    body.className = "signal-card__body";
    body.textContent = buildMoveSentence(s);

    const rationales = document.createElement("p");
    rationales.className = "signal-card__rationales";
    if (Array.isArray(s.rationales) && s.rationales.length > 0) {
      rationales.textContent = s.rationales.join(" ");
    } else {
      rationales.textContent =
        "Rationales are available inside the full signal feed for this asset.";
    }

    const stop = document.createElement("p");
    stop.className = "signal-card__stop";
    if (typeof s.stopLossHint === "string" && s.stopLossHint.trim()) {
      stop.textContent = s.stopLossHint;
    } else {
      stop.textContent =
        "Illustrative stop level depends on volatility and position sizing; no level is guaranteed.";
    }

    const risk = document.createElement("p");
    risk.className = "signal-card__risk";
    risk.textContent =
      s.riskNote ||
      "Market conditions can change quickly; scenarios may break down if liquidity, news flow, or volatility shifts.";

    const disc = document.createElement("p");
    disc.className = "signal-card__disclaimer";
    disc.textContent =
      s.disclaimer ||
      "This system provides automated market analysis for informational purposes only and does not constitute personalized financial, investment, or trading advice.";

    card.appendChild(identity);
    card.appendChild(meta);
    card.appendChild(body);
    card.appendChild(rationales);
    card.appendChild(stop);
    card.appendChild(risk);
    card.appendChild(disc);

    container.appendChild(card);
  }
=======
function buildSignalCard(signal) {
  const card = document.createElement("article");
  card.className = "signal-card";

  const header = document.createElement("header");
  header.className = "signal-card__header";

  const identity = document.createElement("div");
  identity.className = "signal-card__identity";
  const title = document.createElement("h3");
  title.textContent = signal?.symbol || "Symbol pending";
  const meta = document.createElement("p");
  meta.className = "signal-card__meta";
  meta.textContent = buildMetaLabel(signal);
  identity.append(title, meta);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = signal?.timeframe || "Timeframe pending";

  header.append(identity, badge);
  card.append(header);

  const scenario = document.createElement("p");
  scenario.className = "scenario";
  scenario.textContent = summarizeExpectedMove(signal);
  card.append(scenario);

  const rationale = document.createElement("p");
  rationale.className = "signal-card__rationales";
  rationale.textContent = buildRationaleParagraph(signal);
  card.append(rationale);

  const stop = document.createElement("p");
  stop.className = "signal-card__stop";
  stop.textContent = formatStopHint(signal?.stopLossHint);
  card.append(stop);

  const risk = document.createElement("p");
  risk.className = "signal-card__risk";
  risk.textContent = formatRiskNote(signal?.riskNote);
  card.append(risk);

  const footer = document.createElement("div");
  footer.className = "signal-card__footer";
  const sources = document.createElement("p");
  sources.textContent = `Data sources: ${formatSources(signal?.dataSources)}`;
  const date = document.createElement("p");
  date.textContent = `As of ${formatTimestamp(signal?.asOf)}`;
  footer.append(sources, date);
  card.append(footer);

  const disclaimer = document.createElement("p");
  disclaimer.className = "signal-card__disclaimer";
  disclaimer.textContent = signal?.disclaimer?.trim() || SHORT_DISCLAIMER;
  card.append(disclaimer);

  return card;
}

function buildMetaLabel(signal) {
  const pieces = [formatAssetLabel(signal?.assetClass)];
  const chain = formatChainLabel(signal?.chain);
  if (chain) pieces.push(chain);
  return pieces.filter(Boolean).join(" • ") || "Awaiting classification";
}

function buildRationaleParagraph(signal) {
  const parts = [];
  if (signal?.rationale?.technical) parts.push(signal.rationale.technical);
  if (signal?.rationale?.fundamental) parts.push(signal.rationale.fundamental);
  if (signal?.rationale?.risk) parts.push(signal.rationale.risk);
  if (Array.isArray(signal?.rationales)) {
    signal.rationales.forEach((text) => {
      if (parts.length < 2 && text) parts.push(text);
    });
  }
  if (!parts.length && signal?.riskNote) {
    parts.push(signal.riskNote);
  }
  return parts.length
    ? parts
        .map((text) => (typeof text === "string" ? text.trim() : ""))
        .filter(Boolean)
        .slice(0, 2)
        .join(" ")
    : "Scenarios pair current technical and fundamental reads; outcomes are uncertain if conditions shift.";
}

function formatStopHint(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Stop hint: use recent swing levels and personal risk limits for illustration only.";
}

function formatRiskNote(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Risk note: scenarios are informational and not guaranteed.";
}

function summarizeExpectedMove(signal) {
  const move = signal?.expectedMove;
  const symbol = signal?.symbol || "This asset";
  const timeframe = signal?.timeframe || "the stated horizon";
  if (typeof move === "string" && move.trim()) {
    return ensureScenarioLanguage(move.trim(), symbol, timeframe);
  }
  if (move && typeof move === "object") {
    const horizon = move.horizon || signal?.timeframe || "the stated horizon";
    const range = move.rangePct;
    const bias = move.directionBias || "neutral";
    if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) {
      const biasLabel =
        bias === "bullish" ? "constructive" : bias === "bearish" ? "defensive" : "balanced";
      return `${symbol} ${timeframeLabel(horizon)} could see a ${biasLabel} potential move of ${formatPercent(
        range.min,
      )} to ${formatPercent(range.max)} if current conditions persist; outcomes are uncertain.`;
    }
    if (move.note) return ensureScenarioLanguage(move.note, symbol, timeframe);
  }
  return `${symbol} ${timeframeLabel(timeframe)} scenario is forming; outcomes remain uncertain until the next refresh.`;
}

function ensureScenarioLanguage(text, symbol, timeframe) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (/potential/i.test(cleaned) || /scenario/i.test(cleaned)) return cleaned;
  return `${symbol} ${timeframeLabel(timeframe)} potential move: ${cleaned} (not guaranteed).`;
}

function timeframeLabel(text) {
  if (!text) return "over the stated horizon";
  return text.toLowerCase().includes("hour") || text.toLowerCase().includes("day") ? `(${text})` : text;
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0%";
  return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
}

function formatAssetLabel(assetClass) {
  if (!assetClass) return "";
  if (assetClass.toLowerCase() === "crypto") return "Crypto";
  if (assetClass.toLowerCase() === "stock" || assetClass.toLowerCase() === "equity") return "Equity";
  return capitalize(assetClass);
}

function formatChainLabel(chain) {
  if (!chain) return "";
  if (chain.toLowerCase() === "ethereum") return "Ethereum";
  if (chain.toLowerCase() === "solana") return "Solana";
  return capitalize(chain);
}

function formatSources(list) {
  if (!Array.isArray(list) || !list.length) return "ManySignals";
  return list.join(", ");
}

function formatTimestamp(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

function capitalize(value) {
  if (!value || typeof value !== "string") return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function wireCheckoutButtons() {
  const freeButton = document.getElementById("btn-free");
  if (freeButton) {
    freeButton.addEventListener("click", (event) => {
      event.preventDefault();
      document.querySelector("#today")?.scrollIntoView({ behavior: "smooth" });
    });
  }
  const proButton = document.getElementById("btn-pro");
  if (proButton) {
    proButton.addEventListener("click", (event) => {
      event.preventDefault();
      initiateCheckout("pro", proButton);
    });
  }
  const eliteButton = document.getElementById("btn-elite");
  if (eliteButton) {
    eliteButton.addEventListener("click", (event) => {
      event.preventDefault();
      initiateCheckout("elite", eliteButton);
    });
  }
>>>>>>> 27a214a (feat(prod): manysignals.finance integration, CORS, Stripe, marketing, docs)
}

async function loadStatus() {
  try {
    const status = await fetchJson("/status");
    const backendEl = document.querySelector("#status-backend");
    const refreshedEl = document.querySelector("#status-refreshed");
    if (backendEl) backendEl.textContent = status.ok ? "Online" : "Degraded";
    if (refreshedEl && status.ts) {
      const d = new Date(status.ts);
      refreshedEl.textContent = d.toLocaleString();
    }
  } catch {
    const backendEl = document.querySelector("#status-backend");
    const refreshedEl = document.querySelector("#status-refreshed");
    if (backendEl) backendEl.textContent = "Unreachable";
    if (refreshedEl) refreshedEl.textContent = "";
  }

  try {
    const signals = await fetchJson("/signals/today");
    const el = document.querySelector("#status-signals");
    if (el) el.textContent = Array.isArray(signals) && signals.length > 0 ? "Healthy" : "Empty";
    renderSignals(signals);
  } catch {
    const el = document.querySelector("#status-signals");
    if (el) el.textContent = "Error";
    renderSignals([]);
  }
}

async function startCheckout(tier) {
  const errorEl = document.querySelector("#pricing-error");
  if (errorEl) {
    errorEl.hidden = true;
  }

  if (tier === "free") {
    const section = document.querySelector("#today");
    if (section) section.scrollIntoView({ behavior: "smooth" });
    return;
  }
<<<<<<< HEAD
=======
  const original = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Opening Stripe…";
  }
>>>>>>> 27a214a (feat(prod): manysignals.finance integration, CORS, Stripe, marketing, docs)

  try {
    const res = await fetch(api("/stripe/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
<<<<<<< HEAD
=======
    const data = await res.json();
    if (!res.ok || !data?.ok || !data?.url) {
      throw new Error(data?.error || "stripe_checkout_failed");
    }
    window.location.href = data.url;
  } catch (error) {
    if (feedback) {
      feedback.textContent = "Checkout is temporarily unavailable. Please try again shortly.";
      feedback.classList.add("visible");
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}
>>>>>>> 27a214a (feat(prod): manysignals.finance integration, CORS, Stripe, marketing, docs)

    if (!res.ok) {
      throw new Error(`Stripe checkout failed: ${res.status}`);
    }

<<<<<<< HEAD
    const json = await res.json();
    if (json.ok && json.url) {
      window.location.href = json.url;
=======
  try {
    const res = await fetch(api("/blog"));
    if (!res.ok) throw new Error("blog_unavailable");
    const payload = await res.json();
    const posts = Array.isArray(payload?.posts) ? payload.posts : [];
    if (!posts.length) {
      list.innerHTML = "<p class='empty'>No blog posts yet.</p>";
>>>>>>> 27a214a (feat(prod): manysignals.finance integration, CORS, Stripe, marketing, docs)
      return;
    }

    throw new Error(json.error || "Unknown Stripe error");
  } catch (err) {
<<<<<<< HEAD
    console.error(err);
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent =
        "Unable to start checkout right now. This can happen if Stripe is not fully configured. Please try again later.";
=======
    list.innerHTML = "<p class='empty'>Blog is loading slowly; please try again later.</p>";
    if (error) error.textContent = "Unable to load blog posts.";
  }
}

async function openBlogPost(slug) {
  const backdrop = document.getElementById("modal-backdrop");
  const modalContent = document.getElementById("modal-content");
  if (!backdrop || !modalContent) return;
  modalContent.innerHTML = "<p>Loading post…</p>";
  backdrop.hidden = false;
  try {
    const res = await fetch(api(`/blog/${encodeURIComponent(slug)}`));
    if (!res.ok) throw new Error("blog_post_unavailable");
    const text = await res.text();
    modalContent.innerHTML = renderMarkdown(text);
  } catch (error) {
    modalContent.innerHTML = "<p>Unable to load post. Please try again later.</p>";
  }
}

function renderMarkdown(markdown) {
  const escaped = markdown.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .split(/\r?\n\r?\n/)
    .map((block) => {
      if (block.startsWith("## ")) {
        return `<h3>${block.slice(3)}</h3>`;
      }
      if (block.startsWith("# ")) {
        return `<h2>${block.slice(2)}</h2>`;
      }
      if (block.startsWith("### ")) {
        return `<h4>${block.slice(4)}</h4>`;
      }
      return `<p>${block.replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

function wireModal() {
  const backdrop = document.getElementById("modal-backdrop");
  const close = document.getElementById("modal-close");
  if (!backdrop || !close) return;
  close.addEventListener("click", () => {
    backdrop.hidden = true;
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      backdrop.hidden = true;
>>>>>>> 27a214a (feat(prod): manysignals.finance integration, CORS, Stripe, marketing, docs)
    }
  }
}

function wireInteractions() {
  const ctaView = document.querySelector("#cta-view-today");
  if (ctaView) {
    ctaView.addEventListener("click", () => {
      const section = document.querySelector("#today");
      if (section) section.scrollIntoView({ behavior: "smooth" });
    });
  }

  const navSubscribe = document.querySelector("#nav-subscribe");
  if (navSubscribe) {
    navSubscribe.addEventListener("click", () => {
      const section = document.querySelector("#pricing");
      if (section) section.scrollIntoView({ behavior: "smooth" });
    });
  }

  document.querySelectorAll("[data-tier]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tier = e.currentTarget.getAttribute("data-tier");
      if (!tier) return;
      startCheckout(tier);
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  wireInteractions();
  loadStatus();
});
