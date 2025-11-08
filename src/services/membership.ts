import { promises as fs } from "fs";
import path from "path";
import { log } from "../lib/log";

export type MemberRole = "pro" | "elite";

type MemberStore = Record<
  string,
  {
    role: MemberRole;
    updatedAt: number;
  }
>;

const MEMBERS_PATH = path.resolve(process.cwd(), "dist/data/members.json");

let cachedPriceRoleMap: Record<string, MemberRole> | null = null;

type StripeEvent = {
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

export function mapPriceToRole(priceId: string | null | undefined): MemberRole | null {
  if (!priceId) {
    return null;
  }

  const normalized = priceId.trim();
  if (!normalized) {
    return null;
  }

  const map = getPriceRoleMap();
  return map[normalized] ?? null;
}

export async function recordMembershipAssignment(
  email: string,
  role: MemberRole
): Promise<void> {
  if (!email) {
    log("warn", "membership assignment skipped", {
      reason: "missing_email",
      role,
    });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    log("warn", "membership assignment skipped", {
      reason: "empty_email",
      role,
    });
    return;
  }

  log("info", `ASSIGN ROLE ${normalizedEmail} → ${role}`);

  const store = await readStore();
  store[normalizedEmail] = { role, updatedAt: Date.now() };
  await writeStore(store);
}

export async function handleMembershipWebhook(event: StripeEvent): Promise<void> {
  const object = (event?.data?.object ?? {}) as Record<string, unknown>;
  const email = extractEmail(object);
  const priceIds = extractPriceIds(object);

  if (!email) {
    log("warn", "stripe membership missing email", {
      type: event?.type ?? "unknown",
    });
    return;
  }

  if (priceIds.length === 0) {
    log("warn", "stripe membership missing price ids", {
      email,
      type: event?.type ?? "unknown",
    });
    return;
  }

  for (const priceId of priceIds) {
    const role = mapPriceToRole(priceId);
    if (!role) {
      log("warn", "stripe membership unknown price", {
        email,
        priceId,
      });
      continue;
    }
    await recordMembershipAssignment(email, role);
  }
}

function extractEmail(payload: Record<string, unknown>): string {
  const candidates = [
    payload?.["customer_details"] &&
      (payload["customer_details"] as Record<string, unknown>)?.["email"],
    payload?.["customer_email"],
    payload?.["metadata"] &&
      (payload["metadata"] as Record<string, unknown>)?.["email"],
    payload?.["metadata"] &&
      (payload["metadata"] as Record<string, unknown>)?.["customer_email"],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function extractPriceIds(payload: Record<string, unknown>): string[] {
  const ids = new Set<string>();

  const metadata = payload["metadata"] as Record<string, unknown> | undefined;
  if (metadata) {
    const metaPrice =
      typeof metadata["price_id"] === "string" ? metadata["price_id"] : null;
    if (metaPrice && metaPrice.trim()) {
      ids.add(metaPrice.trim());
    }
  }

  const directPrice =
    payload["price"] &&
    typeof (payload["price"] as Record<string, unknown>)?.["id"] === "string"
      ? ((payload["price"] as Record<string, unknown>)["id"] as string)
      : null;
  if (directPrice && directPrice.trim()) {
    ids.add(directPrice.trim());
  }

  const plan =
    payload["plan"] && typeof (payload["plan"] as Record<string, unknown>)?.["id"] === "string"
      ? ((payload["plan"] as Record<string, unknown>)["id"] as string)
      : null;
  if (plan && plan.trim()) {
    ids.add(plan.trim());
  }

  const arrays = [
    payload["items"] && (payload["items"] as Record<string, unknown>)?.["data"],
    payload["line_items"] &&
      (payload["line_items"] as Record<string, unknown>)?.["data"],
    payload["lines"] && (payload["lines"] as Record<string, unknown>)?.["data"],
  ];

  for (const maybeArray of arrays) {
    if (!Array.isArray(maybeArray)) {
      continue;
    }
    for (const item of maybeArray) {
      if (
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>)["price"] &&
        typeof (item as Record<string, unknown>)["price"] === "object"
      ) {
        const price = (item as Record<string, unknown>)["price"] as Record<
          string,
          unknown
        >;
        const priceId =
          typeof price["id"] === "string" ? (price["id"] as string) : null;
        if (priceId && priceId.trim()) {
          ids.add(priceId.trim());
        }
      }
    }
  }

  return Array.from(ids);
}

function getPriceRoleMap(): Record<string, MemberRole> {
  if (cachedPriceRoleMap) {
    return cachedPriceRoleMap;
  }

  const map: Record<string, MemberRole> = {};

  const entries: Array<[MemberRole, string[]]> = [
    ["pro", ["STRIPE_PRICE_PRO", "STRIPE_PRICE_PRO_IDS"]],
    ["elite", ["STRIPE_PRICE_ELITE", "STRIPE_PRICE_ELITE_IDS"]],
  ];

  for (const [role, keys] of entries) {
    for (const key of keys) {
      const raw = process.env[key];
      if (!raw) {
        continue;
      }
      for (const value of raw.split(",").map((item) => item.trim())) {
        if (!value) {
          continue;
        }
        map[value] = role;
      }
    }
  }

  cachedPriceRoleMap = map;
  return map;
}

async function readStore(): Promise<MemberStore> {
  try {
    const raw = await fs.readFile(MEMBERS_PATH, "utf8");
    const parsed = JSON.parse(raw) as MemberStore;
    return parsed ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {};
    }
    log("warn", "membership store read failed", {
      error: describeError(error),
    });
    return {};
  }
}

async function writeStore(store: MemberStore): Promise<void> {
  const dir = path.dirname(MEMBERS_PATH);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = path.join(dir, `members-${Date.now()}.tmp`);
  const payload = JSON.stringify(store, null, 2);

  await fs.writeFile(tmpPath, payload, "utf8");
  await fs.rename(tmpPath, MEMBERS_PATH);
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unknown_error";
}
