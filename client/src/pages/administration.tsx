import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { defaultAdminUserFilters, type AdminUsersPage } from "@shared/admin";
import { useAuth } from "@/hooks/useAuth";
import { useAppAdmin } from "@/hooks/use-app-admin";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import AdminUserFiltersForm from "@/components/admin-user-filters";
import AdminCategories from "@/components/admin-categories";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";

const signInUrl = "/login?returnTo=%2Fadministration";

function dateLabel(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default function Administration() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <main className="p-8" role="status">Loading administration…</main>;
  if (!isAuthenticated) return <Redirect to={signInUrl} />;
  return <AdministrationContent />;
}

function AdministrationContent() {
  const access = useAppAdmin();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<"users" | "categories">("users");
  const [categoryAccessError, setCategoryAccessError] = useState<Error | null>(null);
  const [options, setOptions] = useState(() => ({ page: 1, pageSize: 50,
    filters: { ...defaultAdminUserFilters, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  }));
  const users = useQuery<AdminUsersPage>({
    queryKey: ["/api/admin/users", options], enabled: access.isSuccess && access.data.isAdmin && section === "users",
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: String(options.page), pageSize: String(options.pageSize), ...options.filters });
      return (await apiRequest("GET", `/api/admin/users?${params}`, undefined, signal)).json();
    },
    staleTime: 0, gcTime: 0, retry: false,
  });
  const expired = isUnauthorizedError(access.error) || isUnauthorizedError(users.error) || isUnauthorizedError(categoryAccessError);
  const forbidden = (users.error instanceof Error && users.error.message.startsWith("403:")) || Boolean(categoryAccessError?.message.startsWith("403:"));
  useEffect(() => {
    if (expired) queryClient.setQueryData(["/api/auth/user"], null);
    if (forbidden) queryClient.setQueryData(["/api/admin/access"], { isAdmin: false });
    if (expired || forbidden || access.data?.isAdmin === false) queryClient.removeQueries({ queryKey: ["/api/admin/users"] });
  }, [expired, forbidden, access.data?.isAdmin, queryClient]);
  if (expired) return <Redirect to={signInUrl} />;

  const denied = access.data?.isAdmin === false || forbidden;
  const page = users.data?.page ?? options.page;
  const hasFilters = options.filters.search || options.filters.company || options.filters.registeredFrom || options.filters.registeredTo
    || options.filters.emailStatus !== "all" || options.filters.accountStatus !== "all";
  return <div className="min-h-[calc(100dvh-4rem)] bg-neutral-50">
    <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div><h1 className="text-2xl font-semibold">Administration</h1><p className="mt-2 text-neutral-600">Application support</p></div>
      {access.data?.isAdmin && !denied && <nav aria-label="Administration sections" className="flex gap-2">
        <Button variant={section === "users" ? "default" : "outline"} aria-pressed={section === "users"} onClick={() => setSection("users")}>App users</Button>
        <Button variant={section === "categories" ? "default" : "outline"} aria-pressed={section === "categories"} onClick={() => setSection("categories")}>Categories</Button>
      </nav>}
      {access.isPending ? <p role="status">Checking support access…</p> : denied ? <div role="alert" className="space-y-3">
        <p>Application support access is required to view this page.</p>
        <Button asChild variant="outline"><Link href="/">Find Services</Link></Button>
      </div> : access.isError ? <div role="alert" className="space-y-3">
        <p>Unable to check support access. Please try again.</p>
        <Button disabled={access.isFetching} onClick={() => void access.refetch()}>Try again</Button>
      </div> : section === "categories" ? <AdminCategories onAccessError={setCategoryAccessError} /> : <section aria-labelledby="app-users-heading" className="border rounded-xl bg-white p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div><h2 id="app-users-heading" className="text-lg font-semibold">App users</h2><p className="text-sm text-neutral-600">All registered accounts, including users who have not signed in.</p></div>
          <Button variant="outline" disabled={users.isFetching} onClick={() => void users.refetch()}>Refresh</Button>
        </div>
        <AdminUserFiltersForm filters={options.filters} onApply={filters => setOptions(previous => ({ ...previous, page: 1, filters }))} />
        {users.isError ? <div role="alert" className="space-y-3"><p>Unable to load registered users. Please try again.</p><Button disabled={users.isFetching} onClick={() => void users.refetch()}>Try again</Button></div>
          : users.isPending ? <p role="status">Loading registered users…</p>
          : <>
            {users.data.users.length === 0 ? <p className="py-6 text-neutral-600">{hasFilters ? "No users match these filters." : "No registered users yet."}</p> : <Table className="min-w-[1100px]">
              <TableCaption>Registered users · Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}</TableCaption>
              <TableHeader><TableRow><TableHead scope="col">Name / User ID</TableHead><TableHead scope="col">Email</TableHead><TableHead scope="col">Email verification</TableHead><TableHead scope="col">Account status</TableHead><TableHead scope="col">Company / organization</TableHead><TableHead scope="col">Registered</TableHead><TableHead scope="col">Last sign-in</TableHead></TableRow></TableHeader>
              <TableBody>{users.data.users.map(user => <TableRow key={user.id}>
                <TableCell><p className="font-medium break-words">{user.name || "Name not provided"}</p><p className="mt-1 text-xs text-neutral-500 break-all">{user.id}</p></TableCell>
                <TableCell className="break-all">{user.email || "Not provided"}</TableCell>
                <TableCell><Badge variant="outline">{!user.email ? "No email" : user.emailVerified ? "Verified" : "Pending verification"}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={user.accountStatus === "blocked" ? "bg-red-50 text-red-800 border-red-200" : "bg-green-50 text-green-800 border-green-200"}>{user.accountStatus === "blocked" ? "Blocked" : "Active"}</Badge></TableCell>
                <TableCell>{user.companies.length === 0 ? <span className="text-neutral-500">No organization</span> : <ul className="space-y-2">{user.companies.map(company => <li key={company.id}>
                  <p className="font-medium break-words">{company.name}</p><p className="text-xs text-neutral-500">{{ owner: "Owner", admin: "Administrator", provider: "Service provider", viewer: "Read-only" }[company.role]}{!company.isActive && " · Closed"}</p>
                </li>)}</ul>}</TableCell>
                <TableCell className="whitespace-nowrap">{dateLabel(user.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap">{dateLabel(user.lastSignInAt)}</TableCell>
              </TableRow>)}</TableBody>
            </Table>}
            <nav aria-label="User directory pages" className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neutral-600" role="status">Page {page} of {users.data.totalPages} · {users.data.total} matching users</p>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="admin-page-size">Users per page</Label><select id="admin-page-size" className="h-9 border rounded-md px-2 bg-white text-sm" value={options.pageSize} disabled={users.isFetching} onChange={event => setOptions(previous => ({ ...previous, page: 1, pageSize: Number(event.target.value) }))}>{[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select>
                <Button variant="outline" disabled={page === 1 || users.isFetching} onClick={() => setOptions(previous => ({ ...previous, page: page - 1 }))}>Previous</Button><Button variant="outline" disabled={!users.data.hasNextPage || users.isFetching} onClick={() => setOptions(previous => ({ ...previous, page: page + 1 }))}>Next</Button>
              </div>
            </nav>
          </>}
      </section>}
    </main>
  </div>;
}
