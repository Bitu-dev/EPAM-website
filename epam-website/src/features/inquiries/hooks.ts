import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InquiryStatus, InquirySummary, Page } from "@/lib/api/types";
import { getInquiry, listInquiries, updateInquiryStatus, type InquiryListParams } from "./api";

export const inquiryKeys = {
  all: ["inquiries"] as const,
  list: (p: InquiryListParams) => ["inquiries", "list", p] as const,
};

/** Paginated inbox. Previous page stays on screen while the next one loads, so there is no flicker. */
export function useInquiries(params: InquiryListParams) {
  return useQuery({
    queryKey: inquiryKeys.list(params),
    queryFn: ({ signal }) => listInquiries(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    // No point retrying auth/permission failures; transient errors are already retried inside the http client.
    retry: false,
  });
}

type ListSnapshot = [readonly unknown[], Page<InquirySummary> | undefined][];

/** Optimistic status change with rollback if the server rejects it. */
export function useUpdateInquiryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InquiryStatus }) =>
      updateInquiryStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: inquiryKeys.all });
      const snapshot: ListSnapshot = qc.getQueriesData<Page<InquirySummary>>({
        queryKey: inquiryKeys.all,
      });
      for (const [key, page] of snapshot) {
        if (!page) continue;
        qc.setQueryData<Page<InquirySummary>>(key, {
          ...page,
          items: page.items.map((i) => (i.id === id ? { ...i, status } : i)),
        });
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: inquiryKeys.all }),
  });
}

/** Full inquiry (including the message) for the detail dialog. Only fetched while a row is open. */
export function useInquiry(id: string | null) {
  return useQuery({
    queryKey: ["inquiries", "detail", id] as const,
    queryFn: ({ signal }) => getInquiry(id as string, signal),
    enabled: id !== null,
    staleTime: 30_000,
    retry: false,
  });
}
