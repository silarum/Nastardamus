const ROOT = new URL("../assets/", import.meta.url);
export function iconUrl(name) {
  return new URL(`icons/${name}.svg`, ROOT).href;
}
export function premiumArtUrl(name) {
  return new URL(`art-v2/${name}.png`, ROOT).href;
}
