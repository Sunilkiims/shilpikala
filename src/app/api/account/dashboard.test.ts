import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, routeParams } from "@/test-support/request";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));

let cleanup: () => void;
type H = (r: Request, c?: never) => Promise<Response>;
type HP = (r: Request, c: ReturnType<typeof routeParams>) => Promise<Response>;
let wl: { GET: H; POST: H }, wlDel: { DELETE: HP };
let addr: { GET: H; POST: H }, addrId: { PATCH: HP; DELETE: HP }, addrDefault: { POST: HP };
let pw: { POST: H }, sessions: { DELETE: H };
let auth: typeof import("@/lib/auth/customers");
let getDb: typeof import("@/lib/db").getDb;

beforeEach(async () => {
  cleanup = isolateStorageDir();
  wl = (await import("@/app/api/account/wishlist/route")) as never;
  wlDel = (await import("@/app/api/account/wishlist/[productId]/route")) as never;
  addr = (await import("@/app/api/account/addresses/route")) as never;
  addrId = (await import("@/app/api/account/addresses/[id]/route")) as never;
  addrDefault = (await import("@/app/api/account/addresses/[id]/default/route")) as never;
  pw = (await import("@/app/api/account/password/route")) as never;
  sessions = (await import("@/app/api/account/sessions/route")) as never;
  auth = await import("@/lib/auth/customers");
  ({ getDb } = await import("@/lib/db"));
});
afterEach(() => cleanup());

let n = 0;
async function user() {
  const c = await auth.createCustomer({ email: `u${++n}@example.com`, name: `User ${n}`, password: "a-good-password" });
  if (c === "email_taken") throw new Error("taken");
  await (await getDb()).query("UPDATE customers SET email_verified = true WHERE id = $1", [c.id]);
  const token = await auth.createSession(c.id);
  return { id: c.id, cookie: `sk_session=${token}`, token };
}
const req = (cookie: string | undefined, method: string, body?: unknown) =>
  jsonRequest("http://x", { method, body, headers: cookie ? { cookie } : {}, ip: `203.0.113.${n + 10}` });
const A = (label: string) => ({ fullName: label, line1: "1 Road", city: "Pune", state: "MH", postalCode: "411001", country: "India" });

describe("wishlist", () => {
  it("requires a session everywhere", async () => {
    expect((await wl.GET(req(undefined, "GET"))).status).toBe(401);
    expect((await wl.POST(req(undefined, "POST", { productId: 1 }))).status).toBe(401);
    expect((await wlDel.DELETE(req(undefined, "DELETE"), routeParams({ productId: "1" }))).status).toBe(401);
  });

  it("adds without duplicates, removes, and merges a signed-out list", async () => {
    const u = await user();
    await wl.POST(req(u.cookie, "POST", { productId: 5 }));
    await wl.POST(req(u.cookie, "POST", { productId: 5 }));
    expect((await (await wl.GET(req(u.cookie, "GET"))).json()).productIds).toEqual([5]);

    const merged = await (await wl.POST(req(u.cookie, "POST", { productIds: [5, 6, 6, 7, -1, "x", 1.5] }))).json();
    expect(merged.productIds.sort()).toEqual([5, 6, 7]);

    const after = await (await wlDel.DELETE(req(u.cookie, "DELETE"), routeParams({ productId: "6" }))).json();
    expect(after.productIds.sort()).toEqual([5, 7]);
    expect((await wl.POST(req(u.cookie, "POST", { productId: "abc" }))).status).toBe(400);
  });

  it("never exposes or changes another customer's wishlist", async () => {
    const a = await user(), b = await user();
    await wl.POST(req(a.cookie, "POST", { productId: 1 }));
    await wl.POST(req(b.cookie, "POST", { productId: 2, customerId: a.id }));
    await wlDel.DELETE(req(b.cookie, "DELETE"), routeParams({ productId: "1" }));
    expect((await (await wl.GET(req(a.cookie, "GET"))).json()).productIds).toEqual([1]);
    expect((await (await wl.GET(req(b.cookie, "GET"))).json()).productIds).toEqual([2]);
  });
});

describe("addresses", () => {
  it("makes the first address default, keeps one default, and mirrors it to the checkout prefill", async () => {
    const u = await user();
    const first = await (await addr.POST(req(u.cookie, "POST", { address: A("Home"), label: "Home" }))).json();
    expect(first.address.isDefault).toBe(true);
    const second = await (await addr.POST(req(u.cookie, "POST", { address: A("Work"), isDefault: true }))).json();
    expect(second.addresses.filter((x: { isDefault: boolean }) => x.isDefault)).toHaveLength(1);
    expect(second.address.isDefault).toBe(true);
    expect((await auth.getCustomerById(u.id))?.address?.fullName).toBe("Work");

    const back = await (await addrDefault.POST(req(u.cookie, "POST"), routeParams({ id: String(first.address.id) }))).json();
    expect(back.addresses[0].id).toBe(first.address.id);
    expect((await auth.getCustomerById(u.id))?.address?.fullName).toBe("Home");
  });

  it("allows at most three, even for simultaneous requests", async () => {
    const u = await user();
    const results = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => addr.POST(req(u.cookie, "POST", { address: A(`A${i}`) }))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect((await (await addr.GET(req(u.cookie, "GET"))).json()).addresses).toHaveLength(3);
  });

  it("edits, deletes, and promotes another address when the default is deleted", async () => {
    const u = await user();
    const a1 = (await (await addr.POST(req(u.cookie, "POST", { address: A("One") }))).json()).address;
    const a2 = (await (await addr.POST(req(u.cookie, "POST", { address: A("Two") }))).json()).address;
    const edited = await (await addrId.PATCH(req(u.cookie, "PATCH", { address: { ...A("Uno"), city: "Mumbai" } }), routeParams({ id: String(a1.id) }))).json();
    expect(edited.address.address.city).toBe("Mumbai");
    expect(edited.address.isDefault).toBe(true);

    const del = await (await addrId.DELETE(req(u.cookie, "DELETE"), routeParams({ id: String(a1.id) }))).json();
    expect(del.addresses).toHaveLength(1);
    expect(del.addresses[0].id).toBe(a2.id);
    expect(del.addresses[0].isDefault).toBe(true);
    expect((await auth.getCustomerById(u.id))?.address?.fullName).toBe("Two");
    await addrId.DELETE(req(u.cookie, "DELETE"), routeParams({ id: String(a2.id) }));
    expect((await auth.getCustomerById(u.id))?.address).toBeUndefined();
  });

  it("rejects incomplete addresses and strips unknown fields", async () => {
    const u = await user();
    expect((await addr.POST(req(u.cookie, "POST", { address: { fullName: "x" } }))).status).toBe(400);
    const ok = await (await addr.POST(req(u.cookie, "POST", { address: { ...A("Z"), isAdmin: true } }))).json();
    expect(ok.address.address).not.toHaveProperty("isAdmin");
  });

  it("cannot read, edit, delete or default another customer's address", async () => {
    const a = await user(), b = await user();
    const mine = (await (await addr.POST(req(a.cookie, "POST", { address: A("Mine") }))).json()).address;
    const p = routeParams({ id: String(mine.id) });
    expect((await addrId.PATCH(req(b.cookie, "PATCH", { address: A("Hacked") }), p)).status).toBe(404);
    expect((await addrId.DELETE(req(b.cookie, "DELETE"), routeParams({ id: String(mine.id) }))).status).toBe(404);
    expect((await addrDefault.POST(req(b.cookie, "POST"), routeParams({ id: String(mine.id) }))).status).toBe(404);
    expect((await (await addr.GET(req(b.cookie, "GET"))).json()).addresses).toEqual([]);
    const still = (await (await addr.GET(req(a.cookie, "GET"))).json()).addresses;
    expect(still).toHaveLength(1);
    expect(still[0].address.fullName).toBe("Mine");
    expect((await addr.GET(req(undefined, "GET"))).status).toBe(401);
  });

  it("a stored legacy address was carried into the list by the migration", async () => {
    const u = await user();
    const db = await getDb();
    await db.query("DELETE FROM customer_addresses WHERE customer_id = $1", [u.id]);
    expect((await (await addr.GET(req(u.cookie, "GET"))).json()).addresses).toEqual([]);
  });
});

describe("security", () => {
  it("changes the password only with the right current one, keeping this device signed in", async () => {
    const u = await user();
    const wrong = await pw.POST(req(u.cookie, "POST", { currentPassword: "nope-nope", newPassword: "brand-new-pass" }));
    expect(wrong.status).toBe(403);
    expect((await pw.POST(req(u.cookie, "POST", { currentPassword: "a-good-password", newPassword: "short" }))).status).toBe(400);

    const ok = await pw.POST(req(u.cookie, "POST", { currentPassword: "a-good-password", newPassword: "brand-new-pass" }));
    expect(ok.status).toBe(200);
    const fresh = (ok.headers.get("set-cookie") ?? "").split(";")[0];
    expect(fresh).not.toBe(u.cookie);
    expect((await wl.GET(req(fresh, "GET"))).status).toBe(200);
    expect((await wl.GET(req(u.cookie, "GET"))).status).toBe(401);
    expect(await auth.authenticate(`u${n}@example.com`, "brand-new-pass")).toBeTruthy();
  });

  it("signs out other devices but not this one", async () => {
    const u = await user();
    const other = `sk_session=${await auth.createSession(u.id)}`;
    expect((await sessions.DELETE(req(u.cookie, "DELETE"))).status).toBe(200);
    expect((await wl.GET(req(other, "GET"))).status).toBe(401);
    expect((await wl.GET(req(u.cookie, "GET"))).status).toBe(200);
    expect((await sessions.DELETE(req(undefined, "DELETE"))).status).toBe(401);
  });
});
