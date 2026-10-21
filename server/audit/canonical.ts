import { createHash } from "node:crypto";

export const AUDIT_MAX_BYTES = 32 * 1024;
export const AUDIT_HASH_VERSION = "sha256-sorted-json-v1" as const;

export class AuditContractError extends Error {
  constructor() {
    // Never include Zod issues, offending field names or payload values.
    super("Invalid audit event contract");
    this.name = "AuditContractError";
  }
}

/**
 * Canonical format v1: plain JSON only; object keys sorted by JS UTF-16 order,
 * arrays retain order, primitives use JSON.stringify (including -0 as 0).
 * No Unicode normalization. Undefined, nonfinite numbers, custom prototypes,
 * accessors, sparse arrays, cycles and dangerous keys are rejected.
 * This is serialization, NOT redaction or event authorization.
 */
export function canonicalAuditJson(value: unknown): string {
  const ancestors = new Set<object>();
  let nodes = 0;
  let bytes = 0;
  const add = (part: string) => {
    bytes += Buffer.byteLength(part, "utf8");
    if (bytes > AUDIT_MAX_BYTES) throw new AuditContractError();
    return part;
  };
  const encode = (item: unknown, depth: number): string => {
    if (++nodes > 8192 || depth > 12) throw new AuditContractError();
    if (item === null) return add("null");
    if (typeof item === "string") {
      if (item.length > AUDIT_MAX_BYTES) throw new AuditContractError();
      return add(JSON.stringify(item));
    }
    if (typeof item === "boolean") return add(String(item));
    if (typeof item === "number" && Number.isFinite(item)) return add(JSON.stringify(item));
    if (typeof item !== "object" || !item || ancestors.has(item)) throw new AuditContractError();
    const array = Array.isArray(item);
    if (Object.getPrototypeOf(item) !== (array ? Array.prototype : Object.prototype)) throw new AuditContractError();
    const keys = Reflect.ownKeys(item);
    if (keys.length > 257 || keys.some(key => typeof key !== "string")) throw new AuditContractError();
    if (array && (item.length > 100 || keys.length !== item.length + 1)) throw new AuditContractError();
    ancestors.add(item);
    const values: string[] = [];
    const orderedKeys = array ? Array.from({ length: item.length }, (_, i) => String(i)) : (keys as string[]).sort();
    add(array ? "[" : "{");
    for (const key of orderedKeys) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new AuditContractError();
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new AuditContractError();
      if (values.length) add(",");
      const prefix = array ? "" : add(JSON.stringify(key) + ":");
      values.push(prefix + encode(descriptor.value, depth + 1));
    }
    ancestors.delete(item);
    return (array ? "[" : "{") + values.join(",") + add(array ? "]" : "}");
  };
  return encode(value, 0);
}

export function auditPayloadHash(canonicalJson: string): string {
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

export type DeepReadonly<T> = T extends readonly (infer V)[]
  ? readonly DeepReadonly<V>[] : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

export function freezeAuditJson<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeAuditJson(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}
