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
  container.classList.remove("signals-grid--loading");
  container.innerHTML = "";

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

  try {
    const res = await fetch("/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });

    if (!res.ok) {
      throw new Error(`Stripe checkout failed: ${res.status}`);
    }

    const json = await res.json();
    if (json.ok && json.url) {
      window.location.href = json.url;
      return;
    }

    throw new Error(json.error || "Unknown Stripe error");
  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent =
        "Unable to start checkout right now. This can happen if Stripe is not fully configured. Please try again later.";
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
