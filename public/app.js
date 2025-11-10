const FALLBACK_DISCLAIMER =
  "This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice.";
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
    renderSignals(list, signals);
  } catch (error) {
    console.warn("signals.load.failed", error);
    if (list) {
      list.innerHTML =
        '<p class="empty">Signals are unavailable right now. Please try again shortly.</p>';
    }
    if (errorEl) {
      errorEl.textContent = triggeredByUser
        ? "Unable to refresh signals. Please retry in a few moments."
        : "Live signals temporarily unavailable.";
    }
  }
}

function renderSignals(container, signals) {
  container.innerHTML = "";
  if (!Array.isArray(signals) || !signals.length) {
    container.innerHTML = '<p class="empty">No qualified signals were produced today.</p>';
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
  meta.textContent = [
    capitalize(signal.assetClass || "Asset"),
    formatChain(signal.chain),
  ]
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

  if (typeof signal.suggestedStopLossPct === "number" && signal.suggestedStopLossPct > 0) {
    const stop = document.createElement("p");
    stop.className = "stop";
    stop.textContent = `Suggested stop: ${(signal.suggestedStopLossPct * 100).toFixed(1)}%`;
    card.append(stop);
  }

  const rationaleList = document.createElement("ul");
  rationaleList.className = "rationale";
  (signal.rationales || []).slice(0, 3).forEach((reason) => {
    if (!reason) return;
    const li = document.createElement("li");
    li.textContent = reason;
    rationaleList.append(li);
  });
  card.append(rationaleList);

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

  return card;
}

function formatExpectedMove(signal) {
  const block = signal?.expectedMove;
  const range = block?.rangePct;
  if (!block || !range || typeof range.min !== "number" || typeof range.max !== "number") {
    return "Model-estimated move unavailable.";
  }
  const bias = capitalize(block.directionBias || "neutral");
  return `Bias: ${bias} • Range ${formatRangeValue(range.min)}% to ${formatRangeValue(
    range.max,
  )}% over ${block.horizon || signal.timeframe || "the stated horizon"}`;
}

function formatRangeValue(value) {
  const fixed = Number(value).toFixed(1);
  return value > 0 ? `+${fixed}` : fixed;
}

function formatChain(chain) {
  if (!chain) return "";
  if (chain === "eth") return "Ethereum";
  if (chain === "solana") return "Solana";
  return "Off-chain";
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

function capitalize(value) {
  if (!value || typeof value !== "string") return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function wirePricingButtons() {
  const buttons = document.querySelectorAll("[data-plan]");
  if (!buttons.length) return;
  const statusEl = document.getElementById("pricing-status");
  buttons.forEach((button) => {
    button.addEventListener("click", () => handleCheckout(button, statusEl));
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

async function handleCheckout(button, statusEl) {
  const tier = button.dataset.plan;
  if (!tier) return;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Redirecting…";
  if (statusEl) statusEl.textContent = "";

  try {
    const res = await fetch("/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const payload = await res.json();
    if (!res.ok || !payload?.ok || typeof payload?.url !== "string") {
      throw new Error(payload?.error || "Stripe checkout unavailable");
    }
    window.location.href = payload.url;
  } catch (error) {
    console.error("stripe.checkout.failed", error);
    if (statusEl) {
      statusEl.textContent =
        "Checkout unavailable right now. Please confirm Stripe keys or try later.";
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}
