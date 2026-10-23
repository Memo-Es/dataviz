import type { World } from "../world";

/** Every layout (bento/shell/story) implements this. mount() builds the layout's own DOM and
 * chart instances once inside `root`; render() is called on every store change and should be
 * cheap (it recomputes the current frame and pushes it into the already-built chart instances --
 * never rebuild DOM in render()). unmount() tears down timers/listeners the layout itself owns
 * (store subscriptions are managed by main.ts, not here). */
export interface LayoutController {
  mount(root: HTMLElement, world: World): void;
  render(): void;
  unmount?(): void;
}
