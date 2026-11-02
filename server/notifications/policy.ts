import type { CommunicationMethod, ManualNotificationPreview } from "../../shared/notifications";

export type Preferences = { phone: string | null; phoneVerifiedAt: Date | null; preferredMethod: CommunicationMethod | null; language: string; smsOptIn: boolean; whatsappOptIn: boolean; emailSuppressed?: boolean };
export const defaultPreferences: Preferences = { phone: null, phoneVerifiedAt: null, preferredMethod: null, language: "en", smsOptIn: false, whatsappOptIn: false };
export function channelReason(channel: CommunicationMethod, prefs: Preferences, email: string | null): string | null {
  if (channel === "email") return prefs.emailSuppressed ? "email_suppressed" : email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : "missing_email";
  if (!prefs.phone) return "missing_phone";
  if (!prefs.phoneVerifiedAt) return "unverified_phone";
  return (channel === "sms" ? prefs.smsOptIn : prefs.whatsappOptIn) ? null : "missing_permission";
}
export function statusAction(previous: string | null, next: string | null): "accepted" | "rejected" | null {
  return previous === "pending" && next === "confirmed" ? "accepted" : previous === "pending" && next === "cancelled" ? "rejected" : null;
}
export function reminderDue(appointment: Date, hours: number, now: Date) {
  const due = new Date(appointment.getTime() - hours * 3_600_000);
  return due.getTime() > now.getTime() ? due : null;
}
const copy: Record<string, { subject: string; accepted: string; rejected: string; rescheduled: string; reminder: string; from: string }> = {
  en: { subject: "Appointment update", accepted: "Your requested service {service} on {date} has been accepted.", rejected: "Your requested service {service} on {date} has been rejected.", rescheduled: "Your requested service {service} has been rescheduled from {old} to {date}.", reminder: "Reminder: your appointment for {service} is on {date}.", from: "FitsMyTime" },
  lv: { subject: "Pieraksta izmaiņas", accepted: "Jūsu pieprasītais pakalpojums {service} {date} ir apstiprināts.", rejected: "Jūsu pieprasītais pakalpojums {service} {date} ir noraidīts.", rescheduled: "Jūsu pieprasītais pakalpojums {service} ir pārcelts no {old} uz {date}.", reminder: "Atgādinājums: Jūsu pieraksts pakalpojumam {service} ir {date}.", from: "FitsMyTime" },
  ru: { subject: "Изменение записи", accepted: "Ваш запрос на услугу {service} на {date} принят.", rejected: "Ваш запрос на услугу {service} на {date} отклонён.", rescheduled: "Ваша запись на услугу {service} перенесена с {old} на {date}.", reminder: "Напоминание: ваша запись на услугу {service} состоится {date}.", from: "FitsMyTime" },
  ar: { subject: "تحديث الموعد", accepted: "تم قبول طلب الخدمة {service} في {date}.", rejected: "تم رفض طلب الخدمة {service} في {date}.", rescheduled: "تم تغيير موعد الخدمة {service} من {old} إلى {date}.", reminder: "تذكير: موعد الخدمة {service} في {date}.", from: "FitsMyTime" },
  zh: { subject: "预约更新", accepted: "您申请的服务 {service}（{date}）已被接受。", rejected: "您申请的服务 {service}（{date}）已被拒绝。", rescheduled: "您的服务 {service} 已从 {old} 改期至 {date}。", reminder: "提醒：您预约的服务 {service} 将于 {date} 开始。", from: "FitsMyTime" },
  fr: { subject: "Mise à jour du rendez-vous", accepted: "Votre demande de service {service} le {date} a été acceptée.", rejected: "Votre demande de service {service} le {date} a été refusée.", rescheduled: "Votre service {service} a été reprogrammé du {old} au {date}.", reminder: "Rappel : votre rendez-vous pour {service} est le {date}.", from: "FitsMyTime" },
  de: { subject: "Terminaktualisierung", accepted: "Ihre angefragte Leistung {service} am {date} wurde angenommen.", rejected: "Ihre angefragte Leistung {service} am {date} wurde abgelehnt.", rescheduled: "Ihr Termin für {service} wurde vom {old} auf den {date} verschoben.", reminder: "Erinnerung: Ihr Termin für {service} ist am {date}.", from: "FitsMyTime" },
  hi: { subject: "अपॉइंटमेंट अपडेट", accepted: "{date} को आपकी अनुरोधित सेवा {service} स्वीकार कर ली गई है।", rejected: "{date} को आपकी अनुरोधित सेवा {service} अस्वीकार कर दी गई है।", rescheduled: "आपकी सेवा {service} का समय {old} से {date} कर दिया गया है।", reminder: "रिमाइंडर: सेवा {service} के लिए आपका अपॉइंटमेंट {date} को है।", from: "FitsMyTime" },
  ja: { subject: "予約の更新", accepted: "ご依頼のサービス {service}（{date}）が承認されました。", rejected: "ご依頼のサービス {service}（{date}）は却下されました。", rescheduled: "サービス {service} の予約が {old} から {date} に変更されました。", reminder: "リマインダー：サービス {service} のご予約は {date} です。", from: "FitsMyTime" },
  pt: { subject: "Atualização do agendamento", accepted: "O serviço solicitado {service} em {date} foi aceite.", rejected: "O serviço solicitado {service} em {date} foi recusado.", rescheduled: "O serviço {service} foi reagendado de {old} para {date}.", reminder: "Lembrete: o seu agendamento para {service} é em {date}.", from: "FitsMyTime" },
  es: { subject: "Actualización de la cita", accepted: "Su solicitud del servicio {service} el {date} ha sido aceptada.", rejected: "Su solicitud del servicio {service} el {date} ha sido rechazada.", rescheduled: "Su servicio {service} se ha reprogramado del {old} al {date}.", reminder: "Recordatorio: su cita para {service} es el {date}.", from: "FitsMyTime" },
};
export function renderMessage(input: { kind: "accepted" | "rejected" | "rescheduled" | "reminder"; service: string; date: Date; oldDate?: Date | null; language: string; timeZone: string }) {
  const language = copy[input.language] ? input.language : "en", words = copy[language];
  const format = (value: Date) => `${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: input.timeZone }).format(value)} (${input.timeZone})`;
  const replacements = { service: input.service.slice(0, 250), date: format(input.date), old: input.oldDate ? format(input.oldDate) : "" };
  const text = words[input.kind].replace(/\{(service|date|old)\}/g, (_match, key: keyof typeof replacements) => replacements[key]);
  return { subject: words.subject, message: `${text}\n${words.from}`, date: format(input.date), oldDate: input.oldDate ? format(input.oldDate) : "" };
}
export function manualPreview(input: { customerName: string; subject: string; message: string; preferences: Preferences; email: string | null }): ManualNotificationPreview {
  const channels = {} as ManualNotificationPreview["channels"];
  for (const channel of ["email", "sms", "whatsapp"] as const) {
    const reasonCode = channelReason(channel, input.preferences, input.email);
    const href = reasonCode ? null : channel === "email" ? `mailto:${encodeURIComponent(input.email!)}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.message)}`
      : channel === "sms" ? `sms:${input.preferences.phone}?body=${encodeURIComponent(input.message)}` : `https://wa.me/${input.preferences.phone!.slice(1)}?text=${encodeURIComponent(input.message)}`;
    channels[channel] = { href, reasonCode };
  }
  return { customerName: input.customerName, subject: input.subject, message: input.message, channels };
}
export function deliveryTransition(current: string, next: "accepted" | "delivered" | "failed") {
  if (current === "delivered" || current === "cancelled" || current === "skipped") return current;
  if (next === "delivered") return "delivered";
  if (current === "failed" && next === "accepted") return current;
  return next;
}
