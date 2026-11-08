import express, { type ErrorRequestHandler, type Request } from "express";
import { NATIVE_PROOF_API_ORIGIN, NATIVE_PROOF_PATHS } from "../../shared/native-proof";
import { createNativeAuthProofService, NativeProofError, type NativeAuthProofService } from "./service";

/** Isolated fixture application; no listen(), existing app integration or provider route. */
export function createNativeAuthProofApp(service: NativeAuthProofService = createNativeAuthProofService()) {
  const app = express();
  app.disable("x-powered-by"); app.enable("strict routing"); app.enable("case sensitive routing");
  app.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", Pragma: "no-cache", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
    // Native requests do not need cross-origin browser exemptions. An Origin is
    // never authentication; the verifier/session credential still proves access.
    if (req.get("Sec-Fetch-Site") === "cross-site" || req.get("Origin") && req.get("Origin") !== NATIVE_PROOF_API_ORIGIN) {
      return next(new NativeProofError("invalid_request"));
    }
    if (req.method !== "GET" && !req.is("application/json")) return next(new NativeProofError("invalid_request"));
    next();
  });
  app.use(express.json({ limit: "4kb", strict: true }));
  function noQuery(req: Request) { if (Object.keys(req.query).length) throw new NativeProofError("invalid_request"); }
  function bearer(req: Request) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.get("Authorization") ?? "");
    if (!match) throw new NativeProofError("unauthenticated");
    return match[1];
  }
  app.post(NATIVE_PROOF_PATHS.attempts, (req, res) => { noQuery(req); res.status(201).json(service.begin(req.body)); });
  app.get(NATIVE_PROOF_PATHS.browserStart, (req, res) => {
    if (Object.keys(req.query).length !== 1) throw new NativeProofError("invalid_request");
    res.json(service.browserAttempt(req.query.attemptId));
  });
  app.post(NATIVE_PROOF_PATHS.exchange, (req, res) => { noQuery(req); res.json(service.exchange(req.body)); });
  app.get(NATIVE_PROOF_PATHS.session, (req, res) => { noQuery(req); res.json(service.session(bearer(req))); });
  app.get(`${NATIVE_PROOF_PATHS.accountPrefix}:accountId`, (req, res) => { noQuery(req); res.json(service.account(bearer(req), req.params.accountId)); });
  app.post(NATIVE_PROOF_PATHS.logout, (req, res) => {
    noQuery(req);
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length) throw new NativeProofError("invalid_request");
    res.json(service.logout(bearer(req)));
  });
  app.use((_req, res) => { res.status(404).json({ error: { code: "not_found", message: "Proof endpoint not found." } }); });
  const failure: ErrorRequestHandler = (error, _req, res, _next) => {
    const known = error instanceof NativeProofError ? error : new NativeProofError(
      error?.type === "entity.parse.failed" || error?.type === "entity.too.large" ? "invalid_request" : "unavailable",
    );
    res.status(known.status).json({ error: { code: known.code, message: known.message } });
  };
  app.use(failure);
  return app;
}
