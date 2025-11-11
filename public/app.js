const SHORT_DISCLAIMER =
  "This system provides automated market analysis for informational purposes only and does not constitute personalized financial, investment, or trading advice.";

document.addEventListener("DOMContentLoaded", () => {
  hydrateSystemStatus();
  hydrateSignals();
  hydrateBlog();
  wireNavLinks();
  wirePricingButtons();
  wireModal();
});

async function hydrateSystemStatus() {
  const statusEl = document.getElementById("system-status");
  if (!statusEl) return;
  try {
    const res = await fetch("/status");
    if (!res.ok) throw new Error("status_unavailable");
    const payload = await res.json();
    const ts = payload?.ts ? new Date(payload.ts) : new Date();
    statusEl.innerHTML = `<span class="status-dot"></span> Online • ${ts.toISOString().split("T").join(" ").slice(0, 19)} UTC`;
  } catch (error) {
    statusEl.textContent = "Status unavailable";
  }
}

function wireNavLinks() {
  document.querySelectorAll(".primary-nav a, .hero-actions a, .nav-cta a").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

async function hydrateSignals() {
  const container = document.getElementById("signals-list");
  const errorEl = document.getElementById("signals-error");
  if (!container) return;
  container.innerHTML = `<p class="empty">Loading signals…</p>`;
  if (errorEl) errorEl.textContent = "";

  try {
    const res = await fetch("/signals/today");
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
      errorEl.textContent = "Unable to load signals right now.";
    }
  }
}

function renderSignals(container, signals) {
  container.innerHTML = "";
  signals.forEach((signal) => {
    container.appendChild(buildSignalCard(signal));
  });
}

function buildSignalCard(signal) {
  const card = document.createElement("article");
  card.className = "signal-card";

  const header = document.createElement("div");
  header.className = "signal-card__header";

  const heading = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = signal?.symbol || "Symbol";
  const meta = document.createElement("p");
  meta.className = "signal-card__meta";
  meta.textContent = [formatAssetLabel(signal?.assetClass), formatChainLabel(signal?.chain)]
    .filter(Boolean)
    .join(" • ");
  heading.append(title, meta);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = signal?.timeframe || "Timeframe pending";

  header.append(heading, badge);
  card.append(header);

  const scenario = document.createElement("p");
  scenario.className = "scenario";
  scenario.textContent = summarizeExpectedMove(signal);
  card.append(scenario);

  const stop = document.createElement("p");
  stop.className = "stop";
  stop.textContent = signal?.stopLossHint || "Stop hints depend on individual risk limits.";
  card.append(stop);

  const rationaleList = document.createElement("ul");
  rationaleList.className = "rationale";
  const rationales = collectRationales(signal);
  rationales.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    rationaleList.append(li);
  });
  card.append(rationaleList);

  const risk = document.createElement("p");
  risk.className = "risk-note";
  risk.textContent = signal?.riskNote || "Risk note unavailable; review market conditions before acting.";
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

function collectRationales(signal) {
  const bucket = [];
  if (signal?.rationale?.technical) bucket.push(signal.rationale.technical);
  if (signal?.rationale?.fundamental) bucket.push(signal.rationale.fundamental);
  if (Array.isArray(signal?.rationales)) {
    signal.rationales.slice(0, 3).forEach((item) => {
      if (item) bucket.push(item);
    });
  }
  return bucket.length
    ? bucket.slice(0, 2).map((item) => formatText(item))
    : ["Signals describe potential moves and carry no guarantees."];
}

function formatText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return "";
}

function summarizeExpectedMove(signal) {
  const move = signal?.expectedMove;
  if (typeof move === "string" && move.trim()) {
    return move.trim();
  }
  if (move && typeof move === "object") {
    const horizon = move.horizon || signal?.timeframe || "the stated horizon";
    const range = move.rangePct;
    const bias = move.directionBias || "neutral";
    if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) {
      const biasLabel =
        bias === "bullish" ? "constructive" : bias === "bearish" ? "defensive" : "balanced";
      return `${signal?.symbol || "This asset"} could see a ${biasLabel} potential move of ${
        formatPercent(range.min)
      } to ${formatPercent(range.max)} over ${horizon}; outcomes depend on market conditions.`;
    }
    if (move.note) return move.note;
  }
  return `Model-estimated move for ${signal?.symbol || "this asset"} is pending; scenarios are not guaranteed.`;
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
  if (!Array.isArray(list) || !list.length) return "Aurora-Signals";
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

function wirePricingButtons() {
  document.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", () => handlePlan(button));
  });
}

function handlePlan(button) {
  const tier = button.dataset.plan;
  if (!tier) return;
  if (tier === "free") {
    document.querySelector("#today-signals")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  initiateCheckout(tier, button);
}

async function initiateCheckout(tier, button) {
  const feedback = document.querySelector(`[data-plan-error="${tier}"]`);
  if (feedback) {
    feedback.textContent = "";
    feedback.classList.remove("visible");
  }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Opening Stripe…";

  try {
    const res = await fetch("/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
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
    button.disabled = false;
    button.textContent = original;
  }
}

async function hydrateBlog() {
  const list = document.getElementById("blog-list");
  const error = document.getElementById("blog-error");
  if (!list) return;
  list.innerHTML = `<p class="empty">Loading blog posts…</p>`;
  if (error) error.textContent = "";

  try {
    const res = await fetch("/blog");
    if (!res.ok) throw new Error("blog_unavailable");
    const payload = await res.json();
    const posts = Array.isArray(payload?.posts) ? payload.posts : [];
    if (!posts.length) {
      list.innerHTML = "<p class='empty'>No blog posts yet.</p>";
      return;
    }
    list.innerHTML = "";
    posts.forEach((slug) => {
      const card = document.createElement("article");
      card.className = "blog-post";
      const title = document.createElement("h3");
      title.textContent = slug.replace(/-/g, " ");
      const button = document.createElement("button");
      button.className = "btn btn-outline";
      button.textContent = "Read more";
      button.addEventListener("click", () => openBlogPost(slug));
      card.append(title, button);
      list.append(card);
    });
  } catch (err) {
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
    const res = await fetch(`/blog/${encodeURIComponent(slug)}`);
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
    }
  });
}
