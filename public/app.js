const DEFAULT_API_BASE = "https://aurora-signals.onrender.com";
const API_BASE = resolveApiBase();
const state = {
  disclaimer: "",
  about: null,
};

document.addEventListener("DOMContentLoaded", () => {
  hydrateAbout();
  hydrateSystemStatus();
  hydrateSignals();
  hydrateBlog();
  wireNav();
  wireCheckoutButtons();
});

function resolveApiBase() {
  if (typeof window !== "undefined" && window.__MANY_SIGNALS_API__) {
    const override = String(window.__MANY_SIGNALS_API__).trim();
    if (override) return override;
  }
  const attr = document.documentElement?.dataset?.apiBase;
  if (attr && attr.trim()) return attr.trim();
  if (typeof window !== "undefined") {
    const { protocol, host } = window.location;
    if (host.includes("localhost")) {
      return `${protocol}//${host}`;
    }
  }
  return DEFAULT_API_BASE;
}

function api(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE.replace(/\/$/, "")}${suffix}`;
}

async function hydrateAbout() {
  const taglineEl = document.getElementById("about-tagline");
  const blurbEl = document.getElementById("about-blurb");
  const tierList = document.getElementById("tier-list");
  try {
    const res = await fetch(api("/about"));
    if (!res.ok) throw new Error("about_unavailable");
    const payload = await res.json();
    state.about = payload;
    state.disclaimer = payload?.disclaimer || state.disclaimer;
    if (taglineEl && payload?.tagline) taglineEl.textContent = payload.tagline;
    if (blurbEl && payload?.about) blurbEl.textContent = payload.about;
    if (tierList) renderTierList(tierList, payload?.tiers || []);
    setGlobalDisclaimer();
  } catch (error) {
    if (tierList) tierList.innerHTML = '<p class="empty">About endpoint unavailable right now.</p>';
    setGlobalDisclaimer();
  }
}

function renderTierList(container, tiers) {
  if (!Array.isArray(tiers) || !tiers.length) {
    container.innerHTML = '<p class="empty">Tier data not available.</p>';
    return;
  }
  container.innerHTML = "";
  tiers.forEach((tier) => {
    const card = document.createElement("div");
    card.className = "tier-card";
    const name = document.createElement("strong");
    name.textContent = `${tier.name} — ${tier.price}`;
    const summary = document.createElement("p");
    summary.textContent = tier.summary;
    const bestFor = document.createElement("p");
    bestFor.className = "signal-card__meta";
    bestFor.textContent = tier.bestFor;
    card.append(name, summary, bestFor);
    if (Array.isArray(tier.highlights) && tier.highlights.length) {
      const list = document.createElement("ul");
      list.className = "about-list";
      tier.highlights.slice(0, 3).forEach((highlight) => {
        const item = document.createElement("li");
        item.textContent = highlight;
        list.appendChild(item);
      });
      card.appendChild(list);
    }
    container.appendChild(card);
  });
}

async function hydrateSystemStatus() {
  const el = document.getElementById("system-status");
  try {
    const res = await fetch(api("/status"));
    if (!res.ok) throw new Error("status_unavailable");
    const payload = await res.json();
    const ts = payload?.ts ? new Date(payload.ts) : new Date();
    if (el) {
      el.textContent = `Online • ${ts.toISOString().replace("T", " ").slice(0, 19)} UTC`;
    }
  } catch (error) {
    if (el) el.textContent = "Status unavailable";
  }
}

async function hydrateSignals() {
  const container = document.getElementById("today-signals");
  const highlight = document.getElementById("status-highlight");
  if (!container) return;
  container.innerHTML = '<p class="empty">Loading signals…</p>';
  try {
    const res = await fetch(api("/signals/today"));
    if (!res.ok) throw new Error("signals_fetch_failed");
    const payload = await res.json();
    const signals = Array.isArray(payload) ? payload : [];
    if (!signals.length) {
      container.innerHTML = '<p class="empty">No signals published yet today.</p>';
      if (highlight) highlight.textContent = "Waiting for upstream data providers.";
      return;
    }
    container.innerHTML = "";
    signals.slice(0, 6).forEach((signal) => {
      container.appendChild(buildSignalCard(signal));
    });
    if (highlight) {
      const last = signals[0]?.asOf ? new Date(signals[0].asOf) : null;
      highlight.textContent = last
        ? `${signals.length} live scenarios • refreshed ${formatTimestamp(last)}`
        : `${signals.length} live scenarios ready.`;
    }
  } catch (error) {
    container.innerHTML = '<p class="empty">Signals unavailable right now; try again soon.</p>';
    if (highlight) highlight.textContent = "Signal fetch paused.";
  }
}

function buildSignalCard(signal) {
  const card = document.createElement("article");
  card.className = "signal-card";

  const header = document.createElement("header");
  const title = document.createElement("h3");
  title.textContent = signal?.symbol || "Symbol pending";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = signal?.timeframe || "Scenario";
  header.append(title, badge);
  card.appendChild(header);

  const meta = document.createElement("p");
  meta.className = "signal-card__meta";
  meta.textContent = buildMetaLabel(signal);
  card.appendChild(meta);

  const scenario = document.createElement("p");
  scenario.className = "scenario";
  scenario.textContent = formatScenario(signal?.expectedMove, signal?.symbol, signal?.timeframe);
  card.appendChild(scenario);

  const rationale = document.createElement("p");
  rationale.className = "signal-card__rationales";
  rationale.textContent = buildRationale(signal);
  card.appendChild(rationale);

  const stop = document.createElement("p");
  stop.className = "signal-card__stop";
  stop.textContent = formatStopHint(signal?.stopLossHint);
  card.appendChild(stop);

  const risk = document.createElement("p");
  risk.className = "signal-card__risk";
  risk.textContent = formatRisk(signal?.riskNote);
  card.appendChild(risk);

  const footer = document.createElement("div");
  footer.className = "signal-card__footer";
  const sources = document.createElement("span");
  sources.textContent = `Data: ${formatSources(signal?.dataSources)}`;
  const asOf = document.createElement("span");
  asOf.textContent = `As of ${formatTimestamp(signal?.asOf)}`;
  footer.append(sources, asOf);
  card.appendChild(footer);

  const disclaimer = document.createElement("p");
  disclaimer.className = "signal-card__disclaimer";
  disclaimer.textContent = (signal?.disclaimer || state.disclaimer || '').trim() || defaultDisclaimer();
  card.appendChild(disclaimer);

  return card;
}

function buildMetaLabel(signal) {
  const parts = [];
  if (signal?.assetClass) parts.push(capitalize(signal.assetClass));
  if (signal?.chain) parts.push(capitalize(signal.chain));
  return parts.join(" • ") || "Asset classification pending";
}

function buildRationale(signal) {
  const parts = [];
  if (signal?.rationale?.technical) parts.push(signal.rationale.technical);
  if (signal?.rationale?.fundamental) parts.push(signal.rationale.fundamental);
  if (signal?.rationale?.macro) parts.push(signal.rationale.macro);
  return parts.length
    ? parts
        .map((text) => String(text).trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(" ")
    : "Models blend technical, fundamental, and macro context; scenarios stay illustrative only.";
}

function formatScenario(text, symbol, timeframe) {
  const clean = typeof text === "string" && text.trim().length ? text.trim() : "";
  if (clean) return clean;
  const label = symbol || "This asset";
  const windowLabel = timeframe || "the stated horizon";
  return `${label} scenario for ${windowLabel} is forming; refresh after next data update.`;
}

function formatStopHint(text) {
  if (typeof text === "string" && text.trim()) return text.trim();
  return "Illustrative stop: align with personal risk controls using recent swing levels.";
}

function formatRisk(text) {
  return text && text.trim()
    ? text.trim()
    : "Risk note: liquidity, macro events, and funding conditions can invalidate the scenario quickly.";
}

function formatSources(list) {
  if (Array.isArray(list) && list.length) return list.join(", ");
  return "ManySignals";
}

function formatTimestamp(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function capitalize(value) {
  if (!value) return "";
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

async function hydrateBlog() {
  const list = document.getElementById("blog-list");
  if (!list) return;
  list.innerHTML = '<p class="empty">Loading posts…</p>';
  try {
    const res = await fetch(api("/blog"));
    if (!res.ok) throw new Error("blog_unavailable");
    const payload = await res.json();
    const posts = Array.isArray(payload?.posts) ? payload.posts : [];
    if (!posts.length) {
      list.innerHTML = '<p class="empty">No posts yet.</p>';
      return;
    }
    list.innerHTML = "";
    posts.slice(0, 4).forEach((slug) => {
      const item = document.createElement("div");
      item.className = "blog-item";
      const title = document.createElement("span");
      title.textContent = formatSlug(slug);
      const link = document.createElement("a");
      link.href = api(`/blog/${encodeURIComponent(slug)}`);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Read";
      item.append(title, link);
      list.appendChild(item);
    });
  } catch (error) {
    list.innerHTML = '<p class="empty">Blog unavailable right now.</p>';
  }
}

function formatSlug(slug) {
  if (!slug) return "Untitled";
  return slug
    .toString()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function wireNav() {
  const btn = document.getElementById("nav-pricing");
  if (btn) {
    btn.addEventListener("click", () => {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    });
  }
}

function wireCheckoutButtons() {
  document.querySelectorAll("[data-tier]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLButtonElement)) return;
      const tier = target.getAttribute("data-tier");
      if (!tier) return;
      startCheckout(target, tier);
    });
  });
}

async function startCheckout(button, tier) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Opening checkout…";
  try {
    const res = await fetch(api("/stripe/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: tier }),
    });
    const payload = await res.json();
    if (!res.ok || !payload?.ok) {
      throw new Error(payload?.error || "checkout_failed");
    }
    if (payload?.url) {
      window.location.href = payload.url;
    } else {
      alert("Free tier confirmed — no checkout required.");
    }
  } catch (error) {
    console.error("checkout_failed", error);
    alert("Checkout unavailable. Please confirm Stripe env vars and try again.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function setGlobalDisclaimer() {
  const el = document.getElementById("global-disclaimer");
  if (!el) return;
  const text = (state.disclaimer || defaultDisclaimer()).trim();
  el.textContent = text;
}

function defaultDisclaimer() {
  return "This system provides automated market analysis for informational purposes only and does not constitute personalized financial, investment, or trading advice.";
}
