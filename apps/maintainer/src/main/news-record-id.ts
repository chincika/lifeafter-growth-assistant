export interface NewsRecordIdentityInput {
  previousId?: string;
  previousImageFile?: string;
  previousImageUrl?: string;
  nextImageFile?: string;
  nextImageUrl?: string;
  generateId: () => string;
}

export function resolveNewsRecordId(input: NewsRecordIdentityInput): string {
  if (!input.previousId) return input.generateId();
  const imageChanged =
    (input.previousImageFile ?? "") !== (input.nextImageFile ?? "") ||
    (input.previousImageUrl ?? "") !== (input.nextImageUrl ?? "");
  return imageChanged ? input.generateId() : input.previousId;
}
