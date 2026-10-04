const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const source = fs.readFileSync(require("node:path").join(__dirname, "../supabase/functions/asaas-manage-pending-subscription/index.ts"), "utf8").replace(/^import .*;\n/gm, "");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }, reportDiagnostics: true });
assert.equal(compiled.diagnostics.length, 0);

async function scenario(mode, action = "ads_invoices") {
  let handler;
  const calls = [];
  const writes = [];
  const rows = [
    { id: "t1", user_id: "owner", type: "purchase", credits: 10, status: mode === "local-paid" ? "paid" : "pending", asaas_payment_id: "pay_1" },
    { id: "t2", user_id: "other", type: "purchase", credits: 20, status: "pending", asaas_payment_id: "pay_other" },
    { id: "t3", user_id: "owner", type: "purchase", credits: 5, status: "pending", asaas_payment_id: mode === "recover" ? null : "pay_3", external_reference: "owned-reference" },
  ];
  let deleted = false;
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from(table) {
      assert.equal(table, "losi_ads_credit_transactions", "ADS must not depend on a business or pending subscription");
      const filters = [];
      let update;
      const result = () => {
        const matches = rows.filter(row => filters.every(([key, value]) => row[key] === value));
        if (update) {
          for (const row of matches) Object.assign(row, update);
          writes.push({ update, ids: matches.map(row => row.id) });
        }
        return { data: matches, error: null };
      };
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        is(key, value) { filters.push([key, value]); return query; },
        update(value) { update = value; return query; },
        async maybeSingle() { const res = result(); return { ...res, data: res.data[0] ?? null }; },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
      return query;
    },
  };
  const context = {
    Request, Response, URL, console: { log() {}, error() {} },
    createClient: () => admin,
    Deno: { env: { get: () => "mock-only" }, serve: fn => { handler = fn; } },
    fetch: async (url, options = {}) => {
      const method = options.method ?? "GET";
      calls.push({ url, method });
      assert(!url.includes("pay_other"), "Other user's payment must never reach Asaas");
      if (mode === "provider-error") return Response.json({ errors: [] }, { status: 503 });
      if (method === "DELETE") {
        if (mode === "delete-rejected") return Response.json({ errors: [{ description: "Recusado" }] }, { status: 400 });
        if (mode === "unconfirmed") return Response.json({ id: "pay_1" });
        deleted = true;
        return Response.json({ id: "pay_1", deleted: true });
      }
      if (deleted && mode === "verify-error") return Response.json({}, { status: 503 });
      if (deleted && mode === "verify-active") return Response.json({ id: "pay_1", status: "PENDING", deleted: false });
      if (deleted) return Response.json({ id: "pay_1", status: "PENDING", deleted: true });
      if (url.includes("externalReference=")) return Response.json({ data: [{ id: "pay_recovered", externalReference: "owned-reference", status: "PENDING", value: 25 }] });
      const id = url.split("/").pop();
      return Response.json({
        id, status: mode === "remote-paid" ? "RECEIVED" : id === "pay_3" ? "OVERDUE" : "PENDING",
        deleted: mode === "remote-deleted", value: 50, invoiceUrl: "https://example.invalid/invoice", dueDate: "2026-10-05",
      });
    },
  };
  vm.runInNewContext(compiled.outputText, context);
  const unauthorized = await handler(new Request("https://example.invalid", { method: "POST", body: "{}" }));
  assert.equal(unauthorized.status, 401);
  const response = await handler(new Request("https://example.invalid", {
    method: "POST", headers: { Authorization: "Bearer mock-only" },
    body: JSON.stringify({ action, paymentId: mode === "foreign" ? "pay_other" : "pay_1" }),
  }));
  const result = await response.json();
  return { response, result, calls, writes };
}

(async () => {
  for (const mode of ["pending", "recover"]) {
    const r = await scenario(mode);
    assert.equal(r.response.status, 200);
    assert.equal(r.result.invoices.length, 2);
    assert(r.result.invoices.every(invoice => invoice.type === "ads"));
    if (mode === "recover") assert(r.writes.some(write => write.update.asaas_payment_id === "pay_recovered"));
  }
  for (const mode of ["remote-paid", "remote-deleted"]) {
    const r = await scenario(mode);
    assert.equal(r.result.invoices.length, 0);
  }
  assert.equal((await scenario("provider-error")).response.status, 502);
  const success = await scenario("pending", "cancel_ads_invoice");
  assert.equal(success.result.cancelled, true);
  assert.deepEqual(success.calls.map(call => call.method), ["GET", "DELETE", "GET"]);
  assert.equal(success.writes[0].update.status, "cancelled");
  for (const mode of ["foreign", "local-paid", "remote-paid", "delete-rejected", "unconfirmed", "verify-error", "verify-active"]) {
    const r = await scenario(mode, "cancel_ads_invoice");
    assert(r.response.status >= 400, mode);
    assert.equal(r.writes.length, 0, mode + " must not update local status");
    if (["foreign", "local-paid", "remote-paid"].includes(mode)) assert(!r.calls.some(call => call.method === "DELETE"));
  }
  console.log("PASS: pending/overdue listing, customer-independent lookup, recovery, ownership, paid/deleted filtering, provider errors, confirmed cancellation and rejection paths (mocked Asaas).");
})().catch(error => { console.error(error); process.exit(1); });
