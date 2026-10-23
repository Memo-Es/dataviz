/**
 * Fitbit's circular progress-ring badge (Today screen: steps/cardio/sleep rings) -- a pale
 * full-circle track plus a rounded-cap arc for the filled fraction, used anywhere this redesign
 * needs that exact component: ranking rows, the Bento metric tiles, the Story gallery. One
 * shared builder so every ring in the app is pixel-identical, not a one-off per call site.
 */
export function ringSvg(frac: number, color: string, size = 44, stroke = 4): string {
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, frac));
  const dash = clamped * c;
  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="ring-svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke="${color}"
        stroke-width="${stroke}" stroke-dasharray="${dash} ${c}" />
    </svg>
  `;
}
