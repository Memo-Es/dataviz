/** Words for the library's frequency_connectedness bands (Baruník-Křehlík 2018), shown in
 * graph 1's readout when a period is picked. */
import type { FrequencyBand, FrequencyBlock } from "../data";
import { fmtSigned } from "../encoding";

export const BAND_COPY: Record<FrequencyBand["label"], { name: string; short: string; phrase: string; cls: string }> = {
  "<=5": { name: "Short term", short: "Within 5 weeks", phrase: "within 5 weeks", cls: "fast" },
  "5-20": { name: "Medium term", short: "5 to 20 weeks", phrase: "over 5 to 20 weeks", cls: "mid" },
  ">20": { name: "Long term", short: "Over 20 weeks", phrase: "over more than 20 weeks", cls: "slow" },
};

