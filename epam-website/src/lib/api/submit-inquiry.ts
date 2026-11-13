import { apiRequest } from "./http";
import { inquiryReceiptSchema, submitInquirySchema, type SubmitInquiryInput } from "./types";

/** Sends a contact / partner / support inquiry to the backend. Input is validated with zod first. Throws on failure. */
export async function submitInquiry(input: SubmitInquiryInput): Promise<void> {
  const data = submitInquirySchema.parse(input);
  await apiRequest("/inquiries", inquiryReceiptSchema, { method: "POST", body: data, auth: false });
}
