/**
 * Two-to-four-way switches (Beads / Line, Ring / Quadrants...), built on Web Awesome's radio group:
 * one value, arrow-key navigation, a group label for screen readers, all from the library. The
 * look is ours (style.css, ".switch"): a pale track, the picked option on a panel-coloured pill.
 */
import "@awesome.me/webawesome/dist/components/radio-group/radio-group.js";
import "@awesome.me/webawesome/dist/components/radio/radio.js";

type Group = HTMLElement & { value: string | null };

/** markup for a switch; `label` is read out, not shown */
export function segmented(id: string, label: string, options: [value: string, text: string][], value: string, small = false, attrs = "", look = "switch"): string {
  const radios = options.map(([v, t]) => `<wa-radio appearance="button" value="${v}" data-value="${v}">${t}</wa-radio>`).join("");
  return `<wa-radio-group id="${id}" class="${look}${small ? " small" : ""}" orientation="horizontal" label="${label}" value="${value}" ${attrs}>${radios}</wa-radio-group>`;
}

/** a row of chips (one choice among several, wrapping): the same radio group, as pills */
export const chips = (id: string, label: string, options: [value: string, text: string][], value: string, extra = "") =>
  segmented(id, label, options, value, false, "", `chips${extra ? ` ${extra}` : ""}`);

/** call `fn` with the new value whenever the reader picks one */
export function onSegment(el: HTMLElement, fn: (value: string) => void): void {
  el.addEventListener("change", () => fn((el as Group).value ?? ""));
}

/** show `value` as picked, without firing a change */
export function setSegment(el: HTMLElement, value: string): void {
  const g = el as Group;
  if (g.value !== value) g.value = value;
}
