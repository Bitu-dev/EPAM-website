import { z } from "zod";

/**
 * Runtime schemas mirroring the Spring Boot DTOs. Types are inferred from the schemas,
 * so a response that drifts from the contract fails loudly at the boundary instead of deep inside the UI.
 */

export const inquiryKindSchema = z.enum(["contact", "partner", "support"]);
export type InquiryKind = z.infer<typeof inquiryKindSchema>;

export const inquiryStatusSchema = z.enum(["new", "in_progress", "resolved", "spam"]);
export type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

export const roleSchema = z.enum(["ADMIN", "STAFF"]);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  fullName: z.string(),
  role: roleSchema,
});
export type User = z.infer<typeof userSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number(),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const inquirySummarySchema = z.object({
  id: z.string().uuid(),
  kind: inquiryKindSchema,
  status: inquiryStatusSchema,
  name: z.string(),
  email: z.string(),
  organization: z.string().nullish(),
  createdAt: z.string(),
});
export type InquirySummary = z.infer<typeof inquirySummarySchema>;

export const inquiryDetailSchema = inquirySummarySchema.extend({
  message: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string().nullish(),
  version: z.number(),
});
export type InquiryDetail = z.infer<typeof inquiryDetailSchema>;

export const inquiryReceiptSchema = z.object({ id: z.string().uuid(), receivedAt: z.string() });

export const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number(),
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
    last: z.boolean(),
  });
export type Page<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

/** Standard envelope: ApiResponse<T> on the backend. */
export const envelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    data: data.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
      })
      .optional(),
    requestId: z.string().optional(),
    timestamp: z.string().optional(),
  });

/** Client-side form validation: same limits as the backend's Bean Validation and the DB CHECK constraints. */
export const submitInquirySchema = z.object({
  kind: inquiryKindSchema,
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  organization: z.string().trim().max(200).nullable(),
  message: z.string().trim().min(1).max(3000),
});
export type SubmitInquiryInput = z.infer<typeof submitInquirySchema>;

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;
