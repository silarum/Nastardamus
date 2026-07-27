import { h } from "./dom.js";
import { iconUrl } from "./assets.js";

export function Icon(name, { size = 24, className = "", alt = "" } = {}) {
  return h("img", {
    className: `n-icon ${className}`.trim(),
    attrs: {
      src: iconUrl(name),
      alt,
      width: size,
      height: size,
      draggable: "false"
    }
  });
}
