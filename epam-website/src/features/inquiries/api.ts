import { apiRequest } from "@/lib/api/http";
import {
  inquiryDetailSchema,
  inquirySummarySchema,
  pageSchema,
  type InquiryKind,
  type InquiryStatus,
} from "@/lib/api/types";

export interface InquiryListParams {
  page: number;
  size: number;
  status?: InquiryStatus | undefined;
  kind?: InquiryKind | undefined;
  q?: string | undefined;
}

const listSchema = pageSchema(inquirySummarySchema);

export const listInquiries = (params: InquiryListParams, signal?: AbortSignal) =>
  apiRequest("/admin/inquiries", listSchema, {
    query: { ...params },
    signal,
  });

export const getInquiry = (id: string, signal?: AbortSignal) =>
  apiRequest(`/admin/inquiries/${encodeURIComponent(id)}`, inquiryDetailSchema, { signal });

export const updateInquiryStatus = (id: string, status: InquiryStatus) =>
  apiRequest(`/admin/inquiries/${encodeURIComponent(id)}/status`, inquiryDetailSchema, {
    method: "PATCH",
    body: { status },
  });
