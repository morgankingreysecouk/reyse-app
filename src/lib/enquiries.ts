// Shared between the public (website-facing) and dashboard (manual-add)
// enquiry creation paths so the two can't validate differently.

export interface EnquiryInput {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  message?: string;
}

export function validateEnquiryInput(body: unknown): { data: EnquiryInput } | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const required = ["fullName", "email", "phone", "businessName"] as const;
  for (const field of required) {
    if (typeof b[field] !== "string" || b[field].trim().length === 0) {
      return { error: `Missing or invalid field: ${field}` };
    }
  }
  if (b.message !== undefined && typeof b.message !== "string") {
    return { error: "Invalid field: message" };
  }
  return {
    data: {
      fullName: (b.fullName as string).trim(),
      email: (b.email as string).trim(),
      phone: (b.phone as string).trim(),
      businessName: (b.businessName as string).trim(),
      message: typeof b.message === "string" ? b.message.trim() : undefined,
    },
  };
}
