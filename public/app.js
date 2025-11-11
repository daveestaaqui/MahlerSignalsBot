const FALLBACK_DISCLAIMER =
  "This system provides automated market analysis for informational purposes only and does not constitute personalized financial, investment, or trading advice.";
const FALLBACK_ABOUT =
  "Aurora-Signals pairs real market + on-chain data with automated risk notes so desks can review high-signal setups quickly.";

document.addEventListener("DOMContentLoaded", () => {
  setCurrentYear();
  hydrateCopy();
  hydrateStatus();
  hydrateSignals();
  wireRefreshButton();
  wirePricingButtons();
  wireScrollLinks();
});

function setCurrentYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

async function hydrateCopy() {
  try {
    const res = await fetch("/config");
    if (!res.ok) throw new Error(`status_${res.status}`);
    const payload = await res.json();
    applyCopy(payload?.copy);
  } catch (error) {
    console.warn("copy.load.failed", error);
    applyCopy({});
  }
}

function applyCopy(copy) {
  const disclaimer = (copy?.disclaimerShort || "").trim() || FALLBACK_DISCLAIMER;
  const about = (copy?.aboutAurora || "").trim() || FALLBACK_ABOUT;
  document.querySelectorAll('[data-copy="disclaimer"]').forEach((node) => {
    node.textContent = disclaimer;
  });
  document.querySelectorAll('[data-copy="about"]').forEach((node) => {
    node.textContent = about;
  });
}

async function hydrateStatus() {
  const target = document.getElementById("status-text");
  if (!target) return;
  try {
    const res = await fetch("/status");
    if (!res.ok) throw new Error(`status_${res.status}`);
    const payload = await res.json();
    const ts = payload?.ts ? new Date(payload.ts) : new Date();
    target.textContent = `Healthy • ${ts.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    })} UTC`;
  } catch (error) {
    console.warn("status.load.failed", error);
    target.textContent = "Status endpoint unavailable";
  }
}

function wireRefreshButton() {
  const button = document.getElementById("refresh-signals");
  if (!button) return;
  button.addEventListener("click", () => {
    hydrateSignals(true);
  });
}

async function hydrateSignals(triggeredByUser = false) {
  const list = document.getElementById("signals-list");
  const errorEl = document.getElementById("signals-error");
  if (!list) return;
  list.innerHTML = `<p class="empty">Fetching live data…</p>`;
  if (errorEl) errorEl.textContent = "";

  try {
    const res = await fetch("/signals/today");
    if (!res.ok) throw new Error(`status_${res.status}`);
    const payload = await res.json();
    const signals = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.signals)
      ? payload.signals
      : [];
    if (!signals.length) {
      list.innerHTML =
        '<p class="empty">No scenarios to highlight right now; check back later.</p>';
      return;
    }
    renderSignals(list, signals);
  } catch (error) {
    console.warn("signals.load.failed", error);
    list.innerHTML =
      '<p class="empty">Signals are temporarily unavailable. Please try again later.</p>';
    if (errorEl) {
      errorEl.textContent = triggeredByUser
        ? "Unable to refresh signals. Please retry in a few moments."
        : "Signals are temporarily unavailable. Please try again later.";
    }
  }
}

function renderSignals(container, signals) {
  container.innerHTML = "";
  if (!Array.isArray(signals) || !signals.length) {
    container.innerHTML = '<p class="empty">No scenarios to highlight right now; check back later.</p>';
    return;
  }

  signals.slice(0, 5).forEach((signal) => {
    container.appendChild(buildSignalCard(signal));
  });
}

function buildSignalCard(signal) {
  const card = document.createElement("article");
  card.className = "signal-card";

  const header = document.createElement("div");
  header.className = "signal-card__header";

  const headingGroup = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = signal.symbol || "Symbol";
  const meta = document.createElement("p");
  meta.className = "signal-card__meta";
  meta.textContent = [formatAssetLabel(signal.assetClass), formatChain(signal.chain)]
    .filter(Boolean)
    .join(" • ");
  headingGroup.append(title, meta);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = signal.timeframe || "1–7 days";

  header.append(headingGroup, badge);
  card.append(header);

  const scenario = document.createElement("p");
  scenario.className = "scenario";
  scenario.textContent = formatExpectedMove(signal);
  card.append(scenario);

  if (typeof signal.stopLossHint === "string" && signal.stopLossHint.trim().length) {
    const stop = document.createElement("p");
    stop.className = "stop";
    stop.textContent = signal.stopLossHint;
    card.append(stop);
  }

  const rationaleBullets = buildRationaleBullets(signal);
  if (rationaleBullets.length) {
    const rationaleList = document.createElement("ul");
    rationaleList.className = "rationale";
    rationaleBullets.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      rationaleList.append(li);
    });
    card.append(rationaleList);
  }

  const risk = document.createElement("p");
  risk.className = "risk-note";
  risk.textContent = signal.riskNote || "No additional risk note available.";
  card.append(risk);

  const footer = document.createElement("div");
  footer.className = "signal-card__footer";

  const sources = document.createElement("p");
  sources.textContent = `Data sources: ${formatDataSources(signal.dataSources)}`;
  const asOf = document.createElement("p");
  asOf.textContent = `As of ${formatAsOf(signal.asOf)}`;
  const link = document.createElement("a");
  link.className = "signal-link";
  link.href = "/signals/today";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "See full details";

  footer.append(sources, asOf, link);
  card.append(footer);

  const disclaimer = document.createElement("p");
  disclaimer.className = "signal-card__disclaimer";
  disclaimer.textContent = (signal.disclaimer || FALLBACK_DISCLAIMER).trim();
  card.append(disclaimer);

  return card;
}

function formatExpectedMove(signal) {
  const value = signal?.expectedMove;
  if (typeof value === "string" && value.trim().length) {
    return value;
  }
  if (value && typeof value === "object") {
    const range = value.rangePct;
    const horizon = value.horizon || signal?.timeframe || "the stated horizon";
    const bias = value.directionBias || "neutral";
    const scenarioText =
      typeof value.scenarioText === "string"
        ? value.scenarioText
        : typeof value.note === "string"
        ? value.note
        : null;
    if (scenarioText && scenarioText.trim().length) {
      return scenarioText;
    }
    if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) {
      const biasLabel =
        bias === "bullish" ? "constructive" : bias === "bearish" ? "defensive" : "balanced";
      const minLabel = formatSignedPercent(range.min);
      const maxLabel = formatSignedPercent(range.max);
      return `${signal.symbol || "This asset"} could see a ${biasLabel} potential move of ${minLabel} to ${maxLabel} over ${horizon}, but outcomes depend on market conditions.`;
    }
  }
  return `Model-estimated move data over ${signal?.timeframe || "the stated horizon"} is pending; please check back later.`;
}

function buildRationaleBullets(signal) {
  const bullets = [];
  const fallback = Array.isArray(signal?.rationales) ? [...signal.rationales] : [];
  const technical =
    signal?.rationale?.technical ||
    (fallback.length ? fallback.shift() : null) ||
    (fallback.length ? fallback.shift() : null);
  const fundamental =
    signal?.rationale?.fundamental || (fallback.length ? fallback.shift() : null);

  if (technical) bullets.push(technical);
  if (fundamental) bullets.push(fundamental);

  while (bullets.length < 2 && fallback.length) {
    const next = fallback.shift();
    if (next) bullets.push(next);
  }

  return bullets
    .filter(Boolean)
    .map((item) => (typeof item === "string" ? item : String(item)))
    .slice(0, 2);
}

function formatChain(chain) {
  if (!chain) return "";
  if (chain === "ethereum") return "Ethereum";
  if (chain === "solana") return "Solana";
  return capitalize(chain);
}

function formatAssetLabel(assetClass) {
  if (!assetClass) return "Asset";
  if (assetClass === "crypto") return "Crypto";
  if (assetClass === "stock") return "Equity";
  return capitalize(assetClass);
}

function formatDataSources(sources) {
  if (!Array.isArray(sources) || !sources.length) return "Aurora-Signals";
  return sources.join(", ");
}

function formatAsOf(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

function formatSignedPercent(value) {
  if (!Number.isFinite(Number(value))) return "";
  const normalized = Number(value);
  const formatted = normalized.toFixed(1);
  return normalized > 0 ? `+${formatted}%` : `${formatted}%`;
}

function capitalize(value) {
  if (!value || typeof value !== "string") return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function wirePricingButtons() {
  const buttons = document.querySelectorAll("[data-plan]");
  if (!buttons.length) return;
  buttons.forEach((button) => {
    button.addEventListener("click", () => handleCheckout(button));
  });
}

function wireScrollLinks() {
  document.querySelectorAll("[data-scroll-target]").forEach((element) => {
    const target = element.getAttribute("data-scroll-target");
    if (!target) return;
    element.addEventListener("click", (event) => {
      event.preventDefault();
      const node = document.querySelector(target);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

async function handleCheckout(button) {
  const tier = button.dataset.plan;
  if (!tier) return;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Redirecting…";
  const feedback = getPlanFeedbackEl(tier);
  if (feedback) {
    feedback.textContent = "";
    feedback.classList.remove("visible");
  }

  try {
    const res = await fetch("/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const payload = await res.json();
    if (!res.ok || !payload?.ok || typeof payload?.url !== "string") {
      const err = payload?.error || `stripe_checkout_${res.status}`;
      throw new Error(err);
    }
    window.location.href = payload.url;
  } catch (error) {
    console.error("stripe.checkout.failed", error);
    if (feedback) {
      feedback.textContent = describeCheckoutError(error);
      feedback.classList.add("visible");
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function getPlanFeedbackEl(tier) {
  if (!tier) return null;
  return document.querySelector(`[data-plan-error="${tier}"]`);
}

function describeCheckoutError(error) {
  if (error instanceof Error && error.message) {
    return `Checkout is unavailable (${error.message}). Please try again shortly.`;
  }
  return "Checkout is unavailable right now. Please try again shortly.";
}
