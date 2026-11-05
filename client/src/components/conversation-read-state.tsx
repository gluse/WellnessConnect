import { useEffect, useRef, useState, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { BookingMessage } from "@shared/appointment-collaboration";
import { useInboxScope } from "@/hooks/use-inbox";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

/** Acknowledge only incoming message elements actually exposed by the active dialog. */
export default function ConversationReadState({ bookingId, viewer, messages, container }: {
  bookingId: number; viewer: "customer" | "provider"; messages: BookingMessage[]; container: RefObject<HTMLDivElement>;
}) {
  const state = useInboxScope(viewer), client = useQueryClient(), { t } = useTranslation();
  const acknowledged = useRef(new Set<string>()), attempted = useRef(new Set<string>()), failed = useRef(new Set<string>());
  const alive = useRef(true), [hasFailure, setHasFailure] = useState(false);
  const ids = messages.filter(message => message.authorId !== state.userId).map(message => message.id).join(",");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function acknowledge(messageIds: string[]) {
    if (!state.ready || !messageIds.length) return;
    for (let index = 0; index < messageIds.length; index += 100) {
      const batch = messageIds.slice(index, index + 100);
      batch.forEach(id => { attempted.current.add(id); failed.current.delete(id); });
      try {
        await apiRequest("POST", `/api/inbox/messages/${bookingId}/read?${state.query}`, { messageIds: batch });
        batch.forEach(id => acknowledged.current.add(id));
        if (alive.current) await client.invalidateQueries({ queryKey: ["inbox"] });
      } catch {
        batch.forEach(id => failed.current.add(id));
      }
    }
    if (alive.current) setHasFailure(failed.current.size > 0);
  }
  useEffect(() => {
    if (!state.ready || !container.current || !ids) return;
    const root = container.current, incoming = new Set(ids.split(","));
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    const collect = () => {
      if (document.visibilityState === "hidden" || scheduled) return;
      scheduled = setTimeout(() => {
        scheduled = undefined;
        if (!root.isConnected || document.visibilityState === "hidden") return;
        const bounds = root.getBoundingClientRect();
        const exposed = Array.from(root.querySelectorAll<HTMLElement>("[data-conversation-message]")).filter(element => {
          const id = element.dataset.conversationMessage!, rect = element.getBoundingClientRect();
          return incoming.has(id) && !attempted.current.has(id) && rect.bottom > Math.max(0, bounds.top) + 8 && rect.top < Math.min(innerHeight, bounds.bottom) - 8;
        }).map(element => element.dataset.conversationMessage!);
        void acknowledge(exposed);
      }, 75);
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(collect, { root, threshold: [0, .1, .5, 1] });
    root.querySelectorAll("[data-conversation-message]").forEach(element => observer?.observe(element));
    root.addEventListener("scroll", collect, { passive: true });
    document.addEventListener("scroll", collect, { capture: true, passive: true });
    window.addEventListener("resize", collect); document.addEventListener("visibilitychange", collect); collect();
    return () => { observer?.disconnect(); root.removeEventListener("scroll", collect); document.removeEventListener("scroll", collect, true); window.removeEventListener("resize", collect); document.removeEventListener("visibilitychange", collect); if (scheduled) clearTimeout(scheduled); };
  }, [bookingId, state.ready, state.query, ids]);
  if (!hasFailure) return null;
  return <div role="alert" className="space-y-2"><p>{t("inbox.readFailed")}</p><Button type="button" variant="outline" onClick={() => void acknowledge(Array.from(failed.current).filter(id => !acknowledged.current.has(id)))}>{t("inbox.retry")}</Button></div>;
}
