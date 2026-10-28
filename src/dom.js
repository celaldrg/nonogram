/**
 * Small DOM helpers. Elements are built with textContent and attributes only, never innerHTML.
 */

/**
 * Creates an element.
 * @param {string} tag
 * @param {{className?: string, text?: string, attrs?: Record<string, string>}} [options]
 * @param {Node[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

/**
 * Translates the static page: data-i18n sets the text, data-i18n-aria the aria-label
 * and data-i18n-title the tooltip of an element.
 * @param {ParentNode} root
 * @param {(key: string) => string} t
 */
export function translateTree(root, t) {
  for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of root.querySelectorAll('[data-i18n-aria]')) node.setAttribute('aria-label', t(node.dataset.i18nAria));
  for (const node of root.querySelectorAll('[data-i18n-title]')) node.title = t(node.dataset.i18nTitle);
}
