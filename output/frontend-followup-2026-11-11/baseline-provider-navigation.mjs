var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/locations.ts
function normalizeAddress(address) {
  return address.normalize("NFKC").trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").toLocaleLowerCase("en");
}
function addressError(input2) {
  if (typeof input2 !== "string" || input2.trim().length < 5 || input2.length > 500 || !new RegExp("\\p{L}", "u").test(input2) || /[\x00-\x1f\x7f]|https?:\/\/|www\.|@/i.test(input2)) {
    return "Enter a street or venue address, town and country (5\u2013500 characters).";
  }
}
function validCoordinates(latitude, longitude) {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}
function currentLocation(location2, now = Date.now()) {
  if (location2.locationSource === "google" && (!location2.locationExpiresAt || !(new Date(location2.locationExpiresAt).getTime() > now))) {
    if (location2.latitude == null && location2.longitude == null && location2.distance === void 0 && (location2.locationAddressSource !== "google" || location2.address == null)) return location2;
    return {
      ...location2,
      latitude: null,
      longitude: null,
      ..."distance" in location2 ? { distance: void 0 } : {},
      ...location2.locationAddressSource === "google" ? { address: null } : {}
    };
  }
  return location2;
}
var init_locations = __esm({
  "shared/locations.ts"() {
    "use strict";
  }
});

// client/src/lib/location-expiry.ts
function expireData(value, now) {
  if (Array.isArray(value)) {
    const updated2 = value.map((item) => expireData(item, now));
    return updated2.some((item, index) => item !== value[index]) ? updated2 : value;
  }
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const original = value;
  let updated = original;
  if (original.locationSource === "google" && "latitude" in original && "longitude" in original) {
    updated = currentLocation(original, now);
  }
  for (const [key, child] of Object.entries(updated)) {
    const expired = expireData(child, now);
    if (expired !== child) {
      if (updated === original) updated = { ...original };
      updated[key] = expired;
    }
  }
  return updated;
}
function expireCachedLocations(client, now = Date.now()) {
  for (const query of client.getQueryCache().getAll()) {
    const data = query.state.data;
    const expired = expireData(data, now);
    if (expired !== data) client.setQueryData(query.queryKey, expired);
  }
}
function startLocationExpiry(client) {
  const timer = setInterval(() => expireCachedLocations(client), 6e4);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
  return () => clearInterval(timer);
}
var init_location_expiry = __esm({
  "client/src/lib/location-expiry.ts"() {
    "use strict";
    init_locations();
  }
});

// client/src/lib/queryClient.ts
var queryClient_exports = {};
__export(queryClient_exports, {
  apiRequest: () => apiRequest,
  getQueryFn: () => getQueryFn,
  queryClient: () => queryClient
});
import { QueryClient } from "@tanstack/react-query";
async function throwIfResNotOk(res) {
  if (!res.ok) {
    const text2 = await res.text() || res.statusText;
    throw new Error(`${res.status}: ${text2}`);
  }
}
async function apiRequest(method, url, data, signal) {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : void 0,
    credentials: "include",
    signal
  });
  await throwIfResNotOk(res);
  return res;
}
var getQueryFn, queryClient;
var init_queryClient = __esm({
  "client/src/lib/queryClient.ts"() {
    "use strict";
    init_location_expiry();
    getQueryFn = ({ on401: unauthorizedBehavior }) => async ({ queryKey, signal }) => {
      const res = await fetch(queryKey[0], {
        credentials: "include",
        signal
      });
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
      await throwIfResNotOk(res);
      return await res.json();
    };
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          queryFn: getQueryFn({ on401: "throw" }),
          refetchInterval: false,
          refetchOnWindowFocus: false,
          staleTime: Infinity,
          retry: false
        },
        mutations: {
          retry: false
        }
      }
    });
    if (typeof window !== "undefined") {
      const stopExpiry = startLocationExpiry(queryClient);
      if (import.meta.hot) import.meta.hot.dispose(stopExpiry);
    }
  }
});

// shared/navigation.ts
var navigation_exports = {};
__export(navigation_exports, {
  isAllowedAuthReturnTo: () => isAllowedAuthReturnTo
});
function isAllowedAuthReturnTo(value) {
  return typeof value === "string" && (value === "/search" || value === "/wishlist" || value === "/inbox" || /^\/search\?service=[1-9]\d{0,9}$/.test(value) && Number(value.split("=")[1]) <= 2147483647 || value === "/account" || value === "/my-bookings" || value === "/administration" || value === "/administration?section=audit" || providerDestinations.has(value) || /^\/providers\/(?=[a-z0-9-]{3,64}(?:\?|$))[a-z0-9]+(?:-[a-z0-9]+)*(?:\?book=[1-9]\d{0,9})?$/.test(value) || /^\/my-services\/services\/\d+\/edit$/.test(value) || /^\/invite(?:\?|$)/.test(value));
}
var providerDestinations;
var init_navigation = __esm({
  "shared/navigation.ts"() {
    "use strict";
    providerDestinations = /* @__PURE__ */ new Set([
      "/my-services",
      "/my-services/appointments",
      "/my-services/services",
      "/my-services/services/new",
      "/my-services/upcoming-appointments",
      "/my-services/past-appointments",
      "/my-services/availability",
      "/my-services/settings",
      "/my-services/settings/team",
      "/my-services/settings/storefront",
      "/my-services/settings/pricing",
      "/my-services/settings/addresses"
    ]);
  }
});

// client/src/hooks/useAuth.ts
import { useQuery } from "@tanstack/react-query";
function useAuth() {
  const { data: user2, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false
  });
  return {
    user: user2,
    isLoading,
    isError,
    refetch,
    isAuthenticated: !!user2
  };
}
var init_useAuth = __esm({
  "client/src/hooks/useAuth.ts"() {
    "use strict";
    init_queryClient();
  }
});

// client/src/hooks/use-provider-workspace.ts
import { useQuery as useQuery2 } from "@tanstack/react-query";
function useProviderWorkspace() {
  return useQuery2({ queryKey: ["/api/company/context"], retry: false });
}
function useProviderServices() {
  return useQuery2({ queryKey: ["/api/services/provider"], staleTime: 3e4, retry: false });
}
function useProviderEmployees() {
  return useQuery2({ queryKey: ["/api/provider/employees"], retry: false });
}
function useProviderBookings(scope) {
  return useQuery2({ queryKey: ["/api/bookings/provider", scope], staleTime: 3e4, gcTime: 0, retry: false });
}
function useProviderAvailability() {
  return useQuery2({ queryKey: ["/api/availability/provider"], staleTime: 3e4, retry: false });
}
var WORKSPACE_CHANGE_KEY;
var init_use_provider_workspace = __esm({
  "client/src/hooks/use-provider-workspace.ts"() {
    "use strict";
    WORKSPACE_CHANGE_KEY = ["provider-workspace-change"];
  }
});

// client/src/hooks/use-toast.ts
import * as React from "react";
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}
function dispatch(action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}
function toast({ ...props }) {
  const id = genId();
  const update = (props2) => dispatch({
    type: "UPDATE_TOAST",
    toast: { ...props2, id }
  });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      }
    }
  });
  return {
    id,
    dismiss,
    update
  };
}
function useToast() {
  const [state, setState] = React.useState(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);
  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: "DISMISS_TOAST", toastId })
  };
}
var TOAST_LIMIT, TOAST_REMOVE_DELAY, count, toastTimeouts, addToRemoveQueue, reducer, listeners, memoryState;
var init_use_toast = __esm({
  "client/src/hooks/use-toast.ts"() {
    "use strict";
    TOAST_LIMIT = 1;
    TOAST_REMOVE_DELAY = 1e6;
    count = 0;
    toastTimeouts = /* @__PURE__ */ new Map();
    addToRemoveQueue = (toastId) => {
      if (toastTimeouts.has(toastId)) {
        return;
      }
      const timeout = setTimeout(() => {
        toastTimeouts.delete(toastId);
        dispatch({
          type: "REMOVE_TOAST",
          toastId
        });
      }, TOAST_REMOVE_DELAY);
      toastTimeouts.set(toastId, timeout);
    };
    reducer = (state, action) => {
      switch (action.type) {
        case "ADD_TOAST":
          return {
            ...state,
            toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT)
          };
        case "UPDATE_TOAST":
          return {
            ...state,
            toasts: state.toasts.map(
              (t) => t.id === action.toast.id ? { ...t, ...action.toast } : t
            )
          };
        case "DISMISS_TOAST": {
          const { toastId } = action;
          if (toastId) {
            addToRemoveQueue(toastId);
          } else {
            state.toasts.forEach((toast2) => {
              addToRemoveQueue(toast2.id);
            });
          }
          return {
            ...state,
            toasts: state.toasts.map(
              (t) => t.id === toastId || toastId === void 0 ? {
                ...t,
                open: false
              } : t
            )
          };
        }
        case "REMOVE_TOAST":
          if (action.toastId === void 0) {
            return {
              ...state,
              toasts: []
            };
          }
          return {
            ...state,
            toasts: state.toasts.filter((t) => t.id !== action.toastId)
          };
      }
    };
    listeners = [];
    memoryState = { toasts: [] };
  }
});

// client/src/hooks/use-workspace-change.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
function useWorkspaceChange() {
  const queryClient3 = useQueryClient();
  const { toast: toast2 } = useToast();
  const [location2, navigate] = useLocation();
  const editing = /\/services\/(?:new|\d+\/edit)$/.test(location2);
  return useMutation({
    mutationKey: WORKSPACE_CHANGE_KEY,
    onMutate: () => queryClient3.cancelQueries({ predicate: (query) => workspaceQueries(query.queryKey[0]) }),
    mutationFn: async (companyId) => (await apiRequest("POST", "/api/company/context", { companyId })).json(),
    onSuccess: async (context2) => {
      await queryClient3.resetQueries({ predicate: (query) => workspaceQueries(query.queryKey[0]) });
      queryClient3.setQueryData(["/api/company/context"], context2);
      if (editing) navigate("/my-services/services", { replace: true });
      else if (location2.startsWith("/my-services/availability") && !context2.permissions.manageSchedules || location2.startsWith("/my-services/settings") && !context2.permissions.manageServices && !context2.permissions.manageTeam && !context2.permissions.isOwner) navigate("/my-services/appointments", { replace: true });
      await queryClient3.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => toast2({ title: "Unable to switch workspace", description: "Please try again.", variant: "destructive" })
  });
}
var workspaceQueries;
var init_use_workspace_change = __esm({
  "client/src/hooks/use-workspace-change.ts"() {
    "use strict";
    init_use_provider_workspace();
    init_use_toast();
    init_queryClient();
    workspaceQueries = (key) => /^\/api\/(addresses|workspace\/pricing-settings|provider|company\/team|services\/provider|bookings\/provider|availability\/provider|notifications)/.test(String(key)) || key === "notification-preview";
  }
});

// client/src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
var init_utils = __esm({
  "client/src/lib/utils.ts"() {
    "use strict";
  }
});

// client/src/components/ui/label.tsx
import * as React2 from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva } from "class-variance-authority";
import { jsx } from "react/jsx-runtime";
var labelVariants, Label;
var init_label = __esm({
  "client/src/components/ui/label.tsx"() {
    "use strict";
    init_utils();
    labelVariants = cva(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
    );
    Label = React2.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
      LabelPrimitive.Root,
      {
        ref,
        className: cn(labelVariants(), className),
        ...props
      }
    ));
    Label.displayName = LabelPrimitive.Root.displayName;
  }
});

// client/src/components/ui/popover.tsx
import * as React3 from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { jsx as jsx2 } from "react/jsx-runtime";
var Popover, PopoverTrigger, PopoverContent;
var init_popover = __esm({
  "client/src/components/ui/popover.tsx"() {
    "use strict";
    init_utils();
    Popover = PopoverPrimitive.Root;
    PopoverTrigger = PopoverPrimitive.Trigger;
    PopoverContent = React3.forwardRef(({ className, align = "center", sideOffset = 4, ...props }, ref) => /* @__PURE__ */ jsx2(PopoverPrimitive.Portal, { children: /* @__PURE__ */ jsx2(
      PopoverPrimitive.Content,
      {
        ref,
        align,
        sideOffset,
        className: cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]",
          className
        ),
        ...props
      }
    ) }));
    PopoverContent.displayName = PopoverPrimitive.Content.displayName;
  }
});

// client/src/components/provider/company-role-labels.ts
var roleLabels;
var init_company_role_labels = __esm({
  "client/src/components/provider/company-role-labels.ts"() {
    "use strict";
    roleLabels = {
      owner: "Owner",
      admin: "Administrator",
      provider: "Service provider",
      viewer: "Read-only"
    };
  }
});

// client/src/components/provider/workspace-switcher.tsx
var workspace_switcher_exports = {};
__export(workspace_switcher_exports, {
  WorkspaceNotice: () => WorkspaceNotice,
  default: () => WorkspaceSwitcher
});
import { useRef, useState as useState2 } from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { jsx as jsx3, jsxs } from "react/jsx-runtime";
function WorkspaceSwitcher({ context: context2, busy, onChange }) {
  const [open, setOpen] = useState2(false);
  const trigger = useRef(null);
  const { t } = useTranslation();
  if (context2.workspaces.length === 0) return null;
  return /* @__PURE__ */ jsxs(Popover, { open, onOpenChange: setOpen, children: [
    /* @__PURE__ */ jsx3(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
      "button",
      {
        ref: trigger,
        type: "button",
        disabled: busy,
        title: context2.company?.name ?? t("providerNavigation.personalWorkspace"),
        className: "min-h-12 min-w-0 flex-1 flex items-center justify-start gap-3 px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
        children: [
          /* @__PURE__ */ jsx3(Building2, { className: "w-5 h-5 shrink-0", "aria-hidden": "true" }),
          /* @__PURE__ */ jsxs("span", { className: "min-w-0 max-w-full text-start leading-tight", children: [
            /* @__PURE__ */ jsx3("span", { className: "block break-words", children: t("providerNavigation.workspace") }),
            /* @__PURE__ */ jsx3("span", { className: "block break-words lg:truncate text-xs font-normal", children: context2.company?.name ?? t("providerNavigation.personalWorkspace") })
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(PopoverContent, { side: "top", align: "start", collisionPadding: 8, className: "w-72 max-w-[calc(100vw-1rem)]", "aria-label": t("providerNavigation.workspace"), children: [
      /* @__PURE__ */ jsx3(Label, { htmlFor: "workspace", children: t("providerNavigation.workspace") }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          id: "workspace",
          className: "mt-2 w-full min-w-0 border border-neutral-500 rounded-md p-2 bg-white min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          value: context2.company?.id ?? "personal",
          disabled: busy,
          onChange: (event) => {
            setOpen(false);
            trigger.current?.focus();
            onChange(event.target.value === "personal" ? null : Number(event.target.value));
          },
          children: [
            /* @__PURE__ */ jsx3("option", { value: "personal", children: t("providerNavigation.personalWorkspace") }),
            context2.workspaces.map((company2) => /* @__PURE__ */ jsxs("option", { value: company2.id, children: [
              company2.name,
              " \xB7 ",
              roleLabels[company2.role]
            ] }, company2.id))
          ]
        }
      )
    ] })
  ] });
}
function WorkspaceNotice({ context: context2 }) {
  if (!context2.company || context2.company.isActive) return null;
  return /* @__PURE__ */ jsx3("div", { className: "mb-4 text-sm text-neutral-600", children: /* @__PURE__ */ jsx3("p", { children: "Company closed. Published offers are hidden." }) });
}
var init_workspace_switcher = __esm({
  "client/src/components/provider/workspace-switcher.tsx"() {
    "use strict";
    init_label();
    init_popover();
    init_company_role_labels();
  }
});

// client/src/components/provider/navigation-sections.ts
import { CalendarDays, CalendarClock, History, Clock, List, Settings, BarChart3 } from "lucide-react";
function providerSections(context2) {
  return [
    { path: "/my-services/appointments", labelKey: "appointmentAgenda.calendar", icon: CalendarDays, visible: true },
    { path: "/my-services/upcoming-appointments", labelKey: "providerNavigation.upcomingAppointments", icon: CalendarClock, visible: true },
    { path: "/my-services/past-appointments", labelKey: "providerNavigation.pastAppointments", icon: History, visible: true },
    { path: "/my-services/services", labelKey: "mobileNavigation.services", icon: List, visible: true },
    { path: "/my-services/availability", labelKey: "mobileNavigation.availability", icon: Clock, visible: context2?.permissions.manageSchedules },
    { path: "/my-services/reports", labelKey: "reports.title", icon: BarChart3, visible: true },
    { path: "/my-services/settings", labelKey: "mobileNavigation.settings", icon: Settings, visible: context2 && (context2.permissions.manageServices || context2.permissions.manageTeam || context2.permissions.isOwner) }
  ].filter((section) => section.visible);
}
var init_navigation_sections = __esm({
  "client/src/components/provider/navigation-sections.ts"() {
    "use strict";
  }
});

// client/src/components/provider/provider-navigation.tsx
import { Link, useLocation as useLocation2 } from "wouter";
import { useTranslation as useTranslation2 } from "react-i18next";
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
function ProviderNavigation({ context: context2, busy, onWorkspaceChange }) {
  const [location2] = useLocation2();
  const { t } = useTranslation2();
  const sections = providerSections(context2);
  return /* @__PURE__ */ jsx4("nav", { "aria-label": t("providerNavigation.sections"), className: "hidden shrink-0 lg:block lg:w-52", children: /* @__PURE__ */ jsxs2("div", { className: "flex flex-col gap-2 rounded-xl border bg-white p-2 lg:sticky lg:top-24", children: [
    /* @__PURE__ */ jsx4(WorkspaceSwitcher, { context: context2, busy, onChange: onWorkspaceChange }),
    sections.map(({ path, labelKey, icon: Icon2 }) => {
      const active = location2 === path || location2.startsWith(`${path}/`);
      return /* @__PURE__ */ jsxs2(
        Link,
        {
          href: path,
          "aria-current": active ? "page" : void 0,
          "aria-disabled": busy || void 0,
          onClick: (event) => {
            if (busy) event.preventDefault();
          },
          className: cn("hidden min-h-12 min-w-0 flex-1 items-center justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex", active ? "bg-primary/10 text-primary" : "text-neutral-600 hover:bg-neutral-100", busy && "opacity-50"),
          children: [
            /* @__PURE__ */ jsx4(Icon2, { className: "w-5 h-5 shrink-0", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx4("span", { className: "max-w-full break-words text-center lg:text-start leading-tight tracking-tighter lg:tracking-normal", children: t(labelKey) })
          ]
        },
        path
      );
    })
  ] }) });
}
var init_provider_navigation = __esm({
  "client/src/components/provider/provider-navigation.tsx"() {
    "use strict";
    init_utils();
    init_workspace_switcher();
    init_navigation_sections();
  }
});

// client/src/hooks/use-notification-capabilities.ts
import { useIsMutating, useQuery as useQuery3 } from "@tanstack/react-query";
function useNotificationCapabilities() {
  const { user: user2 } = useAuth();
  const workspace = useProviderWorkspace();
  const switching = useIsMutating({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  return useQuery3({
    queryKey: ["/api/notifications/capabilities", user2?.id, workspace.data?.company?.id ?? "personal"],
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/notifications/capabilities", void 0, signal)).json(),
    enabled: Boolean(user2 && workspace.data && !switching),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: 6e4
  });
}
var init_use_notification_capabilities = __esm({
  "client/src/hooks/use-notification-capabilities.ts"() {
    "use strict";
    init_useAuth();
    init_use_provider_workspace();
    init_queryClient();
  }
});

// client/src/lib/authUtils.ts
function isUnauthorizedError(error) {
  return error instanceof Error && /^401:/.test(error.message);
}
var init_authUtils = __esm({
  "client/src/lib/authUtils.ts"() {
    "use strict";
    init_queryClient();
  }
});

// shared/currencies.ts
function currencyDigits(currency2) {
  if (!isSupportedCurrency(currency2)) throw new RangeError("Unsupported currency");
  return CURRENCY_DIGITS[currency2];
}
function suggestedCurrency(country2) {
  return isSupportedCountry(country2) ? countryCurrency[country2] ?? null : null;
}
var SUPPORTED_CURRENCIES, CURRENCY_DIGITS, SUPPORTED_COUNTRIES, countryCurrency, isSupportedCurrency, isSupportedCountry;
var init_currencies = __esm({
  "shared/currencies.ts"() {
    "use strict";
    SUPPORTED_CURRENCIES = ["AED", "AFN", "ALL", "AMD", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWG"];
    CURRENCY_DIGITS = Object.freeze({ "AED": 2, "AFN": 2, "ALL": 2, "AMD": 2, "AOA": 2, "ARS": 2, "AUD": 2, "AWG": 2, "AZN": 2, "BAM": 2, "BBD": 2, "BDT": 2, "BHD": 3, "BIF": 0, "BMD": 2, "BND": 2, "BOB": 2, "BRL": 2, "BSD": 2, "BTN": 2, "BWP": 2, "BYN": 2, "BZD": 2, "CAD": 2, "CDF": 2, "CHF": 2, "CLP": 0, "CNY": 2, "COP": 2, "CRC": 2, "CUP": 2, "CVE": 2, "CZK": 2, "DJF": 0, "DKK": 2, "DOP": 2, "DZD": 2, "EGP": 2, "ERN": 2, "ETB": 2, "EUR": 2, "FJD": 2, "FKP": 2, "GBP": 2, "GEL": 2, "GHS": 2, "GIP": 2, "GMD": 2, "GNF": 0, "GTQ": 2, "GYD": 2, "HKD": 2, "HNL": 2, "HTG": 2, "HUF": 2, "IDR": 2, "ILS": 2, "INR": 2, "IQD": 3, "IRR": 2, "ISK": 0, "JMD": 2, "JOD": 3, "JPY": 0, "KES": 2, "KGS": 2, "KHR": 2, "KMF": 0, "KPW": 2, "KRW": 0, "KWD": 3, "KYD": 2, "KZT": 2, "LAK": 2, "LBP": 2, "LKR": 2, "LRD": 2, "LSL": 2, "LYD": 3, "MAD": 2, "MDL": 2, "MGA": 2, "MKD": 2, "MMK": 2, "MNT": 2, "MOP": 2, "MRU": 2, "MUR": 2, "MVR": 2, "MWK": 2, "MXN": 2, "MYR": 2, "MZN": 2, "NAD": 2, "NGN": 2, "NIO": 2, "NOK": 2, "NPR": 2, "NZD": 2, "OMR": 3, "PAB": 2, "PEN": 2, "PGK": 2, "PHP": 2, "PKR": 2, "PLN": 2, "PYG": 0, "QAR": 2, "RON": 2, "RSD": 2, "RUB": 2, "RWF": 0, "SAR": 2, "SBD": 2, "SCR": 2, "SDG": 2, "SEK": 2, "SGD": 2, "SHP": 2, "SLE": 2, "SOS": 2, "SRD": 2, "SSP": 2, "STN": 2, "SYP": 2, "SZL": 2, "THB": 2, "TJS": 2, "TMT": 2, "TND": 3, "TOP": 2, "TRY": 2, "TTD": 2, "TWD": 2, "TZS": 2, "UAH": 2, "UGX": 0, "USD": 2, "UYU": 2, "UZS": 2, "VES": 2, "VND": 0, "VUV": 0, "WST": 2, "XAF": 0, "XCD": 2, "XCG": 2, "XOF": 0, "XPF": 0, "YER": 2, "ZAR": 2, "ZMW": 2, "ZWG": 2 });
    SUPPORTED_COUNTRIES = ["AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"];
    countryCurrency = { "AD": "EUR", "AE": "AED", "AF": "AFN", "AG": "XCD", "AI": "XCD", "AL": "ALL", "AM": "AMD", "AO": "AOA", "AR": "ARS", "AS": "USD", "AT": "EUR", "AU": "AUD", "AW": "AWG", "AX": "EUR", "AZ": "AZN", "BA": "BAM", "BB": "BBD", "BD": "BDT", "BE": "EUR", "BF": "XOF", "BG": "EUR", "BH": "BHD", "BI": "BIF", "BJ": "XOF", "BL": "EUR", "BM": "BMD", "BN": "BND", "BO": "BOB", "BQ": "USD", "BR": "BRL", "BS": "BSD", "BV": "NOK", "BW": "BWP", "BY": "BYN", "BZ": "BZD", "CA": "CAD", "CC": "AUD", "CD": "CDF", "CF": "XAF", "CG": "XAF", "CH": "CHF", "CI": "XOF", "CK": "NZD", "CL": "CLP", "CM": "XAF", "CN": "CNY", "CO": "COP", "CR": "CRC", "CU": "CUP", "CV": "CVE", "CW": "XCG", "CX": "AUD", "CY": "EUR", "CZ": "CZK", "DE": "EUR", "DJ": "DJF", "DK": "DKK", "DM": "XCD", "DO": "DOP", "DZ": "DZD", "EC": "USD", "EE": "EUR", "EG": "EGP", "EH": "MAD", "ER": "ERN", "ES": "EUR", "ET": "ETB", "FI": "EUR", "FJ": "FJD", "FK": "FKP", "FM": "USD", "FO": "DKK", "FR": "EUR", "GA": "XAF", "GB": "GBP", "GD": "XCD", "GE": "GEL", "GF": "EUR", "GG": "GBP", "GH": "GHS", "GI": "GIP", "GL": "DKK", "GM": "GMD", "GN": "GNF", "GP": "EUR", "GQ": "XAF", "GR": "EUR", "GS": "GBP", "GT": "GTQ", "GU": "USD", "GW": "XOF", "GY": "GYD", "HK": "HKD", "HM": "AUD", "HN": "HNL", "HR": "EUR", "HU": "HUF", "ID": "IDR", "IE": "EUR", "IL": "ILS", "IM": "GBP", "IN": "INR", "IO": "USD", "IQ": "IQD", "IR": "IRR", "IS": "ISK", "IT": "EUR", "JE": "GBP", "JM": "JMD", "JO": "JOD", "JP": "JPY", "KE": "KES", "KG": "KGS", "KH": "KHR", "KI": "AUD", "KM": "KMF", "KN": "XCD", "KP": "KPW", "KR": "KRW", "KW": "KWD", "KY": "KYD", "KZ": "KZT", "LA": "LAK", "LB": "LBP", "LC": "XCD", "LI": "CHF", "LK": "LKR", "LR": "LRD", "LT": "EUR", "LU": "EUR", "LV": "EUR", "LY": "LYD", "MA": "MAD", "MC": "EUR", "MD": "MDL", "ME": "EUR", "MF": "EUR", "MG": "MGA", "MH": "USD", "MK": "MKD", "ML": "XOF", "MM": "MMK", "MN": "MNT", "MO": "MOP", "MP": "USD", "MQ": "EUR", "MR": "MRU", "MS": "XCD", "MT": "EUR", "MU": "MUR", "MV": "MVR", "MW": "MWK", "MX": "MXN", "MY": "MYR", "MZ": "MZN", "NC": "XPF", "NE": "XOF", "NF": "AUD", "NG": "NGN", "NI": "NIO", "NL": "EUR", "NO": "NOK", "NP": "NPR", "NR": "AUD", "NU": "NZD", "NZ": "NZD", "OM": "OMR", "PE": "PEN", "PF": "XPF", "PG": "PGK", "PH": "PHP", "PK": "PKR", "PL": "PLN", "PM": "EUR", "PN": "NZD", "PR": "USD", "PT": "EUR", "PW": "USD", "PY": "PYG", "QA": "QAR", "RE": "EUR", "RO": "RON", "RS": "RSD", "RU": "RUB", "RW": "RWF", "SA": "SAR", "SB": "SBD", "SC": "SCR", "SD": "SDG", "SE": "SEK", "SG": "SGD", "SH": "SHP", "SI": "EUR", "SJ": "NOK", "SK": "EUR", "SL": "SLE", "SM": "EUR", "SN": "XOF", "SO": "SOS", "SR": "SRD", "SS": "SSP", "ST": "STN", "SV": "USD", "SX": "XCG", "SY": "SYP", "SZ": "SZL", "TC": "USD", "TD": "XAF", "TF": "EUR", "TG": "XOF", "TH": "THB", "TJ": "TJS", "TK": "NZD", "TL": "USD", "TM": "TMT", "TN": "TND", "TO": "TOP", "TR": "TRY", "TT": "TTD", "TV": "AUD", "TW": "TWD", "TZ": "TZS", "UA": "UAH", "UG": "UGX", "UM": "USD", "US": "USD", "UY": "UYU", "UZ": "UZS", "VA": "EUR", "VC": "XCD", "VE": "VES", "VG": "USD", "VI": "USD", "VN": "VND", "VU": "VUV", "WF": "XPF", "WS": "WST", "YE": "YER", "YT": "EUR", "ZA": "ZAR", "ZM": "ZMW" };
    isSupportedCurrency = (value) => typeof value === "string" && Object.hasOwn(CURRENCY_DIGITS, value);
    isSupportedCountry = (value) => typeof value === "string" && SUPPORTED_COUNTRIES.includes(value);
  }
});

// client/src/lib/money.ts
function formatMoney(amount2, currency2, locale) {
  if (!isSupportedCurrency(currency2) || typeof amount2 !== "string" || amount2.length > 50 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount2)) return null;
  const digits = currencyDigits(currency2);
  const fraction = amount2.split(".")[1] ?? "";
  if (/[1-9]/.test(fraction.slice(digits))) return null;
  try {
    const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: currency2, currencyDisplay: "code", minimumFractionDigits: digits, maximumFractionDigits: digits });
    return formatter.format(amount2);
  } catch {
    return null;
  }
}
var init_money = __esm({
  "client/src/lib/money.ts"() {
    "use strict";
    init_currencies();
  }
});

// shared/appointment-collaboration.ts
import { z } from "zod";
function appointmentEventKey(booking) {
  if (booking.service?.serviceType !== "group") return `booking:${booking.id}`;
  return JSON.stringify([
    booking.companyId ?? null,
    booking.providerId,
    booking.serviceId,
    booking.employeeId ?? null,
    new Date(booking.scheduledDate).toISOString(),
    booking.bookingDuration ?? booking.service.duration,
    booking.bookingCleanupTime ?? 0
  ]);
}
var messageInputSchema, eventBookingIdsSchema, rescheduleInputSchema;
var init_appointment_collaboration = __esm({
  "shared/appointment-collaboration.ts"() {
    "use strict";
    messageInputSchema = z.object({ body: z.string().trim().min(1).max(4e3), clientRequestId: z.string().uuid() }).strict();
    eventBookingIdsSchema = z.array(z.number().int().positive()).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, "Duplicate booking IDs are not allowed.");
    rescheduleInputSchema = z.object({
      scheduledDate: z.string().datetime(),
      fallback: z.enum(["keep_original", "cancel_booking"]),
      note: z.string().trim().max(2e3).optional(),
      timeZone: z.string().min(1).max(100).refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
      clientRequestId: z.string().uuid()
    }).strict();
  }
});

// shared/provider.ts
function getProviderName(provider) {
  if (provider.providerType === "company") return provider.companyName?.trim() || "Company";
  return [provider.firstName, provider.lastName].filter(Boolean).join(" ") || "Service provider";
}
var init_provider = __esm({
  "shared/provider.ts"() {
    "use strict";
  }
});

// client/src/components/ui/button.tsx
import * as React4 from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva as cva2 } from "class-variance-authority";
import { jsx as jsx5 } from "react/jsx-runtime";
var buttonVariants, Button;
var init_button = __esm({
  "client/src/components/ui/button.tsx"() {
    "use strict";
    init_utils();
    buttonVariants = cva2(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      {
        variants: {
          variant: {
            default: "bg-primary text-primary-foreground hover:bg-primary/90",
            destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground",
            link: "text-primary underline-offset-4 hover:underline"
          },
          size: {
            default: "h-10 px-4 py-2",
            sm: "h-9 rounded-md px-3",
            lg: "h-11 rounded-md px-8",
            icon: "h-10 w-10"
          }
        },
        defaultVariants: {
          variant: "default",
          size: "default"
        }
      }
    );
    Button = React4.forwardRef(
      ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return /* @__PURE__ */ jsx5(
          Comp,
          {
            className: cn(buttonVariants({ variant, size, className })),
            ref,
            ...props
          }
        );
      }
    );
    Button.displayName = "Button";
  }
});

// client/src/components/ui/calendar.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { jsx as jsx6 } from "react/jsx-runtime";
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return /* @__PURE__ */ jsx6(
    DayPicker,
    {
      showOutsideDays,
      className: cn("p-3", className),
      classNames: {
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames
      },
      components: {
        IconLeft: ({ className: className2, ...props2 }) => /* @__PURE__ */ jsx6(ChevronLeft, { className: cn("h-4 w-4", className2), ...props2 }),
        IconRight: ({ className: className2, ...props2 }) => /* @__PURE__ */ jsx6(ChevronRight, { className: cn("h-4 w-4", className2), ...props2 })
      },
      ...props
    }
  );
}
var init_calendar = __esm({
  "client/src/components/ui/calendar.tsx"() {
    "use strict";
    init_utils();
    init_button();
    Calendar.displayName = "Calendar";
  }
});

// client/src/components/ui/badge.tsx
import { cva as cva3 } from "class-variance-authority";
import { jsx as jsx7 } from "react/jsx-runtime";
function Badge({ className, variant, ...props }) {
  return /* @__PURE__ */ jsx7("div", { className: cn(badgeVariants({ variant }), className), ...props });
}
var badgeVariants;
var init_badge = __esm({
  "client/src/components/ui/badge.tsx"() {
    "use strict";
    init_utils();
    badgeVariants = cva3(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      {
        variants: {
          variant: {
            default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
            secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
            destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
            outline: "text-foreground"
          }
        },
        defaultVariants: {
          variant: "default"
        }
      }
    );
  }
});

// client/src/lib/date-time.ts
function formatDateTime24(value, language, options = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
}) {
  return new Intl.DateTimeFormat(language, { ...options, hour12: false, hourCycle: "h23" }).format(new Date(value));
}
var init_date_time = __esm({
  "client/src/lib/date-time.ts"() {
    "use strict";
  }
});

// shared/reviews.ts
import { z as z2 } from "zod";
var reviewSchema;
var init_reviews = __esm({
  "shared/reviews.ts"() {
    "use strict";
    reviewSchema = z2.object({
      rating: z2.number().int().min(1, "Choose a rating from 1 to 5.").max(5),
      comment: z2.string().trim().max(2e3, "Comments must be 2,000 characters or fewer.").default("")
    }).strict().refine((value) => value.rating >= 3 || value.comment.length > 0, {
      path: ["comment"],
      message: "Please add a comment for a rating below 3 stars."
    });
  }
});

// client/src/components/booking-review.tsx
import { useState as useState3 } from "react";
import { useMutation as useMutation2, useQueryClient as useQueryClient2 } from "@tanstack/react-query";
import { useTranslation as useTranslation3 } from "react-i18next";
import { Star } from "lucide-react";
import { jsx as jsx8, jsxs as jsxs3 } from "react/jsx-runtime";
function BookingReviewSummary({ booking }) {
  const { t } = useTranslation3();
  const [editing, setEditing] = useState3(false);
  const [confirmDelete, setConfirmDelete] = useState3(false);
  const { updateCache, onError } = useReviewCache(booking);
  const remove = useMutation2({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/bookings/${booking.id}/review`);
    },
    onSuccess: () => updateCache(null),
    onError
  });
  const review = booking.review;
  if (editing) return /* @__PURE__ */ jsx8(ReviewEditor, { booking, review, onSaved: () => setEditing(false), onCancel: () => setEditing(false) });
  return /* @__PURE__ */ jsxs3("div", { className: "rounded-lg bg-neutral-50 p-3 text-sm space-y-1", "data-testid": `review-saved-${review.bookingId}`, children: [
    /* @__PURE__ */ jsx8("p", { className: "font-medium", children: t("reviews.yourRating", { rating: review.rating }) }),
    review.comment && /* @__PURE__ */ jsx8("p", { className: "whitespace-pre-wrap break-words", children: review.comment }),
    confirmDelete ? /* @__PURE__ */ jsxs3("div", { className: "space-y-2", role: "group", "aria-label": t("reviews.deleteConfirm"), children: [
      /* @__PURE__ */ jsx8("p", { children: t("reviews.deleteConfirm") }),
      /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap gap-2", children: [
        /* @__PURE__ */ jsx8(
          Button,
          {
            type: "button",
            variant: "destructive",
            size: "sm",
            disabled: remove.isPending,
            onClick: () => {
              if (!remove.isPending) remove.mutate();
            },
            children: t(remove.isPending ? "reviews.deleting" : "reviews.confirmDelete")
          }
        ),
        /* @__PURE__ */ jsx8(Button, { type: "button", variant: "outline", size: "sm", disabled: remove.isPending, onClick: () => {
          setConfirmDelete(false);
          remove.reset();
        }, children: t("common.cancel") })
      ] })
    ] }) : /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap gap-2 pt-2", children: [
      /* @__PURE__ */ jsx8(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setEditing(true), children: t("reviews.edit") }),
      /* @__PURE__ */ jsx8(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setConfirmDelete(true), children: t("reviews.delete") })
    ] }),
    remove.isError && /* @__PURE__ */ jsx8("p", { role: "alert", className: "text-destructive", children: t("reviews.deleteError") })
  ] });
}
function useReviewCache(booking) {
  const queryClient3 = useQueryClient2();
  return {
    updateCache: (review) => {
      queryClient3.setQueryData(["/api/bookings/seeker"], (current) => current?.map((row) => row.id === booking.id ? { ...row, review } : row));
      void queryClient3.invalidateQueries({ queryKey: ["/api/services/search"] });
      void queryClient3.invalidateQueries({ queryKey: ["/api/services/semantic-search"] });
      void queryClient3.invalidateQueries({ queryKey: ["/api/services", booking.serviceId, "reviews"] });
      void queryClient3.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) queryClient3.setQueryData(["/api/auth/user"], null);
      if (/^(404|409):/.test(error.message)) {
        void queryClient3.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
      }
    }
  };
}
function ReviewEditor({ booking, review, onSaved, onCancel }) {
  const { t } = useTranslation3();
  const { updateCache, onError } = useReviewCache(booking);
  const [rating, setRating] = useState3(review?.rating ?? 0);
  const [comment, setComment] = useState3(review?.comment ?? "");
  const [validation, setValidation] = useState3("");
  const save = useMutation2({
    mutationFn: async (input2) => (await apiRequest(review ? "PATCH" : "POST", `/api/bookings/${booking.id}/review`, input2)).json(),
    onSuccess: (saved2) => {
      onSaved();
      updateCache(saved2);
    },
    onError
  });
  const required = rating > 0 && rating < 3;
  return /* @__PURE__ */ jsxs3("form", { className: "space-y-3", "data-testid": `review-form-${booking.id}`, onSubmit: (event) => {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = reviewSchema.safeParse({ rating, comment });
    if (!parsed.success) {
      setValidation(t(!rating ? "reviews.chooseRating" : comment.trim().length > 2e3 ? "reviews.commentTooLong" : "reviews.commentRequired"));
      return;
    }
    setValidation("");
    save.mutate(parsed.data);
  }, children: [
    /* @__PURE__ */ jsxs3("fieldset", { disabled: save.isPending, className: "space-y-2", children: [
      /* @__PURE__ */ jsx8("legend", { className: "text-sm font-medium", children: t("reviews.rating") }),
      /* @__PURE__ */ jsx8("div", { className: "flex gap-1", children: [1, 2, 3, 4, 5].map((value) => /* @__PURE__ */ jsxs3("label", { className: "relative cursor-pointer rounded-md p-2 hover:bg-amber-50", children: [
        /* @__PURE__ */ jsx8(
          "input",
          {
            type: "radio",
            name: `rating-${booking.id}`,
            value,
            checked: rating === value,
            "aria-label": t("reviews.stars", { count: value }),
            onChange: () => {
              setRating(value);
              setValidation("");
            },
            className: "peer sr-only"
          }
        ),
        /* @__PURE__ */ jsx8(Star, { "aria-hidden": "true", className: `h-6 w-6 peer-focus-visible:ring-2 peer-focus-visible:ring-ring rounded-sm ${value <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-400"}` })
      ] }, value)) }),
      /* @__PURE__ */ jsx8("label", { htmlFor: `review-comment-${booking.id}`, className: "block text-sm font-medium", children: t(required ? "reviews.commentRequiredLabel" : "reviews.commentOptionalLabel") }),
      /* @__PURE__ */ jsx8(
        "textarea",
        {
          id: `review-comment-${booking.id}`,
          value: comment,
          required,
          maxLength: 2e3,
          onChange: (event) => {
            setComment(event.target.value);
            setValidation("");
          },
          rows: 3,
          "aria-describedby": `review-help-${booking.id}`,
          className: "w-full rounded-md border border-input bg-background p-3 text-sm"
        }
      ),
      /* @__PURE__ */ jsxs3("p", { id: `review-help-${booking.id}`, className: "text-xs text-neutral-500", children: [
        t("reviews.commentHelp"),
        " ",
        t("reviews.publicNotice")
      ] })
    ] }),
    (validation || save.isError) && /* @__PURE__ */ jsx8("p", { role: "alert", className: "text-sm text-destructive", children: validation || t("reviews.saveError") }),
    /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsx8(Button, { type: "submit", disabled: save.isPending, children: t(save.isPending ? "reviews.saving" : review ? "reviews.saveChanges" : "reviews.submit") }),
      /* @__PURE__ */ jsx8(Button, { type: "button", variant: "outline", disabled: save.isPending, onClick: onCancel, children: t(review ? "common.cancel" : "reviews.later") })
    ] })
  ] });
}
var init_booking_review = __esm({
  "client/src/components/booking-review.tsx"() {
    "use strict";
    init_button();
    init_queryClient();
    init_date_time();
    init_authUtils();
    init_reviews();
  }
});

// client/src/components/ui/dropdown-menu.tsx
import * as React5 from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight as ChevronRight2, Circle } from "lucide-react";
import { jsx as jsx9, jsxs as jsxs4 } from "react/jsx-runtime";
var DropdownMenu, DropdownMenuTrigger, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut;
var init_dropdown_menu = __esm({
  "client/src/components/ui/dropdown-menu.tsx"() {
    "use strict";
    init_utils();
    DropdownMenu = DropdownMenuPrimitive.Root;
    DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
    DropdownMenuSubTrigger = React5.forwardRef(({ className, inset, children, ...props }, ref) => /* @__PURE__ */ jsxs4(
      DropdownMenuPrimitive.SubTrigger,
      {
        ref,
        className: cn(
          "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          inset && "pl-8",
          className
        ),
        ...props,
        children: [
          children,
          /* @__PURE__ */ jsx9(ChevronRight2, { className: "ml-auto" })
        ]
      }
    ));
    DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;
    DropdownMenuSubContent = React5.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx9(
      DropdownMenuPrimitive.SubContent,
      {
        ref,
        className: cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
          className
        ),
        ...props
      }
    ));
    DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;
    DropdownMenuContent = React5.forwardRef(({ className, sideOffset = 4, ...props }, ref) => /* @__PURE__ */ jsx9(DropdownMenuPrimitive.Portal, { children: /* @__PURE__ */ jsx9(
      DropdownMenuPrimitive.Content,
      {
        ref,
        sideOffset,
        className: cn(
          "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
          className
        ),
        ...props
      }
    ) }));
    DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;
    DropdownMenuItem = React5.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsx9(
      DropdownMenuPrimitive.Item,
      {
        ref,
        className: cn(
          "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          inset && "pl-8",
          className
        ),
        ...props
      }
    ));
    DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;
    DropdownMenuCheckboxItem = React5.forwardRef(({ className, children, checked, ...props }, ref) => /* @__PURE__ */ jsxs4(
      DropdownMenuPrimitive.CheckboxItem,
      {
        ref,
        className: cn(
          "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        ),
        checked,
        ...props,
        children: [
          /* @__PURE__ */ jsx9("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ jsx9(DropdownMenuPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx9(Check, { className: "h-4 w-4" }) }) }),
          children
        ]
      }
    ));
    DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;
    DropdownMenuRadioItem = React5.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs4(
      DropdownMenuPrimitive.RadioItem,
      {
        ref,
        className: cn(
          "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        ),
        ...props,
        children: [
          /* @__PURE__ */ jsx9("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ jsx9(DropdownMenuPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx9(Circle, { className: "h-2 w-2 fill-current" }) }) }),
          children
        ]
      }
    ));
    DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;
    DropdownMenuLabel = React5.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsx9(
      DropdownMenuPrimitive.Label,
      {
        ref,
        className: cn(
          "px-2 py-1.5 text-sm font-semibold",
          inset && "pl-8",
          className
        ),
        ...props
      }
    ));
    DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;
    DropdownMenuSeparator = React5.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx9(
      DropdownMenuPrimitive.Separator,
      {
        ref,
        className: cn("-mx-1 my-1 h-px bg-muted", className),
        ...props
      }
    ));
    DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;
    DropdownMenuShortcut = ({
      className,
      ...props
    }) => {
      return /* @__PURE__ */ jsx9(
        "span",
        {
          className: cn("ml-auto text-xs tracking-widest opacity-60", className),
          ...props
        }
      );
    };
    DropdownMenuShortcut.displayName = "DropdownMenuShortcut";
  }
});

// client/src/components/provider/booking-controls.tsx
import { useRef as useRef2 } from "react";
import { useTranslation as useTranslation4 } from "react-i18next";
import { ChevronDown, MessageSquare } from "lucide-react";
import { Fragment, jsx as jsx10, jsxs as jsxs5 } from "react/jsx-runtime";
function EventControls({ booking, rows, updating, onEventAction }) {
  const { t } = useTranslation4();
  const actionTrigger = useRef2(null);
  if (!onEventAction) return null;
  return /* @__PURE__ */ jsxs5(Fragment, { children: [
    /* @__PURE__ */ jsx10("span", { className: "sr-only", children: t(prefix + "wholeEvent") }),
    rows.some((row) => row.status === "confirmed") && /* @__PURE__ */ jsx10(Button, { size: "sm", disabled: updating, onClick: (event) => onEventAction(booking, "complete", event.currentTarget), children: t(prefix + "markComplete") }),
    /* @__PURE__ */ jsxs5(DropdownMenu, { children: [
      /* @__PURE__ */ jsx10(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs5(Button, { ref: actionTrigger, variant: "outline", size: "sm", disabled: updating, "data-testid": `event-actions-${booking.id}`, children: [
        t(prefix + "eventActions"),
        /* @__PURE__ */ jsx10(ChevronDown, { className: "ms-1 h-4 w-4", "aria-hidden": "true" })
      ] }) }),
      /* @__PURE__ */ jsxs5(DropdownMenuContent, { align: "end", children: [
        rows.some((row) => row.status === "confirmed" || row.status === "pending") && /* @__PURE__ */ jsxs5(Fragment, { children: [
          /* @__PURE__ */ jsx10(DropdownMenuItem, { className: "min-h-11", onSelect: () => onEventAction(booking, "reschedule", actionTrigger.current ?? void 0), children: t(prefix + "rescheduleEvent") }),
          /* @__PURE__ */ jsx10(DropdownMenuItem, { className: "min-h-11 text-red-700", onSelect: () => onEventAction(booking, "cancel", actionTrigger.current ?? void 0), children: t(prefix + "cancelEvent") })
        ] }),
        /* @__PURE__ */ jsxs5(DropdownMenuItem, { className: "min-h-11", onSelect: () => onEventAction(booking, "message", actionTrigger.current ?? void 0), children: [
          t(prefix + "messageGroup"),
          " \xB7 PRO"
        ] })
      ] })
    ] })
  ] });
}
function BookingControls({ booking, group, updating, onStatusChange, onReschedule, onMessage, renderProviderNotifications }) {
  const { t } = useTranslation4();
  const actionTrigger = useRef2(null);
  const active = booking.status === "pending" || booking.status === "confirmed";
  const name = [booking.seeker.firstName, booking.seeker.lastName].filter(Boolean).join(" ") || t(prefix + "customer");
  return /* @__PURE__ */ jsxs5(Fragment, { children: [
    /* @__PURE__ */ jsxs5("div", { className: "flex flex-wrap items-center gap-2", children: [
      booking.status === "pending" && onStatusChange && /* @__PURE__ */ jsx10(Button, { size: "sm", disabled: updating, onClick: (event) => onStatusChange(booking.id, "confirmed", event.currentTarget), children: t(prefix + "approve") }),
      !group && booking.status === "confirmed" && onStatusChange && /* @__PURE__ */ jsx10(Button, { size: "sm", disabled: updating, onClick: (event) => onStatusChange(booking.id, "completed", event.currentTarget), children: t(prefix + "markComplete") }),
      renderProviderNotifications?.(booking),
      (onMessage || active && (onStatusChange || onReschedule)) && /* @__PURE__ */ jsxs5(DropdownMenu, { children: [
        /* @__PURE__ */ jsx10(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs5(Button, { ref: actionTrigger, variant: "outline", size: "sm", disabled: updating, "aria-label": `${t(prefix + "moreActions")} \xB7 ${name}`, "data-testid": `booking-actions-${booking.id}`, children: [
          t(prefix + "moreActions"),
          /* @__PURE__ */ jsx10(ChevronDown, { className: "ms-1 h-4 w-4", "aria-hidden": "true" })
        ] }) }),
        /* @__PURE__ */ jsxs5(DropdownMenuContent, { align: "end", children: [
          active && /* @__PURE__ */ jsxs5(Fragment, { children: [
            onReschedule && /* @__PURE__ */ jsx10(DropdownMenuItem, { className: "min-h-11", onSelect: () => onReschedule(booking, actionTrigger.current ?? void 0), children: t(prefix + "rescheduleBooking") }),
            onStatusChange && /* @__PURE__ */ jsx10(DropdownMenuItem, { className: "min-h-11 text-red-700", onSelect: () => onStatusChange(booking.id, "cancelled", actionTrigger.current ?? void 0), children: t(prefix + (booking.status === "pending" ? "declineBooking" : "cancelBooking")) })
          ] }),
          onMessage && /* @__PURE__ */ jsx10(DropdownMenuItem, { className: "min-h-11", onSelect: () => onMessage(booking, actionTrigger.current ?? void 0), children: t(prefix + "messages") })
        ] })
      ] })
    ] }),
    onMessage && /* @__PURE__ */ jsx10("div", { className: "flex flex-wrap gap-x-4 gap-y-1", children: /* @__PURE__ */ jsxs5(Button, { variant: "ghost", size: "sm", className: "text-primary px-0 min-h-11", onClick: (event) => {
      event.currentTarget.focus();
      onMessage(booking, event.currentTarget);
    }, "data-testid": `booking-messages-${booking.id}`, children: [
      /* @__PURE__ */ jsx10(MessageSquare, { className: "h-4 w-4 me-2", "aria-hidden": "true" }),
      t(prefix + "messages")
    ] }) })
  ] });
}
var prefix;
var init_booking_controls = __esm({
  "client/src/components/provider/booking-controls.tsx"() {
    "use strict";
    init_button();
    init_dropdown_menu();
    prefix = "appointmentCollaboration.";
  }
});

// client/src/lib/appointment-calendar.ts
function shiftCalendarDay(date, amount2) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount2);
  return result;
}
function calendarDays(date, mode) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  if (mode === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return Array.from({ length: mode === "week" ? 7 : 1 }, (_, index) => shiftCalendarDay(start, index));
}
function calendarSegments(events, days) {
  const result = [];
  for (const day2 of days) {
    const startOfDay = day2.getTime(), endOfDay = shiftCalendarDay(day2, 1).getTime();
    const segments = [];
    for (const event of events) {
      const row = event.rows[0];
      if (!row) continue;
      const start = new Date(row.scheduledDate).getTime(), duration = row.bookingDuration ?? row.service.duration;
      if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) continue;
      const end = start + duration * 6e4;
      if (start >= endOfDay || end <= startOfDay) continue;
      segments.push({
        event,
        day: localDateKey(day2),
        start: (Math.max(start, startOfDay) - startOfDay) / 6e4,
        end: (Math.min(end, endOfDay) - startOfDay) / 6e4,
        startsAt: new Date(start),
        endsAt: new Date(end),
        column: 0,
        columns: 1
      });
    }
    segments.sort((a, b) => a.start - b.start || b.end - a.end || a.event.key.localeCompare(b.event.key));
    let cluster = [], clusterEnd = -1;
    const flush2 = () => {
      const laneEnds = [];
      for (const segment of cluster) {
        let lane = laneEnds.findIndex((end) => end <= segment.start);
        if (lane === -1) lane = laneEnds.length;
        segment.column = lane;
        laneEnds[lane] = segment.end;
      }
      for (const segment of cluster) {
        segment.columns = laneEnds.length;
        result.push(segment);
      }
    };
    for (const segment of segments) {
      if (segment.start >= clusterEnd) {
        flush2();
        cluster = [];
        clusterEnd = -1;
      }
      cluster.push(segment);
      clusterEnd = Math.max(clusterEnd, segment.end);
    }
    flush2();
  }
  return result;
}
var localDateKey, calendarDayMinutes;
var init_appointment_calendar = __esm({
  "client/src/lib/appointment-calendar.ts"() {
    "use strict";
    localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    calendarDayMinutes = (date) => (shiftCalendarDay(date, 1).getTime() - date.getTime()) / 6e4;
  }
});

// client/src/components/ui/dialog.tsx
import * as React6 from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { jsx as jsx11, jsxs as jsxs6 } from "react/jsx-runtime";
var Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription;
var init_dialog = __esm({
  "client/src/components/ui/dialog.tsx"() {
    "use strict";
    "use client";
    init_utils();
    Dialog = DialogPrimitive.Root;
    DialogTrigger = DialogPrimitive.Trigger;
    DialogPortal = DialogPrimitive.Portal;
    DialogOverlay = React6.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx11(
      DialogPrimitive.Overlay,
      {
        ref,
        className: cn(
          "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        ),
        ...props
      }
    ));
    DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
    DialogContent = React6.forwardRef(({ className, children, closeLabel = "Close", closeDisabled = false, ...props }, ref) => /* @__PURE__ */ jsxs6(DialogPortal, { children: [
      /* @__PURE__ */ jsx11(DialogOverlay, {}),
      /* @__PURE__ */ jsxs6(
        DialogPrimitive.Content,
        {
          ref,
          className: cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
            className
          ),
          ...props,
          children: [
            children,
            /* @__PURE__ */ jsxs6(DialogPrimitive.Close, { disabled: closeDisabled, className: "absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground", children: [
              /* @__PURE__ */ jsx11(X, { className: "h-4 w-4" }),
              /* @__PURE__ */ jsx11("span", { className: "sr-only", children: closeLabel })
            ] })
          ]
        }
      )
    ] }));
    DialogContent.displayName = DialogPrimitive.Content.displayName;
    DialogHeader = ({
      className,
      ...props
    }) => /* @__PURE__ */ jsx11(
      "div",
      {
        className: cn(
          "flex flex-col space-y-1.5 text-center sm:text-left",
          className
        ),
        ...props
      }
    );
    DialogHeader.displayName = "DialogHeader";
    DialogFooter = ({
      className,
      ...props
    }) => /* @__PURE__ */ jsx11(
      "div",
      {
        className: cn(
          "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
          className
        ),
        ...props
      }
    );
    DialogFooter.displayName = "DialogFooter";
    DialogTitle = React6.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx11(
      DialogPrimitive.Title,
      {
        ref,
        className: cn(
          "text-lg font-semibold leading-none tracking-tight",
          className
        ),
        ...props
      }
    ));
    DialogTitle.displayName = DialogPrimitive.Title.displayName;
    DialogDescription = React6.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx11(
      DialogPrimitive.Description,
      {
        ref,
        className: cn("text-sm text-muted-foreground", className),
        ...props
      }
    ));
    DialogDescription.displayName = DialogPrimitive.Description.displayName;
  }
});

// client/src/hooks/use-calendar-swipe.ts
import { useEffect as useEffect2, useRef as useRef3 } from "react";
function useCalendarSwipe(surface, scroller, { mode, disabled, onNavigate }) {
  const suppressClickUntil = useRef3(0);
  useEffect2(() => {
    const node = surface.current;
    if (!node || disabled) return;
    let gesture = null;
    const start = (event) => {
      suppressClickUntil.current = 0;
      gesture = null;
      if (event.touches.length !== 1 || !(event.target instanceof Element)) return;
      const target = event.target, button = target.closest("button");
      if (target.closest('input,select,textarea,a,[contenteditable="true"]')) return;
      const header = !!target.closest("[data-calendar-swipe-navigation]");
      if (!header && !target.closest("[data-calendar-swipe-grid]")) return;
      if (button && !button.hasAttribute("data-calendar-swipe-navigation") && !button.hasAttribute("data-calendar-event")) return;
      const touch = event.touches[0], scroll = scroller.current;
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      gesture = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        time: performance.now(),
        header,
        scrollLeft: scroll?.scrollLeft ?? 0,
        scrollMax: Math.max(0, (scroll?.scrollWidth ?? 0) - (scroll?.clientWidth ?? 0)),
        axis: "pending"
      };
    };
    const move = (event) => {
      if (!gesture) return;
      if (event.touches.length !== 1) {
        gesture = null;
        return;
      }
      const touch = Array.from(event.touches).find((item) => item.identifier === gesture.id);
      if (!touch) {
        gesture = null;
        return;
      }
      const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
      if (gesture.axis === "pending") {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) gesture.axis = "vertical";
        else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.35) {
          const atEdge = dx > 0 ? gesture.scrollLeft <= 1 : gesture.scrollLeft >= gesture.scrollMax - 1;
          gesture.axis = mode === "day" || gesture.header || atEdge ? "horizontal" : "scroll";
        }
      }
      if (gesture.axis === "horizontal" && event.cancelable) event.preventDefault();
    };
    const end = (event) => {
      const completed = gesture;
      gesture = null;
      if (!completed || event.touches.length || completed.axis !== "horizontal") return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === completed.id);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      suppressClickUntil.current = performance.now() + 500;
      const dx = touch.clientX - completed.x, dy = touch.clientY - completed.y;
      if (performance.now() - completed.time <= 1200 && Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5) onNavigate(dx < 0 ? 1 : -1);
    };
    const cancel = () => {
      gesture = null;
    };
    const click2 = (event) => {
      if (event.detail === 0 || performance.now() >= suppressClickUntil.current) return;
      if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent && event.pointerType !== "touch") return;
      suppressClickUntil.current = 0;
      event.preventDefault();
      event.stopPropagation();
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: false });
    node.addEventListener("touchend", end, { passive: false });
    node.addEventListener("touchcancel", cancel, { passive: true });
    node.addEventListener("click", click2, true);
    return () => {
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", cancel);
      node.removeEventListener("click", click2, true);
    };
  }, [surface, scroller, mode, disabled, onNavigate]);
}
var init_use_calendar_swipe = __esm({
  "client/src/hooks/use-calendar-swipe.ts"() {
    "use strict";
  }
});

// client/src/components/provider/appointment-calendar.tsx
import { useCallback, useEffect as useEffect3, useMemo, useRef as useRef4, useState as useState4 } from "react";
import { useTranslation as useTranslation5 } from "react-i18next";
import { Fragment as Fragment2, jsx as jsx12, jsxs as jsxs7 } from "react/jsx-runtime";
function AppointmentCalendar({ events, date, onDateChange, loading, employees, filters, updating, renderDetails }) {
  const { t, i18n } = useTranslation5();
  const [mode, setMode] = useState4(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches ? "day" : "week");
  const explicitMode = useRef4(false), scroll = useRef4(null), navigation = useRef4(null), trigger = useRef4(null);
  const [selectedKey, setSelectedKey] = useState4(null), [now, setNow] = useState4(() => /* @__PURE__ */ new Date());
  useEffect3(() => {
    const timer = window.setInterval(() => setNow(/* @__PURE__ */ new Date()), 6e4);
    return () => window.clearInterval(timer);
  }, []);
  useEffect3(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const change = () => {
      if (!explicitMode.current) setMode(media.matches ? "day" : "week");
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const days = useMemo(() => calendarDays(date, mode), [date, mode]);
  const segments = useMemo(() => calendarSegments(events, days), [events, days]);
  const selected = events.find((event) => event.key === selectedKey);
  const swipeSurface = useRef4(null);
  const swipeNavigate = useCallback((direction) => onDateChange(shiftCalendarDay(date, direction * (mode === "week" ? 7 : 1))), [date, mode, onDateChange]);
  useCalendarSwipe(swipeSurface, scroll, { mode, disabled: loading || !!updating || !!selected, onNavigate: swipeNavigate });
  useEffect3(() => {
    if (selectedKey && !selected) setSelectedKey(null);
  }, [selected, selectedKey]);
  const rangeKey = `${localDateKey(days[0])}:${mode}`;
  const scrolledRange = useRef4("");
  useEffect3(() => {
    if (loading || !scroll.current || scrolledRange.current === rangeKey) return;
    scrolledRange.current = rangeKey;
    const today = days.find((day2) => localDateKey(day2) === localDateKey(now));
    const minute = segments.length ? Math.min(...segments.map((segment) => segment.start)) : today ? (now.getTime() - today.getTime()) / 6e4 : 480;
    scroll.current.scrollTop = Math.max(0, (minute - 60) * HOUR_HEIGHT / 60);
  }, [rangeKey, loading, days, segments, now]);
  const fullDate = (value) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(value);
  const rangeLabel = mode === "day" ? fullDate(days[0]) : new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric" }).formatRange(days[0], days[6]);
  const hours = Math.max(...days.map(calendarDayMinutes)) / 60;
  const transition = days.some((day2) => calendarDayMinutes(day2) !== 1440);
  const ticks = Array.from({ length: Math.ceil(hours) }, (_, index) => index);
  const gridStyle = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };
  const calendarStatus = (event) => Array.from(new Set(event.rows.map((row) => row.status).filter(Boolean))).map((status) => t(`appointmentCollaboration.status${status[0].toUpperCase()}${status.slice(1)}`)).join(" \xB7 ");
  const customer = (event) => {
    const row = event.rows[0];
    return row.service.serviceType === "group" ? t("appointmentCollaboration.confirmedPlaces", {
      count: event.rows.filter((item) => item.status === "confirmed" || item.status === "completed").reduce((sum, item) => sum + (item.participantCount ?? 1), 0),
      capacity: row.service.maxCapacity ?? 1
    }) : [row.seeker.firstName, row.seeker.lastName].filter(Boolean).join(" ") || t("appointmentCollaboration.customer");
  };
  return /* @__PURE__ */ jsxs7("div", { ref: swipeSurface, className: "min-w-0 rounded-xl border bg-white p-2 sm:p-3 space-y-3", "data-testid": "appointment-calendar", children: [
    /* @__PURE__ */ jsx12("p", { className: "sr-only", "aria-live": "polite", "data-testid": "calendar-range", children: rangeLabel }),
    /* @__PURE__ */ jsxs7("div", { className: "flex min-w-0 flex-wrap items-center gap-0.5 min-[360px]:gap-2", "data-testid": "calendar-toolbar", children: [
      /* @__PURE__ */ jsx12(Button, { ref: navigation, variant: "outline", size: "sm", className: "min-h-11 min-w-11 shrink-0 px-1 sm:px-3", onClick: () => onDateChange(/* @__PURE__ */ new Date()), children: t("appointmentCalendar.today") }),
      /* @__PURE__ */ jsx12("label", { className: "sr-only", htmlFor: "appointment-calendar-mode", children: t("appointmentCalendar.period") }),
      /* @__PURE__ */ jsxs7("select", { id: "appointment-calendar-mode", className: "min-h-11 rounded-md border border-neutral-500 bg-white px-1 sm:px-2 text-sm max-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", value: mode, onChange: (event) => {
        explicitMode.current = true;
        setMode(event.target.value);
      }, children: [
        /* @__PURE__ */ jsx12("option", { value: "day", children: t("appointmentCalendar.day") }),
        /* @__PURE__ */ jsx12("option", { value: "week", children: t("appointmentCalendar.week") })
      ] }),
      /* @__PURE__ */ jsx12("label", { className: "sr-only", htmlFor: "appointment-calendar-date", children: t("appointmentCalendar.chooseDate") }),
      /* @__PURE__ */ jsx12("input", { id: "appointment-calendar-date", "aria-label": t("appointmentCalendar.chooseDate"), type: "date", className: "min-h-11 min-w-[7rem] flex-1 max-w-36 rounded-md border border-neutral-500 bg-white px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", value: localDateKey(date), onChange: (event) => {
        const [year, month, day2] = event.target.value.split("-").map(Number);
        if (year > 0 && month > 0 && day2 > 0) {
          const next = new Date(year, month - 1, day2);
          if (Number.isFinite(next.getTime())) onDateChange(next);
        }
      } })
    ] }),
    filters,
    /* @__PURE__ */ jsx12("div", { className: "flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700", children: ["confirmed", "pending", "cancelled"].map((status) => /* @__PURE__ */ jsxs7("span", { className: "inline-flex items-center gap-1.5", children: [
      /* @__PURE__ */ jsx12("span", { className: `h-2.5 w-2.5 rounded-full ${status === "confirmed" ? "bg-green-600" : status === "pending" ? "bg-amber-500" : "bg-neutral-400"}`, "aria-hidden": "true" }),
      t(`appointmentCollaboration.status${status[0].toUpperCase()}${status.slice(1)}`)
    ] }, status)) }),
    transition && /* @__PURE__ */ jsx12("p", { role: "note", className: "text-xs text-neutral-600", children: t("appointmentCalendar.dstNote") }),
    loading ? /* @__PURE__ */ jsx12("p", { role: "status", className: "p-4 text-sm", children: t("appointmentAgenda.loading") }) : /* @__PURE__ */ jsxs7(Fragment2, { children: [
      !segments.length && /* @__PURE__ */ jsx12("p", { role: "status", className: "text-sm text-neutral-600", children: t("appointmentCalendar.empty") }),
      /* @__PURE__ */ jsx12("div", { ref: scroll, role: "region", "aria-label": t("appointmentCalendar.schedule"), tabIndex: 0, className: "max-h-[65dvh] overflow-auto rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", "data-testid": "calendar-scroll", "data-calendar-swipe-grid": true, children: /* @__PURE__ */ jsxs7("div", { className: mode === "week" ? "min-w-[840px]" : "min-w-0", dir: "ltr", children: [
        /* @__PURE__ */ jsxs7("div", { className: "sticky top-0 z-20 grid bg-white border-b", style: gridStyle, children: [
          /* @__PURE__ */ jsx12("div", { className: "sticky left-0 bg-white border-r" }),
          days.map((day2) => /* @__PURE__ */ jsx12("button", { type: "button", "data-calendar-swipe-navigation": true, className: `min-h-14 min-w-0 border-r px-1 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${day2.getDay() === 0 || day2.getDay() === 6 ? "bg-neutral-50" : "bg-white"}`, "aria-label": fullDate(day2), "aria-current": localDateKey(day2) === localDateKey(now) ? "date" : void 0, onClick: () => {
            explicitMode.current = true;
            onDateChange(day2);
            setMode("day");
          }, children: /* @__PURE__ */ jsx12("span", { className: localDateKey(day2) === localDateKey(now) ? "inline-block rounded-lg bg-primary text-primary-foreground px-2 py-1" : "inline-block px-2 py-1", children: new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "numeric" }).format(day2) }) }, localDateKey(day2)))
        ] }),
        /* @__PURE__ */ jsxs7("div", { className: "grid", style: gridStyle, children: [
          /* @__PURE__ */ jsx12("div", { className: "sticky left-0 z-10 border-r bg-white text-xs text-neutral-600", style: { height: hours * HOUR_HEIGHT }, "aria-hidden": "true", children: !transition && ticks.map((hour) => /* @__PURE__ */ jsxs7("span", { className: "absolute right-1", style: { top: hour * HOUR_HEIGHT + 2 }, children: [
            String(hour).padStart(2, "0"),
            ":00"
          ] }, hour)) }),
          days.map((day2) => /* @__PURE__ */ jsxs7("div", { className: `relative border-r ${day2.getDay() === 0 || day2.getDay() === 6 ? "bg-neutral-50" : "bg-white"}`, "data-calendar-day": localDateKey(day2), style: { height: hours * HOUR_HEIGHT }, children: [
            ticks.filter((hour) => hour * 60 < calendarDayMinutes(day2)).map((hour) => /* @__PURE__ */ jsxs7("div", { className: "absolute inset-x-0 border-t border-neutral-200 pointer-events-none", style: { top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }, "aria-hidden": "true", children: [
              /* @__PURE__ */ jsx12("div", { className: "absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200" }),
              transition && /* @__PURE__ */ jsx12("span", { className: "bg-white/90 px-1 text-[10px] text-neutral-600", children: new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset" }).format(new Date(day2.getTime() + hour * 36e5)) })
            ] }, hour)),
            segments.filter((segment) => segment.day === localDateKey(day2)).map((segment) => {
              const row = segment.event.rows[0], employee = employees.find((item) => item.id === row.employeeId)?.name;
              const minutes = segment.end - segment.start;
              const statuses = calendarStatus(segment.event), time = `${clock(segment.startsAt)}\u2013${clock(segment.endsAt)}`;
              const label = `${fullDate(segment.startsAt)}, ${time} \xB7 ${row.service.name} \xB7 ${customer(segment.event)}${employee ? ` \xB7 ${employee}` : ""} \xB7 ${statuses}`;
              const style = row.service.serviceType === "group" ? "border-indigo-500 bg-indigo-50 text-indigo-950" : statusClass[row.status ?? ""] ?? statusClass.completed;
              return /* @__PURE__ */ jsx12(
                "button",
                {
                  type: "button",
                  "data-testid": `calendar-event-${row.id}`,
                  "data-calendar-event": true,
                  "data-start": segment.start,
                  "data-end": segment.end,
                  className: `absolute z-[1] scroll-mt-20 flex flex-col items-stretch justify-start overflow-hidden rounded-md border border-s-[3px] px-1.5 text-start text-[0.6875rem] hover:brightness-95 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${minutes < 30 ? "py-0 leading-none" : minutes < 60 ? "py-0 leading-tight" : "py-0.5 leading-tight"} ${style}`,
                  style: { top: segment.start * HOUR_HEIGHT / 60, height: (segment.end - segment.start) * HOUR_HEIGHT / 60, insetInlineStart: `calc(${segment.column / segment.columns * 100}% + 2px)`, width: `calc(${100 / segment.columns}% - 4px)` },
                  title: label,
                  "aria-label": label,
                  onClick: (event) => {
                    trigger.current = event.currentTarget;
                    setSelectedKey(segment.event.key);
                  },
                  children: /* @__PURE__ */ jsxs7("span", { dir: i18n.dir(), className: "block", children: [
                    /* @__PURE__ */ jsx12("span", { className: "block truncate font-semibold", children: row.service.name }),
                    minutes >= 30 && /* @__PURE__ */ jsx12("span", { className: "block truncate", dir: "ltr", children: time }),
                    minutes >= 60 && /* @__PURE__ */ jsxs7(Fragment2, { children: [
                      /* @__PURE__ */ jsxs7("span", { className: "block truncate", children: [
                        customer(segment.event),
                        employee ? ` \xB7 ${employee}` : ""
                      ] }),
                      /* @__PURE__ */ jsx12("span", { className: "block truncate font-medium", children: statuses })
                    ] })
                  ] })
                },
                segment.event.key
              );
            }),
            localDateKey(day2) === localDateKey(now) && /* @__PURE__ */ jsx12("div", { className: "absolute inset-x-0 z-[2] border-t-2 border-primary pointer-events-none", style: { top: (now.getTime() - day2.getTime()) / 6e4 * HOUR_HEIGHT / 60 }, "aria-label": t("appointmentCalendar.currentTime", { time: clock(now) }), children: /* @__PURE__ */ jsx12("span", { className: "absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" }) })
          ] }, localDateKey(day2)))
        ] })
      ] }) }),
      /* @__PURE__ */ jsx12("p", { className: "text-xs text-neutral-600", children: t("appointmentCalendar.hint") })
    ] }),
    /* @__PURE__ */ jsx12(Dialog, { open: !!selected, onOpenChange: (open) => {
      if (!open && !updating) setSelectedKey(null);
    }, children: selected && /* @__PURE__ */ jsxs7(DialogContent, { closeDisabled: updating, closeLabel: t("appointmentCalendar.close"), className: "max-h-[85dvh] overflow-y-auto w-[calc(100%_-_1rem)] max-w-2xl rounded-xl p-3 sm:p-5", onCloseAutoFocus: (event) => {
      event.preventDefault();
      requestAnimationFrame(() => {
        if (trigger.current?.isConnected) trigger.current.focus();
        else navigation.current?.focus();
      });
    }, children: [
      /* @__PURE__ */ jsxs7(DialogHeader, { className: "pe-8", children: [
        /* @__PURE__ */ jsx12(DialogTitle, { children: t("appointmentCalendar.details") }),
        /* @__PURE__ */ jsx12(DialogDescription, { children: t("appointmentCalendar.detailsHelp") })
      ] }),
      renderDetails(selected)
    ] }) })
  ] });
}
var HOUR_HEIGHT, clock, statusClass;
var init_appointment_calendar2 = __esm({
  "client/src/components/provider/appointment-calendar.tsx"() {
    "use strict";
    init_appointment_calendar();
    init_button();
    init_dialog();
    init_use_calendar_swipe();
    HOUR_HEIGHT = 64;
    clock = (date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
    statusClass = {
      confirmed: "border-green-600 bg-green-50 text-green-950",
      pending: "border-amber-500 bg-amber-50 text-amber-950",
      completed: "border-neutral-400 bg-neutral-100 text-neutral-800",
      cancelled: "border-neutral-400 bg-neutral-100 text-neutral-600"
    };
  }
});

// client/src/components/appointment-agenda.tsx
import { useState as useState5 } from "react";
import { useTranslation as useTranslation6 } from "react-i18next";
import { format } from "date-fns";
import { CalendarDays as CalendarDays2, ChevronDown as ChevronDown2, ChevronUp, Clock as Clock2 } from "lucide-react";
import { jsx as jsx13, jsxs as jsxs8 } from "react/jsx-runtime";
function AgendaFilterSelect({ selectedLabel, ...props }) {
  const style = cn(buttonVariants({ variant: "outline", size: "sm" }), "min-w-0 max-w-full appearance-none pe-9 text-start hover:bg-background hover:text-foreground [&_option]:bg-background [&_option]:text-foreground", props.className);
  return /* @__PURE__ */ jsxs8("div", { className: "relative min-w-0 max-w-full", children: [
    selectedLabel !== void 0 && /* @__PURE__ */ jsx13("span", { "aria-hidden": "true", className: cn(style, "invisible"), children: selectedLabel }),
    /* @__PURE__ */ jsx13("select", { ...props, className: cn(style, selectedLabel !== void 0 && "absolute inset-0 w-full") }),
    /* @__PURE__ */ jsx13(ChevronDown2, { className: "pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2", "aria-hidden": "true" })
  ] });
}
function AppointmentAgenda({ bookings, employees = [], provider = false, loading = false, fixedView, renderCustomerActions, renderBookingDetails, renderEventDetails, ...controls }) {
  const { t, i18n } = useTranslation6();
  const [selectedView, setView] = useState5("upcoming"), [date, setDate] = useState5(/* @__PURE__ */ new Date());
  const view = fixedView ?? selectedView;
  const [employeeId, setEmployeeId] = useState5("all"), [status, setStatus] = useState5("all"), [expanded, setExpanded] = useState5(() => /* @__PURE__ */ new Set());
  const now = Date.now(), selectedDay = format(date, "yyyy-MM-dd");
  const filtered = bookings.filter((row) => employeeId === "all" || String(row.employeeId) === employeeId);
  const matches = (row) => {
    if (status !== "all" && row.status !== status) return false;
    const start = new Date(row.scheduledDate);
    if (view === "date") return format(start, "yyyy-MM-dd") === selectedDay;
    if (view === "past") return start.getTime() < now || row.status === "cancelled" || row.status === "completed";
    return start.getTime() >= now && (row.status === "pending" || row.status === "confirmed");
  };
  const events = /* @__PURE__ */ new Map();
  for (const row of filtered) {
    const key = provider ? appointmentEventKey(row) : `booking:${row.id}`;
    events.set(key, [...events.get(key) ?? [], row]);
  }
  const displayed = Array.from(events).filter(([, rows]) => rows.some(matches)).sort((a, b) => (view === "past" ? -1 : 1) * (new Date(a[1][0].scheduledDate).getTime() - new Date(b[1][0].scheduledDate).getTime()));
  const toggle = (key) => setExpanded((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const time = (row) => `${format(new Date(row.scheduledDate), "HH:mm")}\u2013${format(new Date(new Date(row.scheduledDate).getTime() + (row.bookingDuration ?? row.service.duration) * 6e4), "HH:mm")}`;
  const dateLabel = (value) => new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(value);
  const dateAndTime = (row) => /* @__PURE__ */ jsxs8("div", { className: "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm font-medium text-neutral-700", "data-testid": "appointment-date-time", children: [
    /* @__PURE__ */ jsxs8("span", { className: "inline-flex min-w-0 items-center gap-2", children: [
      /* @__PURE__ */ jsx13(CalendarDays2, { className: "w-4 h-4 shrink-0", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx13("time", { dateTime: new Date(row.scheduledDate).toISOString(), children: dateLabel(new Date(row.scheduledDate)) })
    ] }),
    /* @__PURE__ */ jsxs8("span", { className: "inline-flex items-center gap-2 whitespace-nowrap", children: [
      /* @__PURE__ */ jsx13(Clock2, { className: "w-4 h-4 shrink-0", "aria-hidden": "true" }),
      time(row)
    ] })
  ] });
  const employee = (row) => provider ? employees.find((item) => item.id === row.employeeId)?.name : row.employee?.name;
  const name = (row) => [row.seeker.firstName, row.seeker.lastName].filter(Boolean).join(" ") || row.seeker.email || t(prefix2 + "customer");
  const badge = (row) => /* @__PURE__ */ jsx13(Badge, { className: row.status === "pending" ? "bg-amber-50 text-amber-800 border-amber-200" : row.status === "confirmed" ? "bg-green-50 text-green-800 border-green-200" : "bg-neutral-100 text-neutral-600 border-neutral-200", children: row.status ? t(prefix2 + "status" + row.status[0].toUpperCase() + row.status.slice(1)) : "\u2014" });
  const renderEvent = (key, rows, forceOpen = false) => {
    const row = rows[0], group = provider && row.service.serviceType === "group", open = forceOpen || expanded.has(key);
    if (group) {
      const confirmed = rows.filter((item) => item.status === "confirmed" || item.status === "completed").reduce((sum, item) => sum + (item.participantCount ?? 1), 0), pending = rows.filter((item) => item.status === "pending").reduce((sum, item) => sum + (item.participantCount ?? 1), 0);
      return /* @__PURE__ */ jsxs8("article", { className: "border border-indigo-200 bg-white rounded-xl overflow-hidden", "data-testid": `group-event-${row.id}`, children: [
        /* @__PURE__ */ jsxs8("header", { className: "p-4 space-y-3", children: [
          dateAndTime(row),
          /* @__PURE__ */ jsxs8("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
            /* @__PURE__ */ jsxs8("div", { className: "min-w-0 space-y-1", children: [
              /* @__PURE__ */ jsx13("h2", { className: "font-semibold break-words", children: row.service.name }),
              employee(row) && /* @__PURE__ */ jsx13("p", { className: "text-sm text-neutral-600", children: employee(row) }),
              /* @__PURE__ */ jsx13("p", { className: "text-sm", children: t(prefix2 + "bookings", { count: rows.length }) })
            ] }),
            /* @__PURE__ */ jsxs8("div", { className: "flex flex-wrap gap-2 items-center", children: [
              /* @__PURE__ */ jsx13(EventControls, { ...controls, booking: row, rows }),
              !forceOpen && /* @__PURE__ */ jsxs8(Button, { size: "sm", variant: "ghost", "aria-expanded": open, "aria-controls": `event-bookings-${row.id}`, onClick: () => toggle(key), "data-testid": `event-toggle-${row.id}`, children: [
                t(prefix2 + (open ? "hideBookings" : "viewBookings"), { count: rows.length }),
                open ? /* @__PURE__ */ jsx13(ChevronUp, { className: "ms-1 h-4 w-4", "aria-hidden": "true" }) : /* @__PURE__ */ jsx13(ChevronDown2, { className: "ms-1 h-4 w-4", "aria-hidden": "true" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs8("div", { className: "flex flex-wrap gap-2 text-sm", children: [
            /* @__PURE__ */ jsx13(Badge, { className: "bg-green-50 text-green-800 border-green-200", children: t(prefix2 + "confirmedPlaces", { count: confirmed, capacity: row.service.maxCapacity ?? 1 }) }),
            pending > 0 && /* @__PURE__ */ jsx13(Badge, { className: "bg-amber-50 text-amber-800 border-amber-200", children: t(prefix2 + "pendingPlaces", { count: pending }) })
          ] })
        ] }),
        open && renderEventDetails?.(row),
        open && /* @__PURE__ */ jsx13("div", { id: `event-bookings-${row.id}`, className: "divide-y p-3 sm:p-4", children: rows.map((item) => /* @__PURE__ */ jsxs8("section", { "data-testid": `event-booking-${item.id}`, className: "py-3 first:pt-0 last:pb-0 space-y-2 min-w-0", children: [
          /* @__PURE__ */ jsxs8("div", { className: "flex flex-wrap gap-3 justify-between", children: [
            /* @__PURE__ */ jsxs8("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx13("p", { className: "font-semibold break-words", children: name(item) }),
              /* @__PURE__ */ jsxs8("p", { className: "text-sm text-neutral-600", children: [
                t("booking.participants"),
                ": ",
                item.participantCount ?? 1,
                " \xB7 ",
                formatMoney(item.totalAmount, item.currency, i18n.resolvedLanguage || i18n.language) ?? t("currency.unavailable")
              ] })
            ] }),
            badge(item)
          ] }),
          status !== "all" && item.status === status && /* @__PURE__ */ jsx13("p", { className: "text-xs font-medium", children: t(prefix2 + "matching") }),
          /* @__PURE__ */ jsx13(BookingControls, { ...controls, booking: item, group: true }),
          renderBookingDetails?.(item)
        ] }, item.id)) })
      ] }, key);
    }
    return /* @__PURE__ */ jsxs8("article", { className: "border bg-white rounded-xl p-4 space-y-3", "data-testid": `appointment-${row.id}`, children: [
      dateAndTime(row),
      /* @__PURE__ */ jsxs8("div", { className: "grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start", children: [
        /* @__PURE__ */ jsxs8("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx13("p", { className: "font-semibold break-words", children: row.service.name }),
          /* @__PURE__ */ jsx13("p", { className: "text-sm text-neutral-600 break-words", children: provider ? name(row) : getProviderName(row.provider) }),
          employee(row) && /* @__PURE__ */ jsx13("p", { className: "text-xs text-neutral-600", children: employee(row) })
        ] }),
        /* @__PURE__ */ jsxs8("div", { className: "flex flex-col items-end gap-1", children: [
          badge(row),
          /* @__PURE__ */ jsx13("p", { className: "font-semibold text-neutral-900", children: formatMoney(row.totalAmount, row.currency, i18n.resolvedLanguage || i18n.language) ?? t("currency.unavailable") })
        ] })
      ] }),
      (row.participantCount ?? 1) > 1 && /* @__PURE__ */ jsxs8("p", { className: "text-sm text-neutral-700", children: [
        row.participantCount,
        " participants"
      ] }),
      provider && /* @__PURE__ */ jsx13(BookingControls, { ...controls, booking: row }),
      !provider && row.review && /* @__PURE__ */ jsx13(BookingReviewSummary, { booking: row }, row.review.id),
      !provider && renderCustomerActions?.(row),
      renderBookingDetails?.(row)
    ] }, key);
  };
  const calendarFilters = provider && view === "calendar";
  const filterGroupClass = calendarFilters ? "flex shrink-0 items-center" : "flex items-center gap-1 min-w-0 max-w-full";
  const filterSelectClass = calendarFilters ? "text-xs sm:text-sm px-2 pe-7" : void 0;
  const selectedStatus = status === "all" ? t("appointmentAgenda.allStatuses") : t(prefix2 + "status" + status[0].toUpperCase() + status.slice(1));
  const selectedEmployee = employeeId === "all" ? t("appointmentAgenda.allEmployees") : employees.find((row) => String(row.id) === employeeId)?.name;
  const filterControls = /* @__PURE__ */ jsxs8("div", { className: calendarFilters ? "min-w-0 space-y-1" : "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", "data-testid": "appointment-filters", children: [
    /* @__PURE__ */ jsxs8("div", { className: calendarFilters ? "flex items-end gap-2 overflow-x-auto pb-1 sm:items-center" : "contents", children: [
      /* @__PURE__ */ jsxs8("div", { className: filterGroupClass, children: [
        /* @__PURE__ */ jsx13(Label, { className: calendarFilters ? "sr-only" : void 0, htmlFor: provider ? "provider-appointment-status" : "seeker-appointment-status", children: t("appointmentAgenda.status") }),
        /* @__PURE__ */ jsxs8(AgendaFilterSelect, { selectedLabel: calendarFilters ? selectedStatus : void 0, className: filterSelectClass, id: provider ? "provider-appointment-status" : "seeker-appointment-status", value: status, onChange: (event) => setStatus(event.target.value), children: [
          /* @__PURE__ */ jsx13("option", { value: "all", children: t("appointmentAgenda.allStatuses") }),
          ["pending", "confirmed", "completed", "cancelled"].map((item) => /* @__PURE__ */ jsx13("option", { value: item, children: t(prefix2 + "status" + item[0].toUpperCase() + item.slice(1)) }, item))
        ] })
      ] }),
      provider && employees.length > 0 && /* @__PURE__ */ jsxs8("div", { className: filterGroupClass, children: [
        /* @__PURE__ */ jsx13(Label, { className: calendarFilters ? "sr-only" : void 0, htmlFor: "appointment-employee", children: t("appointmentAgenda.employee") }),
        /* @__PURE__ */ jsxs8(AgendaFilterSelect, { selectedLabel: calendarFilters ? selectedEmployee : void 0, className: filterSelectClass, id: "appointment-employee", value: employeeId, onChange: (event) => setEmployeeId(event.target.value), children: [
          /* @__PURE__ */ jsx13("option", { value: "all", children: t("appointmentAgenda.allEmployees") }),
          employees.map((row) => /* @__PURE__ */ jsx13("option", { value: row.id, children: row.name }, row.id))
        ] })
      ] })
    ] }),
    !calendarFilters && /* @__PURE__ */ jsx13("p", { className: "text-xs text-neutral-600 sm:ms-auto", children: t("appointmentAgenda.timezone", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) })
  ] });
  return /* @__PURE__ */ jsxs8("section", { className: "space-y-2 sm:space-y-3", "aria-label": t("notifications.appointments"), children: [
    !fixedView && /* @__PURE__ */ jsx13("div", { className: cn("grid gap-1 bg-white border p-1 rounded-xl", provider ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"), role: "group", "aria-label": t("appointmentAgenda.view"), children: (provider ? ["upcoming", "date", "past", "calendar"] : ["upcoming", "date", "past"]).map((item) => /* @__PURE__ */ jsx13(Button, { size: "sm", className: "h-auto min-h-11 whitespace-normal px-2 py-2 text-xs sm:text-sm leading-tight", variant: view === item ? "default" : "ghost", "aria-pressed": view === item, onClick: () => setView(item), children: t(`appointmentAgenda.${item}`) }, item)) }),
    view !== "calendar" && filterControls,
    view === "calendar" && provider ? /* @__PURE__ */ jsx13(
      AppointmentCalendar,
      {
        date,
        onDateChange: setDate,
        loading,
        employees,
        filters: filterControls,
        updating: controls.updating,
        events: Array.from(events).filter(([, rows]) => status === "all" || rows.some((row) => row.status === status)).map(([key, rows]) => ({ key, rows })),
        renderDetails: (event) => renderEvent(event.key, event.rows, true)
      }
    ) : /* @__PURE__ */ jsxs8("div", { className: view === "date" ? "grid lg:grid-cols-[auto_1fr] gap-3 items-start" : "", children: [
      view === "date" && /* @__PURE__ */ jsx13(Calendar, { mode: "single", weekStartsOn: 1, selected: date, onSelect: (value) => {
        if (value) setDate(value);
      }, modifiers: { booked: filtered.map((row) => new Date(row.scheduledDate)) }, modifiersClassNames: { booked: "font-bold underline decoration-primary underline-offset-4" }, className: "border bg-white rounded-xl h-fit w-fit max-w-full mx-auto p-1 sm:p-3" }),
      /* @__PURE__ */ jsx13("div", { className: "min-w-0 space-y-3", children: loading ? /* @__PURE__ */ jsx13("p", { role: "status", className: "text-sm text-neutral-600 rounded-xl border bg-white p-4", children: t("appointmentAgenda.loading") }) : !displayed.length ? /* @__PURE__ */ jsx13("p", { className: "text-sm text-neutral-600 rounded-xl border bg-white p-4", children: view === "date" ? t("appointmentAgenda.emptyDate", { date: dateLabel(date) }) : t("appointmentAgenda.empty") }) : displayed.map(([key, rows]) => renderEvent(key, rows)) })
    ] })
  ] });
}
var prefix2;
var init_appointment_agenda = __esm({
  "client/src/components/appointment-agenda.tsx"() {
    "use strict";
    init_money();
    init_appointment_collaboration();
    init_provider();
    init_calendar();
    init_button();
    init_badge();
    init_label();
    init_booking_review();
    init_booking_controls();
    init_utils();
    init_appointment_calendar2();
    prefix2 = "appointmentCollaboration.";
  }
});

// shared/scheduling.ts
function validTimezone(value) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
function validDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function parts(value, zone) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    formatters.set(zone, formatter);
  }
  return Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
}
function dateInZone(value, zone) {
  const p = parts(value, zone);
  return `${p.year}-${p.month}-${p.day}`;
}
function scheduleDate(schedule) {
  return schedule.specificDate ? new Date(schedule.specificDate).toISOString().slice(0, 10) : null;
}
function workingRanges(schedule) {
  let ranges = [{ startTime: schedule.startTime, endTime: schedule.endTime }].filter((range) => range.startTime < range.endTime);
  for (const pause of schedule.breaks || []) {
    ranges = ranges.flatMap((range) => {
      if (pause.endTime <= range.startTime || pause.startTime >= range.endTime) return [range];
      return [
        { startTime: range.startTime, endTime: pause.startTime < range.endTime ? pause.startTime : range.endTime },
        { startTime: pause.endTime > range.startTime ? pause.endTime : range.startTime, endTime: range.endTime }
      ].filter((item) => item.startTime < item.endTime);
    });
  }
  return ranges;
}
var formatters;
var init_scheduling = __esm({
  "shared/scheduling.ts"() {
    "use strict";
    formatters = /* @__PURE__ */ new Map();
  }
});

// client/src/components/booking-time-picker.tsx
import { useEffect as useEffect4, useState as useState6 } from "react";
import { useQuery as useQuery4 } from "@tanstack/react-query";
import { addMonths, format as format2, startOfMonth } from "date-fns";
import { useTranslation as useTranslation7 } from "react-i18next";
import { Clock as Clock3, Loader2 } from "lucide-react";
import { Fragment as Fragment3, jsx as jsx14, jsxs as jsxs9 } from "react/jsx-runtime";
function BookingTimePicker({ serviceId, bookingId, selected, onSelect }) {
  const { t, i18n } = useTranslation7();
  const language = i18n.resolvedLanguage || i18n.language;
  const [timezone2, setTimezone] = useState6(selected?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = dateInZone(/* @__PURE__ */ new Date(), timezone2);
  const [date, setDate] = useState6(() => selected ? /* @__PURE__ */ new Date(dateInZone(new Date(selected.startsAt), timezone2) + "T12:00:00") : void 0);
  const [month, setMonth] = useState6(() => startOfMonth(date || /* @__PURE__ */ new Date(today + "T12:00:00")));
  const dateKey = date ? format2(date, "yyyy-MM-dd") : "";
  const zones = Array.from(/* @__PURE__ */ new Set([timezone2, Intl.DateTimeFormat().resolvedOptions().timeZone, "Europe/Riga", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC"]));
  const monthQuery = useQuery4({
    queryKey: ["/api/availability/month", serviceId, format2(month, "yyyy-MM"), timezone2, bookingId ?? null],
    queryFn: async ({ signal }) => (await apiRequest("GET", `${bookingId ? `/api/bookings/${bookingId}/available-times` : `/api/availability/month/${serviceId}`}?month=${format2(month, "yyyy-MM")}&timezone=${encodeURIComponent(timezone2)}`, void 0, signal)).json(),
    staleTime: 3e4
  });
  const slotsQuery = useQuery4({
    queryKey: ["/api/availability/slots", serviceId, dateKey, timezone2, bookingId ?? null],
    queryFn: async ({ signal }) => (await apiRequest("GET", `${bookingId ? `/api/bookings/${bookingId}/available-times` : `/api/availability/slots/${serviceId}`}?date=${dateKey}&timezone=${encodeURIComponent(timezone2)}`, void 0, signal)).json(),
    enabled: Boolean(dateKey),
    staleTime: 0
  });
  useEffect4(() => {
    if (!selected || !slotsQuery.data) return;
    const current = slotsQuery.data.slots.find((slot) => slot.startsAt === selected.startsAt);
    if (!current) onSelect(null);
    else if (current.availableCapacity !== selected.availableCapacity) onSelect(current);
  }, [slotsQuery.data, selected, onSelect]);
  const available = new Set(monthQuery.data?.days.filter((day2) => day2.availableSlots > 0).map((day2) => day2.date));
  const dateLabel = (value) => new Intl.DateTimeFormat(language, { calendar: "gregory", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value);
  return /* @__PURE__ */ jsxs9("div", { className: "space-y-4 min-w-0", dir: i18n.dir(), children: [
    /* @__PURE__ */ jsxs9("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [
      /* @__PURE__ */ jsx14("h3", { className: "font-semibold", children: t("bookingForm.chooseDateTime") }),
      /* @__PURE__ */ jsxs9("div", { className: "space-y-2 min-w-0", children: [
        /* @__PURE__ */ jsx14(Label, { htmlFor: "booking-timezone", children: t("bookingForm.timezone") }),
        /* @__PURE__ */ jsx14("select", { id: "booking-timezone", className: "border rounded-md p-2 min-h-11 w-full max-w-full bg-background", value: timezone2, dir: "ltr", onChange: (event) => {
          setTimezone(event.target.value);
          setDate(void 0);
          onSelect(null);
          setMonth(startOfMonth(/* @__PURE__ */ new Date(dateInZone(/* @__PURE__ */ new Date(), event.target.value) + "T12:00:00")));
        }, children: zones.map((zone) => /* @__PURE__ */ jsx14("option", { value: zone, children: zone.replaceAll("_", " ") }, zone)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs9("div", { className: "grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5", children: [
      /* @__PURE__ */ jsxs9("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx14(
          Calendar,
          {
            mode: "single",
            dir: i18n.dir(),
            weekStartsOn: 1,
            month,
            labels: { labelPrevious: () => t("bookingForm.previousMonth"), labelNext: () => t("bookingForm.nextMonth"), labelWeekday: (value) => new Intl.DateTimeFormat(language, { weekday: "long" }).format(value) },
            formatters: {
              formatCaption: (value) => new Intl.DateTimeFormat(language, { calendar: "gregory", month: "long", year: "numeric" }).format(value),
              formatDay: (value) => new Intl.NumberFormat(language).format(value.getDate()),
              formatWeekdayName: (value) => new Intl.DateTimeFormat(language, { weekday: "narrow" }).format(value)
            },
            onMonthChange: (value) => {
              setMonth(value);
              setDate(void 0);
              onSelect(null);
            },
            selected: date,
            onSelect: (value) => {
              setDate(value);
              onSelect(null);
            },
            fromMonth: startOfMonth(/* @__PURE__ */ new Date(today + "T12:00:00")),
            toMonth: addMonths(/* @__PURE__ */ new Date(), 6),
            disabled: (value) => format2(value, "yyyy-MM-dd") < today || monthQuery.isPending || monthQuery.isError || !available.has(format2(value, "yyyy-MM-dd")),
            className: "border rounded-xl w-full",
            classNames: {
              months: "w-full",
              month: "w-full space-y-4",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "flex-1 min-w-0 text-muted-foreground font-normal text-xs",
              row: "flex w-full mt-2",
              cell: "relative flex-1 min-w-0 text-center text-sm p-0",
              day: "inline-flex items-center justify-center rounded-md h-10 w-full min-w-0 p-0 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              nav_button: "h-10 w-10 inline-flex items-center justify-center rounded-md border bg-background focus-visible:outline focus-visible:outline-2",
              nav_button_previous: "absolute start-1",
              nav_button_next: "absolute end-1"
            }
          }
        ),
        monthQuery.isFetching && /* @__PURE__ */ jsxs9("p", { role: "status", className: "text-sm text-muted-foreground mt-2 flex items-center justify-center gap-2", children: [
          /* @__PURE__ */ jsx14(Loader2, { className: "w-4 h-4 animate-spin motion-reduce:animate-none shrink-0", "aria-hidden": "true" }),
          t("bookingForm.checkingDates")
        ] }),
        monthQuery.isError && /* @__PURE__ */ jsxs9("div", { role: "alert", className: "mt-2 text-sm text-red-700 dark:text-red-300", children: [
          t("bookingForm.datesError"),
          " ",
          /* @__PURE__ */ jsx14(Button, { type: "button", className: "min-h-11 h-auto whitespace-normal", variant: "ghost", onClick: () => void monthQuery.refetch(), children: t("publicSearch.retry") })
        ] }),
        monthQuery.isSuccess && !available.size && /* @__PURE__ */ jsx14("p", { className: "text-sm text-muted-foreground mt-2", children: t("bookingForm.monthEmpty") })
      ] }),
      /* @__PURE__ */ jsxs9("div", { className: "min-w-0", children: [
        !date && /* @__PURE__ */ jsx14("p", { className: "text-muted-foreground text-sm py-4", children: t("bookingForm.chooseHighlighted") }),
        date && /* @__PURE__ */ jsxs9(Fragment3, { children: [
          /* @__PURE__ */ jsx14("p", { className: "font-medium mb-3", children: dateLabel(date) }),
          slotsQuery.isFetching && /* @__PURE__ */ jsxs9("p", { role: "status", className: "flex gap-2 text-sm text-muted-foreground", children: [
            /* @__PURE__ */ jsx14(Loader2, { className: "w-4 h-4 animate-spin motion-reduce:animate-none shrink-0", "aria-hidden": "true" }),
            t("bookingForm.checkingTimes")
          ] }),
          slotsQuery.isError && /* @__PURE__ */ jsxs9("div", { role: "alert", className: "text-sm text-red-700 dark:text-red-300", children: [
            t("bookingForm.timesError"),
            " ",
            /* @__PURE__ */ jsx14(Button, { type: "button", variant: "ghost", className: "min-h-11 h-auto whitespace-normal", onClick: () => void slotsQuery.refetch(), children: t("publicSearch.retry") })
          ] }),
          slotsQuery.isSuccess && !slotsQuery.data.slots.length && /* @__PURE__ */ jsx14("p", { className: "text-sm text-muted-foreground", children: t("bookingForm.dateEmpty") }),
          /* @__PURE__ */ jsx14("div", { className: "grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pe-1", children: !slotsQuery.isFetching && !slotsQuery.isError && slotsQuery.data?.slots.map((slot) => /* @__PURE__ */ jsxs9(Button, { type: "button", className: "min-h-11 h-auto whitespace-normal", variant: selected?.startsAt === slot.startsAt ? "default" : "outline", "aria-pressed": selected?.startsAt === slot.startsAt, onClick: () => onSelect(slot), children: [
            /* @__PURE__ */ jsx14(Clock3, { className: "w-3 h-3 shrink-0", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx14("bdi", { children: slot.startTime }),
            slotsQuery.data.slots.filter((other) => other.startTime === slot.startTime).length > 1 && /* @__PURE__ */ jsx14("span", { className: "text-xs", children: /* @__PURE__ */ jsx14("bdi", { children: formatDateTime24(slot.startsAt, language, { timeZone: timezone2, timeZoneName: "short", hour: "2-digit", minute: "2-digit" }) }) })
          ] }, slot.startsAt)) })
        ] })
      ] })
    ] }),
    selected && /* @__PURE__ */ jsxs9("p", { role: "status", className: "text-sm rounded-lg bg-muted p-3", children: [
      new Intl.DateTimeFormat(language, { timeZone: selected.timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date(selected.startsAt)),
      " \xB7 ",
      /* @__PURE__ */ jsxs9("bdi", { children: [
        selected.startTime,
        "\u2013",
        selected.endTime
      ] }),
      " \xB7 ",
      /* @__PURE__ */ jsx14("bdi", { children: selected.timezone })
    ] })
  ] });
}
var init_booking_time_picker = __esm({
  "client/src/components/booking-time-picker.tsx"() {
    "use strict";
    init_queryClient();
    init_date_time();
    init_scheduling();
    init_calendar();
    init_button();
    init_label();
  }
});

// client/src/components/booking-message-privacy.tsx
import { useTranslation as useTranslation8 } from "react-i18next";
import { jsx as jsx15, jsxs as jsxs10 } from "react/jsx-runtime";
function BookingMessagePrivacy() {
  const { t } = useTranslation8();
  return /* @__PURE__ */ jsxs10("details", { className: "text-sm text-foreground", "data-booking-message-privacy": true, children: [
    /* @__PURE__ */ jsx15("summary", { className: "min-h-6 cursor-pointer rounded-sm py-1 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", children: t("appointmentCollaboration.privacyDetails") }),
    /* @__PURE__ */ jsxs10("div", { className: "space-y-2 pt-2", children: [
      /* @__PURE__ */ jsx15("p", { children: t("appointmentCollaboration.privacy") }),
      /* @__PURE__ */ jsx15("p", { children: t("appointmentCollaboration.retentionNotice") }),
      /* @__PURE__ */ jsx15("a", { href: "/privacy-policy.html#booking-messages", target: "_blank", rel: "noopener noreferrer", tabIndex: 0, className: "inline-block min-h-6 rounded-sm py-1 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", children: t("legal.privacyPolicyNewTab") })
    ] })
  ] });
}
var init_booking_message_privacy = __esm({
  "client/src/components/booking-message-privacy.tsx"() {
    "use strict";
  }
});

// client/src/components/ui/textarea.tsx
import * as React7 from "react";
import { jsx as jsx16 } from "react/jsx-runtime";
var Textarea;
var init_textarea = __esm({
  "client/src/components/ui/textarea.tsx"() {
    "use strict";
    init_utils();
    Textarea = React7.forwardRef(({ className, ...props }, ref) => {
      return /* @__PURE__ */ jsx16(
        "textarea",
        {
          className: cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          ),
          ref,
          ...props
        }
      );
    });
    Textarea.displayName = "Textarea";
  }
});

// shared/wishlist.ts
import { z as z3 } from "zod";
var positiveServiceId, wishlistPageSchema, inboxScopeSchema, messageReadSchema, notificationReadSchema;
var init_wishlist = __esm({
  "shared/wishlist.ts"() {
    "use strict";
    positiveServiceId = z3.string().regex(/^[1-9]\d{0,9}$/).refine((value) => Number(value) <= 2147483647).transform(Number);
    wishlistPageSchema = z3.object({ cursor: z3.string().max(300).optional(), limit: z3.coerce.number().int().min(1).max(50).default(24) }).strict();
    inboxScopeSchema = z3.object({ scope: z3.enum(["customer", "provider", "all"]), companyId: positiveServiceId.optional() }).strict();
    messageReadSchema = z3.object({ messageIds: z3.array(z3.string().uuid()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length) }).strict();
    notificationReadSchema = z3.object({ items: z3.array(z3.object({ id: z3.string().uuid(), revision: z3.number().int().positive() }).strict()).min(1).max(100).refine((items) => new Set(items.map((item) => item.id)).size === items.length) }).strict();
  }
});

// client/src/components/wishlist-provider.tsx
import { createContext, useContext, useEffect as useEffect5, useMemo as useMemo2, useRef as useRef5, useState as useState7 } from "react";
import { useQuery as useQuery5, useQueryClient as useQueryClient3 } from "@tanstack/react-query";
import { Link as Link2 } from "wouter";
import { useTranslation as useTranslation9 } from "react-i18next";
import { jsx as jsx17, jsxs as jsxs11 } from "react/jsx-runtime";
function useWishlist(serviceId) {
  const state = useContext(WishlistContext);
  useEffect5(() => {
    if (serviceId && state) return state.register(serviceId);
  }, [serviceId, state?.register]);
  return state;
}
var WishlistContext;
var init_wishlist_provider = __esm({
  "client/src/components/wishlist-provider.tsx"() {
    "use strict";
    init_wishlist();
    init_useAuth();
    init_queryClient();
    init_button();
    init_dialog();
    WishlistContext = createContext(null);
  }
});

// client/src/hooks/use-inbox.ts
import { useEffect as useEffect6, useState as useState8 } from "react";
import { useLocation as useLocation3, useSearch } from "wouter";
import { useQuery as useQuery6 } from "@tanstack/react-query";
function inboxQuery(scope) {
  const query = new URLSearchParams({ scope: scope.scope });
  if (scope.scope !== "customer" && scope.companyId) query.set("companyId", String(scope.companyId));
  return query.toString();
}
function useInboxScope(viewer2) {
  const { user: user2, isLoading, isError } = useAuth();
  const [location2] = useLocation3();
  const search = useSearch();
  const parameters = new URLSearchParams(search);
  const requestedScope = location2 === "/inbox" ? parameters.get("scope") : null;
  const invalidScope = !viewer2 && requestedScope !== null && !["customer", "provider", "all"].includes(requestedScope);
  const kind = viewer2 ?? (location2 === "/inbox" ? requestedScope === "customer" || requestedScope === "provider" ? requestedScope : "all" : location2.startsWith("/my-services") ? "provider" : "customer");
  const needsContext = kind !== "customer";
  const context2 = useQuery6({ queryKey: ["/api/company/context"], enabled: !!user2 && needsContext, retry: false });
  const scope = { scope: kind, ...needsContext && context2.data?.company ? { companyId: context2.data.company.id } : {} };
  const ready = !!user2 && !isLoading && !isError && (!needsContext || context2.isSuccess && !context2.data.invalid);
  const requestedCompany = !viewer2 && location2 === "/inbox" ? parameters.get("companyId") : null;
  const mismatched = invalidScope || requestedCompany !== null && (!needsContext || requestedCompany !== String(scope.companyId));
  return {
    scope,
    query: inboxQuery(scope),
    ready: ready && !mismatched,
    denied: mismatched || needsContext && (context2.isError || !!context2.data?.invalid),
    userId: user2?.id ?? null,
    canSend: kind === "customer" || !!context2.data?.permissions.manageBookings,
    label: needsContext ? context2.data?.company?.name : void 0
  };
}
var init_use_inbox = __esm({
  "client/src/hooks/use-inbox.ts"() {
    "use strict";
    init_useAuth();
  }
});

// client/src/components/conversation-read-state.tsx
import { useEffect as useEffect7, useRef as useRef6, useState as useState9 } from "react";
import { useQueryClient as useQueryClient4 } from "@tanstack/react-query";
import { useTranslation as useTranslation10 } from "react-i18next";
import { jsx as jsx18, jsxs as jsxs12 } from "react/jsx-runtime";
function ConversationReadState({ bookingId, viewer: viewer2, messages, container }) {
  const state = useInboxScope(viewer2), client = useQueryClient4(), { t } = useTranslation10();
  const acknowledged = useRef6(/* @__PURE__ */ new Set()), attempted = useRef6(/* @__PURE__ */ new Set()), failed = useRef6(/* @__PURE__ */ new Set());
  const alive = useRef6(true), [hasFailure, setHasFailure] = useState9(false);
  const ids = messages.filter((message) => message.authorId !== state.userId).map((message) => message.id).join(",");
  useEffect7(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function acknowledge(messageIds) {
    if (!state.ready || !messageIds.length) return;
    for (let index = 0; index < messageIds.length; index += 100) {
      const batch = messageIds.slice(index, index + 100);
      batch.forEach((id) => {
        attempted.current.add(id);
        failed.current.delete(id);
      });
      try {
        await apiRequest("POST", `/api/inbox/messages/${bookingId}/read?${state.query}`, { messageIds: batch });
        batch.forEach((id) => acknowledged.current.add(id));
        if (alive.current) await client.invalidateQueries({ queryKey: ["inbox"] });
      } catch {
        batch.forEach((id) => failed.current.add(id));
      }
    }
    if (alive.current) setHasFailure(failed.current.size > 0);
  }
  useEffect7(() => {
    if (!state.ready || !container.current || !ids) return;
    const root2 = container.current, incoming = new Set(ids.split(","));
    let scheduled;
    const collect = () => {
      if (document.visibilityState === "hidden" || scheduled) return;
      scheduled = setTimeout(() => {
        scheduled = void 0;
        if (!root2.isConnected || document.visibilityState === "hidden") return;
        const bounds = root2.getBoundingClientRect();
        const exposed = Array.from(root2.querySelectorAll("[data-conversation-message]")).filter((element) => {
          const id = element.dataset.conversationMessage, rect = element.getBoundingClientRect();
          return incoming.has(id) && !attempted.current.has(id) && rect.bottom > Math.max(0, bounds.top) + 8 && rect.top < Math.min(innerHeight, bounds.bottom) - 8;
        }).map((element) => element.dataset.conversationMessage);
        void acknowledge(exposed);
      }, 75);
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(collect, { root: root2, threshold: [0, 0.1, 0.5, 1] });
    root2.querySelectorAll("[data-conversation-message]").forEach((element) => observer?.observe(element));
    root2.addEventListener("scroll", collect, { passive: true });
    document.addEventListener("scroll", collect, { capture: true, passive: true });
    window.addEventListener("resize", collect);
    document.addEventListener("visibilitychange", collect);
    collect();
    return () => {
      observer?.disconnect();
      root2.removeEventListener("scroll", collect);
      document.removeEventListener("scroll", collect, true);
      window.removeEventListener("resize", collect);
      document.removeEventListener("visibilitychange", collect);
      if (scheduled) clearTimeout(scheduled);
    };
  }, [bookingId, state.ready, state.query, ids]);
  if (!hasFailure) return null;
  return /* @__PURE__ */ jsxs12("div", { role: "alert", className: "space-y-2", children: [
    /* @__PURE__ */ jsx18("p", { children: t("inbox.readFailed") }),
    /* @__PURE__ */ jsx18(Button, { type: "button", variant: "outline", onClick: () => void acknowledge(Array.from(failed.current).filter((id) => !acknowledged.current.has(id))), children: t("inbox.retry") })
  ] });
}
var init_conversation_read_state = __esm({
  "client/src/components/conversation-read-state.tsx"() {
    "use strict";
    init_use_inbox();
    init_queryClient();
    init_button();
  }
});

// client/src/components/booking-collaboration.tsx
import { useEffect as useEffect8, useRef as useRef7, useState as useState10 } from "react";
import { useInfiniteQuery, useMutation as useMutation3, useQuery as useQuery7, useQueryClient as useQueryClient5 } from "@tanstack/react-query";
import { useTranslation as useTranslation11 } from "react-i18next";
import { Fragment as Fragment4, jsx as jsx19, jsxs as jsxs13 } from "react/jsx-runtime";
function useCollaborationRefresh() {
  const queryClient3 = useQueryClient5();
  return () => Promise.all([
    queryClient3.invalidateQueries({ queryKey: ["booking-collaboration"] }),
    queryClient3.invalidateQueries({ queryKey: ["/api/bookings/provider"] }),
    queryClient3.invalidateQueries({ queryKey: ["/api/bookings/seeker"] }),
    queryClient3.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/availability/") })
  ]);
}
function useMounted() {
  const alive = useRef7(true);
  useEffect8(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
function errorKey(error) {
  return root + (error.message.startsWith("401:") || error.message.startsWith("403:") ? "denied" : error.message.includes("time_unavailable") ? "slotUnavailable" : error.message.startsWith("409:") ? "conflict" : "failed");
}
function appointmentTime(value, language, zone = timezone()) {
  return formatDateTime24(value, language, { dateStyle: "medium", timeStyle: "short", timeZone: zone }) + ` (${zone})`;
}
function CollaborationDialog({ title, description, pending, onClose, restoreFocus, children }) {
  const { t, i18n } = useTranslation11();
  return /* @__PURE__ */ jsx19(Dialog, { open: true, onOpenChange: (open) => {
    if (!open && !pending) onClose();
  }, children: /* @__PURE__ */ jsxs13(
    DialogContent,
    {
      dir: i18n.dir(),
      closeLabel: t(root + "close"),
      closeDisabled: pending,
      className: "max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl p-4 sm:p-6 [overflow-wrap:anywhere]",
      onCloseAutoFocus: (event) => {
        if (restoreFocus) {
          event.preventDefault();
          requestAnimationFrame(restoreFocus);
        }
      },
      onEscapeKeyDown: (event) => {
        if (pending) event.preventDefault();
      },
      onInteractOutside: (event) => {
        if (pending) event.preventDefault();
      },
      children: [
        /* @__PURE__ */ jsxs13(DialogHeader, { className: "text-start sm:text-start", children: [
          /* @__PURE__ */ jsx19(DialogTitle, { children: title }),
          /* @__PURE__ */ jsx19(DialogDescription, { children: description })
        ] }),
        children
      ]
    }
  ) });
}
function BookingConversationDialog({ booking, scope, viewer: viewer2, canSend = true, onClose, restoreFocus }) {
  const { t, i18n } = useTranslation11();
  const queryClient3 = useQueryClient5(), alive = useMounted();
  const wishlist = useWishlist(), historyContainer = useRef7(null);
  const [body, setBody] = useState10("");
  const id = useRef7(crypto.randomUUID());
  const submitting = useRef7(false);
  const messages = useInfiniteQuery({
    queryKey: [...collaborationKey(scope, booking.id), "conversation"],
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => (await apiRequest("GET", `/api/bookings/${booking.id}/conversation${pageParam ? `?before=${encodeURIComponent(String(pageParam))}` : ""}`, void 0, signal)).json(),
    getNextPageParam: (page) => page.nextCursor || void 0,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: 3e4
  });
  const send = useMutation3({
    retry: false,
    mutationFn: async () => (await apiRequest("POST", `/api/bookings/${booking.id}/conversation`, { body: body.trim(), clientRequestId: id.current })).json(),
    onSuccess: async () => {
      if (!alive.current) return;
      setBody("");
      id.current = crypto.randomUUID();
      await queryClient3.invalidateQueries({ queryKey: collaborationKey(scope, booking.id) });
      await queryClient3.invalidateQueries({ queryKey: ["inbox"] });
    },
    onSettled: () => {
      submitting.current = false;
    }
  });
  const denied = [messages.error, send.error].some((error) => error && /^(401|403):/.test(error.message));
  const history2 = denied ? [] : messages.data?.pages.slice().reverse().flatMap((page) => page.messages) ?? [];
  const counterpart = viewer2 === "provider" ? [booking.seeker.firstName, booking.seeker.lastName].filter(Boolean).join(" ") || booking.seeker.email || t(root + "customer") : getProviderName(booking.provider);
  return /* @__PURE__ */ jsxs13(CollaborationDialog, { title: t(root + "conversation"), description: `${booking.service.name} \xB7 #${booking.id} \xB7 ${appointmentTime(booking.scheduledDate, i18n.language)}`, pending: send.isPending, onClose, restoreFocus, children: [
    /* @__PURE__ */ jsxs13("p", { className: "font-semibold", "data-testid": "conversation-counterpart", children: [
      t(root + (viewer2 === "provider" ? "customer" : "provider")),
      ": ",
      /* @__PURE__ */ jsx19("bdi", { children: counterpart })
    ] }),
    /* @__PURE__ */ jsx19(BookingMessagePrivacy, {}),
    messages.isPending && /* @__PURE__ */ jsx19("p", { role: "status", children: t(root + "loading") }),
    messages.isError && /* @__PURE__ */ jsxs13("div", { role: "alert", children: [
      t(root + "loadFailed"),
      " ",
      /* @__PURE__ */ jsx19(Button, { variant: "outline", onClick: () => void messages.refetch(), children: t(root + "retry") })
    ] }),
    messages.hasNextPage && /* @__PURE__ */ jsx19(Button, { variant: "outline", disabled: messages.isFetchingNextPage, onClick: () => void messages.fetchNextPage(), children: t(root + "olderMessages") }),
    /* @__PURE__ */ jsxs13("div", { ref: historyContainer, className: "space-y-3 max-h-[35dvh] overflow-y-auto", "aria-label": t(root + "messages"), children: [
      messages.isSuccess && !denied && !history2.length && /* @__PURE__ */ jsx19("p", { className: "text-sm text-muted-foreground", children: t(root + "emptyMessages") }),
      history2.map((message) => /* @__PURE__ */ jsxs13("article", { "data-conversation-message": message.id, className: `rounded-lg border p-3 space-y-1 ${message.authorRole === "provider" ? "bg-indigo-50" : "bg-neutral-50"}`, children: [
        /* @__PURE__ */ jsxs13("p", { className: "text-sm font-semibold", children: [
          /* @__PURE__ */ jsx19("bdi", { children: message.authorName }),
          " \xB7 ",
          t(root + message.authorRole)
        ] }),
        /* @__PURE__ */ jsx19("p", { dir: "auto", className: "whitespace-pre-wrap [overflow-wrap:anywhere]", children: message.body }),
        /* @__PURE__ */ jsxs13("p", { className: "text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsx19("time", { dateTime: message.createdAt, children: appointmentTime(message.createdAt, i18n.language) }),
          " \xB7 ",
          t(root + "saved")
        ] })
      ] }, message.id))
    ] }),
    wishlist && messages.isSuccess && !denied && /* @__PURE__ */ jsx19(ConversationReadState, { bookingId: booking.id, viewer: viewer2, messages: history2, container: historyContainer }),
    canSend ? /* @__PURE__ */ jsxs13("form", { className: "space-y-3", onSubmit: (event) => {
      event.preventDefault();
      if (!submitting.current && body.trim() && messages.isSuccess) {
        submitting.current = true;
        send.mutate();
      }
    }, children: [
      /* @__PURE__ */ jsx19(Label, { htmlFor: "booking-message-body", children: t(root + "message") }),
      /* @__PURE__ */ jsx19(Textarea, { id: "booking-message-body", dir: "auto", maxLength: 4e3, value: body, placeholder: t(root + "writeMessage"), disabled: send.isPending || denied, onChange: (event) => {
        setBody(event.target.value);
        if (send.isError) {
          id.current = crypto.randomUUID();
          send.reset();
        }
      }, className: "min-h-24" }),
      send.isError && /* @__PURE__ */ jsx19("p", { role: "alert", className: "text-red-700", children: t(errorKey(send.error)) }),
      /* @__PURE__ */ jsxs13("div", { className: "flex flex-wrap justify-end gap-2", children: [
        /* @__PURE__ */ jsx19(Button, { type: "button", variant: "outline", disabled: send.isPending, onClick: onClose, children: t(root + "close") }),
        /* @__PURE__ */ jsx19(Button, { type: "submit", disabled: !body.trim() || send.isPending || !messages.isSuccess || denied, children: send.isPending ? t(root + "loading") : t(root + "send") })
      ] })
    ] }) : /* @__PURE__ */ jsx19("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx19(Button, { type: "button", variant: "outline", onClick: onClose, children: t(root + "close") }) })
  ] });
}
function RescheduleFields({ booking, slot, onSlot, fallback, onFallback, note, onNote, disabled }) {
  const { t, i18n } = useTranslation11();
  return /* @__PURE__ */ jsxs13("fieldset", { disabled, className: "space-y-4 min-w-0", children: [
    /* @__PURE__ */ jsxs13("p", { className: "rounded-lg bg-neutral-50 p-3 text-sm", children: [
      /* @__PURE__ */ jsxs13("strong", { children: [
        t(root + "currentTime"),
        ": "
      ] }),
      appointmentTime(booking.scheduledDate, i18n.language)
    ] }),
    /* @__PURE__ */ jsx19(BookingTimePicker, { serviceId: booking.serviceId, bookingId: booking.id, selected: slot, onSelect: onSlot }),
    slot && /* @__PURE__ */ jsxs13("p", { className: "text-sm", children: [
      /* @__PURE__ */ jsxs13("strong", { children: [
        t(root + "proposedTime"),
        ": "
      ] }),
      appointmentTime(slot.startsAt, i18n.language, slot.timezone)
    ] }),
    /* @__PURE__ */ jsxs13("fieldset", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx19("legend", { className: "font-semibold mb-2", children: t(root + "fallbackLabel") }),
      ["keep_original", "cancel_booking"].map((value) => /* @__PURE__ */ jsxs13("label", { className: `flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${fallback === value ? "border-indigo-500 bg-indigo-50" : ""}`, children: [
        /* @__PURE__ */ jsx19("input", { type: "radio", name: "reschedule-fallback", value, checked: fallback === value, onChange: () => onFallback(value), className: "mt-1" }),
        /* @__PURE__ */ jsxs13("span", { className: "space-y-1", children: [
          /* @__PURE__ */ jsx19("strong", { className: "block", children: t(root + (value === "keep_original" ? "keepOriginal" : "cancelOriginal")) }),
          /* @__PURE__ */ jsx19("span", { className: "block text-sm", children: t(root + (value === "keep_original" ? "keepHelp" : "cancelHelp")) }),
          /* @__PURE__ */ jsx19("span", { className: "block text-sm", children: t(root + (value === "keep_original" ? "keepConsequences" : "cancelConsequences")) })
        ] })
      ] }, value))
    ] }),
    /* @__PURE__ */ jsx19("p", { className: "text-sm rounded-lg bg-indigo-50 p-3", children: t(root + "noResponse") }),
    /* @__PURE__ */ jsx19("p", { className: "text-sm", children: t(root + "availability") }),
    /* @__PURE__ */ jsx19(Label, { htmlFor: "reschedule-note", children: t(root + "reason") }),
    /* @__PURE__ */ jsx19(Textarea, { id: "reschedule-note", dir: "auto", maxLength: 2e3, value: note, onChange: (event) => onNote(event.target.value) })
  ] });
}
function RescheduleRequestDialog({ booking, onClose, restoreFocus }) {
  const { t } = useTranslation11(), refresh = useCollaborationRefresh(), alive = useMounted();
  const { toast: toast2 } = useToast();
  const [slot, setSlot] = useState10(null), [fallback, setFallback] = useState10("keep_original"), [note, setNote] = useState10("");
  const id = useRef7(crypto.randomUUID()), submitting = useRef7(false);
  const send = useMutation3({
    retry: false,
    mutationFn: async () => (await apiRequest("POST", `/api/bookings/${booking.id}/reschedule-requests`, { scheduledDate: slot?.startsAt, fallback, note, timeZone: slot?.timezone || timezone(), clientRequestId: id.current })).json(),
    onSuccess: async () => {
      await refresh();
      if (alive.current) {
        toast2({ title: t(root + "requestSent") });
        onClose();
      }
    },
    onError: async (error) => {
      if (alive.current && error.message.includes("time_unavailable")) {
        setSlot(null);
        await refresh();
      }
    },
    onSettled: () => {
      submitting.current = false;
    }
  });
  return /* @__PURE__ */ jsxs13(CollaborationDialog, { title: t(root + "requestTitle"), description: t(root + "requestHelp"), pending: send.isPending, onClose, restoreFocus, children: [
    /* @__PURE__ */ jsx19("p", { className: "font-medium", children: booking.service.name }),
    /* @__PURE__ */ jsx19(RescheduleFields, { booking, slot, onSlot: (value) => {
      setSlot(value);
      if (send.isError) {
        id.current = crypto.randomUUID();
        send.reset();
      }
    }, fallback, onFallback: (value) => {
      setFallback(value);
      if (send.isError) {
        id.current = crypto.randomUUID();
        send.reset();
      }
    }, note, onNote: (value) => {
      setNote(value);
      if (send.isError) {
        id.current = crypto.randomUUID();
        send.reset();
      }
    }, disabled: send.isPending }),
    send.isError && /* @__PURE__ */ jsx19("p", { role: "alert", className: "text-red-700", children: t(errorKey(send.error)) }),
    /* @__PURE__ */ jsxs13("div", { className: "flex flex-wrap justify-end gap-2", children: [
      /* @__PURE__ */ jsx19(Button, { variant: "outline", disabled: send.isPending, onClick: onClose, children: t(root + "cancel") }),
      /* @__PURE__ */ jsx19(Button, { disabled: !slot || send.isPending, onClick: () => {
        if (!submitting.current) {
          submitting.current = true;
          send.mutate();
        }
      }, children: send.isPending ? t(root + "loading") : t(root + "sendRequest") })
    ] })
  ] });
}
function BookingRescheduleRequests({ booking, scope }) {
  const { t, i18n } = useTranslation11(), refresh = useCollaborationRefresh();
  const [confirm, setConfirm] = useState10(null);
  const [success, setSuccess] = useState10(false);
  const requests2 = useQuery7({
    queryKey: [...collaborationKey(scope, booking.id), "requests"],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/bookings/${booking.id}/reschedule-requests`, void 0, signal)).json(),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 3e4
  });
  const change = useMutation3({
    retry: false,
    mutationFn: async ({ request, decision }) => (await apiRequest("POST", `/api/bookings/${booking.id}/reschedule-requests/${request.id}/${decision === "withdraw" ? "withdraw" : "respond"}`, decision === "withdraw" ? {} : { decision })).json(),
    onSuccess: async () => {
      setConfirm(null);
      setSuccess(true);
      await refresh();
    }
  });
  const pending = requests2.data?.requests.find((request) => request.state === "pending");
  if (requests2.isError) return /* @__PURE__ */ jsxs13("p", { role: "status", className: "text-sm", children: [
    t(root + "loadFailed"),
    " ",
    /* @__PURE__ */ jsx19(Button, { variant: "ghost", onClick: () => void requests2.refetch(), children: t(root + "retry") })
  ] });
  if (!pending) return /* @__PURE__ */ jsxs13(Fragment4, { children: [
    success && /* @__PURE__ */ jsx19("p", { role: "status", className: "text-sm", children: t(root + "requestUpdated") }),
    !!requests2.data?.requests.length && /* @__PURE__ */ jsxs13("details", { className: "text-sm rounded-lg border p-3", children: [
      /* @__PURE__ */ jsxs13("summary", { className: "cursor-pointer min-h-6", children: [
        t(root + "rescheduleRequest"),
        " \xB7 ",
        t(root + requests2.data.requests[0].state)
      ] }),
      /* @__PURE__ */ jsx19("ul", { className: "mt-2 space-y-2", children: requests2.data.requests.map((request) => /* @__PURE__ */ jsxs13("li", { children: [
        appointmentTime(request.proposedScheduledDate, i18n.language, request.timezone),
        " \xB7 ",
        t(root + request.state)
      ] }, request.id)) })
    ] })
  ] });
  const decide = (decision) => {
    if (!change.isPending) change.mutate({ request: pending, decision });
  };
  return /* @__PURE__ */ jsxs13("section", { className: "rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3", "aria-label": t(root + "rescheduleRequest"), children: [
    /* @__PURE__ */ jsxs13("p", { className: "font-semibold", children: [
      t(root + "rescheduleRequest"),
      " \xB7 ",
      t(root + "awaitingResponse")
    ] }),
    /* @__PURE__ */ jsxs13("dl", { className: "text-sm space-y-2", children: [
      /* @__PURE__ */ jsxs13("div", { children: [
        /* @__PURE__ */ jsx19("dt", { className: "font-medium", children: t(root + "currentTime") }),
        /* @__PURE__ */ jsx19("dd", { children: appointmentTime(pending.originalScheduledDate, i18n.language, pending.timezone) })
      ] }),
      /* @__PURE__ */ jsxs13("div", { children: [
        /* @__PURE__ */ jsx19("dt", { className: "font-medium", children: t(root + "proposedTime") }),
        /* @__PURE__ */ jsx19("dd", { children: appointmentTime(pending.proposedScheduledDate, i18n.language, pending.timezone) })
      ] })
    ] }),
    pending.note && /* @__PURE__ */ jsx19("p", { className: "text-sm whitespace-pre-wrap [overflow-wrap:anywhere]", dir: "auto", children: pending.note }),
    /* @__PURE__ */ jsx19("p", { className: "text-sm font-medium", children: t(root + (pending.fallback === "cancel_booking" ? "cancelConsequences" : "keepConsequences")) }),
    /* @__PURE__ */ jsx19("p", { className: "text-sm", children: t(root + "noResponse") }),
    /* @__PURE__ */ jsx19("p", { className: "text-sm", children: t(root + "availability") }),
    change.isError && /* @__PURE__ */ jsx19("p", { role: "alert", className: "text-red-700", children: t(errorKey(change.error)) }),
    /* @__PURE__ */ jsxs13("div", { className: "flex flex-wrap gap-2", children: [
      pending.canRespond && /* @__PURE__ */ jsxs13(Fragment4, { children: [
        /* @__PURE__ */ jsx19(Button, { disabled: change.isPending, onClick: () => decide("accept"), children: t(root + "approveTime") }),
        /* @__PURE__ */ jsx19(Button, { variant: pending.fallback === "cancel_booking" ? "destructive" : "outline", disabled: change.isPending, onClick: () => pending.fallback === "cancel_booking" ? setConfirm(pending) : decide("decline"), children: t(root + (pending.fallback === "cancel_booking" ? "declineCancel" : "declineKeep")) })
      ] }),
      pending.canWithdraw && /* @__PURE__ */ jsx19(Button, { variant: "outline", disabled: change.isPending, onClick: () => decide("withdraw"), children: t(root + "withdraw") })
    ] }),
    confirm && /* @__PURE__ */ jsxs13(CollaborationDialog, { title: t(root + "declineCancel"), description: t(root + "declineWarning"), pending: change.isPending, onClose: () => setConfirm(null), children: [
      change.isError && /* @__PURE__ */ jsx19("p", { role: "alert", children: t(errorKey(change.error)) }),
      /* @__PURE__ */ jsxs13("div", { className: "flex flex-wrap gap-2 justify-end", children: [
        /* @__PURE__ */ jsx19(Button, { variant: "outline", disabled: change.isPending, onClick: () => setConfirm(null), children: t(root + "cancel") }),
        /* @__PURE__ */ jsx19(Button, { variant: "destructive", disabled: change.isPending, onClick: () => change.mutate({ request: confirm, decision: "decline" }), children: t(root + "confirmDecline") })
      ] })
    ] })
  ] });
}
function EventActionDialog({ booking, action, scope, onClose, restoreFocus }) {
  const { t } = useTranslation11(), refresh = useCollaborationRefresh(), alive = useMounted();
  const { toast: toast2 } = useToast();
  const [body, setBody] = useState10(""), [review, setReview] = useState10(false), [slot, setSlot] = useState10(null);
  const [fallback, setFallback] = useState10("keep_original"), [note, setNote] = useState10("");
  const id = useRef7(crypto.randomUUID()), submitting = useRef7(false);
  const preview = useQuery7({
    queryKey: [...collaborationKey(scope, booking.id), "event-preview", action],
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => (await apiRequest("POST", `/api/bookings/${booking.id}/event/preview`, { action }, signal)).json()
  });
  const send = useMutation3({
    retry: false,
    mutationFn: async () => {
      const bookingIds = preview.data?.bookingIds;
      const path = action === "message" ? "messages" : action === "reschedule" ? "reschedule-requests" : "status";
      const payload = action === "message" ? { bookingIds, body: body.trim(), clientRequestId: id.current } : action === "reschedule" ? { bookingIds, scheduledDate: slot?.startsAt, fallback, note, timeZone: slot?.timezone || timezone(), clientRequestId: id.current } : { bookingIds, status: action === "complete" ? "completed" : "cancelled", timeZone: timezone() };
      return (await apiRequest("POST", `/api/bookings/${booking.id}/event/${path}`, payload)).json();
    },
    onSuccess: async (result) => {
      await refresh();
      if (alive.current) {
        if (action === "message") toast2({ title: t(root + "groupSaved", { count: result.customerCount }) });
        if (action === "reschedule") toast2({ title: t(root + "requestSent") });
        onClose();
      }
    },
    onError: async (error) => {
      if (alive.current && action === "reschedule" && error.message.includes("time_unavailable")) {
        setSlot(null);
        await refresh();
      }
    },
    onSettled: () => {
      submitting.current = false;
    }
  });
  const title = t(root + (action === "message" ? "messageGroup" : action === "reschedule" ? "rescheduleEvent" : action === "complete" ? "confirmComplete" : "confirmCancelEvent"));
  const denied = [preview.error, send.error].some((error) => error && /^(401|403):/.test(error.message));
  const allowed = !denied && preview.data && preview.data.bookingCount > 0 && (action !== "message" || preview.data.hasPro);
  return /* @__PURE__ */ jsxs13(CollaborationDialog, { title, description: t(root + "scopeHelp"), pending: send.isPending, onClose, restoreFocus, children: [
    /* @__PURE__ */ jsx19("p", { className: "font-medium", children: booking.service.name }),
    preview.isPending && /* @__PURE__ */ jsx19("p", { role: "status", children: t(root + "loading") }),
    preview.isError && /* @__PURE__ */ jsxs13("div", { role: "alert", children: [
      t(root + "loadFailed"),
      " ",
      /* @__PURE__ */ jsx19(Button, { variant: "outline", onClick: () => void preview.refetch(), children: t(root + "retry") })
    ] }),
    preview.data && !denied && /* @__PURE__ */ jsxs13(Fragment4, { children: [
      /* @__PURE__ */ jsx19("p", { className: "font-medium", children: t(root + "affected", { count: preview.data.bookingCount, participants: preview.data.participantCount }) }),
      (action !== "message" || review) && /* @__PURE__ */ jsx19("ul", { className: "max-h-40 overflow-y-auto divide-y rounded-lg border", children: preview.data.recipients.map((recipient) => /* @__PURE__ */ jsxs13("li", { className: "p-3 text-sm", children: [
        /* @__PURE__ */ jsx19("bdi", { children: recipient.customerName }),
        " \xB7 ",
        recipient.participantCount,
        " \xB7 ",
        recipient.status ? t(root + "status" + recipient.status[0].toUpperCase() + recipient.status.slice(1)) : "\u2014"
      ] }, recipient.bookingId)) }),
      action === "message" && (!preview.data.hasPro ? /* @__PURE__ */ jsx19("p", { role: "status", children: t(root + "proRequired") }) : /* @__PURE__ */ jsxs13(Fragment4, { children: [
        /* @__PURE__ */ jsx19("p", { className: "rounded-lg bg-indigo-50 p-3 text-sm", children: t(root + "groupPrivacy") }),
        /* @__PURE__ */ jsx19(Label, { htmlFor: "event-message-body", children: t(root + "message") }),
        /* @__PURE__ */ jsx19(Textarea, { id: "event-message-body", dir: "auto", maxLength: 4e3, value: body, readOnly: review, disabled: send.isPending, onChange: (event) => {
          setBody(event.target.value);
          if (send.isError) {
            id.current = crypto.randomUUID();
            send.reset();
          }
        } })
      ] })),
      action === "reschedule" && /* @__PURE__ */ jsxs13(Fragment4, { children: [
        /* @__PURE__ */ jsx19("p", { className: "text-sm", children: t(root + "groupRequestHelp") }),
        /* @__PURE__ */ jsx19(RescheduleFields, { booking, slot, onSlot: (value) => {
          setSlot(value);
          if (send.isError) {
            id.current = crypto.randomUUID();
            send.reset();
          }
        }, fallback, onFallback: (value) => {
          setFallback(value);
          if (send.isError) {
            id.current = crypto.randomUUID();
            send.reset();
          }
        }, note, onNote: (value) => {
          setNote(value);
          if (send.isError) {
            id.current = crypto.randomUUID();
            send.reset();
          }
        }, disabled: send.isPending })
      ] }),
      action === "cancel" && /* @__PURE__ */ jsx19("p", { className: "rounded-lg bg-red-50 text-red-800 p-3", children: t(root + "cancelWarning") })
    ] }),
    send.isError && /* @__PURE__ */ jsx19("p", { role: "alert", className: "text-red-700", children: t(errorKey(send.error)) }),
    /* @__PURE__ */ jsxs13("div", { className: "flex flex-wrap gap-2 justify-end", children: [
      /* @__PURE__ */ jsx19(Button, { variant: "outline", disabled: send.isPending, onClick: onClose, children: t(root + "cancel") }),
      action === "message" && review && /* @__PURE__ */ jsx19(Button, { variant: "outline", disabled: send.isPending, onClick: () => setReview(false), children: t(root + "editMessage") }),
      /* @__PURE__ */ jsx19(Button, { variant: action === "cancel" ? "destructive" : "default", disabled: !allowed || send.isPending || action === "message" && !body.trim() || action === "reschedule" && !slot, onClick: () => {
        if (action === "message" && !review) {
          setReview(true);
          return;
        }
        if (!submitting.current) {
          submitting.current = true;
          send.mutate();
        }
      }, children: send.isPending ? t(root + "loading") : t(root + (action === "message" ? review ? "sendGroup" : "reviewRecipients" : action === "reschedule" ? "sendRequest" : action === "complete" ? "confirmCompleteButton" : "confirmCancel")) })
    ] })
  ] });
}
function EventRescheduleOutcomes({ booking, scope, bookings }) {
  const { t } = useTranslation11();
  const requests2 = useQuery7({
    queryKey: [...collaborationKey(scope, booking.id), "event-requests"],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/bookings/${booking.id}/event/reschedule-requests`, void 0, signal)).json(),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 3e4
  });
  if (requests2.isError) return /* @__PURE__ */ jsxs13("p", { className: "text-sm", role: "status", children: [
    t(root + "loadFailed"),
    " ",
    /* @__PURE__ */ jsx19(Button, { variant: "ghost", onClick: () => void requests2.refetch(), children: t(root + "retry") })
  ] });
  if (!requests2.data?.requests.length) return null;
  return /* @__PURE__ */ jsxs13("details", { className: "border-b border-indigo-200 bg-indigo-50 p-3 text-sm", children: [
    /* @__PURE__ */ jsxs13("summary", { className: "min-h-6 cursor-pointer", children: [
      t(root + "rescheduleRequest"),
      " \xB7 ",
      ["accepted", "pending", "declined"].map((state) => `${t(root + (state === "pending" ? "awaitingResponse" : state))}: ${requests2.data.requests.filter((row) => row.state === state).length}`).join(" \xB7 ")
    ] }),
    /* @__PURE__ */ jsx19("ul", { className: "mt-2 space-y-2", children: requests2.data.requests.map((request) => {
      const row = bookings.find((item) => item.id === request.bookingId);
      return /* @__PURE__ */ jsxs13("li", { children: [
        /* @__PURE__ */ jsx19("bdi", { children: row ? [row.seeker.firstName, row.seeker.lastName].filter(Boolean).join(" ") : `#${request.bookingId}` }),
        " \xB7 ",
        t(root + (request.state === "pending" ? "awaitingResponse" : request.state))
      ] }, request.id);
    }) })
  ] });
}
var root, timezone, collaborationKey;
var init_booking_collaboration = __esm({
  "client/src/components/booking-collaboration.tsx"() {
    "use strict";
    init_provider();
    init_queryClient();
    init_date_time();
    init_booking_time_picker();
    init_booking_message_privacy();
    init_button();
    init_label();
    init_textarea();
    init_dialog();
    init_use_toast();
    init_wishlist_provider();
    init_conversation_read_state();
    root = "appointmentCollaboration.";
    timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
    collaborationKey = (scope, bookingId) => ["booking-collaboration", scope, bookingId];
  }
});

// client/src/components/provider/reschedule-dialog.tsx
import { jsx as jsx20 } from "react/jsx-runtime";
function RescheduleDialog(props) {
  return /* @__PURE__ */ jsx20(RescheduleRequestDialog, { ...props });
}
var init_reschedule_dialog = __esm({
  "client/src/components/provider/reschedule-dialog.tsx"() {
    "use strict";
    init_booking_collaboration();
  }
});

// client/src/lib/notification-links.ts
function safeNotificationHref(method, value) {
  if (!value || /[\r\n\u0000]/.test(value)) return void 0;
  if (method === "sms") return /^sms:\+[1-9]\d{7,14}\?body=[^#]*$/.test(value) ? value : void 0;
  if (method === "email") {
    try {
      const url = new URL(value), email = decodeURIComponent(url.pathname);
      return url.protocol === "mailto:" && !url.hash && /^[^\s?<>@]+@[^\s?<>@]+$/.test(email) && url.searchParams.has("subject") && url.searchParams.has("body") ? value : void 0;
    } catch {
      return void 0;
    }
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "wa.me" && !url.port && !url.username && !url.password && /^\/[1-9]\d{7,14}$/.test(url.pathname) && !url.hash && url.searchParams.has("text") ? value : void 0;
  } catch {
    return void 0;
  }
}
var init_notification_links = __esm({
  "client/src/lib/notification-links.ts"() {
    "use strict";
  }
});

// client/src/components/provider/notification-dialog.tsx
import { useQuery as useQuery8 } from "@tanstack/react-query";
import { useTranslation as useTranslation12 } from "react-i18next";
import { Fragment as Fragment5, jsx as jsx21, jsxs as jsxs14 } from "react/jsx-runtime";
function NotificationDialog({ request, scope, onClose, fallbackFocus }) {
  const { t, i18n } = useTranslation12();
  const preview = useQuery8({
    queryKey: ["notification-preview", scope, request.bookingId, request.kind, request.eventId],
    queryFn: async ({ signal }) => (await apiRequest("POST", `/api/bookings/${request.bookingId}/notification-preview`, { kind: request.kind, eventId: request.eventId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, signal)).json(),
    staleTime: 0,
    gcTime: 0,
    retry: false
  });
  return /* @__PURE__ */ jsx21(Dialog, { open: true, onOpenChange: (open) => {
    if (!open) onClose();
  }, children: /* @__PURE__ */ jsxs14(
    DialogContent,
    {
      dir: i18n.dir(),
      closeLabel: t("notifications.done"),
      className: "max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl break-words motion-reduce:animate-none [&>button:last-child]:h-8 [&>button:last-child]:w-8 [&>button:last-child]:inline-flex [&>button:last-child]:items-center [&>button:last-child]:justify-center",
      onCloseAutoFocus: (event) => {
        event.preventDefault();
        requestAnimationFrame(() => {
          if (request.trigger?.isConnected && !request.trigger.matches(":disabled") && (!request.triggerLabel || request.trigger.textContent === request.triggerLabel)) request.trigger.focus();
          else fallbackFocus();
        });
      },
      children: [
        /* @__PURE__ */ jsxs14(DialogHeader, { className: "text-start sm:text-start", children: [
          /* @__PURE__ */ jsx21(DialogTitle, { children: t(request.kind === "reminder" ? "notifications.sendReminder" : "notifications.notify") }),
          /* @__PURE__ */ jsx21(DialogDescription, { children: t("notifications.composerHelp") })
        ] }),
        preview.isPending && /* @__PURE__ */ jsx21("p", { role: "status", children: t("notifications.loading") }),
        preview.isError && /* @__PURE__ */ jsxs14("div", { role: "alert", children: [
          /* @__PURE__ */ jsx21("p", { children: t("notifications.loadError") }),
          /* @__PURE__ */ jsx21(Button, { variant: "outline", onClick: () => void preview.refetch(), children: t("notifications.retry") })
        ] }),
        preview.data && !preview.isError && /* @__PURE__ */ jsxs14(Fragment5, { children: [
          /* @__PURE__ */ jsx21("p", { className: "font-medium", children: /* @__PURE__ */ jsx21("bdi", { children: preview.data.customerName }) }),
          /* @__PURE__ */ jsx21("p", { className: "whitespace-pre-wrap rounded-lg bg-muted p-3", dir: "auto", children: preview.data.message }),
          /* @__PURE__ */ jsx21("div", { className: "grid gap-3", children: ["sms", "email", "whatsapp"].map((method) => {
            const channel = preview.data.channels[method], href = safeNotificationHref(method, channel.href);
            return /* @__PURE__ */ jsx21("div", { className: "space-y-1", children: href ? /* @__PURE__ */ jsx21(Button, { asChild: true, variant: "outline", className: "w-full h-auto min-h-11 whitespace-normal py-3", children: /* @__PURE__ */ jsx21("a", { href, ...method === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {}, children: t(`notifications.send.${method}`) }) }) : /* @__PURE__ */ jsxs14(Fragment5, { children: [
              /* @__PURE__ */ jsx21(Button, { variant: "outline", disabled: true, className: "w-full h-auto min-h-11 whitespace-normal py-3", "aria-describedby": `notification-${method}-reason`, children: t(`notifications.send.${method}`) }),
              /* @__PURE__ */ jsx21("p", { id: `notification-${method}-reason`, className: "text-sm text-muted-foreground", children: t(`notifications.reasons.${channel.reasonCode}`, { defaultValue: t("notifications.unavailable") }) })
            ] }) }, method);
          }) })
        ] }),
        /* @__PURE__ */ jsx21(Button, { className: "min-h-11 h-auto whitespace-normal", onClick: onClose, children: t("notifications.done") })
      ]
    }
  ) });
}
var init_notification_dialog = __esm({
  "client/src/components/provider/notification-dialog.tsx"() {
    "use strict";
    init_queryClient();
    init_notification_links();
    init_button();
    init_dialog();
  }
});

// client/src/components/provider/appointment-reminder.tsx
import { useQuery as useQuery9 } from "@tanstack/react-query";
import { useTranslation as useTranslation13 } from "react-i18next";
import { jsx as jsx22, jsxs as jsxs15 } from "react/jsx-runtime";
function AppointmentReminder({ booking, scope, pro, canManage, onManual }) {
  const { t, i18n } = useTranslation13();
  const eligible = booking.status === "confirmed" && new Date(booking.scheduledDate).getTime() > Date.now();
  const state = useQuery9({
    queryKey: [`/api/bookings/${booking.id}/notifications`, scope],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/bookings/${booking.id}/notifications`, void 0, signal)).json(),
    enabled: canManage && eligible,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 6e4
  });
  if (!eligible || !canManage) return null;
  const reminder = state.data?.reminder;
  const automationConfigured = booking.service.reminderEnabled;
  const automatic = pro === true && automationConfigured;
  const manual = pro === false || pro === true && automationConfigured === false;
  return /* @__PURE__ */ jsxs15("div", { className: "space-y-2", "aria-live": "polite", children: [
    automatic && /* @__PURE__ */ jsx22(Badge, { variant: "outline", className: "whitespace-normal break-words", children: t("notifications.automaticReminders") }),
    automationConfigured && reminder && reminder.state !== "off" && /* @__PURE__ */ jsxs15("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx22("p", { className: "text-xs text-muted-foreground", children: t(`notifications.reminderState.${reminder.state}`) }),
      reminder.dueAt && /* @__PURE__ */ jsxs15("p", { className: "text-xs text-muted-foreground", children: [
        formatDateTime24(reminder.dueAt, i18n.language, { dateStyle: "medium", timeStyle: "short" }),
        " (",
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        ")",
        reminder.channel ? ` \xB7 ${t(`notifications.method.${reminder.channel}`)}` : ""
      ] }),
      reminder.reasonCode && /* @__PURE__ */ jsx22("p", { className: "text-xs text-muted-foreground", children: t(`notifications.reasons.${reminder.reasonCode}`, { defaultValue: t("notifications.unavailable") }) })
    ] }),
    automationConfigured && state.isError && /* @__PURE__ */ jsx22("p", { className: "text-sm", role: "status", children: t("notifications.statusUnavailable") }),
    manual && /* @__PURE__ */ jsx22(Button, { type: "button", size: "sm", variant: "outline", className: "min-h-11 h-auto whitespace-normal", onClick: (event) => onManual(event.currentTarget), children: t("notifications.sendReminder") })
  ] });
}
var init_appointment_reminder = __esm({
  "client/src/components/provider/appointment-reminder.tsx"() {
    "use strict";
    init_queryClient();
    init_date_time();
    init_button();
    init_badge();
  }
});

// client/src/components/provider/notification-feedback.tsx
import { useQuery as useQuery10 } from "@tanstack/react-query";
import { useTranslation as useTranslation14 } from "react-i18next";
import { jsxs as jsxs16 } from "react/jsx-runtime";
function NotificationFeedback({ bookingId, summary, scope }) {
  const { t } = useTranslation14();
  const query = useQuery10({
    queryKey: [`/api/bookings/${bookingId}/notifications`, scope, summary.eventId ?? "latest"],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/bookings/${bookingId}/notifications`, void 0, signal)).json(),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (query2) => !query2.state.data || ["queued", "leased", "processing"].includes(query2.state.data.notification.state ?? "") ? 5e3 : false
  });
  const current = query.data?.notification ?? summary;
  const superseded = Boolean(summary.eventId && current.eventId && summary.eventId !== current.eventId);
  const key = query.isError ? "statusUnavailable" : superseded ? "automaticUnavailable" : current.state === "delivered" ? "automaticDelivered" : current.state === "accepted" || current.state === "sent" ? "automaticAccepted" : current.state === "unknown" ? "automaticUnknown" : ["queued", "leased", "processing", "scheduled"].includes(current.state ?? "") ? "automaticQueued" : "automaticUnavailable";
  return /* @__PURE__ */ jsxs16("p", { role: "status", className: "text-sm", children: [
    t(`notifications.${key}`),
    current.reasonCode && !query.isError ? ` ${t(`notifications.reasons.${current.reasonCode}`, { defaultValue: t("notifications.unavailable") })}` : ""
  ] });
}
var init_notification_feedback = __esm({
  "client/src/components/provider/notification-feedback.tsx"() {
    "use strict";
    init_queryClient();
  }
});

// client/src/pages/provider/appointments.tsx
import { useEffect as useEffect9, useRef as useRef8, useState as useState11 } from "react";
import { Link as Link3 } from "wouter";
import { useTranslation as useTranslation15 } from "react-i18next";
import { useIsMutating as useIsMutating2, useMutation as useMutation4, useQueryClient as useQueryClient6 } from "@tanstack/react-query";
import { Fragment as Fragment6, jsx as jsx23, jsxs as jsxs17 } from "react/jsx-runtime";
function AppointmentsPage({ view = "calendar" }) {
  const { data: context2 } = useProviderWorkspace();
  const { user: user2 } = useAuth();
  const switching = useIsMutating2({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  const scope = JSON.stringify([user2?.id ?? "", context2?.company?.id ?? "personal", context2?.permissions, context2?.membership]);
  if (!user2 || switching) return null;
  return /* @__PURE__ */ jsx23(AppointmentsContent, { scope, view }, `${scope}:${view}`);
}
function AppointmentsContent({ scope, view }) {
  const { data: context2 } = useProviderWorkspace();
  const { t } = useTranslation15();
  const capabilities = useNotificationCapabilities();
  const bookings = useProviderBookings(scope);
  const employees = useProviderEmployees();
  const [rescheduling, setRescheduling] = useState11(null);
  const [conversation, setConversation] = useState11(null);
  const [eventAction, setEventAction] = useState11(null);
  const [cancelling, setCancelling] = useState11(null);
  const [notification, setNotification] = useState11(null);
  const [automatic, setAutomatic] = useState11(null);
  const content = useRef8(null);
  const trigger = useRef8(null);
  const triggerLabel = useRef8(null);
  const alive = useRef8(true);
  useEffect9(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const queryClient3 = useQueryClient6();
  const { toast: toast2 } = useToast();
  const changed = (booking) => {
    if (!alive.current) return;
    const summary = booking.notification;
    if (summary?.mode === "manual" && summary.eventId) setNotification({ bookingId: booking.id, kind: "status", eventId: summary.eventId, trigger: trigger.current, triggerLabel: triggerLabel.current });
    if (summary?.mode === "automatic") setAutomatic({ bookingId: booking.id, summary });
    void queryClient3.invalidateQueries({ predicate: (query) => /^\/api\/bookings\/\d+\/notifications$/.test(String(query.queryKey[0])) });
  };
  const update = useMutation4({
    mutationFn: async ({ bookingId, status }) => (await apiRequest("PATCH", `/api/bookings/${bookingId}/status`, { status, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })).json(),
    onSuccess: async (updatedBooking, { status }) => {
      if (!alive.current) return;
      changed(updatedBooking);
      queryClient3.setQueriesData({ queryKey: ["/api/bookings/provider"] }, (current) => current?.map((booking) => booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking));
      await Promise.all([queryClient3.invalidateQueries({ queryKey: ["/api/bookings/provider"] }), queryClient3.invalidateQueries({ queryKey: ["/api/bookings/seeker"] })]);
      toast2({ title: status === "completed" ? "Booking Completed" : "Booking Updated", description: status === "completed" ? "The appointment has been marked complete." : "Booking status has been updated" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        const path = view === "calendar" ? "/my-services/appointments" : view === "upcoming" ? "/my-services/upcoming-appointments" : "/my-services/past-appointments";
        window.location.assign(`/login?returnTo=${encodeURIComponent(path)}`);
        return;
      }
      toast2({ title: "Error", description: "Failed to update booking", variant: "destructive" });
    }
  });
  const canManage = context2?.permissions.manageBookings ?? false;
  const rememberTrigger = (element) => {
    trigger.current = element ?? document.activeElement;
    triggerLabel.current = trigger.current?.textContent ?? null;
  };
  const restoreFocus = () => {
    if (trigger.current?.isConnected && !trigger.current.matches(":disabled")) trigger.current.focus();
    else content.current?.focus();
  };
  return /* @__PURE__ */ jsxs17("div", { ref: content, tabIndex: -1, "aria-label": t(view === "calendar" ? "notifications.appointments" : view === "upcoming" ? "providerNavigation.upcomingAppointments" : "providerNavigation.pastAppointments"), className: "space-y-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2", children: [
    view !== "calendar" && /* @__PURE__ */ jsx23("h1", { className: "text-2xl font-semibold", children: t(view === "upcoming" ? "providerNavigation.upcomingAppointments" : "providerNavigation.pastAppointments") }),
    capabilities.data?.hasPro === false && /* @__PURE__ */ jsxs17("div", { className: "rounded-xl border bg-white p-3 text-sm", children: [
      t("notifications.proBanner"),
      " ",
      /* @__PURE__ */ jsx23(Link3, { href: "/my-services/settings/billing", className: "underline inline-block py-2", children: t("notifications.subscription") })
    ] }),
    capabilities.isError && /* @__PURE__ */ jsx23("p", { role: "status", children: t("notifications.capabilityError") }),
    automatic && /* @__PURE__ */ jsx23(NotificationFeedback, { bookingId: automatic.bookingId, summary: automatic.summary, scope }, `${automatic.bookingId}:${automatic.summary.eventId ?? "latest"}`),
    bookings.isError ? /* @__PURE__ */ jsx23("p", { role: "alert", children: "Unable to load appointments. Please refresh to try again." }) : /* @__PURE__ */ jsx23(Fragment6, { children: /* @__PURE__ */ jsx23(
      AppointmentAgenda,
      {
        fixedView: view,
        bookings: bookings.data ?? [],
        employees: employees.data ?? [],
        provider: true,
        loading: bookings.isLoading,
        updating: update.isPending,
        onStatusChange: canManage ? (bookingId, status, element) => {
          if (!update.isPending) {
            rememberTrigger(element);
            setAutomatic(null);
            if (status === "cancelled") setCancelling(bookings.data?.find((row) => row.id === bookingId) ?? null);
            else update.mutate({ bookingId, status });
          }
        } : void 0,
        onReschedule: canManage ? (booking, element) => {
          rememberTrigger(element);
          setAutomatic(null);
          setRescheduling(booking);
        } : void 0,
        onMessage: (booking, element) => {
          rememberTrigger(element);
          setConversation(booking);
        },
        onEventAction: canManage ? (booking, action, element) => {
          rememberTrigger(element);
          setEventAction({ booking, action });
        } : void 0,
        renderBookingDetails: canManage ? (booking) => /* @__PURE__ */ jsx23(BookingRescheduleRequests, { booking, scope }) : void 0,
        renderEventDetails: canManage ? (booking) => /* @__PURE__ */ jsx23(EventRescheduleOutcomes, { booking, scope, bookings: bookings.data ?? [] }) : void 0,
        renderProviderNotifications: (booking) => /* @__PURE__ */ jsx23(AppointmentReminder, { booking, scope, pro: capabilities.isError ? void 0 : capabilities.data?.hasPro, canManage, onManual: (element) => setNotification({ bookingId: booking.id, kind: "reminder", trigger: element, triggerLabel: element.textContent }) })
      }
    ) }),
    rescheduling && canManage && /* @__PURE__ */ jsx23(RescheduleDialog, { booking: rescheduling, onClose: () => setRescheduling(null), restoreFocus }),
    conversation && /* @__PURE__ */ jsx23(BookingConversationDialog, { viewer: "provider", canSend: canManage, booking: conversation, scope, onClose: () => setConversation(null), restoreFocus }, conversation.id),
    eventAction && canManage && /* @__PURE__ */ jsx23(EventActionDialog, { ...eventAction, scope, onClose: () => setEventAction(null), restoreFocus }, `${eventAction.booking.id}:${eventAction.action}`),
    cancelling && canManage && /* @__PURE__ */ jsx23(Dialog, { open: true, onOpenChange: (open) => {
      if (!open && !update.isPending) setCancelling(null);
    }, children: /* @__PURE__ */ jsxs17(DialogContent, { closeDisabled: update.isPending, onCloseAutoFocus: (event) => {
      event.preventDefault();
      requestAnimationFrame(restoreFocus);
    }, children: [
      /* @__PURE__ */ jsxs17(DialogHeader, { children: [
        /* @__PURE__ */ jsx23(DialogTitle, { children: t("appointmentCollaboration.cancelBooking") }),
        /* @__PURE__ */ jsx23(DialogDescription, { children: t("appointmentCollaboration.cancelWarning") })
      ] }),
      /* @__PURE__ */ jsxs17("p", { children: [
        cancelling.service.name,
        " \xB7 ",
        [cancelling.seeker.firstName, cancelling.seeker.lastName].filter(Boolean).join(" ")
      ] }),
      /* @__PURE__ */ jsxs17("div", { className: "flex gap-2 flex-wrap justify-end", children: [
        /* @__PURE__ */ jsx23(Button, { variant: "outline", disabled: update.isPending, onClick: () => setCancelling(null), children: t("appointmentCollaboration.cancel") }),
        /* @__PURE__ */ jsx23(Button, { variant: "destructive", disabled: update.isPending, onClick: () => {
          update.mutate({ bookingId: cancelling.id, status: "cancelled" }, { onSuccess: () => setCancelling(null) });
        }, children: t("appointmentCollaboration.confirmCancel") })
      ] })
    ] }) }),
    notification && canManage && /* @__PURE__ */ jsx23(NotificationDialog, { request: notification, scope, onClose: () => setNotification(null), fallbackFocus: () => content.current?.focus() })
  ] });
}
var init_appointments = __esm({
  "client/src/pages/provider/appointments.tsx"() {
    "use strict";
    init_use_provider_workspace();
    init_useAuth();
    init_use_notification_capabilities();
    init_queryClient();
    init_authUtils();
    init_use_toast();
    init_appointment_agenda();
    init_reschedule_dialog();
    init_notification_dialog();
    init_appointment_reminder();
    init_notification_feedback();
    init_booking_collaboration();
    init_button();
    init_dialog();
  }
});

// client/src/hooks/use-service-actions.ts
import { useMutation as useMutation5, useQueryClient as useQueryClient7 } from "@tanstack/react-query";
import { useLocation as useLocation4 } from "wouter";
function useServiceActions() {
  const queryClient3 = useQueryClient7();
  const [, navigate] = useLocation4();
  const { toast: toast2 } = useToast();
  const onError = (error) => {
    if (isUnauthorizedError(error)) {
      window.location.assign("/login?returnTo=%2Fmy-services%2Fservices");
      return;
    }
    let message = "Please try again.";
    try {
      message = JSON.parse(error.message.replace(/^\d+:\s*/, "")).message || message;
    } catch {
    }
    toast2({ title: "Unable to update services", description: message, variant: "destructive" });
  };
  const copy2 = useMutation5({
    mutationFn: async (id) => (await apiRequest("POST", `/api/services/${id}/copy`)).json(),
    onSuccess: async (service2) => {
      await queryClient3.invalidateQueries({ queryKey: ["/api/services/provider"] });
      navigate(`/my-services/services/${service2.id}/edit`);
      toast2({ title: "Service copied", description: "An inactive copy is ready to edit. Publish it when you are ready." });
    },
    onError
  });
  const search = useMutation5({
    mutationFn: () => apiRequest("POST", "/api/admin/generate-embeddings", {}),
    onSuccess: () => toast2({ title: "AI Search Updated" }),
    onError
  });
  return { copy: copy2, search };
}
var init_use_service_actions = __esm({
  "client/src/hooks/use-service-actions.ts"() {
    "use strict";
    init_queryClient();
    init_authUtils();
    init_use_toast();
  }
});

// client/src/components/wishlist-heart.tsx
import { Heart, RefreshCw } from "lucide-react";
import { useTranslation as useTranslation16 } from "react-i18next";
import { jsx as jsx24, jsxs as jsxs18 } from "react/jsx-runtime";
function WishlistHeart({ serviceId, className = "" }) {
  const state = useWishlist(serviceId);
  const { t } = useTranslation16();
  if (!state) return null;
  const saved2 = state.saved(serviceId), pending = state.pending.has(serviceId), failed = state.errors.has(serviceId);
  return /* @__PURE__ */ jsxs18("span", { className: `wishlist-control ${className}`, children: [
    /* @__PURE__ */ jsx24(
      "button",
      {
        type: "button",
        "data-wishlist-heart": serviceId,
        "aria-pressed": saved2,
        "aria-label": t(state.failed ? "wishlist.retryState" : saved2 ? "wishlist.remove" : "wishlist.add"),
        title: t(saved2 ? "wishlist.remove" : "wishlist.add"),
        disabled: pending || !state.ready && !state.failed,
        onClick: (event) => {
          event.stopPropagation();
          event.currentTarget.focus();
          if (state.failed) state.retry();
          else void state.toggle(serviceId);
        },
        className: `wishlist-heart ${saved2 ? "is-saved" : ""}`,
        children: state.failed ? /* @__PURE__ */ jsx24(RefreshCw, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) : /* @__PURE__ */ jsx24(Heart, { className: "h-[18px] w-[18px]", fill: saved2 ? "currentColor" : "none", "aria-hidden": "true" })
      }
    ),
    (failed || state.failed) && /* @__PURE__ */ jsx24("span", { role: "alert", className: "wishlist-heart-error", children: t(failed ? "wishlist.saveFailed" : "wishlist.stateFailed") })
  ] });
}
var init_wishlist_heart = __esm({
  "client/src/components/wishlist-heart.tsx"() {
    "use strict";
    init_wishlist_provider();
  }
});

// client/src/lib/service-duration.ts
function preferredDurationUnit(minutes) {
  if (minutes > 0 && minutes % 1440 === 0) return "day";
  if (minutes > 0 && minutes % 60 === 0) return "hour";
  return "minute";
}
function durationInMinutes(value, unit) {
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim())) return NaN;
  const minutes = Number(value.replace(",", ".")) * minutesPerUnit[unit];
  const whole = Math.round(minutes);
  return Math.abs(minutes - whole) < 1e-9 ? whole : minutes;
}
function formatServiceDuration(minutes, language) {
  const parts2 = [];
  let remaining = minutes;
  for (const unit of ["day", "hour", "minute"]) {
    const count3 = unit === "minute" ? remaining : Math.floor(remaining / minutesPerUnit[unit]);
    if (count3 > 0 || unit === "minute" && !parts2.length) {
      parts2.push(new Intl.NumberFormat(language, { style: "unit", unit, unitDisplay: "long" }).format(count3));
    }
    remaining %= minutesPerUnit[unit];
  }
  return new Intl.ListFormat(language, { style: "short", type: "unit" }).format(parts2);
}
var durationUnits, minutesPerUnit;
var init_service_duration = __esm({
  "client/src/lib/service-duration.ts"() {
    "use strict";
    durationUnits = ["minute", "hour", "day"];
    minutesPerUnit = { minute: 1, hour: 60, day: 1440 };
  }
});

// client/src/components/service-result-card.tsx
import { useState as useState12 } from "react";
import { useTranslation as useTranslation17 } from "react-i18next";
import { Leaf } from "lucide-react";
import { jsx as jsx25, jsxs as jsxs19 } from "react/jsx-runtime";
function ServiceResultCard({ service: service2, provider, rating, category, employeeName, distance, onViewDetails, wishlistEnabled = true }) {
  const { t, i18n } = useTranslation17();
  const [failedImage, setFailedImage] = useState12(null);
  const image = service2.imageUrl && failedImage !== service2.imageUrl ? /* @__PURE__ */ jsx25("img", { src: service2.imageUrl, alt: "", loading: "lazy", onError: () => setFailedImage(service2.imageUrl) }) : /* @__PURE__ */ jsx25(Leaf, { "aria-hidden": "true" });
  return /* @__PURE__ */ jsxs19("article", { className: "search-service-card", children: [
    /* @__PURE__ */ jsxs19("div", { className: "wishlist-image relative min-w-0 w-full", children: [
      onViewDetails ? /* @__PURE__ */ jsx25("button", { type: "button", className: "search-service-art", onClick: onViewDetails, "aria-label": service2.name, children: image }) : /* @__PURE__ */ jsx25("div", { className: "search-service-art", "aria-hidden": "true", children: image }),
      onViewDetails && wishlistEnabled && /* @__PURE__ */ jsx25(WishlistHeart, { serviceId: service2.id })
    ] }),
    /* @__PURE__ */ jsxs19("div", { className: "search-service-body", children: [
      category && /* @__PURE__ */ jsx25("div", { className: "search-service-top", children: /* @__PURE__ */ jsx25("span", { className: "search-category-name", children: category }) }),
      /* @__PURE__ */ jsx25("h3", { children: onViewDetails ? /* @__PURE__ */ jsx25("button", { type: "button", className: "search-service-title", "data-testid": `button-view-details-${service2.id}`, onClick: onViewDetails, children: /* @__PURE__ */ jsx25("bdi", { children: service2.name }) }) : /* @__PURE__ */ jsx25("bdi", { children: service2.name }) }),
      /* @__PURE__ */ jsxs19("div", { className: "search-provider-row", children: [
        provider,
        typeof distance === "number" && Number.isFinite(distance) && /* @__PURE__ */ jsxs19("span", { "data-testid": `text-distance-${service2.id}`, children: [
          "\xB7 ",
          t("searchPage.distanceAway", { distance: new Intl.NumberFormat(i18n.resolvedLanguage).format(distance) })
        ] }),
        rating && /* @__PURE__ */ jsx25("span", { className: "search-inline-rating", children: rating })
      ] }),
      employeeName && /* @__PURE__ */ jsx25("p", { className: "search-service-description", children: t("searchPage.withEmployee", { name: employeeName }) }),
      service2.description && /* @__PURE__ */ jsx25("p", { className: "search-service-description search-description-clamp", children: service2.description }),
      /* @__PURE__ */ jsxs19("div", { className: "search-service-meta", children: [
        /* @__PURE__ */ jsx25("span", { children: formatServiceDuration(service2.duration, i18n.resolvedLanguage || i18n.language) }),
        /* @__PURE__ */ jsx25("span", { "aria-hidden": "true", children: "\xB7" }),
        /* @__PURE__ */ jsx25("span", { children: t(service2.serviceType === "group" ? "searchPage.group" : "searchPage.individual") }),
        /* @__PURE__ */ jsx25("span", { className: `search-booking-badge ${service2.instantBooking ? "instant" : ""}`, children: t(service2.instantBooking ? "searchPage.instant" : "searchPage.approval") })
      ] }),
      /* @__PURE__ */ jsxs19("div", { className: "search-card-actions", children: [
        /* @__PURE__ */ jsxs19("div", { className: "search-price", children: [
          /* @__PURE__ */ jsx25("strong", { children: formatMoney(service2.price, service2.currency, i18n.resolvedLanguage || i18n.language) ?? t("currency.unavailable") }),
          service2.serviceType === "group" && /* @__PURE__ */ jsx25("span", { children: t("searchPage.perPerson") })
        ] }),
        onViewDetails && /* @__PURE__ */ jsx25(Button, { variant: "ghost", type: "button", onClick: onViewDetails, children: t("searchPage.details") })
      ] })
    ] })
  ] });
}
var init_service_result_card = __esm({
  "client/src/components/service-result-card.tsx"() {
    "use strict";
    init_button();
    init_money();
    init_wishlist_heart();
    init_service_duration();
  }
});

// client/src/components/provider/provider-service-card.tsx
import { Link as Link4 } from "wouter";
import { useTranslation as useTranslation18 } from "react-i18next";
import { Copy } from "lucide-react";
import { jsx as jsx26, jsxs as jsxs20 } from "react/jsx-runtime";
function ProviderServiceCard({ service: service2, providerName, employees, editable, copying, copyBusy, onCopy }) {
  const { t } = useTranslation18();
  const employeeName = service2.employeeId == null ? void 0 : employees.find((employee) => employee.id === service2.employeeId)?.name || t("providerServices.assignedEmployee");
  return /* @__PURE__ */ jsxs20("div", { className: "provider-service-item", "data-testid": `provider-service-${service2.id}`, children: [
    /* @__PURE__ */ jsx26(ServiceResultCard, { service: service2, provider: /* @__PURE__ */ jsx26("bdi", { children: providerName }), employeeName }),
    /* @__PURE__ */ jsxs20("div", { className: "provider-service-tools", children: [
      /* @__PURE__ */ jsxs20("div", { className: "provider-service-status", children: [
        /* @__PURE__ */ jsx26("span", { className: `provider-publication-badge ${service2.isActive ? "published" : ""}`, children: t(service2.isActive ? "providerServices.published" : "providerServices.inactive") }),
        employeeName && /* @__PURE__ */ jsx26("span", { className: "provider-service-employee", children: t("searchPage.withEmployee", { name: employeeName }) })
      ] }),
      editable && /* @__PURE__ */ jsxs20("div", { className: "provider-service-actions", children: [
        /* @__PURE__ */ jsxs20(Button, { variant: "ghost", size: "sm", disabled: copyBusy, onClick: onCopy, "data-testid": `button-copy-service-${service2.id}`, "aria-label": t("providerServices.copyService", { name: service2.name }), children: [
          /* @__PURE__ */ jsx26(Copy, { className: "w-4 h-4", "aria-hidden": "true" }),
          t(copying ? "providerServices.copying" : "providerServices.copy")
        ] }),
        /* @__PURE__ */ jsx26(Button, { asChild: true, variant: "outline", size: "sm", children: /* @__PURE__ */ jsx26(Link4, { href: `/my-services/services/${service2.id}/edit`, "data-testid": `button-edit-service-${service2.id}`, "aria-label": t("providerServices.editService", { name: service2.name }), children: t("common.edit") }) })
      ] })
    ] })
  ] });
}
var init_provider_service_card = __esm({
  "client/src/components/provider/provider-service-card.tsx"() {
    "use strict";
    init_service_result_card();
    init_button();
  }
});

// client/src/components/provider/services-list.tsx
import { Link as Link5 } from "wouter";
import { useTranslation as useTranslation19 } from "react-i18next";
import { jsx as jsx27, jsxs as jsxs21 } from "react/jsx-runtime";
function ServicesList({ services, providerName, view, employees, editable, copyingId, copyBusy, onCopy }) {
  const { t } = useTranslation19();
  if (!services.length) return /* @__PURE__ */ jsxs21("div", { className: "search-state", role: "status", children: [
    /* @__PURE__ */ jsx27("h3", { children: t("providerServices.empty") }),
    /* @__PURE__ */ jsx27("p", { children: t(editable ? "providerServices.emptyHelp" : "providerServices.assignedHelp") }),
    editable && /* @__PURE__ */ jsx27(Button, { asChild: true, children: /* @__PURE__ */ jsx27(Link5, { href: "/my-services/services/new", children: t("provider.addService") }) })
  ] });
  return /* @__PURE__ */ jsx27("div", { className: `search-cards search-cards-${view}`, "data-testid": "provider-service-results", children: services.map((service2) => /* @__PURE__ */ jsx27(ProviderServiceCard, { service: service2, providerName, employees, editable, copying: copyBusy && copyingId === service2.id, copyBusy, onCopy: () => onCopy(service2.id) }, service2.id)) });
}
var init_services_list = __esm({
  "client/src/components/provider/services-list.tsx"() {
    "use strict";
    init_provider_service_card();
    init_button();
  }
});

// client/src/pages/provider/services.tsx
import { useEffect as useEffect10, useState as useState13 } from "react";
import { useTranslation as useTranslation20 } from "react-i18next";
import { Link as Link6 } from "wouter";
import { Plus, Sparkles, List as List2, LayoutGrid } from "lucide-react";
import { jsx as jsx28, jsxs as jsxs22 } from "react/jsx-runtime";
function ServicesPage() {
  const { t } = useTranslation20();
  const [saved2] = useState13(() => Boolean(window.history.state?.serviceSaved));
  useEffect10(() => {
    if (!saved2) return;
    const state = { ...window.history.state };
    delete state.serviceSaved;
    window.history.replaceState(state, "");
  }, [saved2]);
  const services = useProviderServices();
  const employees = useProviderEmployees();
  const { data: context2 } = useProviderWorkspace();
  const { user: user2 } = useAuth();
  const { copy: copy2, search } = useServiceActions();
  const [status, setStatus] = useState13("all");
  const [view, setView] = useState13("list");
  const editable = context2?.permissions.manageServices ?? false;
  const filtered = (services.data ?? []).filter((service2) => status === "all" || (status === "published" ? service2.isActive : !service2.isActive));
  const providerName = context2?.company?.name || (user2 ? getProviderName({ ...user2, providerType: "individual" }) : t("role.provider"));
  return /* @__PURE__ */ jsxs22("div", { className: "search-design provider-services-page", children: [
    saved2 && /* @__PURE__ */ jsx28("p", { role: "status", className: "border rounded-xl p-4 bg-card text-card-foreground", children: t("serviceForm.saved") }),
    /* @__PURE__ */ jsxs22("div", { className: "provider-services-heading", children: [
      /* @__PURE__ */ jsxs22("div", { children: [
        /* @__PURE__ */ jsx28("h1", { children: t("provider.myServices") }),
        /* @__PURE__ */ jsx28("p", { children: t("providerServices.previewHelp") })
      ] }),
      editable && /* @__PURE__ */ jsx28(Button, { asChild: true, children: /* @__PURE__ */ jsxs22(Link6, { href: "/my-services/services/new", children: [
        /* @__PURE__ */ jsx28(Plus, { className: "w-4 h-4 mr-2", "aria-hidden": "true" }),
        t("provider.addService")
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs22("div", { className: "provider-services-toolbar", children: [
      /* @__PURE__ */ jsx28("div", { className: "provider-services-status-filter", role: "group", "aria-label": t("providerServices.status"), children: ["all", "published", "inactive"].map((value) => /* @__PURE__ */ jsx28(Button, { size: "sm", variant: status === value ? "default" : "ghost", "data-testid": `provider-filter-${value}`, "aria-pressed": status === value, onClick: () => setStatus(value), children: t(`providerServices.${value}`) }, value)) }),
      editable && /* @__PURE__ */ jsxs22(Button, { variant: "outline", disabled: search.isPending || !services.data?.length, onClick: () => search.mutate(), "data-testid": "button-generate-ai-search", children: [
        /* @__PURE__ */ jsx28(Sparkles, { className: "w-4 h-4 mr-2", "aria-hidden": "true" }),
        t(search.isPending ? "providerServices.updating" : "providerServices.updateSearch")
      ] })
    ] }),
    /* @__PURE__ */ jsx28("div", { className: "search-view-toggle provider-service-view-toggle", role: "group", "aria-label": t("searchPage.resultView"), children: ["list", "grid"].map((value) => /* @__PURE__ */ jsxs22(Button, { variant: "ghost", type: "button", "data-testid": `provider-view-${value}`, "aria-pressed": view === value, onClick: () => setView(value), children: [
      value === "list" ? /* @__PURE__ */ jsx28(List2, { "aria-hidden": "true" }) : /* @__PURE__ */ jsx28(LayoutGrid, { "aria-hidden": "true" }),
      /* @__PURE__ */ jsx28("span", { children: t(`views.${value}`) })
    ] }, value)) }),
    /* @__PURE__ */ jsxs22("section", { className: "provider-service-results", "aria-labelledby": "provider-service-count", "aria-busy": services.isLoading, children: [
      /* @__PURE__ */ jsx28("h2", { id: "provider-service-count", className: "provider-service-count", "aria-live": "polite", children: services.isLoading ? t("providerServices.loading") : t("searchPage.resultsCount", { count: filtered.length }) }),
      services.isLoading ? /* @__PURE__ */ jsx28("p", { role: "status", children: t("providerServices.loading") }) : services.isError ? /* @__PURE__ */ jsxs22("div", { className: "search-state", role: "alert", children: [
        /* @__PURE__ */ jsx28("p", { children: t("providerServices.loadError") }),
        /* @__PURE__ */ jsx28(Button, { variant: "outline", onClick: () => void services.refetch(), children: t("publicSearch.retry") })
      ] }) : /* @__PURE__ */ jsx28(ServicesList, { services: filtered, view, providerName, employees: employees.data ?? [], editable, copyingId: copy2.variables, copyBusy: copy2.isPending, onCopy: (id) => copy2.mutate(id) })
    ] }),
    /* @__PURE__ */ jsx28("p", { className: "provider-preview-note", children: t("providerServices.previewNote") })
  ] });
}
var init_services = __esm({
  "client/src/pages/provider/services.tsx"() {
    "use strict";
    init_useAuth();
    init_provider();
    init_use_provider_workspace();
    init_use_service_actions();
    init_services_list();
    init_button();
  }
});

// client/src/components/ui/alert-dialog.tsx
var alert_dialog_exports = {};
__export(alert_dialog_exports, {
  AlertDialog: () => AlertDialog,
  AlertDialogAction: () => AlertDialogAction,
  AlertDialogCancel: () => AlertDialogCancel,
  AlertDialogContent: () => AlertDialogContent,
  AlertDialogDescription: () => AlertDialogDescription,
  AlertDialogFooter: () => AlertDialogFooter,
  AlertDialogHeader: () => AlertDialogHeader,
  AlertDialogOverlay: () => AlertDialogOverlay,
  AlertDialogPortal: () => AlertDialogPortal,
  AlertDialogTitle: () => AlertDialogTitle,
  AlertDialogTrigger: () => AlertDialogTrigger
});
import * as React8 from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { jsx as jsx29, jsxs as jsxs23 } from "react/jsx-runtime";
var AlertDialog, AlertDialogTrigger, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel;
var init_alert_dialog = __esm({
  "client/src/components/ui/alert-dialog.tsx"() {
    "use strict";
    init_utils();
    init_button();
    AlertDialog = AlertDialogPrimitive.Root;
    AlertDialogTrigger = AlertDialogPrimitive.Trigger;
    AlertDialogPortal = AlertDialogPrimitive.Portal;
    AlertDialogOverlay = React8.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx29(
      AlertDialogPrimitive.Overlay,
      {
        className: cn(
          "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        ),
        ...props,
        ref
      }
    ));
    AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;
    AlertDialogContent = React8.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxs23(AlertDialogPortal, { children: [
      /* @__PURE__ */ jsx29(AlertDialogOverlay, {}),
      /* @__PURE__ */ jsx29(
        AlertDialogPrimitive.Content,
        {
          ref,
          className: cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
            className
          ),
          ...props
        }
      )
    ] }));
    AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;
    AlertDialogHeader = ({
      className,
      ...props
    }) => /* @__PURE__ */ jsx29(
      "div",
      {
        className: cn(
          "flex flex-col space-y-2 text-center sm:text-left",
          className
        ),
        ...props
      }
    );
    AlertDialogHeader.displayName = "AlertDialogHeader";
    AlertDialogFooter = ({
      className,
      ...props
    }) => /* @__PURE__ */ jsx29(
      "div",
      {
        className: cn(
          "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
          className
        ),
        ...props
      }
    );
    AlertDialogFooter.displayName = "AlertDialogFooter";
    AlertDialogTitle = React8.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx29(
      AlertDialogPrimitive.Title,
      {
        ref,
        className: cn("text-lg font-semibold", className),
        ...props
      }
    ));
    AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;
    AlertDialogDescription = React8.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx29(
      AlertDialogPrimitive.Description,
      {
        ref,
        className: cn("text-sm text-muted-foreground", className),
        ...props
      }
    ));
    AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;
    AlertDialogAction = React8.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx29(
      AlertDialogPrimitive.Action,
      {
        ref,
        className: cn(buttonVariants(), className),
        ...props
      }
    ));
    AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;
    AlertDialogCancel = React8.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx29(
      AlertDialogPrimitive.Cancel,
      {
        ref,
        className: cn(
          buttonVariants({ variant: "outline" }),
          "mt-2 sm:mt-0",
          className
        ),
        ...props
      }
    ));
    AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;
  }
});

// client/src/lib/service-images.ts
function serviceImages(service2) {
  const values = service2.imageUrls?.length ? service2.imageUrls : service2.imageUrl ? [service2.imageUrl] : [];
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.length > 0))).slice(0, 10);
}
function imageDraft(imageUrls) {
  return { imageUrls, imageUrl: imageUrls[0] ?? "" };
}
var init_service_images = __esm({
  "client/src/lib/service-images.ts"() {
    "use strict";
  }
});

// client/src/components/provider/service-draft.ts
function createServiceDraft(service2) {
  return {
    name: service2?.name ?? "",
    description: service2?.description ?? "",
    category: service2?.category ?? "",
    serviceType: service2?.serviceType ?? "one_to_one",
    price: service2?.price ?? "",
    currency: service2?.currency ?? "",
    duration: service2?.duration ?? 60,
    maxCapacity: service2?.maxCapacity ?? 1,
    cleanupTime: service2?.cleanupTime ?? 0,
    reminderEnabled: service2?.reminderEnabled ?? false,
    reminderMethod: service2?.reminderMethod ?? "email",
    reminderHours: service2?.reminderHours ?? 24,
    reminderMessage: service2?.reminderMessage ?? "",
    ageGroups: service2?.ageGroups ?? [],
    targetGender: service2?.targetGender ?? "both",
    instantBooking: service2?.instantBooking ?? false,
    advancePaymentPercent: service2?.advancePaymentPercent ?? 50,
    addressId: service2?.addressId ?? null,
    ...imageDraft(service2 ? serviceImages(service2) : []),
    externalUrl: service2?.externalUrl ?? "",
    isActive: service2?.isActive ?? true,
    employeeId: service2?.employeeId ?? null
  };
}
var init_service_draft = __esm({
  "client/src/components/provider/service-draft.ts"() {
    "use strict";
    init_service_images();
  }
});

// client/src/components/ui/input.tsx
import * as React9 from "react";
import { jsx as jsx30 } from "react/jsx-runtime";
var Input;
var init_input = __esm({
  "client/src/components/ui/input.tsx"() {
    "use strict";
    init_utils();
    Input = React9.forwardRef(
      ({ className, type, ...props }, ref) => {
        return /* @__PURE__ */ jsx30(
          "input",
          {
            type,
            className: cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className
            ),
            ref,
            ...props
          }
        );
      }
    );
    Input.displayName = "Input";
  }
});

// client/src/components/ui/select.tsx
var select_exports = {};
__export(select_exports, {
  Select: () => Select,
  SelectContent: () => SelectContent,
  SelectGroup: () => SelectGroup,
  SelectItem: () => SelectItem,
  SelectLabel: () => SelectLabel,
  SelectScrollDownButton: () => SelectScrollDownButton,
  SelectScrollUpButton: () => SelectScrollUpButton,
  SelectSeparator: () => SelectSeparator,
  SelectTrigger: () => SelectTrigger,
  SelectValue: () => SelectValue
});
import * as React10 from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check as Check2, ChevronDown as ChevronDown3, ChevronUp as ChevronUp2 } from "lucide-react";
import { jsx as jsx31, jsxs as jsxs24 } from "react/jsx-runtime";
var Select, SelectGroup, SelectValue, SelectTrigger, SelectScrollUpButton, SelectScrollDownButton, SelectContent, SelectLabel, SelectItem, SelectSeparator;
var init_select = __esm({
  "client/src/components/ui/select.tsx"() {
    "use strict";
    "use client";
    init_utils();
    Select = SelectPrimitive.Root;
    SelectGroup = SelectPrimitive.Group;
    SelectValue = SelectPrimitive.Value;
    SelectTrigger = React10.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs24(
      SelectPrimitive.Trigger,
      {
        ref,
        className: cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          className
        ),
        ...props,
        children: [
          children,
          /* @__PURE__ */ jsx31(SelectPrimitive.Icon, { asChild: true, children: /* @__PURE__ */ jsx31(ChevronDown3, { className: "h-4 w-4 opacity-50" }) })
        ]
      }
    ));
    SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;
    SelectScrollUpButton = React10.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx31(
      SelectPrimitive.ScrollUpButton,
      {
        ref,
        className: cn(
          "flex cursor-default items-center justify-center py-1",
          className
        ),
        ...props,
        children: /* @__PURE__ */ jsx31(ChevronUp2, { className: "h-4 w-4" })
      }
    ));
    SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;
    SelectScrollDownButton = React10.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx31(
      SelectPrimitive.ScrollDownButton,
      {
        ref,
        className: cn(
          "flex cursor-default items-center justify-center py-1",
          className
        ),
        ...props,
        children: /* @__PURE__ */ jsx31(ChevronDown3, { className: "h-4 w-4" })
      }
    ));
    SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;
    SelectContent = React10.forwardRef(({ className, children, position = "popper", ...props }, ref) => /* @__PURE__ */ jsx31(SelectPrimitive.Portal, { children: /* @__PURE__ */ jsxs24(
      SelectPrimitive.Content,
      {
        ref,
        className: cn(
          "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        ),
        position,
        ...props,
        children: [
          /* @__PURE__ */ jsx31(SelectScrollUpButton, {}),
          /* @__PURE__ */ jsx31(
            SelectPrimitive.Viewport,
            {
              className: cn(
                "p-1",
                position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
              ),
              children
            }
          ),
          /* @__PURE__ */ jsx31(SelectScrollDownButton, {})
        ]
      }
    ) }));
    SelectContent.displayName = SelectPrimitive.Content.displayName;
    SelectLabel = React10.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx31(
      SelectPrimitive.Label,
      {
        ref,
        className: cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className),
        ...props
      }
    ));
    SelectLabel.displayName = SelectPrimitive.Label.displayName;
    SelectItem = React10.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs24(
      SelectPrimitive.Item,
      {
        ref,
        className: cn(
          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        ),
        ...props,
        children: [
          /* @__PURE__ */ jsx31("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ jsx31(SelectPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx31(Check2, { className: "h-4 w-4" }) }) }),
          /* @__PURE__ */ jsx31(SelectPrimitive.ItemText, { children })
        ]
      }
    ));
    SelectItem.displayName = SelectPrimitive.Item.displayName;
    SelectSeparator = React10.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx31(
      SelectPrimitive.Separator,
      {
        ref,
        className: cn("-mx-1 my-1 h-px bg-muted", className),
        ...props
      }
    ));
    SelectSeparator.displayName = SelectPrimitive.Separator.displayName;
  }
});

// client/src/hooks/use-categories.ts
import { useQuery as useQuery11 } from "@tanstack/react-query";
function useCategories() {
  return useQuery11({ queryKey: ["/api/categories"], staleTime: 3e4 });
}
var init_use_categories = __esm({
  "client/src/hooks/use-categories.ts"() {
    "use strict";
  }
});

// shared/money.ts
function readAmount(amount2, currency2, allowTrailingZeros) {
  const digits = currencyDigits(currency2);
  if (typeof amount2 !== "string" || amount2.length > 24 || !/^(?:0|[1-9]\d{0,7})(?:\.\d+)?$/.test(amount2)) throw new RangeError("Invalid money amount");
  const [whole, fraction = ""] = amount2.split(".");
  if (fraction.length > digits && (!allowTrailingZeros || /[1-9]/.test(fraction.slice(digits)))) throw new RangeError("Invalid currency precision");
  const minor = BigInt(whole) * scale(digits) + BigInt(fraction.slice(0, digits).padEnd(digits, "0") || "0");
  if (minor * scale(3 - digits) > BigInt("99999999990")) throw new RangeError("Money amount exceeds limit");
  return { minor, digits };
}
function parseMoneyAmount(amount2, currency2) {
  const { minor } = readAmount(amount2, currency2, false);
  return minorToAmount(minor, currency2);
}
function normalizeMoneyAmount(amount2, currency2) {
  const { minor } = readAmount(amount2, currency2, true);
  return minorToAmount(minor, currency2);
}
function amountToMinor(amount2, currency2) {
  return readAmount(amount2, currency2, false).minor;
}
function minorToAmount(minor, currency2) {
  const digits = currencyDigits(currency2);
  if (typeof minor !== "bigint" || minor < zero) throw new RangeError("Invalid minor units");
  const divisor = scale(digits);
  return String(minor / divisor) + (digits ? "." + String(minor % divisor).padStart(digits, "0") : "");
}
function calculateBookingAmounts(price, currency2, participants, advancePercent) {
  if (!Number.isSafeInteger(participants) || participants < 1 || !Number.isSafeInteger(advancePercent) || advancePercent < 0 || advancePercent > 100) throw new RangeError("Invalid booking amount inputs");
  const unit = amountToMinor(normalizeMoneyAmount(price, currency2), currency2);
  const total = unit * BigInt(participants);
  const totalAmount = parseMoneyAmount(minorToAmount(total, currency2), currency2);
  const advance = (total * BigInt(advancePercent) + BigInt(50)) / BigInt(100);
  return { totalAmount, advanceAmount: minorToAmount(advance, currency2), balanceAmount: minorToAmount(total - advance, currency2) };
}
var zero, scale;
var init_money2 = __esm({
  "shared/money.ts"() {
    "use strict";
    init_currencies();
    zero = BigInt(0);
    scale = (digits) => [BigInt(1), BigInt(10), BigInt(100), BigInt(1e3)][digits];
  }
});

// client/src/lib/money-input.ts
function parseMoneyInput(value, currency2, locale) {
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const input2 = value.trim();
  const normalized = decimal !== "." && input2.includes(decimal) ? input2.replace(decimal, ".") : input2;
  try {
    return parseMoneyAmount(normalized, currency2);
  } catch {
    return null;
  }
}
var init_money_input = __esm({
  "client/src/lib/money-input.ts"() {
    "use strict";
    init_money2();
  }
});

// client/src/components/provider/service-field-feedback.tsx
import { jsx as jsx32 } from "react/jsx-runtime";
function fieldFeedback(errors, field, help) {
  return {
    "aria-invalid": Boolean(errors[field]) || void 0,
    "aria-describedby": [help, errors[field] ? `${serviceControlIds[field]}-error` : void 0].filter(Boolean).join(" ") || void 0
  };
}
function ServiceFieldError({ errors, field }) {
  return errors[field] ? /* @__PURE__ */ jsx32("p", { id: `${serviceControlIds[field]}-error`, className: "text-sm text-red-700 dark:text-red-300", children: errors[field] }) : null;
}
function validateServiceDraft(draft, locale = "en") {
  const errors = {};
  if (!draft.name.trim()) errors.name = "serviceForm.nameRequired";
  if (!draft.category) errors.category = "serviceForm.categoryRequired";
  if (!isSupportedCurrency(draft.currency)) errors.currency = "currency.choose";
  else if (parseMoneyInput(draft.price, draft.currency, locale) === null) errors.price = "currency.priceInvalid";
  if (!Number.isSafeInteger(draft.duration) || draft.duration < 1) errors.duration = "serviceDuration.invalid";
  if (!Number.isInteger(draft.cleanupTime) || draft.cleanupTime < 0 || draft.cleanupTime > 1440) errors.cleanupTime = "serviceCleanup.invalid";
  if (!Number.isInteger(draft.maxCapacity) || draft.maxCapacity < 1) errors.maxCapacity = "serviceForm.positiveWhole";
  if (!Number.isInteger(draft.advancePaymentPercent) || draft.advancePaymentPercent < 0 || draft.advancePaymentPercent > 100) errors.advancePaymentPercent = "serviceForm.advanceInvalid";
  if (!draft.addressId) errors.addressId = "serviceForm.addressRequired";
  if (!Number.isInteger(draft.reminderHours) || draft.reminderHours < 1 || draft.reminderHours > 168) errors.reminderHours = "notifications.hoursInvalid";
  if (draft.reminderMessage.trim().length > 1e3) errors.reminderMessage = "notifications.customMessageInvalid";
  if (draft.externalUrl) {
    try {
      if (!["http:", "https:"].includes(new URL(draft.externalUrl).protocol)) errors.externalUrl = "serviceForm.urlInvalid";
    } catch {
      errors.externalUrl = "serviceForm.urlInvalid";
    }
  }
  return errors;
}
var serviceControlIds;
var init_service_field_feedback = __esm({
  "client/src/components/provider/service-field-feedback.tsx"() {
    "use strict";
    init_currencies();
    init_money_input();
    serviceControlIds = {
      name: "serviceName",
      category: "category",
      price: "price",
      currency: "service-currency",
      duration: "duration",
      cleanupTime: "cleanupTime",
      maxCapacity: "maxCapacity",
      advancePaymentPercent: "advancePayment",
      addressId: "service-address",
      externalUrl: "externalUrl",
      reminderHours: "service-reminder-hours",
      reminderMessage: "service-reminder-message"
    };
  }
});

// client/src/components/provider/service-details-fields.tsx
import { useTranslation as useTranslation21 } from "react-i18next";
import { jsx as jsx33, jsxs as jsxs25 } from "react/jsx-runtime";
function ServiceDetailsFields({ newService, setNewService, company: company2, employees, errors = {} }) {
  const categories = useCategories();
  const { t, i18n } = useTranslation21();
  return /* @__PURE__ */ jsxs25("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs25("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs25(Label, { htmlFor: "serviceName", children: [
        t("serviceForm.name"),
        " *"
      ] }),
      /* @__PURE__ */ jsx33(
        Input,
        {
          id: "serviceName",
          className: "min-h-11",
          required: true,
          dir: "auto",
          value: newService.name,
          ...fieldFeedback(errors, "name"),
          onChange: (event) => setNewService((prev) => ({ ...prev, name: event.target.value }))
        }
      ),
      /* @__PURE__ */ jsx33(ServiceFieldError, { errors, field: "name" })
    ] }),
    /* @__PURE__ */ jsxs25("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs25(Label, { htmlFor: "category", children: [
        t("filters.category"),
        " *"
      ] }),
      /* @__PURE__ */ jsxs25(
        Select,
        {
          required: true,
          dir: i18n.dir(),
          disabled: !categories.data?.length,
          value: newService.category,
          onValueChange: (value) => setNewService((prev) => ({ ...prev, category: value })),
          children: [
            /* @__PURE__ */ jsx33(SelectTrigger, { id: "category", className: "min-h-11 h-auto text-start [&>span]:whitespace-normal", ...fieldFeedback(errors, "category", "category-status"), children: /* @__PURE__ */ jsx33(SelectValue, { placeholder: t("serviceForm.chooseCategory") }) }),
            /* @__PURE__ */ jsx33(SelectContent, { children: categories.data?.map((category) => /* @__PURE__ */ jsx33(SelectItem, { value: category.key, children: /* @__PURE__ */ jsxs25("bdi", { children: [
              category.icon,
              " ",
              category.name
            ] }) }, category.key)) })
          ]
        }
      ),
      /* @__PURE__ */ jsx33(ServiceFieldError, { errors, field: "category" }),
      /* @__PURE__ */ jsx33("div", { id: "category-status", className: "text-sm text-muted-foreground", children: categories.isError ? /* @__PURE__ */ jsxs25("p", { role: "alert", children: [
        t("serviceForm.categoriesError"),
        " ",
        /* @__PURE__ */ jsx33("button", { type: "button", className: "underline min-h-11", onClick: () => void categories.refetch(), children: t("publicSearch.retry") })
      ] }) : categories.isPending ? /* @__PURE__ */ jsx33("p", { role: "status", children: t("serviceForm.categoriesLoading") }) : !categories.data.length && /* @__PURE__ */ jsx33("p", { children: t("serviceForm.categoriesEmpty") }) })
    ] }),
    /* @__PURE__ */ jsxs25("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx33(Label, { htmlFor: "description", children: t("serviceForm.description") }),
      /* @__PURE__ */ jsx33(Textarea, { id: "description", dir: "auto", value: newService.description, onChange: (event) => setNewService((prev) => ({ ...prev, description: event.target.value })) })
    ] }),
    company2 && /* @__PURE__ */ jsxs25("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx33(Label, { htmlFor: "service-employee", children: t("serviceForm.employee") }),
      /* @__PURE__ */ jsxs25(
        "select",
        {
          id: "service-employee",
          className: "w-full min-h-11 border rounded-md p-2 bg-background",
          value: newService.employeeId ?? "none",
          "aria-describedby": "service-employee-help",
          onChange: (event) => setNewService((prev) => ({ ...prev, employeeId: event.target.value === "none" ? null : Number(event.target.value) })),
          "data-testid": "select-service-employee",
          children: [
            /* @__PURE__ */ jsx33("option", { value: "none", children: t("serviceForm.sharedSchedule") }),
            employees.map((employee) => /* @__PURE__ */ jsx33("option", { value: employee.id, dir: "auto", children: employee.name }, employee.id))
          ]
        }
      ),
      /* @__PURE__ */ jsx33("p", { id: "service-employee-help", className: "text-sm text-muted-foreground", children: t("serviceForm.employeeHelp") })
    ] })
  ] });
}
var init_service_details_fields = __esm({
  "client/src/components/provider/service-details-fields.tsx"() {
    "use strict";
    init_input();
    init_label();
    init_textarea();
    init_select();
    init_use_categories();
    init_service_field_feedback();
  }
});

// client/src/components/ui/switch.tsx
import * as React11 from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { jsx as jsx34 } from "react/jsx-runtime";
var Switch;
var init_switch = __esm({
  "client/src/components/ui/switch.tsx"() {
    "use strict";
    init_utils();
    Switch = React11.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx34(
      SwitchPrimitives.Root,
      {
        className: cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
          className
        ),
        ...props,
        ref,
        children: /* @__PURE__ */ jsx34(
          SwitchPrimitives.Thumb,
          {
            className: cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
            )
          }
        )
      }
    ));
    Switch.displayName = SwitchPrimitives.Root.displayName;
  }
});

// client/src/components/provider/service-duration-field.tsx
import { useState as useState14 } from "react";
import { useTranslation as useTranslation22 } from "react-i18next";
import { jsx as jsx35, jsxs as jsxs26 } from "react/jsx-runtime";
function ServiceDurationField({ newService, setNewService, errors, field = "duration" }) {
  const { t } = useTranslation22();
  const [unit, setUnit] = useState14(() => preferredDurationUnit(newService[field]));
  const [value, setValue] = useState14(() => String(newService[field] / minutesPerUnit[unit]));
  return /* @__PURE__ */ jsxs26("div", { className: "space-y-2 min-w-0", children: [
    /* @__PURE__ */ jsxs26("div", { className: "grid grid-cols-2 gap-2 items-end", children: [
      /* @__PURE__ */ jsxs26("div", { className: "space-y-2 min-w-0", children: [
        /* @__PURE__ */ jsxs26(Label, { id: `${field}-label`, htmlFor: field, children: [
          t(field === "cleanupTime" ? "serviceCleanup.label" : "serviceDuration.label"),
          " *"
        ] }),
        /* @__PURE__ */ jsx35(
          Input,
          {
            id: field,
            className: "min-h-11",
            type: "text",
            inputMode: "decimal",
            required: true,
            value,
            "data-testid": field === "cleanupTime" ? "input-cleanup-time" : void 0,
            ...fieldFeedback(errors, field, `${field}-help`),
            onChange: (event) => {
              const nextValue = event.target.value;
              setValue(nextValue);
              setNewService((previous) => ({ ...previous, [field]: durationInMinutes(nextValue, unit) }));
            }
          }
        )
      ] }),
      /* @__PURE__ */ jsxs26("div", { className: "space-y-2 min-w-0", children: [
        /* @__PURE__ */ jsx35(Label, { id: `${field}-unit-label`, htmlFor: `${field}-unit`, children: t("serviceDuration.unit") }),
        /* @__PURE__ */ jsx35(
          "select",
          {
            id: `${field}-unit`,
            className: "w-full min-h-11 border rounded-md p-2 bg-background text-sm",
            value: unit,
            "aria-labelledby": `${field}-label ${field}-unit-label`,
            "aria-describedby": `${field}-help`,
            onChange: (event) => {
              const nextUnit = event.target.value;
              setUnit(nextUnit);
              if (Number.isFinite(newService[field])) setValue(String(newService[field] / minutesPerUnit[nextUnit]));
            },
            children: durationUnits.map((option) => /* @__PURE__ */ jsx35("option", { value: option, children: t(`serviceDuration.${option}`) }, option))
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs26("div", { id: `${field}-help`, className: "text-sm text-muted-foreground space-y-2", children: [
      field === "cleanupTime" && /* @__PURE__ */ jsx35("p", { children: t("serviceCleanup.help") }),
      /* @__PURE__ */ jsx35("p", { children: t("serviceDuration.help") })
    ] }),
    /* @__PURE__ */ jsx35(ServiceFieldError, { errors, field })
  ] });
}
var init_service_duration_field = __esm({
  "client/src/components/provider/service-duration-field.tsx"() {
    "use strict";
    init_input();
    init_label();
    init_service_duration();
    init_service_field_feedback();
  }
});

// client/src/components/provider/service-booking-fields.tsx
import { useTranslation as useTranslation23 } from "react-i18next";
import { jsx as jsx36, jsxs as jsxs27 } from "react/jsx-runtime";
function ServiceBookingFields({ newService, setNewService, errors = {}, onCurrencyChoice, onPriceChange }) {
  const { t, i18n } = useTranslation23();
  const currencyNames = new Intl.DisplayNames([i18n.resolvedLanguage || i18n.language], { type: "currency" });
  const numeric = (field, id, label, min, max) => /* @__PURE__ */ jsxs27("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsx36(Label, { htmlFor: id, children: label }),
    /* @__PURE__ */ jsx36(
      Input,
      {
        id,
        className: "min-h-11",
        type: "number",
        min,
        max,
        step: "1",
        required: field !== "advancePaymentPercent",
        value: Number.isNaN(newService[field]) ? "" : newService[field],
        ...fieldFeedback(errors, field),
        onChange: (event) => setNewService((prev) => ({ ...prev, [field]: event.target.value === "" ? field === "advancePaymentPercent" ? 0 : NaN : Number(event.target.value) })),
        "data-testid": field === "advancePaymentPercent" ? "input-advance-payment" : void 0
      }
    ),
    /* @__PURE__ */ jsx36(ServiceFieldError, { errors, field })
  ] });
  return /* @__PURE__ */ jsxs27("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs27("fieldset", { className: "min-w-0 space-y-2", children: [
      /* @__PURE__ */ jsx36("legend", { className: "text-sm font-medium mb-2", children: t("filters.serviceType") }),
      /* @__PURE__ */ jsx36("div", { className: "grid sm:grid-cols-2 gap-2", children: ["one_to_one", "group"].map((value) => /* @__PURE__ */ jsxs27("label", { className: "flex items-center gap-3 border rounded-lg min-h-11 p-3 has-[:checked]:border-primary", children: [
        /* @__PURE__ */ jsx36(
          "input",
          {
            type: "radio",
            name: "serviceType",
            value,
            checked: newService.serviceType === value,
            className: "accent-primary h-4 w-4 shrink-0",
            onChange: () => setNewService((prev) => ({ ...prev, serviceType: value, maxCapacity: value === "one_to_one" ? 1 : 10 }))
          }
        ),
        t(value === "group" ? "filters.group" : "filters.oneToOne")
      ] }, value)) })
    ] }),
    newService.serviceType === "group" && numeric("maxCapacity", "maxCapacity", `${t("service.capacity")} *`, 1),
    /* @__PURE__ */ jsxs27("div", { className: "grid sm:grid-cols-2 gap-4", children: [
      /* @__PURE__ */ jsx36(ServiceDurationField, { newService, setNewService, errors }),
      /* @__PURE__ */ jsx36(ServiceDurationField, { field: "cleanupTime", newService, setNewService, errors })
    ] }),
    /* @__PURE__ */ jsxs27("div", { className: "grid sm:grid-cols-2 gap-4", children: [
      /* @__PURE__ */ jsxs27("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs27(Label, { htmlFor: "price", children: [
          t("serviceForm.price"),
          " *"
        ] }),
        /* @__PURE__ */ jsx36(
          Input,
          {
            id: "price",
            className: "min-h-11",
            type: "text",
            inputMode: "decimal",
            required: true,
            value: newService.price,
            ...fieldFeedback(errors, "price", "service-price-help"),
            onChange: (event) => {
              const price = event.target.value;
              if (onPriceChange) onPriceChange(price);
              else setNewService((prev) => ({ ...prev, price }));
            }
          }
        ),
        /* @__PURE__ */ jsx36("p", { id: "service-price-help", className: "text-sm text-muted-foreground", children: t("currency.precision", { digits: isSupportedCurrency(newService.currency) ? currencyDigits(newService.currency) : "\u2014" }) }),
        /* @__PURE__ */ jsx36(ServiceFieldError, { errors, field: "price" })
      ] }),
      /* @__PURE__ */ jsxs27("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs27(Label, { htmlFor: "service-currency", children: [
          t("currency.label"),
          " *"
        ] }),
        /* @__PURE__ */ jsxs27(
          "select",
          {
            id: "service-currency",
            required: true,
            className: "w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base",
            value: newService.currency,
            ...fieldFeedback(errors, "currency", "service-currency-help"),
            onChange: (event) => {
              const currency2 = event.target.value;
              onCurrencyChoice?.(currency2);
              setNewService((prev) => ({ ...prev, currency: currency2 }));
            },
            children: [
              /* @__PURE__ */ jsx36("option", { value: "", children: t("currency.choose") }),
              SUPPORTED_CURRENCIES.map((code) => /* @__PURE__ */ jsxs27("option", { value: code, children: [
                code,
                " \u2014 ",
                currencyNames.of(code) || code
              ] }, code))
            ]
          }
        ),
        /* @__PURE__ */ jsx36("p", { id: "service-currency-help", className: "text-sm text-muted-foreground", children: t("currency.serviceHelp") }),
        /* @__PURE__ */ jsx36(ServiceFieldError, { errors, field: "currency" })
      ] })
    ] }),
    numeric("advancePaymentPercent", "advancePayment", t("serviceForm.advance"), 0, 100)
  ] });
}
function ServiceAudienceFields({ newService, setNewService }) {
  const { t } = useTranslation23();
  return /* @__PURE__ */ jsxs27("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs27("fieldset", { className: "min-w-0", children: [
      /* @__PURE__ */ jsx36("legend", { className: "text-sm font-medium mb-2", children: t("serviceForm.ageGroups") }),
      /* @__PURE__ */ jsx36("div", { className: "grid sm:grid-cols-2 gap-2", children: ["children", "teens", "adults", "seniors"].map((value) => /* @__PURE__ */ jsxs27("label", { className: "flex items-center gap-3 border rounded-lg min-h-11 p-3 has-[:checked]:border-primary", children: [
        /* @__PURE__ */ jsx36(
          "input",
          {
            type: "checkbox",
            className: "accent-primary h-4 w-4 shrink-0",
            checked: newService.ageGroups.includes(value),
            "data-testid": `button-age-${value}`,
            onChange: () => setNewService((prev) => ({ ...prev, ageGroups: prev.ageGroups.includes(value) ? prev.ageGroups.filter((group) => group !== value) : [...prev.ageGroups, value] }))
          }
        ),
        t(`serviceForm.age_${value}`)
      ] }, value)) })
    ] }),
    /* @__PURE__ */ jsxs27("fieldset", { className: "min-w-0", children: [
      /* @__PURE__ */ jsx36("legend", { className: "text-sm font-medium mb-2", children: t("serviceForm.gender") }),
      /* @__PURE__ */ jsx36("div", { className: "grid sm:grid-cols-3 gap-2", children: ["females", "males", "both"].map((value) => /* @__PURE__ */ jsxs27("label", { className: "flex items-center gap-3 border rounded-lg min-h-11 p-3 has-[:checked]:border-primary", children: [
        /* @__PURE__ */ jsx36(
          "input",
          {
            type: "radio",
            name: "targetGender",
            className: "accent-primary h-4 w-4 shrink-0",
            checked: newService.targetGender === value,
            "data-testid": `button-gender-${value}`,
            onChange: () => setNewService((prev) => ({ ...prev, targetGender: value }))
          }
        ),
        t(`serviceForm.gender_${value}`)
      ] }, value)) })
    ] })
  ] });
}
function ServiceInstantBookingField({ newService, setNewService }) {
  const { t } = useTranslation23();
  return /* @__PURE__ */ jsxs27("div", { className: "flex items-center justify-between gap-4", children: [
    /* @__PURE__ */ jsx36(Label, { htmlFor: "instantBooking", className: "py-3", children: t("serviceForm.instantBooking") }),
    /* @__PURE__ */ jsx36(Switch, { id: "instantBooking", checked: newService.instantBooking, onCheckedChange: (checked) => setNewService((prev) => ({ ...prev, instantBooking: checked })) })
  ] });
}
var init_service_booking_fields = __esm({
  "client/src/components/provider/service-booking-fields.tsx"() {
    "use strict";
    init_input();
    init_label();
    init_switch();
    init_service_field_feedback();
    init_currencies();
    init_service_duration_field();
  }
});

// client/src/components/provider/service-location-fields.tsx
import { useTranslation as useTranslation24 } from "react-i18next";
import { jsx as jsx37, jsxs as jsxs28 } from "react/jsx-runtime";
function ServiceLocationFields({ newService, setNewService, errors = {}, addresses }) {
  const { t } = useTranslation24();
  return /* @__PURE__ */ jsxs28("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxs28(Label, { htmlFor: "service-address", children: [
      t("serviceForm.address"),
      " *"
    ] }),
    /* @__PURE__ */ jsxs28(
      "select",
      {
        id: "service-address",
        className: "w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base",
        value: newService.addressId ?? "",
        disabled: addresses.isLoading || addresses.isError,
        "data-testid": "select-service-address",
        ...fieldFeedback(errors, "addressId", "service-address-help service-address-status"),
        onChange: (event) => {
          const addressId = event.target.value ? Number(event.target.value) : null;
          setNewService((prev) => ({ ...prev, addressId }));
        },
        children: [
          /* @__PURE__ */ jsx37("option", { value: "", children: t(addresses.isLoading ? "serviceForm.addressesLoading" : "serviceForm.chooseAddress") }),
          addresses.data?.map((address) => /* @__PURE__ */ jsx37("option", { value: address.id, dir: "auto", disabled: !address.address, children: address.address || t("serviceForm.addressNeedsUpdate") }, address.id))
        ]
      }
    ),
    /* @__PURE__ */ jsx37(ServiceFieldError, { errors, field: "addressId" }),
    /* @__PURE__ */ jsxs28("div", { id: "service-address-status", className: "text-sm text-muted-foreground", children: [
      addresses.isLoading && /* @__PURE__ */ jsx37("p", { role: "status", children: t("serviceForm.addressesLoading") }),
      addresses.isError && /* @__PURE__ */ jsxs28("p", { role: "alert", children: [
        t("serviceForm.addressesError"),
        " ",
        /* @__PURE__ */ jsx37("button", { type: "button", className: "underline min-h-11", onClick: () => void addresses.refetch(), children: t("publicSearch.retry") })
      ] }),
      addresses.data?.length === 0 && /* @__PURE__ */ jsx37("p", { children: t("serviceForm.addressesEmpty") })
    ] }),
    /* @__PURE__ */ jsxs28("p", { id: "service-address-help", className: "text-sm text-muted-foreground", children: [
      t("serviceForm.addressHelp"),
      " ",
      /* @__PURE__ */ jsx37("a", { href: "/my-services/settings/addresses", target: "_blank", rel: "noopener noreferrer", className: "underline text-primary inline-block py-2", children: t("serviceForm.manageAddresses") })
    ] })
  ] });
}
var init_service_location_fields = __esm({
  "client/src/components/provider/service-location-fields.tsx"() {
    "use strict";
    init_label();
    init_service_field_feedback();
  }
});

// client/src/components/ImageUploader.tsx
import { useEffect as useEffect11, useRef as useRef9, useState as useState15 } from "react";
import { useTranslation as useTranslation25 } from "react-i18next";
import { Fragment as Fragment7, jsx as jsx38, jsxs as jsxs29 } from "react/jsx-runtime";
function ImageUploader({ onComplete, buttonClassName, disabled = false, onBusyChange, children }) {
  const { t } = useTranslation25();
  const input2 = useRef9(null);
  const [busy, setBusy] = useState15(false);
  const locked = useRef9(false), mounted = useRef9(true);
  useEffect11(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { toast: toast2 } = useToast();
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file || disabled || locked.current) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      toast2({ title: t("storefront.imageChoose"), description: t("storefront.imageHelp"), variant: "destructive" });
      event.target.value = "";
      return;
    }
    locked.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const signed = await apiRequest("POST", "/api/objects/upload", { contentType: file.type, size: file.size });
      const { signedUrl, objectPath } = await signed.json();
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const result = await fetch(signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body, credentials: "omit" });
      if (!result.ok) throw new Error("Upload failed");
      const confirmed = await apiRequest("PUT", "/api/service-images", { objectPath });
      const image = await confirmed.json();
      if (!mounted.current) return;
      onComplete(image.objectPath);
      toast2({ title: t("storefront.imageUploaded"), description: t("storefront.imageReady") });
    } catch {
      if (mounted.current) toast2({ title: t("storefront.imageUploadError"), variant: "destructive" });
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusyChange?.(false);
        if (input2.current) input2.current.value = "";
      }
    }
  }
  return /* @__PURE__ */ jsxs29(Fragment7, { children: [
    /* @__PURE__ */ jsx38("input", { ref: input2, type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", className: "hidden", disabled: disabled || busy, onChange: upload, "aria-label": t("storefront.imageChoose") }),
    /* @__PURE__ */ jsx38(Button, { type: "button", className: buttonClassName, disabled: disabled || busy, onClick: () => input2.current?.click(), "data-testid": "button-upload-image", children: busy ? t("storefront.imageUploading") : children })
  ] });
}
var init_ImageUploader = __esm({
  "client/src/components/ImageUploader.tsx"() {
    "use strict";
    init_button();
    init_queryClient();
    init_use_toast();
  }
});

// client/src/components/provider/service-media-fields.tsx
import { useState as useState16 } from "react";
import { Link as Link7 } from "wouter";
import { useTranslation as useTranslation26 } from "react-i18next";
import { Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { jsx as jsx39, jsxs as jsxs30 } from "react/jsx-runtime";
function ServiceMediaFields({ newService, setNewService, errors = {}, onBusyChange }) {
  const { t } = useTranslation26();
  const capabilities = useNotificationCapabilities();
  const pro = capabilities.data?.hasPro === true && !capabilities.isError;
  const limit = pro ? 10 : 1;
  const images = serviceImages(newService);
  const [busy, setBusy] = useState16(false);
  const changeImages = (update) => setNewService((previous) => ({ ...previous, ...imageDraft(update(serviceImages(previous))) }));
  return /* @__PURE__ */ jsxs30("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs30("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx39("p", { className: "text-sm font-medium", children: t("servicePictures.title") }),
      /* @__PURE__ */ jsx39("p", { className: "text-sm text-muted-foreground", children: t("servicePictures.help", { max: limit }) }),
      capabilities.isPending ? /* @__PURE__ */ jsx39("p", { role: "status", className: "text-sm", children: t("notifications.loading") }) : capabilities.isError ? /* @__PURE__ */ jsxs30("p", { role: "alert", className: "text-sm", children: [
        t("notifications.capabilityError"),
        " ",
        /* @__PURE__ */ jsx39("button", { type: "button", className: "underline min-h-11", onClick: () => void capabilities.refetch(), children: t("publicSearch.retry") })
      ] }) : !pro && /* @__PURE__ */ jsxs30("p", { className: "text-sm", children: [
        t("servicePictures.proHelp"),
        " ",
        /* @__PURE__ */ jsx39(Link7, { className: "underline py-2 inline-block", href: "/my-services/settings/billing", children: t("notifications.subscription") })
      ] }),
      !pro && images.length > 1 && /* @__PURE__ */ jsx39("p", { role: "status", className: "text-sm", children: t("servicePictures.retained") }),
      images.length > 0 && /* @__PURE__ */ jsx39("ol", { className: "grid grid-cols-2 sm:grid-cols-3 gap-3", "aria-label": t("servicePictures.title"), "data-testid": "service-picture-list", children: images.map((path, index) => /* @__PURE__ */ jsxs30("li", { className: "min-w-0 rounded-lg border p-2 space-y-2", children: [
        /* @__PURE__ */ jsx39("img", { src: path, alt: t("servicePictures.preview", { current: index + 1 }), className: "w-full h-24 object-contain rounded-md bg-muted" }),
        index === 0 ? /* @__PURE__ */ jsx39("p", { className: "text-sm font-medium min-h-11 flex items-center", children: t("servicePictures.cover") }) : /* @__PURE__ */ jsx39(Button, { type: "button", variant: "outline", className: "w-full min-h-11 h-auto whitespace-normal text-sm", disabled: busy, onClick: () => changeImages((current) => [path, ...current.filter((item) => item !== path)]), "aria-label": t("servicePictures.makeCoverLabel", { current: index + 1 }), "data-testid": `service-picture-cover-${index}`, children: t("servicePictures.makeCover") }),
        /* @__PURE__ */ jsx39(Button, { type: "button", variant: "outline", className: "w-full min-h-11 h-auto whitespace-normal text-sm", disabled: busy, onClick: () => changeImages((current) => current.filter((item) => item !== path)), "aria-label": t("servicePictures.removeLabel", { current: index + 1 }), "data-testid": `service-picture-remove-${index}`, children: t("servicePictures.remove") })
      ] }, path)) }),
      /* @__PURE__ */ jsxs30(
        ImageUploader,
        {
          disabled: images.length >= limit,
          onBusyChange: (value) => {
            setBusy(value);
            onBusyChange?.(value);
          },
          onComplete: (objectPath) => changeImages((current) => current.length < limit && !current.includes(objectPath) ? [...current, objectPath] : current),
          buttonClassName: "w-full min-h-11 h-auto whitespace-normal",
          children: [
            /* @__PURE__ */ jsx39(ImageIcon, { className: "w-4 h-4 shrink-0", "aria-hidden": "true" }),
            t("servicePictures.add")
          ]
        }
      ),
      /* @__PURE__ */ jsx39("p", { role: "status", className: "text-sm text-muted-foreground", children: t("servicePictures.selected", { current: images.length, max: limit }) })
    ] }),
    /* @__PURE__ */ jsxs30("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx39(Label, { htmlFor: "externalUrl", children: t("serviceForm.externalUrl") }),
      /* @__PURE__ */ jsxs30("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx39(LinkIcon, { className: "w-4 h-4 shrink-0 text-muted-foreground", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx39(
          Input,
          {
            id: "externalUrl",
            className: "min-h-11",
            type: "url",
            dir: "ltr",
            value: newService.externalUrl,
            onChange: (event) => setNewService((prev) => ({ ...prev, externalUrl: event.target.value })),
            ...fieldFeedback(errors, "externalUrl", "externalUrl-help"),
            "data-testid": "input-external-url"
          }
        )
      ] }),
      /* @__PURE__ */ jsx39(ServiceFieldError, { errors, field: "externalUrl" }),
      /* @__PURE__ */ jsx39("p", { id: "externalUrl-help", className: "text-sm text-muted-foreground", children: t("serviceForm.urlHelp") })
    ] })
  ] });
}
var init_service_media_fields = __esm({
  "client/src/components/provider/service-media-fields.tsx"() {
    "use strict";
    init_input();
    init_label();
    init_ImageUploader();
    init_button();
    init_use_notification_capabilities();
    init_service_images();
    init_service_field_feedback();
  }
});

// shared/notification-message.ts
function renderMessage(input2) {
  const language = copy[input2.language] ? input2.language : "en", words = copy[language];
  const format3 = (value) => `${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23", timeZone: input2.timeZone }).format(value)} (${input2.timeZone})`;
  const replacements = { service: input2.service.slice(0, 250), date: format3(input2.date), old: input2.oldDate ? format3(input2.oldDate) : "" };
  const text2 = words[input2.kind].replace(/\{(service|date|old)\}/g, (_match, key) => replacements[key]);
  const reminderMessage = input2.kind === "reminder" ? (input2.reminderMessage ?? "").trim() : "";
  return { subject: words.subject, message: `${text2}${reminderMessage ? `

${reminderMessage}` : ""}
${words.from}`, reminderMessage, date: format3(input2.date), oldDate: input2.oldDate ? format3(input2.oldDate) : "" };
}
var copy;
var init_notification_message = __esm({
  "shared/notification-message.ts"() {
    "use strict";
    copy = {
      en: { subject: "Appointment update", accepted: "Your requested service {service} on {date} has been accepted.", rejected: "Your requested service {service} on {date} has been rejected.", rescheduled: "Your requested service {service} has been rescheduled from {old} to {date}.", reminder: "Reminder: your appointment for {service} is on {date}.", from: "FitsMyTime" },
      lv: { subject: "Pieraksta izmai\u0146as", accepted: "J\u016Bsu piepras\u012Btais pakalpojums {service} {date} ir apstiprin\u0101ts.", rejected: "J\u016Bsu piepras\u012Btais pakalpojums {service} {date} ir noraid\u012Bts.", rescheduled: "J\u016Bsu piepras\u012Btais pakalpojums {service} ir p\u0101rcelts no {old} uz {date}.", reminder: "Atg\u0101din\u0101jums: J\u016Bsu pieraksts pakalpojumam {service} ir {date}.", from: "FitsMyTime" },
      ru: { subject: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438", accepted: "\u0412\u0430\u0448 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0443 {service} \u043D\u0430 {date} \u043F\u0440\u0438\u043D\u044F\u0442.", rejected: "\u0412\u0430\u0448 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0443 {service} \u043D\u0430 {date} \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D.", rescheduled: "\u0412\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0443 {service} \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u0430 \u0441 {old} \u043D\u0430 {date}.", reminder: "\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435: \u0432\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0443 {service} \u0441\u043E\u0441\u0442\u043E\u0438\u0442\u0441\u044F {date}.", from: "FitsMyTime" },
      ar: { subject: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0648\u0639\u062F", accepted: "\u062A\u0645 \u0642\u0628\u0648\u0644 \u0637\u0644\u0628 \u0627\u0644\u062E\u062F\u0645\u0629 {service} \u0641\u064A {date}.", rejected: "\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u062E\u062F\u0645\u0629 {service} \u0641\u064A {date}.", rescheduled: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0645\u0648\u0639\u062F \u0627\u0644\u062E\u062F\u0645\u0629 {service} \u0645\u0646 {old} \u0625\u0644\u0649 {date}.", reminder: "\u062A\u0630\u0643\u064A\u0631: \u0645\u0648\u0639\u062F \u0627\u0644\u062E\u062F\u0645\u0629 {service} \u0641\u064A {date}.", from: "FitsMyTime" },
      zh: { subject: "\u9884\u7EA6\u66F4\u65B0", accepted: "\u60A8\u7533\u8BF7\u7684\u670D\u52A1 {service}\uFF08{date}\uFF09\u5DF2\u88AB\u63A5\u53D7\u3002", rejected: "\u60A8\u7533\u8BF7\u7684\u670D\u52A1 {service}\uFF08{date}\uFF09\u5DF2\u88AB\u62D2\u7EDD\u3002", rescheduled: "\u60A8\u7684\u670D\u52A1 {service} \u5DF2\u4ECE {old} \u6539\u671F\u81F3 {date}\u3002", reminder: "\u63D0\u9192\uFF1A\u60A8\u9884\u7EA6\u7684\u670D\u52A1 {service} \u5C06\u4E8E {date} \u5F00\u59CB\u3002", from: "FitsMyTime" },
      fr: { subject: "Mise \xE0 jour du rendez-vous", accepted: "Votre demande de service {service} le {date} a \xE9t\xE9 accept\xE9e.", rejected: "Votre demande de service {service} le {date} a \xE9t\xE9 refus\xE9e.", rescheduled: "Votre service {service} a \xE9t\xE9 reprogramm\xE9 du {old} au {date}.", reminder: "Rappel : votre rendez-vous pour {service} est le {date}.", from: "FitsMyTime" },
      de: { subject: "Terminaktualisierung", accepted: "Ihre angefragte Leistung {service} am {date} wurde angenommen.", rejected: "Ihre angefragte Leistung {service} am {date} wurde abgelehnt.", rescheduled: "Ihr Termin f\xFCr {service} wurde vom {old} auf den {date} verschoben.", reminder: "Erinnerung: Ihr Termin f\xFCr {service} ist am {date}.", from: "FitsMyTime" },
      hi: { subject: "\u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F \u0905\u092A\u0921\u0947\u091F", accepted: "{date} \u0915\u094B \u0906\u092A\u0915\u0940 \u0905\u0928\u0941\u0930\u094B\u0927\u093F\u0924 \u0938\u0947\u0935\u093E {service} \u0938\u094D\u0935\u0940\u0915\u093E\u0930 \u0915\u0930 \u0932\u0940 \u0917\u0908 \u0939\u0948\u0964", rejected: "{date} \u0915\u094B \u0906\u092A\u0915\u0940 \u0905\u0928\u0941\u0930\u094B\u0927\u093F\u0924 \u0938\u0947\u0935\u093E {service} \u0905\u0938\u094D\u0935\u0940\u0915\u093E\u0930 \u0915\u0930 \u0926\u0940 \u0917\u0908 \u0939\u0948\u0964", rescheduled: "\u0906\u092A\u0915\u0940 \u0938\u0947\u0935\u093E {service} \u0915\u093E \u0938\u092E\u092F {old} \u0938\u0947 {date} \u0915\u0930 \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u0939\u0948\u0964", reminder: "\u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930: \u0938\u0947\u0935\u093E {service} \u0915\u0947 \u0932\u093F\u090F \u0906\u092A\u0915\u093E \u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F {date} \u0915\u094B \u0939\u0948\u0964", from: "FitsMyTime" },
      ja: { subject: "\u4E88\u7D04\u306E\u66F4\u65B0", accepted: "\u3054\u4F9D\u983C\u306E\u30B5\u30FC\u30D3\u30B9 {service}\uFF08{date}\uFF09\u304C\u627F\u8A8D\u3055\u308C\u307E\u3057\u305F\u3002", rejected: "\u3054\u4F9D\u983C\u306E\u30B5\u30FC\u30D3\u30B9 {service}\uFF08{date}\uFF09\u306F\u5374\u4E0B\u3055\u308C\u307E\u3057\u305F\u3002", rescheduled: "\u30B5\u30FC\u30D3\u30B9 {service} \u306E\u4E88\u7D04\u304C {old} \u304B\u3089 {date} \u306B\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002", reminder: "\u30EA\u30DE\u30A4\u30F3\u30C0\u30FC\uFF1A\u30B5\u30FC\u30D3\u30B9 {service} \u306E\u3054\u4E88\u7D04\u306F {date} \u3067\u3059\u3002", from: "FitsMyTime" },
      pt: { subject: "Atualiza\xE7\xE3o do agendamento", accepted: "O servi\xE7o solicitado {service} em {date} foi aceite.", rejected: "O servi\xE7o solicitado {service} em {date} foi recusado.", rescheduled: "O servi\xE7o {service} foi reagendado de {old} para {date}.", reminder: "Lembrete: o seu agendamento para {service} \xE9 em {date}.", from: "FitsMyTime" },
      es: { subject: "Actualizaci\xF3n de la cita", accepted: "Su solicitud del servicio {service} el {date} ha sido aceptada.", rejected: "Su solicitud del servicio {service} el {date} ha sido rechazada.", rescheduled: "Su servicio {service} se ha reprogramado del {old} al {date}.", reminder: "Recordatorio: su cita para {service} es el {date}.", from: "FitsMyTime" }
    };
  }
});

// client/src/components/provider/service-reminder-fields.tsx
import { Link as Link8 } from "wouter";
import { useTranslation as useTranslation27 } from "react-i18next";
import { jsx as jsx40, jsxs as jsxs31 } from "react/jsx-runtime";
function ServiceReminderFields({ draft, setDraft, errors }) {
  const { t, i18n } = useTranslation27();
  const capabilities = useNotificationCapabilities();
  const pro = capabilities.data?.hasPro === true && !capabilities.isError;
  const preview = renderMessage({ kind: "reminder", service: draft.name.trim() || t("notifications.sampleService"), date: /* @__PURE__ */ new Date("2030-01-18T15:00:00Z"), language: (i18n.resolvedLanguage || i18n.language).split("-")[0], timeZone: "UTC", reminderMessage: draft.reminderMessage });
  return /* @__PURE__ */ jsxs31("div", { className: "space-y-4", children: [
    capabilities.isPending ? /* @__PURE__ */ jsx40("p", { role: "status", children: t("notifications.loading") }) : capabilities.isError ? /* @__PURE__ */ jsx40("p", { role: "alert", children: t("notifications.capabilityError") }) : !pro ? /* @__PURE__ */ jsxs31("p", { className: "text-sm", children: [
      t("notifications.proBanner"),
      " ",
      /* @__PURE__ */ jsx40(Link8, { className: "underline py-2 inline-block", href: "/my-services/settings/billing", children: t("notifications.subscription") })
    ] }) : !capabilities.data.automationEnabled && /* @__PURE__ */ jsx40("p", { className: "text-sm", role: "status", children: t("notifications.automationUnavailable") }),
    /* @__PURE__ */ jsxs31("label", { className: "flex gap-3 items-start min-h-11", children: [
      /* @__PURE__ */ jsx40("input", { id: "service-reminder-enabled", type: "checkbox", className: "h-5 w-5 mt-1 shrink-0", disabled: !pro, checked: draft.reminderEnabled, onChange: (event) => setDraft((current) => ({ ...current, reminderEnabled: event.target.checked })) }),
      /* @__PURE__ */ jsx40("span", { children: t("notifications.enableReminder") })
    ] }),
    draft.reminderEnabled && /* @__PURE__ */ jsxs31("fieldset", { disabled: !pro, className: "grid gap-4 sm:grid-cols-2 min-w-0", children: [
      /* @__PURE__ */ jsxs31("div", { className: "space-y-2 min-w-0", children: [
        /* @__PURE__ */ jsx40(Label, { htmlFor: "service-reminder-method", children: t("notifications.reminderMethod") }),
        /* @__PURE__ */ jsx40("select", { id: "service-reminder-method", className: "border rounded-md bg-background min-h-11 p-2 w-full", value: draft.reminderMethod, onChange: (event) => setDraft((current) => ({ ...current, reminderMethod: event.target.value })), children: ["email", "sms", "whatsapp"].map((method) => /* @__PURE__ */ jsx40("option", { value: method, children: t(`notifications.method.${method}`) }, method)) })
      ] }),
      /* @__PURE__ */ jsxs31("div", { className: "space-y-2 min-w-0", children: [
        /* @__PURE__ */ jsx40(Label, { htmlFor: "service-reminder-hours", children: t("notifications.hours") }),
        /* @__PURE__ */ jsx40(Input, { id: "service-reminder-hours", type: "number", min: 1, max: 168, step: 1, value: Number.isNaN(draft.reminderHours) ? "" : draft.reminderHours, onChange: (event) => setDraft((current) => ({ ...current, reminderHours: event.target.value === "" ? Number.NaN : Number(event.target.value) })), ...fieldFeedback(errors, "reminderHours", "service-reminder-help") }),
        /* @__PURE__ */ jsx40(ServiceFieldError, { errors, field: "reminderHours" })
      ] }),
      /* @__PURE__ */ jsx40("p", { id: "service-reminder-help", className: "text-sm text-muted-foreground sm:col-span-2", children: t("notifications.reminderHelp") }),
      /* @__PURE__ */ jsxs31("div", { className: "space-y-2 min-w-0 sm:col-span-2", children: [
        /* @__PURE__ */ jsx40(Label, { htmlFor: "service-reminder-message", children: t("notifications.customMessage") }),
        /* @__PURE__ */ jsx40(Textarea, { id: "service-reminder-message", dir: "auto", rows: 4, maxLength: 1e3, value: draft.reminderMessage, onChange: (event) => setDraft((current) => ({ ...current, reminderMessage: event.target.value })), ...fieldFeedback(errors, "reminderMessage", "service-reminder-message-help service-reminder-message-count service-reminder-whatsapp-help") }),
        /* @__PURE__ */ jsx40("p", { id: "service-reminder-message-help", className: "text-sm text-muted-foreground", children: t("notifications.customMessageHelp") }),
        /* @__PURE__ */ jsx40("p", { id: "service-reminder-message-count", className: "text-sm text-muted-foreground", children: t("notifications.customMessageCount", { count: draft.reminderMessage.length }) }),
        /* @__PURE__ */ jsx40(ServiceFieldError, { errors, field: "reminderMessage" }),
        /* @__PURE__ */ jsx40("p", { id: "service-reminder-whatsapp-help", className: "text-sm text-muted-foreground", children: t("notifications.whatsappCustomMessageHelp") })
      ] }),
      /* @__PURE__ */ jsxs31("section", { className: "space-y-2 min-w-0 sm:col-span-2", "aria-labelledby": "service-reminder-preview-title", "aria-describedby": "service-reminder-preview-help", children: [
        /* @__PURE__ */ jsx40("h3", { id: "service-reminder-preview-title", className: "font-medium", children: t("notifications.messagePreview") }),
        /* @__PURE__ */ jsx40("p", { id: "service-reminder-preview-help", className: "text-sm text-muted-foreground", children: t("notifications.messagePreviewHelp") }),
        /* @__PURE__ */ jsx40("p", { id: "service-reminder-preview", dir: "auto", className: "whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg bg-muted p-3", children: preview.message })
      ] })
    ] })
  ] });
}
var init_service_reminder_fields = __esm({
  "client/src/components/provider/service-reminder-fields.tsx"() {
    "use strict";
    init_use_notification_capabilities();
    init_label();
    init_input();
    init_textarea();
    init_notification_message();
    init_service_field_feedback();
  }
});

// client/src/components/provider/service-navigation-guard.ts
function registerServiceExitBlocker(next) {
  blocker = next;
  return () => {
    if (blocker === next) blocker = void 0;
  };
}
function requestServiceEditorExit(proceed) {
  if (blocker) blocker(proceed);
  else void Promise.resolve(proceed()).catch(() => {
  });
}
var blocker;
var init_service_navigation_guard = __esm({
  "client/src/components/provider/service-navigation-guard.ts"() {
    "use strict";
  }
});

// shared/workspace-pricing.ts
import { z as z4 } from "zod";
var pricingWorkspaceSchema, currency, country, workspacePricingViewSchema, workspacePricingSettingsViewSchema, workspacePricingUpdateSchema, samePricingWorkspace;
var init_workspace_pricing = __esm({
  "shared/workspace-pricing.ts"() {
    "use strict";
    init_currencies();
    pricingWorkspaceSchema = z4.discriminatedUnion("kind", [
      z4.object({ kind: z4.literal("user"), id: z4.string().min(1).max(128) }).strict(),
      z4.object({ kind: z4.literal("company"), id: z4.number().int().positive().max(2147483647) }).strict()
    ]);
    currency = z4.string().refine(isSupportedCurrency, "Choose a supported currency.");
    country = z4.string().refine(isSupportedCountry, "Choose a supported country.");
    workspacePricingViewSchema = z4.object({
      workspace: pricingWorkspaceSchema,
      defaultCurrency: currency.nullable(),
      businessCountryCode: country.nullable(),
      revision: z4.number().int().min(0).max(2147483647),
      canEdit: z4.boolean()
    }).strict();
    workspacePricingSettingsViewSchema = workspacePricingViewSchema;
    workspacePricingUpdateSchema = z4.object({
      // Comparison binding only. The server always selects the target workspace.
      expectedWorkspace: pricingWorkspaceSchema,
      expectedRevision: z4.number().int().min(0).max(2147483646),
      defaultCurrency: currency.nullable().optional(),
      businessCountryCode: country.nullable().optional()
    }).strict().refine((input2) => input2.defaultCurrency !== void 0 || input2.businessCountryCode !== void 0, "Choose a setting to update.");
    samePricingWorkspace = (left, right) => left.kind === right.kind && left.id === right.id;
  }
});

// client/src/hooks/use-workspace-pricing.ts
import { useIsMutating as useIsMutating3, useQuery as useQuery12 } from "@tanstack/react-query";
function useWorkspacePricing(actorId, loadSettings = true) {
  const context2 = useProviderWorkspace();
  const switching = useIsMutating3({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  const allowed = Boolean(actorId && context2.data && !context2.isError && !context2.data.invalid && context2.data.permissions?.manageServices);
  const companyId = context2.data?.company?.id;
  const scope = allowed ? companyId != null ? `company:${companyId}` : `user:${actorId}` : null;
  const settings = useQuery12({
    queryKey: ["/api/workspace/pricing-settings", actorId, companyId ?? "personal"],
    enabled: allowed && !switching && loadSettings,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await apiRequest("GET", "/api/workspace/pricing-settings", void 0, signal);
      const parsed = workspacePricingSettingsViewSchema.parse(await response.json());
      if (`${parsed.workspace.kind}:${parsed.workspace.id}` !== scope) throw new Error("Workspace pricing scope changed");
      return parsed;
    }
  });
  const loading = Boolean(actorId && (switching || context2.isPending || loadSettings && allowed && settings.isPending));
  const error = context2.error || (loadSettings && allowed ? settings.error : null);
  const denied = loadSettings && settings.error instanceof Error && /^(401|403):/.test(settings.error.message);
  return {
    context: context2,
    settings,
    scope: denied ? null : scope,
    loading,
    allowed: allowed && !denied,
    error,
    switching,
    retry: () => {
      if (context2.isError) void context2.refetch();
      else void settings.refetch();
    }
  };
}
var init_use_workspace_pricing = __esm({
  "client/src/hooks/use-workspace-pricing.ts"() {
    "use strict";
    init_queryClient();
    init_use_provider_workspace();
    init_workspace_pricing();
  }
});

// shared/currency-defaults.ts
function resolveCurrencyDefault(input2) {
  if (input2.selected) return { currency: isSupportedCurrency(input2.selected.currency) ? input2.selected.currency : null, source: input2.selected.source };
  if (isSupportedCurrency(input2.location?.pricingCurrency)) return { currency: input2.location.pricingCurrency, source: "location" };
  if (isSupportedCurrency(input2.settings?.defaultCurrency)) return { currency: input2.settings.defaultCurrency, source: "workspace" };
  const serviceCurrency = suggestedCurrency(input2.location?.countryCode);
  if (serviceCurrency) return { currency: serviceCurrency, source: "serviceCountry" };
  const businessCurrency = suggestedCurrency(input2.settings?.businessCountryCode);
  return businessCurrency ? { currency: businessCurrency, source: "businessCountry" } : { currency: null, source: "none" };
}
var init_currency_defaults = __esm({
  "shared/currency-defaults.ts"() {
    "use strict";
    init_currencies();
  }
});

// client/src/components/provider/service-editor.tsx
import { Fragment as Fragment8, useEffect as useEffect12, useLayoutEffect, useRef as useRef10, useState as useState17 } from "react";
import { useTranslation as useTranslation28 } from "react-i18next";
import { useLocation as useLocation5 } from "wouter";
import { useMutation as useMutation6, useQuery as useQuery13, useQueryClient as useQueryClient8 } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { jsx as jsx41, jsxs as jsxs32 } from "react/jsx-runtime";
function FormSection({ number, title, children }) {
  return /* @__PURE__ */ jsxs32("section", { "aria-labelledby": `service-section-${number}`, className: "bg-card text-card-foreground border rounded-xl p-4 sm:p-6 space-y-5 min-w-0", children: [
    /* @__PURE__ */ jsxs32("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx41("span", { "aria-hidden": "true", className: "flex items-center justify-center shrink-0 rounded-lg border text-primary font-semibold w-8 h-8", children: number }),
      /* @__PURE__ */ jsx41("h2", { id: `service-section-${number}`, className: "text-lg font-semibold", children: title })
    ] }),
    children
  ] });
}
function ServiceEditor({ service: service2, employees, company: company2 }) {
  const { user: user2, isLoading } = useAuth();
  const pricing = useWorkspacePricing(user2?.id, !service2);
  const { t } = useTranslation28();
  if (isLoading || pricing.switching || pricing.context.isPending) return /* @__PURE__ */ jsx41("p", { role: "status", children: t("currency.defaultsLoading") });
  if (pricing.context.isError) return /* @__PURE__ */ jsxs32("div", { role: "alert", children: [
    t("currency.defaultsLoadError"),
    " ",
    /* @__PURE__ */ jsx41(Button, { onClick: pricing.retry, children: t("publicSearch.retry") })
  ] });
  if (!pricing.allowed || !user2 || !pricing.scope) return /* @__PURE__ */ jsx41("p", { role: "alert", children: t("serviceForm.denied") });
  return /* @__PURE__ */ jsx41(ServiceEditorContent, { service: service2, employees, company: company2, pricing, actorId: user2.id }, `${user2.id}:${pricing.scope}:${service2?.id ?? "new"}`);
}
function ServiceEditorContent({ service: service2, employees, company: company2, pricing, actorId }) {
  const { t, i18n } = useTranslation28();
  const [newService, setNewService] = useState17(() => createServiceDraft(service2));
  const [error, setError] = useState17("");
  const [fieldErrors, setFieldErrors] = useState17({});
  const [exit, setExit] = useState17(null);
  const [hideConfirmation, setHideConfirmation] = useState17(false);
  const [currencyConfirmation, setCurrencyConfirmation] = useState17(null);
  const [currencySelection, setCurrencySelection] = useState17(service2 ? { currency: service2.currency, source: "saved" } : null);
  const addresses = useQuery13({ queryKey: ["/api/addresses", actorId, pricing.scope], refetchOnWindowFocus: "always", gcTime: 0 });
  const selectedAddress = addresses.data?.find((address) => address.id === newService.addressId);
  const resolved = resolveCurrencyDefault({ location: selectedAddress, settings: pricing.settings.data });
  const availableDefault = (!pricing.settings.data || pricing.settings.isError) && resolved.source !== "location" ? { currency: null, source: "none" } : resolved;
  const choice = currencySelection ?? availableDefault;
  const draft = { ...newService, currency: choice.currency ?? "" };
  const localSuggestion = suggestedCurrency(selectedAddress?.countryCode);
  const [savingAs, setSavingAs] = useState17(null);
  const [uploading, setUploading] = useState17(false);
  const summary = useRef10(null);
  const lastExitTrigger = useRef10(null);
  const lastHideTrigger = useRef10(null);
  const bypassExit = useRef10(false);
  const allowUnload = useRef10(false);
  const submitting = useRef10(false);
  const queryClient3 = useQueryClient8();
  const [, navigate] = useLocation5();
  const { toast: toast2 } = useToast();
  const dirty = JSON.stringify(newService) !== JSON.stringify(createServiceDraft(service2));
  const errors = Object.fromEntries(Object.entries(fieldErrors).map(([field, key]) => [field, t(key)]));
  const hideMessageParts = t("serviceForm.hideHelp", { name: "\uFFFC" }).split("\uFFFC");
  useEffect12(() => {
    document.documentElement.lang = i18n.resolvedLanguage || i18n.language;
    document.documentElement.dir = i18n.dir();
  }, [i18n, i18n.language, i18n.resolvedLanguage]);
  useEffect12(() => {
    const beforeUnload = (event) => {
      if (!allowUnload.current && !bypassExit.current && (dirty || submitting.current)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  useLayoutEffect(() => {
    if (!dirty && !submitting.current) return;
    return registerServiceExitBlocker((proceed) => {
      if (bypassExit.current) {
        proceed();
        return;
      }
      if (submitting.current) return;
      lastExitTrigger.current = activeFocus();
      setExit((previous) => previous ?? { proceed });
    });
  }, [dirty, savingAs]);
  useEffect12(() => {
    const click2 = (event) => {
      if (bypassExit.current || !dirty && !submitting.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      requestServiceEditorExit(() => {
        allowUnload.current = true;
        anchor.click();
      });
    };
    document.addEventListener("click", click2, true);
    return () => document.removeEventListener("click", click2, true);
  }, [dirty]);
  const save = useMutation6({
    mutationFn: async (isActive) => (await apiRequest(service2 ? "PATCH" : "POST", service2 ? `/api/services/${service2.id}` : "/api/services", {
      ...draft,
      price: parseMoneyInput(draft.price, draft.currency, i18n.resolvedLanguage || i18n.language),
      isActive
    })).json(),
    onSuccess: async () => {
      await queryClient3.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/services/") });
      toast2({ title: t("serviceForm.saved") });
      bypassExit.current = true;
      navigate("/my-services/services", { state: { serviceSaved: true } });
    },
    onError: (error2) => {
      if (isUnauthorizedError(error2)) {
        bypassExit.current = true;
        window.location.assign("/login?returnTo=" + encodeURIComponent(service2 ? `/my-services/services/${service2.id}/edit` : "/my-services/services/new"));
        return;
      }
      setError(/^403:/.test(error2.message) ? "serviceForm.denied" : "serviceForm.saveError");
      queueMicrotask(() => summary.current?.focus());
    },
    onSettled: () => {
      submitting.current = false;
      setSavingAs(null);
    }
  });
  const submit = (isActive, confirmed = false, currencyConfirmed = false) => {
    if (submitting.current || save.isPending || uploading) return;
    const nextErrors = validateServiceDraft(draft, i18n.resolvedLanguage || i18n.language);
    setFieldErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) {
      queueMicrotask(() => summary.current?.focus());
      return;
    }
    if (service2 && draft.currency !== service2.currency && !currencyConfirmed) {
      setCurrencyConfirmation(isActive);
      return;
    }
    if (!isActive && service2?.isActive && !confirmed) {
      lastHideTrigger.current = activeFocus();
      setHideConfirmation(true);
      return;
    }
    submitting.current = true;
    setSavingAs(isActive);
    save.mutate(isActive);
  };
  const goBack = () => requestServiceEditorExit(() => {
    bypassExit.current = true;
    navigate("/my-services/services");
  });
  return /* @__PURE__ */ jsxs32("div", { className: "service-editor max-w-3xl mx-auto space-y-5 bg-background text-foreground", dir: i18n.dir(), children: [
    /* @__PURE__ */ jsxs32("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs32(Button, { type: "button", variant: "ghost", className: actionClass, disabled: save.isPending, onClick: goBack, children: [
        /* @__PURE__ */ jsx41(ArrowLeft, { className: "w-4 h-4 rtl:rotate-180", "aria-hidden": "true" }),
        t("serviceForm.back")
      ] }),
      dirty && /* @__PURE__ */ jsx41("p", { role: "status", className: "text-sm text-muted-foreground", children: t("serviceForm.unsaved") })
    ] }),
    /* @__PURE__ */ jsxs32("div", { children: [
      /* @__PURE__ */ jsx41("h1", { className: "text-2xl font-semibold", children: t(service2 ? "provider.editService" : "provider.addService") }),
      /* @__PURE__ */ jsx41("p", { className: "mt-2 text-muted-foreground", children: t("serviceForm.intro") }),
      /* @__PURE__ */ jsx41("p", { className: "mt-2 text-sm text-muted-foreground", children: t("serviceForm.required") })
    ] }),
    /* @__PURE__ */ jsxs32("form", { noValidate: true, onSubmit: (event) => {
      event.preventDefault();
      submit(true);
    }, className: "space-y-6", "aria-busy": save.isPending, children: [
      (error || Object.keys(errors).length > 0) && /* @__PURE__ */ jsxs32("div", { ref: summary, tabIndex: -1, role: "alert", className: "rounded-xl border border-red-700 dark:border-red-300 p-4 space-y-2 focus:outline focus:outline-2 focus:outline-offset-2", children: [
        /* @__PURE__ */ jsx41("h2", { className: "font-semibold", children: t(error || "serviceForm.checkFields") }),
        Object.keys(errors).length > 0 && /* @__PURE__ */ jsx41("ul", { className: "list-disc ps-5", children: Object.entries(errors).map(([field, message]) => /* @__PURE__ */ jsx41("li", { children: /* @__PURE__ */ jsx41(
          "a",
          {
            href: `#${serviceControlIds[field]}`,
            className: "underline py-2 inline-block",
            onClick: (event) => {
              event.preventDefault();
              document.getElementById(serviceControlIds[field])?.focus();
            },
            children: message
          }
        ) }, field)) })
      ] }),
      /* @__PURE__ */ jsxs32("fieldset", { disabled: save.isPending, className: "space-y-6 min-w-0", children: [
        /* @__PURE__ */ jsx41(FormSection, { number: 1, title: t("serviceForm.details"), children: /* @__PURE__ */ jsx41(ServiceDetailsFields, { newService, setNewService, employees, company: company2, errors }) }),
        /* @__PURE__ */ jsxs32(FormSection, { number: 2, title: t("serviceForm.sessionPrice"), children: [
          /* @__PURE__ */ jsx41(
            ServiceBookingFields,
            {
              newService: draft,
              setNewService,
              errors,
              onCurrencyChoice: (currency2) => setCurrencySelection({ currency: currency2, source: "manual" }),
              onPriceChange: (price) => {
                if (price.trim() && choice.currency) setCurrencySelection((previous) => previous ?? { currency: choice.currency, source: choice.source });
                if (!price.trim() && currencySelection && !["saved", "manual"].includes(currencySelection.source)) setCurrencySelection(null);
                setNewService((previous) => ({ ...previous, price }));
              }
            }
          ),
          choice.currency && /* @__PURE__ */ jsx41("p", { className: "text-sm text-muted-foreground", "data-testid": "currency-default-source", role: "status", children: t(`currency.defaultSource_${choice.source}`, { currency: choice.currency }) }),
          !service2 && pricing.settings.isPending && !currencySelection && /* @__PURE__ */ jsx41("p", { role: "status", children: t("currency.defaultsLoading") }),
          !service2 && pricing.settings.isError && /* @__PURE__ */ jsxs32("p", { role: "alert", children: [
            t("currency.defaultsLoadError"),
            " ",
            /* @__PURE__ */ jsx41("button", { type: "button", className: "underline min-h-11", onClick: pricing.retry, children: t("publicSearch.retry") })
          ] }),
          !service2 && currencySelection && !["saved", "manual"].includes(currencySelection.source) && /* @__PURE__ */ jsx41("p", { className: "text-sm text-muted-foreground", children: t("currency.amountLocked") }),
          localSuggestion && choice.currency && localSuggestion !== choice.currency && /* @__PURE__ */ jsxs32("div", { className: "text-sm space-y-1", children: [
            /* @__PURE__ */ jsx41("p", { children: t("currency.suggestLocal", { currency: localSuggestion }) }),
            /* @__PURE__ */ jsx41(Button, { type: "button", variant: "outline", className: "max-w-full min-h-11 h-auto whitespace-normal", onClick: () => {
              setCurrencySelection({ currency: localSuggestion, source: "manual" });
              setNewService((previous) => ({ ...previous, currency: localSuggestion }));
            }, children: t("currency.useSuggested", { currency: localSuggestion }) })
          ] })
        ] }),
        /* @__PURE__ */ jsx41(FormSection, { number: 3, title: t("serviceForm.audience"), children: /* @__PURE__ */ jsx41(ServiceAudienceFields, { newService, setNewService }) }),
        /* @__PURE__ */ jsxs32(FormSection, { number: 4, title: t("serviceForm.bookingLocation"), children: [
          /* @__PURE__ */ jsx41(ServiceInstantBookingField, { newService, setNewService }),
          /* @__PURE__ */ jsx41(ServiceLocationFields, { newService: draft, setNewService, errors, addresses })
        ] }),
        /* @__PURE__ */ jsx41(FormSection, { number: 5, title: t("serviceForm.media"), children: /* @__PURE__ */ jsx41(ServiceMediaFields, { newService, setNewService, errors, onBusyChange: setUploading }) }),
        /* @__PURE__ */ jsx41(FormSection, { number: 6, title: t("notifications.reminderSettings"), children: /* @__PURE__ */ jsx41(ServiceReminderFields, { draft: newService, setDraft: setNewService, errors }) })
      ] }),
      /* @__PURE__ */ jsxs32("div", { className: "bg-card text-card-foreground border rounded-xl p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4", children: [
        /* @__PURE__ */ jsx41("p", { className: "text-sm text-muted-foreground", children: t("serviceForm.visibility") }),
        service2?.isActive && /* @__PURE__ */ jsx41("p", { className: "text-sm font-medium", children: t("serviceForm.hideWarning") }),
        /* @__PURE__ */ jsx41("p", { role: "status", "aria-live": "polite", className: "text-sm", children: save.isPending ? t(savingAs ? "serviceForm.publishing" : "serviceForm.savingInactive") : "" }),
        /* @__PURE__ */ jsxs32("div", { className: "grid sm:grid-cols-3 gap-3", children: [
          /* @__PURE__ */ jsx41(Button, { type: "button", variant: "outline", className: actionClass, disabled: save.isPending, onClick: goBack, children: t("common.cancel") }),
          /* @__PURE__ */ jsx41(Button, { type: "button", variant: "outline", className: actionClass, disabled: save.isPending || uploading, onClick: () => submit(false), "data-testid": "button-save-inactive-service", children: t("serviceForm.saveInactive") }),
          /* @__PURE__ */ jsx41(Button, { type: "submit", className: actionClass, disabled: save.isPending || uploading, "data-testid": "button-save-service", children: t("serviceForm.publish") })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx41(AlertDialog, { open: currencyConfirmation !== null, onOpenChange: (open) => {
      if (!open) setCurrencyConfirmation(null);
    }, children: /* @__PURE__ */ jsxs32(AlertDialogContent, { dir: i18n.dir(), className: dialogClass, onCloseAutoFocus: (event) => {
      event.preventDefault();
      document.getElementById("service-currency")?.focus();
    }, children: [
      /* @__PURE__ */ jsxs32(AlertDialogHeader, { className: "text-start sm:text-start", children: [
        /* @__PURE__ */ jsx41(AlertDialogTitle, { children: t("currency.changeTitle") }),
        /* @__PURE__ */ jsx41(AlertDialogDescription, { children: t("currency.changeHelp", { currency: draft.currency, price: draft.price }) })
      ] }),
      /* @__PURE__ */ jsxs32(AlertDialogFooter, { className: "gap-2 sm:space-x-0", children: [
        /* @__PURE__ */ jsx41(AlertDialogCancel, { className: actionClass, children: t("serviceForm.keepEditing") }),
        /* @__PURE__ */ jsx41(AlertDialogAction, { className: actionClass, onClick: () => {
          const active = currencyConfirmation;
          setCurrencyConfirmation(null);
          if (active !== null) submit(active, false, true);
        }, children: t("currency.confirmChange") })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx41(AlertDialog, { open: Boolean(exit), onOpenChange: (open) => {
      if (!open) setExit(null);
    }, children: /* @__PURE__ */ jsxs32(AlertDialogContent, { dir: i18n.dir(), className: dialogClass, onCloseAutoFocus: (event) => {
      event.preventDefault();
      lastExitTrigger.current?.focus();
    }, children: [
      /* @__PURE__ */ jsxs32(AlertDialogHeader, { className: "text-start sm:text-start", children: [
        /* @__PURE__ */ jsx41(AlertDialogTitle, { children: t("serviceForm.discardTitle") }),
        /* @__PURE__ */ jsx41(AlertDialogDescription, { children: t("serviceForm.discardHelp") })
      ] }),
      /* @__PURE__ */ jsxs32(AlertDialogFooter, { className: "gap-2 sm:space-x-0", children: [
        /* @__PURE__ */ jsx41(AlertDialogCancel, { className: actionClass, children: t("serviceForm.keepEditing") }),
        /* @__PURE__ */ jsx41(AlertDialogAction, { className: actionClass, onClick: () => {
          const proceed = exit?.proceed;
          setExit(null);
          bypassExit.current = true;
          try {
            const result = proceed?.();
            if (result && typeof result.then === "function") {
              void Promise.resolve(result).catch(() => {
              }).finally(() => {
                bypassExit.current = false;
              });
            } else bypassExit.current = false;
          } catch {
            bypassExit.current = false;
          }
        }, children: t("serviceForm.discard") })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx41(AlertDialog, { open: hideConfirmation, onOpenChange: setHideConfirmation, children: /* @__PURE__ */ jsxs32(AlertDialogContent, { dir: i18n.dir(), className: dialogClass, onCloseAutoFocus: (event) => {
      event.preventDefault();
      lastHideTrigger.current?.focus();
    }, children: [
      /* @__PURE__ */ jsxs32(AlertDialogHeader, { className: "text-start sm:text-start", children: [
        /* @__PURE__ */ jsx41(AlertDialogTitle, { children: t("serviceForm.hideTitle") }),
        /* @__PURE__ */ jsx41(AlertDialogDescription, { children: hideMessageParts.map((part, index) => /* @__PURE__ */ jsxs32(Fragment8, { children: [
          index > 0 && /* @__PURE__ */ jsx41("bdi", { children: newService.name }),
          part
        ] }, index)) })
      ] }),
      /* @__PURE__ */ jsxs32(AlertDialogFooter, { className: "gap-2 sm:space-x-0", children: [
        /* @__PURE__ */ jsx41(AlertDialogCancel, { className: actionClass, children: t("serviceForm.keepEditing") }),
        /* @__PURE__ */ jsx41(AlertDialogAction, { className: actionClass, onClick: () => submit(false, true, true), children: t("serviceForm.saveInactive") })
      ] })
    ] }) })
  ] });
}
var actionClass, dialogClass, activeFocus;
var init_service_editor = __esm({
  "client/src/components/provider/service-editor.tsx"() {
    "use strict";
    init_queryClient();
    init_authUtils();
    init_use_toast();
    init_button();
    init_alert_dialog();
    init_service_draft();
    init_service_details_fields();
    init_service_booking_fields();
    init_service_location_fields();
    init_service_media_fields();
    init_service_reminder_fields();
    init_service_field_feedback();
    init_service_navigation_guard();
    init_money_input();
    init_useAuth();
    init_use_workspace_pricing();
    init_currency_defaults();
    init_currencies();
    actionClass = "min-h-11 h-auto whitespace-normal py-3 text-center";
    dialogClass = "service-editor max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl motion-reduce:animate-none";
    activeFocus = () => document.activeElement && "focus" in document.activeElement ? document.activeElement : null;
  }
});

// client/src/pages/provider/service-edit.tsx
import { Link as Link9, useRoute } from "wouter";
import { jsx as jsx42, jsxs as jsxs33 } from "react/jsx-runtime";
function ServiceEditPage() {
  const [editing, params] = useRoute("/my-services/services/:id/edit");
  const services = useProviderServices();
  const employees = useProviderEmployees();
  const { data: context2 } = useProviderWorkspace();
  if (!context2?.permissions.manageServices) return /* @__PURE__ */ jsx42("p", { role: "alert", children: "Your access level does not allow editing services." });
  if (employees.isLoading || editing && services.isLoading) return /* @__PURE__ */ jsx42("p", { role: "status", children: "Loading service details\u2026" });
  if (employees.isError || editing && services.isError) return /* @__PURE__ */ jsx42("p", { role: "alert", children: "Unable to load service details. Please refresh to try again." });
  const service2 = editing ? services.data?.find((row) => row.id === Number(params?.id)) : void 0;
  if (editing && !service2) return /* @__PURE__ */ jsxs33("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsx42("h1", { className: "text-2xl font-semibold", children: "Service not found" }),
    /* @__PURE__ */ jsx42("p", { children: "This service is unavailable in your current workspace." }),
    /* @__PURE__ */ jsx42(Link9, { href: "/my-services/services", className: "text-primary underline", children: "Back to services" })
  ] });
  return /* @__PURE__ */ jsx42(ServiceEditor, { service: service2, employees: employees.data ?? [], company: Boolean(context2.company) }, service2?.id ?? "new");
}
var init_service_edit = __esm({
  "client/src/pages/provider/service-edit.tsx"() {
    "use strict";
    init_use_provider_workspace();
    init_service_editor();
  }
});

// client/src/components/forms-locale.ts
import { useEffect as useEffect13 } from "react";
import { useTranslation as useTranslation29 } from "react-i18next";
function useFormLocale() {
  const { t, i18n } = useTranslation29();
  const language = i18n.resolvedLanguage || i18n.language;
  useEffect13(() => {
    if (typeof document === "undefined" || !document.documentElement) return;
    document.documentElement.lang = language;
    document.documentElement.dir = i18n.dir();
  }, [language, i18n]);
  return { t, i18n, language };
}
var init_forms_locale = __esm({
  "client/src/components/forms-locale.ts"() {
    "use strict";
  }
});

// client/src/components/ui/time-input.tsx
import * as React12 from "react";
import { jsx as jsx43 } from "react/jsx-runtime";
var timePattern, TimeInput;
var init_time_input = __esm({
  "client/src/components/ui/time-input.tsx"() {
    "use strict";
    init_input();
    timePattern = "([01][0-9]|2[0-3]):[0-5][0-9]";
    TimeInput = React12.forwardRef(
      (props, ref) => /* @__PURE__ */ jsx43(
        Input,
        {
          ...props,
          ref,
          type: "text",
          inputMode: "text",
          dir: "ltr",
          placeholder: "HH:mm",
          pattern: timePattern,
          maxLength: 5,
          "data-time-input": "24h"
        }
      )
    );
    TimeInput.displayName = "TimeInput";
  }
});

// client/src/components/availability-editor.tsx
import { useEffect as useEffect14, useRef as useRef11, useState as useState18 } from "react";
import { useMutation as useMutation7, useQueryClient as useQueryClient9 } from "@tanstack/react-query";
import { Plus as Plus2, X as X2 } from "lucide-react";
import { Fragment as Fragment9, jsx as jsx44, jsxs as jsxs34 } from "react/jsx-runtime";
function validRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return ranges.length <= 8 && sorted.every((range, index) => /^([01]\d|2[0-3]):[0-5]\d$/.test(range.startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(range.endTime) && range.startTime < range.endTime && (!index || sorted[index - 1].endTime <= range.startTime));
}
function RangeInputs({ ranges, onChange, label, errorId }) {
  const { t } = useFormLocale();
  return /* @__PURE__ */ jsxs34("div", { className: "space-y-2 w-full sm:w-auto min-w-0", children: [
    ranges.map((range, index) => /* @__PURE__ */ jsxs34("div", { className: "grid sm:flex items-center gap-2", children: [
      /* @__PURE__ */ jsx44(TimeInput, { "aria-label": t("operationsForm.rangeStart", { label, number: index + 1 }), "aria-invalid": Boolean(errorId), "aria-describedby": errorId, value: range.startTime, onChange: (event) => onChange(ranges.map((item, i) => i === index ? { ...item, startTime: event.target.value } : item)), className: "w-full sm:w-24 min-w-0 sm:flex-1" }),
      /* @__PURE__ */ jsx44("span", { "aria-hidden": "true", className: "text-center", children: "\u2013" }),
      /* @__PURE__ */ jsx44(TimeInput, { "aria-label": t("operationsForm.rangeEnd", { label, number: index + 1 }), "aria-invalid": Boolean(errorId), "aria-describedby": errorId, value: range.endTime, onChange: (event) => onChange(ranges.map((item, i) => i === index ? { ...item, endTime: event.target.value } : item)), className: "w-full sm:w-24 min-w-0 sm:flex-1" }),
      /* @__PURE__ */ jsx44(Button, { type: "button", size: "icon", variant: "ghost", "aria-label": t("operationsForm.rangeRemove", { label, number: index + 1 }), onClick: () => onChange(ranges.filter((_, i) => i !== index)), children: /* @__PURE__ */ jsx44(X2, { className: "w-4 h-4" }) })
    ] }, index)),
    /* @__PURE__ */ jsxs34(Button, { type: "button", size: "sm", variant: "ghost", disabled: ranges.length >= 8, onClick: () => onChange([...ranges, defaultRange()]), children: [
      /* @__PURE__ */ jsx44(Plus2, { className: "w-3 h-3 me-1" }),
      t("operationsForm.addHours")
    ] })
  ] });
}
function weeklyState(schedules, serviceId) {
  const own = schedules.filter((item) => item.serviceId === serviceId && item.scheduleType === "recurring" && item.isActive !== false);
  const effective = own.length || serviceId == null ? own : schedules.filter((item) => item.serviceId == null && item.scheduleType === "recurring" && item.isActive !== false);
  return { timezone: effective[0]?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, week: Array.from({ length: 7 }, (_, day2) => effective.filter((item) => item.daysOfWeek?.includes(day2)).flatMap(workingRanges).filter((range, index, ranges) => ranges.findIndex((other) => other.startTime === range.startTime && other.endTime === range.endTime) === index).sort((a, b) => a.startTime.localeCompare(b.startTime))) };
}
function AvailabilityEditor({ services, schedules }) {
  const { t, language } = useFormLocale();
  const [serviceId, setServiceId] = useState18(null), [nextScope, setNextScope] = useState18();
  const [timezone2, setTimezone] = useState18(() => weeklyState(schedules, null).timezone);
  const [week, setWeek] = useState18(() => weeklyState(schedules, null).week);
  const [baseline, setBaseline] = useState18(() => JSON.stringify(weeklyState(schedules, null)));
  const [exceptionDate, setExceptionDate] = useState18(""), [exceptionRanges, setExceptionRanges] = useState18([]);
  const [exceptionBaseline, setExceptionBaseline] = useState18("");
  const [feedback, setFeedback] = useState18({});
  const [rangeErrors, setRangeErrors] = useState18([]), [timezoneError, setTimezoneError] = useState18(false), [exceptionError, setExceptionError] = useState18(false);
  const locked = useRef11(false), queryClient3 = useQueryClient9();
  const weeklyDirty = JSON.stringify({ timezone: timezone2, week }) !== baseline;
  const exceptionDirty = exceptionBaseline ? JSON.stringify({ date: exceptionDate, ranges: exceptionRanges, timezone: timezone2 }) !== exceptionBaseline : Boolean(exceptionDate || exceptionRanges.length);
  const dirty = weeklyDirty || exceptionDirty;
  const latest = useRef11({ weeklyDirty, dirty, timezone: timezone2 });
  latest.current = { weeklyDirty, dirty, timezone: timezone2 };
  useEffect14(() => {
    const state = weeklyState(schedules, serviceId);
    if (!latest.current.weeklyDirty) {
      setWeek(state.week);
      const zone = latest.current.dirty ? latest.current.timezone : state.timezone;
      setBaseline(JSON.stringify({ timezone: zone, week: state.week }));
      if (!latest.current.dirty) setTimezone(zone);
    }
  }, [schedules, serviceId]);
  useEffect14(() => {
    const warn = (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function selectScope(value) {
    const state = weeklyState(schedules, value);
    setServiceId(value);
    setTimezone(state.timezone);
    setWeek(state.week);
    setBaseline(JSON.stringify(state));
    setExceptionDate("");
    setExceptionRanges([]);
    setExceptionBaseline("");
    setFeedback({});
    setRangeErrors([]);
    setTimezoneError(false);
    setExceptionError(false);
  }
  const save = useMutation7({
    mutationFn: async ({ path, method = "PUT", body }) => (await apiRequest(method, path, body)).json(),
    onSuccess: async (_, action) => {
      if (action.key === "weekly") {
        setBaseline(action.snapshot);
        if (action.inherit) {
          const state = JSON.parse(action.snapshot);
          setWeek(state.week);
          setTimezone(state.timezone);
        }
      }
      if (action.key === "exception") {
        setExceptionDate("");
        setExceptionRanges([]);
        setExceptionBaseline("");
      }
      setFeedback((previous) => ({ ...previous, [action.key]: { message: t("operationsForm.saved") } }));
      await queryClient3.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/availability/") });
    },
    onError: (_, action) => setFeedback((previous) => ({ ...previous, [action.key]: { error: t("operationsForm.saveError") } })),
    onSettled: () => {
      locked.current = false;
    }
  });
  function run(action) {
    if (locked.current) return;
    locked.current = true;
    setFeedback((previous) => ({ ...previous, [action.key]: {} }));
    save.mutate(action);
  }
  function validate(key, days) {
    const bad = days.filter((day2) => !validRanges(week[day2]));
    const zoneBad = !validTimezone(timezone2);
    setRangeErrors(bad);
    setTimezoneError(zoneBad);
    if (bad.length || zoneBad || key === "exception" && (!validDateKey(exceptionDate) || !validRanges(exceptionRanges))) {
      setExceptionError(key === "exception");
      setFeedback((previous) => ({ ...previous, [key]: { error: t("operationsForm.checkFields") } }));
      requestAnimationFrame(() => document.getElementById(`availability-feedback-${key}`)?.focus());
      return false;
    }
    setExceptionError(false);
    return true;
  }
  const scoped = schedules.filter((item) => item.serviceId === serviceId && item.isActive !== false), ownWeekly = scoped.filter((item) => item.scheduleType === "recurring");
  const weeklyBody = { serviceId, timezone: timezone2, days: week.map((intervals, day2) => ({ day: day2, intervals })) };
  const exceptions = Array.from(new Set(scoped.filter((item) => item.scheduleType === "specific").map(scheduleDate).filter((date) => Boolean(date)))).sort();
  const receipt = (key) => /* @__PURE__ */ jsxs34(Fragment9, { children: [
    feedback[key]?.message && /* @__PURE__ */ jsx44("p", { role: "status", children: feedback[key].message }),
    feedback[key]?.error && /* @__PURE__ */ jsxs34("p", { id: `availability-feedback-${key}`, tabIndex: -1, role: "alert", className: "text-destructive", children: [
      feedback[key].error,
      timezoneError && /* @__PURE__ */ jsxs34(Fragment9, { children: [
        " ",
        /* @__PURE__ */ jsx44("a", { href: "#availability-timezone", children: t("operationsForm.timezone") })
      ] }),
      key === "weekly" && rangeErrors.map((day2) => /* @__PURE__ */ jsx44("a", { href: `#availability-day-${day2}`, className: "block", onClick: (event) => {
        event.preventDefault();
        document.querySelector(`#availability-day-${day2} [data-time-input]`)?.focus();
      }, children: dayName(day2) }, day2)),
      key === "exception" && exceptionError && /* @__PURE__ */ jsxs34(Fragment9, { children: [
        " ",
        /* @__PURE__ */ jsx44("a", { href: "#availability-exception-date", children: t("operationsForm.date") })
      ] })
    ] })
  ] });
  const dayName = (day2) => new Intl.DateTimeFormat(language, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + day2)));
  return /* @__PURE__ */ jsxs34("div", { className: "phase3-form border rounded-xl bg-card text-card-foreground p-4 sm:p-6 space-y-6", children: [
    /* @__PURE__ */ jsxs34("fieldset", { disabled: save.isPending, className: "space-y-6 min-w-0", children: [
      /* @__PURE__ */ jsx44("legend", { className: "font-semibold mb-4", children: t("operationsForm.scheduleScope") }),
      /* @__PURE__ */ jsxs34("div", { className: "grid sm:grid-cols-2 gap-4", children: [
        /* @__PURE__ */ jsxs34("div", { children: [
          /* @__PURE__ */ jsx44(Label, { htmlFor: "availability-service", children: t("operationsForm.appliesTo") }),
          /* @__PURE__ */ jsxs34("select", { id: "availability-service", value: serviceId ?? "all", onChange: (event) => {
            const next = event.target.value === "all" ? null : Number(event.target.value);
            if (dirty) setNextScope(next);
            else selectScope(next);
          }, children: [
            /* @__PURE__ */ jsx44("option", { value: "all", children: t("operationsForm.general") }),
            services.map((service2) => /* @__PURE__ */ jsx44("option", { value: service2.id, children: service2.name }, service2.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs34("div", { children: [
          /* @__PURE__ */ jsx44(Label, { htmlFor: "availability-timezone", children: t("operationsForm.timezone") }),
          /* @__PURE__ */ jsx44(Input, { id: "availability-timezone", value: timezone2, "aria-invalid": timezoneError, "aria-describedby": timezoneError ? "availability-zone-error" : void 0, onChange: (event) => setTimezone(event.target.value), placeholder: "Europe/Riga" }),
          timezoneError && /* @__PURE__ */ jsx44("p", { id: "availability-zone-error", className: "text-destructive", children: t("operationsForm.zoneError") })
        ] })
      ] }),
      /* @__PURE__ */ jsx44("p", { className: "rounded-md bg-muted p-3 text-sm", children: t("operationsForm.scopeSummary", { service: serviceId == null ? t("operationsForm.general") : services.find((item) => item.id === serviceId)?.name, timezone: timezone2 }) }),
      /* @__PURE__ */ jsxs34("section", { className: "space-y-4", "aria-labelledby": "weekly-heading", children: [
        /* @__PURE__ */ jsx44("h2", { id: "weekly-heading", className: "text-lg font-semibold", children: t("operationsForm.weekly") }),
        serviceId != null && !ownWeekly.length && /* @__PURE__ */ jsx44("p", { className: "text-sm text-muted-foreground", children: t("operationsForm.inherited") }),
        /* @__PURE__ */ jsx44("p", { className: "text-sm text-muted-foreground", children: t("operationsForm.weekHelp") }),
        /* @__PURE__ */ jsx44("div", { className: "availability-day-list divide-y border rounded-lg px-3", children: dayOrder.map((day2) => /* @__PURE__ */ jsxs34("div", { id: `availability-day-${day2}`, className: "py-3 flex flex-wrap gap-3 items-start", children: [
          /* @__PURE__ */ jsxs34("label", { className: "flex gap-2 items-center min-h-11 sm:min-w-28 text-sm", children: [
            /* @__PURE__ */ jsx44("input", { type: "checkbox", checked: week[day2].length > 0, onChange: (event) => setWeek(week.map((ranges, index) => index === day2 ? event.target.checked ? [defaultRange()] : [] : ranges)) }),
            dayName(day2)
          ] }),
          week[day2].length ? /* @__PURE__ */ jsxs34("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx44(RangeInputs, { ranges: week[day2], label: dayName(day2), errorId: rangeErrors.includes(day2) ? `day-error-${day2}` : void 0, onChange: (ranges) => setWeek(week.map((item, index) => index === day2 ? ranges : item)) }),
            rangeErrors.includes(day2) && /* @__PURE__ */ jsx44("p", { id: `day-error-${day2}`, className: "text-sm text-destructive", children: t("operationsForm.rangeError") })
          ] }) : /* @__PURE__ */ jsx44("span", { className: "text-sm text-muted-foreground pt-3", children: t("operationsForm.unavailable") })
        ] }, day2)) }),
        /* @__PURE__ */ jsxs34("div", { className: "flex flex-wrap gap-2", children: [
          /* @__PURE__ */ jsx44(Button, { type: "button", onClick: () => {
            if (validate("weekly", dayOrder)) run({ key: "weekly", path: "/api/availability/weekly", body: weeklyBody, snapshot: JSON.stringify({ timezone: timezone2, week }) });
          }, children: t(save.isPending && save.variables?.key === "weekly" ? "operationsForm.saving" : "operationsForm.saveWeek") }),
          serviceId != null && ownWeekly.length > 0 && /* @__PURE__ */ jsx44(Button, { type: "button", variant: "outline", onClick: () => {
            if (weeklyDirty && !window.confirm(t("operationsForm.discardWeek"))) return;
            const state = weeklyState(schedules.filter((item) => item.serviceId !== serviceId), serviceId);
            run({ inherit: true, key: "weekly", path: "/api/availability/weekly", body: { ...weeklyBody, inherit: true }, snapshot: JSON.stringify(state) });
          }, children: t("operationsForm.useGeneral") })
        ] }),
        receipt("weekly")
      ] }),
      /* @__PURE__ */ jsxs34("section", { className: "space-y-4 border-t pt-6", "aria-labelledby": "exceptions-heading", children: [
        /* @__PURE__ */ jsx44("h2", { id: "exceptions-heading", className: "text-lg font-semibold", children: t("operationsForm.exceptions") }),
        /* @__PURE__ */ jsx44("p", { className: "text-sm text-muted-foreground", children: t("operationsForm.exceptionHelp") }),
        serviceId != null && /* @__PURE__ */ jsx44("p", { className: "text-sm text-muted-foreground", children: t("operationsForm.generalExceptions") }),
        exceptions.map((date) => {
          const rows = scoped.filter((item) => item.scheduleType === "specific" && scheduleDate(item) === date), ranges = rows.flatMap(workingRanges);
          return /* @__PURE__ */ jsxs34("div", { className: "border rounded-lg p-3 space-y-2", children: [
            /* @__PURE__ */ jsx44("p", { className: "font-medium", children: new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }).format(/* @__PURE__ */ new Date(`${date}T12:00:00`)) }),
            /* @__PURE__ */ jsxs34("p", { className: "text-sm text-muted-foreground", children: [
              /* @__PURE__ */ jsx44("bdi", { children: ranges.length ? ranges.map((range) => `${range.startTime}\u2013${range.endTime}`).join(", ") : t("operationsForm.allDay") }),
              " \xB7 ",
              /* @__PURE__ */ jsx44("bdi", { children: rows[0]?.timezone })
            ] }),
            /* @__PURE__ */ jsxs34("div", { className: "flex flex-wrap gap-2", children: [
              /* @__PURE__ */ jsx44(Button, { type: "button", variant: "outline", onClick: () => {
                if (exceptionDirty && !window.confirm(t("operationsForm.discardException"))) return;
                const zone = rows[0]?.timezone || timezone2;
                setExceptionDate(date);
                setExceptionRanges(ranges);
                setTimezone(zone);
                setExceptionBaseline(JSON.stringify({ date, ranges, timezone: zone }));
              }, children: t("common.edit") }),
              /* @__PURE__ */ jsx44(Button, { type: "button", variant: "outline", "aria-label": t("operationsForm.removeDate", { date }), onClick: () => {
                if (window.confirm(t("operationsForm.removeDateConfirm", { date }))) run({ key: date, method: "DELETE", path: `/api/availability/override?serviceId=${serviceId ?? "all"}&date=${date}` });
              }, children: t("operationsForm.remove") })
            ] }),
            receipt(date)
          ] }, date);
        }),
        save.variables?.method === "DELETE" && feedback[save.variables.key]?.message && /* @__PURE__ */ jsx44("p", { role: "status", children: feedback[save.variables.key].message }),
        /* @__PURE__ */ jsxs34("div", { className: "bg-muted border rounded-lg p-4 space-y-4", children: [
          /* @__PURE__ */ jsxs34("div", { children: [
            /* @__PURE__ */ jsx44(Label, { htmlFor: "availability-exception-date", children: t("operationsForm.date") }),
            /* @__PURE__ */ jsx44(Input, { id: "availability-exception-date", type: "date", value: exceptionDate, "aria-invalid": exceptionError, "aria-describedby": exceptionError ? "exception-error" : void 0, onChange: (event) => setExceptionDate(event.target.value) })
          ] }),
          /* @__PURE__ */ jsxs34("label", { className: "flex items-center gap-2 min-h-11 text-sm", children: [
            /* @__PURE__ */ jsx44("input", { type: "checkbox", checked: !exceptionRanges.length, onChange: (event) => setExceptionRanges(event.target.checked ? [] : [defaultRange()]) }),
            t("operationsForm.allDay")
          ] }),
          exceptionRanges.length > 0 && /* @__PURE__ */ jsx44(RangeInputs, { ranges: exceptionRanges, label: t("operationsForm.exceptions"), errorId: exceptionError ? "exception-error" : void 0, onChange: setExceptionRanges }),
          exceptionError && /* @__PURE__ */ jsx44("p", { id: "exception-error", className: "text-sm text-destructive", children: t("operationsForm.exceptionError") }),
          /* @__PURE__ */ jsx44(Button, { type: "button", variant: "outline", onClick: () => {
            if (validate("exception", [])) run({ key: "exception", path: "/api/availability/override", body: { serviceId, timezone: timezone2, date: exceptionDate, intervals: exceptionRanges } });
          }, children: t(save.isPending && save.variables?.key === "exception" ? "operationsForm.saving" : "operationsForm.saveException") }),
          receipt("exception")
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx44(AlertDialog, { open: nextScope !== void 0, onOpenChange: (open) => {
      if (!open) setNextScope(void 0);
    }, children: /* @__PURE__ */ jsxs34(AlertDialogContent, { className: "phase3-form", onCloseAutoFocus: (event) => {
      event.preventDefault();
      document.getElementById("availability-service")?.focus();
    }, children: [
      /* @__PURE__ */ jsx44(AlertDialogTitle, { children: t("operationsForm.discardTitle") }),
      /* @__PURE__ */ jsx44(AlertDialogDescription, { children: t("operationsForm.discardScope") }),
      /* @__PURE__ */ jsxs34("div", { className: "flex flex-wrap gap-2", children: [
        /* @__PURE__ */ jsx44(AlertDialogCancel, { onClick: () => document.getElementById("availability-service")?.focus(), children: t("operationsForm.keepEditing") }),
        /* @__PURE__ */ jsx44(AlertDialogAction, { onClick: () => {
          selectScope(nextScope);
          setNextScope(void 0);
          requestAnimationFrame(() => document.getElementById("availability-service")?.focus());
        }, children: t("operationsForm.discard") })
      ] })
    ] }) })
  ] });
}
var dayOrder, defaultRange;
var init_availability_editor = __esm({
  "client/src/components/availability-editor.tsx"() {
    "use strict";
    init_scheduling();
    init_queryClient();
    init_forms_locale();
    init_button();
    init_input();
    init_time_input();
    init_label();
    init_alert_dialog();
    dayOrder = [1, 2, 3, 4, 5, 6, 0];
    defaultRange = () => ({ startTime: "09:00", endTime: "17:00" });
  }
});

// client/src/pages/provider/availability.tsx
import { jsx as jsx45, jsxs as jsxs35 } from "react/jsx-runtime";
function AvailabilityPage() {
  const { t } = useFormLocale();
  const { data: context2 } = useProviderWorkspace();
  if (!context2?.permissions.manageSchedules) return /* @__PURE__ */ jsx45("p", { role: "alert", children: t("operationsForm.availabilityDenied") });
  return /* @__PURE__ */ jsx45(AvailabilityContent, {});
}
function AvailabilityContent() {
  const { t } = useFormLocale();
  const services = useProviderServices();
  const schedules = useProviderAvailability();
  return /* @__PURE__ */ jsxs35("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxs35("div", { children: [
      /* @__PURE__ */ jsx45("h1", { className: "text-2xl font-semibold break-words", children: t("operationsForm.availability") }),
      /* @__PURE__ */ jsx45("p", { className: "mt-1 text-muted-foreground", children: t("operationsForm.availabilityHelp") })
    ] }),
    services.isLoading || schedules.isLoading ? /* @__PURE__ */ jsx45("p", { role: "status", children: t("operationsForm.loadingAvailability") }) : services.isError || schedules.isError ? /* @__PURE__ */ jsx45("p", { role: "alert", children: t("operationsForm.loadAvailabilityError") }) : /* @__PURE__ */ jsx45(AvailabilityEditor, { services: services.data ?? [], schedules: schedules.data ?? [] })
  ] });
}
var init_availability = __esm({
  "client/src/pages/provider/availability.tsx"() {
    "use strict";
    init_use_provider_workspace();
    init_forms_locale();
    init_availability_editor();
  }
});

// client/src/components/ui/card.tsx
import * as React13 from "react";
import { jsx as jsx46 } from "react/jsx-runtime";
var Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter;
var init_card = __esm({
  "client/src/components/ui/card.tsx"() {
    "use strict";
    init_utils();
    Card = React13.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx46(
      "div",
      {
        ref,
        className: cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          className
        ),
        ...props
      }
    ));
    Card.displayName = "Card";
    CardHeader = React13.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx46(
      "div",
      {
        ref,
        className: cn("flex flex-col space-y-1.5 p-6", className),
        ...props
      }
    ));
    CardHeader.displayName = "CardHeader";
    CardTitle = React13.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx46(
      "div",
      {
        ref,
        className: cn(
          "text-2xl font-semibold leading-none tracking-tight",
          className
        ),
        ...props
      }
    ));
    CardTitle.displayName = "CardTitle";
    CardDescription = React13.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx46(
      "div",
      {
        ref,
        className: cn("text-sm text-muted-foreground", className),
        ...props
      }
    ));
    CardDescription.displayName = "CardDescription";
    CardContent = React13.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx46("div", { ref, className: cn("p-6 pt-0", className), ...props }));
    CardContent.displayName = "CardContent";
    CardFooter = React13.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx46(
      "div",
      {
        ref,
        className: cn("flex items-center p-6 pt-0", className),
        ...props
      }
    ));
    CardFooter.displayName = "CardFooter";
  }
});

// client/src/components/provider-profile.tsx
import { useEffect as useEffect15, useState as useState19 } from "react";
import { useMutation as useMutation8, useQuery as useQuery14, useQueryClient as useQueryClient10 } from "@tanstack/react-query";
import { Translation, useTranslation as useTranslation30 } from "react-i18next";
import { jsx as jsx47, jsxs as jsxs36 } from "react/jsx-runtime";
function ProviderProfile({ user: user2 }) {
  const { t } = useTranslation30();
  const queryClient3 = useQueryClient10();
  const { toast: toast2 } = useToast();
  const [providerType, setProviderType] = useState19(user2.providerType);
  const [companyName, setCompanyName] = useState19(user2.companyName || "");
  const [editingEmployee, setEditingEmployee] = useState19(null);
  const [name, setName] = useState19("");
  const [showName, setShowName] = useState19(false);
  useEffect15(() => {
    setProviderType(user2.providerType);
    setCompanyName(user2.companyName || "");
  }, [user2.providerType, user2.companyName]);
  const { data: employees = [], isLoading, isError } = useQuery14({ queryKey: ["/api/provider/employees"] });
  const invalidate = () => {
    queryClient3.invalidateQueries({ queryKey: ["/api/auth/user"] });
    queryClient3.invalidateQueries({ queryKey: ["/api/company/context"] });
    queryClient3.invalidateQueries({ queryKey: ["/api/provider/employees"] });
    queryClient3.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/services/") });
    queryClient3.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
  };
  const message = (key) => /* @__PURE__ */ jsx47(Translation, { children: (t2) => t2(key) });
  const errorToast = () => {
    toast2({ title: message("providerSettings.saveFailed"), description: message("operationsForm.saveError"), variant: "destructive" });
  };
  const profileMutation = useMutation8({
    mutationFn: () => apiRequest("PATCH", "/api/provider/profile", { providerType, companyName: companyName.trim() || null }),
    onSuccess: () => {
      invalidate();
      toast2({ title: message("providerSettings.profileSaved") });
    },
    onError: errorToast
  });
  const resetEmployee = () => {
    setEditingEmployee(null);
    setName("");
    setShowName(false);
  };
  const employeeMutation = useMutation8({
    mutationFn: () => apiRequest(editingEmployee ? "PATCH" : "POST", editingEmployee ? `/api/provider/employees/${editingEmployee.id}` : "/api/provider/employees", { name: name.trim(), showName }),
    onSuccess: () => {
      invalidate();
      resetEmployee();
      toast2({ title: message("providerSettings.employeeSaved") });
    },
    onError: errorToast
  });
  const deleteMutation = useMutation8({
    mutationFn: (id) => apiRequest("DELETE", `/api/provider/employees/${id}`),
    onSuccess: () => {
      invalidate();
      resetEmployee();
      toast2({ title: message("providerSettings.employeeRemoved") });
    },
    onError: errorToast
  });
  return /* @__PURE__ */ jsxs36(Card, { children: [
    /* @__PURE__ */ jsx47(CardHeader, { children: /* @__PURE__ */ jsx47(CardTitle, { children: t("providerSettings.profileTitle") }) }),
    /* @__PURE__ */ jsxs36(CardContent, { className: "space-y-5", children: [
      /* @__PURE__ */ jsxs36("form", { className: "space-y-3", onSubmit: (event) => {
        event.preventDefault();
        profileMutation.mutate();
      }, children: [
        /* @__PURE__ */ jsxs36("div", { children: [
          /* @__PURE__ */ jsx47(Label, { htmlFor: "provider-type", children: t("providerSettings.offerAs") }),
          /* @__PURE__ */ jsxs36(
            "select",
            {
              id: "provider-type",
              className: "w-full border rounded-md p-2 bg-white",
              value: providerType,
              onChange: (event) => setProviderType(event.target.value),
              "data-testid": "select-provider-type",
              children: [
                /* @__PURE__ */ jsx47("option", { value: "individual", children: t("providerSettings.individual") }),
                /* @__PURE__ */ jsx47("option", { value: "company", children: t("providerSettings.company") })
              ]
            }
          )
        ] }),
        providerType === "company" && /* @__PURE__ */ jsxs36("div", { children: [
          /* @__PURE__ */ jsx47(Label, { htmlFor: "company-name", children: t("providerSettings.companyName") }),
          /* @__PURE__ */ jsx47(Input, { id: "company-name", required: true, maxLength: 150, value: companyName, onChange: (event) => setCompanyName(event.target.value), placeholder: t("providerSettings.companyPlaceholder"), "data-testid": "input-company-name" }),
          /* @__PURE__ */ jsx47("p", { className: "text-xs text-neutral-500 mt-1", children: t("providerSettings.companyHelp") })
        ] }),
        /* @__PURE__ */ jsx47(Button, { disabled: profileMutation.isPending, className: "h-auto min-h-10 whitespace-normal", "data-testid": "button-save-provider-profile", children: t(profileMutation.isPending ? "operationsForm.saving" : "providerSettings.saveProfile") })
      ] }),
      user2.providerType === "company" && /* @__PURE__ */ jsxs36("div", { className: "space-y-3 border-t pt-4", children: [
        /* @__PURE__ */ jsx47("h3", { className: "font-semibold", children: t("providerSettings.employees") }),
        /* @__PURE__ */ jsx47("p", { className: "text-sm text-neutral-600", children: t("providerSettings.employeesHelp") }),
        isLoading ? /* @__PURE__ */ jsx47("p", { role: "status", children: t("providerSettings.loadingEmployees") }) : isError ? /* @__PURE__ */ jsx47("p", { role: "alert", children: t("providerSettings.loadEmployeesError") }) : employees.length === 0 ? /* @__PURE__ */ jsx47("p", { className: "text-sm text-neutral-500", children: t("providerSettings.employeesEmpty") }) : /* @__PURE__ */ jsx47("ul", { className: "space-y-2", children: employees.map((employee) => /* @__PURE__ */ jsxs36("li", { className: "flex flex-wrap items-center justify-between gap-2 border rounded-md p-3", children: [
          /* @__PURE__ */ jsxs36("div", { children: [
            /* @__PURE__ */ jsx47("p", { className: "font-medium", children: employee.name }),
            /* @__PURE__ */ jsx47("p", { className: "text-xs text-neutral-500", children: t(employee.showName ? "providerSettings.nameVisible" : "providerSettings.nameHidden") })
          ] }),
          /* @__PURE__ */ jsxs36("div", { className: "flex gap-1", children: [
            /* @__PURE__ */ jsx47(Button, { type: "button", size: "sm", variant: "outline", onClick: () => {
              setEditingEmployee(employee);
              setName(employee.name);
              setShowName(employee.showName);
            }, children: t("common.edit") }),
            /* @__PURE__ */ jsx47(Button, { type: "button", size: "sm", variant: "ghost", disabled: deleteMutation.isPending || employeeMutation.isPending, onClick: () => deleteMutation.mutate(employee.id), children: t("operationsForm.remove") })
          ] })
        ] }, employee.id)) }),
        /* @__PURE__ */ jsxs36("form", { className: "space-y-3 bg-neutral-50 rounded-md p-3", onSubmit: (event) => {
          event.preventDefault();
          employeeMutation.mutate();
        }, children: [
          /* @__PURE__ */ jsx47(Label, { htmlFor: "employee-name", children: t(editingEmployee ? "providerSettings.editEmployee" : "providerSettings.addEmployee") }),
          /* @__PURE__ */ jsx47(Input, { id: "employee-name", required: true, maxLength: 100, value: name, onChange: (event) => setName(event.target.value), placeholder: t("providerSettings.employeePlaceholder"), "data-testid": "input-employee-name" }),
          /* @__PURE__ */ jsxs36("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx47(Switch, { id: "show-employee-name", checked: showName, onCheckedChange: setShowName }),
            /* @__PURE__ */ jsx47(Label, { htmlFor: "show-employee-name", children: t("providerSettings.showName") })
          ] }),
          /* @__PURE__ */ jsxs36("div", { className: "flex flex-wrap gap-2", children: [
            /* @__PURE__ */ jsx47(Button, { disabled: employeeMutation.isPending || deleteMutation.isPending, className: "h-auto min-h-10 whitespace-normal", "data-testid": "button-save-employee", children: t(employeeMutation.isPending ? "operationsForm.saving" : editingEmployee ? "providerSettings.saveEmployee" : "providerSettings.addEmployee") }),
            editingEmployee && /* @__PURE__ */ jsx47(Button, { type: "button", variant: "outline", onClick: resetEmployee, children: t("common.cancel") })
          ] })
        ] })
      ] })
    ] })
  ] });
}
var init_provider_profile = __esm({
  "client/src/components/provider-profile.tsx"() {
    "use strict";
    init_queryClient();
    init_use_toast();
    init_button();
    init_card();
    init_input();
    init_label();
    init_switch();
  }
});

// client/src/components/ui/sheet.tsx
import * as React14 from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva as cva4 } from "class-variance-authority";
import { X as X3 } from "lucide-react";
import { jsx as jsx48, jsxs as jsxs37 } from "react/jsx-runtime";
var Sheet, SheetPortal, SheetOverlay, sheetVariants, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription;
var init_sheet = __esm({
  "client/src/components/ui/sheet.tsx"() {
    "use strict";
    "use client";
    init_utils();
    Sheet = SheetPrimitive.Root;
    SheetPortal = SheetPrimitive.Portal;
    SheetOverlay = React14.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx48(
      SheetPrimitive.Overlay,
      {
        className: cn(
          "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        ),
        ...props,
        ref
      }
    ));
    SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;
    sheetVariants = cva4(
      "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
      {
        variants: {
          side: {
            top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
            bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
            right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
          }
        },
        defaultVariants: {
          side: "right"
        }
      }
    );
    SheetContent = React14.forwardRef(({ side = "right", className, children, closeLabel = "Close", overlayClassName, ...props }, ref) => /* @__PURE__ */ jsxs37(SheetPortal, { children: [
      /* @__PURE__ */ jsx48(SheetOverlay, { className: overlayClassName }),
      /* @__PURE__ */ jsxs37(
        SheetPrimitive.Content,
        {
          ref,
          className: cn(sheetVariants({ side }), className),
          ...props,
          children: [
            children,
            /* @__PURE__ */ jsxs37(SheetPrimitive.Close, { className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary", children: [
              /* @__PURE__ */ jsx48(X3, { className: "h-4 w-4" }),
              /* @__PURE__ */ jsx48("span", { className: "sr-only", children: closeLabel })
            ] })
          ]
        }
      )
    ] }));
    SheetContent.displayName = SheetPrimitive.Content.displayName;
    SheetHeader = ({
      className,
      ...props
    }) => /* @__PURE__ */ jsx48(
      "div",
      {
        className: cn(
          "flex flex-col space-y-2 text-center sm:text-left",
          className
        ),
        ...props
      }
    );
    SheetHeader.displayName = "SheetHeader";
    SheetFooter = ({
      className,
      ...props
    }) => /* @__PURE__ */ jsx48(
      "div",
      {
        className: cn(
          "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
          className
        ),
        ...props
      }
    );
    SheetFooter.displayName = "SheetFooter";
    SheetTitle = React14.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx48(
      SheetPrimitive.Title,
      {
        ref,
        className: cn("text-lg font-semibold text-foreground", className),
        ...props
      }
    ));
    SheetTitle.displayName = SheetPrimitive.Title.displayName;
    SheetDescription = React14.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx48(
      SheetPrimitive.Description,
      {
        ref,
        className: cn("text-sm text-muted-foreground", className),
        ...props
      }
    ));
    SheetDescription.displayName = SheetPrimitive.Description.displayName;
  }
});

// client/src/components/company-team.tsx
import { useEffect as useEffect16, useRef as useRef12, useState as useState20 } from "react";
import { useMutation as useMutation9, useQuery as useQuery15, useQueryClient as useQueryClient11 } from "@tanstack/react-query";
import { Check as Check3, ChevronRight as ChevronRight3, Info, LockKeyhole, Plus as Plus3, Search, Users } from "lucide-react";
import { Fragment as Fragment10, jsx as jsx49, jsxs as jsxs38 } from "react/jsx-runtime";
function invalidateWorkspace(queryClient3) {
  return queryClient3.invalidateQueries({ predicate: (query) => /\/api\/(company|provider|services|bookings|availability|auth\/user)/.test(String(query.queryKey[0])) });
}
function Receipt({ feedback, pending }) {
  const { t } = useFormLocale();
  return /* @__PURE__ */ jsxs38("div", { "aria-live": "polite", className: "space-y-1 text-sm", children: [
    pending && /* @__PURE__ */ jsx49("p", { role: "status", children: t("operationsForm.saving") }),
    feedback?.error && /* @__PURE__ */ jsx49("p", { role: "alert", className: "text-destructive", children: feedback.error }),
    feedback?.message && /* @__PURE__ */ jsx49("p", { role: "status", children: feedback.message })
  ] });
}
function EmployeeOptions({ employees, selected }) {
  const { t } = useFormLocale();
  return /* @__PURE__ */ jsxs38(Fragment10, { children: [
    /* @__PURE__ */ jsx49("option", { value: "none", children: t("operationsForm.noEmployee") }),
    selected != null && !employees.some((employee) => employee.id === selected) && /* @__PURE__ */ jsx49("option", { value: selected, disabled: true, children: t("operationsForm.employeeUnavailable") }),
    employees.map((employee) => /* @__PURE__ */ jsx49("option", { value: employee.id, children: employee.name }, employee.id))
  ] });
}
function AccessEditor({ entry, kind, employees, busy, refreshFailed, feedback, onDirty, onCancel, onSave, onRemove, onReload }) {
  const { t } = useFormLocale();
  const [role, setRole] = useState20(entry.role);
  const [employeeId, setEmployeeId] = useState20(entry.employeeId);
  const id = kind === "member" ? entry.userId : entry.id;
  const reassigned = kind === "member" && employeeId !== entry.employeeId;
  const invalid = role !== "admin" && employeeId == null || employeeId != null && !employees.some((employee) => employee.id === employeeId);
  useEffect16(() => {
    setRole(entry.role);
    setEmployeeId(entry.employeeId);
  }, [entry.role, entry.employeeId]);
  useEffect16(() => {
    onDirty(role !== entry.role || employeeId !== entry.employeeId);
  }, [role, employeeId, entry.role, entry.employeeId, onDirty]);
  const prefix3 = `${kind}-${id}`;
  return /* @__PURE__ */ jsxs38("form", { className: "flex min-h-0 flex-1 flex-col", onSubmit: (event) => {
    event.preventDefault();
    if (!busy && !invalid && !refreshFailed && entry.role !== "owner") onSave(role, employeeId);
  }, children: [
    /* @__PURE__ */ jsxs38("div", { className: "flex-1 space-y-6 overflow-y-auto p-6", children: [
      /* @__PURE__ */ jsxs38("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx49(Label, { htmlFor: `${kind}-role-${id}`, children: t("operationsForm.accessLevel") }),
        /* @__PURE__ */ jsx49("select", { id: `${kind}-role-${id}`, disabled: busy, "aria-label": t("operationsForm.memberAccess", { email: entry.email }), className: selectClass, value: role, onChange: (event) => setRole(event.target.value), children: ["admin", "provider", "viewer"].map((value) => /* @__PURE__ */ jsx49("option", { value, children: t(`operationsForm.role_${value}`) }, value)) }),
        /* @__PURE__ */ jsx49("p", { className: "text-sm text-muted-foreground", children: t("operationsForm.rolesHelp") })
      ] }),
      /* @__PURE__ */ jsxs38("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx49(Label, { htmlFor: `${kind}-employee-${id}`, children: t("teamManagement.assignedEmployee") }),
        /* @__PURE__ */ jsx49("select", { id: `${kind}-employee-${id}`, disabled: busy, "aria-label": t("operationsForm.memberEmployee", { email: entry.email }), "aria-describedby": `${prefix3}-help${reassigned ? ` reassignment-${id}` : ""}`, className: selectClass, value: employeeId ?? "none", onChange: (event) => setEmployeeId(event.target.value === "none" ? null : Number(event.target.value)), children: /* @__PURE__ */ jsx49(EmployeeOptions, { employees, selected: employeeId }) })
      ] }),
      /* @__PURE__ */ jsxs38("div", { id: `${prefix3}-help`, className: "flex gap-3 rounded-lg bg-muted p-4 text-sm text-foreground", children: [
        /* @__PURE__ */ jsx49(Info, { "aria-hidden": "true", className: "mt-0.5 h-5 w-5 shrink-0" }),
        /* @__PURE__ */ jsx49("p", { children: t(kind === "member" ? "teamManagement.memberHelp" : "operationsForm.invitationEditHelp") })
      ] }),
      reassigned && /* @__PURE__ */ jsx49("p", { id: `reassignment-${id}`, role: "status", className: "rounded-md border border-amber-500/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100", children: t("operationsForm.reassignmentWarning", { email: entry.email }) }),
      /* @__PURE__ */ jsx49(Receipt, { feedback, pending: busy }),
      refreshFailed && /* @__PURE__ */ jsx49(Button, { type: "button", variant: "outline", disabled: busy, onClick: onReload, children: t("teamManagement.retry") }),
      /* @__PURE__ */ jsxs38("div", { className: "space-y-2 border-t pt-5", children: [
        /* @__PURE__ */ jsx49("h4", { className: "font-medium text-destructive", children: t(kind === "member" ? "operationsForm.removeAccess" : "operationsForm.revoke") }),
        kind === "member" && /* @__PURE__ */ jsx49("p", { className: "text-sm text-muted-foreground", children: t("teamManagement.removeHelp") }),
        /* @__PURE__ */ jsx49(Button, { type: "button", variant: "outline", className: "border-red-300 text-destructive dark:border-red-800", disabled: busy || refreshFailed, "aria-label": kind === "invitation" ? t("operationsForm.revokeInvitation", { email: entry.email }) : t("operationsForm.removeMember", { email: entry.email }), onClick: () => {
          if (kind === "invitation" || window.confirm(t("operationsForm.removeMember", { email: entry.email }))) onRemove();
        }, children: t(kind === "member" ? "operationsForm.removeAccess" : "operationsForm.revoke") })
      ] })
    ] }),
    /* @__PURE__ */ jsxs38("div", { className: "flex flex-wrap justify-end gap-3 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]", children: [
      /* @__PURE__ */ jsx49(Button, { type: "button", variant: "outline", disabled: busy, onClick: onCancel, children: t("teamManagement.cancel") }),
      /* @__PURE__ */ jsx49(Button, { id: kind === "invitation" ? `save-invitation-${id}` : `save-member-${id}`, disabled: busy || invalid || refreshFailed, "aria-label": kind === "invitation" ? t("operationsForm.saveInvitationFor", { email: entry.email }) : void 0, children: t(reassigned ? "operationsForm.saveReassignment" : "operationsForm.saveAccess") })
    ] })
  ] });
}
function CompanyTeam(props) {
  const { context: context2 } = props;
  return /* @__PURE__ */ jsx49(TeamWorkspace, { ...props }, `${context2.company?.id}:${context2.membership?.userId}:${context2.membership?.role}:${context2.permissions.manageTeam}`);
}
function TeamWorkspace({ context: context2, employees }) {
  const { t, i18n } = useFormLocale();
  const queryClient3 = useQueryClient11();
  const locked = useRef12(false);
  const mounted = useRef12(true);
  const dirty = useRef12(false);
  const trigger = useRef12(null);
  const heading = useRef12(null);
  const setDirty = useRef12((value) => {
    dirty.current = value;
  }).current;
  const [panel, setPanel] = useState20(null);
  const [filter, setFilter] = useState20("all");
  const [search, setSearch] = useState20("");
  const [feedback, setFeedback] = useState20({});
  const [notice, setNotice] = useState20("");
  const [email, setEmail] = useState20("");
  const [role, setRole] = useState20("provider");
  const [employeeId, setEmployeeId] = useState20(null);
  const [sendEmail, setSendEmail] = useState20(true);
  const [invitationUrl, setInvitationUrl] = useState20("");
  const [invitationCreated, setInvitationCreated] = useState20(false);
  const [transferTo, setTransferTo] = useState20("");
  const canViewTeam = Boolean(context2.company && (context2.permissions.manageTeam || context2.permissions.isOwner));
  const teamKey = ["/api/company/team", context2.company?.id];
  const team = useQuery15({ queryKey: teamKey, enabled: canViewTeam, retry: false });
  useEffect16(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const change = useMutation9({
    mutationFn: async (action) => {
      const response = await apiRequest(action.method, action.path, action.body);
      return response.json();
    },
    onSuccess: async (data, action) => {
      await invalidateWorkspace(queryClient3);
      if (!mounted.current) return;
      const message = t(data.invitationUrl ? data.emailSent ? "operationsForm.invitationSent" : "operationsForm.shareInvitation" : "operationsForm.saved");
      const refreshFailed = queryClient3.getQueryState(teamKey)?.status === "error";
      setFeedback((previous) => ({ ...previous, [action.path]: refreshFailed ? { error: t("teamManagement.refreshError") } : { message } }));
      if (data.invitationUrl) {
        setInvitationUrl(data.invitationUrl);
        setEmail("");
        setEmployeeId(null);
        setInvitationCreated(true);
        setFilter("all");
        setSearch("");
      } else if (!refreshFailed && (action.path.startsWith("/api/company/members/") || action.path.startsWith("/api/company/invitations/"))) {
        dirty.current = false;
        setPanel(null);
      }
      if (action.path === "/api/company/transfer") setTransferTo("");
      setNotice(refreshFailed ? "" : message);
    },
    onError: (_, action) => {
      if (mounted.current) setFeedback((previous) => ({ ...previous, [action.path]: { error: t("operationsForm.saveError") } }));
    },
    onSettled: () => {
      locked.current = false;
    }
  });
  const run = (method, path, body) => {
    if (locked.current || !canViewTeam) return;
    locked.current = true;
    setNotice("");
    setFeedback((previous) => ({ ...previous, [path]: {} }));
    change.mutate({ method, path, body });
  };
  const receipt = (path) => /* @__PURE__ */ jsx49(Receipt, { feedback: feedback[path], pending: change.isPending && change.variables?.path === path });
  const reloadTeam = async () => {
    const path = panel && entryPath(panel);
    const result = await team.refetch();
    if (mounted.current && result.isSuccess && path) setFeedback((previous) => ({ ...previous, [path]: {} }));
  };
  const closePanel = (discard = false) => {
    if (locked.current) return;
    const hasDraft = panel?.kind === "invite" ? !invitationCreated && Boolean(email || employeeId != null || role !== "provider" || !sendEmail) : dirty.current;
    if (!discard && hasDraft && !window.confirm(t("teamManagement.discardConfirm"))) return;
    dirty.current = false;
    setPanel(null);
  };
  const openPanel = (next, target) => {
    trigger.current = target;
    dirty.current = false;
    if (next.kind === "invite") {
      setEmail("");
      setRole("provider");
      setEmployeeId(null);
      setSendEmail(true);
      setInvitationCreated(false);
    }
    setFeedback((previous) => ({ ...previous, [entryPath(next)]: {} }));
    setPanel(next);
  };
  const availableFor = (selected2) => employees.filter((employee) => !team.data?.members.some((member) => !(selected2?.kind === "member" && member.userId === selected2.id) && member.employeeId === employee.id) && !team.data?.invitations.some((invitation) => !(selected2?.kind === "invitation" && invitation.id === selected2.id) && invitation.employeeId === employee.id));
  const availableEmployees = availableFor();
  const invitationDisabled = !team.isSuccess || role !== "admin" && employeeId == null || employeeId != null && !availableEmployees.some((employee) => employee.id === employeeId);
  const selected = panel?.kind === "member" ? team.data?.members.find((member) => member.userId === panel.id) : panel?.kind === "invitation" ? team.data?.invitations.find((invitation) => invitation.id === panel.id) : void 0;
  const panelAvailable = panel?.kind === "invite" || selected && selected.role !== "owner";
  const employeeName = (id) => id == null ? t("operationsForm.noEmployee") : employees.find((employee) => employee.id === id)?.name || t("operationsForm.employeeUnavailable");
  const entries = [
    ...(team.data?.members ?? []).map((member) => ({ key: `member-${member.userId}`, panel: { kind: "member", id: member.userId }, name: memberName(member), entry: member, pending: false })),
    ...(team.data?.invitations ?? []).map((invitation) => ({ key: `invitation-${invitation.id}`, panel: { kind: "invitation", id: invitation.id }, name: invitation.email, entry: invitation, pending: true }))
  ];
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visible = entries.filter((row) => (filter === "all" || filter === "invitations" === row.pending) && `${row.name} ${row.entry.email} ${employeeName(row.entry.employeeId)}`.toLocaleLowerCase().includes(normalizedSearch));
  const copyLink = () => {
    void Promise.resolve().then(() => navigator.clipboard.writeText(invitationUrl)).then(() => {
      if (mounted.current) setFeedback((previous) => ({ ...previous, copy: { message: t("operationsForm.copied") } }));
    }).catch(() => {
      if (mounted.current) setFeedback((previous) => ({ ...previous, copy: { error: t("operationsForm.copyHelp") } }));
    });
  };
  const linkReceipt = (id) => /* @__PURE__ */ jsxs38("div", { className: "space-y-3 rounded-lg border bg-muted p-4", children: [
    /* @__PURE__ */ jsx49(Label, { htmlFor: id, children: t("operationsForm.invitationLink") }),
    /* @__PURE__ */ jsx49(Input, { id, readOnly: true, value: invitationUrl, onFocus: (event) => event.target.select() }),
    /* @__PURE__ */ jsx49(Button, { type: "button", variant: "outline", onClick: copyLink, children: t("operationsForm.copyLink") }),
    receipt("copy")
  ] });
  return /* @__PURE__ */ jsxs38("section", { className: "phase3-form team-management space-y-6", "aria-labelledby": "team-access-heading", children: [
    /* @__PURE__ */ jsxs38("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [
      /* @__PURE__ */ jsxs38("div", { className: "min-w-0 space-y-1", children: [
        /* @__PURE__ */ jsx49("h2", { ref: heading, tabIndex: -1, id: "team-access-heading", className: "text-2xl font-semibold tracking-tight", children: t("teamManagement.title") }),
        context2.company && /* @__PURE__ */ jsxs38("p", { className: "text-sm text-muted-foreground", children: [
          /* @__PURE__ */ jsx49("bdi", { children: context2.company.name }),
          " \xB7 ",
          t(`operationsForm.role_${context2.membership?.role ?? "viewer"}`),
          !context2.company.isActive ? t("operationsForm.closed") : ""
        ] })
      ] }),
      canViewTeam && context2.permissions.manageTeam && /* @__PURE__ */ jsxs38(Button, { id: "team-invite", type: "button", disabled: change.isPending || !team.isSuccess, onClick: (event) => openPanel({ kind: "invite" }, event.currentTarget), children: [
        /* @__PURE__ */ jsx49(Plus3, { className: "me-2 h-4 w-4 shrink-0", "aria-hidden": "true" }),
        t("teamManagement.invite")
      ] })
    ] }),
    !canViewTeam ? /* @__PURE__ */ jsx49("p", { role: "alert", children: t("teamManagement.denied") }) : /* @__PURE__ */ jsxs38(Fragment10, { children: [
      notice && /* @__PURE__ */ jsxs38("p", { role: "status", className: "flex gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100", children: [
        /* @__PURE__ */ jsx49(Check3, { "aria-hidden": "true", className: "h-5 w-5 shrink-0" }),
        notice
      ] }),
      team.isLoading ? /* @__PURE__ */ jsx49("p", { role: "status", children: t("operationsForm.loadingTeam") }) : team.isError ? /* @__PURE__ */ jsxs38("div", { role: "alert", className: "space-y-3 rounded-lg border p-4", children: [
        /* @__PURE__ */ jsx49("p", { children: t("operationsForm.loadTeamError") }),
        /* @__PURE__ */ jsx49(Button, { type: "button", variant: "outline", disabled: team.isFetching, onClick: () => void reloadTeam(), children: t("teamManagement.retry") })
      ] }) : /* @__PURE__ */ jsxs38(Fragment10, { children: [
        /* @__PURE__ */ jsxs38("div", { className: "flex flex-wrap gap-3", children: [
          /* @__PURE__ */ jsxs38("div", { className: "relative min-w-0 flex-[1_1_16rem]", children: [
            /* @__PURE__ */ jsx49(Search, { "aria-hidden": "true", className: "pointer-events-none absolute start-3 top-3 h-5 w-5 text-muted-foreground" }),
            /* @__PURE__ */ jsx49(Label, { htmlFor: "team-search", className: "sr-only", children: t("teamManagement.search") }),
            /* @__PURE__ */ jsx49(Input, { id: "team-search", type: "search", className: "ps-10", placeholder: t("teamManagement.search"), value: search, onChange: (event) => setSearch(event.target.value) })
          ] }),
          /* @__PURE__ */ jsx49("div", { className: "flex flex-wrap gap-2", role: "group", "aria-label": t("teamManagement.status"), children: ["all", "members", "invitations"].map((value) => /* @__PURE__ */ jsxs38(Button, { id: `team-filter-${value}`, variant: "outline", className: filter === value ? "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-100" : void 0, "aria-pressed": filter === value, onClick: () => setFilter(value), children: [
            t(`teamManagement.${value}`),
            /* @__PURE__ */ jsx49("span", { className: "ms-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-foreground", children: new Intl.NumberFormat(i18n.language).format(value === "all" ? entries.length : value === "members" ? team.data?.members.length ?? 0 : team.data?.invitations.length ?? 0) })
          ] }, value)) })
        ] }),
        /* @__PURE__ */ jsxs38("div", { className: "overflow-hidden rounded-xl border bg-card text-card-foreground", children: [
          /* @__PURE__ */ jsx49("div", { "aria-hidden": "true", className: `${rowClass} hidden border-b bg-muted text-xs font-medium text-neutral-600 dark:text-neutral-300 lg:grid`, children: ["person", "access", "assignedEmployee", "status", "actions"].map((key) => /* @__PURE__ */ jsx49("span", { children: t(`teamManagement.${key}`) }, key)) }),
          /* @__PURE__ */ jsx49("ul", { id: "team-roster", className: "divide-y", "aria-label": t("operationsForm.teamEntries"), children: visible.map((row) => /* @__PURE__ */ jsxs38("li", { id: `team-row-${row.key}`, className: `${rowClass} ${panel && "id" in panel && "id" in row.panel && panel.kind === row.panel.kind && panel.id === row.panel.id ? "bg-indigo-50 dark:bg-indigo-950" : ""}`, children: [
            /* @__PURE__ */ jsxs38("div", { className: "flex min-w-0 items-center gap-3", children: [
              /* @__PURE__ */ jsx49("span", { "aria-hidden": "true", className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200", children: row.name.split(/\s+/).slice(0, 2).map((value) => Array.from(value)[0]).join("").toLocaleUpperCase() }),
              /* @__PURE__ */ jsxs38("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx49("p", { className: "break-words font-medium", children: /* @__PURE__ */ jsx49("bdi", { children: row.name }) }),
                row.name !== row.entry.email && /* @__PURE__ */ jsx49("p", { className: "break-all text-sm text-muted-foreground", children: /* @__PURE__ */ jsx49("bdi", { children: row.entry.email }) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs38("div", { className: "text-sm", children: [
              /* @__PURE__ */ jsx49("span", { className: "mb-1 block text-xs text-muted-foreground lg:sr-only", children: t("operationsForm.accessLevel") }),
              /* @__PURE__ */ jsx49("span", { className: "inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200", children: t(`operationsForm.role_${row.entry.role}`) })
            ] }),
            /* @__PURE__ */ jsxs38("div", { className: "min-w-0 break-words text-sm", children: [
              /* @__PURE__ */ jsx49("span", { className: "mb-1 block text-xs text-muted-foreground lg:sr-only", children: t("teamManagement.assignedEmployee") }),
              /* @__PURE__ */ jsx49("bdi", { children: employeeName(row.entry.employeeId) })
            ] }),
            /* @__PURE__ */ jsx49("div", { children: /* @__PURE__ */ jsx49("span", { className: `inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${row.pending ? "border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100" : "bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100"}`, children: t(row.pending ? "operationsForm.pendingAcceptance" : "operationsForm.memberStatus") }) }),
            /* @__PURE__ */ jsx49("div", { children: row.entry.role === "owner" ? /* @__PURE__ */ jsxs38("span", { className: "inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground", title: t("teamManagement.ownerProtected"), children: [
              /* @__PURE__ */ jsx49(LockKeyhole, { "aria-hidden": "true", className: "h-4 w-4" }),
              /* @__PURE__ */ jsx49("span", { className: "lg:sr-only", children: t("teamManagement.ownerProtected") })
            ] }) : context2.permissions.manageTeam && /* @__PURE__ */ jsx49(Button, { type: "button", id: `edit-${row.key}`, variant: "outline", disabled: change.isPending, "aria-label": t("teamManagement.editFor", { email: row.entry.email }), onClick: (event) => openPanel(row.panel, event.currentTarget), children: t("teamManagement.edit") }) })
          ] }, row.key)) }),
          !visible.length && /* @__PURE__ */ jsxs38("div", { className: "space-y-3 p-8 text-center text-sm text-muted-foreground", children: [
            /* @__PURE__ */ jsx49(Users, { className: "mx-auto h-8 w-8", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx49("p", { role: "status", children: t(entries.length ? "teamManagement.noResults" : "teamManagement.empty") }),
            entries.length > 0 && /* @__PURE__ */ jsx49(Button, { variant: "outline", onClick: () => {
              setSearch("");
              setFilter("all");
            }, children: t("teamManagement.clearSearch") })
          ] })
        ] })
      ] }),
      invitationUrl && panel?.kind !== "invite" && linkReceipt("invitation-link"),
      context2.permissions.isOwner && /* @__PURE__ */ jsxs38("details", { className: "group rounded-xl border bg-card p-4", children: [
        /* @__PURE__ */ jsxs38("summary", { className: "flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden", children: [
          /* @__PURE__ */ jsx49(ChevronRight3, { "aria-hidden": "true", className: "h-5 w-5 shrink-0 transition-transform group-open:rotate-90 rtl:rotate-180" }),
          /* @__PURE__ */ jsxs38("span", { children: [
            /* @__PURE__ */ jsx49("span", { className: "block font-semibold", children: t("operationsForm.ownerControls") }),
            /* @__PURE__ */ jsx49("span", { className: "text-sm text-muted-foreground", children: t("teamManagement.ownerHelp") })
          ] })
        ] }),
        /* @__PURE__ */ jsxs38("div", { className: "mt-4 space-y-4 border-t pt-4", children: [
          /* @__PURE__ */ jsxs38("div", { className: "max-w-lg space-y-2", children: [
            /* @__PURE__ */ jsx49(Label, { htmlFor: "team-new-owner", children: t("operationsForm.newOwner") }),
            /* @__PURE__ */ jsxs38("select", { id: "team-new-owner", disabled: change.isPending || !team.isSuccess, className: selectClass, value: transferTo, onChange: (event) => setTransferTo(event.target.value), children: [
              /* @__PURE__ */ jsx49("option", { value: "", children: t("operationsForm.chooseOwner") }),
              team.data?.members.filter((member) => member.role !== "owner").map((member) => /* @__PURE__ */ jsx49("option", { value: member.userId, children: member.email }, member.userId))
            ] })
          ] }),
          /* @__PURE__ */ jsx49(Button, { variant: "outline", disabled: !transferTo || change.isPending || !team.isSuccess || !team.data?.members.some((member) => member.userId === transferTo && member.role !== "owner"), onClick: () => {
            if (window.confirm(t("operationsForm.transferConfirm", { email: team.data?.members.find((member) => member.userId === transferTo)?.email }))) run("POST", "/api/company/transfer", { userId: transferTo });
          }, children: t("operationsForm.transfer") }),
          receipt("/api/company/transfer"),
          /* @__PURE__ */ jsx49("div", { children: /* @__PURE__ */ jsx49(Button, { variant: "outline", disabled: change.isPending, onClick: () => {
            if (window.confirm(t(context2.company.isActive ? "operationsForm.closeConfirm" : "operationsForm.reopenConfirm", { name: context2.company.name }))) run("PATCH", "/api/company/active", { isActive: !context2.company.isActive });
          }, children: t(context2.company.isActive ? "operationsForm.closeCompany" : "operationsForm.reopenCompany") }) }),
          receipt("/api/company/active")
        ] })
      ] }),
      /* @__PURE__ */ jsx49(Sheet, { open: Boolean(panel && panelAvailable && context2.permissions.manageTeam), onOpenChange: (open) => {
        if (!open) closePanel();
      }, children: /* @__PURE__ */ jsxs38(SheetContent, { side: i18n.dir() === "rtl" ? "left" : "right", dir: i18n.dir(), closeLabel: t("teamManagement.close"), overlayClassName: "bg-black/20", className: "phase3-form team-management flex h-[100dvh] w-full flex-col gap-0 p-0 sm:max-w-[480px]", onCloseAutoFocus: (event) => {
        event.preventDefault();
        const target = trigger.current;
        if (target?.isConnected && !target.matches(":disabled")) target.focus();
        else heading.current?.focus();
      }, onOpenAutoFocus: (event) => {
        event.preventDefault();
        const id = panel?.kind === "invite" ? "team-email" : panel ? `${panel.kind}-role-${panel.id}` : "";
        document.getElementById(id)?.focus();
      }, children: [
        /* @__PURE__ */ jsxs38(SheetHeader, { className: "shrink-0 border-b p-6 pe-12 text-start sm:text-start", children: [
          /* @__PURE__ */ jsx49(SheetTitle, { children: t(panel?.kind === "invite" ? "teamManagement.invite" : panel?.kind === "member" ? "teamManagement.editMember" : "teamManagement.editInvitation") }),
          /* @__PURE__ */ jsx49(SheetDescription, { children: panel?.kind === "invite" ? t("operationsForm.inviteLoginHelp") : selected?.email }),
          selected && /* @__PURE__ */ jsxs38("div", { className: "space-y-2 pt-3", children: [
            /* @__PURE__ */ jsx49("p", { className: "break-words font-semibold", children: /* @__PURE__ */ jsx49("bdi", { children: panel?.kind === "member" ? memberName(selected) : selected.email }) }),
            /* @__PURE__ */ jsx49("span", { className: "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs", children: t(panel?.kind === "member" ? "operationsForm.memberStatus" : "operationsForm.pendingAcceptance") })
          ] })
        ] }),
        panel && panel.kind !== "invite" && selected && /* @__PURE__ */ jsx49(AccessEditor, { kind: panel.kind, entry: selected, employees: availableFor(panel), busy: change.isPending || !context2.permissions.manageTeam, refreshFailed: team.isError, onReload: () => void reloadTeam(), feedback: feedback[entryPath(panel)], onDirty: setDirty, onCancel: () => closePanel(true), onSave: (role2, employeeId2) => run("PATCH", entryPath(panel), { role: role2, employeeId: employeeId2 }), onRemove: () => run("DELETE", entryPath(panel)) }, `${panel.kind}-${panel.id}`),
        panel?.kind === "invite" && (invitationCreated ? /* @__PURE__ */ jsxs38("div", { className: "flex min-h-0 flex-1 flex-col", children: [
          /* @__PURE__ */ jsxs38("div", { className: "flex-1 space-y-5 overflow-y-auto p-6", children: [
            /* @__PURE__ */ jsx49(Check3, { "aria-hidden": "true", className: "h-10 w-10 rounded-full bg-emerald-100 p-2 text-emerald-900" }),
            receipt("/api/company/invitations"),
            linkReceipt("invitation-link")
          ] }),
          /* @__PURE__ */ jsxs38("div", { className: "flex flex-wrap justify-end gap-3 border-t p-4", children: [
            /* @__PURE__ */ jsx49(Button, { variant: "outline", disabled: change.isPending, onClick: () => {
              setInvitationCreated(false);
              setRole("provider");
              setSendEmail(true);
              setFeedback((previous) => ({ ...previous, copy: {}, "/api/company/invitations": {} }));
              requestAnimationFrame(() => document.getElementById("team-email")?.focus());
            }, children: t("teamManagement.inviteAnother") }),
            /* @__PURE__ */ jsx49(Button, { disabled: change.isPending, onClick: () => closePanel(true), children: t("teamManagement.done") })
          ] })
        ] }) : /* @__PURE__ */ jsxs38("form", { className: "flex min-h-0 flex-1 flex-col", "aria-label": t("teamManagement.invite"), onSubmit: (event) => {
          event.preventDefault();
          if (!change.isPending && !invitationDisabled) run("POST", "/api/company/invitations", { email, role, employeeId, sendEmail });
        }, children: [
          /* @__PURE__ */ jsxs38("div", { className: "flex-1 space-y-5 overflow-y-auto p-6", children: [
            /* @__PURE__ */ jsxs38("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx49(Label, { htmlFor: "team-email", children: t("operationsForm.email") }),
              /* @__PURE__ */ jsx49(Input, { disabled: change.isPending, id: "team-email", type: "email", autoComplete: "email", required: true, maxLength: 254, value: email, onChange: (event) => setEmail(event.target.value) })
            ] }),
            /* @__PURE__ */ jsxs38("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx49(Label, { htmlFor: "team-role", children: t("operationsForm.accessLevel") }),
              /* @__PURE__ */ jsx49("select", { disabled: change.isPending, id: "team-role", className: selectClass, value: role, onChange: (event) => setRole(event.target.value), children: ["admin", "provider", "viewer"].map((role2) => /* @__PURE__ */ jsx49("option", { value: role2, children: t(`operationsForm.role_${role2}`) }, role2)) }),
              /* @__PURE__ */ jsx49("p", { className: "text-sm text-muted-foreground", children: t("operationsForm.rolesHelp") })
            ] }),
            /* @__PURE__ */ jsxs38("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx49(Label, { htmlFor: "team-employee", children: t("teamManagement.assignedEmployee") }),
              /* @__PURE__ */ jsx49("select", { disabled: change.isPending, "aria-describedby": "team-assignment-help", id: "team-employee", className: selectClass, value: employeeId ?? "none", onChange: (event) => setEmployeeId(event.target.value === "none" ? null : Number(event.target.value)), children: /* @__PURE__ */ jsx49(EmployeeOptions, { employees: availableEmployees, selected: employeeId }) }),
              /* @__PURE__ */ jsx49("p", { id: "team-assignment-help", className: "text-sm text-muted-foreground", children: t("operationsForm.assignmentHelp") })
            ] }),
            /* @__PURE__ */ jsxs38("label", { className: "flex min-h-11 items-center gap-3 text-sm", children: [
              /* @__PURE__ */ jsx49("input", { disabled: change.isPending, type: "checkbox", checked: sendEmail, onChange: (event) => setSendEmail(event.target.checked) }),
              t("operationsForm.sendInvitation")
            ] }),
            receipt("/api/company/invitations")
          ] }),
          /* @__PURE__ */ jsxs38("div", { className: "flex flex-wrap justify-end gap-3 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]", children: [
            /* @__PURE__ */ jsx49(Button, { type: "button", variant: "outline", disabled: change.isPending, onClick: () => closePanel(true), children: t("teamManagement.cancel") }),
            /* @__PURE__ */ jsx49(Button, { disabled: change.isPending || invitationDisabled, children: t("operationsForm.createInvitation") })
          ] })
        ] }))
      ] }) })
    ] })
  ] });
}
var selectClass, rowClass, memberName, entryPath;
var init_company_team = __esm({
  "client/src/components/company-team.tsx"() {
    "use strict";
    init_forms_locale();
    init_queryClient();
    init_button();
    init_input();
    init_label();
    init_sheet();
    selectClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
    rowClass = "grid gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem] lg:items-center lg:gap-4";
    memberName = (member) => [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
    entryPath = (panel) => panel.kind === "invite" ? "/api/company/invitations" : `/api/company/${panel.kind === "member" ? "members" : "invitations"}/${panel.id}`;
  }
});

// shared/storefront.ts
import { z as z5 } from "zod";
var storefrontSlugSchema, imagePath, storefrontSchema, subscriptionTargetSchema, subscriptionOptionsSchema, subscriptionUpdateSchema;
var init_storefront = __esm({
  "shared/storefront.ts"() {
    "use strict";
    storefrontSlugSchema = z5.string().trim().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");
    imagePath = z5.string().regex(/^\/objects\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(?:jpg|png|webp|gif)$/).nullable();
    storefrontSchema = z5.object({
      slug: storefrontSlugSchema,
      name: z5.string().trim().min(1).max(150),
      description: z5.string().trim().max(3e3),
      logoUrl: imagePath,
      coverUrl: imagePath,
      isPublished: z5.boolean()
    }).strict();
    subscriptionTargetSchema = z5.discriminatedUnion("kind", [
      z5.object({ kind: z5.literal("user"), id: z5.string().trim().min(1).max(128) }).strict(),
      z5.object({ kind: z5.literal("company"), id: z5.coerce.number().int().positive().max(2147483647) }).strict()
    ]);
    subscriptionOptionsSchema = z5.object({
      kind: z5.enum(["user", "company"]),
      search: z5.string().trim().max(200).default(""),
      page: z5.coerce.number().int().min(1).max(1e5).default(1)
    }).strict();
    subscriptionUpdateSchema = z5.object({
      target: subscriptionTargetSchema,
      plan: z5.enum(["free", "pro"]),
      proUntil: z5.string().datetime({ offset: true }).nullable()
    }).strict().refine((value) => value.plan === "free" || value.proUntil != null && Date.parse(value.proUntil) > Date.now(), "Pro access must have a future expiry date.");
  }
});

// shared/provider-catalog.ts
import { z as z6 } from "zod";
function providerCatalogQuery(service2) {
  return new URLSearchParams(service2.companyId != null ? { companyId: String(service2.companyId) } : { providerId: service2.providerId }).toString();
}
var providerCatalogSchema;
var init_provider_catalog = __esm({
  "shared/provider-catalog.ts"() {
    "use strict";
    providerCatalogSchema = z6.union([
      z6.object({ companyId: z6.coerce.number().int().positive().max(2147483647) }).strict(),
      z6.object({ providerId: z6.string().trim().min(1).max(128) }).strict()
    ]);
  }
});

// client/src/lib/service-sort.ts
function canSortServicePrices(services) {
  return services.every((service2) => isSupportedCurrency(service2.currency)) && new Set(services.map((service2) => service2.currency)).size <= 1;
}
function serviceRating(service2) {
  return typeof service2.rating === "number" && Number.isFinite(service2.rating) && service2.rating >= 1 && service2.rating <= 5 ? service2.rating : void 0;
}
var init_service_sort = __esm({
  "client/src/lib/service-sort.ts"() {
    "use strict";
    init_locations();
    init_currencies();
  }
});

// client/src/lib/review-date.ts
function relativeReviewDate(date, locale, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1e3));
  const format3 = new Intl.RelativeTimeFormat(locale || "en", { numeric: "auto" });
  if (seconds < 60) return format3.format(0, "second");
  const units = [[31536e3, "year"], [2592e3, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  const [size, unit] = units.find(([size2]) => seconds >= size2);
  return format3.format(-Math.floor(seconds / size), unit);
}
var init_review_date = __esm({
  "client/src/lib/review-date.ts"() {
    "use strict";
  }
});

// client/src/components/service-reviews.tsx
import { useState as useState21 } from "react";
import { useQuery as useQuery16 } from "@tanstack/react-query";
import { useTranslation as useTranslation31 } from "react-i18next";
import { Star as Star2 } from "lucide-react";
import { Fragment as Fragment11, jsx as jsx50, jsxs as jsxs39 } from "react/jsx-runtime";
function ServiceReviews({ serviceId }) {
  const { t, i18n } = useTranslation31();
  const [page, setPage] = useState21(1);
  const query = useQuery16({
    queryKey: ["/api/services", serviceId, "reviews", page],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/services/${serviceId}/reviews?page=${page}`, { signal });
      if (!response.ok) throw new Error("Unable to load reviews");
      return response.json();
    },
    staleTime: 0
  });
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  return /* @__PURE__ */ jsx50("div", { className: "space-y-4", "aria-live": "polite", children: query.isLoading ? /* @__PURE__ */ jsx50("p", { role: "status", children: t("reviews.loading") }) : query.isError ? /* @__PURE__ */ jsxs39("div", { role: "alert", className: "space-y-3", children: [
    /* @__PURE__ */ jsx50("p", { children: t("reviews.loadError") }),
    /* @__PURE__ */ jsx50(Button, { variant: "outline", onClick: () => void query.refetch(), disabled: query.isFetching, children: t("reviews.retry") })
  ] }) : /* @__PURE__ */ jsxs39(Fragment11, { children: [
    !query.data?.reviews.length ? /* @__PURE__ */ jsx50("p", { className: "text-sm text-neutral-500", children: t("reviews.empty") }) : /* @__PURE__ */ jsx50("ul", { className: "space-y-4", children: query.data.reviews.map((review) => /* @__PURE__ */ jsxs39("li", { className: "border rounded-lg p-4 space-y-3", "data-testid": `public-review-${review.id}`, children: [
      /* @__PURE__ */ jsxs39("div", { className: "flex flex-wrap justify-between gap-2", children: [
        /* @__PURE__ */ jsx50("p", { className: "font-medium break-words", children: review.reviewerName || t("reviews.customer") }),
        /* @__PURE__ */ jsx50("time", { dateTime: review.createdAt, title: new Date(review.createdAt).toLocaleDateString(locale), className: "text-sm text-neutral-500", children: relativeReviewDate(review.createdAt, locale) })
      ] }),
      /* @__PURE__ */ jsx50("div", { className: "flex gap-1", role: "img", "aria-label": t("reviews.stars", { count: review.rating }), children: [1, 2, 3, 4, 5].map((star) => /* @__PURE__ */ jsx50(Star2, { "aria-hidden": "true", className: `h-4 w-4 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"}` }, star)) }),
      review.comment && /* @__PURE__ */ jsx50("p", { className: "text-sm whitespace-pre-wrap break-words", children: review.comment })
    ] }, review.id)) }),
    /* @__PURE__ */ jsxs39("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx50(Button, { variant: "outline", disabled: page === 1, onClick: () => setPage((current) => current - 1), children: t("reviews.previous") }),
      /* @__PURE__ */ jsx50("span", { className: "text-sm text-neutral-500", children: t("reviews.page", { page }) }),
      /* @__PURE__ */ jsx50(Button, { variant: "outline", disabled: !query.data?.hasMore, onClick: () => setPage((current) => current + 1), children: t("reviews.next") })
    ] })
  ] }) });
}
var init_service_reviews = __esm({
  "client/src/components/service-reviews.tsx"() {
    "use strict";
    init_button();
    init_review_date();
  }
});

// client/src/components/service-rating.tsx
import { Star as Star3 } from "lucide-react";
import { useTranslation as useTranslation32 } from "react-i18next";
import { Fragment as Fragment12, jsx as jsx51, jsxs as jsxs40 } from "react/jsx-runtime";
function ServiceRating({ service: service2, compact = false }) {
  const { t, i18n } = useTranslation32();
  const rating = serviceRating(service2);
  if (rating !== void 0) return /* @__PURE__ */ jsxs40(Dialog, { children: [
    /* @__PURE__ */ jsx51(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsxs40(
      "button",
      {
        type: "button",
        className: "flex flex-wrap items-center gap-1 text-sm text-neutral-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
        "aria-label": t("reviews.view", { name: service2.name }),
        "data-testid": `button-reviews-${service2.id}`,
        children: [
          /* @__PURE__ */ jsx51(Star3, { className: "w-4 h-4 text-amber-400 fill-current", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx51("span", { className: "font-medium", children: rating.toFixed(1) }),
          /* @__PURE__ */ jsx51("span", { className: compact ? "sr-only" : void 0, children: t("service.ratingOutOfFive") }),
          typeof service2.reviewCount === "number" && service2.reviewCount > 0 && /* @__PURE__ */ jsx51("span", { children: compact ? `(${new Intl.NumberFormat(i18n.resolvedLanguage).format(service2.reviewCount)})` : /* @__PURE__ */ jsxs40(Fragment12, { children: [
            "\xB7 ",
            t("reviews.count", { count: service2.reviewCount })
          ] }) })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs40(DialogContent, { className: "max-w-2xl max-h-[85dvh] overflow-y-auto", "data-testid": "dialog-service-reviews", children: [
      /* @__PURE__ */ jsxs40(DialogHeader, { children: [
        /* @__PURE__ */ jsx51(DialogTitle, { children: t("reviews.heading") }),
        /* @__PURE__ */ jsx51(DialogDescription, { children: service2.name })
      ] }),
      /* @__PURE__ */ jsx51(ServiceReviews, { serviceId: service2.id })
    ] })
  ] });
  return /* @__PURE__ */ jsx51("span", { role: "img", "aria-label": t("service.notRated"), className: "inline-flex items-center text-neutral-500", "data-testid": `text-rating-${service2.id}`, children: /* @__PURE__ */ jsx51(Star3, { className: "w-4 h-4", "aria-hidden": "true" }) });
}
var init_service_rating = __esm({
  "client/src/components/service-rating.tsx"() {
    "use strict";
    init_service_sort();
    init_dialog();
    init_service_reviews();
  }
});

// client/src/components/search-service-card.tsx
import { useTranslation as useTranslation33 } from "react-i18next";
import { Link as Link10 } from "wouter";
import { jsx as jsx52 } from "react/jsx-runtime";
function SearchServiceCard({ service: source, onViewDetails, onViewProvider, hasLocation, wishlistEnabled = true }) {
  const { t } = useTranslation33();
  const categories = useCategories();
  const service2 = currentLocation(source);
  const provider = getProviderName(service2.provider);
  return /* @__PURE__ */ jsx52(
    ServiceResultCard,
    {
      service: service2,
      onViewDetails,
      wishlistEnabled,
      employeeName: service2.employee?.name,
      category: categories.data?.find((category) => category.key === service2.category)?.name ?? service2.category,
      distance: hasLocation ? service2.distance : void 0,
      rating: /* @__PURE__ */ jsx52(ServiceRating, { service: service2, compact: true }),
      provider: service2.storefrontSlug ? /* @__PURE__ */ jsx52(Link10, { href: `/providers/${service2.storefrontSlug}`, children: /* @__PURE__ */ jsx52("bdi", { children: provider }) }) : onViewProvider ? /* @__PURE__ */ jsx52("button", { type: "button", "data-testid": `button-provider-${service2.id}`, onClick: onViewProvider, "aria-label": t("catalog.view", { name: provider }), children: /* @__PURE__ */ jsx52("bdi", { children: provider }) }) : /* @__PURE__ */ jsx52("span", { children: /* @__PURE__ */ jsx52("bdi", { children: provider }) })
    }
  );
}
var init_search_service_card = __esm({
  "client/src/components/search-service-card.tsx"() {
    "use strict";
    init_service_rating();
    init_service_result_card();
    init_use_categories();
    init_provider();
    init_locations();
  }
});

// client/src/components/service-card.tsx
import { Clock as Clock4, Users as Users2, MapPin } from "lucide-react";
import { useTranslation as useTranslation34 } from "react-i18next";
import { Link as Link11 } from "wouter";
import { Fragment as Fragment13, jsx as jsx53, jsxs as jsxs41 } from "react/jsx-runtime";
function ServiceCard({ service: service2, onBook, onViewDetails, onViewProvider, searchLayout, hasLocation = false, wishlistEnabled = true }) {
  service2 = currentLocation(service2);
  const { t, i18n } = useTranslation34();
  const categories = useCategories();
  if (searchLayout) return /* @__PURE__ */ jsx53(SearchServiceCard, { service: service2, onViewDetails, onViewProvider, hasLocation, wishlistEnabled });
  const isGroupService = service2.serviceType === "group";
  const availableSpots = isGroupService ? (service2.maxCapacity || 1) - (service2.availableCapacity || 0) : 1;
  return /* @__PURE__ */ jsx53(Card, { className: "shadow-sm hover:shadow-md transition-shadow", children: /* @__PURE__ */ jsx53(CardContent, { className: "p-4", children: /* @__PURE__ */ jsxs41("div", { className: "flex space-x-3", children: [
    /* @__PURE__ */ jsxs41("div", { className: "relative w-16 h-16 shrink-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg flex items-center justify-center", children: [
      service2.imageUrl ? /* @__PURE__ */ jsx53("img", { src: service2.imageUrl, alt: service2.name, className: "w-16 h-16 rounded-lg object-cover", loading: "lazy" }) : /* @__PURE__ */ jsx53("span", { className: "text-2xl", children: categories.data?.find((category) => category.key === service2.category)?.icon || "\u{1F4CB}" }),
      wishlistEnabled && /* @__PURE__ */ jsx53(WishlistHeart, { serviceId: service2.id })
    ] }),
    /* @__PURE__ */ jsxs41("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ jsxs41("div", { className: "flex items-center justify-between mb-1", children: [
        /* @__PURE__ */ jsx53(
          "h3",
          {
            className: "font-semibold text-neutral-800 hover:text-primary cursor-pointer",
            onClick: onViewDetails,
            "data-testid": `button-view-details-${service2.id}`,
            children: service2.name
          }
        ),
        /* @__PURE__ */ jsx53(Badge, { variant: isGroupService ? "secondary" : "default", children: isGroupService ? "Group" : "One-to-One" })
      ] }),
      /* @__PURE__ */ jsxs41("div", { className: "flex flex-wrap items-center gap-2 mb-2", children: [
        service2.storefrontSlug ? /* @__PURE__ */ jsx53(Link11, { href: `/providers/${service2.storefrontSlug}`, className: "text-sm text-primary underline underline-offset-2", "data-testid": `link-provider-${service2.id}`, children: getProviderName(service2.provider) }) : onViewProvider ? /* @__PURE__ */ jsx53(
          "button",
          {
            type: "button",
            onClick: onViewProvider,
            "data-testid": `button-provider-${service2.id}`,
            "aria-label": t("catalog.view", { name: getProviderName(service2.provider) }),
            className: "text-sm text-primary text-left underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            children: getProviderName(service2.provider)
          }
        ) : /* @__PURE__ */ jsx53("p", { className: "text-sm text-neutral-600", children: getProviderName(service2.provider) }),
        service2.distance !== void 0 && /* @__PURE__ */ jsxs41(Fragment13, { children: [
          /* @__PURE__ */ jsx53("span", { className: "text-sm text-neutral-500", children: "\u2022" }),
          /* @__PURE__ */ jsxs41("div", { className: "flex items-center", children: [
            /* @__PURE__ */ jsx53(MapPin, { className: "w-3 h-3 text-neutral-400 mr-1" }),
            /* @__PURE__ */ jsxs41("span", { className: "text-sm text-neutral-500", "data-testid": `text-distance-${service2.id}`, children: [
              service2.distance,
              " km away"
            ] })
          ] })
        ] })
      ] }),
      service2.employee?.name && /* @__PURE__ */ jsxs41("p", { className: "text-sm text-neutral-500 mb-2", children: [
        "With ",
        service2.employee.name
      ] }),
      /* @__PURE__ */ jsxs41("div", { className: "flex items-center justify-between mb-3", children: [
        /* @__PURE__ */ jsx53(ServiceRating, { service: service2 }),
        /* @__PURE__ */ jsxs41("div", { className: "text-right", children: [
          /* @__PURE__ */ jsx53("p", { className: "text-lg font-semibold text-neutral-800", children: formatMoney(service2.price, service2.currency, i18n.resolvedLanguage || i18n.language) ?? t("currency.unavailable") }),
          /* @__PURE__ */ jsx53("p", { className: "text-xs text-neutral-500", children: isGroupService ? "per person" : formatServiceDuration(service2.duration, i18n.resolvedLanguage || i18n.language) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs41("div", { className: "space-y-2", children: [
        isGroupService && /* @__PURE__ */ jsx53("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxs41("div", { className: "flex items-center space-x-2", children: [
          /* @__PURE__ */ jsx53(Users2, { className: "w-4 h-4 text-neutral-400" }),
          /* @__PURE__ */ jsxs41("span", { className: "text-sm text-neutral-600", children: [
            availableSpots,
            " of ",
            service2.maxCapacity,
            " spots available"
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs41("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs41("div", { className: "flex items-center space-x-2", children: [
            /* @__PURE__ */ jsx53(Clock4, { className: "w-4 h-4 text-neutral-400" }),
            /* @__PURE__ */ jsx53("span", { className: "text-sm text-neutral-600", children: "Available today" }),
            /* @__PURE__ */ jsx53(Badge, { variant: service2.instantBooking ? "default" : "outline", className: "text-xs", children: service2.instantBooking ? "Instant Book" : "Requires Approval" })
          ] }),
          /* @__PURE__ */ jsx53(
            Button,
            {
              onClick: (event) => {
                event.currentTarget.focus();
                onBook();
              },
              size: "sm",
              className: "bg-primary hover:bg-primary/90",
              children: service2.instantBooking ? "Book Now" : "Request Booking"
            }
          )
        ] })
      ] })
    ] })
  ] }) }) });
}
var init_service_card = __esm({
  "client/src/components/service-card.tsx"() {
    "use strict";
    init_money();
    init_service_duration();
    init_button();
    init_badge();
    init_card();
    init_service_rating();
    init_provider();
    init_locations();
    init_use_categories();
    init_search_service_card();
    init_wishlist_heart();
  }
});

// client/src/components/ui/separator.tsx
import * as React15 from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { jsx as jsx54 } from "react/jsx-runtime";
var Separator3;
var init_separator = __esm({
  "client/src/components/ui/separator.tsx"() {
    "use strict";
    init_utils();
    Separator3 = React15.forwardRef(
      ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => /* @__PURE__ */ jsx54(
        SeparatorPrimitive.Root,
        {
          ref,
          decorative,
          orientation,
          className: cn(
            "shrink-0 bg-border",
            orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
            className
          ),
          ...props
        }
      )
    );
    Separator3.displayName = SeparatorPrimitive.Root.displayName;
  }
});

// client/src/components/service-image-gallery.tsx
import { useRef as useRef13, useState as useState22 } from "react";
import { useTranslation as useTranslation35 } from "react-i18next";
import { ChevronLeft as ChevronLeft2, ChevronRight as ChevronRight4, ImageOff } from "lucide-react";
import { jsx as jsx55, jsxs as jsxs42 } from "react/jsx-runtime";
function ServiceImageGallery({ service: service2 }) {
  const images = serviceImages(service2);
  return images.length ? /* @__PURE__ */ jsx55(Gallery, { images, name: service2.name }, JSON.stringify(images)) : null;
}
function Gallery({ images, name }) {
  const { t } = useTranslation35();
  const [index, setIndex] = useState22(0);
  const [failed, setFailed] = useState22([]);
  const start = useRef13(null);
  const move = (offset) => setIndex((current) => Math.max(0, Math.min(images.length - 1, current + offset)));
  const pointerDown = (event) => {
    if (!event.isPrimary || event.pointerType === "mouse" && event.button !== 0 || event.target.closest("button")) return;
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerUp = (event) => {
    const first = start.current;
    start.current = null;
    if (!first || first.id !== event.pointerId) return;
    const dx = event.clientX - first.x, dy = event.clientY - first.y;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  };
  return /* @__PURE__ */ jsxs42("section", { "aria-label": t("servicePictures.gallery", { name }), className: "min-w-0 space-y-2", "data-testid": "service-image-gallery", children: [
    /* @__PURE__ */ jsx55(
      "div",
      {
        tabIndex: images.length > 1 ? 0 : void 0,
        role: "group",
        "aria-label": t("servicePictures.position", { current: index + 1, total: images.length }),
        className: "relative overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        style: { touchAction: "pan-y pinch-zoom" },
        onKeyDown: (event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        },
        onPointerDown: pointerDown,
        onPointerUp: pointerUp,
        onPointerCancel: () => {
          start.current = null;
        },
        onLostPointerCapture: () => {
          start.current = null;
        },
        "data-testid": "service-image-swipe",
        children: failed.includes(images[index]) ? /* @__PURE__ */ jsxs42("div", { className: "h-56 sm:h-72 flex flex-col items-center justify-center gap-2 p-4 text-center", role: "status", children: [
          /* @__PURE__ */ jsx55(ImageOff, { "aria-hidden": "true" }),
          /* @__PURE__ */ jsx55("p", { children: t("servicePictures.unavailable") })
        ] }) : /* @__PURE__ */ jsx55(
          "img",
          {
            src: images[index],
            alt: t("servicePictures.alt", { name, current: index + 1, total: images.length }),
            draggable: false,
            className: "w-full h-56 sm:h-72 object-contain",
            onError: () => setFailed((current) => [...current, images[index]]),
            "data-testid": "service-gallery-image"
          },
          images[index]
        )
      }
    ),
    images.length > 1 && /* @__PURE__ */ jsxs42("div", { className: "flex items-center justify-between gap-2", dir: "ltr", children: [
      /* @__PURE__ */ jsx55(Button, { type: "button", variant: "outline", size: "icon", className: "h-11 w-11 shrink-0", disabled: index === 0, onClick: () => move(-1), "aria-label": t("servicePictures.previous"), "data-testid": "service-image-previous", children: /* @__PURE__ */ jsx55(ChevronLeft2, { "aria-hidden": "true", className: "h-5 w-5" }) }),
      /* @__PURE__ */ jsx55("p", { "aria-live": "polite", "aria-atomic": "true", className: "text-sm text-center", "data-testid": "service-image-position", children: t("servicePictures.position", { current: index + 1, total: images.length }) }),
      /* @__PURE__ */ jsx55(Button, { type: "button", variant: "outline", size: "icon", className: "h-11 w-11 shrink-0", disabled: index === images.length - 1, onClick: () => move(1), "aria-label": t("servicePictures.next"), "data-testid": "service-image-next", children: /* @__PURE__ */ jsx55(ChevronRight4, { "aria-hidden": "true", className: "h-5 w-5" }) })
    ] })
  ] });
}
var init_service_image_gallery = __esm({
  "client/src/components/service-image-gallery.tsx"() {
    "use strict";
    init_button();
    init_service_images();
  }
});

// client/src/components/search-service-details.tsx
import { Link as Link12 } from "wouter";
import { useTranslation as useTranslation36 } from "react-i18next";
import { jsx as jsx56, jsxs as jsxs43 } from "react/jsx-runtime";
function SearchServiceDetails({ service: service2, open, onClose, onBook, onViewProvider, wishlistEnabled = true }) {
  const { t, i18n } = useTranslation36();
  const provider = getProviderName(service2.provider);
  return /* @__PURE__ */ jsx56(Dialog, { open, onOpenChange: (value) => {
    if (!value) onClose();
  }, children: /* @__PURE__ */ jsxs43(DialogContent, { className: "search-design search-detail-dialog", closeLabel: t("searchPage.close"), "data-testid": "dialog-service-details", children: [
    /* @__PURE__ */ jsxs43(DialogHeader, { children: [
      /* @__PURE__ */ jsx56(DialogTitle, { "data-testid": "text-service-name", children: /* @__PURE__ */ jsx56("bdi", { children: service2.name }) }),
      /* @__PURE__ */ jsx56(DialogDescription, { children: t("searchPage.checkTimes") })
    ] }),
    /* @__PURE__ */ jsxs43("div", { className: "search-detail-provider", children: [
      service2.storefrontSlug ? /* @__PURE__ */ jsx56(Link12, { href: `/providers/${service2.storefrontSlug}`, onClick: onClose, children: /* @__PURE__ */ jsx56("bdi", { children: provider }) }) : onViewProvider ? /* @__PURE__ */ jsx56("button", { type: "button", onClick: onViewProvider, "data-testid": "button-provider-details", children: /* @__PURE__ */ jsx56("bdi", { children: provider }) }) : /* @__PURE__ */ jsx56("bdi", { children: provider }),
      /* @__PURE__ */ jsx56(ServiceRating, { service: service2 })
    ] }),
    /* @__PURE__ */ jsxs43("div", { className: "relative min-h-16", children: [
      /* @__PURE__ */ jsx56(ServiceImageGallery, { service: service2 }, `${service2.id}:${open}`),
      wishlistEnabled && /* @__PURE__ */ jsx56(WishlistHeart, { serviceId: service2.id })
    ] }),
    service2.description && /* @__PURE__ */ jsxs43("section", { children: [
      /* @__PURE__ */ jsx56("h3", { children: t("searchPage.about") }),
      /* @__PURE__ */ jsx56("p", { "data-testid": "text-description", children: service2.description })
    ] }),
    /* @__PURE__ */ jsxs43("dl", { className: "search-detail-grid", children: [
      /* @__PURE__ */ jsxs43("div", { children: [
        /* @__PURE__ */ jsx56("dt", { children: t("searchPage.price") }),
        /* @__PURE__ */ jsxs43("dd", { children: [
          formatMoney(service2.price, service2.currency, i18n.resolvedLanguage || i18n.language) ?? t("currency.unavailable"),
          " ",
          service2.serviceType === "group" && t("searchPage.perPerson")
        ] })
      ] }),
      /* @__PURE__ */ jsxs43("div", { children: [
        /* @__PURE__ */ jsx56("dt", { children: t("searchPage.duration") }),
        /* @__PURE__ */ jsx56("dd", { "data-testid": "text-duration", children: formatServiceDuration(service2.duration, i18n.resolvedLanguage || i18n.language) })
      ] }),
      /* @__PURE__ */ jsxs43("div", { children: [
        /* @__PURE__ */ jsx56("dt", { children: t("searchPage.sessionType") }),
        /* @__PURE__ */ jsx56("dd", { children: t(service2.serviceType === "group" ? "searchPage.group" : "searchPage.individual") })
      ] }),
      service2.serviceType === "group" && /* @__PURE__ */ jsxs43("div", { children: [
        /* @__PURE__ */ jsx56("dt", { children: t("searchPage.maxGroupCapacity") }),
        /* @__PURE__ */ jsx56("dd", { "data-testid": "text-max-group-capacity", children: new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language).format(service2.maxCapacity ?? 1) })
      ] }),
      /* @__PURE__ */ jsxs43("div", { children: [
        /* @__PURE__ */ jsx56("dt", { children: t("searchPage.bookingType") }),
        /* @__PURE__ */ jsx56("dd", { children: t(service2.instantBooking ? "searchPage.instant" : "searchPage.approval") })
      ] })
    ] }),
    /* @__PURE__ */ jsxs43("section", { children: [
      /* @__PURE__ */ jsx56("h3", { children: t("searchPage.audience") }),
      /* @__PURE__ */ jsx56("p", { children: service2.ageGroups?.length ? service2.ageGroups.map((age) => t(`searchPage.${age}`, { defaultValue: age })).join(", ") : t("searchPage.allAges") }),
      /* @__PURE__ */ jsx56("p", { children: t(service2.targetGender === "males" ? "searchPage.gender_male" : service2.targetGender === "females" ? "searchPage.gender_female" : "searchPage.gender_both") })
    ] }),
    service2.employee?.name && /* @__PURE__ */ jsx56("p", { children: t("searchPage.withEmployee", { name: service2.employee.name }) }),
    !service2.instantBooking && Number(service2.advancePaymentPercent) > 0 && /* @__PURE__ */ jsx56("p", { children: t("searchPage.advancePayment", { percent: service2.advancePaymentPercent }) }),
    service2.address && /* @__PURE__ */ jsxs43("section", { children: [
      /* @__PURE__ */ jsx56("h3", { children: t("searchPage.where") }),
      /* @__PURE__ */ jsx56("p", { children: /* @__PURE__ */ jsx56("bdi", { children: service2.address }) })
    ] }),
    /* @__PURE__ */ jsxs43("div", { className: "search-detail-actions", children: [
      /* @__PURE__ */ jsx56(Button, { onClick: onBook, "data-testid": "button-book-from-details", children: t("searchPage.chooseTime") }),
      /* @__PURE__ */ jsx56(Button, { variant: "outline", onClick: onClose, "data-testid": "button-close-details", children: t("searchPage.close") })
    ] })
  ] }) });
}
var init_search_service_details = __esm({
  "client/src/components/search-service-details.tsx"() {
    "use strict";
    init_button();
    init_dialog();
    init_service_rating();
    init_money();
    init_provider();
    init_wishlist_heart();
    init_service_duration();
    init_service_image_gallery();
  }
});

// client/src/components/service-detail-modal.tsx
import { Clock as Clock5, Users as Users3, MapPin as MapPin2, Coins, Calendar as Calendar2, CheckCircle } from "lucide-react";
import { useTranslation as useTranslation37 } from "react-i18next";
import { Link as Link13 } from "wouter";
import { jsx as jsx57, jsxs as jsxs44 } from "react/jsx-runtime";
function ServiceDetailModal({ service: service2, open, onClose, onBook, onViewProvider, searchLayout, wishlistEnabled = true }) {
  const { t, i18n } = useTranslation37();
  const categories = useCategories();
  if (!service2) return null;
  service2 = currentLocation(service2);
  if (searchLayout) return /* @__PURE__ */ jsx57(SearchServiceDetails, { service: service2, open, onClose, onBook, onViewProvider, wishlistEnabled });
  const isGroupService = service2.serviceType === "group";
  const availableSpots = isGroupService ? (service2.maxCapacity || 1) - (service2.availableCapacity || 0) : 1;
  const getCategoryLabel = (key) => categories.data?.find((category) => category.key === key)?.name ?? key;
  const getAgeGroupLabel = (ageGroup) => {
    switch (ageGroup) {
      case "children":
        return "Children (0-12)";
      case "teens":
        return "Teens (13-17)";
      case "adults":
        return "Adults (18-64)";
      case "seniors":
        return "Seniors (65+)";
      default:
        return ageGroup;
    }
  };
  const getGenderLabel = (gender) => {
    switch (gender) {
      case "male":
        return "Male Only";
      case "female":
        return "Female Only";
      case "both":
        return "All Genders";
      default:
        return gender;
    }
  };
  return /* @__PURE__ */ jsx57(Dialog, { open, onOpenChange: (isOpen) => !isOpen && onClose(), children: /* @__PURE__ */ jsxs44(DialogContent, { className: "max-w-2xl max-h-[90vh] overflow-y-auto", "data-testid": "dialog-service-details", children: [
    /* @__PURE__ */ jsx57(DialogHeader, { children: /* @__PURE__ */ jsxs44("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx57(DialogTitle, { className: "text-2xl font-bold text-neutral-800", "data-testid": "text-service-name", children: service2.name }),
      /* @__PURE__ */ jsx57(Badge, { variant: isGroupService ? "secondary" : "default", children: isGroupService ? "Group" : "One-to-One" })
    ] }) }),
    /* @__PURE__ */ jsxs44("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs44("div", { className: "relative min-h-16", children: [
        /* @__PURE__ */ jsx57(ServiceImageGallery, { service: service2 }, `${service2.id}:${open}`),
        wishlistEnabled && /* @__PURE__ */ jsx57(WishlistHeart, { serviceId: service2.id })
      ] }),
      /* @__PURE__ */ jsxs44("div", { className: "flex items-center space-x-3", children: [
        /* @__PURE__ */ jsx57("div", { className: "w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center", children: /* @__PURE__ */ jsx57("span", { className: "text-xl font-semibold", children: getProviderName(service2.provider).split(/\s+/).slice(0, 2).map((word) => word[0]).join("") }) }),
        /* @__PURE__ */ jsxs44("div", { children: [
          service2.storefrontSlug ? /* @__PURE__ */ jsx57(Link13, { href: `/providers/${service2.storefrontSlug}`, className: "font-semibold text-primary underline underline-offset-2", onClick: onClose, children: getProviderName(service2.provider) }) : onViewProvider ? /* @__PURE__ */ jsx57(
            "button",
            {
              type: "button",
              onClick: onViewProvider,
              "data-testid": "button-provider-details",
              "aria-label": t("catalog.view", { name: getProviderName(service2.provider) }),
              className: "font-semibold text-primary text-left underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              children: getProviderName(service2.provider)
            }
          ) : /* @__PURE__ */ jsx57("p", { className: "font-semibold text-neutral-800", "data-testid": "text-provider-name", children: getProviderName(service2.provider) }),
          service2.employee?.name && /* @__PURE__ */ jsxs44("p", { className: "text-sm text-neutral-600", children: [
            "With ",
            service2.employee.name
          ] }),
          /* @__PURE__ */ jsx57(ServiceRating, { service: service2 })
        ] })
      ] }),
      /* @__PURE__ */ jsx57(Separator3, {}),
      service2.description && /* @__PURE__ */ jsxs44("div", { children: [
        /* @__PURE__ */ jsx57("h3", { className: "font-semibold text-neutral-800 mb-2", children: "About this service" }),
        /* @__PURE__ */ jsx57("p", { className: "text-neutral-600 leading-relaxed", "data-testid": "text-description", children: service2.description })
      ] }),
      /* @__PURE__ */ jsx57(Separator3, {}),
      /* @__PURE__ */ jsxs44("div", { className: "grid grid-cols-2 gap-4", children: [
        /* @__PURE__ */ jsxs44("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxs44("div", { className: "flex items-center space-x-2 text-neutral-500", children: [
            /* @__PURE__ */ jsx57(Coins, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx57("span", { className: "text-sm font-medium", children: "Price" })
          ] }),
          /* @__PURE__ */ jsxs44("p", { className: "text-lg font-semibold text-neutral-800", "data-testid": "text-price", children: [
            formatMoney(service2.price, service2.currency, i18n.resolvedLanguage || i18n.language) ?? t("currency.unavailable"),
            isGroupService ? " per person" : ""
          ] })
        ] }),
        /* @__PURE__ */ jsxs44("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxs44("div", { className: "flex items-center space-x-2 text-neutral-500", children: [
            /* @__PURE__ */ jsx57(Clock5, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx57("span", { className: "text-sm font-medium", children: "Duration" })
          ] }),
          /* @__PURE__ */ jsx57("p", { className: "text-lg font-semibold text-neutral-800", "data-testid": "text-duration", children: formatServiceDuration(service2.duration, i18n.resolvedLanguage || i18n.language) })
        ] }),
        isGroupService && /* @__PURE__ */ jsxs44("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxs44("div", { className: "flex items-center space-x-2 text-neutral-500", children: [
            /* @__PURE__ */ jsx57(Users3, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx57("span", { className: "text-sm font-medium", children: "Group Size" })
          ] }),
          /* @__PURE__ */ jsxs44("p", { className: "text-lg font-semibold text-neutral-800", "data-testid": "text-capacity", children: [
            availableSpots,
            " of ",
            service2.maxCapacity,
            " spots available"
          ] })
        ] }),
        service2.distance !== void 0 && /* @__PURE__ */ jsxs44("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxs44("div", { className: "flex items-center space-x-2 text-neutral-500", children: [
            /* @__PURE__ */ jsx57(MapPin2, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx57("span", { className: "text-sm font-medium", children: "Distance" })
          ] }),
          /* @__PURE__ */ jsxs44("p", { className: "text-lg font-semibold text-neutral-800", "data-testid": "text-distance", children: [
            service2.distance,
            " km away"
          ] })
        ] }),
        /* @__PURE__ */ jsxs44("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxs44("div", { className: "flex items-center space-x-2 text-neutral-500", children: [
            /* @__PURE__ */ jsx57(Calendar2, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx57("span", { className: "text-sm font-medium", children: "Category" })
          ] }),
          /* @__PURE__ */ jsx57("p", { className: "text-lg font-semibold text-neutral-800", "data-testid": "text-category", children: getCategoryLabel(service2.category) })
        ] }),
        /* @__PURE__ */ jsxs44("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxs44("div", { className: "flex items-center space-x-2 text-neutral-500", children: [
            /* @__PURE__ */ jsx57(CheckCircle, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx57("span", { className: "text-sm font-medium", children: "Booking Type" })
          ] }),
          /* @__PURE__ */ jsx57(Badge, { variant: service2.instantBooking ? "default" : "outline", "data-testid": "badge-booking-type", children: service2.instantBooking ? "Instant Book" : "Requires Approval" })
        ] })
      ] }),
      /* @__PURE__ */ jsx57(Separator3, {}),
      /* @__PURE__ */ jsxs44("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx57("h3", { className: "font-semibold text-neutral-800", children: "Additional Information" }),
        /* @__PURE__ */ jsxs44("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxs44("div", { children: [
            /* @__PURE__ */ jsx57("p", { className: "text-sm text-neutral-500 mb-1", children: "Age Groups" }),
            /* @__PURE__ */ jsx57("div", { className: "flex flex-wrap gap-1", children: service2.ageGroups && service2.ageGroups.length > 0 ? service2.ageGroups.map((ageGroup) => /* @__PURE__ */ jsx57(Badge, { variant: "outline", className: "text-xs", children: getAgeGroupLabel(ageGroup) }, ageGroup)) : /* @__PURE__ */ jsx57("span", { className: "text-sm text-neutral-400", children: "All ages welcome" }) })
          ] }),
          /* @__PURE__ */ jsxs44("div", { children: [
            /* @__PURE__ */ jsx57("p", { className: "text-sm text-neutral-500 mb-1", children: "Target Audience" }),
            /* @__PURE__ */ jsx57(Badge, { variant: "outline", className: "text-xs", children: getGenderLabel(service2.targetGender || "both") })
          ] })
        ] }),
        !service2.instantBooking && /* @__PURE__ */ jsx57("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-3", children: /* @__PURE__ */ jsxs44("p", { className: "text-sm text-blue-800", children: [
          /* @__PURE__ */ jsx57("strong", { children: "Advance Payment:" }),
          " ",
          service2.advancePaymentPercent,
          "% required upfront"
        ] }) }),
        service2.address && /* @__PURE__ */ jsxs44("div", { children: [
          /* @__PURE__ */ jsx57("p", { className: "text-sm text-neutral-500 mb-1", children: "Location" }),
          /* @__PURE__ */ jsxs44("div", { className: "flex items-start space-x-2", children: [
            /* @__PURE__ */ jsx57(MapPin2, { className: "w-4 h-4 text-neutral-400 mt-0.5" }),
            /* @__PURE__ */ jsx57("p", { className: "text-sm text-neutral-700", "data-testid": "text-address", children: service2.address })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx57(Separator3, {}),
      /* @__PURE__ */ jsxs44("div", { className: "flex space-x-3", children: [
        /* @__PURE__ */ jsx57(
          Button,
          {
            onClick: onBook,
            className: "flex-1 bg-primary hover:bg-primary/90",
            "data-testid": "button-book-from-details",
            children: service2.instantBooking ? "Book Now" : "Request Booking"
          }
        ),
        /* @__PURE__ */ jsx57(
          Button,
          {
            onClick: onClose,
            variant: "outline",
            className: "flex-1",
            "data-testid": "button-close-details",
            children: "Close"
          }
        )
      ] })
    ] })
  ] }) });
}
var init_service_detail_modal = __esm({
  "client/src/components/service-detail-modal.tsx"() {
    "use strict";
    init_money();
    init_service_duration();
    init_button();
    init_badge();
    init_dialog();
    init_separator();
    init_service_rating();
    init_provider();
    init_locations();
    init_use_categories();
    init_search_service_details();
    init_wishlist_heart();
    init_service_image_gallery();
  }
});

// client/src/components/booking-modal.tsx
import { useEffect as useEffect17, useRef as useRef14, useState as useState23 } from "react";
import { Link as Link14 } from "wouter";
import { useTranslation as useTranslation38 } from "react-i18next";
import { useMutation as useMutation10, useQueryClient as useQueryClient12 } from "@tanstack/react-query";
import { Clock as Clock6, MapPin as MapPin3 } from "lucide-react";
import { Fragment as Fragment14, jsx as jsx58, jsxs as jsxs45 } from "react/jsx-runtime";
function BookingSignInActions({ isLoading, onClose, returnTo = "/search" }) {
  const { t } = useTranslation38();
  return /* @__PURE__ */ jsxs45("div", { className: "space-y-4", children: [
    isLoading ? /* @__PURE__ */ jsx58("p", { role: "status", children: t("guestSearch.checkingAccount") }) : /* @__PURE__ */ jsxs45(Fragment14, { children: [
      /* @__PURE__ */ jsx58("p", { children: t("guestSearch.bookingNote") }),
      /* @__PURE__ */ jsx58(Button, { asChild: true, className: actionClass2, children: /* @__PURE__ */ jsx58(Link14, { href: `/login?returnTo=${encodeURIComponent(returnTo)}`, children: t("guestSearch.signInOrCreate") }) })
    ] }),
    /* @__PURE__ */ jsx58(Button, { variant: "outline", className: actionClass2, onClick: onClose, children: t("guestSearch.continueBrowsing") })
  ] });
}
function BookingModal({ service: service2, onClose, returnTo = "/search" }) {
  const { user: user2, isAuthenticated, isLoading } = useAuth();
  const { t, i18n } = useFormLocale();
  const trigger = useRef14(typeof document !== "undefined" ? document.activeElement : null);
  const restoreFocus = () => {
    if (trigger.current?.isConnected) trigger.current.focus();
  };
  if (isAuthenticated && user2) return /* @__PURE__ */ jsx58(AuthenticatedBooking, { userId: user2.id, service: service2, onClose, returnTo, restoreFocus }, `${user2.id}-${service2.id}`);
  return /* @__PURE__ */ jsx58(Dialog, { open: true, onOpenChange: (open) => {
    if (!open) onClose();
  }, children: /* @__PURE__ */ jsxs45(DialogContent, { dir: i18n.dir(), closeLabel: t("common.close"), className: "phase2-form max-w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg", "data-testid": "dialog-booking-sign-in", onCloseAutoFocus: (event) => {
    event.preventDefault();
    restoreFocus();
  }, children: [
    /* @__PURE__ */ jsxs45(DialogHeader, { className: "text-start sm:text-start", children: [
      /* @__PURE__ */ jsx58(DialogTitle, { children: t("guestSearch.signInToBook") }),
      /* @__PURE__ */ jsx58(DialogDescription, { children: /* @__PURE__ */ jsx58("bdi", { children: service2.name }) })
    ] }),
    /* @__PURE__ */ jsx58(BookingSignInActions, { isLoading, onClose, returnTo })
  ] }) });
}
function AuthenticatedBooking({ userId, service: service2, onClose, returnTo, restoreFocus }) {
  service2 = currentLocation(service2);
  const { t, i18n, language } = useFormLocale();
  const { toast: toast2 } = useToast();
  const queryClient3 = useQueryClient12();
  const [selectedSlot, setSelectedSlot] = useState23(null);
  const [reviewing, setReviewing] = useState23(false);
  const [participantCount, setParticipantCount] = useState23(1);
  const [quote, setQuote] = useState23({ price: service2.price, currency: service2.currency, advancePaymentPercent: service2.advancePaymentPercent ?? 0 });
  const [participantTouched, setParticipantTouched] = useState23(false);
  const [initialMessage, setInitialMessage] = useState23("");
  const [error, setError] = useState23("");
  const [succeeded, setSucceeded] = useState23(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState23(false);
  const [duplicateWarning, setDuplicateWarning] = useState23(false);
  const heading = useRef14(null);
  const content = useRef14(null);
  const participants = useRef14(null);
  const submitting = useRef14(false);
  const submitButton = useRef14(null);
  const duplicateCheck = useRef14(null);
  useEffect17(() => () => duplicateCheck.current?.abort(), []);
  const serviceMaximum = service2.serviceType === "group" ? service2.maxCapacity ?? 1 : 1;
  const maximum = service2.serviceType === "group" ? Math.min(serviceMaximum, selectedSlot?.availableCapacity ?? serviceMaximum) : 1;
  const participantValid = Number.isInteger(participantCount) && participantCount >= 1 && participantCount <= maximum;
  const totals = (() => {
    try {
      return calculateBookingAmounts(quote.price, quote.currency, participantValid ? participantCount : 1, quote.advancePaymentPercent);
    } catch {
      return null;
    }
  })();
  const amount2 = (value) => formatMoney(value, quote.currency, language) ?? t("currency.unavailable");
  const appointmentDate = selectedSlot ? new Intl.DateTimeFormat(language, { timeZone: selectedSlot.timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(selectedSlot.startsAt)) : "";
  useEffect17(() => {
    content.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
    if (heading.current && content.current && heading.current.getBoundingClientRect().bottom > content.current.getBoundingClientRect().bottom) heading.current.scrollIntoView({ block: "nearest" });
  }, [reviewing, succeeded]);
  const booking = useMutation10({
    retry: false,
    mutationFn: async () => {
      if (!selectedSlot) throw new Error("No selected appointment");
      return (await apiRequest("POST", "/api/bookings", {
        serviceId: service2.id,
        scheduledDate: selectedSlot.startsAt,
        participantCount,
        expectedPrice: quote.price,
        expectedCurrency: quote.currency,
        expectedAdvancePaymentPercent: quote.advancePaymentPercent,
        initialMessage: initialMessage.trim() || null
      })).json();
    },
    onSuccess: () => {
      queryClient3.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
      queryClient3.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      queryClient3.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/availability/") });
      toast2({ title: t(service2.instantBooking ? "bookingForm.confirmed" : "bookingForm.requestSent"), description: t("bookingForm.successHelp") });
      setInitialMessage("");
      setSucceeded(true);
    },
    onError: (error2) => {
      if (isUnauthorizedError(error2)) {
        window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (error2.message.startsWith("409:")) {
        try {
          const detail = JSON.parse(error2.message.slice(4));
          if (detail.code === "PRICE_CHANGED" && typeof detail.currentPrice === "string" && isSupportedCurrency(detail.currentCurrency) && Number.isInteger(detail.currentAdvancePaymentPercent) && detail.currentAdvancePaymentPercent >= 0 && detail.currentAdvancePaymentPercent <= 100) {
            setQuote({ price: normalizeMoneyAmount(detail.currentPrice, detail.currentCurrency), currency: detail.currentCurrency, advancePaymentPercent: detail.currentAdvancePaymentPercent });
            setError("currency.priceChanged");
            setReviewing(false);
            setDuplicateWarning(false);
            queryClient3.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/services/") });
            queueMicrotask(() => heading.current?.focus());
            return;
          }
        } catch {
        }
      }
      setError(error2.message.startsWith("409:") ? "bookingForm.conflict" : error2.message.startsWith("403:") ? "bookingForm.denied" : "bookingForm.saveError");
      if (error2.message.startsWith("409:")) {
        setSelectedSlot(null);
        setReviewing(false);
        queryClient3.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/availability/") });
      }
    },
    onSettled: () => {
      submitting.current = false;
    }
  });
  const submit = async (duplicateApproved = false) => {
    if (submitting.current || succeeded) return;
    setError("");
    setParticipantTouched(true);
    if (!totals) {
      setError("currency.unavailable");
      return;
    }
    if (!participantValid) {
      participants.current?.focus();
      return;
    }
    if (!selectedSlot) {
      setError("bookingForm.chooseTimeFirst");
      setReviewing(false);
      return;
    }
    submitting.current = true;
    if (service2.serviceType === "group" && !duplicateApproved) {
      const controller = new AbortController();
      duplicateCheck.current = controller;
      setCheckingDuplicates(true);
      try {
        const response = await fetch("/api/bookings/seeker", { credentials: "include", signal: controller.signal });
        if (!response.ok) throw new Error(`${response.status}: Booking check failed`);
        const existing = await response.json();
        if (!Array.isArray(existing)) throw new Error("Invalid booking response");
        if (controller.signal.aborted) return;
        if (existing.some((item) => item.seekerId === userId && item.serviceId === service2.id && ["pending", "confirmed", "completed"].includes(item.status ?? "") && new Date(item.scheduledDate).getTime() === new Date(selectedSlot.startsAt).getTime())) {
          setDuplicateWarning(true);
          submitting.current = false;
          return;
        }
      } catch (error2) {
        if (controller.signal.aborted) return;
        if (isUnauthorizedError(error2)) window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        else setError("bookingForm.duplicateCheckError");
        submitting.current = false;
        return;
      } finally {
        if (!controller.signal.aborted) setCheckingDuplicates(false);
      }
    }
    booking.mutate();
  };
  const busy = booking.isPending || checkingDuplicates;
  return /* @__PURE__ */ jsx58(Dialog, { open: true, onOpenChange: (open) => {
    if (!open && !busy) onClose();
  }, children: /* @__PURE__ */ jsxs45(
    DialogContent,
    {
      ref: content,
      dir: i18n.dir(),
      closeLabel: t("common.close"),
      closeDisabled: busy,
      className: "phase2-form max-w-[calc(100%-2rem)] md:max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 rounded-xl",
      onOpenAutoFocus: (event) => {
        event.preventDefault();
        heading.current?.focus();
      },
      onCloseAutoFocus: (event) => {
        event.preventDefault();
        restoreFocus();
      },
      onEscapeKeyDown: (event) => {
        if (busy) event.preventDefault();
      },
      onInteractOutside: (event) => {
        if (busy) event.preventDefault();
      },
      children: [
        /* @__PURE__ */ jsxs45("div", { className: "grid md:grid-cols-[220px_minmax(0,1fr)] min-w-0", children: [
          /* @__PURE__ */ jsxs45("aside", { className: "p-4 pe-12 md:p-6 md:border-e bg-muted rounded-t-xl md:rounded-ss-xl md:rounded-es-xl md:rounded-se-none space-y-3 min-w-0", children: [
            /* @__PURE__ */ jsxs45(DialogHeader, { className: "text-start sm:text-start", children: [
              /* @__PURE__ */ jsx58(DialogDescription, { children: /* @__PURE__ */ jsx58("bdi", { children: getProviderName(service2.provider) }) }),
              /* @__PURE__ */ jsx58(DialogTitle, { className: "text-xl break-words", children: /* @__PURE__ */ jsx58("bdi", { children: service2.name }) })
            ] }),
            service2.employee?.name && /* @__PURE__ */ jsx58("p", { className: "text-sm text-muted-foreground", children: /* @__PURE__ */ jsx58("bdi", { children: service2.employee.name }) }),
            /* @__PURE__ */ jsxs45("p", { className: "hidden md:flex items-center gap-2 text-sm", children: [
              /* @__PURE__ */ jsx58(Clock6, { className: "w-4 h-4 shrink-0", "aria-hidden": "true" }),
              formatServiceDuration(service2.duration, language)
            ] }),
            service2.address && /* @__PURE__ */ jsxs45("p", { className: "hidden md:flex items-start gap-2 text-sm", children: [
              /* @__PURE__ */ jsx58(MapPin3, { className: "w-4 h-4 shrink-0 mt-0.5", "aria-hidden": "true" }),
              /* @__PURE__ */ jsx58("bdi", { children: service2.address })
            ] }),
            /* @__PURE__ */ jsx58("p", { className: "font-semibold", children: /* @__PURE__ */ jsx58("bdi", { children: service2.serviceType === "group" ? t("bookingForm.perParticipant", { amount: amount2(quote.price) }) : amount2(quote.price) }) }),
            /* @__PURE__ */ jsx58("p", { className: "text-sm text-muted-foreground", children: t(service2.instantBooking ? "bookingForm.instantHelp" : "bookingForm.requestHelp") })
          ] }),
          /* @__PURE__ */ jsxs45("div", { className: "p-4 sm:p-6 space-y-5 min-w-0", children: [
            /* @__PURE__ */ jsx58("h2", { ref: heading, tabIndex: -1, className: "text-lg font-semibold focus:outline-none", children: t(succeeded ? service2.instantBooking ? "bookingForm.confirmed" : "bookingForm.requestSent" : reviewing ? "bookingForm.reviewStep" : "bookingForm.chooseStep") }),
            succeeded ? /* @__PURE__ */ jsxs45("div", { className: "space-y-4", children: [
              /* @__PURE__ */ jsx58("p", { role: "status", children: t("bookingForm.successHelp") }),
              /* @__PURE__ */ jsxs45("div", { className: "rounded-lg border bg-muted p-4 space-y-2", children: [
                /* @__PURE__ */ jsx58("p", { className: "font-medium", children: /* @__PURE__ */ jsx58("bdi", { children: service2.name }) }),
                /* @__PURE__ */ jsx58("p", { children: /* @__PURE__ */ jsx58("bdi", { children: getProviderName(service2.provider) }) }),
                /* @__PURE__ */ jsx58("p", { children: appointmentDate }),
                /* @__PURE__ */ jsxs45("p", { children: [
                  /* @__PURE__ */ jsxs45("bdi", { children: [
                    selectedSlot?.startTime,
                    "\u2013",
                    selectedSlot?.endTime
                  ] }),
                  " \xB7 ",
                  /* @__PURE__ */ jsx58("bdi", { children: selectedSlot?.timezone })
                ] })
              ] }),
              /* @__PURE__ */ jsxs45("div", { className: "grid sm:grid-cols-2 gap-3", children: [
                /* @__PURE__ */ jsx58(Button, { asChild: true, className: actionClass2, children: /* @__PURE__ */ jsx58(Link14, { href: "/my-bookings", onClick: onClose, children: t("bookingForm.viewBookings") }) }),
                /* @__PURE__ */ jsx58(Button, { variant: "outline", className: actionClass2, onClick: onClose, children: t("common.close") })
              ] })
            ] }) : /* @__PURE__ */ jsxs45(Fragment14, { children: [
              !reviewing ? /* @__PURE__ */ jsx58(BookingTimePicker, { serviceId: service2.id, selected: selectedSlot, onSelect: setSelectedSlot }) : selectedSlot && /* @__PURE__ */ jsxs45(Fragment14, { children: [
                /* @__PURE__ */ jsxs45("div", { className: "rounded-lg bg-muted border p-4 text-sm space-y-2", children: [
                  /* @__PURE__ */ jsx58("p", { className: "font-medium", children: /* @__PURE__ */ jsx58("bdi", { children: service2.name }) }),
                  /* @__PURE__ */ jsx58("p", { children: /* @__PURE__ */ jsx58("bdi", { children: getProviderName(service2.provider) }) }),
                  /* @__PURE__ */ jsx58("p", { children: appointmentDate }),
                  /* @__PURE__ */ jsxs45("p", { children: [
                    /* @__PURE__ */ jsxs45("bdi", { children: [
                      selectedSlot.startTime,
                      "\u2013",
                      selectedSlot.endTime
                    ] }),
                    " \xB7 ",
                    /* @__PURE__ */ jsx58("bdi", { children: selectedSlot.timezone })
                  ] }),
                  service2.address && /* @__PURE__ */ jsx58("p", { children: /* @__PURE__ */ jsx58("bdi", { children: service2.address }) }),
                  /* @__PURE__ */ jsx58(Button, { variant: "outline", type: "button", className: actionClass2, disabled: busy, onClick: () => setReviewing(false), children: t("bookingForm.changeTime") })
                ] }),
                service2.serviceType === "group" && /* @__PURE__ */ jsxs45("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsx58(Label, { htmlFor: "booking-participants", children: t("booking.participants") }),
                  /* @__PURE__ */ jsx58(
                    Input,
                    {
                      ref: participants,
                      id: "booking-participants",
                      className: "min-h-11",
                      type: "number",
                      min: 1,
                      max: maximum,
                      step: 1,
                      disabled: busy,
                      value: Number.isNaN(participantCount) ? "" : participantCount,
                      onBlur: () => setParticipantTouched(true),
                      "aria-invalid": participantTouched && !participantValid || void 0,
                      "aria-describedby": participantTouched && !participantValid ? "booking-participants-help booking-participants-error" : "booking-participants-help",
                      onChange: (event) => setParticipantCount(event.target.value === "" ? NaN : Number(event.target.value))
                    }
                  ),
                  /* @__PURE__ */ jsx58("p", { id: "booking-participants-help", className: "text-sm text-muted-foreground", children: t("bookingForm.participantHelp", { maximum: new Intl.NumberFormat(language).format(maximum) }) }),
                  participantTouched && !participantValid && /* @__PURE__ */ jsx58("p", { id: "booking-participants-error", role: "alert", className: "text-sm text-red-700 dark:text-red-300", children: t("bookingForm.participantError", { maximum: new Intl.NumberFormat(language).format(maximum) }) })
                ] }),
                /* @__PURE__ */ jsxs45("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsx58(Label, { htmlFor: "booking-initial-message", children: t("bookingForm.initialMessage") }),
                  /* @__PURE__ */ jsx58(Textarea, { id: "booking-initial-message", "aria-describedby": "booking-initial-message-help", dir: "auto", maxLength: 4e3, disabled: busy, value: initialMessage, onChange: (event) => setInitialMessage(event.target.value) }),
                  /* @__PURE__ */ jsx58("p", { id: "booking-initial-message-help", className: "text-sm text-muted-foreground", children: t("bookingForm.initialMessageHelp") }),
                  /* @__PURE__ */ jsx58(BookingMessagePrivacy, {})
                ] }),
                /* @__PURE__ */ jsxs45("dl", { className: "flex flex-wrap justify-between gap-3 font-medium", children: [
                  /* @__PURE__ */ jsx58("dt", { children: t("bookingForm.total") }),
                  /* @__PURE__ */ jsx58("dd", { children: /* @__PURE__ */ jsx58("bdi", { children: participantValid && totals ? amount2(totals.totalAmount) : totals ? "\u2014" : t("currency.unavailable") }) })
                ] }),
                participantValid && totals && Number(totals.advanceAmount) > 0 && /* @__PURE__ */ jsx58("p", { className: "text-sm text-muted-foreground", children: t("bookingForm.advanceNotice", { amount: amount2(totals.advanceAmount) }) }),
                participantValid && totals && /* @__PURE__ */ jsxs45("dl", { className: "flex flex-wrap justify-between gap-3 text-sm", children: [
                  /* @__PURE__ */ jsx58("dt", { children: t("currency.balance") }),
                  /* @__PURE__ */ jsx58("dd", { children: /* @__PURE__ */ jsx58("bdi", { children: amount2(totals.balanceAmount) }) })
                ] })
              ] }),
              error && /* @__PURE__ */ jsx58("p", { role: "alert", className: "text-sm text-red-700 dark:text-red-300", children: t(error) }),
              /* @__PURE__ */ jsx58("p", { role: "status", "aria-live": "polite", className: "text-sm", children: checkingDuplicates ? t("bookingForm.checkingDuplicates") : booking.isPending ? t(service2.instantBooking ? "bookingForm.confirming" : "bookingForm.requesting") : "" }),
              /* @__PURE__ */ jsxs45("div", { className: "grid sm:grid-cols-2 gap-3 border-t pt-4", children: [
                /* @__PURE__ */ jsx58(Button, { variant: "outline", className: actionClass2, disabled: busy, onClick: () => reviewing ? setReviewing(false) : onClose(), children: t(reviewing ? "common.back" : "common.cancel") }),
                !reviewing ? /* @__PURE__ */ jsx58(Button, { className: actionClass2, disabled: !selectedSlot || !totals, onClick: () => {
                  setError("");
                  setReviewing(true);
                }, children: t("bookingForm.continue") }) : /* @__PURE__ */ jsx58(Button, { ref: submitButton, className: actionClass2, disabled: busy || !selectedSlot || !totals, onClick: () => void submit(), children: t(service2.instantBooking ? "booking.confirmBooking" : "bookingForm.requestBooking") })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx58(AlertDialog, { open: duplicateWarning, onOpenChange: setDuplicateWarning, children: /* @__PURE__ */ jsxs45(
          AlertDialogContent,
          {
            dir: i18n.dir(),
            className: "phase2-form max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto",
            onCloseAutoFocus: (event) => {
              event.preventDefault();
              submitButton.current?.focus();
            },
            children: [
              /* @__PURE__ */ jsxs45(AlertDialogHeader, { className: "text-start sm:text-start", children: [
                /* @__PURE__ */ jsx58(AlertDialogTitle, { children: t("bookingForm.duplicateTitle") }),
                /* @__PURE__ */ jsx58(AlertDialogDescription, { children: t("bookingForm.duplicateDescription") })
              ] }),
              /* @__PURE__ */ jsxs45("div", { className: "text-sm space-y-2", children: [
                /* @__PURE__ */ jsx58("p", { children: /* @__PURE__ */ jsx58("bdi", { children: service2.name }) }),
                /* @__PURE__ */ jsx58("p", { children: appointmentDate }),
                /* @__PURE__ */ jsxs45("p", { children: [
                  /* @__PURE__ */ jsxs45("bdi", { children: [
                    selectedSlot?.startTime,
                    "\u2013",
                    selectedSlot?.endTime
                  ] }),
                  " \xB7 ",
                  /* @__PURE__ */ jsx58("bdi", { children: selectedSlot?.timezone })
                ] })
              ] }),
              /* @__PURE__ */ jsxs45(AlertDialogFooter, { className: "gap-2 sm:space-x-0", children: [
                /* @__PURE__ */ jsx58(AlertDialogCancel, { className: actionClass2, "data-testid": "button-cancel-duplicate-booking", children: t("common.cancel") }),
                /* @__PURE__ */ jsx58(AlertDialogAction, { className: actionClass2, "data-testid": "button-confirm-duplicate-booking", onClick: () => void submit(true), children: t("bookingForm.duplicateContinue") })
              ] })
            ]
          }
        ) })
      ]
    }
  ) });
}
var actionClass2;
var init_booking_modal = __esm({
  "client/src/components/booking-modal.tsx"() {
    "use strict";
    init_useAuth();
    init_provider();
    init_locations();
    init_queryClient();
    init_authUtils();
    init_use_toast();
    init_booking_time_picker();
    init_booking_message_privacy();
    init_forms_locale();
    init_money2();
    init_currencies();
    init_money();
    init_service_duration();
    init_button();
    init_input();
    init_label();
    init_textarea();
    init_dialog();
    init_alert_dialog();
    actionClass2 = "min-h-11 h-auto whitespace-normal py-3";
  }
});

// client/src/pages/storefront.tsx
import { useEffect as useEffect18, useMemo as useMemo3, useState as useState24 } from "react";
import { Link as Link15, useParams } from "wouter";
import { useQuery as useQuery17 } from "@tanstack/react-query";
import { useTranslation as useTranslation39 } from "react-i18next";
import { jsx as jsx59, jsxs as jsxs46 } from "react/jsx-runtime";
function StorefrontView({ page, preview = false }) {
  const { t } = useTranslation39();
  const categories = useCategories();
  const [search, setSearch] = useState24("");
  const [category, setCategory] = useState24("");
  const [sort, setSort] = useState24("name");
  const priceSortAvailable = canSortServicePrices(page.services);
  useEffect18(() => {
    if (!priceSortAvailable && sort === "price") setSort("name");
  }, [priceSortAvailable, sort]);
  const [detail, setDetail] = useState24(null);
  const showDetails = (service2) => {
    setDetail(service2);
    if (!preview && Number.isInteger(service2.id) && service2.id > 0 && service2.id <= 2147483647) {
      void apiRequest("POST", `/api/services/${service2.id}/view`).catch(() => {
      });
    }
  };
  const [booking, setBooking] = useState24(() => {
    const id = preview || typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("book");
    return page.services.find((service2) => String(service2.id) === id) ?? null;
  });
  const services = useMemo3(() => page.services.filter((service2) => (!category || service2.category === category) && `${service2.name} ${service2.description ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => sort === "price" && priceSortAvailable ? Number(a.price) - Number(b.price) || a.id - b.id : sort === "duration" ? a.duration - b.duration || a.id - b.id : a.name.localeCompare(b.name) || a.id - b.id), [page.services, search, category, sort, priceSortAvailable]);
  const availableCategories = Array.from(new Set(page.services.map((service2) => service2.category)));
  return /* @__PURE__ */ jsxs46("div", { className: "search-design space-y-6", children: [
    /* @__PURE__ */ jsxs46("section", { className: "overflow-hidden rounded-2xl border bg-white shadow-sm", children: [
      /* @__PURE__ */ jsx59("div", { className: "h-40 sm:h-56 bg-gradient-to-r from-primary/20 via-primary/5 to-secondary/20", children: page.coverUrl && /* @__PURE__ */ jsx59("img", { src: page.coverUrl, alt: "", className: "h-full w-full object-cover" }) }),
      /* @__PURE__ */ jsxs46("div", { className: "p-5 sm:p-8 space-y-4", children: [
        /* @__PURE__ */ jsxs46("div", { className: "flex items-center gap-4", children: [
          page.logoUrl && /* @__PURE__ */ jsx59("img", { src: page.logoUrl, alt: t("storefront.logoAlt", { name: page.name }), className: "h-20 w-20 rounded-xl border bg-white object-cover shrink-0" }),
          /* @__PURE__ */ jsxs46("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx59("p", { className: "text-sm text-primary font-medium", children: t("storefront.providerPage") }),
            /* @__PURE__ */ jsx59("h1", { className: "text-2xl sm:text-3xl font-semibold break-words", children: page.name })
          ] })
        ] }),
        page.description && /* @__PURE__ */ jsx59("p", { className: "whitespace-pre-wrap break-words text-neutral-600 max-w-3xl", children: page.description })
      ] })
    ] }),
    /* @__PURE__ */ jsxs46("section", { "aria-labelledby": "storefront-services", className: "space-y-4", children: [
      /* @__PURE__ */ jsx59("h2", { id: "storefront-services", className: "text-xl font-semibold", children: t("storefront.services") }),
      /* @__PURE__ */ jsxs46("div", { className: "grid gap-3 sm:grid-cols-3 bg-white border rounded-xl p-4", children: [
        /* @__PURE__ */ jsxs46("div", { children: [
          /* @__PURE__ */ jsx59(Label, { htmlFor: "storefront-search", children: t("storefront.search") }),
          /* @__PURE__ */ jsx59(Input, { id: "storefront-search", value: search, onChange: (event) => setSearch(event.target.value) })
        ] }),
        /* @__PURE__ */ jsxs46("div", { children: [
          /* @__PURE__ */ jsx59(Label, { htmlFor: "storefront-category", children: t("storefront.category") }),
          /* @__PURE__ */ jsxs46("select", { id: "storefront-category", className: "h-10 w-full border rounded-md px-3 bg-white", value: category, onChange: (event) => setCategory(event.target.value), children: [
            /* @__PURE__ */ jsx59("option", { value: "", children: t("storefront.allCategories") }),
            availableCategories.map((key) => /* @__PURE__ */ jsx59("option", { value: key, children: categories.data?.find((item) => item.key === key)?.name ?? key }, key))
          ] })
        ] }),
        /* @__PURE__ */ jsxs46("div", { children: [
          /* @__PURE__ */ jsx59(Label, { htmlFor: "storefront-sort", children: t("storefront.sort") }),
          /* @__PURE__ */ jsx59("select", { id: "storefront-sort", className: "h-10 w-full border rounded-md px-3 bg-white", value: sort, onChange: (event) => setSort(event.target.value), children: ["name", "price", "duration"].map((value) => /* @__PURE__ */ jsx59("option", { value, disabled: value === "price" && !priceSortAvailable, children: t(`storefront.sort_${value}`) }, value)) })
        ] })
      ] }),
      !priceSortAvailable && /* @__PURE__ */ jsx59("p", { className: "text-sm text-neutral-600", role: "status", children: t("currency.mixedSort") }),
      /* @__PURE__ */ jsx59("p", { role: "status", className: "text-sm text-neutral-500", children: t("catalog.count", { count: services.length }) }),
      !services.length ? /* @__PURE__ */ jsx59("p", { className: "rounded-xl border bg-white p-6", children: t("storefront.empty") }) : /* @__PURE__ */ jsx59("div", { className: "search-cards search-cards-grid", children: services.map((service2) => /* @__PURE__ */ jsx59(ServiceCard, { service: service2, searchLayout: true, wishlistEnabled: !preview, onBook: () => setBooking(service2), onViewDetails: () => showDetails(service2) }, service2.id)) })
    ] }),
    /* @__PURE__ */ jsx59(ServiceDetailModal, { service: detail, searchLayout: true, open: detail !== null, wishlistEnabled: !preview, onClose: () => setDetail(null), onBook: () => {
      setBooking(detail);
      setDetail(null);
    } }),
    booking && /* @__PURE__ */ jsx59(BookingModal, { service: booking, returnTo: `/providers/${page.slug}?book=${booking.id}`, onClose: () => {
      setBooking(null);
      if (!preview && new URLSearchParams(window.location.search).has("book")) window.history.replaceState(null, "", `/providers/${page.slug}`);
    } })
  ] });
}
var init_storefront2 = __esm({
  "client/src/pages/storefront.tsx"() {
    "use strict";
    init_queryClient();
    init_use_categories();
    init_service_card();
    init_service_detail_modal();
    init_booking_modal();
    init_button();
    init_input();
    init_label();
    init_service_sort();
  }
});

// client/src/components/provider/storefront-editor.tsx
import { useEffect as useEffect19, useRef as useRef15, useState as useState25 } from "react";
import { Link as Link16 } from "wouter";
import { useMutation as useMutation11, useQuery as useQuery18, useQueryClient as useQueryClient13 } from "@tanstack/react-query";
import { Fragment as Fragment15, jsx as jsx60, jsxs as jsxs47 } from "react/jsx-runtime";
function StorefrontEditor({ context: context2 }) {
  const { t, language } = useFormLocale();
  const settings = useQuery18({ queryKey: ["/api/provider/storefront"], enabled: context2.permissions.manageServices, staleTime: 0, retry: false, refetchOnWindowFocus: true, refetchInterval: 6e4 });
  if (!context2.permissions.manageServices) return /* @__PURE__ */ jsx60("p", { role: "alert", children: t("storefront.denied") });
  if (settings.isPending) return /* @__PURE__ */ jsx60("p", { role: "status", children: t("storefront.loading") });
  if (settings.isError) return /* @__PURE__ */ jsxs47("div", { role: "alert", className: "space-y-3", children: [
    /* @__PURE__ */ jsx60("p", { children: t("storefront.loadError") }),
    /* @__PURE__ */ jsx60(Button, { onClick: () => void settings.refetch(), children: t("catalog.retry") })
  ] });
  return /* @__PURE__ */ jsx60(StorefrontForm, { settings: settings.data, context: context2 });
}
function StorefrontForm({ settings, context: context2 }) {
  const { t, language } = useFormLocale();
  const { user: user2 } = useAuth();
  const queryClient3 = useQueryClient13();
  const [draft, setDraft] = useState25(() => settings.storefront ? {
    slug: settings.storefront.slug,
    name: settings.storefront.name,
    description: settings.storefront.description,
    logoUrl: settings.storefront.logoUrl,
    coverUrl: settings.storefront.coverUrl,
    isPublished: settings.storefront.isPublished
  } : { slug: "", name: context2.company?.name ?? [user2?.firstName, user2?.lastName].filter(Boolean).join(" "), description: "", logoUrl: null, coverUrl: null, isPublished: false });
  const [preview, setPreview] = useState25(false);
  const [message, setMessage] = useState25("");
  const [error, setError] = useState25("");
  const [fieldErrors, setFieldErrors] = useState25([]);
  const errorRef = useRef15(null), locked = useRef15(false);
  const pro = settings.hasPro && (settings.subscription?.proUntil != null && new Date(settings.subscription.proUntil).getTime() > Date.now());
  const source = { companyId: context2.company?.id ?? null, providerId: user2.id };
  const services = useQuery18({
    queryKey: ["/api/services/catalog", providerCatalogQuery(source)],
    enabled: preview && pro,
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/services/catalog?${providerCatalogQuery(source)}`, void 0, signal)).json(),
    staleTime: 0
  });
  useEffect19(() => {
    if (!settings.subscription?.proUntil) return;
    const remaining = new Date(settings.subscription.proUntil).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => void queryClient3.invalidateQueries({ queryKey: ["/api/provider/storefront"] }), Math.min(remaining + 50, 2147483647));
    return () => window.clearTimeout(timer);
  }, [settings.subscription?.proUntil, queryClient3]);
  const save = useMutation11({
    mutationFn: async () => (await apiRequest("PUT", "/api/provider/storefront", storefrontSchema.parse(draft))).json(),
    onSuccess: async (saved2) => {
      setDraft({ slug: saved2.slug, name: saved2.name, description: saved2.description, logoUrl: saved2.logoUrl, coverUrl: saved2.coverUrl, isPublished: saved2.isPublished });
      setMessage(t("storefront.saved"));
      setError("");
      setFieldErrors([]);
      await queryClient3.invalidateQueries({ queryKey: ["/api/provider/storefront"] });
      await queryClient3.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/services") || query.queryKey[0] === "/api/storefronts" });
    },
    onError: (err) => {
      setMessage("");
      setError(t(err.message.startsWith("403:") ? "storefront.proRequired" : err.message.startsWith("409:") ? "storefront.addressConflict" : "storefront.saveError"));
      requestAnimationFrame(() => errorRef.current?.focus());
      void queryClient3.invalidateQueries({ queryKey: ["/api/provider/storefront"] });
    },
    onSettled: () => {
      locked.current = false;
    }
  });
  const valid = storefrontSchema.safeParse(draft).success;
  return /* @__PURE__ */ jsxs47("section", { className: "phase3-form space-y-6 rounded-xl border bg-card text-card-foreground p-4 sm:p-6", children: [
    /* @__PURE__ */ jsxs47("div", { children: [
      /* @__PURE__ */ jsx60("h2", { className: "text-xl font-semibold", children: t("storefront.title") }),
      /* @__PURE__ */ jsx60("p", { className: "text-muted-foreground mt-1", children: t("storefront.editorDescription") })
    ] }),
    /* @__PURE__ */ jsxs47("div", { className: "rounded-xl bg-primary/5 p-4 space-y-2", children: [
      /* @__PURE__ */ jsx60("p", { className: "font-medium", children: t(pro ? "storefront.proActive" : "storefront.proRequired") }),
      pro && /* @__PURE__ */ jsx60("p", { className: "text-sm", children: t("storefront.validUntil", { date: formatDateTime24(settings.subscription.proUntil, language) }) }),
      !pro && /* @__PURE__ */ jsx60("p", { className: "text-sm", children: t("storefront.contactSupport") }),
      settings.storefront && /* @__PURE__ */ jsx60("p", { className: "text-sm", children: t(pro && settings.storefront.isPublished ? "storefront.published" : "storefront.hidden") })
    ] }),
    pro && /* @__PURE__ */ jsxs47(Fragment15, { children: [
      /* @__PURE__ */ jsx60("form", { noValidate: true, className: "space-y-4", onSubmit: (event) => {
        event.preventDefault();
        if (locked.current) return;
        setMessage("");
        setError("");
        const parsed = storefrontSchema.safeParse(draft);
        if (!parsed.success) {
          setFieldErrors(parsed.error.issues.map((issue) => String(issue.path[0])));
          setError(t("operationsForm.storefrontFields"));
          requestAnimationFrame(() => errorRef.current?.focus());
          return;
        }
        setFieldErrors([]);
        locked.current = true;
        save.mutate();
      }, children: /* @__PURE__ */ jsxs47("fieldset", { disabled: save.isPending, className: "space-y-4", children: [
        /* @__PURE__ */ jsx60("legend", { className: "text-lg font-semibold mb-4", children: t("operationsForm.publicDetails") }),
        /* @__PURE__ */ jsxs47("div", { children: [
          /* @__PURE__ */ jsx60(Label, { htmlFor: "storefront-slug", children: t("storefront.address") }),
          /* @__PURE__ */ jsx60(Input, { id: "storefront-slug", "aria-invalid": fieldErrors.includes("slug"), "aria-describedby": fieldErrors.includes("slug") ? "storefront-error" : "storefront-address-help", value: draft.slug, disabled: Boolean(settings.storefront), required: true, minLength: 3, maxLength: 64, pattern: "[a-z0-9]+(-[a-z0-9]+)*", onChange: (event) => setDraft({ ...draft, slug: event.target.value }) }),
          /* @__PURE__ */ jsx60("p", { id: "storefront-address-help", className: "text-sm text-muted-foreground mt-1", children: t("storefront.addressHelp") }),
          /* @__PURE__ */ jsxs47("p", { className: "text-sm break-all mt-1", children: [
            "/providers/",
            draft.slug || "\u2026"
          ] })
        ] }),
        /* @__PURE__ */ jsxs47("div", { children: [
          /* @__PURE__ */ jsx60(Label, { htmlFor: "storefront-name", children: t("storefront.name") }),
          /* @__PURE__ */ jsx60(Input, { id: "storefront-name", "aria-invalid": fieldErrors.includes("name"), "aria-describedby": fieldErrors.includes("name") ? "storefront-error" : void 0, value: draft.name, required: true, maxLength: 150, onChange: (event) => setDraft({ ...draft, name: event.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs47("div", { children: [
          /* @__PURE__ */ jsx60(Label, { htmlFor: "storefront-description", children: t("storefront.description") }),
          /* @__PURE__ */ jsx60(Textarea, { id: "storefront-description", "aria-invalid": fieldErrors.includes("description"), "aria-describedby": fieldErrors.includes("description") ? "storefront-error" : void 0, value: draft.description, maxLength: 3e3, rows: 5, onChange: (event) => setDraft({ ...draft, description: event.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs47("section", { "aria-labelledby": "storefront-images", children: [
          /* @__PURE__ */ jsx60("h3", { id: "storefront-images", className: "font-semibold mb-4", children: t("operationsForm.images") }),
          /* @__PURE__ */ jsx60("div", { className: "grid sm:grid-cols-2 gap-4", children: ["logoUrl", "coverUrl"].map((field) => /* @__PURE__ */ jsxs47("div", { className: "space-y-2 rounded-lg border p-3", children: [
            /* @__PURE__ */ jsx60("p", { className: "font-medium", children: t(`storefront.${field}`) }),
            draft[field] && /* @__PURE__ */ jsx60("img", { src: draft[field], alt: t(`storefront.${field}`), className: "h-24 max-w-full rounded-lg object-cover" }),
            /* @__PURE__ */ jsx60(ImageUploader, { onComplete: (path) => setDraft((previous) => ({ ...previous, [field]: path })), children: t("storefront.upload") }),
            draft[field] && /* @__PURE__ */ jsx60(Button, { type: "button", variant: "ghost", onClick: () => setDraft({ ...draft, [field]: null }), children: t("storefront.remove") })
          ] }, field)) })
        ] }),
        /* @__PURE__ */ jsx60("h3", { className: "font-semibold pt-4 border-t", children: t("operationsForm.publication") }),
        /* @__PURE__ */ jsxs47("label", { className: "flex gap-3 items-center min-h-11", children: [
          /* @__PURE__ */ jsx60("input", { type: "checkbox", checked: draft.isPublished, onChange: (event) => setDraft({ ...draft, isPublished: event.target.checked }) }),
          /* @__PURE__ */ jsx60("span", { children: t("storefront.publish") })
        ] }),
        /* @__PURE__ */ jsxs47("div", { className: "flex flex-wrap gap-2", children: [
          /* @__PURE__ */ jsx60(Button, { type: "submit", disabled: save.isPending, children: t(save.isPending ? "storefront.saving" : "storefront.save") }),
          /* @__PURE__ */ jsx60(Button, { type: "button", variant: "outline", disabled: !valid, onClick: () => setPreview((value) => !value), children: t(preview ? "storefront.closePreview" : "storefront.preview") }),
          settings.storefront?.isPublished && /* @__PURE__ */ jsx60(Button, { asChild: true, variant: "outline", children: /* @__PURE__ */ jsx60(Link16, { href: `/providers/${settings.storefront.slug}`, children: t("storefront.open") }) })
        ] })
      ] }) }),
      settings.storefront?.isPublished && /* @__PURE__ */ jsxs47("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx60(Label, { htmlFor: "storefront-share", children: t("storefront.share") }),
        /* @__PURE__ */ jsx60(Input, { id: "storefront-share", readOnly: true, value: `${window.location.origin}/providers/${settings.storefront.slug}`, onFocus: (event) => event.target.select() }),
        /* @__PURE__ */ jsx60(Button, { variant: "outline", onClick: async () => {
          try {
            await navigator.clipboard.writeText(`${window.location.origin}/providers/${settings.storefront.slug}`);
            setError("");
            setMessage(t("storefront.copied"));
          } catch {
            setError(t("storefront.copyError"));
          }
        }, children: t("storefront.copy") })
      ] })
    ] }),
    message && /* @__PURE__ */ jsx60("p", { role: "status", children: message }),
    error && /* @__PURE__ */ jsxs47("p", { id: "storefront-error", ref: errorRef, tabIndex: -1, role: "alert", className: "text-destructive", children: [
      error,
      fieldErrors.filter((field) => ["slug", "name", "description"].includes(field)).map((field) => /* @__PURE__ */ jsx60("a", { className: "block", href: `#storefront-${field}`, children: t(`storefront.${field === "slug" ? "address" : field}`) }, field))
    ] }),
    preview && pro && /* @__PURE__ */ jsxs47("div", { className: "border-t pt-5 space-y-4", children: [
      /* @__PURE__ */ jsx60("p", { className: "font-medium", children: t("storefront.previewNote") }),
      services.isPending ? /* @__PURE__ */ jsx60("p", { role: "status", children: t("storefront.loading") }) : services.isError ? /* @__PURE__ */ jsx60("p", { role: "alert", children: t("storefront.loadError") }) : /* @__PURE__ */ jsx60(StorefrontView, { page: { ...draft, services: services.data }, preview: true })
    ] })
  ] });
}
var init_storefront_editor = __esm({
  "client/src/components/provider/storefront-editor.tsx"() {
    "use strict";
    init_forms_locale();
    init_storefront();
    init_provider_catalog();
    init_queryClient();
    init_date_time();
    init_useAuth();
    init_storefront2();
    init_ImageUploader();
    init_button();
    init_input();
    init_textarea();
    init_label();
  }
});

// client/src/lib/monthly-billing.ts
import { z as z7 } from "zod";
function sameBillingTarget(a, b) {
  return a.kind === b.kind && a.id === b.id;
}
function parseBillingStatus(value, target) {
  const parsed = monthlyBillingStatusSchema.safeParse(value);
  if (!parsed.success || !sameBillingTarget(parsed.data.target, target)) throw new BillingClientError("invalid");
  if (parsed.data.effectiveAccess.hasPro && Date.parse(parsed.data.effectiveAccess.until) <= Date.now()) throw new BillingClientError("invalid");
  return parsed.data;
}
function parseHostedResult(value, target, origins) {
  const parsed = z7.discriminatedUnion("state", [
    z7.object({ state: z7.literal("pending"), target: subscriptionTargetSchema }).strict(),
    z7.object({ state: z7.literal("redirect"), target: subscriptionTargetSchema, url: z7.string().max(4096) }).strict()
  ]).safeParse(value);
  if (!parsed.success || !sameBillingTarget(parsed.data.target, target)) throw new BillingClientError("invalid");
  if (parsed.data.state === "pending") return null;
  let url;
  try {
    url = new URL(parsed.data.url);
  } catch {
    throw new BillingClientError("invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || !origins.some((origin) => {
    try {
      const allowed = new URL(origin);
      return allowed.protocol === "https:" && allowed.origin === origin && url.origin === origin;
    } catch {
      return false;
    }
  })) throw new BillingClientError("invalid");
  return url.href;
}
var instant, text, monthlyBillingStatusSchema, BillingClientError;
var init_monthly_billing = __esm({
  "client/src/lib/monthly-billing.ts"() {
    "use strict";
    init_storefront();
    instant = z7.string().datetime({ offset: true }).nullable();
    text = z7.string().trim().min(1).max(2e3);
    monthlyBillingStatusSchema = z7.object({
      target: subscriptionTargetSchema,
      state: z7.enum(["none", "pending", "active", "payment_failed", "action_required", "canceled", "expired"]),
      manualUntil: instant,
      paidThrough: instant,
      effectiveAccess: z7.object({ hasPro: z7.boolean(), until: instant }).strict(),
      cancelAtPeriodEnd: z7.boolean(),
      operation: z7.enum(["none", "pending", "unknown", "unavailable"]),
      unavailableReason: z7.enum(["manual_grant", "not_ready"]).nullable(),
      capabilities: z7.object({ checkout: z7.boolean(), manage: z7.boolean(), recover: z7.boolean() }).strict(),
      offer: z7.object({
        amount: z7.string().regex(/^(?:0|[1-9]\d{0,5})\.\d{2}$/).refine((value) => value.split(".")[0] !== "0" || value.split(".")[1] >= "50"),
        currency: z7.literal("EUR"),
        interval: z7.literal("month"),
        taxDisclosure: text,
        termsText: text,
        termsVersion: z7.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
        offerRevision: z7.string().uuid()
      }).strict().nullable()
    }).strict().refine((value) => !value.effectiveAccess.hasPro || value.effectiveAccess.until !== null, "Confirmed Pro access needs an expiry");
    BillingClientError = class extends Error {
      constructor(code) {
        super(code);
        this.code = code;
      }
    };
  }
});

// client/src/components/provider/monthly-billing-panel.tsx
import { useEffect as useEffect20, useRef as useRef16, useState as useState26 } from "react";
import { Fragment as Fragment16, jsx as jsx61, jsxs as jsxs48 } from "react/jsx-runtime";
function MonthlyBillingPanel(props) {
  return /* @__PURE__ */ jsx61(ScopedBillingPanel, { ...props }, JSON.stringify([props.actorId, props.target.kind, props.target.id]));
}
function ScopedBillingPanel({ actorId, target, transport, returned = false, navigate = (url) => window.location.assign(url) }) {
  const { t, language } = useFormLocale();
  const [status, setStatus] = useState26(null);
  const [loading, setLoading] = useState26(Boolean(transport));
  const [busy, setBusy] = useState26(false), [accepted, setAccepted] = useState26(false);
  const [error, setError] = useState26(""), [pending, setPending] = useState26(returned);
  const sequence = useRef16(0), request = useRef16(), locked = useRef16(false);
  const uncertain = useRef16(false), checkoutKey = useRef16();
  const readsForPending = useRef16(0), latestRead = useRef16();
  const activeTransport = useRef16(transport);
  const scope = { actorId, target };
  const date = (value) => formatDateTime24(value, language, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  function message(err) {
    return err instanceof BillingClientError ? `monthlyBilling.${err.code}` : "monthlyBilling.loadError";
  }
  async function read() {
    if (!transport || locked.current) return;
    request.current?.abort();
    const controller = new AbortController(), generation = ++sequence.current;
    request.current = controller;
    setLoading(true);
    setError("");
    setStatus(null);
    setAccepted(false);
    setPending(false);
    try {
      const next = parseBillingStatus(await transport.read(scope, controller.signal), target);
      if (controller.signal.aborted || generation !== sequence.current) return;
      if (next.operation === "none" && next.capabilities.checkout && next.offer) {
        uncertain.current = false;
        checkoutKey.current = void 0;
      }
      setStatus(next);
      setPending(next.operation === "pending" || next.operation === "unknown" || next.state === "pending");
    } catch (err) {
      if (!controller.signal.aborted && generation === sequence.current) setError(message(err));
    } finally {
      if (!controller.signal.aborted && generation === sequence.current) setLoading(false);
    }
  }
  latestRead.current = read;
  useEffect20(() => {
    activeTransport.current = transport;
    setStatus(null);
    setAccepted(false);
    setError("");
    setBusy(false);
    locked.current = false;
    void read();
    return () => {
      sequence.current++;
      request.current?.abort();
    };
  }, [transport]);
  useEffect20(() => {
    if (!transport || typeof window === "undefined" || typeof document === "undefined") return;
    const refresh = () => {
      if (document.visibilityState !== "hidden") void latestRead.current?.();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [transport]);
  useEffect20(() => {
    if (!transport || !status) return;
    const until = status.effectiveAccess.until;
    const expiry = status.effectiveAccess.hasPro && until ? Math.max(0, Date.parse(until) - Date.now() + 1) : Infinity;
    const shouldPoll = (pending || returned) && readsForPending.current < 8 && (status.operation === "pending" || status.operation === "unknown" || status.state === "pending");
    const delay = Math.min(expiry, shouldPoll ? 3e3 : Infinity);
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(() => {
      if (shouldPoll) readsForPending.current++;
      void latestRead.current?.();
    }, Math.min(delay, 2147483647));
    return () => clearTimeout(timer);
  }, [status, transport, pending, returned]);
  async function action(kind) {
    if (!transport || !status || locked.current || loading) return;
    if (kind === "checkout" && (!status.capabilities.checkout || !status.offer || !accepted || status.operation !== "none" || status.unavailableReason || uncertain.current)) return;
    if (kind === "portal" && !status.capabilities.manage && !status.capabilities.recover) return;
    locked.current = true;
    setBusy(true);
    setError("");
    request.current?.abort();
    const controller = new AbortController(), generation = ++sequence.current;
    request.current = controller;
    if (kind === "checkout") {
      uncertain.current = true;
      checkoutKey.current ??= crypto.randomUUID();
    }
    try {
      const result = kind === "checkout" ? await transport.checkout(scope, { termsVersion: status.offer.termsVersion, offerRevision: status.offer.offerRevision, idempotencyKey: checkoutKey.current }, controller.signal) : await transport.portal(scope, controller.signal);
      if (controller.signal.aborted || generation !== sequence.current) return;
      const url = parseHostedResult(result, target, transport.hostedOrigins);
      setPending(true);
      if (url) navigate(url);
    } catch (err) {
      if (!controller.signal.aborted && generation === sequence.current) {
        if (err instanceof BillingClientError && ["denied", "unauthorized"].includes(err.code)) {
          setStatus(null);
          setPending(false);
        }
        if (err instanceof BillingClientError && err.code === "conflict") {
          setStatus(null);
          setAccepted(false);
        }
        setError(kind === "checkout" && !(err instanceof BillingClientError) ? "monthlyBilling.unknown" : message(err));
      }
    } finally {
      if (!controller.signal.aborted && generation === sequence.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  const visible = activeTransport.current === transport ? status : null;
  const unavailable = !transport;
  return /* @__PURE__ */ jsxs48("section", { "aria-labelledby": "monthly-billing-title", className: "monthly-billing space-y-4 rounded-xl border bg-card text-card-foreground p-4 sm:p-6 min-w-0 break-words", children: [
    /* @__PURE__ */ jsx61("h2", { id: "monthly-billing-title", className: "text-xl font-semibold", children: t("monthlyBilling.title") }),
    /* @__PURE__ */ jsx61("p", { children: t("monthlyBilling.workspace") }),
    unavailable ? /* @__PURE__ */ jsx61("p", { role: "status", children: t("monthlyBilling.unavailable") }) : /* @__PURE__ */ jsxs48(Fragment16, { children: [
      returned && /* @__PURE__ */ jsx61("p", { children: t("monthlyBilling.returned") }),
      /* @__PURE__ */ jsx61("div", { role: "status", "aria-live": "polite", "aria-busy": loading || busy, children: loading ? t("monthlyBilling.loading") : busy ? t("monthlyBilling.opening") : pending ? t("monthlyBilling.pending") : null }),
      visible && /* @__PURE__ */ jsxs48(Fragment16, { children: [
        /* @__PURE__ */ jsx61("p", { className: "font-semibold", children: t(`monthlyBilling.state_${visible.state}`) }),
        /* @__PURE__ */ jsx61("p", { children: t(visible.effectiveAccess.hasPro ? "monthlyBilling.accessActive" : "monthlyBilling.accessInactive") }),
        visible.operation === "unknown" && /* @__PURE__ */ jsx61("p", { children: t("monthlyBilling.unknown") }),
        visible.operation === "unavailable" && /* @__PURE__ */ jsx61("p", { children: t("monthlyBilling.unavailable") }),
        visible.unavailableReason === "manual_grant" && /* @__PURE__ */ jsx61("p", { children: t("monthlyBilling.manualWait") }),
        visible.unavailableReason === "not_ready" && /* @__PURE__ */ jsx61("p", { children: t("monthlyBilling.unavailable") }),
        /* @__PURE__ */ jsxs48("dl", { className: "space-y-3", children: [
          ["manualUntil", "paidThrough"].map((field) => /* @__PURE__ */ jsxs48("div", { children: [
            /* @__PURE__ */ jsx61("dt", { className: "font-medium", children: t(`monthlyBilling.${field}`) }),
            /* @__PURE__ */ jsx61("dd", { children: visible[field] ? /* @__PURE__ */ jsxs48("time", { dateTime: visible[field], children: [
              date(visible[field]),
              " UTC"
            ] }) : t("monthlyBilling.noConfirmedDate") })
          ] }, field)),
          /* @__PURE__ */ jsxs48("div", { children: [
            /* @__PURE__ */ jsx61("dt", { className: "font-medium", children: t("monthlyBilling.effectiveUntil") }),
            /* @__PURE__ */ jsx61("dd", { children: visible.effectiveAccess.until ? /* @__PURE__ */ jsxs48("time", { dateTime: visible.effectiveAccess.until, children: [
              date(visible.effectiveAccess.until),
              " UTC"
            ] }) : t("monthlyBilling.noConfirmedDate") })
          ] })
        ] }),
        visible.cancelAtPeriodEnd && /* @__PURE__ */ jsx61("p", { children: t("monthlyBilling.canceling") }),
        visible.offer && visible.capabilities.checkout && visible.operation === "none" && !visible.unavailableReason && !uncertain.current && /* @__PURE__ */ jsxs48("div", { className: "space-y-3 border-t pt-4", children: [
          /* @__PURE__ */ jsx61("p", { className: "text-lg font-semibold", children: t("monthlyBilling.monthlyPrice", { price: new Intl.NumberFormat(language, { style: "currency", currency: visible.offer.currency }).format(Number(visible.offer.amount)) }) }),
          /* @__PURE__ */ jsx61("p", { children: visible.offer.taxDisclosure }),
          /* @__PURE__ */ jsx61("p", { children: visible.offer.termsText }),
          /* @__PURE__ */ jsxs48("label", { className: "flex gap-3 min-h-11 items-start py-2", children: [
            /* @__PURE__ */ jsx61("input", { type: "checkbox", className: "mt-1 shrink-0", checked: accepted, onChange: (event) => setAccepted(event.target.checked), disabled: busy || loading }),
            /* @__PURE__ */ jsx61("span", { children: t("monthlyBilling.acceptTerms") })
          ] }),
          /* @__PURE__ */ jsx61(Button, { className: "min-h-11 h-auto whitespace-normal", type: "button", disabled: !accepted || busy || loading, onClick: () => void action("checkout"), children: t("monthlyBilling.checkout") })
        ] }),
        (visible.capabilities.manage || visible.capabilities.recover) && /* @__PURE__ */ jsx61(Button, { className: "min-h-11 h-auto whitespace-normal", type: "button", disabled: busy || loading, onClick: () => void action("portal"), children: t(visible.capabilities.recover ? "monthlyBilling.recover" : "monthlyBilling.manage") })
      ] }),
      error && /* @__PURE__ */ jsx61("p", { role: "alert", children: t(error) }),
      /* @__PURE__ */ jsx61(Button, { className: "min-h-11 h-auto whitespace-normal", type: "button", variant: "outline", disabled: busy || loading, onClick: () => void read(), children: t("monthlyBilling.refresh") })
    ] })
  ] });
}
var init_monthly_billing_panel = __esm({
  "client/src/components/provider/monthly-billing-panel.tsx"() {
    "use strict";
    init_forms_locale();
    init_date_time();
    init_button();
    init_monthly_billing();
  }
});

// client/src/lib/billing-http.ts
import { z as z8 } from "zod";
async function requestJSON(fetcher, path, method, signal, data) {
  const response = await fetcher(path, {
    method,
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    signal,
    headers: data ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: data ? JSON.stringify(data) : void 0
  });
  if (!response.ok) throw new BillingClientError(response.status === 401 ? "unauthorized" : response.status === 403 ? "denied" : response.status === 409 ? "conflict" : response.status === 400 ? "invalid" : "unavailable");
  if (!response.headers.get("content-type")?.includes("application/json")) throw new BillingClientError("invalid");
  try {
    return await response.json();
  } catch {
    throw new BillingClientError("invalid");
  }
}
function createBillingRuntime(options, fetcher = fetch) {
  const subscriptionTransport = options.subscriptionsReady ? {
    hostedOrigins: [...options.hostedOrigins],
    read: (scope, signal) => requestJSON(fetcher, `/api/billing/subscription?${new URLSearchParams({ kind: scope.target.kind, id: String(scope.target.id) })}`, "GET", signal),
    checkout: (scope, input2, signal) => requestJSON(fetcher, "/api/billing/checkout", "POST", signal, { target: scope.target, ...input2 }),
    portal: (scope, signal) => requestJSON(fetcher, "/api/billing/portal", "POST", signal, { target: scope.target })
  } : void 0;
  const adminPricingTransport = options.administrationReady ? {
    read: (signal) => requestJSON(fetcher, "/api/admin/billing/offer", "GET", signal),
    save: (input2, signal) => requestJSON(fetcher, "/api/admin/billing/offer", "PUT", signal, input2)
  } : void 0;
  return { subscriptionTransport, adminPricingTransport };
}
var amount, adminBillingOfferSchema, billingCapabilitiesSchema;
var init_billing_http = __esm({
  "client/src/lib/billing-http.ts"() {
    "use strict";
    init_monthly_billing();
    amount = z8.string().regex(/^(?:0|[1-9]\d{0,5})\.\d{2}$/).refine((value) => value.split(".")[0] !== "0" || value.split(".")[1] >= "50");
    adminBillingOfferSchema = z8.object({
      amount,
      revision: z8.string().regex(/^[1-9]\d{0,9}$/).refine((value) => Number(value) <= 2147483647),
      currency: z8.literal("EUR"),
      interval: z8.literal("month"),
      taxIncluded: z8.literal(true)
    }).strict();
    billingCapabilitiesSchema = z8.object({
      subscriptionsReady: z8.boolean(),
      administrationReady: z8.boolean(),
      hostedOrigins: z8.array(z8.string().max(255).refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password && url.origin === value;
        } catch {
          return false;
        }
      })).max(4)
    }).strict().refine((value) => !value.subscriptionsReady || value.hostedOrigins.length > 0);
  }
});

// client/src/components/billing-runtime.tsx
import { createContext as createContext2, useContext as useContext2, useEffect as useEffect21, useMemo as useMemo4, useRef as useRef17, useState as useState27 } from "react";
import { jsx as jsx62 } from "react/jsx-runtime";
var dormantBillingRuntime, BillingRuntimeContext, useBillingRuntime;
var init_billing_runtime = __esm({
  "client/src/components/billing-runtime.tsx"() {
    "use strict";
    init_billing_http();
    dormantBillingRuntime = createBillingRuntime({ subscriptionsReady: false, administrationReady: false, hostedOrigins: [] });
    BillingRuntimeContext = createContext2(dormantBillingRuntime);
    useBillingRuntime = () => useContext2(BillingRuntimeContext);
  }
});

// client/src/components/account-pricing-settings.tsx
import { useEffect as useEffect22, useRef as useRef18, useState as useState28 } from "react";
import { useMutation as useMutation12, useQueryClient as useQueryClient14 } from "@tanstack/react-query";
import { useTranslation as useTranslation40 } from "react-i18next";
import { Fragment as Fragment17, jsx as jsx63, jsxs as jsxs49 } from "react/jsx-runtime";
function PricingForm({ actorId, initial, reload }) {
  const { t, i18n } = useTranslation40();
  const queryClient3 = useQueryClient14();
  const [draft, setDraft] = useState28(() => draftFrom(initial));
  const [base, setBase] = useState28(initial);
  const [currencyEdited, setCurrencyEdited] = useState28(false);
  const [invalid, setInvalid] = useState28([]);
  const [error, setError] = useState28("");
  const [saved2, setSaved] = useState28(false);
  const [denied, setDenied] = useState28(false);
  const [reloading, setReloading] = useState28(false);
  const form = useRef18(null);
  const alive = useRef18(true);
  const request = useRef18(null);
  const submitting = useRef18(false);
  useEffect22(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  const language = i18n.resolvedLanguage || i18n.language;
  const currencies = new Intl.DisplayNames([language], { type: "currency" });
  const countries = new Intl.DisplayNames([language], { type: "region" });
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(base));
  const mutation = useMutation12({
    mutationFn: async () => {
      request.current = new AbortController();
      const data = workspacePricingSettingsViewSchema.parse(await (await apiRequest("PATCH", endpoint, {
        expectedWorkspace: base.workspace,
        expectedRevision: base.revision,
        defaultCurrency: draft.defaultCurrency || null,
        businessCountryCode: draft.businessCountryCode || null
      }, request.current.signal)).json());
      if (!samePricingWorkspace(data.workspace, base.workspace)) throw new Error("409: Workspace changed");
      return data;
    },
    onSuccess: (data) => {
      if (!alive.current) return;
      const key = [endpoint, actorId, data.workspace.kind === "company" ? data.workspace.id : "personal"];
      queryClient3.setQueryData(key, data);
      setBase(data);
      setDraft(draftFrom(data));
      setCurrencyEdited(false);
      setSaved(true);
      setError("");
    },
    onError: (failure) => {
      if (!alive.current) return;
      setError(/^409:/.test(failure.message) ? "pricingSettings.conflict" : /^403:/.test(failure.message) ? "pricingSettings.denied" : "pricingSettings.saveError");
      if (/^(401|403):/.test(failure.message)) setDenied(true);
      if (/^401:/.test(failure.message)) queryClient3.setQueryData(["/api/auth/user"], null);
      queueMicrotask(() => form.current?.querySelector("[data-pricing-error]")?.focus());
    },
    onSettled: () => {
      submitting.current = false;
      request.current = null;
    }
  });
  const clearFeedback = () => {
    setError("");
    setSaved(false);
  };
  const submit = (event) => {
    event.preventDefault();
    if (submitting.current || mutation.isPending || !initial.canEdit || reloading) return;
    const fields = [draft.defaultCurrency && !isSupportedCurrency(draft.defaultCurrency) ? "pricing-default-currency" : "", draft.businessCountryCode && !isSupportedCountry(draft.businessCountryCode) ? "pricing-business-country" : ""].filter(Boolean);
    setInvalid(fields);
    clearFeedback();
    if (fields.length) {
      queueMicrotask(() => document.getElementById(fields[0])?.focus());
      return;
    }
    submitting.current = true;
    mutation.mutate();
  };
  const reloadSettings = async () => {
    if (reloading || mutation.isPending) return;
    setReloading(true);
    try {
      const result = await reload();
      if (!alive.current) return;
      if (result.error || !result.data) {
        setError("pricingSettings.loadError");
        return;
      }
      setBase(result.data);
      setDraft(draftFrom(result.data));
      setCurrencyEdited(false);
      setInvalid([]);
      setError("");
      setSaved(false);
      queueMicrotask(() => document.getElementById("pricing-default-currency")?.focus());
    } catch {
      if (alive.current) setError("pricingSettings.loadError");
    } finally {
      if (alive.current) setReloading(false);
    }
  };
  if (denied) return /* @__PURE__ */ jsx63("p", { role: "alert", children: t("pricingSettings.denied") });
  return /* @__PURE__ */ jsxs49("form", { ref: form, id: "workspace-pricing-settings-form", className: "space-y-4", onSubmit: submit, noValidate: true, "aria-busy": mutation.isPending || reloading, children: [
    !initial.canEdit && /* @__PURE__ */ jsx63("p", { children: t("pricingSettings.readOnly") }),
    /* @__PURE__ */ jsxs49("fieldset", { disabled: !initial.canEdit || mutation.isPending || reloading, className: "space-y-4 min-w-0", children: [
      /* @__PURE__ */ jsxs49("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx63(Label, { htmlFor: "pricing-default-currency", children: t("pricingSettings.defaultCurrency") }),
        /* @__PURE__ */ jsxs49(
          "select",
          {
            id: "pricing-default-currency",
            className: "w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base",
            value: draft.defaultCurrency,
            "aria-invalid": invalid.includes("pricing-default-currency") || void 0,
            "aria-describedby": "pricing-currency-help" + (invalid.includes("pricing-default-currency") ? " pricing-currency-error" : ""),
            onChange: (event) => {
              setDraft((previous) => ({ ...previous, defaultCurrency: event.target.value }));
              setCurrencyEdited(true);
              setInvalid((previous) => previous.filter((id) => id !== "pricing-default-currency"));
              clearFeedback();
            },
            children: [
              /* @__PURE__ */ jsx63("option", { value: "", children: t("pricingSettings.noDefault") }),
              SUPPORTED_CURRENCIES.map((code) => /* @__PURE__ */ jsxs49("option", { value: code, children: [
                code,
                " \u2014 ",
                currencies.of(code) || code
              ] }, code))
            ]
          }
        ),
        /* @__PURE__ */ jsx63("p", { id: "pricing-currency-help", className: "text-sm text-muted-foreground", children: t("pricingSettings.currencyHelp") }),
        invalid.includes("pricing-default-currency") && /* @__PURE__ */ jsx63("p", { id: "pricing-currency-error", className: "text-sm text-red-700 dark:text-red-300", children: t("pricingSettings.invalidCurrency") })
      ] }),
      /* @__PURE__ */ jsxs49("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx63(Label, { htmlFor: "pricing-business-country", children: t("pricingSettings.businessCountry") }),
        /* @__PURE__ */ jsxs49(
          "select",
          {
            id: "pricing-business-country",
            autoComplete: "country",
            className: "w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base",
            value: draft.businessCountryCode,
            "aria-invalid": invalid.includes("pricing-business-country") || void 0,
            "aria-describedby": "pricing-business-country-help" + (invalid.includes("pricing-business-country") ? " pricing-country-error" : ""),
            onChange: (event) => {
              const country2 = event.target.value;
              setDraft((previous) => ({ ...previous, businessCountryCode: country2, defaultCurrency: !currencyEdited && !base.defaultCurrency ? suggestedCurrency(country2) ?? "" : previous.defaultCurrency }));
              setInvalid((previous) => previous.filter((id) => id !== "pricing-business-country"));
              clearFeedback();
            },
            children: [
              /* @__PURE__ */ jsx63("option", { value: "", children: t("pricingSettings.unknownCountry") }),
              SUPPORTED_COUNTRIES.map((code) => /* @__PURE__ */ jsx63("option", { value: code, children: countries.of(code) || code }, code))
            ]
          }
        ),
        /* @__PURE__ */ jsx63("p", { id: "pricing-business-country-help", className: "text-sm text-muted-foreground", children: t("pricingSettings.countryHelp") }),
        invalid.includes("pricing-business-country") && /* @__PURE__ */ jsx63("p", { id: "pricing-country-error", className: "text-sm text-red-700 dark:text-red-300", children: t("pricingSettings.invalidCountry") })
      ] })
    ] }),
    error && /* @__PURE__ */ jsxs49("div", { "data-pricing-error": true, tabIndex: -1, role: "alert", className: "space-y-2 text-sm text-red-700 dark:text-red-300 focus:outline focus:outline-2 focus:outline-offset-2", children: [
      /* @__PURE__ */ jsx63("p", { children: t(error) }),
      ["pricingSettings.conflict", "pricingSettings.loadError"].includes(error) && /* @__PURE__ */ jsx63(Button, { type: "button", variant: "outline", className: "min-h-11 h-auto whitespace-normal", disabled: reloading || mutation.isPending, onClick: () => void reloadSettings(), children: t("pricingSettings.reload") })
    ] }),
    saved2 && /* @__PURE__ */ jsx63("p", { role: "status", className: "text-sm", children: t("pricingSettings.saved") }),
    initial.canEdit && /* @__PURE__ */ jsx63(Button, { type: "submit", className: "w-full sm:w-auto min-h-11 h-auto whitespace-normal", disabled: mutation.isPending || reloading || !dirty, children: t(mutation.isPending ? "pricingSettings.saving" : "pricingSettings.save") })
  ] });
}
function AccountPricingSettings({ actorId }) {
  const { t } = useTranslation40();
  const { context: context2, settings, scope, loading, allowed, error, retry, switching } = useWorkspacePricing(actorId);
  const workspaceName = context2.data?.company?.name || t("pricingSettings.personal");
  const denied = error instanceof Error && /^(401|403):/.test(error.message);
  return /* @__PURE__ */ jsxs49(Card, { id: "pricing-settings", className: "scroll-mt-6", "aria-labelledby": "pricing-settings-title", children: [
    /* @__PURE__ */ jsxs49(CardHeader, { children: [
      /* @__PURE__ */ jsx63("h2", { className: "text-lg font-semibold", id: "pricing-settings-title", children: t("pricingSettings.title") }),
      /* @__PURE__ */ jsx63(CardDescription, { children: t("pricingSettings.intro") })
    ] }),
    /* @__PURE__ */ jsx63(CardContent, { className: "space-y-4", children: loading || switching ? /* @__PURE__ */ jsx63("p", { role: "status", children: t("pricingSettings.loading") }) : denied ? /* @__PURE__ */ jsx63("p", { role: "alert", children: t("pricingSettings.denied") }) : error && !settings.data ? /* @__PURE__ */ jsxs49("p", { role: "alert", children: [
      t("pricingSettings.loadError"),
      " ",
      /* @__PURE__ */ jsx63(Button, { type: "button", variant: "outline", className: "min-h-11 h-auto whitespace-normal", onClick: retry, children: t("pricingSettings.retry") })
    ] }) : !allowed ? /* @__PURE__ */ jsx63("p", { children: t("pricingSettings.denied") }) : scope && settings.data ? /* @__PURE__ */ jsxs49(Fragment17, { children: [
      /* @__PURE__ */ jsxs49("p", { className: "text-sm break-words", children: [
        t("pricingSettings.workspace"),
        ": ",
        /* @__PURE__ */ jsx63("bdi", { children: workspaceName })
      ] }),
      /* @__PURE__ */ jsx63(PricingForm, { actorId, initial: settings.data, reload: settings.refetch }, `${actorId}:${scope}:${settings.data.canEdit}`)
    ] }) : /* @__PURE__ */ jsx63("p", { role: "status", children: t("pricingSettings.loading") }) })
  ] });
}
var endpoint, draftFrom;
var init_account_pricing_settings = __esm({
  "client/src/components/account-pricing-settings.tsx"() {
    "use strict";
    init_workspace_pricing();
    init_currencies();
    init_use_workspace_pricing();
    init_queryClient();
    init_button();
    init_label();
    init_card();
    endpoint = "/api/workspace/pricing-settings";
    draftFrom = (value) => ({ defaultCurrency: value.defaultCurrency ?? "", businessCountryCode: value.businessCountryCode ?? "" });
  }
});

// client/src/components/address-location-fields.tsx
import { useEffect as useEffect23, useRef as useRef19, useState as useState29 } from "react";
import { useTranslation as useTranslation41 } from "react-i18next";
import { jsx as jsx64, jsxs as jsxs50 } from "react/jsx-runtime";
function createLocationDraft(address) {
  const location2 = address ? currentLocation(address) : void 0;
  return {
    address: location2?.address ?? "",
    countryCode: location2?.countryCode ?? null,
    pricingCurrency: location2?.pricingCurrency ?? null,
    latitude: location2?.latitude ?? null,
    longitude: location2?.longitude ?? null,
    locationSource: location2?.locationSource ?? "legacy",
    locationKey: location2?.locationKey ?? null,
    locationExpiresAt: location2?.locationExpiresAt ? new Date(location2.locationExpiresAt).toISOString() : null,
    locationAddressSource: location2?.locationAddressSource ?? "user"
  };
}
function AddressLocationFields({ newService, setNewService, addressIssue, coordinateIssue, onBusyChange }) {
  const { t, i18n } = useTranslation41();
  const language = i18n.resolvedLanguage || i18n.language;
  const countryNames = new Intl.DisplayNames([language], { type: "region" });
  const currencyNames = new Intl.DisplayNames([language], { type: "currency" });
  const { toast: toast2 } = useToast();
  const [busy, setBusy] = useState29(false);
  const [feedback, setFeedback] = useState29("");
  const [manualOpen, setManualOpen] = useState29(newService.locationSource === "manual");
  const pending = useRef19(null);
  useEffect23(() => () => pending.current?.abort(), []);
  useEffect23(() => {
    if (coordinateIssue) setManualOpen(true);
  }, [coordinateIssue]);
  useEffect23(() => {
    const timer = setInterval(() => setNewService((prev) => {
      const location2 = currentLocation(prev);
      return location2 === prev ? prev : { ...location2, address: location2.address ?? "" };
    }), 6e4);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    return () => clearInterval(timer);
  }, [setNewService]);
  const updateBusy = (next) => {
    setBusy(next);
    onBusyChange?.(next);
  };
  const cancel = () => {
    pending.current?.abort();
    pending.current = null;
    updateBusy(false);
  };
  const verified = validCoordinates(newService.latitude, newService.longitude) && (newService.locationSource === "manual" || newService.locationSource === "google" && !!newService.locationExpiresAt && Date.parse(newService.locationExpiresAt) > Date.now());
  const verify = async () => {
    if (pending.current || verified) return;
    if (addressError(newService.address)) {
      setFeedback("addressForm.addressInvalid");
      return;
    }
    const controller = new AbortController(), address = newService.address;
    pending.current = controller;
    updateBusy(true);
    setFeedback("");
    try {
      const response = await apiRequest("POST", "/api/geocode", { address }, controller.signal);
      const data = await response.json();
      if (controller.signal.aborted || pending.current !== controller) return;
      setNewService((prev) => normalizeAddress(prev.address) !== normalizeAddress(address) ? prev : {
        ...prev,
        latitude: data.latitude,
        longitude: data.longitude,
        locationSource: data.locationSource,
        locationKey: data.locationKey,
        locationExpiresAt: data.locationExpiresAt,
        locationAddressSource: "user"
      });
      setFeedback("");
      toast2({ title: t("addressForm.locationSet") });
    } catch {
      if (controller.signal.aborted) return;
      setFeedback("addressForm.verifyError");
      setManualOpen(true);
      toast2({ title: t("addressForm.verifyError"), variant: "destructive" });
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        updateBusy(false);
      }
    }
  };
  const addressErrorText = addressIssue || (feedback === "addressForm.addressInvalid" ? t(feedback) : "");
  return /* @__PURE__ */ jsxs50("section", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs50("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx64(Label, { htmlFor: "address-country", children: t("currency.country") }),
      /* @__PURE__ */ jsxs50(
        "select",
        {
          id: "address-country",
          autoComplete: "country",
          className: "w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base",
          value: newService.countryCode ?? "",
          "aria-describedby": "address-country-help",
          onChange: (event) => setNewService((prev) => ({ ...prev, countryCode: event.target.value || null })),
          children: [
            /* @__PURE__ */ jsx64("option", { value: "", children: t("currency.countryUnknown") }),
            SUPPORTED_COUNTRIES.map((code) => /* @__PURE__ */ jsx64("option", { value: code, children: countryNames.of(code) || code }, code))
          ]
        }
      ),
      /* @__PURE__ */ jsx64("p", { id: "address-country-help", className: "text-sm text-muted-foreground", children: t("currency.countryHelp") })
    ] }),
    /* @__PURE__ */ jsxs50("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx64(Label, { htmlFor: "address-pricing-currency", children: t("currency.locationOverride") }),
      /* @__PURE__ */ jsxs50(
        "select",
        {
          id: "address-pricing-currency",
          className: "w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base",
          value: newService.pricingCurrency ?? "",
          "aria-describedby": "address-pricing-currency-help",
          onChange: (event) => setNewService((prev) => ({ ...prev, pricingCurrency: event.target.value || null })),
          children: [
            /* @__PURE__ */ jsx64("option", { value: "", children: t("currency.useWorkspaceDefault") }),
            SUPPORTED_CURRENCIES.map((code) => /* @__PURE__ */ jsxs50("option", { value: code, children: [
              code,
              " \u2014 ",
              currencyNames.of(code) || code
            ] }, code))
          ]
        }
      ),
      /* @__PURE__ */ jsx64("p", { id: "address-pricing-currency-help", className: "text-sm text-muted-foreground", children: t("currency.locationOverrideHelp") })
    ] }),
    /* @__PURE__ */ jsxs50("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs50(Label, { htmlFor: "address", children: [
        t("addressForm.address"),
        " *"
      ] }),
      /* @__PURE__ */ jsxs50("div", { className: "grid sm:grid-cols-[minmax(0,1fr)_auto] gap-3", children: [
        /* @__PURE__ */ jsx64(
          Input,
          {
            id: "address",
            dir: "auto",
            autoComplete: "street-address",
            value: newService.address,
            maxLength: 500,
            "aria-invalid": Boolean(addressErrorText) || void 0,
            "aria-describedby": "address-help address-status" + (addressErrorText ? " address-error" : ""),
            onChange: (event) => {
              const address = event.target.value;
              setFeedback("");
              if (normalizeAddress(address) === normalizeAddress(newService.address)) {
                setNewService((prev) => ({ ...prev, address }));
                return;
              }
              cancel();
              setNewService((prev) => ({
                ...prev,
                address,
                latitude: null,
                longitude: null,
                locationSource: "legacy",
                locationKey: null,
                locationExpiresAt: null,
                locationAddressSource: "user"
              }));
            },
            "data-testid": "input-address"
          }
        ),
        /* @__PURE__ */ jsx64(Button, { type: "button", variant: "outline", disabled: busy || verified, onClick: verify, "data-testid": "button-verify-address", children: t(busy ? "addressForm.verifying" : verified ? "addressForm.locationSet" : "addressForm.verify") })
      ] }),
      /* @__PURE__ */ jsx64("p", { id: "address-help", className: "text-sm text-muted-foreground", children: t("addressForm.verifyHelp") }),
      /* @__PURE__ */ jsx64("p", { id: "address-status", role: "status", "aria-live": "polite", className: "text-sm font-medium", children: t(busy ? "addressForm.verifying" : verified ? "addressForm.locationSet" : "addressForm.needsVerification") }),
      addressErrorText && /* @__PURE__ */ jsx64("p", { id: "address-error", role: "alert", className: "text-sm text-red-700 dark:text-red-300", children: addressErrorText }),
      feedback === "addressForm.verifyError" && /* @__PURE__ */ jsx64("p", { role: "alert", className: "text-sm text-red-700 dark:text-red-300", children: t(feedback) })
    ] }),
    /* @__PURE__ */ jsxs50("details", { open: manualOpen, onToggle: (event) => setManualOpen(event.currentTarget.open), className: "border rounded-lg p-3", children: [
      /* @__PURE__ */ jsx64("summary", { className: "cursor-pointer min-h-11 py-2 font-medium", children: t("addressForm.useCoordinates") }),
      /* @__PURE__ */ jsx64("p", { id: "address-coordinate-help", className: "text-sm text-muted-foreground my-3", children: t("addressForm.coordinateHelp") }),
      /* @__PURE__ */ jsx64("div", { className: "grid sm:grid-cols-2 gap-4", children: ["latitude", "longitude"].map((field) => /* @__PURE__ */ jsxs50("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx64(Label, { htmlFor: field, children: t(field === "latitude" ? "addressForm.latitude" : "addressForm.longitude") }),
        /* @__PURE__ */ jsx64(
          Input,
          {
            id: field,
            type: "number",
            step: "any",
            min: field === "latitude" ? -90 : -180,
            max: field === "latitude" ? 90 : 180,
            value: newService[field] ?? "",
            "aria-invalid": Boolean(coordinateIssue) || void 0,
            "aria-describedby": "address-coordinate-help" + (coordinateIssue ? " address-coordinates-error" : ""),
            onChange: (event) => {
              cancel();
              setFeedback("");
              const value = event.target.value === "" ? null : Number(event.target.value);
              setNewService((prev) => ({
                ...prev,
                ...prev.locationSource !== "manual" ? { latitude: null, longitude: null } : {},
                [field]: value,
                locationSource: "manual",
                locationKey: null,
                locationExpiresAt: null,
                locationAddressSource: "user"
              }));
            },
            "data-testid": `input-${field}`
          }
        )
      ] }, field)) }),
      coordinateIssue && /* @__PURE__ */ jsx64("p", { id: "address-coordinates-error", role: "alert", className: "text-sm text-red-700 dark:text-red-300 mt-3", children: coordinateIssue })
    ] }),
    validCoordinates(newService.latitude, newService.longitude) && /* @__PURE__ */ jsx64("p", { className: "text-sm text-muted-foreground", children: t("addressForm.coordinatesSet", { latitude: new Intl.NumberFormat(language, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(newService.latitude), longitude: new Intl.NumberFormat(language, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(newService.longitude) }) }),
    newService.locationSource === "google" && newService.locationExpiresAt && /* @__PURE__ */ jsxs50("p", { className: "text-sm text-muted-foreground", children: [
      /* @__PURE__ */ jsx64("bdi", { translate: "no", children: "Google Maps" }),
      " \xB7 ",
      t("addressForm.expires", { date: new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(new Date(newService.locationExpiresAt)) })
    ] })
  ] });
}
var init_address_location_fields = __esm({
  "client/src/components/address-location-fields.tsx"() {
    "use strict";
    init_locations();
    init_input();
    init_label();
    init_button();
    init_queryClient();
    init_use_toast();
    init_currencies();
  }
});

// client/src/components/account-addresses.tsx
import { Fragment as Fragment18, useEffect as useEffect24, useRef as useRef20, useState as useState30 } from "react";
import { useTranslation as useTranslation42 } from "react-i18next";
import { useMutation as useMutation13, useQuery as useQuery19, useQueryClient as useQueryClient15 } from "@tanstack/react-query";
import { Fragment as Fragment19, jsx as jsx65, jsxs as jsxs51 } from "react/jsx-runtime";
function AddressForm({ address, onClose }) {
  const { t, i18n } = useTranslation42();
  const client = useQueryClient15();
  const [draft, setDraft] = useState30(() => createLocationDraft(address));
  const [error, setError] = useState30("");
  const [addressIssue, setAddressIssue] = useState30(false);
  const [coordinateIssue, setCoordinateIssue] = useState30(false);
  const [discarding, setDiscarding] = useState30(false);
  const [verifying, setVerifying] = useState30(false);
  const cancelTrigger = useRef20(null);
  const form = useRef20(null);
  const submitting = useRef20(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(createLocationDraft(address));
  const save = useMutation13({
    mutationFn: async () => (await apiRequest(address ? "PATCH" : "POST", address ? `/api/addresses/${address.id}` : "/api/addresses", draft)).json(),
    onSuccess: async (saved2) => {
      await client.invalidateQueries();
      onClose(saved2);
    },
    onError: (error2) => setError(/^403:/.test(error2.message) ? "addressForm.denied" : "addressForm.saveError"),
    onSettled: () => {
      submitting.current = false;
    }
  });
  return /* @__PURE__ */ jsxs51("form", { ref: form, className: "space-y-4 border rounded-xl p-4", noValidate: true, "aria-busy": save.isPending, onSubmit: (event) => {
    event.preventDefault();
    if (submitting.current || verifying) return;
    const invalidAddress = Boolean(addressError(draft.address)), invalidCoordinates = !validCoordinates(draft.latitude, draft.longitude);
    setAddressIssue(invalidAddress);
    setCoordinateIssue(invalidCoordinates);
    if (invalidAddress || invalidCoordinates) {
      queueMicrotask(() => form.current?.querySelector(invalidAddress ? "#address" : "#latitude")?.focus());
      return;
    }
    setError("");
    submitting.current = true;
    save.mutate();
  }, children: [
    /* @__PURE__ */ jsx65("h3", { className: "font-semibold", children: t(address ? "addressForm.edit" : "addressForm.add") }),
    /* @__PURE__ */ jsx65("p", { className: "text-sm text-muted-foreground", children: t("addressForm.steps") }),
    /* @__PURE__ */ jsx65("fieldset", { disabled: save.isPending, className: "min-w-0", children: /* @__PURE__ */ jsx65(
      AddressLocationFields,
      {
        newService: draft,
        setNewService: setDraft,
        addressIssue: addressIssue ? t("addressForm.addressInvalid") : void 0,
        coordinateIssue: coordinateIssue ? t("addressForm.coordinateInvalid") : void 0,
        onBusyChange: setVerifying
      }
    ) }),
    address && /* @__PURE__ */ jsx65("p", { className: "text-sm text-muted-foreground", children: t("addressForm.sharedWarning") }),
    error && /* @__PURE__ */ jsx65("p", { role: "alert", className: "text-sm text-red-700 dark:text-red-300", children: t(error) }),
    /* @__PURE__ */ jsxs51("div", { className: "grid sm:grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsx65(Button, { type: "submit", disabled: save.isPending || verifying, children: t(save.isPending ? "accountForm.saving" : "addressForm.save") }),
      /* @__PURE__ */ jsx65(Button, { ref: cancelTrigger, type: "button", variant: "outline", disabled: save.isPending, onClick: () => dirty ? setDiscarding(true) : onClose(), children: t("common.cancel") })
    ] }),
    /* @__PURE__ */ jsx65(AlertDialog, { open: discarding, onOpenChange: setDiscarding, children: /* @__PURE__ */ jsxs51(AlertDialogContent, { dir: i18n.dir(), className: dialogClass2, onCloseAutoFocus: (event) => {
      event.preventDefault();
      cancelTrigger.current?.focus();
    }, children: [
      /* @__PURE__ */ jsxs51(AlertDialogHeader, { className: "text-start sm:text-start", children: [
        /* @__PURE__ */ jsx65(AlertDialogTitle, { children: t("serviceForm.discardTitle") }),
        /* @__PURE__ */ jsx65(AlertDialogDescription, { children: t("addressForm.discardHelp") })
      ] }),
      /* @__PURE__ */ jsxs51(AlertDialogFooter, { className: "gap-2 sm:space-x-0", children: [
        /* @__PURE__ */ jsx65(AlertDialogCancel, { children: t("serviceForm.keepEditing") }),
        /* @__PURE__ */ jsx65(AlertDialogAction, { onClick: () => onClose(), children: t("serviceForm.discard") })
      ] })
    ] }) })
  ] });
}
function AccountAddresses() {
  const { t, i18n } = useTranslation42();
  const client = useQueryClient15();
  const context2 = useQuery19({ queryKey: ["/api/company/context"] });
  const allowed = Boolean(context2.data?.permissions?.manageServices);
  const addresses = useQuery19({ queryKey: ["/api/addresses"], enabled: allowed });
  const [editing, setEditing] = useState30(null);
  const [removing, setRemoving] = useState30(null);
  const [savedId, setSavedId] = useState30(null);
  const list = useRef20(null);
  const addButton = useRef20(null);
  const editTrigger = useRef20(null);
  useEffect24(() => {
    if (editing) return;
    if (savedId !== null) list.current?.querySelector(`[data-address-id="${savedId}"]`)?.focus();
    else (editTrigger.current?.isConnected ? editTrigger.current : addButton.current)?.focus();
  }, [editing, savedId]);
  const remove = useMutation13({
    mutationFn: (id) => apiRequest("DELETE", `/api/addresses/${id}`),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["/api/addresses"] });
      setRemoving(null);
      addButton.current?.focus();
    }
  });
  const companyParts = context2.data?.company ? t("addressForm.companyHelp", { name: "\uFFFC" }).split("\uFFFC") : null;
  const removeParts = t("addressForm.removeHelp", { address: "\uFFFC" }).split("\uFFFC");
  return /* @__PURE__ */ jsxs51(Card, { id: "addresses", className: "scroll-mt-6", "aria-labelledby": "account-addresses-title", children: [
    /* @__PURE__ */ jsxs51(CardHeader, { children: [
      /* @__PURE__ */ jsx65("h2", { className: "text-lg font-semibold", id: "account-addresses-title", children: t("addressForm.title") }),
      /* @__PURE__ */ jsx65(CardDescription, { children: companyParts ? companyParts.map((part, index) => /* @__PURE__ */ jsxs51(Fragment18, { children: [
        index > 0 && /* @__PURE__ */ jsx65("bdi", { children: context2.data?.company?.name }),
        part
      ] }, index)) : t("addressForm.personalHelp") })
    ] }),
    /* @__PURE__ */ jsxs51(CardContent, { className: "space-y-4", children: [
      context2.isLoading ? /* @__PURE__ */ jsx65("p", { role: "status", children: t("addressForm.workspaceLoading") }) : context2.isError ? /* @__PURE__ */ jsx65("p", { role: "alert", children: t("addressForm.workspaceError") }) : !allowed ? /* @__PURE__ */ jsx65("p", { children: t("addressForm.denied") }) : /* @__PURE__ */ jsxs51(Fragment19, { children: [
        addresses.isLoading && /* @__PURE__ */ jsx65("p", { role: "status", children: t("serviceForm.addressesLoading") }),
        addresses.isError && /* @__PURE__ */ jsxs51("p", { role: "alert", children: [
          t("addressForm.loadError"),
          " ",
          /* @__PURE__ */ jsx65("button", { type: "button", className: "underline min-h-11 py-2", onClick: () => void addresses.refetch(), children: t("publicSearch.retry") })
        ] }),
        addresses.data?.length === 0 && /* @__PURE__ */ jsx65("p", { className: "text-sm text-muted-foreground", children: t("addressForm.empty") }),
        savedId !== null && !editing && /* @__PURE__ */ jsx65("p", { role: "status", children: t("addressForm.saved") }),
        /* @__PURE__ */ jsx65("ul", { ref: list, className: "space-y-3", children: addresses.data?.map((address) => /* @__PURE__ */ jsxs51("li", { tabIndex: -1, "data-address-id": address.id, className: "border rounded-lg p-4 space-y-3 focus:outline focus:outline-2 focus:outline-offset-2", children: [
          /* @__PURE__ */ jsx65("p", { className: "break-words", children: /* @__PURE__ */ jsx65("bdi", { children: address.address || t("serviceForm.addressNeedsUpdate") }) }),
          address.locationSource === "google" && !validCoordinates(address.latitude, address.longitude) && /* @__PURE__ */ jsx65("p", { className: "text-sm text-muted-foreground", children: t("addressForm.expired") }),
          /* @__PURE__ */ jsxs51("div", { className: "flex flex-wrap gap-3", children: [
            /* @__PURE__ */ jsx65(Button, { type: "button", variant: "outline", disabled: editing !== null || remove.isPending, onClick: (event) => {
              editTrigger.current = event.currentTarget;
              remove.reset();
              setSavedId(null);
              setEditing(address);
            }, children: t("common.edit") }),
            /* @__PURE__ */ jsx65(Button, { type: "button", variant: "outline", disabled: editing !== null || remove.isPending, onClick: (event) => {
              editTrigger.current = event.currentTarget;
              remove.reset();
              setRemoving(address);
            }, children: t("storefront.remove") })
          ] })
        ] }, address.id)) }),
        editing ? /* @__PURE__ */ jsx65(AddressForm, { address: editing === "new" ? void 0 : editing, onClose: (saved2) => {
          setSavedId(saved2?.id ?? null);
          setEditing(null);
        } }, editing === "new" ? "new" : editing.id) : /* @__PURE__ */ jsx65(Button, { ref: addButton, type: "button", disabled: remove.isPending, onClick: (event) => {
          editTrigger.current = event.currentTarget;
          remove.reset();
          setSavedId(null);
          setEditing("new");
        }, children: t("addressForm.add") })
      ] }),
      /* @__PURE__ */ jsx65(AlertDialog, { open: Boolean(removing), onOpenChange: (open) => {
        if (!open && !remove.isPending) setRemoving(null);
      }, children: /* @__PURE__ */ jsxs51(AlertDialogContent, { dir: i18n.dir(), className: dialogClass2, onEscapeKeyDown: (event) => {
        if (remove.isPending) event.preventDefault();
      }, onCloseAutoFocus: (event) => {
        event.preventDefault();
        (editTrigger.current?.isConnected ? editTrigger.current : addButton.current)?.focus();
      }, children: [
        /* @__PURE__ */ jsxs51(AlertDialogHeader, { className: "text-start sm:text-start", children: [
          /* @__PURE__ */ jsx65(AlertDialogTitle, { children: t("addressForm.removeTitle") }),
          /* @__PURE__ */ jsx65(AlertDialogDescription, { children: removeParts.map((part, index) => /* @__PURE__ */ jsxs51(Fragment18, { children: [
            index > 0 && /* @__PURE__ */ jsx65("bdi", { children: removing?.address }),
            part
          ] }, index)) })
        ] }),
        remove.isError && /* @__PURE__ */ jsx65("p", { role: "alert", className: "text-sm text-red-700 dark:text-red-300", children: t("addressForm.removeError") }),
        /* @__PURE__ */ jsxs51(AlertDialogFooter, { className: "gap-2 sm:space-x-0", children: [
          /* @__PURE__ */ jsx65(AlertDialogCancel, { disabled: remove.isPending, children: t("common.cancel") }),
          /* @__PURE__ */ jsx65(Button, { disabled: remove.isPending, onClick: () => {
            if (removing && !remove.isPending) remove.mutate(removing.id);
          }, children: t(remove.isPending ? "addressForm.removing" : "storefront.remove") })
        ] })
      ] }) })
    ] })
  ] });
}
var dialogClass2;
var init_account_addresses = __esm({
  "client/src/components/account-addresses.tsx"() {
    "use strict";
    init_locations();
    init_queryClient();
    init_address_location_fields();
    init_button();
    init_card();
    init_alert_dialog();
    dialogClass2 = "phase2-form max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl";
  }
});

// client/src/pages/provider/settings.tsx
import { Link as Link17, Route, Switch as Switch2, useLocation as useLocation6 } from "wouter";
import { useIsMutating as useIsMutating4 } from "@tanstack/react-query";
import { useTranslation as useTranslation43 } from "react-i18next";
import { jsx as jsx66, jsxs as jsxs52 } from "react/jsx-runtime";
function SettingsPage() {
  const { t } = useTranslation43();
  const { user: user2 } = useAuth();
  const { data: context2 } = useProviderWorkspace();
  const employees = useProviderEmployees();
  const [location2] = useLocation6();
  const { subscriptionTransport } = useBillingRuntime();
  const switchingWorkspace = useIsMutating4({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  if (!user2 || !context2) return /* @__PURE__ */ jsx66("p", { role: "status", children: t("providerSettings.loading") });
  const canViewTeam = Boolean(context2.company && (context2.permissions.manageTeam || context2.permissions.isOwner));
  return /* @__PURE__ */ jsxs52("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxs52("div", { children: [
      /* @__PURE__ */ jsx66("h1", { className: "text-2xl font-semibold", children: t("mobileNavigation.settings") }),
      /* @__PURE__ */ jsx66("p", { className: "mt-1 text-neutral-600", children: t("providerSettings.description") })
    ] }),
    /* @__PURE__ */ jsxs52("nav", { "aria-label": t("providerSettings.sections"), className: "flex flex-wrap gap-2 [&_a]:min-h-11 [&_a]:h-auto [&_a]:whitespace-normal", children: [
      context2.permissions.manageServices && /* @__PURE__ */ jsx66(Button, { asChild: true, variant: location2 === "/my-services/settings" ? "default" : "outline", children: /* @__PURE__ */ jsx66(Link17, { href: "/my-services/settings", "aria-current": location2 === "/my-services/settings" ? "page" : void 0, children: t("providerSettings.profileTab") }) }),
      canViewTeam && /* @__PURE__ */ jsx66(Button, { asChild: true, variant: location2 === "/my-services/settings/team" ? "default" : "outline", children: /* @__PURE__ */ jsx66(Link17, { href: "/my-services/settings/team", "aria-current": location2 === "/my-services/settings/team" ? "page" : void 0, children: t("providerSettings.teamTab") }) }),
      context2.permissions.manageServices && /* @__PURE__ */ jsx66(Button, { asChild: true, variant: location2 === "/my-services/settings/storefront" ? "default" : "outline", children: /* @__PURE__ */ jsx66(Link17, { href: "/my-services/settings/storefront", "aria-current": location2 === "/my-services/settings/storefront" ? "page" : void 0, children: t("storefront.title") }) }),
      context2.permissions.manageServices && [
        { path: "/my-services/settings/pricing", label: "pricingSettings.title" },
        { path: "/my-services/settings/addresses", label: "addressForm.title" }
      ].map((item) => /* @__PURE__ */ jsx66(Button, { asChild: true, variant: location2 === item.path ? "default" : "outline", className: "min-h-11 h-auto whitespace-normal", children: /* @__PURE__ */ jsx66(Link17, { href: item.path, "aria-current": location2 === item.path ? "page" : void 0, children: t(item.label) }) }, item.path)),
      /* @__PURE__ */ jsx66(Button, { asChild: true, variant: location2 === "/my-services/settings/billing" ? "default" : "outline", children: /* @__PURE__ */ jsx66(Link17, { href: "/my-services/settings/billing", "aria-current": location2 === "/my-services/settings/billing" ? "page" : void 0, children: t("monthlyBilling.title") }) })
    ] }),
    /* @__PURE__ */ jsxs52(Switch2, { children: [
      /* @__PURE__ */ jsx66(Route, { path: "/my-services/settings/pricing", children: context2.permissions.manageServices ? /* @__PURE__ */ jsx66(AccountPricingSettings, { actorId: user2.id }, `pricing-${user2.id}:${context2.company?.id ?? "personal"}`) : /* @__PURE__ */ jsx66("p", { role: "alert", children: t("pricingSettings.denied") }) }),
      /* @__PURE__ */ jsx66(Route, { path: "/my-services/settings/addresses", children: context2.permissions.manageServices ? /* @__PURE__ */ jsx66(AccountAddresses, {}, `addresses-${user2.id}:${context2.company?.id ?? "personal"}`) : /* @__PURE__ */ jsx66("p", { role: "alert", children: t("addressForm.denied") }) }),
      /* @__PURE__ */ jsx66(Route, { path: "/my-services/settings/billing", children: /* @__PURE__ */ jsx66(MonthlyBillingPanel, { actorId: user2.id, target: context2.company ? { kind: "company", id: context2.company.id } : { kind: "user", id: user2.id }, transport: switchingWorkspace ? void 0 : subscriptionTransport, returned: new URLSearchParams(window.location.search).get("billing_return") === "1" }) }),
      /* @__PURE__ */ jsx66(Route, { path: "/my-services/settings/storefront", children: context2.permissions.manageServices ? /* @__PURE__ */ jsx66(StorefrontEditor, { context: context2 }) : /* @__PURE__ */ jsx66("p", { role: "alert", children: t("storefront.denied") }) }),
      /* @__PURE__ */ jsx66(Route, { path: "/my-services/settings/team", children: canViewTeam ? employees.isLoading ? /* @__PURE__ */ jsx66("p", { role: "status", children: t("providerSettings.loadingEmployees") }) : employees.isError ? /* @__PURE__ */ jsx66("p", { role: "alert", children: t("providerSettings.loadEmployeesError") }) : /* @__PURE__ */ jsx66(CompanyTeam, { context: context2, employees: employees.data ?? [] }) : /* @__PURE__ */ jsx66("p", { role: "alert", children: t("providerSettings.teamDenied") }) }),
      /* @__PURE__ */ jsx66(Route, { path: "/my-services/settings", children: context2.permissions.manageServices ? /* @__PURE__ */ jsx66(ProviderProfile, { user: { ...user2, providerType: context2.company ? "company" : "individual", companyName: context2.company?.name ?? null } }) : canViewTeam ? /* @__PURE__ */ jsx66("p", { children: t("providerSettings.teamHint") }) : /* @__PURE__ */ jsx66("p", { role: "alert", children: t("providerSettings.denied") }) }),
      /* @__PURE__ */ jsx66(Route, { children: /* @__PURE__ */ jsx66("p", { role: "alert", children: t("providerSettings.notFound") }) })
    ] })
  ] });
}
var init_settings = __esm({
  "client/src/pages/provider/settings.tsx"() {
    "use strict";
    init_useAuth();
    init_use_provider_workspace();
    init_provider_profile();
    init_company_team();
    init_button();
    init_storefront_editor();
    init_monthly_billing_panel();
    init_billing_runtime();
    init_account_pricing_settings();
    init_account_addresses();
  }
});

// client/src/lib/service-report.ts
function matchesReportEmployee(employeeId, filter) {
  return filter === "all" || (filter === "unassigned" ? employeeId == null : employeeId === Number(filter));
}
function reportEmployees(bookings, employees) {
  const names = /* @__PURE__ */ new Map();
  for (const employee of employees) names.set(employee.id, employee.name);
  for (const booking of bookings) if (booking.employeeId != null && !names.has(booking.employeeId)) names.set(booking.employeeId, booking.employee?.name ?? null);
  return Array.from(names, ([id, name]) => ({ id, name })).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "") || a.id - b.id);
}
function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function presetPeriod(preset, now = /* @__PURE__ */ new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  else start.setDate(1);
  const end = new Date(start);
  if (preset === "week") end.setDate(end.getDate() + 6);
  else {
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
  }
  return { from: localDate(start), to: localDate(end) };
}
function dateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value ? date : null;
}
function validPeriod(period) {
  return !!dateInput(period.from) && !!dateInput(period.to) && period.from <= period.to;
}
function createServiceReport(bookings, period, employee = "all") {
  if (!validPeriod(period)) throw new RangeError("Invalid report period");
  const start = dateInput(period.from);
  const end = dateInput(period.to);
  end.setDate(end.getDate() + 1);
  const rows = bookings.filter((booking) => {
    const date = new Date(booking.scheduledDate);
    return date >= start && date < end && matchesReportEmployee(booking.employeeId, employee);
  }).map((booking) => ({ id: booking.id, serviceId: booking.serviceId, service: booking.service.name, employeeId: booking.employeeId ?? null, employee: booking.employee?.name ?? null, date: new Date(booking.scheduledDate), status: booking.status ?? "pending", currency: booking.currency, amount: normalizeMoneyAmount(booking.totalAmount, booking.currency) })).sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);
  const sums = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const total = sums.get(row.currency) ?? { earned: BigInt(0), planned: BigInt(0), pending: BigInt(0), lost: BigInt(0) };
    const bucket = row.status === "completed" ? "earned" : row.status === "cancelled" ? "lost" : row.status === "confirmed" ? "planned" : "pending";
    total[bucket] += amountToMinor(row.amount, row.currency);
    sums.set(row.currency, total);
  }
  return { rows, totals: Array.from(sums).sort(([a], [b]) => a.localeCompare(b)).map(([currency2, sum]) => ({ currency: currency2, earned: minorToAmount(sum.earned, currency2), planned: minorToAmount(sum.planned, currency2), pending: minorToAmount(sum.pending, currency2), lost: minorToAmount(sum.lost, currency2) })) };
}
function groupServiceReport(rows, catalog, employee = "all") {
  const groups = /* @__PURE__ */ new Map();
  const amounts = /* @__PURE__ */ new Map();
  const names = new Map(catalog.map((service2) => [service2.id, service2.name]));
  const makeGroup = (serviceId, service2, currency2) => ({
    serviceId,
    service: service2,
    currency: currency2,
    bookingCount: 0,
    completedCount: 0,
    confirmedCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    earned: minorToAmount(BigInt(0), currency2),
    planned: minorToAmount(BigInt(0), currency2),
    pending: minorToAmount(BigInt(0), currency2),
    lost: minorToAmount(BigInt(0), currency2)
  });
  const booked = /* @__PURE__ */ new Set();
  for (const row of rows) {
    if (!matchesReportEmployee(row.employeeId, employee)) continue;
    booked.add(row.serviceId);
    const key = JSON.stringify([row.serviceId, row.currency]);
    const group = groups.get(key) ?? makeGroup(row.serviceId, names.get(row.serviceId) ?? row.service, row.currency);
    const [bucket, count3] = row.status === "completed" ? ["earned", "completedCount"] : row.status === "confirmed" ? ["planned", "confirmedCount"] : row.status === "cancelled" ? ["lost", "cancelledCount"] : ["pending", "pendingCount"];
    const sum = amounts.get(key) ?? { earned: BigInt(0), planned: BigInt(0), pending: BigInt(0), lost: BigInt(0) };
    sum[bucket] += amountToMinor(row.amount, row.currency);
    amounts.set(key, sum);
    group[count3]++;
    group.bookingCount++;
    groups.set(key, group);
  }
  for (const service2 of catalog) if (!booked.has(service2.id) && matchesReportEmployee(service2.employeeId, employee)) groups.set(JSON.stringify([service2.id, service2.currency]), makeGroup(service2.id, service2.name, service2.currency));
  return sortServiceGroups(Array.from(groups, ([key, group]) => {
    const sum = amounts.get(key);
    return sum ? { ...group, earned: minorToAmount(sum.earned, group.currency), planned: minorToAmount(sum.planned, group.currency), pending: minorToAmount(sum.pending, group.currency), lost: minorToAmount(sum.lost, group.currency) } : group;
  }), "name");
}
function aggregateMinor(amount2, currency2) {
  const digits = currencyDigits(currency2), [whole, fraction = ""] = amount2.split(".");
  if (!/^\d+(?:\.\d+)?$/.test(amount2) || fraction.length > digits) throw new RangeError("Invalid report total");
  return BigInt(whole) * [BigInt(1), BigInt(10), BigInt(100), BigInt(1e3)][digits] + BigInt(fraction.padEnd(digits, "0") || "0");
}
function sortServiceGroups(groups, sort) {
  return [...groups].sort((a, b) => {
    if (sort === "earned") {
      const currency2 = a.currency.localeCompare(b.currency);
      if (currency2) return currency2;
      const difference = aggregateMinor(b.earned, b.currency) - aggregateMinor(a.earned, a.currency);
      if (difference !== BigInt(0)) return difference > BigInt(0) ? 1 : -1;
    } else if (sort === "fewest" || sort === "most") {
      const difference = (a.bookingCount - b.bookingCount) * (sort === "most" ? -1 : 1);
      if (difference) return difference;
    }
    return a.service.localeCompare(b.service) || a.serviceId - b.serviceId || a.currency.localeCompare(b.currency);
  });
}
var reportTypes;
var init_service_report = __esm({
  "client/src/lib/service-report.ts"() {
    "use strict";
    init_money2();
    init_currencies();
    reportTypes = [{ id: "services", labelKey: "reports.servicesRevenue" }, { id: "byService", labelKey: "reports.byService" }, { id: "serviceViews", labelKey: "reports.serviceViews" }];
  }
});

// client/src/components/provider/report-service-groups.tsx
import { useTranslation as useTranslation44 } from "react-i18next";
import { Fragment as Fragment20, jsx as jsx67, jsxs as jsxs53 } from "react/jsx-runtime";
function ReportServiceGroups({ groups, money }) {
  const { t, i18n } = useTranslation44();
  const count3 = (value) => new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language).format(value);
  const metrics = ["earned", "planned", "pending", "lost"];
  const statuses = ["completed", "confirmed", "pending", "cancelled"];
  const counts = (row) => /* @__PURE__ */ jsx67("dl", { className: "mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600", children: statuses.map((status) => /* @__PURE__ */ jsxs53("div", { className: "flex gap-1", children: [
    /* @__PURE__ */ jsx67("dt", { children: t(`reports.${status}`) }),
    /* @__PURE__ */ jsx67("dd", { children: count3(row[`${status}Count`]) })
  ] }, status)) });
  const name = (row) => /* @__PURE__ */ jsxs53(Fragment20, { children: [
    /* @__PURE__ */ jsx67("bdi", { children: row.service }),
    /* @__PURE__ */ jsxs53("span", { className: "mt-1 block text-xs font-normal text-slate-600", children: [
      t("reports.serviceId"),
      ": ",
      row.serviceId,
      " \xB7 ",
      row.currency
    ] }),
    !row.bookingCount && /* @__PURE__ */ jsx67("span", { className: "mt-2 block text-xs font-medium text-amber-900", children: t("reports.noBookings") })
  ] });
  if (!groups.length) return /* @__PURE__ */ jsx67("p", { className: "p-8 text-center text-slate-600", children: t("reports.noServices") });
  return /* @__PURE__ */ jsx67("div", { className: "overflow-x-auto", tabIndex: 0, role: "region", "aria-label": t("reports.results"), children: /* @__PURE__ */ jsxs53("table", { className: "w-full min-w-[900px] text-start text-sm", children: [
    /* @__PURE__ */ jsx67("caption", { className: "sr-only", children: t("reports.byService") }),
    /* @__PURE__ */ jsx67("thead", { className: "bg-slate-50 text-slate-600", children: /* @__PURE__ */ jsx67("tr", { children: ["service", "bookings", ...metrics].map((key) => /* @__PURE__ */ jsx67("th", { scope: "col", className: `px-5 py-3 font-medium ${key === "service" || key === "bookings" ? "text-start" : "text-end"}`, children: t(`reports.${key}`) }, key)) }) }),
    /* @__PURE__ */ jsx67("tbody", { className: "divide-y", children: groups.map((row) => /* @__PURE__ */ jsxs53("tr", { className: "hover:bg-slate-50", "data-report-group": true, "data-service-id": row.serviceId, "data-currency": row.currency, children: [
      /* @__PURE__ */ jsx67("th", { scope: "row", className: "max-w-xs break-words px-5 py-4 text-start font-medium", children: name(row) }),
      /* @__PURE__ */ jsxs53("td", { className: "px-5 py-4", children: [
        /* @__PURE__ */ jsx67("span", { className: "font-semibold", children: count3(row.bookingCount) }),
        counts(row)
      ] }),
      metrics.map((key) => /* @__PURE__ */ jsx67("td", { className: "whitespace-nowrap px-5 py-4 text-end font-semibold", "data-group-metric": key, children: money(row[key], row.currency) }, key))
    ] }, `${row.serviceId}:${row.currency}`)) })
  ] }) });
}
var init_report_service_groups = __esm({
  "client/src/components/provider/report-service-groups.tsx"() {
    "use strict";
  }
});

// shared/service-view-report.ts
import { z as z9 } from "zod";
function serviceViewReportWindow(now) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const first = new Date(today);
  first.setUTCDate(first.getUTCDate() - (SERVICE_VIEW_RETENTION_DAYS - 1));
  return { availableFrom: first.toISOString().slice(0, 10), availableTo: today.toISOString().slice(0, 10) };
}
function validServiceViewPeriod(from, to, now) {
  const validDay = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  const window2 = serviceViewReportWindow(now);
  return validDay(from) && validDay(to) && from <= to && from >= window2.availableFrom && to <= window2.availableTo;
}
var SERVICE_VIEW_RETENTION_DAYS, SERVICE_VIEW_REPORT_MAX_ROWS, day, instant2, count2, serviceViewEmployeeSchema, serviceViewReportQuerySchema, history, serviceViewCapabilitiesSchema, serviceViewReportRowSchema, serviceViewReportSchema;
var init_service_view_report = __esm({
  "shared/service-view-report.ts"() {
    "use strict";
    SERVICE_VIEW_RETENTION_DAYS = 90;
    SERVICE_VIEW_REPORT_MAX_ROWS = 1e4;
    day = z9.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    instant2 = z9.string().datetime();
    count2 = z9.string().regex(/^(?:0|[1-9]\d*)$/).max(30);
    serviceViewEmployeeSchema = z9.union([z9.literal("all"), z9.literal("unassigned"), z9.string().regex(/^[1-9]\d{0,9}$/).refine((value) => Number(value) <= 2147483647)]);
    serviceViewReportQuerySchema = z9.object({ from: day, to: day, employee: serviceViewEmployeeSchema.default("all") }).strict();
    history = {
      trackingEnabled: z9.boolean(),
      retentionDays: z9.literal(SERVICE_VIEW_RETENTION_DAYS),
      timezone: z9.literal("UTC"),
      availableFrom: day,
      availableTo: day,
      asOf: instant2,
      measurement: z9.literal("recorded_detail_opens"),
      historyCoverage: z9.literal("unknown"),
      captureStartedAt: z9.null()
    };
    serviceViewCapabilitiesSchema = z9.object({ ...history, hasPro: z9.boolean(), proUntil: instant2.nullable() }).strict();
    serviceViewReportRowSchema = z9.object({
      serviceId: z9.number().int().positive().max(2147483647),
      service: z9.string(),
      employeeId: z9.number().int().positive().max(2147483647).nullable(),
      employeeName: z9.string().nullable(),
      views: count2
    }).strict();
    serviceViewReportSchema = z9.object({
      ...history,
      trackingEnabled: z9.literal(true),
      from: day,
      to: day,
      employee: serviceViewEmployeeSchema,
      proUntil: instant2,
      rows: z9.array(serviceViewReportRowSchema).max(SERVICE_VIEW_REPORT_MAX_ROWS),
      totalViews: count2
    }).strict();
  }
});

// client/src/lib/service-view-statistics.ts
function activeViewPro(capabilities, now = Date.now()) {
  return capabilities?.hasPro === true && capabilities.proUntil != null && Date.parse(capabilities.proUntil) > now;
}
function viewStatisticsPeriod(capabilities, preset = "month") {
  const end = /* @__PURE__ */ new Date(`${capabilities.availableTo}T00:00:00Z`), start = new Date(end);
  if (preset === "week") start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  else start.setUTCDate(1);
  return { from: [start.toISOString().slice(0, 10), capabilities.availableFrom].sort().at(-1), to: capabilities.availableTo };
}
function allowedViewStatisticsPeriod(period, capabilities) {
  return validServiceViewPeriod(period.from, period.to, new Date(capabilities.asOf)) && period.from >= capabilities.availableFrom && period.to <= capabilities.availableTo;
}
function verifyViewStatistics(report, query) {
  if (report.from !== query.from || report.to !== query.to || report.employee !== query.employee || report.rows.reduce((sum, row) => sum + BigInt(row.views), BigInt(0)) !== BigInt(report.totalViews)) throw Error("Invalid statistics response");
  return report;
}
function rankedViewStatistics(rows) {
  return [...rows].sort((a, b) => {
    const difference = BigInt(b.views) - BigInt(a.views);
    return difference > BigInt(0) ? 1 : difference < BigInt(0) ? -1 : a.service.localeCompare(b.service) || a.serviceId - b.serviceId;
  });
}
function viewBarPercent(value, maximum) {
  return BigInt(maximum) === BigInt(0) ? 0 : Number(BigInt(value) * BigInt(1e4) / BigInt(maximum)) / 100;
}
var init_service_view_statistics = __esm({
  "client/src/lib/service-view-statistics.ts"() {
    "use strict";
    init_service_view_report();
  }
});

// client/src/lib/report-downloads.ts
var report_downloads_exports = {};
__export(report_downloads_exports, {
  downloadReport: () => downloadReport,
  reportCsv: () => reportCsv,
  reportPdf: () => reportPdf,
  reportXlsx: () => reportXlsx
});
function reportCsv(doc) {
  const cell = (value) => {
    const text2 = String(value);
    const safe = typeof value === "string" && /^[\s\uFEFF]*[=+@-]/.test(text2) ? "'" + text2 : text2;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  return new Blob(["\uFEFF", matrix(doc).map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
}
function zip(files) {
  const local = [], central = [];
  let offset = 0, directorySize = 0;
  const crc32 = (bytes) => {
    let crc = 4294967295;
    bytes.forEach((byte) => {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
    });
    return (crc ^ 4294967295) >>> 0;
  };
  for (const [name, content] of Object.entries(files)) {
    const filename = utf8(name), bytes = utf8(content), crc = crc32(bytes);
    const header = new Uint8Array(30), view2 = new DataView(header.buffer);
    view2.setUint32(0, 67324752, true);
    view2.setUint16(4, 20, true);
    view2.setUint16(6, 2048, true);
    view2.setUint16(12, 33, true);
    view2.setUint32(14, crc, true);
    view2.setUint32(18, bytes.length, true);
    view2.setUint32(22, bytes.length, true);
    view2.setUint16(26, filename.length, true);
    local.push(header, filename, bytes);
    const entry = new Uint8Array(46), v = new DataView(entry.buffer);
    v.setUint32(0, 33639248, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint16(8, 2048, true);
    v.setUint16(14, 33, true);
    v.setUint32(16, crc, true);
    v.setUint32(20, bytes.length, true);
    v.setUint32(24, bytes.length, true);
    v.setUint16(28, filename.length, true);
    v.setUint32(42, offset, true);
    central.push(entry, filename);
    directorySize += 46 + filename.length;
    offset += 30 + filename.length + bytes.length;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer), count3 = Object.keys(files).length;
  view.setUint32(0, 101010256, true);
  view.setUint16(8, count3, true);
  view.setUint16(10, count3, true);
  view.setUint32(12, directorySize, true);
  view.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function reportXlsx(doc) {
  const sheet = matrix(doc).map((row, index) => `<row r="${index + 1}">${row.map((cell, col) => `<c r="${String.fromCharCode(65 + col)}${index + 1}"${typeof cell === "number" || typeof cell === "bigint" ? `><v>${cell}</v>` : ` t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is>`}</c>`).join("")}</row>`).join("");
  return zip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="35" customWidth="1"/><col min="2" max="${Math.max(6, doc.columns.length)}" width="24" customWidth="1"/></cols><sheetData>${sheet}</sheetData></worksheet>`
  });
}
async function reportPdf(doc) {
  await document.fonts.ready;
  const objects = [[], []], pages = [];
  const add = (parts3) => {
    objects.push(parts3);
    return objects.length;
  };
  const canvas = document.createElement("canvas");
  canvas.width = 1684;
  canvas.height = 1190;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas unavailable");
  let widths = [400, 320, 250, 230, 280];
  const wrap = (text2, width) => {
    const lines = [];
    let line = "";
    for (const character of clean(text2).replace(/[\r\n]/g, " ")) {
      if (line && ctx.measureText(line + character).width > width - 24) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
    lines.push(line);
    return lines;
  };
  let y = 0;
  const drawRow = (row, header = false, wrapped) => {
    ctx.font = `${header ? "bold " : ""}22px Arial, sans-serif`;
    const cells = wrapped ?? row.map((cell, index) => wrap(String(cell), widths[index] ?? 280));
    const height = Math.max(1, ...cells.map((lines) => lines.length)) * 30 + 18;
    ctx.fillStyle = header ? "#ede9fe" : "#f8fafc";
    ctx.fillRect(60, y, 1480, height);
    ctx.fillStyle = "#172033";
    let x = 60;
    cells.forEach((lines, index) => {
      lines.forEach((line, i) => ctx.fillText(line, x + 10, y + 30 + i * 30));
      x += widths[index] ?? 280;
    });
    y += height + 4;
  };
  const startPage = () => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    y = 38;
    ctx.fillStyle = "#5b21b6";
    ctx.font = "bold 36px Arial, sans-serif";
    for (const line of wrap(doc.title, 1480)) {
      ctx.fillText(line, 60, y + 32);
      y += 44;
    }
    ctx.fillStyle = "#334155";
    ctx.font = "22px Arial, sans-serif";
    for (const line of wrap(doc.subtitle, 1480)) {
      ctx.fillText(line, 60, y + 24);
      y += 30;
    }
    y += 28;
  };
  const finishPage = () => {
    ctx.fillStyle = "#475569";
    ctx.font = "20px Arial, sans-serif";
    ctx.fillText(String(pages.length + 1), 1540, 1150);
    const image = Uint8Array.from(atob(canvas.toDataURL("image/jpeg", 0.94).split(",")[1]), (char) => char.charCodeAt(0));
    const imageId = add([`<< /Type /XObject /Subtype /Image /Width 1684 /Height 1190 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>
stream
`, image, "\nendstream"]);
    const stream = "q 842 0 0 595 0 0 cm /Im0 Do Q";
    const contentId = add([`<< /Length ${stream.length} >>
stream
${stream}
endstream`]);
    pages.push(add([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]));
  };
  startPage();
  ctx.font = "22px Arial, sans-serif";
  for (const line of wrap(doc.note, 1480)) {
    ctx.fillText(line, 60, y + 24);
    y += 30;
  }
  y += 16;
  for (const row of doc.summary) {
    if (y > 930) {
      finishPage();
      startPage();
    }
    drawRow(row);
  }
  if (doc.columns.length !== 5) widths = doc.columns.map((_, index) => 1480 * (index === 0 ? 2 : 1) / (doc.columns.length + 1));
  if (y > 930) {
    finishPage();
    startPage();
  }
  y += 20;
  drawRow(doc.columns, true);
  for (const row of doc.rows) {
    ctx.font = "22px Arial, sans-serif";
    const lines = row.map((value, index) => wrap(String(value), widths[index] ?? 280));
    for (let offset = 0; offset < Math.max(...lines.map((cell) => cell.length)); ) {
      if (y > 1e3) {
        finishPage();
        startPage();
        drawRow(doc.columns, true);
      }
      const take = Math.max(1, Math.floor((1060 - y - 18) / 30));
      drawRow([], false, lines.map((cell) => cell.slice(offset, offset + take)));
      offset += take;
    }
  }
  finishPage();
  objects[0] = ["<< /Type /Catalog /Pages 2 0 R >>"];
  objects[1] = [`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((id) => `${id} 0 R`).join(" ")}] >>`];
  const parts2 = ["%PDF-1.4\n"], offsets = [0];
  let size = utf8(String(parts2[0])).length;
  objects.forEach((object, index) => {
    offsets.push(size);
    const blob = new Blob([`${index + 1} 0 obj
`, ...object, "\nendobj\n"]);
    parts2.push(blob);
    size += blob.size;
  });
  parts2.push(`xref
0 ${objects.length + 1}
0000000000 65535 f 
${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n 
`).join("")}trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${size}
%%EOF
`);
  return new Blob(parts2, { type: "application/pdf" });
}
function downloadReport(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3e4);
}
var utf8, clean, xml, matrix;
var init_report_downloads = __esm({
  "client/src/lib/report-downloads.ts"() {
    "use strict";
    utf8 = (value) => new TextEncoder().encode(value);
    clean = (value) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
    xml = (value) => clean(String(value)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    matrix = (doc) => [[doc.title], [doc.subtitle], [doc.note], [], ...doc.summary, [], doc.columns, ...doc.rows];
  }
});

// client/src/components/provider/service-view-statistics.tsx
import { useEffect as useEffect25, useRef as useRef21, useState as useState31 } from "react";
import { useQuery as useQuery20 } from "@tanstack/react-query";
import { useTranslation as useTranslation45 } from "react-i18next";
import { Link as Link18 } from "wouter";
import { ArrowDownToLine, BarChart3 as BarChart32, Eye, List as List3, LockKeyhole as LockKeyhole2 } from "lucide-react";
import { Fragment as Fragment21, jsx as jsx68, jsxs as jsxs54 } from "react/jsx-runtime";
function ServiceViewStatistics({ scope, company: company2, canManageBilling }) {
  const { t, i18n } = useTranslation45();
  const [now, setNow] = useState31(Date.now), [denied, setDenied] = useState31(false);
  const capabilities = useQuery20({
    queryKey: ["/api/reports/service-views/capabilities", scope],
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    queryFn: async ({ signal }) => serviceViewCapabilitiesSchema.parse(await (await apiRequest("GET", "/api/reports/service-views/capabilities", void 0, signal)).json())
  });
  const pro = !denied && !capabilities.isError && activeViewPro(capabilities.data, now);
  const roster = useQuery20({
    queryKey: ["/api/provider/employees", scope, "service-view-statistics"],
    enabled: company2 && pro && !capabilities.isFetching,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/provider/employees", void 0, signal)).json()
  });
  const [period, setPeriod] = useState31(null), [employee, setEmployee] = useState31("all");
  const [result, setResult] = useState31(null), [error, setError] = useState31("");
  const [busy, setBusy] = useState31(false), [exporting, setExporting] = useState31(false), [view, setView] = useState31("list");
  const request = useRef21(null), generation = useRef21(0), alive = useRef21(true), access = useRef21(false);
  access.current = pro && capabilities.data?.trackingEnabled === true;
  useEffect25(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      request.current?.abort();
    };
  }, []);
  useEffect25(() => {
    if (capabilities.data && !period) setPeriod(viewStatisticsPeriod(capabilities.data));
  }, [capabilities.data, period]);
  useEffect25(() => {
    if (pro && capabilities.data?.trackingEnabled) return;
    generation.current++;
    request.current?.abort();
    setResult(null);
    setBusy(false);
  }, [pro, capabilities.data?.trackingEnabled]);
  useEffect25(() => {
    const until = Math.min(Date.parse(capabilities.data?.proUntil ?? ""), result ? Date.parse(result.proUntil) : Infinity);
    if (!Number.isFinite(until) || until <= Date.now()) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
      if (Date.now() >= until) {
        generation.current++;
        request.current?.abort();
        setResult(null);
        setBusy(false);
      }
      void capabilities.refetch();
    }, Math.min(Math.max(0, until - Date.now() + 1), 2147483647));
    return () => clearTimeout(timer);
  }, [capabilities.data?.proUntil, result?.proUntil, now]);
  const locale = i18n.resolvedLanguage || i18n.language;
  const count3 = (value) => new Intl.NumberFormat(locale).format(BigInt(value));
  const employeeName = (id, name) => id == null ? t("reports.unassigned") : name || roster.data?.find((item) => item.id === id)?.name || t("reports.employeeFallback", { id });
  const invalid = period && capabilities.data ? !allowedViewStatisticsPeriod(period, capabilities.data) : true;
  const runnable = pro && capabilities.data?.trackingEnabled && !capabilities.isFetching && !busy && !invalid && (!company2 || roster.isSuccess);
  const visible = pro && !capabilities.isFetching && !capabilities.isError && capabilities.data?.trackingEnabled && result && Date.parse(result.proUntil) > now ? result : null;
  const rows = visible ? rankedViewStatistics(visible.rows) : [];
  const employeeScope = (value) => value === "all" ? t("reports.allEmployees") : value === "unassigned" ? t("reports.unassigned") : employeeName(Number(value));
  const run = async () => {
    if (!runnable || !period) return;
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const fresh = await capabilities.refetch();
      if (!alive.current || current !== generation.current) return;
      if (fresh.isError || !fresh.data) throw Error("Capability unavailable");
      if (!activeViewPro(fresh.data)) {
        setDenied(true);
        return;
      }
      if (!fresh.data.trackingEnabled) {
        setError("reports.viewsUnavailable");
        return;
      }
      if (!allowedViewStatisticsPeriod(period, fresh.data)) {
        setError("reports.viewsPeriodError");
        return;
      }
      const query = { ...period, employee };
      const data = serviceViewReportSchema.parse(await (await apiRequest("GET", `/api/reports/service-views?${new URLSearchParams(query)}`, void 0, controller.signal)).json());
      if (!alive.current || controller.signal.aborted || current !== generation.current || !access.current || !activeViewPro(fresh.data) || Date.parse(data.proUntil) <= Date.now()) return;
      setResult(verifyViewStatistics(data, query));
    } catch (failure) {
      if (!alive.current || controller.signal.aborted || current !== generation.current) return;
      if (failure instanceof Error && failure.message.startsWith("403:") && failure.message.includes("pro_required")) {
        setDenied(true);
        void capabilities.refetch();
      } else setError(failure instanceof Error && failure.message.includes("tracking_unavailable") ? "reports.viewsUnavailable" : "reports.loadError");
    } finally {
      if (alive.current && current === generation.current) setBusy(false);
    }
  };
  const download = async (format3) => {
    if (!visible || exporting || !access.current || Date.parse(visible.proUntil) <= Date.now()) return;
    setExporting(true);
    setError("");
    try {
      const { reportCsv: reportCsv2, reportXlsx: reportXlsx2, reportPdf: reportPdf2, downloadReport: downloadReport2 } = await Promise.resolve().then(() => (init_report_downloads(), report_downloads_exports));
      const document2 = {
        title: t("reports.serviceViews"),
        subtitle: `${visible.from} \u2014 ${visible.to} \xB7 UTC${company2 ? ` \xB7 ${employeeScope(visible.employee)}` : ""}`,
        note: `${t("reports.viewsDefinition")} ${t("reports.viewsCoverage")}`,
        summary: [[t("reports.viewsTotal"), BigInt(visible.totalViews)]],
        columns: [t("reports.service"), t("reports.serviceId"), ...company2 ? [t("reports.employee")] : [], t("reports.viewsCount")],
        rows: rows.map((row) => [row.service, row.serviceId, ...company2 ? [employeeName(row.employeeId, row.employeeName)] : [], BigInt(row.views)])
      };
      const blob = format3 === "csv" ? reportCsv2(document2) : format3 === "xlsx" ? reportXlsx2(document2) : await reportPdf2(document2);
      if (alive.current && access.current && activeViewPro(capabilities.data) && Date.parse(visible.proUntil) > Date.now()) downloadReport2(blob, `service-views-${visible.from}-${visible.to}.${format3}`);
    } catch {
      if (alive.current) setError("reports.exportError");
    } finally {
      if (alive.current) setExporting(false);
    }
  };
  const table = () => /* @__PURE__ */ jsx68("div", { className: "max-h-[36rem] overflow-auto", tabIndex: 0, role: "region", "aria-label": t("reports.results"), children: /* @__PURE__ */ jsxs54("table", { className: "w-full min-w-[480px] text-sm", children: [
    /* @__PURE__ */ jsxs54("caption", { className: "sr-only", children: [
      t("reports.serviceViews"),
      " \xB7 UTC"
    ] }),
    /* @__PURE__ */ jsx68("thead", { className: "bg-slate-50", children: /* @__PURE__ */ jsx68("tr", { children: ["service", ...company2 ? ["employee"] : [], "viewsCount"].map((key) => /* @__PURE__ */ jsx68("th", { scope: "col", className: "px-4 py-3 text-start font-medium", children: t(`reports.${key}`) }, key)) }) }),
    /* @__PURE__ */ jsx68("tbody", { children: rows.map((row) => /* @__PURE__ */ jsxs54("tr", { className: "border-t", "data-service-view-row": true, "data-service-id": row.serviceId, children: [
      /* @__PURE__ */ jsxs54("th", { scope: "row", className: "max-w-xs break-words px-4 py-3 text-start font-medium", children: [
        /* @__PURE__ */ jsx68("bdi", { children: row.service }),
        /* @__PURE__ */ jsxs54("span", { className: "mt-1 block text-xs font-normal text-slate-600", children: [
          t("reports.serviceId"),
          ": ",
          row.serviceId
        ] })
      ] }),
      company2 && /* @__PURE__ */ jsx68("td", { className: "max-w-xs break-words px-4 py-3", children: /* @__PURE__ */ jsx68("bdi", { children: employeeName(row.employeeId, row.employeeName) }) }),
      /* @__PURE__ */ jsx68("td", { className: "px-4 py-3 font-semibold tabular-nums", "data-view-count": row.views, children: count3(row.views) })
    ] }, row.serviceId)) })
  ] }) });
  return /* @__PURE__ */ jsxs54("section", { className: "min-w-0 space-y-4", "data-testid": "service-view-statistics", children: [
    /* @__PURE__ */ jsxs54("div", { className: "rounded-2xl border bg-white p-4 sm:p-5", children: [
      /* @__PURE__ */ jsx68("h2", { className: "font-semibold", children: t("reports.serviceViews") }),
      /* @__PURE__ */ jsx68("p", { className: "mt-2 text-sm text-slate-600", children: t("reports.viewsDefinition") }),
      /* @__PURE__ */ jsx68("p", { className: "mt-2 text-xs leading-relaxed text-slate-600", children: t("reports.viewsCoverage") })
    ] }),
    capabilities.isPending ? /* @__PURE__ */ jsx68("p", { role: "status", children: t("reports.loading") }) : capabilities.isError ? /* @__PURE__ */ jsxs54("div", { role: "alert", className: "rounded-xl border bg-white p-4", children: [
      /* @__PURE__ */ jsx68("p", { children: t("reports.viewsAccessError") }),
      /* @__PURE__ */ jsx68(Button, { className: "mt-3 min-h-11", variant: "outline", onClick: () => void capabilities.refetch(), children: t("reports.retry") })
    ] }) : !pro ? /* @__PURE__ */ jsxs54("div", { className: "rounded-2xl border bg-white p-5", "data-testid": "service-views-locked", children: [
      /* @__PURE__ */ jsx68(LockKeyhole2, { "aria-hidden": "true", className: "mb-3 h-6 w-6 text-primary" }),
      /* @__PURE__ */ jsx68("h3", { className: "font-semibold", children: t("reports.viewsProRequired") }),
      /* @__PURE__ */ jsx68("p", { className: "mt-2 text-sm text-slate-600", children: t(canManageBilling ? "reports.viewsProHelp" : "reports.viewsAskOwner") }),
      /* @__PURE__ */ jsxs54("div", { className: "mt-4 flex flex-wrap gap-3", children: [
        canManageBilling && /* @__PURE__ */ jsx68(Button, { asChild: true, className: "min-h-11", children: /* @__PURE__ */ jsx68(Link18, { href: "/my-services/settings/billing", children: t("monthlyBilling.title") }) }),
        /* @__PURE__ */ jsx68(Button, { variant: "outline", className: "min-h-11", onClick: () => {
          setDenied(false);
          void capabilities.refetch();
        }, children: t("reports.retry") })
      ] })
    ] }) : !capabilities.data?.trackingEnabled ? /* @__PURE__ */ jsx68("p", { role: "status", className: "rounded-xl border bg-white p-5", children: t("reports.viewsUnavailable") }) : /* @__PURE__ */ jsxs54(Fragment21, { children: [
      /* @__PURE__ */ jsxs54("form", { className: "space-y-4 rounded-2xl border bg-white p-4 sm:p-5", onSubmit: (event) => {
        event.preventDefault();
        void run();
      }, children: [
        /* @__PURE__ */ jsx68("div", { className: "flex flex-wrap gap-2", children: ["week", "month"].map((preset) => /* @__PURE__ */ jsx68(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: busy, onClick: () => setPeriod(viewStatisticsPeriod(capabilities.data, preset)), children: t(preset === "week" ? "reports.thisWeek" : "reports.thisMonth") }, preset)) }),
        /* @__PURE__ */ jsx68("p", { className: "text-xs text-slate-600", children: t("reports.viewsWindow", { from: capabilities.data.availableFrom, to: capabilities.data.availableTo }) }),
        /* @__PURE__ */ jsxs54("div", { className: "grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end", children: [
          ["from", "to"].map((field) => /* @__PURE__ */ jsxs54("div", { className: "min-w-0 space-y-2", children: [
            /* @__PURE__ */ jsxs54(Label, { htmlFor: `view-report-${field}`, children: [
              t(`reports.${field}`),
              " (UTC)"
            ] }),
            /* @__PURE__ */ jsx68(Input, { id: `view-report-${field}`, type: "date", required: true, min: capabilities.data.availableFrom, max: capabilities.data.availableTo, value: period?.[field] ?? "", disabled: busy, "aria-invalid": invalid || void 0, "aria-describedby": invalid ? "view-period-error" : void 0, className: "min-h-11 min-w-0", onChange: (event) => setPeriod((previous) => ({ from: previous?.from ?? "", to: previous?.to ?? "", [field]: event.target.value })) })
          ] }, field)),
          /* @__PURE__ */ jsx68(Button, { type: "submit", className: "min-h-11", disabled: !runnable, "data-testid": "run-service-views", children: t("reports.show") })
        ] }),
        invalid && /* @__PURE__ */ jsx68("p", { id: "view-period-error", role: "alert", className: "text-sm text-red-700", children: t("reports.viewsPeriodError") }),
        company2 && /* @__PURE__ */ jsxs54("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx68(Label, { htmlFor: "view-report-employee", className: "block", children: t("reports.employee") }),
          /* @__PURE__ */ jsxs54("select", { id: "view-report-employee", value: employee, className: "min-h-11 w-full max-w-full rounded-lg border border-slate-500 bg-white px-3 text-sm sm:max-w-md", disabled: busy || roster.isPending || roster.isError, onChange: (event) => setEmployee(event.target.value), children: [
            /* @__PURE__ */ jsx68("option", { value: "all", children: t("reports.allEmployees") }),
            roster.data?.map((item) => /* @__PURE__ */ jsx68("option", { value: item.id, children: item.name }, item.id)),
            /* @__PURE__ */ jsx68("option", { value: "unassigned", children: t("reports.unassigned") })
          ] }),
          roster.isError && /* @__PURE__ */ jsxs54("p", { role: "alert", className: "text-sm text-red-700", children: [
            t("reports.loadError"),
            " ",
            /* @__PURE__ */ jsx68(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => void roster.refetch(), children: t("reports.retry") })
          ] }),
          /* @__PURE__ */ jsx68("p", { className: "text-xs text-slate-600", children: t("reports.viewsEmployeeHelp") })
        ] }),
        visible && period && (period.from !== visible.from || period.to !== visible.to || employee !== visible.employee) && /* @__PURE__ */ jsx68("p", { role: "status", className: "text-xs text-slate-600", children: t("reports.unapplied") })
      ] }),
      (busy || capabilities.isFetching) && /* @__PURE__ */ jsx68("p", { role: "status", children: t("reports.loading") }),
      error && /* @__PURE__ */ jsx68("p", { role: "alert", className: "rounded-xl border bg-white p-4 text-sm text-red-700", children: t(error) }),
      visible && /* @__PURE__ */ jsxs54(Fragment21, { children: [
        /* @__PURE__ */ jsxs54("section", { className: "max-w-sm rounded-xl border bg-white p-4", "aria-label": t("reports.viewsTotal"), children: [
          /* @__PURE__ */ jsxs54("div", { className: "flex items-center gap-2 text-sm text-slate-600", children: [
            /* @__PURE__ */ jsx68(Eye, { "aria-hidden": "true", className: "h-4 w-4" }),
            /* @__PURE__ */ jsx68("h3", { children: t("reports.viewsTotal") })
          ] }),
          /* @__PURE__ */ jsx68("p", { className: "mt-2 break-words text-2xl font-bold tabular-nums", "data-testid": "service-views-total", children: count3(visible.totalViews) })
        ] }),
        /* @__PURE__ */ jsxs54("section", { className: "min-w-0 overflow-hidden rounded-2xl border bg-white", children: [
          /* @__PURE__ */ jsxs54("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b p-4", children: [
            /* @__PURE__ */ jsxs54("p", { className: "min-w-0 break-words text-sm text-slate-600", children: [
              visible.from,
              " \u2014 ",
              visible.to,
              " \xB7 UTC",
              company2 && /* @__PURE__ */ jsxs54(Fragment21, { children: [
                " \xB7 ",
                /* @__PURE__ */ jsx68("bdi", { children: employeeScope(visible.employee) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs54("div", { className: "flex flex-wrap gap-2", children: [
              /* @__PURE__ */ jsx68("div", { role: "group", "aria-label": t("reports.view"), className: "flex rounded-lg border p-1", children: ["list", "graph"].map((value) => /* @__PURE__ */ jsx68(Button, { variant: view === value ? "secondary" : "ghost", size: "icon", className: "h-11 w-11", "aria-label": t(`reports.${value}`), "aria-pressed": view === value, onClick: () => setView(value), children: value === "list" ? /* @__PURE__ */ jsx68(List3, { "aria-hidden": "true", className: "h-4 w-4" }) : /* @__PURE__ */ jsx68(BarChart32, { "aria-hidden": "true", className: "h-4 w-4" }) }, value)) }),
              ["pdf", "xlsx", "csv"].map((format3) => /* @__PURE__ */ jsxs54(Button, { variant: "outline", className: "min-h-11", disabled: exporting || !rows.length, "data-testid": `views-export-${format3}`, onClick: () => void download(format3), children: [
                /* @__PURE__ */ jsx68(ArrowDownToLine, { "aria-hidden": "true", className: "me-1 h-4 w-4" }),
                format3.toUpperCase()
              ] }, format3))
            ] })
          ] }),
          !rows.length ? /* @__PURE__ */ jsx68("p", { className: "p-8 text-center text-slate-600", children: t("reports.noServices") }) : view === "list" ? table() : /* @__PURE__ */ jsxs54("div", { className: "space-y-4 p-4", children: [
            /* @__PURE__ */ jsx68("ul", { className: "max-h-[36rem] space-y-4 overflow-auto", "aria-label": t("reports.serviceViews"), "data-testid": "service-views-graph", children: rows.map((row) => /* @__PURE__ */ jsxs54("li", { className: "space-y-2", "data-view-bar": row.serviceId, children: [
              /* @__PURE__ */ jsxs54("div", { className: "flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm", children: [
                /* @__PURE__ */ jsxs54("span", { className: "min-w-0 break-words", children: [
                  /* @__PURE__ */ jsx68("bdi", { children: row.service }),
                  " ",
                  /* @__PURE__ */ jsxs54("span", { className: "text-xs text-slate-600", children: [
                    "#",
                    row.serviceId
                  ] })
                ] }),
                /* @__PURE__ */ jsx68("span", { className: "break-words font-semibold tabular-nums", "data-view-count": row.views, children: count3(row.views) })
              ] }),
              /* @__PURE__ */ jsx68("div", { className: "h-3 overflow-hidden rounded bg-primary/10", "aria-hidden": "true", children: /* @__PURE__ */ jsx68("div", { className: "h-full rounded bg-primary", style: { width: `${viewBarPercent(row.views, rows[0].views)}%` } }) })
            ] }, row.serviceId)) }),
            /* @__PURE__ */ jsxs54("details", { className: "rounded-lg border", children: [
              /* @__PURE__ */ jsx68("summary", { className: "min-h-11 cursor-pointer px-3 py-3 text-sm font-medium", children: t("reports.graphData") }),
              table()
            ] })
          ] })
        ] })
      ] })
    ] })
  ] });
}
var init_service_view_statistics2 = __esm({
  "client/src/components/provider/service-view-statistics.tsx"() {
    "use strict";
    init_service_view_report();
    init_queryClient();
    init_service_view_statistics();
    init_button();
    init_input();
    init_label();
  }
});

// client/src/components/ui/chart.tsx
import * as React16 from "react";
import * as RechartsPrimitive from "recharts";
import { Fragment as Fragment22, jsx as jsx69, jsxs as jsxs55 } from "react/jsx-runtime";
function useChart() {
  const context2 = React16.useContext(ChartContext);
  if (!context2) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context2;
}
function getPayloadConfigFromPayload(config, payload, key) {
  if (typeof payload !== "object" || payload === null) {
    return void 0;
  }
  const payloadPayload = "payload" in payload && typeof payload.payload === "object" && payload.payload !== null ? payload.payload : void 0;
  let configLabelKey = key;
  if (key in payload && typeof payload[key] === "string") {
    configLabelKey = payload[key];
  } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key] === "string") {
    configLabelKey = payloadPayload[key];
  }
  return configLabelKey in config ? config[configLabelKey] : config[key];
}
var THEMES, ChartContext, ChartContainer, ChartStyle, ChartTooltipContent, ChartLegendContent;
var init_chart = __esm({
  "client/src/components/ui/chart.tsx"() {
    "use strict";
    "use client";
    init_utils();
    THEMES = { light: "", dark: ".dark" };
    ChartContext = React16.createContext(null);
    ChartContainer = React16.forwardRef(({ id, className, children, config, ...props }, ref) => {
      const uniqueId = React16.useId();
      const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
      return /* @__PURE__ */ jsx69(ChartContext.Provider, { value: { config }, children: /* @__PURE__ */ jsxs55(
        "div",
        {
          "data-chart": chartId,
          ref,
          className: cn(
            "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
            className
          ),
          ...props,
          children: [
            /* @__PURE__ */ jsx69(ChartStyle, { id: chartId, config }),
            /* @__PURE__ */ jsx69(RechartsPrimitive.ResponsiveContainer, { children })
          ]
        }
      ) });
    });
    ChartContainer.displayName = "Chart";
    ChartStyle = ({ id, config }) => {
      const colorConfig = Object.entries(config).filter(
        ([, config2]) => config2.theme || config2.color
      );
      if (!colorConfig.length) {
        return null;
      }
      return /* @__PURE__ */ jsx69(
        "style",
        {
          dangerouslySetInnerHTML: {
            __html: Object.entries(THEMES).map(
              ([theme, prefix3]) => `
${prefix3} [data-chart=${id}] {
${colorConfig.map(([key, itemConfig]) => {
                const color = itemConfig.theme?.[theme] || itemConfig.color;
                return color ? `  --color-${key}: ${color};` : null;
              }).join("\n")}
}
`
            ).join("\n")
          }
        }
      );
    };
    ChartTooltipContent = React16.forwardRef(
      ({
        active,
        payload,
        className,
        indicator = "dot",
        hideLabel = false,
        hideIndicator = false,
        label,
        labelFormatter,
        labelClassName,
        formatter,
        color,
        nameKey,
        labelKey
      }, ref) => {
        const { config } = useChart();
        const tooltipLabel = React16.useMemo(() => {
          if (hideLabel || !payload?.length) {
            return null;
          }
          const [item] = payload;
          const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const value = !labelKey && typeof label === "string" ? config[label]?.label || label : itemConfig?.label;
          if (labelFormatter) {
            return /* @__PURE__ */ jsx69("div", { className: cn("font-medium", labelClassName), children: labelFormatter(value, payload) });
          }
          if (!value) {
            return null;
          }
          return /* @__PURE__ */ jsx69("div", { className: cn("font-medium", labelClassName), children: value });
        }, [
          label,
          labelFormatter,
          payload,
          hideLabel,
          labelClassName,
          config,
          labelKey
        ]);
        if (!active || !payload?.length) {
          return null;
        }
        const nestLabel = payload.length === 1 && indicator !== "dot";
        return /* @__PURE__ */ jsxs55(
          "div",
          {
            ref,
            className: cn(
              "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
              className
            ),
            children: [
              !nestLabel ? tooltipLabel : null,
              /* @__PURE__ */ jsx69("div", { className: "grid gap-1.5", children: payload.map((item, index) => {
                const key = `${nameKey || item.name || item.dataKey || "value"}`;
                const itemConfig = getPayloadConfigFromPayload(config, item, key);
                const indicatorColor = color || item.payload.fill || item.color;
                return /* @__PURE__ */ jsx69(
                  "div",
                  {
                    className: cn(
                      "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                      indicator === "dot" && "items-center"
                    ),
                    children: formatter && item?.value !== void 0 && item.name ? formatter(item.value, item.name, item, index, item.payload) : /* @__PURE__ */ jsxs55(Fragment22, { children: [
                      itemConfig?.icon ? /* @__PURE__ */ jsx69(itemConfig.icon, {}) : !hideIndicator && /* @__PURE__ */ jsx69(
                        "div",
                        {
                          className: cn(
                            "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                            {
                              "h-2.5 w-2.5": indicator === "dot",
                              "w-1": indicator === "line",
                              "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                              "my-0.5": nestLabel && indicator === "dashed"
                            }
                          ),
                          style: {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor
                          }
                        }
                      ),
                      /* @__PURE__ */ jsxs55(
                        "div",
                        {
                          className: cn(
                            "flex flex-1 justify-between leading-none",
                            nestLabel ? "items-end" : "items-center"
                          ),
                          children: [
                            /* @__PURE__ */ jsxs55("div", { className: "grid gap-1.5", children: [
                              nestLabel ? tooltipLabel : null,
                              /* @__PURE__ */ jsx69("span", { className: "text-muted-foreground", children: itemConfig?.label || item.name })
                            ] }),
                            item.value && /* @__PURE__ */ jsx69("span", { className: "font-mono font-medium tabular-nums text-foreground", children: item.value.toLocaleString() })
                          ]
                        }
                      )
                    ] })
                  },
                  item.dataKey
                );
              }) })
            ]
          }
        );
      }
    );
    ChartTooltipContent.displayName = "ChartTooltip";
    ChartLegendContent = React16.forwardRef(
      ({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
        const { config } = useChart();
        if (!payload?.length) {
          return null;
        }
        return /* @__PURE__ */ jsx69(
          "div",
          {
            ref,
            className: cn(
              "flex items-center justify-center gap-4",
              verticalAlign === "top" ? "pb-3" : "pt-3",
              className
            ),
            children: payload.map((item) => {
              const key = `${nameKey || item.dataKey || "value"}`;
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              return /* @__PURE__ */ jsxs55(
                "div",
                {
                  className: cn(
                    "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
                  ),
                  children: [
                    itemConfig?.icon && !hideIcon ? /* @__PURE__ */ jsx69(itemConfig.icon, {}) : /* @__PURE__ */ jsx69(
                      "div",
                      {
                        className: "h-2 w-2 shrink-0 rounded-[2px]",
                        style: {
                          backgroundColor: item.color
                        }
                      }
                    ),
                    itemConfig?.label
                  ]
                },
                item.value
              );
            })
          }
        );
      }
    );
    ChartLegendContent.displayName = "ChartLegend";
  }
});

// client/src/lib/report-graph.ts
function formatReportGraphTick(value, locale) {
  return new Intl.NumberFormat(locale, Math.abs(value) >= 1e3 ? { notation: "compact", maximumFractionDigits: 1 } : { maximumSignificantDigits: 3 }).format(value);
}
function dailyReportGraphs(rows) {
  const sums = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const date = localDate(row.date), key = JSON.stringify([row.currency, date]);
    const sum = sums.get(key) ?? { currency: row.currency, date, count: 0, earned: BigInt(0), planned: BigInt(0), pending: BigInt(0), lost: BigInt(0) };
    const metric = row.status === "completed" ? "earned" : row.status === "confirmed" ? "planned" : row.status === "cancelled" ? "lost" : "pending";
    sum[metric] += amountToMinor(row.amount, row.currency);
    sum.count++;
    sums.set(key, sum);
  }
  const panels = /* @__PURE__ */ new Map();
  for (const sum of Array.from(sums.values())) {
    const points = panels.get(sum.currency) ?? [];
    points.push({
      key: sum.date,
      date: sum.date,
      bookingCount: sum.count,
      earned: minorToAmount(sum.earned, sum.currency),
      planned: minorToAmount(sum.planned, sum.currency),
      pending: minorToAmount(sum.pending, sum.currency),
      lost: minorToAmount(sum.lost, sum.currency)
    });
    panels.set(sum.currency, points);
  }
  return Array.from(panels, ([currency2, points]) => ({ currency: currency2, points: points.sort((a, b) => a.key.localeCompare(b.key)) })).sort((a, b) => a.currency.localeCompare(b.currency));
}
function serviceReportGraphs(groups) {
  const panels = /* @__PURE__ */ new Map();
  for (const group of groups) {
    const points = panels.get(group.currency) ?? [];
    points.push({
      key: String(group.serviceId),
      serviceId: group.serviceId,
      service: group.service,
      bookingCount: group.bookingCount,
      earned: group.earned,
      planned: group.planned,
      pending: group.pending,
      lost: group.lost
    });
    panels.set(group.currency, points);
  }
  return Array.from(panels, ([currency2, points]) => ({ currency: currency2, points })).sort((a, b) => a.currency.localeCompare(b.currency));
}
var reportGraphMetrics;
var init_report_graph = __esm({
  "client/src/lib/report-graph.ts"() {
    "use strict";
    init_money2();
    init_service_report();
    reportGraphMetrics = ["earned", "planned", "pending", "lost"];
  }
});

// client/src/components/provider/report-graphs.tsx
var report_graphs_exports = {};
__export(report_graphs_exports, {
  default: () => ReportGraphs
});
import { useEffect as useEffect26, useId as useId2, useMemo as useMemo6, useRef as useRef22, useState as useState32 } from "react";
import { useTranslation as useTranslation46 } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Tooltip as Tooltip2, XAxis, YAxis } from "recharts";
import { Fragment as Fragment23, jsx as jsx70, jsxs as jsxs56 } from "react/jsx-runtime";
function StatusPattern({ id, metric }) {
  return /* @__PURE__ */ jsxs56("pattern", { id, patternUnits: "userSpaceOnUse", width: 8, height: 8, children: [
    /* @__PURE__ */ jsx70("rect", { width: 8, height: 8, fill: colors[metric] }),
    metric === "planned" && /* @__PURE__ */ jsx70("path", { d: "M-2 2L2-2M0 8L8 0M6 10L10 6", stroke: "white", strokeWidth: 1.3 }),
    metric === "pending" && /* @__PURE__ */ jsx70("circle", { cx: 4, cy: 4, r: 1.1, fill: "white" }),
    metric === "lost" && /* @__PURE__ */ jsx70("path", { d: "M0 4H8M4 0V8", stroke: "white", strokeWidth: 1 })
  ] });
}
function ReportGraphs({ rows, groups, byService }) {
  const { t } = useTranslation46();
  const panels = useMemo6(() => byService ? serviceReportGraphs(groups) : dailyReportGraphs(rows), [rows, groups, byService]);
  if (!panels.length) return /* @__PURE__ */ jsx70("p", { className: "p-8 text-center text-slate-600", role: "status", children: t(byService ? "reports.noServices" : "reports.empty") });
  return /* @__PURE__ */ jsxs56("div", { className: "space-y-5 p-3 sm:p-5", "data-testid": "report-graphs", children: [
    /* @__PURE__ */ jsxs56("p", { className: "text-sm text-slate-600", children: [
      t(byService ? "reports.serviceGraphHelp" : "reports.dailyGraphHelp"),
      " ",
      t("reports.graphHelp")
    ] }),
    panels.map((panel) => /* @__PURE__ */ jsx70(ReportGraphPanelView, { panel, byService }, panel.currency))
  ] });
}
function ReportGraphPanelView({ panel, byService }) {
  const { t, i18n } = useTranslation46();
  const id = useId2().replace(/:/g, ""), locale = i18n.resolvedLanguage || i18n.language;
  const viewport = useRef22(null), [plotWidth, setPlotWidth] = useState32(0);
  useEffect26(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver((entries) => setPlotWidth(Math.round(entries[0].contentRect.width)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const narrow = plotWidth < 520, nameLimit = narrow ? 8 : 18;
  const count3 = (value) => new Intl.NumberFormat(locale).format(value);
  const amount2 = (value) => formatMoney(value, panel.currency, locale) ?? t("currency.unavailable");
  const pointName = (point) => byService ? `${point.service} #${point.serviceId}` : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(/* @__PURE__ */ new Date(`${point.date}T12:00:00`));
  const data = panel.points.map((point) => ({
    ...point,
    label: pointName(point),
    axis: byService ? `${(point.service ?? "").slice(0, nameLimit)}${(point.service?.length ?? 0) > nameLimit ? "\u2026" : ""} #${point.serviceId} \xB7 ${count3(point.bookingCount)}` : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(/* @__PURE__ */ new Date(`${point.date}T12:00:00`)),
    earnedValue: Number(point.earned),
    plannedValue: Number(point.planned),
    pendingValue: Number(point.pending),
    lostValue: Number(point.lost)
  }));
  const compact = (value) => formatReportGraphTick(value, locale);
  const height = byService ? Math.max(300, data.length * 100 + 50) : 320;
  const config = Object.fromEntries(reportGraphMetrics.map((key) => [key, { label: t(`reports.${key}`), color: colors[key] }]));
  return /* @__PURE__ */ jsxs56("section", { className: "min-w-0 rounded-xl border bg-white p-3 sm:p-4", "aria-labelledby": `${id}-title`, "data-graph-currency": panel.currency, children: [
    /* @__PURE__ */ jsxs56("h3", { id: `${id}-title`, className: "font-semibold", children: [
      t(byService ? "reports.serviceGraph" : "reports.dailyGraph"),
      " \xB7 ",
      panel.currency
    ] }),
    /* @__PURE__ */ jsx70("ul", { className: "my-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700", "aria-label": t("reports.graphLegend"), children: reportGraphMetrics.map((key) => /* @__PURE__ */ jsxs56("li", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxs56("svg", { width: 12, height: 12, className: "shrink-0", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsx70("defs", { children: /* @__PURE__ */ jsx70(StatusPattern, { id: `${id}-legend-${key}`, metric: key }) }),
        /* @__PURE__ */ jsx70("rect", { width: 12, height: 12, rx: 2, fill: `url(#${id}-legend-${key})` })
      ] }),
      t(`reports.${key}`)
    ] }, key)) }),
    /* @__PURE__ */ jsxs56("p", { className: "mb-2 text-xs text-slate-600", children: [
      t("reports.amount"),
      " (",
      panel.currency,
      ")"
    ] }),
    /* @__PURE__ */ jsx70("div", { ref: viewport, className: "max-w-full overflow-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", style: { maxHeight: byService ? 560 : void 0 }, tabIndex: 0, role: "region", "aria-label": t("reports.graphScroll"), "data-graph-scroll": true, children: /* @__PURE__ */ jsx70("div", { style: { minWidth: !byService && data.length > 7 ? data.length * 70 + 85 : 0 }, children: /* @__PURE__ */ jsx70(ChartContainer, { config, className: "aspect-auto w-full", style: { height }, children: /* @__PURE__ */ jsxs56(BarChart, { data, layout: byService ? "vertical" : "horizontal", accessibilityLayer: true, title: `${t(byService ? "reports.serviceGraph" : "reports.dailyGraph")} ${panel.currency}`, margin: { top: 12, right: 20, bottom: 12, left: 8 }, barGap: 2, children: [
      /* @__PURE__ */ jsx70("defs", { children: reportGraphMetrics.map((key) => /* @__PURE__ */ jsx70(StatusPattern, { id: `${id}-${key}`, metric: key }, key)) }),
      /* @__PURE__ */ jsx70(CartesianGrid, { strokeDasharray: "3 3", horizontal: !byService, vertical: byService }),
      byService ? /* @__PURE__ */ jsxs56(Fragment23, { children: [
        /* @__PURE__ */ jsx70(XAxis, { type: "number", tickFormatter: compact, tick: { fontSize: 11 }, tickCount: narrow ? 3 : 5, allowDecimals: true }),
        /* @__PURE__ */ jsx70(YAxis, { type: "category", dataKey: "axis", width: narrow ? 120 : 200, tick: { fontSize: 11 }, interval: 0 })
      ] }) : /* @__PURE__ */ jsxs56(Fragment23, { children: [
        /* @__PURE__ */ jsx70(XAxis, { dataKey: "axis", tick: { fontSize: 11 }, interval: "preserveStartEnd", minTickGap: 12 }),
        /* @__PURE__ */ jsx70(YAxis, { tickFormatter: compact, width: 65, tick: { fontSize: 11 } })
      ] }),
      /* @__PURE__ */ jsx70(Tooltip2, { isAnimationActive: false, content: ({ active, payload }) => {
        const point = payload?.[0]?.payload;
        if (!active || !point) return null;
        return /* @__PURE__ */ jsxs56("div", { className: "max-w-xs rounded-lg border bg-white p-3 text-xs shadow-md", role: "status", children: [
          /* @__PURE__ */ jsx70("p", { className: "mb-2 font-semibold", children: /* @__PURE__ */ jsx70("bdi", { children: point.label }) }),
          reportGraphMetrics.map((key) => /* @__PURE__ */ jsxs56("p", { children: [
            t(`reports.${key}`),
            ": ",
            amount2(point[key])
          ] }, key)),
          /* @__PURE__ */ jsx70("p", { className: "mt-2", children: t("reports.bookingCount", { count: point.bookingCount }) })
        ] });
      } }),
      reportGraphMetrics.map((key) => /* @__PURE__ */ jsx70(Bar, { dataKey: `${key}Value`, name: t(`reports.${key}`), fill: `url(#${id}-${key})`, stroke: colors[key], maxBarSize: 24, isAnimationActive: false }, key))
    ] }) }) }) }),
    /* @__PURE__ */ jsxs56("details", { className: "mt-3 rounded-lg border", "data-graph-data": true, children: [
      /* @__PURE__ */ jsx70("summary", { className: "min-h-11 cursor-pointer rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", children: t("reports.graphData") }),
      /* @__PURE__ */ jsx70("div", { className: "max-h-96 overflow-auto", tabIndex: 0, role: "region", "aria-label": t("reports.graphData"), children: /* @__PURE__ */ jsxs56("table", { className: "w-full min-w-[700px] text-sm", children: [
        /* @__PURE__ */ jsxs56("caption", { className: "sr-only", children: [
          t("reports.graphData"),
          " \xB7 ",
          panel.currency
        ] }),
        /* @__PURE__ */ jsx70("thead", { children: /* @__PURE__ */ jsx70("tr", { children: [byService ? "service" : "date", "bookings", ...reportGraphMetrics].map((key) => /* @__PURE__ */ jsx70("th", { scope: "col", className: "px-3 py-2 text-start font-medium", children: t(`reports.${key}`) }, key)) }) }),
        /* @__PURE__ */ jsx70("tbody", { children: panel.points.map((point) => /* @__PURE__ */ jsxs56("tr", { className: "border-t", "data-graph-point": true, "data-service-id": point.serviceId, "data-date": point.date, children: [
          /* @__PURE__ */ jsxs56("th", { scope: "row", className: "max-w-xs break-words px-3 py-2 text-start font-medium", children: [
            /* @__PURE__ */ jsx70("bdi", { children: pointName(point) }),
            !point.bookingCount && /* @__PURE__ */ jsx70("span", { className: "mt-1 block text-xs text-slate-600", children: t("reports.noBookings") })
          ] }),
          /* @__PURE__ */ jsx70("td", { className: "px-3 py-2", "data-graph-count": true, children: count3(point.bookingCount) }),
          reportGraphMetrics.map((key) => /* @__PURE__ */ jsx70("td", { className: "whitespace-nowrap px-3 py-2", "data-graph-metric": key, "data-amount": point[key], children: amount2(point[key]) }, key))
        ] }, point.key)) })
      ] }) })
    ] })
  ] });
}
var colors;
var init_report_graphs = __esm({
  "client/src/components/provider/report-graphs.tsx"() {
    "use strict";
    init_chart();
    init_money();
    init_report_graph();
    colors = { earned: "#047857", planned: "#6d28d9", pending: "#b45309", lost: "#be123c" };
  }
});

// client/src/pages/provider/reports.tsx
import { lazy, Suspense, useEffect as useEffect27, useMemo as useMemo7, useRef as useRef23, useState as useState33 } from "react";
import { useIsMutating as useIsMutating5, useQuery as useQuery21 } from "@tanstack/react-query";
import { useTranslation as useTranslation47 } from "react-i18next";
import { BarChart3 as BarChart33, ArrowDownToLine as ArrowDownToLine2, CalendarDays as CalendarDays3, CheckCircle2, Clock3 as Clock32, List as List4, TrendingDown } from "lucide-react";
import { Fragment as Fragment24, jsx as jsx71, jsxs as jsxs57 } from "react/jsx-runtime";
function ReportsPage() {
  const { user: user2 } = useAuth();
  const { data: context2 } = useProviderWorkspace();
  const switching = useIsMutating5({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  if (!user2 || !context2 || switching) return null;
  const scope = JSON.stringify([user2.id, context2.company?.id ?? "personal", context2.permissions, context2.membership]);
  return /* @__PURE__ */ jsx71(ReportsShell, { scope, company: context2.company !== null, canManageBilling: !context2.company || context2.permissions.isOwner }, scope);
}
function ReportsShell({ scope, company: company2, canManageBilling }) {
  const { t } = useTranslation47();
  const [type, setType] = useState33(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("report") === "serviceViews" ? "serviceViews" : "services");
  return /* @__PURE__ */ jsxs57("div", { className: "space-y-6", "data-testid": "reports-page", children: [
    /* @__PURE__ */ jsxs57("header", { className: "flex flex-wrap items-start justify-between gap-4", children: [
      /* @__PURE__ */ jsxs57("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsx71("div", { className: "rounded-2xl bg-primary p-3 text-white", children: /* @__PURE__ */ jsx71(BarChart33, { className: "h-6 w-6", "aria-hidden": "true" }) }),
        /* @__PURE__ */ jsxs57("div", { children: [
          /* @__PURE__ */ jsx71("h1", { className: "text-2xl font-bold tracking-tight", children: t("reports.title") }),
          /* @__PURE__ */ jsx71("p", { className: "mt-1 text-sm text-slate-600", children: t("reports.subtitle") })
        ] })
      ] }),
      /* @__PURE__ */ jsxs57("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx71(Label, { htmlFor: "report-type", className: "sr-only", children: t("reports.type") }),
        /* @__PURE__ */ jsx71("select", { id: "report-type", value: type, onChange: (event) => {
          setType(event.target.value);
        }, className: "min-h-11 max-w-full rounded-xl border border-slate-500 bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary", children: reportTypes.map((type2) => /* @__PURE__ */ jsx71("option", { value: type2.id, children: t(type2.labelKey) }, type2.id)) })
      ] })
    ] }),
    type === "serviceViews" ? /* @__PURE__ */ jsx71(ServiceViewStatistics, { scope, company: company2, canManageBilling }) : /* @__PURE__ */ jsx71(ReportsContent, { scope, company: company2, type })
  ] });
}
function ReportsContent({ scope, company: company2, type }) {
  const { t, i18n } = useTranslation47();
  const bookings = useProviderBookings(scope);
  const [employee, setEmployee] = useState33("all"), [appliedEmployee, setAppliedEmployee] = useState33("all");
  const [groupSort, setGroupSort] = useState33("name");
  const employees = useQuery21({
    queryKey: ["/api/provider/employees", scope],
    enabled: company2,
    gcTime: 0,
    staleTime: 3e4,
    retry: false,
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/provider/employees", void 0, signal)).json()
  });
  const catalog = useQuery21({
    queryKey: ["/api/services/provider", scope],
    enabled: type === "byService",
    gcTime: 0,
    staleTime: 3e4,
    retry: false,
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/services/provider", void 0, signal)).json()
  });
  const [period, setPeriod] = useState33(() => presetPeriod("month"));
  const [applied, setApplied] = useState33(() => presetPeriod("month"));
  const [view, setView] = useState33("list");
  const [exporting, setExporting] = useState33(false), [exportError, setExportError] = useState33(false);
  const alive = useRef23(true);
  useEffect27(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const locale = i18n.resolvedLanguage || i18n.language;
  const report = useMemo7(() => {
    try {
      return createServiceReport(bookings.data ?? [], applied, appliedEmployee);
    } catch {
      return null;
    }
  }, [bookings.data, applied, appliedEmployee]);
  const employeeOptions = useMemo7(() => reportEmployees(bookings.data ?? [], employees.data ?? []), [bookings.data, employees.data]);
  const groups = useMemo7(() => {
    try {
      return sortServiceGroups(groupServiceReport(report?.rows ?? [], catalog.data ?? [], appliedEmployee), groupSort);
    } catch {
      return null;
    }
  }, [report, catalog.data, appliedEmployee, groupSort]);
  const totals = [...report?.totals ?? []];
  if (type === "byService") {
    for (const group of groups ?? []) if (!totals.some((total) => total.currency === group.currency)) totals.push({ currency: group.currency, earned: group.earned, planned: group.planned, pending: group.pending, lost: group.lost });
  }
  totals.sort((a, b) => a.currency.localeCompare(b.currency));
  const invalid = !validPeriod(period);
  const dirty = period.from !== applied.from || period.to !== applied.to || employee !== appliedEmployee;
  const loading = bookings.isLoading || company2 && employees.isPending || type === "byService" && catalog.isPending;
  const failed = bookings.isError || company2 && employees.isError || type === "byService" && (catalog.isError || !groups) || !report;
  const available = !loading && !failed && !!report;
  const money = (amount2, currency2) => new Intl.NumberFormat(locale, { style: "currency", currency: currency2 }).format(Number(amount2));
  const date = (value) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value);
  const status = (value) => t(`reports.${value}`);
  const employeeName = (id, name) => id == null ? t("reports.unassigned") : employeeOptions.find((option) => option.id === id)?.name || name || t("reports.employeeFallback", { id });
  const employeeScope = appliedEmployee === "all" ? t("reports.allEmployees") : appliedEmployee === "unassigned" ? t("reports.unassigned") : employeeName(Number(appliedEmployee));
  const title = t(type === "byService" ? "reports.byService" : "reports.servicesRevenue");
  const resultCount = type === "byService" ? groups?.length ?? 0 : report?.rows.length ?? 0;
  const periodLabel = `${applied.from} \u2014 ${applied.to}`;
  const exportReport = async (format3) => {
    if (!available || !report || exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const doc = {
        title,
        subtitle: `${periodLabel} \xB7 ${Intl.DateTimeFormat().resolvedOptions().timeZone}${company2 ? ` \xB7 ${employeeScope}` : ""}`,
        note: `${t("reports.definitions")}${type === "byService" ? ` ${t("reports.demandHelp")}` : ""}`,
        summary: [[t("reports.currency"), t("reports.earned"), t("reports.planned"), t("reports.pending"), t("reports.lost")], ...totals.map((total) => [total.currency, Number(total.earned), Number(total.planned), Number(total.pending), Number(total.lost)])],
        columns: type === "byService" ? [t("reports.service"), t("reports.serviceId"), t("reports.currency"), t("reports.bookings"), ...["completed", "confirmed", "pending", "cancelled"].map((value) => t("reports.statusBookings", { status: status(value) })), t("reports.earned"), t("reports.planned"), t("reports.pending"), t("reports.lost")] : [t("reports.service"), ...company2 ? [t("reports.employee")] : [], t("reports.date"), t("reports.status"), t("reports.amount"), t("reports.currency")],
        rows: type === "byService" ? (groups ?? []).map((row) => [row.service, row.serviceId, row.currency, row.bookingCount, row.completedCount, row.confirmedCount, row.pendingCount, row.cancelledCount, Number(row.earned), Number(row.planned), Number(row.pending), Number(row.lost)]) : report.rows.map((row) => [row.service, ...company2 ? [employeeName(row.employeeId, row.employee)] : [], date(row.date), status(row.status), Number(row.amount), row.currency])
      };
      const { reportCsv: reportCsv2, reportXlsx: reportXlsx2, reportPdf: reportPdf2, downloadReport: downloadReport2 } = await Promise.resolve().then(() => (init_report_downloads(), report_downloads_exports));
      const blob = format3 === "csv" ? reportCsv2(doc) : format3 === "xlsx" ? reportXlsx2(doc) : await reportPdf2(doc);
      if (alive.current) downloadReport2(blob, `${type === "byService" ? "services-summary" : "services-report"}-${applied.from}-${applied.to}.${format3}`);
    } catch {
      if (alive.current) setExportError(true);
    } finally {
      if (alive.current) setExporting(false);
    }
  };
  const presets = (preset) => {
    const next = presetPeriod(preset);
    setPeriod(next);
    setApplied(next);
    setAppliedEmployee(employee);
    setExportError(false);
  };
  const badgeClass = { completed: "bg-emerald-50 text-emerald-800", confirmed: "bg-blue-50 text-blue-800", pending: "bg-amber-50 text-amber-900", cancelled: "bg-rose-50 text-rose-800" };
  const metrics = [
    { key: "earned", icon: CheckCircle2, style: "bg-emerald-50 text-emerald-800", border: "border-emerald-100", help: "earnedHelp" },
    { key: "planned", icon: Clock32, style: "bg-violet-50 text-violet-800", border: "border-violet-100", help: "plannedHelp" },
    { key: "pending", icon: Clock32, style: "bg-amber-50 text-amber-900", border: "border-amber-100", help: "pendingHelp" },
    { key: "lost", icon: TrendingDown, style: "bg-rose-50 text-rose-800", border: "border-rose-100", help: "lostHelp" }
  ];
  return /* @__PURE__ */ jsxs57("div", { className: "space-y-6", "data-testid": "reports-financial", children: [
    /* @__PURE__ */ jsxs57("form", { className: "rounded-2xl border bg-white p-4 sm:p-5 shadow-sm", onSubmit: (event) => {
      event.preventDefault();
      if (!invalid) {
        setApplied({ ...period });
        setAppliedEmployee(employee);
        setExportError(false);
      }
    }, children: [
      /* @__PURE__ */ jsxs57("div", { className: "mb-4 flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs57("h2", { className: "flex items-center gap-2 font-semibold", children: [
          /* @__PURE__ */ jsx71(CalendarDays3, { className: "h-4 w-4 text-primary", "aria-hidden": "true" }),
          t("reports.period")
        ] }),
        /* @__PURE__ */ jsx71("div", { className: "flex flex-wrap gap-2", children: ["week", "month"].map((preset) => {
          const range = presetPeriod(preset);
          return /* @__PURE__ */ jsx71(Button, { type: "button", variant: period.from === range.from && period.to === range.to ? "secondary" : "ghost", className: "min-h-11 rounded-xl", onClick: () => presets(preset), children: t(preset === "week" ? "reports.thisWeek" : "reports.thisMonth") }, preset);
        }) })
      ] }),
      /* @__PURE__ */ jsxs57("div", { className: "grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end", children: [
        ["from", "to"].map((field) => /* @__PURE__ */ jsxs57("div", { className: "min-w-0 space-y-2", children: [
          /* @__PURE__ */ jsx71(Label, { htmlFor: `report-${field}`, children: t(`reports.${field}`) }),
          /* @__PURE__ */ jsx71(Input, { id: `report-${field}`, type: "date", required: true, value: period[field], "aria-invalid": invalid, "aria-describedby": invalid ? "report-period-error" : void 0, className: "min-h-11 w-full min-w-0 rounded-xl border-slate-500", onChange: (event) => setPeriod({ ...period, [field]: event.target.value }) })
        ] }, field)),
        /* @__PURE__ */ jsx71(Button, { type: "submit", disabled: invalid, className: "min-h-11 rounded-xl px-6", children: t("reports.show") })
      ] }),
      company2 && /* @__PURE__ */ jsxs57("div", { className: "mt-4 space-y-2", children: [
        /* @__PURE__ */ jsx71(Label, { htmlFor: "report-employee", className: "block", children: t("reports.employee") }),
        /* @__PURE__ */ jsxs57("select", { id: "report-employee", value: employee, disabled: employees.isPending || employees.isError, className: "min-h-11 w-full max-w-full rounded-xl border border-slate-500 bg-white px-3 text-sm sm:max-w-md", onChange: (event) => setEmployee(event.target.value), children: [
          /* @__PURE__ */ jsx71("option", { value: "all", children: t("reports.allEmployees") }),
          employeeOptions.map((option) => /* @__PURE__ */ jsx71("option", { value: option.id, children: employeeName(option.id, option.name) }, option.id)),
          /* @__PURE__ */ jsx71("option", { value: "unassigned", children: t("reports.unassigned") })
        ] }),
        /* @__PURE__ */ jsx71("p", { className: "text-xs text-slate-600", children: t("reports.employeeHelp") })
      ] }),
      invalid && /* @__PURE__ */ jsx71("p", { id: "report-period-error", role: "alert", className: "mt-3 text-sm text-red-700", children: t("reports.invalidPeriod") }),
      dirty && !invalid && /* @__PURE__ */ jsx71("p", { role: "status", className: "mt-3 text-sm text-slate-600", children: t("reports.unapplied") })
    ] }),
    loading ? /* @__PURE__ */ jsx71("p", { role: "status", className: "rounded-2xl bg-white p-6", children: t("reports.loading") }) : failed || !report ? /* @__PURE__ */ jsxs57("div", { role: "alert", className: "rounded-2xl border bg-white p-6", children: [
      /* @__PURE__ */ jsx71("p", { children: t("reports.loadError") }),
      /* @__PURE__ */ jsx71(Button, { variant: "outline", className: "mt-3 min-h-11", onClick: () => {
        void bookings.refetch();
        if (company2) void employees.refetch();
        if (type === "byService") void catalog.refetch();
      }, children: t("reports.retry") })
    ] }) : /* @__PURE__ */ jsxs57(Fragment24, { children: [
      /* @__PURE__ */ jsx71("div", { className: "grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4", "data-testid": "report-summary", children: metrics.map(({ key, icon: Icon2, style, border, help }) => /* @__PURE__ */ jsxs57("section", { className: `min-w-0 rounded-xl border ${border} bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5`, "data-report-summary-card": true, "aria-label": t(`reports.${key}`), children: [
        /* @__PURE__ */ jsxs57("div", { className: "flex items-center justify-between gap-2", children: [
          /* @__PURE__ */ jsx71("h2", { className: "min-w-0 text-xs font-medium leading-snug text-slate-600 sm:text-sm", children: t(`reports.${key}`) }),
          /* @__PURE__ */ jsx71("span", { className: `hidden rounded-xl p-2 sm:inline-flex ${style}`, "data-summary-icon": true, children: /* @__PURE__ */ jsx71(Icon2, { className: "h-5 w-5", "aria-hidden": "true" }) })
        ] }),
        /* @__PURE__ */ jsx71("div", { className: "mt-2 space-y-1 sm:my-3", children: totals.length ? totals.map((total) => /* @__PURE__ */ jsx71("p", { className: "break-words text-lg font-bold leading-tight tracking-tight tabular-nums sm:text-2xl", "data-testid": `total-${key}-${total.currency}`, children: money(total[key], total.currency) }, total.currency)) : /* @__PURE__ */ jsx71("p", { className: "text-lg font-bold sm:text-2xl", children: "\u2014" }) }),
        /* @__PURE__ */ jsx71("p", { className: "hidden text-xs leading-relaxed text-slate-600 sm:block", "data-summary-help": true, children: t(`reports.${help}`) })
      ] }, key)) }),
      /* @__PURE__ */ jsxs57("section", { className: "overflow-hidden rounded-2xl border bg-white shadow-sm", "aria-labelledby": "report-results-title", children: [
        /* @__PURE__ */ jsxs57("div", { className: "flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:p-5", children: [
          /* @__PURE__ */ jsxs57("div", { children: [
            /* @__PURE__ */ jsx71("h2", { id: "report-results-title", className: "font-semibold", children: title }),
            /* @__PURE__ */ jsxs57("p", { className: "mt-1 text-sm text-slate-600", children: [
              periodLabel,
              " \xB7 ",
              t("reports.bookingCount", { count: report.rows.length }),
              company2 && /* @__PURE__ */ jsxs57(Fragment24, { children: [
                " \xB7 ",
                /* @__PURE__ */ jsx71("bdi", { "data-testid": "report-employee-scope", children: employeeScope })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs57("div", { className: "flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxs57("div", { className: "flex rounded-xl border p-1", role: "group", "aria-label": t("reports.view"), children: [
              /* @__PURE__ */ jsx71(Button, { variant: view === "list" ? "secondary" : "ghost", size: "icon", className: "h-11 w-11", "aria-label": t("reports.list"), "aria-pressed": view === "list", onClick: () => setView("list"), children: /* @__PURE__ */ jsx71(List4, { "aria-hidden": "true", className: "h-4 w-4" }) }),
              /* @__PURE__ */ jsx71(Button, { variant: view === "graph" ? "secondary" : "ghost", size: "icon", className: "h-11 w-11", "aria-label": t("reports.graph"), "aria-pressed": view === "graph", onClick: () => setView("graph"), children: /* @__PURE__ */ jsx71(BarChart33, { "aria-hidden": "true", className: "h-4 w-4" }) })
            ] }),
            /* @__PURE__ */ jsx71("div", { className: "flex flex-wrap gap-1", role: "group", "aria-label": t("reports.download"), children: ["pdf", "xlsx", "csv"].map((format3) => /* @__PURE__ */ jsxs57(Button, { variant: "outline", className: "min-h-11 rounded-xl", disabled: exporting || !resultCount, onClick: () => void exportReport(format3), "data-testid": `export-${format3}`, children: [
              /* @__PURE__ */ jsx71(ArrowDownToLine2, { className: "me-1 h-4 w-4", "aria-hidden": "true" }),
              format3.toUpperCase()
            ] }, format3)) })
          ] })
        ] }),
        exporting && /* @__PURE__ */ jsx71("p", { role: "status", className: "px-5 py-3 text-sm", children: t("reports.exporting") }),
        exportError && /* @__PURE__ */ jsx71("p", { role: "alert", className: "px-5 py-3 text-sm text-red-700", children: t("reports.exportError") }),
        type === "byService" && /* @__PURE__ */ jsxs57("div", { className: "space-y-3 border-b p-4 sm:p-5", children: [
          /* @__PURE__ */ jsx71("p", { className: "text-sm text-slate-600", children: t("reports.demandHelp") }),
          /* @__PURE__ */ jsxs57("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx71(Label, { htmlFor: "report-group-sort", className: "block", children: t("reports.sort") }),
            /* @__PURE__ */ jsx71("select", { id: "report-group-sort", value: groupSort, onChange: (event) => setGroupSort(event.target.value), className: "min-h-11 w-full max-w-full rounded-xl border border-slate-500 bg-white px-3 text-sm sm:max-w-md", children: ["name", "earned", "fewest", "most"].map((value) => /* @__PURE__ */ jsx71("option", { value, children: t(`reports.sort_${value}`) }, value)) })
          ] })
        ] }),
        view === "graph" ? /* @__PURE__ */ jsx71(Suspense, { fallback: /* @__PURE__ */ jsx71("p", { role: "status", className: "p-6", children: t("reports.loading") }), children: /* @__PURE__ */ jsx71(ReportGraphs2, { rows: report.rows, groups: groups ?? [], byService: type === "byService" }) }) : type === "byService" ? /* @__PURE__ */ jsx71(ReportServiceGroups, { groups: groups ?? [], money }) : !report.rows.length ? /* @__PURE__ */ jsxs57("div", { className: "p-10 text-center", children: [
          /* @__PURE__ */ jsx71(BarChart33, { className: "mx-auto mb-3 h-9 w-9 text-slate-400", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx71("h3", { className: "font-semibold", children: t("reports.empty") }),
          /* @__PURE__ */ jsx71("p", { className: "mt-2 text-sm text-slate-600", children: t("reports.emptyHelp") })
        ] }) : /* @__PURE__ */ jsx71("div", { className: "overflow-x-auto", tabIndex: 0, role: "region", "aria-label": t("reports.results"), children: /* @__PURE__ */ jsxs57("table", { className: "w-full min-w-[540px] text-start text-sm", children: [
          /* @__PURE__ */ jsxs57("caption", { className: "sr-only", children: [
            title,
            " \xB7 ",
            periodLabel
          ] }),
          /* @__PURE__ */ jsx71("thead", { className: "bg-slate-50 text-slate-600", children: /* @__PURE__ */ jsx71("tr", { children: ["service", ...company2 ? ["employee"] : [], "date", "status", "amount"].map((key) => /* @__PURE__ */ jsx71("th", { scope: "col", className: `px-5 py-3 font-medium ${key === "amount" ? "text-end" : "text-start"}`, children: t(`reports.${key}`) }, key)) }) }),
          /* @__PURE__ */ jsx71("tbody", { className: "divide-y", children: report.rows.map((row) => /* @__PURE__ */ jsxs57("tr", { className: "hover:bg-slate-50", "data-report-row": true, children: [
            /* @__PURE__ */ jsx71("th", { scope: "row", className: "max-w-xs whitespace-normal break-words px-5 py-4 text-start font-medium", children: /* @__PURE__ */ jsx71("bdi", { children: row.service }) }),
            company2 && /* @__PURE__ */ jsx71("td", { className: "max-w-xs break-words px-5 py-4 text-slate-600", children: /* @__PURE__ */ jsx71("bdi", { "data-report-employee": true, children: employeeName(row.employeeId, row.employee) }) }),
            /* @__PURE__ */ jsx71("td", { className: "px-5 py-4 text-slate-600", children: date(row.date) }),
            /* @__PURE__ */ jsx71("td", { className: "px-5 py-4", children: /* @__PURE__ */ jsx71("span", { className: `inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass[row.status]}`, children: status(row.status) }) }),
            /* @__PURE__ */ jsx71("td", { className: "whitespace-nowrap px-5 py-4 text-end font-semibold", children: money(row.amount, row.currency) })
          ] }, row.id)) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs57("p", { className: "text-xs leading-relaxed text-slate-600", children: [
        t("reports.definitions"),
        " ",
        t("reports.timezone", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      ] })
    ] })
  ] });
}
var ReportGraphs2;
var init_reports = __esm({
  "client/src/pages/provider/reports.tsx"() {
    "use strict";
    init_useAuth();
    init_use_provider_workspace();
    init_button();
    init_input();
    init_label();
    init_service_report();
    init_queryClient();
    init_report_service_groups();
    init_service_view_statistics2();
    ReportGraphs2 = lazy(() => Promise.resolve().then(() => (init_report_graphs(), report_graphs_exports)));
  }
});

// client/src/pages/my-services.tsx
var my_services_exports = {};
__export(my_services_exports, {
  default: () => MyServices
});
import { Link as Link19, Redirect, Route as Route2, Switch as Switch3, useLocation as useLocation7 } from "wouter";
import { useIsMutating as useIsMutating6 } from "@tanstack/react-query";
import { jsx as jsx72, jsxs as jsxs58 } from "react/jsx-runtime";
function MyServices() {
  const { user: user2, isLoading, isError } = useAuth();
  const [location2] = useLocation7();
  if (isLoading) return /* @__PURE__ */ jsx72("main", { className: "p-8 text-center", role: "status", children: "Loading your services\u2026" });
  if (!user2 || isError) return /* @__PURE__ */ jsx72(Redirect, { to: `/login?returnTo=${encodeURIComponent(location2)}`, replace: true });
  if (user2.currentRole !== "provider") return /* @__PURE__ */ jsx72(Redirect, { to: "/account#role", replace: true });
  return /* @__PURE__ */ jsx72(ProviderLayout, {}, user2.id);
}
function ProviderLayout() {
  const workspace = useProviderWorkspace();
  const mutationCount = useIsMutating6();
  const switching = useIsMutating6({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  const change = useWorkspaceChange();
  if (workspace.isLoading) return /* @__PURE__ */ jsx72("main", { className: "p-8 text-center", role: "status", children: "Loading workspace\u2026" });
  if (workspace.isError || !workspace.data) return /* @__PURE__ */ jsx72("main", { className: "p-8", role: "alert", children: "Unable to load your workspace. Please refresh to try again." });
  const context2 = workspace.data;
  return /* @__PURE__ */ jsx72("div", { className: "min-h-[calc(100dvh-4rem)] bg-[#F0EEFF]", "data-appointment-area": "provider", children: /* @__PURE__ */ jsx72("div", { className: "max-w-7xl mx-auto p-4 sm:p-6 space-y-5", children: /* @__PURE__ */ jsxs58("div", { className: "lg:flex lg:gap-6", children: [
    /* @__PURE__ */ jsx72(ProviderNavigation, { context: context2, busy: mutationCount > 0, onWorkspaceChange: (companyId) => requestServiceEditorExit(() => change.mutateAsync(companyId)) }),
    /* @__PURE__ */ jsxs58("main", { className: "flex-1 min-w-0 pb-6", children: [
      /* @__PURE__ */ jsx72(WorkspaceNotice, { context: context2 }),
      switching && /* @__PURE__ */ jsx72("p", { role: "status", className: "mb-4", children: "Switching workspace\u2026" }),
      /* @__PURE__ */ jsx72("fieldset", { disabled: switching, className: `min-w-0 ${switching ? "pointer-events-none opacity-50" : ""}`, "aria-busy": switching, children: /* @__PURE__ */ jsxs58(Switch3, { children: [
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services", children: /* @__PURE__ */ jsx72(Redirect, { to: "/my-services/appointments", replace: true }) }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/appointments", children: /* @__PURE__ */ jsx72(AppointmentsPage, {}) }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/upcoming-appointments", children: /* @__PURE__ */ jsx72(AppointmentsPage, { view: "upcoming" }) }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/past-appointments", children: /* @__PURE__ */ jsx72(AppointmentsPage, { view: "past" }) }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/services/new", component: ServiceEditPage }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/services/:id/edit", component: ServiceEditPage }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/services", component: ServicesPage }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/reports", component: ReportsPage }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/availability", component: AvailabilityPage }),
        /* @__PURE__ */ jsx72(Route2, { path: "/my-services/settings/*?", component: SettingsPage }),
        /* @__PURE__ */ jsx72(Route2, { children: /* @__PURE__ */ jsxs58("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsx72("h1", { className: "text-2xl font-semibold", children: "Page not found" }),
          /* @__PURE__ */ jsx72(Link19, { href: "/my-services/appointments", className: "text-primary underline", children: "Back to appointments" })
        ] }) })
      ] }) })
    ] }, context2.company?.id ?? "personal")
  ] }) }) });
}
var init_my_services = __esm({
  "client/src/pages/my-services.tsx"() {
    "use strict";
    init_useAuth();
    init_use_provider_workspace();
    init_use_workspace_change();
    init_provider_navigation();
    init_workspace_switcher();
    init_appointments();
    init_services();
    init_service_edit();
    init_availability();
    init_settings();
    init_reports();
    init_service_navigation_guard();
  }
});

// client/src/components/role-switcher.tsx
var role_switcher_exports = {};
__export(role_switcher_exports, {
  default: () => RoleSwitcher
});
import { Link as Link20, useLocation as useLocation8 } from "wouter";
import { useTranslation as useTranslation48 } from "react-i18next";
import { jsx as jsx73, jsxs as jsxs59 } from "react/jsx-runtime";
function RoleSwitcher() {
  const { user: user2 } = useAuth();
  const { t } = useTranslation48();
  const [location2] = useLocation8();
  const inMyServices = location2 === "/my-services" || location2.startsWith("/my-services/");
  const inSearch = location2 === "/" || location2 === "/search";
  return /* @__PURE__ */ jsxs59("nav", { "aria-label": t("mobileNavigation.navigation"), className: "bg-white/10 p-1 rounded-lg flex flex-wrap", children: [
    /* @__PURE__ */ jsx73(
      Button,
      {
        asChild: true,
        variant: inSearch ? "default" : "ghost",
        size: "sm",
        className: "flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium",
        children: /* @__PURE__ */ jsx73(Link20, { href: "/", "aria-current": inSearch ? "page" : void 0, children: t("searchPage.navSearch") })
      }
    ),
    /* @__PURE__ */ jsx73(
      Button,
      {
        asChild: true,
        variant: location2 === "/my-bookings" ? "default" : "ghost",
        size: "sm",
        className: "flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium",
        children: /* @__PURE__ */ jsx73(Link20, { href: "/my-bookings", "aria-current": location2 === "/my-bookings" ? "page" : void 0, children: t("booking.myBookings") })
      }
    ),
    user2?.currentRole === "provider" && /* @__PURE__ */ jsx73(
      Button,
      {
        asChild: true,
        variant: inMyServices ? "default" : "ghost",
        size: "sm",
        className: "flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium",
        children: /* @__PURE__ */ jsx73(Link20, { href: "/my-services", "aria-current": inMyServices ? "page" : void 0, children: t("provider.myServices") })
      }
    )
  ] });
}
var init_role_switcher = __esm({
  "client/src/components/role-switcher.tsx"() {
    "use strict";
    init_button();
    init_useAuth();
  }
});

// shared/social-auth.ts
var socialProviders, socialProviderLabels;
var init_social_auth = __esm({
  "shared/social-auth.ts"() {
    "use strict";
    socialProviders = ["google", "facebook", "apple", "microsoft"];
    socialProviderLabels = {
      google: "Google",
      facebook: "Facebook",
      apple: "Apple",
      microsoft: "Microsoft"
    };
  }
});

// client/src/components/invitation-recovery.tsx
import { useRef as useRef24, useState as useState34 } from "react";
import { jsx as jsx74, jsxs as jsxs60 } from "react/jsx-runtime";
function InvitationRecovery({ returnTo }) {
  const { t } = useFormLocale();
  const [email, setEmail] = useState34(""), [busy, setBusy] = useState34(false), [message, setMessage] = useState34(false), [error, setError] = useState34("");
  const locked = useRef24(false), errorRef = useRef24(null);
  async function submit(event) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage(false);
    setError("");
    try {
      const response = await apiRequest("POST", "/api/auth/invite-recovery", { email, returnTo });
      await response.json();
      setMessage(true);
    } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith("429:") ? "rateLimited" : "recoveryFailed");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs60("form", { onSubmit: submit, "aria-labelledby": "auth-recovery-heading", className: "auth-form border rounded-lg p-4 space-y-4", children: [
    /* @__PURE__ */ jsx74("h2", { id: "auth-recovery-heading", className: "text-lg font-semibold", children: t("authForm.recoveryTitle") }),
    /* @__PURE__ */ jsx74("p", { className: "text-sm text-muted-foreground", children: t("authForm.recoveryHelp") }),
    /* @__PURE__ */ jsxs60("div", { children: [
      /* @__PURE__ */ jsx74(Label, { htmlFor: "invitation-recovery-email", children: t("authForm.invitedEmail") }),
      /* @__PURE__ */ jsx74(Input, { id: "invitation-recovery-email", type: "email", required: true, maxLength: 254, autoComplete: "email", disabled: busy, value: email, onChange: (event) => setEmail(event.target.value) })
    ] }),
    /* @__PURE__ */ jsx74(Button, { type: "submit", variant: "outline", disabled: busy, children: t(busy ? "authForm.sending" : "authForm.recoverySend") }),
    message && /* @__PURE__ */ jsx74("p", { role: "status", className: "text-sm", children: t("authForm.recoverySent") }),
    error && /* @__PURE__ */ jsx74("p", { ref: errorRef, tabIndex: -1, role: "alert", className: "text-sm text-destructive", children: t(`authForm.${error}`) })
  ] });
}
var init_invitation_recovery = __esm({
  "client/src/components/invitation-recovery.tsx"() {
    "use strict";
    init_queryClient();
    init_forms_locale();
    init_button();
    init_input();
    init_label();
  }
});

// client/src/pages/login.tsx
var login_exports = {};
__export(login_exports, {
  default: () => Login
});
import { useRef as useRef25, useState as useState35 } from "react";
import { Link as Link21, Redirect as Redirect2 } from "wouter";
import { useQuery as useQuery22 } from "@tanstack/react-query";
import { Heart as Heart2 } from "lucide-react";
import { FaGoogle, FaFacebook, FaApple, FaMicrosoft } from "react-icons/fa6";
import { jsx as jsx75, jsxs as jsxs61 } from "react/jsx-runtime";
function callbackError(code) {
  switch (code) {
    case null:
      return "";
    case "invitation_session_expired":
      return "invitationExpired";
    case "google_disabled":
    case "social_disabled":
      return "providerUnavailable";
    case "social_cancelled":
      return "socialCancelled";
    case "social_session_expired":
      return "sessionExpired";
    default:
      return "signInFailed";
  }
}
function Login() {
  const { t, i18n, language } = useFormLocale();
  const { isAuthenticated, isError } = useAuth();
  const [signup, setSignup] = useState35(false), [busy, setBusy] = useState35(false);
  const locked = useRef25(false), heading = useRef25(null), errorRef = useRef25(null);
  const [email, setEmail] = useState35(""), [password, setPassword] = useState35(""), [confirmPassword, setConfirmPassword] = useState35("");
  const [confirmPasswordError, setConfirmPasswordError] = useState35("");
  const [firstName, setFirstName] = useState35(""), [lastName, setLastName] = useState35("");
  const [accountType, setAccountType] = useState35("personal"), [companyName, setCompanyName] = useState35(""), [companyNameError, setCompanyNameError] = useState35("");
  const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = isAllowedAuthReturnTo(requestedReturn) ? requestedReturn : "/";
  const [message, setMessage] = useState35(new URLSearchParams(window.location.search).get("passwordUpdated") === "1" ? "passwordUpdated" : "");
  const [error, setError] = useState35(() => callbackError(new URLSearchParams(window.location.search).get("error")));
  const providers = useQuery22({ queryKey: ["/api/auth/providers"], staleTime: 6e4, retry: false });
  const enabled = socialProviders.filter((provider) => providers.data?.[provider]);
  const languages = (Array.isArray(i18n.options.supportedLngs) ? i18n.options.supportedLngs : Object.keys(i18n.services.resourceStore.data)).filter((code) => code !== "cimode");
  const languageName = (code) => new Intl.DisplayNames([code], { type: "language" }).of(code) || code;
  if (isAuthenticated && !isError) return /* @__PURE__ */ jsx75(Redirect2, { to: returnTo });
  async function socialSignIn(provider) {
    if (locked.current) return;
    setCompanyNameError("");
    if (signup && accountType === "company" && (!companyName.trim() || companyName.trim().length > 150)) {
      setCompanyNameError("companyInvalid");
      requestAnimationFrame(() => document.getElementById("signup-company")?.focus());
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (signup && accountType === "company") {
        const response = await apiRequest("POST", `/api/auth/${provider}`, { companyName: companyName.trim(), returnTo });
        const result = await response.json();
        if (typeof result.url !== "string" || !result.url) throw new Error("Missing sign-in URL");
        window.location.assign(result.url);
      } else window.location.assign(`/api/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`);
    } catch {
      locked.current = false;
      setBusy(false);
      setError("socialStartFailed");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (locked.current) return;
    setConfirmPasswordError("");
    if (signup && (!confirmPassword || password !== confirmPassword)) {
      setError("");
      setMessage("");
      setConfirmPasswordError(confirmPassword ? "passwordMismatch" : "confirmRequired");
      requestAnimationFrame(() => document.getElementById("confirm-password")?.focus());
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiRequest("POST", signup ? "/api/auth/signup" : "/api/auth/login", { email, password, firstName, lastName, accountType, companyName, returnTo });
      const result = await response.json();
      setPassword("");
      setConfirmPassword("");
      if (signup && !result.signedIn) setMessage("checkEmail");
      else {
        queryClient.clear();
        window.location.assign(returnTo);
      }
    } catch (failure) {
      const raw = failure instanceof Error ? failure.message : "";
      setError(raw.startsWith("429:") ? "rateLimited" : !signup && raw.startsWith("401:") ? "invalidCredentials" : signup && raw.startsWith("400:") ? "signupFailed" : "signInFailed");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsx75("main", { className: "min-h-[100dvh] bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs61(Card, { className: "auth-form auth-page-card w-full max-w-md", children: [
    /* @__PURE__ */ jsxs61(CardHeader, { className: "text-center space-y-4", children: [
      /* @__PURE__ */ jsxs61("div", { children: [
        /* @__PURE__ */ jsx75(Label, { htmlFor: "auth-language", children: t("authForm.language") }),
        /* @__PURE__ */ jsx75("select", { id: "auth-language", value: language, onChange: (event) => void i18n.changeLanguage(event.target.value), children: languages.map((code) => /* @__PURE__ */ jsx75("option", { value: code, lang: code, children: languageName(code) }, code)) })
      ] }),
      /* @__PURE__ */ jsx75(Heart2, { "aria-hidden": "true", className: "w-10 h-10 text-primary mx-auto" }),
      /* @__PURE__ */ jsx75("h1", { ref: heading, tabIndex: -1, className: "text-2xl font-semibold", children: t(signup ? "authForm.createTitle" : "authForm.welcome") }),
      /* @__PURE__ */ jsx75("p", { className: "text-sm text-muted-foreground", children: "FitsMyTime" })
    ] }),
    /* @__PURE__ */ jsxs61(CardContent, { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs61("form", { onSubmit: submit, className: "space-y-6", "aria-label": t(signup ? "authForm.createTitle" : "authForm.signIn"), children: [
        signup && (returnTo === "/" || returnTo === "/search" || accountType === "company") && /* @__PURE__ */ jsxs61("fieldset", { disabled: busy, className: "space-y-4 min-w-0", children: [
          /* @__PURE__ */ jsx75("legend", { className: "text-lg font-semibold mb-4", children: t("authForm.accountSetup") }),
          (returnTo === "/" || returnTo === "/search") && /* @__PURE__ */ jsxs61("div", { children: [
            /* @__PURE__ */ jsx75(Label, { htmlFor: "signup-type", children: t("authForm.accountType") }),
            /* @__PURE__ */ jsxs61("select", { id: "signup-type", value: accountType, disabled: busy, onChange: (event) => {
              setAccountType(event.target.value);
              setCompanyNameError("");
            }, children: [
              /* @__PURE__ */ jsx75("option", { value: "personal", children: t("authForm.personal") }),
              /* @__PURE__ */ jsx75("option", { value: "company", children: t("authForm.company") })
            ] })
          ] }),
          accountType === "company" && /* @__PURE__ */ jsxs61("div", { children: [
            /* @__PURE__ */ jsx75(Label, { htmlFor: "signup-company", children: t("authForm.companyName") }),
            /* @__PURE__ */ jsx75(Input, { id: "signup-company", required: true, maxLength: 150, value: companyName, disabled: busy, "aria-invalid": Boolean(companyNameError), "aria-describedby": companyNameError ? "signup-company-error" : void 0, onChange: (event) => {
              setCompanyName(event.target.value);
              setCompanyNameError("");
            } }),
            companyNameError && /* @__PURE__ */ jsx75("p", { id: "signup-company-error", role: "alert", className: "text-sm text-destructive mt-1", children: t(`authForm.${companyNameError}`) })
          ] })
        ] }),
        (providers.isPending || providers.isError || enabled.length > 0) && /* @__PURE__ */ jsxs61("section", { "aria-labelledby": "auth-options-heading", className: "space-y-3", children: [
          /* @__PURE__ */ jsx75("h2", { id: "auth-options-heading", className: "text-lg font-semibold", children: t("authForm.options") }),
          providers.isPending && /* @__PURE__ */ jsx75("p", { role: "status", className: "text-sm text-muted-foreground", children: t("authForm.loadingOptions") }),
          enabled.map((provider) => {
            const Icon2 = providerIcons[provider];
            return /* @__PURE__ */ jsxs61(Button, { type: "button", className: "w-full", variant: "outline", disabled: busy, onClick: () => socialSignIn(provider), children: [
              /* @__PURE__ */ jsx75(Icon2, { "aria-hidden": "true" }),
              t("authForm.continueWith", { provider: socialProviderLabels[provider] })
            ] }, provider);
          }),
          providers.isError && /* @__PURE__ */ jsxs61("div", { className: "text-sm space-y-2", children: [
            /* @__PURE__ */ jsx75("p", { role: "status", children: t("authForm.optionsFailed") }),
            /* @__PURE__ */ jsx75(Button, { type: "button", variant: "outline", disabled: busy || providers.isFetching, onClick: () => void providers.refetch(), children: t("authForm.retryOptions") })
          ] })
        ] }),
        signup && /* @__PURE__ */ jsxs61("fieldset", { disabled: busy, className: "space-y-4 min-w-0 border-t pt-5", children: [
          /* @__PURE__ */ jsx75("legend", { className: "font-semibold px-2", children: t("authForm.profile") }),
          /* @__PURE__ */ jsxs61("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxs61("div", { children: [
              /* @__PURE__ */ jsx75(Label, { htmlFor: "first-name", children: t("authForm.firstName") }),
              /* @__PURE__ */ jsx75(Input, { id: "first-name", autoComplete: "given-name", maxLength: 100, value: firstName, onChange: (event) => setFirstName(event.target.value) })
            ] }),
            /* @__PURE__ */ jsxs61("div", { children: [
              /* @__PURE__ */ jsx75(Label, { htmlFor: "last-name", children: t("authForm.lastName") }),
              /* @__PURE__ */ jsx75(Input, { id: "last-name", autoComplete: "family-name", maxLength: 100, value: lastName, onChange: (event) => setLastName(event.target.value) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs61("fieldset", { disabled: busy, className: "space-y-4 min-w-0 border-t pt-5", children: [
          /* @__PURE__ */ jsx75("legend", { className: "font-semibold px-2", children: t("authForm.emailSignIn") }),
          /* @__PURE__ */ jsxs61("div", { children: [
            /* @__PURE__ */ jsx75(Label, { htmlFor: "email", children: t("authForm.email") }),
            /* @__PURE__ */ jsx75(Input, { id: "email", type: "email", autoComplete: "email", required: true, maxLength: 254, value: email, onChange: (event) => setEmail(event.target.value) })
          ] }),
          /* @__PURE__ */ jsxs61("div", { children: [
            /* @__PURE__ */ jsx75(Label, { htmlFor: "password", children: t("authForm.password") }),
            /* @__PURE__ */ jsx75(Input, { id: "password", type: "password", autoComplete: signup ? "new-password" : "current-password", required: true, minLength: 8, maxLength: 128, "aria-describedby": signup ? "auth-password-help" : void 0, value: password, onChange: (event) => {
              setPassword(event.target.value);
              setConfirmPasswordError("");
            } }),
            signup && /* @__PURE__ */ jsx75("p", { id: "auth-password-help", className: "text-sm text-muted-foreground mt-1", children: t("authForm.passwordHelp") })
          ] }),
          signup && /* @__PURE__ */ jsxs61("div", { children: [
            /* @__PURE__ */ jsx75(Label, { htmlFor: "confirm-password", children: t("authForm.confirmPassword") }),
            /* @__PURE__ */ jsx75(Input, { id: "confirm-password", name: "confirmPassword", type: "password", autoComplete: "new-password", required: true, minLength: 8, maxLength: 128, value: confirmPassword, "aria-invalid": Boolean(confirmPasswordError), "aria-describedby": confirmPasswordError ? "confirm-password-error" : void 0, onChange: (event) => {
              setConfirmPassword(event.target.value);
              setConfirmPasswordError("");
            } }),
            confirmPasswordError && /* @__PURE__ */ jsx75("p", { id: "confirm-password-error", role: "alert", className: "text-sm text-destructive mt-1", children: t(`authForm.${confirmPasswordError}`) })
          ] })
        ] }),
        error && /* @__PURE__ */ jsx75("p", { ref: errorRef, tabIndex: -1, role: "alert", className: "text-sm text-destructive", children: t(`authForm.${error}`) }),
        message && /* @__PURE__ */ jsx75("p", { role: "status", className: "text-sm", children: t(`authForm.${message}`) }),
        /* @__PURE__ */ jsx75(Button, { type: "submit", className: "w-full", disabled: busy, children: t(busy ? "authForm.wait" : signup ? "authForm.createAccount" : "authForm.signIn") })
      ] }),
      /^\/invite(?:\?|$)/.test(returnTo) && /* @__PURE__ */ jsx75(InvitationRecovery, { returnTo }),
      /* @__PURE__ */ jsx75(Button, { type: "button", variant: "ghost", className: "w-full", disabled: busy, onClick: () => {
        setSignup(!signup);
        setMessage("");
        setError("");
        setPassword("");
        setConfirmPassword("");
        setConfirmPasswordError("");
        setCompanyNameError("");
        requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
      }, children: t(signup ? "authForm.switchSignIn" : "authForm.switchSignup") }),
      /* @__PURE__ */ jsx75(Link21, { href: "/", className: "block text-center text-sm", children: t("authForm.back") }),
      /* @__PURE__ */ jsx75("a", { href: "/privacy-policy.html", className: "block text-center text-sm underline underline-offset-4", children: t("legal.privacyPolicy") })
    ] })
  ] }) });
}
var providerIcons;
var init_login = __esm({
  "client/src/pages/login.tsx"() {
    "use strict";
    init_navigation();
    init_social_auth();
    init_invitation_recovery();
    init_useAuth();
    init_forms_locale();
    init_queryClient();
    init_button();
    init_input();
    init_label();
    init_card();
    providerIcons = { google: FaGoogle, facebook: FaFacebook, apple: FaApple, microsoft: FaMicrosoft };
  }
});

// scripts/test-provider-navigation.mjs
import assert from "node:assert/strict";

// scripts/fixtures/categories.mjs
var categoryFixtures = [
  { key: "health_wellness", name: "Health & Wellness", icon: "\u{1F3E5}", searchKeywords: "" },
  { key: "education", name: "Education", icon: "\u{1F393}", searchKeywords: "" },
  { key: "entertainment", name: "Entertainment", icon: "\u{1F3B5}", searchKeywords: "" }
];

// scripts/test-provider-navigation.mjs
import React17 from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route as Route3, Switch as Switch4 } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { readFile } from "node:fs/promises";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
var translation = JSON.parse(await readFile("C:\\Source\\Private\\WellnessConnect\\client\\public\\locales\\en\\translation.json", "utf8"));
await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation } } });
globalThis.React = React17;
globalThis.window = {
  location: { pathname: "/my-services", search: "", hash: "", assign() {
  } },
  HTMLSelectElement: { prototype: { value: "" } },
  HTMLInputElement: { prototype: { checked: false } },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  addEventListener() {
  },
  removeEventListener() {
  },
  confirm: () => true,
  matchMedia: () => ({ matches: false, addEventListener() {
  }, removeEventListener() {
  } }),
  history: { state: null, replaceState() {
  } }
};
globalThis.document = { documentElement: {}, activeElement: null, visibilityState: "visible", addEventListener() {
}, removeEventListener() {
} };
globalThis.HTMLElement = class {
};
var { queryClient: queryClient2 } = await Promise.resolve().then(() => (init_queryClient(), queryClient_exports));
var { isAllowedAuthReturnTo: isAllowedAuthReturnTo2 } = await Promise.resolve().then(() => (init_navigation(), navigation_exports));
var { default: MyServices2 } = await Promise.resolve().then(() => (init_my_services(), my_services_exports));
var { default: WorkspaceSwitcher2 } = await Promise.resolve().then(() => (init_workspace_switcher(), workspace_switcher_exports));
var { default: RoleSwitcher2 } = await Promise.resolve().then(() => (init_role_switcher(), role_switcher_exports));
var { default: Login2 } = await Promise.resolve().then(() => (init_login(), login_exports));
var { Select: Select2 } = await Promise.resolve().then(() => (init_select(), select_exports));
var { AlertDialog: AlertDialog2, AlertDialogContent: AlertDialogContent2, AlertDialogFooter: AlertDialogFooter2, AlertDialogAction: AlertDialogAction2 } = await Promise.resolve().then(() => (init_alert_dialog(), alert_dialog_exports));
var { act, create } = renderer;
var user = { id: "fixture", firstName: "Test", email: "fixture@example.com", providerType: "company", currentRole: "provider" };
var permissions = { manageServices: true, manageSchedules: true, manageBookings: true, manageTeam: false, isOwner: false, readAll: true };
var personal = { company: null, membership: null, workspaces: [{ id: 2, name: "Company workspace", role: "admin" }], permissions };
var company = { ...personal, company: { id: 2, name: "Company workspace", isActive: true }, membership: { role: "admin" }, permissions: { ...permissions, manageTeam: true } };
var viewer = { ...company, membership: { role: "viewer", employeeId: 3 }, permissions: { manageServices: false, manageSchedules: false, manageBookings: false, manageTeam: false, isOwner: false, readAll: false } };
var service = (id, name, isActive) => ({ id, name, isActive, description: "Existing description", category: "health_wellness", serviceType: "one_to_one", price: "25.00", currency: "EUR", duration: 45, maxCapacity: 1, ageGroups: ["adults"], targetGender: "both", instantBooking: false, advancePaymentPercent: 30, addressId: 7, address: "Riga", latitude: 56.95, longitude: 24.1, imageUrl: "/private/image", externalUrl: "https://example.com/service", employeeId: null });
var personalServices = [service(1, "Personal published offer", true), service(4, "Personal inactive offer", false)];
var companyServices = [service(2, "Company offer", true)];
var context = personal;
var requests = [];
var component;
var location;
var failSave = false;
var holdSave = false;
var resolveSave;
var failWorkspace = false;
var respond = (data, status = 200) => new Response(JSON.stringify(data), { status });
globalThis.fetch = async (url, options = {}) => {
  if (url === "/api/categories") return new Response(JSON.stringify(categoryFixtures));
  if (url === "/api/notifications/capabilities") return respond({ hasPro: false, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
  requests.push({ url, method: options.method ?? "GET", body: options.body ? JSON.parse(options.body) : void 0 });
  const body = options.body ? JSON.parse(options.body) : void 0;
  const records = context.company ? companyServices : personalServices;
  if (url === "/api/addresses") return respond([{ id: 7, address: "Br\u012Bv\u012Bbas iela 10, R\u012Bga, Latvia" }]);
  if (url === "/api/auth/user") return respond(user);
  if (url === "/api/company/context" && options.method === "POST") {
    if (failWorkspace) return respond({ message: "Try again" }, 500);
    context = body.companyId === 2 ? company : personal;
    return respond(context);
  }
  if (url === "/api/company/context") return respond(context);
  if (url === "/api/workspace/pricing-settings") return respond({ workspace: context.company ? { kind: "company", id: context.company.id } : { kind: "user", id: user.id }, defaultCurrency: "EUR", businessCountryCode: "LV", revision: 0, canEdit: true });
  if (url === "/api/services/provider") return respond(records);
  if (url === "/api/provider/employees") return respond(context.company ? [{ id: 3, name: "Company employee", showName: false }] : []);
  if (url === "/api/bookings/provider" || url === "/api/availability/provider") return respond([]);
  if (url === "/api/company/team") return respond({ members: [], invitations: [] });
  if (url === "/api/services/1/copy") {
    const copied = { ...personalServices[0], id: 101, isActive: false };
    personalServices.push(copied);
    return respond(copied);
  }
  if (url === "/api/services/101" && options.method === "PATCH") {
    if (failSave) return respond({ message: "Try again" }, 500);
    Object.assign(personalServices.find((row) => row.id === 101), body);
    if (holdSave) return new Promise((resolve) => {
      resolveSave = () => resolve(respond(personalServices.find((row) => row.id === 101)));
    });
    return respond(personalServices.find((row) => row.id === 101));
  }
  if (url === "/api/services" && options.method === "POST") {
    const added = { ...body, id: 102 };
    records.push(added);
    return respond(added);
  }
  if (url === "/api/availability/weekly") return respond({ success: true });
  throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
};
var flush = async () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 60));
});
var input = (id) => component.root.findAllByType("input").find((node) => node.props.id === id);
var click = async (id) => {
  await act(async () => component.root.findAllByType("button").find((node) => node.props["data-testid"] === id).props.onClick());
  await flush();
};
var visit = async (path) => {
  await act(async () => location.navigate(path));
  await flush();
};
var headings = () => component.root.findAllByType("h1").flatMap((node) => node.children).filter((value) => typeof value === "string");
var textContent = (node) => typeof node === "string" ? node : node.children.map(textContent).join("");
var confirmExit = async () => {
  const dialog = component.root.findAllByType(AlertDialog2).find((node) => node.props.open);
  assert.ok(dialog, "Dirty workspace changes require explicit confirmation");
  const content = React17.Children.toArray(dialog.props.children).find((node) => node.type === AlertDialogContent2);
  const footer = React17.Children.toArray(content.props.children).find((node) => node.type === AlertDialogFooter2);
  const action = React17.Children.toArray(footer.props.children).find((node) => node.type === AlertDialogAction2);
  await act(async () => action.props.onClick());
};
async function mount(path, workspace = personal, signedIn = true) {
  if (component) await act(async () => component.unmount());
  queryClient2.clear();
  context = workspace;
  requests = [];
  queryClient2.setQueryData(["/api/auth/user"], signedIn ? user : null);
  queryClient2.setQueryData(["/api/company/context"], workspace);
  queryClient2.setQueryData(["/api/auth/providers"], { google: true });
  location = memoryLocation({ path, record: true });
  await act(async () => {
    component = create(React17.createElement(QueryClientProvider, { client: queryClient2 }, React17.createElement(Router, { hook: location.hook }, React17.createElement(React17.Fragment, null, React17.createElement(RoleSwitcher2), React17.createElement(Switch4, null, React17.createElement(Route3, { path: "/my-services/*?", component: MyServices2 }), React17.createElement(Route3, { path: "/login", component: Login2 }))))));
  });
  await flush();
}
await mount("/my-services");
assert.equal(location.history.at(-1), "/my-services/appointments");
assert.deepEqual(headings(), []);
assert.equal(component.root.findAllByProps({ "data-testid": "appointment-calendar" }).length, 1, "Appointments opens directly as a calendar");
assert.equal(component.root.findAllByProps({ "data-testid": "appointment-summary" }).length, 0);
await visit("/my-services/upcoming-appointments");
assert.deepEqual(headings(), [translation.providerNavigation.upcomingAppointments]);
await visit("/my-services/past-appointments");
assert.deepEqual(headings(), [translation.providerNavigation.pastAppointments]);
assert.ok(!requests.some((request) => request.url === "/api/services/provider" || request.url === "/api/company/team"), "Appointments load only their own feature data");
await act(async () => component.root.findAllByType("a").find((node) => node.props.href === "/my-services/services").props.onClick({ button: 0, preventDefault() {
} }));
await flush();
assert.deepEqual(headings(), [translation.provider.myServices]);
assert.equal(component.root.findAllByType("a").find((node) => node.props.href === "/my-services").props["aria-current"], "page");
assert.equal(queryClient2.getQueryCache().find({ queryKey: ["/api/bookings/provider"] })?.getObserversCount() ?? 0, 0, "Leaving appointments removes its observers, including when gcTime: 0 removes the query");
await act(async () => component.root.findAllByType("button").find((node) => node.children.includes("Inactive")).props.onClick());
assert.equal(component.root.findAllByType("h3").some((node) => textContent(node) === "Personal published offer"), false);
await act(async () => component.root.findAllByType("button").find((node) => node.children.includes("All")).props.onClick());
await click("button-copy-service-1");
assert.equal(location.history.at(-1), "/my-services/services/101/edit");
assert.equal(input("serviceName").props.value, "Personal published offer");
assert.equal(input("externalUrl").props.value, "https://example.com/service");
assert.equal(component.root.findAllByType("select").some((node) => node.props.id === "service-employee"), false, "Employee assignment follows the workspace rather than the account provider type");
await act(async () => input("serviceName").props.onChange({ target: { value: "Updated copy" } }));
failSave = true;
await click("button-save-inactive-service");
assert.equal(input("serviceName").props.value, "Updated copy", "Failed saves preserve the draft");
assert.ok(component.root.findAllByType("h2").some((node) => node.children.includes(translation.serviceForm.saveError)));
failSave = false;
holdSave = true;
await click("button-save-inactive-service");
assert.equal(component.root.findByType(WorkspaceSwitcher2).props.busy, true, "Do not switch workspace while a save is pending");
assert.equal(component.root.findAllByType("button").find((node) => node.props.title === "Personal workspace").props.disabled, true);
var blockedClick = { button: 0, defaultPrevented: false, preventDefault() {
  this.defaultPrevented = true;
} };
await act(async () => component.root.findAllByType("nav").find((node) => node.props["aria-label"] === "My Services sections").findAllByType("a")[0].props.onClick(blockedClick));
assert.equal(location.history.at(-1), "/my-services/services/101/edit");
holdSave = false;
await act(async () => resolveSave());
await flush();
assert.equal(location.history.at(-1), "/my-services/services");
var saved = requests.filter((request) => request.url === "/api/services/101").at(-1).body;
assert.equal(saved.isActive, false);
assert.equal(saved.advancePaymentPercent, 30);
assert.equal(saved.imageUrl, "/private/image");
await visit("/my-services/services/new");
for (const [id, value] of [["serviceName", "New offer"], ["price", "40"]]) await act(async () => input(id).props.onChange({ target: { value } }));
await act(async () => component.root.findByProps({ id: "service-address" }).props.onChange({ target: { value: "7" } }));
await click("button-save-inactive-service");
assert.ok(component.root.findAllByType("a").some((node) => node.children.includes(translation.serviceForm.categoryRequired)));
assert.ok(!requests.some((request) => request.url === "/api/services" && request.method === "POST"));
await act(async () => component.root.findAllByType(Select2).find((node) => node.props.value === "").props.onValueChange("education"));
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {
} }));
await flush();
assert.equal(location.history.at(-1), "/my-services/services");
assert.equal(requests.find((request) => request.url === "/api/services" && request.method === "POST").body.isActive, true);
await visit("/my-services/services/1/edit");
assert.equal(input("serviceName").props.value, "Personal published offer");
failWorkspace = true;
await act(async () => input("serviceName").props.onChange({ target: { value: "Unsaved draft" } }));
await act(async () => component.root.findByType(WorkspaceSwitcher2).props.onChange(2));
assert.ok(!requests.some((request) => request.url === "/api/company/context" && request.method === "POST"), "No workspace request before discard confirmation");
await confirmExit();
await flush();
assert.equal(input("serviceName").props.value, "Unsaved draft", "A failed workspace switch preserves the editor draft");
failWorkspace = false;
await act(async () => component.root.findByType(WorkspaceSwitcher2).props.onChange(2));
await confirmExit();
await flush();
assert.equal(location.history.at(-1), "/my-services/services");
assert.equal(component.root.findAllByType("h3").some((node) => textContent(node) === "Company offer"), true);
assert.equal(component.root.findAllByType("h3").some((node) => textContent(node) === "Personal published offer"), false);
await visit("/my-services/settings/team");
assert.equal(component.root.findAllByType("button").filter((node) => node.props.title === "Company workspace").length, 1);
await visit("/my-services/availability");
assert.deepEqual(headings(), ["Availability"]);
assert.equal(component.root.findAllByProps({ role: "dialog" }).length, 0, "Availability is an inline page");
await act(async () => component.root.findAllByType("button").find((node) => node.children.includes("Save weekly hours")).props.onClick());
await flush();
assert.equal(requests.find((request) => request.url === "/api/availability/weekly").body.days.length, 7);
for (const path of ["/my-services/services/new", "/my-services/services/2/edit", "/my-services/availability", "/my-services/settings/team"]) {
  await mount(path, viewer);
  assert.equal(component.root.findAllByType("input").some((node) => node.props.id === "serviceName"), false);
  const navigation = component.root.findAllByType("nav").find((node) => node.props["aria-label"] === "My Services sections");
  assert.deepEqual(navigation.findAllByType("a").map((node) => node.props.href), ["/my-services/appointments", "/my-services/upcoming-appointments", "/my-services/past-appointments", "/my-services/services"]);
  assert.ok(component.root.findAllByProps({ role: "alert" }).length > 0);
}
await mount("/my-services/services/999/edit");
assert.deepEqual(headings(), ["Service not found"]);
await mount("/my-services/appointments", { ...personal, workspaces: [] });
assert.equal(component.root.findAllByType("button").some((node) => node.props.title === "Personal workspace"), false, "A personal-only user has no workspace control");
await mount("/my-services/appointments", personal);
assert.equal(component.root.findAllByType("nav").find((node) => node.props["aria-label"] === "My Services sections").findAllByType("button").filter((node) => node.props.title === "Personal workspace").length, 1, "One company plus personal shows exactly one workspace control inside navigation");
await mount("/my-services/settings/unknown");
assert.ok(component.root.findAllByProps({ role: "alert" }).some((node) => node.children.includes("Settings page not found.")));
await mount("/my-services/availability", personal, false);
assert.equal(location.history.at(-1), "/login?returnTo=%2Fmy-services%2Favailability");
for (const path of ["/my-services/upcoming-appointments", "/my-services/past-appointments"]) {
  await mount(path, personal, false);
  assert.equal(location.history.at(-1), `/login?returnTo=${encodeURIComponent(path)}`);
}
var destinations = [];
window.location.assign = (url) => destinations.push(url);
window.location.search = "?returnTo=%2Fmy-services%2Fservices%2F2%2Fedit";
await mount("/login", personal, false);
await act(async () => component.root.findAllByType("button").find((node) => node.children.includes("Continue with Google")).props.onClick());
assert.equal(destinations.at(-1), "/api/auth/google?returnTo=%2Fmy-services%2Fservices%2F2%2Fedit");
window.location.search = "";
await act(async () => component.unmount());
queryClient2.clear();
for (const path of ["/my-services", "/my-services/appointments", "/my-services/services", "/my-services/services/new", "/my-services/services/42/edit", "/my-services/availability", "/my-services/settings", "/my-services/settings/team", "/account", "/invite?token=fixture"]) assert.equal(isAllowedAuthReturnTo2(path), true);
for (const path of ["https://example.com", "//example.com", "/my-services-other", "/my-services/services/42/edit/other", "/unknown", null]) assert.equal(isAllowedAuthReturnTo2(path), false);
console.log("Passed: provider routes, feature data isolation, copy/edit/create, failed saves, permissions, workspace switching, availability, and sign-in redirects.");
