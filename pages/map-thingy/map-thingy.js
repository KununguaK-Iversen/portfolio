await import("./map-thingy.scss");
import { si9gag } from "simple-icons";

export function init() {
  // add new icons to store (simple-icons needs svg parse)
  const iconsStore = Alpine.store("icons");
  Object.assign(iconsStore, {
    gag9: window.simpleIconsToSvg(si9gag),
  });

  Alpine.data("mapthingy", () => ({
    message: "Welcome to the Map-thingy Page!",
  }));
}
