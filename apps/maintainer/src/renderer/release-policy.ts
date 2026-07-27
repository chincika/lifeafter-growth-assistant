export function withAutomaticNews<T extends object>(release: T, newsEnabled: boolean) {
  return { ...release, includeNews: Boolean(newsEnabled) };
}
