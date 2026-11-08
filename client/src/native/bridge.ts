import { registerPlugin, Capacitor } from "@capacitor/core";
import type { NativeProofBridge } from "../../../shared/native-proof";

/** No web fallback: a JavaScript credential store must not impersonate native custody. */
export function nativeProofBridge(): NativeProofBridge {
  if (!Capacitor.isNativePlatform()) throw new Error("native_bridge_unavailable");
  return registerPlugin<NativeProofBridge>("NativeProofSession");
}
