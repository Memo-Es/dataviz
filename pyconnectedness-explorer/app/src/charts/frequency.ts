/** Words for the library's frequency_connectedness bands (Baruník-Křehlík 2018), shown in graph
 * 1's readout. The cut-offs are 5 and 20 time steps of the dataset: weeks, days or months. */
import type { FrequencyBand } from "../data";
import { STEP } from "../encoding";

export function bandCopy(label: FrequencyBand["label"]) {
  const u = STEP.steps;
  return {
    "<=5": { name: "Short term", short: `Within 5 ${u}`, phrase: `within 5 ${u}`, cls: "fast" },
    "5-20": { name: "Medium term", short: `5 to 20 ${u}`, phrase: `over 5 to 20 ${u}`, cls: "mid" },
    ">20": { name: "Long term", short: `Over 20 ${u}`, phrase: `over more than 20 ${u}`, cls: "slow" },
  }[label];
}
