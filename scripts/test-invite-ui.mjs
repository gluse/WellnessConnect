import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { QueryClientProvider } from "@tanstack/react-query";

globalThis.React = React;
const destinations = [];
const token = "a".repeat(64);
globalThis.window = {
  location: { pathname: "/invite", search: `?token=${token}`, hash: "", assign: url => destinations.push(url) },
  history: { replaceState() {} }, addEventListener() {}, removeEventListener() {},
};
globalThis.document = { visibilityState: "visible" };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Invite } = await import("../client/src/pages/invite.tsx");
const { act, create } = renderer;
const invitation = { id: "11111111-1111-4111-8111-111111111111", companyName: "Test salon", role: "viewer" };
async function scenario(mode) {
  destinations.length = 0;
  queryClient.clear();
  queryClient.setQueryData(["/api/auth/user"], { id: "fixture-user", email: "fixture@example.com" });
  queryClient.setQueryData(["/api/company/invitation", token], invitation);
  queryClient.setQueryData(["/api/company/my-invitations"], [invitation]);
  // The page starts with stale password-setup data from a previous session.
  queryClient.setQueryData(["/api/auth/invite-status"], { needsPassword: true });
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || "GET" });
    if (url === "/api/auth/invite-status") return new Response(JSON.stringify(mode === "expired" ? { message: "Unauthorized" } : { needsPassword: mode === "password-expired" }), { status: mode === "expired" ? 401 : 200 });
    if (url === "/api/auth/invite-password") return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
    if (url === "/api/company/invitations/accept") return new Response(JSON.stringify({ success: true }));
    throw new Error(`Unexpected request: ${url}`);
  };
  let component;
  const { hook } = memoryLocation({ path: "/invite" });
  await act(async () => {
    component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook }, React.createElement(Invite))));
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  if (mode === "expired") {
    assert.equal(destinations.length, 1, "Recover automatically when the cached login has expired");
    assert.equal(queryClient.getQueryData(["/api/auth/user"]), null);
    assert.ok(!requests.some(request => request.url === "/api/auth/invite-password"));
  } else {
    if (mode === "password-expired") await act(async () => {
      component.root.findByProps({ id: "invited-password", type: "password" }).props.onChange({ target: { value: "Aa1!fixture-password" } });
    });
    const button = component.root.findAllByType("button").find(node => node.children.includes("Accept Invitation"));
    assert.equal(button.props.disabled, false);
    await act(async () => { button.props.onClick(); await new Promise(resolve => setTimeout(resolve, 20)); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    if (mode === "already-set") {
      assert.ok(!requests.some(request => request.url === "/api/auth/invite-password"), "Do not reset a password using a stale flag");
      assert.ok(requests.some(request => request.url === "/api/company/invitations/accept"));
      assert.equal(destinations[0], "/dashboard");
    } else {
      assert.ok(requests.some(request => request.url === "/api/auth/invite-password"));
      assert.ok(!requests.some(request => request.url === "/api/company/invitations/accept"));
      assert.equal(queryClient.getQueryData(["/api/auth/user"]), null);
    }
  }
  if (mode !== "already-set") {
    const redirect = new URL(destinations[0], "http://localhost");
    assert.equal(redirect.pathname, "/login");
    assert.equal(redirect.searchParams.get("returnTo"), `/invite?token=${token}`, "Preserve the invitation for login recovery");
  }
  await act(async () => component.unmount());
  queryClient.clear();
}
await scenario("expired");
await scenario("already-set");
await scenario("password-expired");
const { default: InvitationRecovery } = await import("../client/src/components/invitation-recovery.tsx");
let recovery;
const recoveryRequests = [];
globalThis.fetch = async (url, options) => {
  recoveryRequests.push({ url, body: JSON.parse(options.body) });
  return new Response(JSON.stringify({ message: "Open the newest email link in this browser." }));
};
await act(async () => { recovery = create(React.createElement(InvitationRecovery, { returnTo: `/invite?token=${token}` })); });
await act(async () => { recovery.root.findByProps({ id: "invitation-recovery-email", type: "email" }).props.onChange({ target: { value: "invited@example.com" } }); });
assert.equal(recovery.root.findAllByType("input").some(node => node.props.type === "password"), false, "First-time recovery must not require a password");
await act(async () => { await recovery.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
assert.equal(recoveryRequests[0].url, "/api/auth/invite-recovery");
assert.deepEqual(recoveryRequests[0].body, { email: "invited@example.com", returnTo: `/invite?token=${token}` });
assert.ok(recovery.root.findByProps({ role: "status" }).children.join("").includes("newest email"));
await act(async () => recovery.unmount());
console.log("Passed: expired invitation sessions, stale password flags, and 401 recovery with the invitation preserved.");
