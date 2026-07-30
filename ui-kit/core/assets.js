const ROOT = "/ui-kit/assets/";
const WEBP_ART = new Set(["palm-oracle", "rune-sanctum", "amur-dice"]);
export function iconUrl(name) {
  return `${ROOT}icons/${name}.svg`;
}
export function premiumArtUrl(name) {
  return `${ROOT}art-v2/${name}.${WEBP_ART.has(name) ? "webp" : "png"}`;
}
