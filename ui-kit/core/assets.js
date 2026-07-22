const ROOT = new URL("../assets/", import.meta.url);
export function iconUrl(name) {
  return new URL(`icons/${name}.svg`, ROOT).href;
}
export function artUrl(name) {
  return new URL(`art/${name}.svg`, ROOT).href;
}
