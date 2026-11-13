import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { logout, useLogin, useSessionBootstrap } from "@/features/auth/session";
import { useAuthStore } from "@/lib/api/auth-store";
import { ApiError } from "@/lib/api/http";
import { loginSchema, type InquiryKind, type InquiryStatus } from "@/lib/api/types";
import { useInquiries, useInquiry, useUpdateInquiryStatus } from "./hooks";

const STATUSES: { value: InquiryStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "spam", label: "Spam" },
];
const KINDS: { value: InquiryKind; label: string }[] = [
  { value: "contact", label: "General" },
  { value: "support", label: "Support" },
  { value: "partner", label: "Partner" },
];
const ALL = "all";
const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function InquiriesAdmin() {
  useSessionBootstrap();
  const initialized = useAuthStore((s) => s.initialized);
  const user = useAuthStore((s) => s.user);

  if (!initialized)
    return (
      <p className="p-8 text-center text-sm text-muted-foreground" role="status">
        Loading…
      </p>
    );
  return user ? <Inbox /> : <LoginForm />;
}

function LoginForm() {
  const login = useLogin();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    if (!parsed.success) return setError("Enter a valid email and password.");
    setError(null);
    login.mutate(parsed.data, {
      onError: (err) =>
        setError(
          err instanceof ApiError && err.status === 429
            ? err.message
            : "Invalid email or password.",
        ),
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-16 max-w-sm space-y-4 rounded-xl bg-card p-6 shadow-sm"
      noValidate
    >
      <h1 className="text-2xl font-semibold text-primary">Staff sign in</h1>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={255}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function Inbox() {
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<InquiryStatus | undefined>();
  const [kind, setKind] = useState<InquiryKind | undefined>();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());

  useEffect(() => setPage(0), [status, kind, q]);

  const { data, isPending, isFetching, isError, error, refetch } = useInquiries({
    page,
    size: PAGE_SIZE,
    status,
    kind,
    q: q || undefined,
  });
  const update = useUpdateInquiryStatus();
  const [openId, setOpenId] = useState<string | null>(null);

  function changeStatus(id: string, next: InquiryStatus) {
    update.mutate(
      { id, status: next },
      { onError: () => toast.error("Could not update the status.") },
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Inquiries</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user?.fullName} ({user?.role})
          </p>
        </div>
        <Button variant="outline" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="inq-search" className="sr-only">
            Search by name or email
          </label>
          <Input
            id="inq-search"
            placeholder="Search name or email…"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterSelect label="Status" value={status} options={STATUSES} onChange={setStatus} />
        <FilterSelect label="Type" value={kind} options={KINDS} onChange={setKind} />
      </div>

      <div className="mt-6 rounded-xl bg-card shadow-sm" aria-busy={isFetching}>
        {isError ? (
          <div role="alert" className="space-y-3 p-8 text-center">
            <p className="text-sm text-destructive">
              {error instanceof ApiError && error.status === 403
                ? "You don't have access to this page."
                : "Could not load inquiries."}
            </p>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : isPending ? (
          <div className="space-y-2 p-4" role="status" aria-label="Loading inquiries">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No inquiries match your filters.
          </p>
        ) : (
          <Table>
            <TableCaption className="sr-only">Inquiries, newest first</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(i.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.email}
                      {i.organization ? ` · ${i.organization}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{KINDS.find((k) => k.value === i.kind)?.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <label className="sr-only" htmlFor={`st-${i.id}`}>
                      Status for {i.name}
                    </label>
                    <select
                      id={`st-${i.id}`}
                      value={i.status}
                      onChange={(e) => changeStatus(i.id, e.target.value as InquiryStatus)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenId(i.id)}
                      aria-label={`Read message from ${i.name}`}
                    >
                      Read
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <InquiryDialog id={openId} onClose={() => setOpenId(null)} />

      {data && data.totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          <span className="text-sm text-muted-foreground">
            Page {data.page + 1} of {data.totalPages} · {data.totalElements} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.last}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : (v as T))}>
      <SelectTrigger className="w-40" aria-label={`Filter by ${label.toLowerCase()}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label === "Type" ? "types" : "statuses"}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InquiryDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isPending, isError } = useInquiry(id);
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{data ? data.name : "Inquiry"}</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.email}${data.organization ? ` · ${data.organization}` : ""} · ${new Date(data.createdAt).toLocaleString()}`
              : "Message details"}
          </DialogDescription>
        </DialogHeader>
        {isError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load this message.
          </p>
        ) : isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-sm">
            {data.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
