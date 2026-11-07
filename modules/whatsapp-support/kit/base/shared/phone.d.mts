export function phoneDigits(value: unknown): string | null;
export function brPhoneVariants(value: unknown): string[];
export function contactPhone(contact: { phone_number?: string | null; identifier?: string | null } | null | undefined): string | null;
export function samePhone(a: unknown, b: unknown): boolean;
