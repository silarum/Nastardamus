export function append(parent, child) {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) {
    child.forEach((item) => append(parent, item));
    return;
  }
  parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
}

export function h(tag, options = {}, ...children) {
  const node = document.createElement(tag);
  const { className, text, html, attrs = {}, dataset = {}, on = {}, style = {} } = options;
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (html !== undefined) node.innerHTML = html;
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === false || value === null || value === undefined) return;
    if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  });
  Object.entries(dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  Object.entries(on).forEach(([event, handler]) => node.addEventListener(event, handler));
  Object.assign(node.style, style);
  children.forEach((child) => append(node, child));
  return node;
}

export function fragment(...children) {
  const node = document.createDocumentFragment();
  children.forEach((child) => append(node, child));
  return node;
}
