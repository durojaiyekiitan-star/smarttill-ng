/** Turns an SDK error into one readable line that includes the wallet provider's reason. */
export function describeError(e: unknown): string {
  const x = e as { message?: string; status?: number; code?: string; description?: string; validationErrors?: unknown; details?: unknown; cause?: unknown };
  const parts = [x?.message ?? String(e)];
  if (x?.status) parts.push(`status ${x.status}`);
  if (x?.code) parts.push(`code ${x.code}`);
  if (x?.description) parts.push(x.description);
  if (x?.validationErrors) parts.push(JSON.stringify(x.validationErrors));
  if (x?.details) parts.push(JSON.stringify(x.details));
  if (x?.cause) parts.push(String((x.cause as { message?: string })?.message ?? x.cause));
  return parts.join(" | ");
}
