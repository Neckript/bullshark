// getUserSettings() returns parsed JSON values (e.g. real booleans), but
// decidePushForUser's TPushDecisionInput expects Record<string, string>
// with 'true'/'false' string values (see push-recipients.ts's `isOn`).
const toStringSettings = (
  settings: Record<string, unknown>
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    out[key] = String(value);
  }
  return out;
};

const stripHtml = (html: string | null): string =>
  (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export { stripHtml, toStringSettings };
