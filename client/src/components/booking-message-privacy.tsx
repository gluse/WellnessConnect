import { useTranslation } from "react-i18next";

/** Keep privacy details available without displacing the conversation or draft. */
export default function BookingMessagePrivacy() {
  const { t } = useTranslation();
  return <details className="text-sm text-foreground" data-booking-message-privacy>
    <summary className="min-h-6 cursor-pointer rounded-sm py-1 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      {t("appointmentCollaboration.privacyDetails")}
    </summary>
    <div className="space-y-2 pt-2">
      <p>{t("appointmentCollaboration.privacy")}</p>
      <p>{t("appointmentCollaboration.retentionNotice")}</p>
      <a href="/privacy-policy.html#booking-messages" target="_blank" rel="noopener noreferrer" tabIndex={0} className="inline-block min-h-6 rounded-sm py-1 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {t("legal.privacyPolicyNewTab")}
      </a>
    </div>
  </details>;
}
