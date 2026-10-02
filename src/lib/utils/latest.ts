// Each call starts a new attempt; its check says whether a newer attempt has started since.
export function latest(): () => () => boolean {
  let newest = 0;
  return () => {
    const mine = ++newest;
    return () => mine === newest;
  };
}
