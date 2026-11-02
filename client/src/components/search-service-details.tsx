import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ServiceRating from "@/components/service-rating";
import { serviceAmount } from "@/components/forms-locale";
import { getProviderName } from "@shared/provider";
import type { ServiceWithProvider } from "@shared/schema";

export default function SearchServiceDetails({ service, open, onClose, onBook, onViewProvider }: {
  service: ServiceWithProvider; open: boolean; onClose: () => void; onBook: () => void; onViewProvider?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const provider = getProviderName(service.provider);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="search-design search-detail-dialog" closeLabel={t("searchPage.close")} data-testid="dialog-service-details">
      <DialogHeader><DialogTitle data-testid="text-service-name"><bdi>{service.name}</bdi></DialogTitle><DialogDescription>{t("searchPage.checkTimes")}</DialogDescription></DialogHeader>
      <div className="search-detail-provider">{service.storefrontSlug ? <Link href={`/providers/${service.storefrontSlug}`} onClick={onClose}><bdi>{provider}</bdi></Link> : onViewProvider ? <button type="button" onClick={onViewProvider} data-testid="button-provider-details"><bdi>{provider}</bdi></button> : <bdi>{provider}</bdi>}<ServiceRating service={service} /></div>
      {service.imageUrl && <img src={service.imageUrl} alt="" className="search-detail-image" />}
      {service.description && <section><h3>{t("searchPage.about")}</h3><p data-testid="text-description">{service.description}</p></section>}
      <dl className="search-detail-grid">
        <div><dt>{t("searchPage.price")}</dt><dd>{serviceAmount(Number(service.price), i18n.resolvedLanguage || i18n.language)} {service.serviceType === "group" && t("searchPage.perPerson")}</dd></div>
        <div><dt>{t("searchPage.duration")}</dt><dd>{t("searchPage.durationValue", { duration: service.duration })}</dd></div>
        <div><dt>{t("searchPage.sessionType")}</dt><dd>{t(service.serviceType === "group" ? "searchPage.group" : "searchPage.individual")}</dd></div>
        {service.serviceType === "group" && <div>
          <dt>{t("searchPage.maxGroupCapacity")}</dt>
          <dd data-testid="text-max-group-capacity">{new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language).format(service.maxCapacity ?? 1)}</dd>
        </div>}
        <div><dt>{t("searchPage.bookingType")}</dt><dd>{t(service.instantBooking ? "searchPage.instant" : "searchPage.approval")}</dd></div>
      </dl>
      <section><h3>{t("searchPage.audience")}</h3><p>{service.ageGroups?.length ? service.ageGroups.map(age => t(`searchPage.${age}`, { defaultValue: age })).join(", ") : t("searchPage.allAges")}</p><p>{t(service.targetGender === "males" ? "searchPage.gender_male" : service.targetGender === "females" ? "searchPage.gender_female" : "searchPage.gender_both")}</p></section>
      {service.employee?.name && <p>{t("searchPage.withEmployee", { name: service.employee.name })}</p>}
      {!service.instantBooking && Number(service.advancePaymentPercent) > 0 && <p>{t("searchPage.advancePayment", { percent: service.advancePaymentPercent })}</p>}
      {service.address && <section><h3>{t("searchPage.where")}</h3><p><bdi>{service.address}</bdi></p></section>}
      <div className="search-detail-actions"><Button onClick={onBook} data-testid="button-book-from-details">{t("searchPage.chooseTime")}</Button><Button variant="outline" onClick={onClose} data-testid="button-close-details">{t("searchPage.close")}</Button></div>
    </DialogContent>
  </Dialog>;
}
