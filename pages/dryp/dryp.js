await import("./dryp.scss");

export function init() {
  Alpine.data("dryp", () => ({
    message: "Welcome to the Dryp Page!",
  }));
}
