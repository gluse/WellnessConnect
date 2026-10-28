import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnv, type Plugin } from "vite";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

// These values are intentionally public. Never serialize the environment itself.
export function renderPrivacyPolicy(template: string, env: Record<string, string | undefined>) {
  const name = env.PRIVACY_POLICY_OPERATOR_NAME?.trim() || "";
  const address = env.PRIVACY_POLICY_OPERATOR_ADDRESS?.trim() || "";
  const email = env.PRIVACY_POLICY_EMAIL?.trim() || "";
  let origin = "";
  try {
    const url = new URL(env.PRIVACY_POLICY_PUBLIC_ORIGIN || "");
    if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) origin = url.origin;
  } catch { /* An unconfigured public origin keeps the page visibly in draft. */ }
  const validEmail = /^[^\s@<>"'?#&]+@[^\s@<>"'?#&]+\.[^\s@<>"'?#&]+$/.test(email);
  const ready = Boolean(name && address && validEmail && origin);
  const values: Record<string, string> = {
    STATUS: ready ? "" : '<aside class="draft" role="note"><strong>Draft — configuration incomplete.</strong> The operator must set the privacy policy details before this page is used as a public policy or submitted to Meta.</aside>',
    ROBOTS: ready ? "index, follow" : "noindex, nofollow",
    CANONICAL: origin ? `<link rel="canonical" href="${escapeHtml(origin)}/privacy-policy.html">` : "",
    OPERATOR: escapeHtml(name || "Operator details pending"),
    ADDRESS: escapeHtml(address || "Postal address pending"),
    CONTACT: validEmail ? `<a href="mailto:${escapeHtml(encodeURIComponent(email).replace(/%40/g, "@"))}">${escapeHtml(email)}</a>` : "Privacy contact email pending",
    HOME: escapeHtml(origin || "/"),
    RETENTION: escapeHtml(env.PRIVACY_POLICY_RETENTION?.trim() || "Account information is retained while needed to provide your account. Booking and transaction records may be retained to meet legal obligations and resolve disputes. Security records are retained as needed to investigate abuse and protect the service. When information is no longer needed for these purposes, it should be deleted or anonymised. Contact us for the retention period applicable to your information."),
    TRANSFERS: escapeHtml(env.PRIVACY_POLICY_INTERNATIONAL_TRANSFERS?.trim() || "Our service providers may process information in countries outside your country of residence, including outside the European Economic Area. Contact us for the processing locations and transfer safeguards applicable to your information, and to request a copy of the relevant safeguards."),
  };
  // A single pass prevents configuration text from being interpreted as template tokens.
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (token, key: string) => values[key] ?? token);
}

export function privacyPolicyPlugin(): Plugin {
  let root: string;
  let publicDetails: Record<string, string | undefined>;
  const render = () => renderPrivacyPolicy(readFileSync(path.join(root, "client/privacy-policy.template.html"), "utf8"), publicDetails);
  return {
    name: "fitsmytime-privacy-policy",
    configResolved(config) {
      root = path.resolve(config.root, "..");
      const loaded = loadEnv(config.mode, root, "PRIVACY_POLICY_");
      publicDetails = Object.fromEntries([
        "OPERATOR_NAME", "OPERATOR_ADDRESS", "EMAIL", "PUBLIC_ORIGIN", "RETENTION", "INTERNATIONAL_TRANSFERS",
      ].map(key => { const name = `PRIVACY_POLICY_${key}`; return [name, process.env[name] ?? loaded[name]]; }));
    },
    configureServer(server) {
      // Serve a complete document even with Vite's custom Express integration.
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/privacy-policy.html" || !["GET", "HEAD"].includes(request.method || "")) return next();
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(request.method === "HEAD" ? undefined : render());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "privacy-policy.html", source: render() });
    },
  };
}
