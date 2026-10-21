import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address, WorkspaceContext } from "@shared/schema";
import { addressError, validCoordinates } from "@shared/locations";
import { apiRequest } from "@/lib/queryClient";
import AddressLocationFields, { createLocationDraft } from "./address-location-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";

const dialogClass = "phase2-form max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl";
function AddressForm({ address, onClose }: { address?: Address; onClose: (saved?: Address) => void }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [draft, setDraft] = useState(() => createLocationDraft(address));
  const [error, setError] = useState("");
  const [addressIssue, setAddressIssue] = useState(false);
  const [coordinateIssue, setCoordinateIssue] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(createLocationDraft(address));
  const save = useMutation({
    mutationFn: async (): Promise<Address> => (await apiRequest(address ? "PATCH" : "POST", address ? `/api/addresses/${address.id}` : "/api/addresses", draft)).json(),
    onSuccess: async saved => { await client.invalidateQueries(); onClose(saved); },
    onError: error => setError(/^403:/.test(error.message) ? "addressForm.denied" : "addressForm.saveError"),
    onSettled: () => { submitting.current = false; },
  });
  return <form ref={form} className="space-y-4 border rounded-xl p-4" noValidate aria-busy={save.isPending} onSubmit={event => {
    event.preventDefault();
    if (submitting.current || verifying) return;
    const invalidAddress = Boolean(addressError(draft.address)), invalidCoordinates = !validCoordinates(draft.latitude, draft.longitude);
    setAddressIssue(invalidAddress); setCoordinateIssue(invalidCoordinates);
    if (invalidAddress || invalidCoordinates) { queueMicrotask(() => form.current?.querySelector<HTMLElement>(invalidAddress ? "#address" : "#latitude")?.focus()); return; }
    setError(""); submitting.current = true; save.mutate();
  }}>
    <h3 className="font-semibold">{t(address ? "addressForm.edit" : "addressForm.add")}</h3>
    <p className="text-sm text-muted-foreground">{t("addressForm.steps")}</p>
    <fieldset disabled={save.isPending} className="min-w-0">
      <AddressLocationFields newService={draft} setNewService={setDraft} addressIssue={addressIssue ? t("addressForm.addressInvalid") : undefined}
        coordinateIssue={coordinateIssue ? t("addressForm.coordinateInvalid") : undefined} onBusyChange={setVerifying} />
    </fieldset>
    {address && <p className="text-sm text-muted-foreground">{t("addressForm.sharedWarning")}</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(error)}</p>}
    <div className="grid sm:grid-cols-2 gap-3"><Button type="submit" disabled={save.isPending || verifying}>{t(save.isPending ? "accountForm.saving" : "addressForm.save")}</Button>
      <Button ref={cancelTrigger} type="button" variant="outline" disabled={save.isPending} onClick={() => dirty ? setDiscarding(true) : onClose()}>{t("common.cancel")}</Button></div>
    <AlertDialog open={discarding} onOpenChange={setDiscarding}>
      <AlertDialogContent dir={i18n.dir()} className={dialogClass} onCloseAutoFocus={event => { event.preventDefault(); cancelTrigger.current?.focus(); }}>
        <AlertDialogHeader className="text-start sm:text-start"><AlertDialogTitle>{t("serviceForm.discardTitle")}</AlertDialogTitle><AlertDialogDescription>{t("addressForm.discardHelp")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0"><AlertDialogCancel>{t("serviceForm.keepEditing")}</AlertDialogCancel><AlertDialogAction onClick={() => onClose()}>{t("serviceForm.discard")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </form>;
}
export default function AccountAddresses() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const context = useQuery<WorkspaceContext>({ queryKey: ["/api/company/context"] });
  const allowed = Boolean(context.data?.permissions?.manageServices);
  const addresses = useQuery<Address[]>({ queryKey: ["/api/addresses"], enabled: allowed });
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (editing) return;
    if (savedId !== null) list.current?.querySelector<HTMLElement>(`[data-address-id="${savedId}"]`)?.focus();
    else (editTrigger.current?.isConnected ? editTrigger.current : addButton.current)?.focus();
  }, [editing, savedId]);
  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/addresses/${id}`),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["/api/addresses"] }); setRemoving(null); addButton.current?.focus(); },
  });
  const companyParts = context.data?.company ? t("addressForm.companyHelp", { name: "\uFFFC" }).split("\uFFFC") : null;
  const removeParts = t("addressForm.removeHelp", { address: "\uFFFC" }).split("\uFFFC");
  return <Card id="addresses" className="scroll-mt-6" aria-labelledby="account-addresses-title">
    <CardHeader><h2 className="text-lg font-semibold" id="account-addresses-title">{t("addressForm.title")}</h2><CardDescription>
      {companyParts ? companyParts.map((part, index) => <Fragment key={index}>{index > 0 && <bdi>{context.data?.company?.name}</bdi>}{part}</Fragment>) : t("addressForm.personalHelp")}
    </CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {context.isLoading ? <p role="status">{t("addressForm.workspaceLoading")}</p> : context.isError ? <p role="alert">{t("addressForm.workspaceError")}</p> : !allowed ? <p>{t("addressForm.denied")}</p> : <>
        {addresses.isLoading && <p role="status">{t("serviceForm.addressesLoading")}</p>}
        {addresses.isError && <p role="alert">{t("addressForm.loadError")} <button type="button" className="underline min-h-11 py-2" onClick={() => void addresses.refetch()}>{t("publicSearch.retry")}</button></p>}
        {addresses.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("addressForm.empty")}</p>}
        {savedId !== null && !editing && <p role="status">{t("addressForm.saved")}</p>}
        <ul ref={list} className="space-y-3">{addresses.data?.map(address => <li key={address.id} tabIndex={-1} data-address-id={address.id} className="border rounded-lg p-4 space-y-3 focus:outline focus:outline-2 focus:outline-offset-2">
          <p className="break-words"><bdi>{address.address || t("serviceForm.addressNeedsUpdate")}</bdi></p>
          {address.locationSource === "google" && !validCoordinates(address.latitude, address.longitude) && <p className="text-sm text-muted-foreground">{t("addressForm.expired")}</p>}
          <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={editing !== null || remove.isPending} onClick={event => { editTrigger.current = event.currentTarget; remove.reset(); setSavedId(null); setEditing(address); }}>{t("common.edit")}</Button>
            <Button type="button" variant="outline" disabled={editing !== null || remove.isPending} onClick={event => { editTrigger.current = event.currentTarget; remove.reset(); setRemoving(address); }}>{t("storefront.remove")}</Button></div>
        </li>)}</ul>
        {editing ? <AddressForm key={editing === "new" ? "new" : editing.id} address={editing === "new" ? undefined : editing} onClose={saved => { setSavedId(saved?.id ?? null); setEditing(null); }} />
          : <Button ref={addButton} type="button" disabled={remove.isPending} onClick={event => { editTrigger.current = event.currentTarget; remove.reset(); setSavedId(null); setEditing("new"); }}>{t("addressForm.add")}</Button>}
      </>}
      <AlertDialog open={Boolean(removing)} onOpenChange={open => { if (!open && !remove.isPending) setRemoving(null); }}>
        <AlertDialogContent dir={i18n.dir()} className={dialogClass} onEscapeKeyDown={event => { if (remove.isPending) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); (editTrigger.current?.isConnected ? editTrigger.current : addButton.current)?.focus(); }}>
          <AlertDialogHeader className="text-start sm:text-start"><AlertDialogTitle>{t("addressForm.removeTitle")}</AlertDialogTitle><AlertDialogDescription>{removeParts.map((part, index) => <Fragment key={index}>{index > 0 && <bdi>{removing?.address}</bdi>}{part}</Fragment>)}</AlertDialogDescription></AlertDialogHeader>
          {remove.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t("addressForm.removeError")}</p>}
          <AlertDialogFooter className="gap-2 sm:space-x-0"><AlertDialogCancel disabled={remove.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <Button disabled={remove.isPending} onClick={() => { if (removing && !remove.isPending) remove.mutate(removing.id); }}>{t(remove.isPending ? "addressForm.removing" : "storefront.remove")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent>
  </Card>;
}
