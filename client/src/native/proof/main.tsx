import React from "react";
import { createRoot } from "react-dom/client";
import { nativeProofBridge } from "../bridge";
import { NativeProofClient } from "../client";
import { NativeProof } from "./NativeProof";
import "./proof.css";
let client: NativeProofClient | null = null;
try { client = new NativeProofClient(nativeProofBridge()); } catch { /* An ordinary browser must not pretend to hold native credentials. */ }
createRoot(document.getElementById("root")!).render(<React.StrictMode><NativeProof client={client} /></React.StrictMode>);
