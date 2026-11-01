// Panels drawn on a canvas that textures a plane, for VR and a screen alike: text, buttons,
// pictures, rectangles, sliders, lists that scroll, and elements that draw themselves. A panel is
// hit by the uv where a ray meets its plane (u, v from 0 to 1, from its bottom left), so one works
// with a mouse, a finger, a gamepad's dot, a TV's remote and a VR controller. vrlbry's
// public/js/ui/panel.js (AriaMoKr/vrlbry at eb0dfab), with what outside's copy (its canvas-panel.js
// at fadc2e1) and music's (e665a2e) add: a ray over it allocates nothing, set redraws only on a
// change, a size by the canvas's width, an outline round the row pointed at, and elements of a
// site's own. It is redrawn only when something on it changes, never per frame.
import * as THREE from 'three';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif", serif';
const BAR_W = 56; // a list's scroll bar: its ▲ and ▼ are squares this wide

/**
 * The faces and colours panels are drawn in, for a site's own drawing to match.
 * @type {{ font: string, serif: string, text: string, muted: string, accent: string, button: string, buttonHover: string, buttonActive: string, border: string }}
 */
export const UI = {
  font: FONT,
  serif: SERIF,
  text: '#f1e6d0',
  muted: '#b6a487',
  accent: '#d9b26a',
  button: '#3a2e22',
  buttonHover: '#5b4630',
  buttonActive: '#8f6c34',
  border: 'rgba(217,178,106,0.45)',
};

/**
 * What is on a panel, as its type says.
 * @typedef {TextElement | ButtonElement | SliderElement | ListElement | ImageElement | RectElement | CustomElement} PanelElement
 */
/**
 * Where an element is: x, y its top left and w × h, in its panel's canvas pixels; id, what get and
 * set find it by; hidden, neither drawn nor pointed at.
 * @typedef {{ id?: string, x: number, y: number, w: number, h: number, hidden?: boolean }} Box
 */
/**
 * What a pointer can use (a button, a slider or a list), unless it is disabled. pointerMove marks
 * where on it the pointer is: hoverRow a list's (ListRow), hoverValue a slider's value (null when not).
 * @typedef {ButtonElement | SliderElement | ListElement} Control
 */
/** A Box a pointer can use: a Control's fields. @typedef {Box & { disabled?: boolean, hoverRow?: ListRow | null, hoverValue?: number | null }} Usable */
/** Where on a list a pointer is: a row shown, from 0 at its top, or its scroll bar's ▲, ▼ or track. @typedef {number | 'up' | 'down' | 'track'} ListRow */
/**
 * Text in the lines that fit w (as many as fit h, or maxLines; the last with an ellipsis if it runs
 * over), size pixels high (34), from the top of h or in its middle.
 * @typedef {Box & { type: 'text', text: string, size?: number, weight?: string, serif?: boolean, color?: string, align?: CanvasTextAlign, valign?: 'middle', maxLines?: number }} TextElement
 */
/**
 * A button, its label on one line: lit while pointed at, drawn pressed while active; onClick(el)
 * when it is used.
 * @typedef {Usable & { type: 'button', label: string, size?: number, weight?: string, serif?: boolean, color?: string, radius?: number, active?: boolean, onClick?: (el: ButtonElement) => void }} ButtonElement
 */
/**
 * A slider, its value 0…1 from its left; used, it is set to the value there, and onClick(value, el).
 * @typedef {Usable & { type: 'slider', value?: number, onClick?: (value: number, el: SliderElement) => void }} SliderElement
 */
/**
 * A list, its items in rows rowH high (64), as many as fit h, from the item scroll down. With more
 * than fit, a scroll bar at its right: ▲ and ▼ a page up or down, and a thumb to drag (pressAt). What
 * is used is an item.
 * @typedef {Usable & { type: 'list', items: ListItem[], rowH?: number, size?: number, serif?: boolean, scroll?: number }} ListElement
 */
/**
 * A list's entry: its label, sub under it and right at the row's end, indent steps in; marked while
 * active; onClick(it) when it is used (unless disabled), or onClick() from a key.
 * @typedef {{ label: string, sub?: string, right?: string, weight?: string, indent?: number, active?: boolean, disabled?: boolean, onClick?: (it?: ListItem) => void }} ListItem
 */
/**
 * A picture as large as fits the box, in its middle, a shadow under it; until it has a size, a
 * placeholder.
 * @typedef {Box & { type: 'image', image?: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null }} ImageElement
 */
/** A rectangle filled with color (a faint white), its corners rounded by radius (0). @typedef {Box & { type: 'rect', color?: string, radius?: number }} RectElement */
/**
 * An element that draws itself: draw(g, el), each time the panel is redrawn (music's piano roll).
 * Its other fields are the site's.
 * @typedef {Box & { type: 'custom', draw?: (g: CanvasRenderingContext2D, el: CustomElement) => void } & Record<string, unknown>} CustomElement
 */
/** How an element is drawn: Panel's method named _draw_ and its type (redraw finds it by name). @typedef {(g: CanvasRenderingContext2D, el: PanelElement) => void} Draw */
/**
 * A list's scroll bar, between its ▲ and ▼: its left x and width, the track, the thumb (its height
 * shows how much of the list is shown), the largest scroll and the rows shown.
 * @typedef {{ x: number, barW: number, trackY: number, trackH: number, thumbH: number, thumbY: number, max: number, visible: number }} ScrollBar
 */

/**
 * A canvas for a panel: the page's, or a stand-in where there is none (Node).
 * @callback CanvasFactory
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */

/** @type {CanvasFactory} */
const pageCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * A panel's size and look.
 * @typedef {object} PanelOptions
 * @property {number} width its size where it is put, in metres (or the site's units)
 * @property {number} height
 * @property {number} [pxPerMeter] its canvas's pixels for each of those (1200), at most 2048 a side
 * @property {number} [px] instead, its canvas's width in pixels, its height in proportion
 * @property {string | null} [background] behind what is on it, a CSS colour, or none
 * @property {number} [radius] its corners', in canvas pixels
 * @property {number} [anisotropy] its texture's anisotropic filtering
 * @property {number} [ring] the outline round the list row pointed at, its width in canvas pixels: 0 for none
 * @property {CanvasFactory} [canvas] makes its canvas: the page's by default
 */

/**
 * A rectangle's path with its corners rounded (r, or less on a small one), to fill or stroke.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/**
 * Text in lines that fit `width`, at the font set on `g`; the last allowed line gets an ellipsis.
 * @param {CanvasRenderingContext2D} g
 * @param {string} text
 * @param {number} width
 * @param {number} [maxLines]
 * @returns {string[]}
 */
export function wrapText(g, text, width, maxLines = Infinity) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (g.measureText(t).width <= width || !cur) cur = t;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
  }
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && g.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return out;
}

/** A panel: its canvas, the texture on it and the plane it textures, and what is drawn there. */
export class Panel {
  /** @param {PanelOptions} options */
  constructor({ width, height, pxPerMeter = 1200, px, background = 'rgba(25,20,16,0.93)', radius = 28, anisotropy = 4, ring = 0, canvas = pageCanvas }) {
    this.width = width;
    this.height = height;
    let w, h;
    if (px != null) {
      w = Math.round(px);
      h = Math.round((px * height) / width);
    } else {
      const scale = Math.min(1, 2048 / Math.max(width * pxPerMeter, height * pxPerMeter));
      w = Math.round(width * pxPerMeter * scale);
      h = Math.round(height * pxPerMeter * scale);
    }
    this.canvas = canvas(w, h);
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d')); // a new canvas always has one
    this.background = background;
    this.radius = radius;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    // forceSinglePass: three draws a transparent double-sided material in two passes (back, then
    // front), flagging it needsUpdate around each: its whole program parameters were rebuilt 4
    // times a frame in VR (two eyes), the main garbage of a still frame on a Quest. A flat panel
    // looks the same in one pass.
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.mesh.userData.panel = this;
    this.mesh.renderOrder = 10;
    /** What is on it, drawn in this order. @type {PanelElement[]} */
    this.elements = [];
    /** What a pointer is on (pointerMove's), lit. @type {Control | null} */
    this.hover = null;
    /**
     * The outline round the list row pointed at, its width in canvas pixels: 0 for none, as vrlbry
     * has it; 2 outside's; 4 music's on a TV, its remote's highlight seen from the sofa.
     */
    this.ring = ring;
    this.dirty = true;
    /** @private Where a ray meets it, in canvas pixels (_toPx): the same object each time. */
    this._p = { x: 0, y: 0 };
    /** @private @type {ScrollBar} the same object each time (_scrollBar) */
    this._sb = { x: 0, barW: BAR_W, trackY: 0, trackH: 0, thumbH: 0, thumbY: 0, max: 0, visible: 0 };
    /**
     * @private A scroll bar being dragged (pressAt): its list, where on the thumb it was taken, and
     * while the panel is refilled (clear) the id of the list it carries on with.
     * @type {{ el: ListElement, grab: number, id: string | null } | null}
     */
    this._drag = null;
  }

  /** Its canvas's width and height, in pixels: what its elements' boxes are in. */
  get w() { return this.canvas.width; }
  get h() { return this.canvas.height; }

  get visible() { return this.mesh.visible; }
  set visible(v) {
    this.mesh.visible = v;
    if (!v) this.pointerLeave();
  }

  /** Takes everything off it. */
  clear() {
    this.elements = [];
    this.hover = null;
    // A scroll bar being dragged carries on with the list of the same id that replaces it.
    if (this._drag) this._drag.id = this._drag.el.id ?? null;
    this.markDirty();
  }

  /**
   * Adds an element; returns it. Elements are drawn in the order they were added.
   * @param {PanelElement} el
   */
  add(el) {
    if (this._drag?.id && this._drag.id === el.id && el.type === 'list') {
      this._drag.el = el;
      this._drag.id = null;
    }
    this.elements.push(el);
    this.markDirty();
    return el;
  }

  /** Takes the element with this id off it. @param {string} id */
  remove(id) {
    this.elements = this.elements.filter((e) => e.id !== id);
    this.markDirty();
  }

  /** The element with this id, if there is one. @param {string} id */
  get(id) {
    return this.elements.find((e) => e.id === id);
  }

  /**
   * Changes fields of an element by id, redrawn only when one of them is new.
   * @param {string} id
   * @param {Record<string, unknown>} fields its fields' new values, by name
   */
  set(id, fields) {
    const el = this.get(id);
    if (!el) return el;
    for (const k in fields) {
      if (/** @type {Record<string, unknown>} */ (el)[k] !== fields[k]) {
        /** @type {Record<string, unknown>} */ (el)[k] = fields[k];
        this.markDirty();
      }
    }
    return el;
  }

  markDirty() {
    this.dirty = true;
  }

  /** Repaints if anything changed. Once a frame: nothing is done when nothing did. */
  update() {
    if (this.dirty) this.redraw();
  }

  redraw() {
    this.dirty = false;
    const g = this.ctx;
    g.clearRect(0, 0, this.w, this.h);
    if (this.background) {
      roundRect(g, 2, 2, this.w - 4, this.h - 4, this.radius);
      g.fillStyle = this.background;
      g.fill();
      g.strokeStyle = UI.border;
      g.lineWidth = 3;
      g.stroke();
    }
    for (const el of this.elements) {
      if (el.hidden) continue;
      const fn = /** @type {Draw | undefined} */ (this[`_draw_${el.type}`]); // the one for its type, so el is what it takes
      if (fn) fn.call(this, g, el);
    }
    this.texture.needsUpdate = true;
  }

  /**
   * An element's font, size pixels high: the serif face or the sans.
   * @protected
   * @param {{ serif?: boolean }} el
   * @param {number} size
   * @param {string} [weight]
   */
  _font(el, size, weight = '') {
    return `${weight} ${size}px ${el.serif ? SERIF : FONT}`.trim();
  }

  /**
   * @protected
   * @param {CanvasRenderingContext2D} g
   * @param {CustomElement} el
   */
  _draw_custom(g, el) {
    el.draw?.(g, el);
  }

  /**
   * @protected
   * @param {CanvasRenderingContext2D} g
   * @param {RectElement} el
   */
  _draw_rect(g, el) {
    roundRect(g, el.x, el.y, el.w, el.h, el.radius ?? 0);
    g.fillStyle = el.color || 'rgba(255,255,255,0.08)';
    g.fill();
  }

  /**
   * @protected
   * @param {CanvasRenderingContext2D} g
   * @param {TextElement} el
   */
  _draw_text(g, el) {
    const size = el.size || 34;
    g.font = this._font(el, size, el.weight || '');
    g.fillStyle = el.color || UI.text;
    g.textBaseline = 'top';
    g.textAlign = el.align || 'left';
    const lines = wrapText(g, el.text, el.w, el.maxLines ?? Math.max(1, Math.floor(el.h / (size * 1.25))));
    const lh = size * 1.25;
    let y = el.y;
    if (el.valign === 'middle') y = el.y + (el.h - lines.length * lh) / 2;
    const x = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x;
    for (const line of lines) {
      g.fillText(line, x, y);
      y += lh;
    }
  }

  /**
   * @protected
   * @param {CanvasRenderingContext2D} g
   * @param {ImageElement} el
   */
  _draw_image(g, el) {
    const img = el.image;
    const iw = img ? /** @type {HTMLImageElement} */ (img).naturalWidth || img.width : 0; // a picture's own size, else a canvas's
    if (!img || !iw) {
      roundRect(g, el.x, el.y, el.w, el.h, 8);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fill();
      return;
    }
    const ih = /** @type {HTMLImageElement} */ (img).naturalHeight || img.height;
    const s = Math.min(el.w / iw, el.h / ih);
    const w = iw * s;
    const h = ih * s;
    const x = el.x + (el.w - w) / 2;
    const y = el.y + (el.h - h) / 2;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 16;
    g.shadowOffsetY = 6;
    g.drawImage(img, x, y, w, h);
    g.restore();
  }

  /**
   * @protected
   * @param {CanvasRenderingContext2D} g
   * @param {ButtonElement} el
   */
  _draw_button(g, el) {
    const hover = this.hover === el && !el.disabled;
    roundRect(g, el.x, el.y, el.w, el.h, el.radius ?? 16);
    g.fillStyle = el.disabled ? 'rgba(80,70,60,0.5)' : el.active ? UI.buttonActive : hover ? UI.buttonHover : (el.color || UI.button);
    g.fill();
    if (hover || el.active) {
      g.strokeStyle = UI.accent;
      g.lineWidth = 3;
      g.stroke();
    }
    const size = el.size || Math.min(40, el.h * 0.45);
    g.font = this._font(el, size, el.weight || '600');
    g.fillStyle = el.disabled ? '#857868' : UI.text;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(wrapText(g, el.label, el.w - 16, 1)[0], el.x + el.w / 2, el.y + el.h / 2 + 1);
  }

  /**
   * @protected
   * @param {CanvasRenderingContext2D} g
   * @param {SliderElement} el
   */
  _draw_slider(g, el) {
    const v = Math.max(0, Math.min(1, el.value || 0));
    const hover = this.hover === el;
    const barH = Math.max(8, el.h * 0.22);
    const y = el.y + (el.h - barH) / 2;
    roundRect(g, el.x, y, el.w, barH, barH / 2);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fill();
    roundRect(g, el.x, y, Math.max(barH, el.w * v), barH, barH / 2);
    g.fillStyle = UI.accent;
    g.fill();
    g.beginPath();
    g.arc(el.x + el.w * v, el.y + el.h / 2, hover ? barH * 1.3 : barH, 0, Math.PI * 2);
    g.fillStyle = '#f6e7c4';
    g.fill();
    if (hover && el.hoverValue != null) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(el.x + el.w * el.hoverValue - 1, el.y, 2, el.h);
    }
  }

  /**
   * @protected
   * @param {CanvasRenderingContext2D} g
   * @param {ListElement} el
   */
  _draw_list(g, el) {
    const rowH = el.rowH || 64;
    const visible = Math.floor(el.h / rowH);
    const items = el.items || [];
    el.scroll = Math.max(0, Math.min(el.scroll || 0, Math.max(0, items.length - visible)));
    const barW = items.length > visible ? BAR_W : 0;
    for (let i = 0; i < visible && el.scroll + i < items.length; i++) {
      const it = items[el.scroll + i];
      const y = el.y + i * rowH;
      const hover = this.hover === el && el.hoverRow === i;
      if (hover || it.active) {
        roundRect(g, el.x, y + 2, el.w - barW - 8, rowH - 4, 10);
        g.fillStyle = it.active ? 'rgba(143,108,52,0.55)' : 'rgba(255,255,255,0.10)';
        g.fill();
        if (hover && this.ring > 0) {
          g.strokeStyle = UI.accent;
          g.lineWidth = this.ring;
          g.stroke();
        }
      }
      const size = el.size || Math.min(32, rowH * 0.42);
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      const indent = (it.indent || 0) * size * 0.9;
      // The right column is as wide as its text in its own font: the label stops a fifth of the
      // size before it, and before the 18 px it is drawn in from the row's end.
      let right = 0;
      if (it.right) {
        g.font = this._font(el, size * 0.8);
        right = g.measureText(it.right).width + 18 + size * 0.2;
      }
      g.font = this._font(el, size, it.weight || '');
      g.fillStyle = it.disabled ? '#857868' : UI.text;
      const textW = el.w - barW - 28 - indent - right;
      if (it.sub) {
        g.fillText(wrapText(g, it.label, textW, 1)[0], el.x + 14 + indent, y + rowH * 0.36);
        g.font = this._font(el, size * 0.72);
        g.fillStyle = UI.muted;
        g.fillText(wrapText(g, it.sub, textW, 1)[0], el.x + 14 + indent, y + rowH * 0.72);
      } else {
        g.fillText(wrapText(g, it.label, textW, 1)[0], el.x + 14 + indent, y + rowH / 2);
      }
      if (it.right) {
        g.font = this._font(el, size * 0.8);
        g.fillStyle = UI.muted;
        g.textAlign = 'right';
        g.fillText(it.right, el.x + el.w - barW - 18, y + rowH / 2);
      }
    }
    const sb = this._scrollBar(el);
    if (sb) {
      // Scroll arrows, and the thumb where the list is.
      for (const [label, by] of /** @type {const} */ ([['▲', el.y], ['▼', el.y + el.h - BAR_W]])) {
        const hover = this.hover === el && el.hoverRow === (label === '▲' ? 'up' : 'down');
        roundRect(g, sb.x, by, BAR_W, BAR_W, 12);
        g.fillStyle = hover ? UI.buttonHover : UI.button;
        g.fill();
        g.fillStyle = UI.text;
        g.font = this._font(el, 26);
        g.textAlign = 'center';
        g.fillText(label, sb.x + BAR_W / 2, by + BAR_W / 2 + 1);
      }
      const hot = this._drag?.el === el || (this.hover === el && el.hoverRow === 'track');
      const tw = hot ? 20 : 12;
      roundRect(g, sb.x + BAR_W / 2 - tw / 2, sb.thumbY, tw, sb.thumbH, tw / 2);
      g.fillStyle = hot ? 'rgba(232,196,124,0.95)' : 'rgba(217,178,106,0.6)';
      g.fill();
    }
  }

  /**
   * Scrolls the list with this id by `rows` (positive: down).
   * @param {string} id
   * @param {number} rows
   */
  scrollList(id, rows) {
    const el = this.get(id);
    if (el?.type === 'list') this.scrollBy(el, rows);
  }

  /**
   * Scrolls a list of this panel's by `rows`, within its ends (as it is drawn).
   * @param {ListElement} el
   * @param {number} rows
   */
  scrollBy(el, rows) {
    const max = Math.max(0, (el.items?.length ?? 0) - Math.floor(el.h / (el.rowH || 64)));
    el.scroll = Math.max(0, Math.min(max, (el.scroll || 0) + rows));
    this.markDirty();
  }

  /** Whether an element is a list with more rows than it shows. @param {PanelElement} el */
  scrolls(el) {
    return el.type === 'list' && (el.items?.length ?? 0) > Math.floor(el.h / (el.rowH || 64));
  }

  /**
   * (u, v), from 0 to 1 from its bottom left, in the canvas's pixels: the same object each time.
   * @protected
   * @param {number} u
   * @param {number} v
   */
  _toPx(u, v) {
    this._p.x = u * this.w;
    this._p.y = (1 - v) * this.h;
    return this._p;
  }

  /**
   * The Control at p (in the canvas's pixels), disabled or not, the one added last on top; or null.
   * @protected
   * @param {{ x: number, y: number }} p
   * @returns {Control | null}
   */
  _hit(p) {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (el.hidden || (el.type !== 'button' && el.type !== 'slider' && el.type !== 'list')) continue;
      if (p.x >= el.x && p.x <= el.x + el.w && p.y >= el.y && p.y <= el.y + el.h) return el;
    }
    return null;
  }

  /**
   * Where on a list p (in the canvas's pixels, on it) is: a row shown, or its scroll bar's ▲, ▼ or
   * track; null below its last row.
   * @protected
   * @param {ListElement} el
   * @param {{ x: number, y: number }} p
   * @returns {ListRow | null}
   */
  _listRow(el, p) {
    const rowH = el.rowH || 64;
    const visible = Math.floor(el.h / rowH);
    if ((el.items?.length ?? 0) > visible && p.x >= el.x + el.w - BAR_W) {
      if (p.y <= el.y + BAR_W) return 'up';
      if (p.y >= el.y + el.h - BAR_W) return 'down';
      return 'track';
    }
    const row = Math.floor((p.y - el.y) / rowH);
    return row < visible ? row : null;
  }

  /**
   * A list's scroll bar (null when everything fits): the same object each time.
   * @protected
   * @param {ListElement} el
   * @returns {ScrollBar | null}
   */
  _scrollBar(el) {
    const rowH = el.rowH || 64;
    const visible = Math.floor(el.h / rowH);
    const n = el.items?.length ?? 0;
    if (n <= visible) return null;
    const sb = this._sb;
    sb.x = el.x + el.w - BAR_W;
    sb.trackY = el.y + BAR_W + 8;
    sb.trackH = el.h - 2 * BAR_W - 16;
    sb.max = n - visible;
    sb.visible = visible;
    sb.thumbH = Math.max(30, sb.trackH * (visible / n));
    sb.thumbY = sb.trackY + (sb.trackH - sb.thumbH) * ((el.scroll || 0) / sb.max);
    return sb;
  }

  /**
   * The element that can be used at (u, v), or null: a button or a slider not disabled, a list on a
   * row of an item not disabled or on its scroll bar.
   * @param {number} u
   * @param {number} v
   * @returns {Control | null}
   */
  elementAt(u, v) {
    const p = this._toPx(u, v);
    const el = this._hit(p);
    if (!el || el.disabled) return null;
    if (el.type === 'list') {
      const row = this._listRow(el, p);
      if (typeof row !== 'number') return row ? el : null;
      const it = el.items?.[(el.scroll || 0) + row];
      return it && !it.disabled ? el : null;
    }
    return el;
  }

  /**
   * A press at (u, v): on a list's scroll bar it starts dragging the thumb (pressing the track
   * beside the thumb first jumps a page towards the press). Returns true when it did; dragTo and
   * release follow.
   * @param {number} u
   * @param {number} v
   */
  pressAt(u, v) {
    const p = this._toPx(u, v);
    const el = this._hit(p);
    if (el?.type !== 'list' || el.disabled || this._listRow(el, p) !== 'track') return false;
    let sb = this._scrollBar(el);
    if (!sb) return false;
    if (p.y < sb.thumbY || p.y > sb.thumbY + sb.thumbH) {
      this.scrollBy(el, (p.y < sb.thumbY ? -1 : 1) * Math.max(1, sb.visible - 1));
      sb = /** @type {ScrollBar} */ (this._scrollBar(el)); // the same list, so still one
    }
    this._drag = { el, grab: Math.max(0, Math.min(sb.thumbH, p.y - sb.thumbY)), id: null };
    this.markDirty();
    return true;
  }

  /**
   * Moves a dragged scroll bar's thumb to follow (u, v), which may have left the bar meanwhile.
   * @param {number} u
   * @param {number} v
   */
  dragTo(u, v) {
    if (!this._drag) return;
    const { el, grab } = this._drag;
    const sb = this._scrollBar(el);
    if (!sb) return;
    const p = this._toPx(u, v);
    const t = (p.y - grab - sb.trackY) / Math.max(1, sb.trackH - sb.thumbH);
    const scroll = Math.round(Math.max(0, Math.min(1, t)) * sb.max);
    if (scroll !== el.scroll) {
      el.scroll = scroll;
      this.markDirty();
    }
  }

  /** Ends a scroll bar's drag. Returns true when one was going on. */
  release() {
    const was = !!this._drag;
    this._drag = null;
    if (was) this.markDirty();
    return was;
  }

  /** True while a scroll bar is being dragged. */
  get dragging() { return !!this._drag; }

  /**
   * Hover feedback at (u, v); whether something usable is there.
   * @param {number} u
   * @param {number} v
   */
  pointerMove(u, v) {
    const p = this._toPx(u, v);
    const el = this._hit(p);
    const row = el?.type === 'list' ? this._listRow(el, p) : null;
    const hv = el?.type === 'slider' ? Math.max(0, Math.min(1, (p.x - el.x) / el.w)) : null;
    if (el !== this.hover || (el && (el.hoverRow !== row || el.hoverValue !== hv))) {
      if (this.hover && this.hover !== el) {
        this.hover.hoverRow = null;
        this.hover.hoverValue = null;
      }
      this.hover = el;
      if (el) {
        el.hoverRow = row;
        el.hoverValue = hv;
      }
      this.markDirty();
    }
    return !!el && !el.disabled;
  }

  /** The pointer has left it: nothing is lit. */
  pointerLeave() {
    if (this.hover) {
      this.hover.hoverRow = null;
      this.hover.hoverValue = null;
      this.hover = null;
      this.markDirty();
    }
  }

  /**
   * Uses the element at (u, v). Whether something did.
   * @param {number} u
   * @param {number} v
   */
  click(u, v) {
    const p = this._toPx(u, v);
    const el = this._hit(p);
    if (!el || el.disabled) return false;
    if (el.type === 'button') el.onClick?.(el);
    else if (el.type === 'slider') {
      const value = Math.max(0, Math.min(1, (p.x - el.x) / el.w));
      el.value = value;
      this.markDirty();
      el.onClick?.(value, el);
    } else if (el.type === 'list') {
      const row = this._listRow(el, p);
      if (row === 'up' || row === 'down') {
        this.scrollBy(el, (row === 'up' ? -1 : 1) * Math.max(1, Math.floor(el.h / (el.rowH || 64)) - 1));
      } else if (typeof row === 'number') {
        const it = el.items?.[(el.scroll || 0) + row];
        if (!it || it.disabled) return false;
        it.onClick?.(it);
      } else if (row === null) return false;
    }
    return true;
  }

  /** Lets go of its geometry, material and texture, and takes its mesh out of the scene. */
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.mesh.removeFromParent();
  }
}

/**
 * A label's size.
 * @typedef {object} LabelOptions
 * @property {number} [width] where it is put, in metres (0.5)
 * @property {number} [height] (0.12)
 * @property {number} [pxPerMeter] its canvas's pixels for each (1400)
 * @property {CanvasFactory} [canvas] makes its canvas: the page's by default
 */

/**
 * A label of a line or two, a title and a line under it, floating in front of what is behind it (a
 * tooltip, a hint, a notice).
 */
export class Label {
  /** @param {LabelOptions} [options] */
  constructor({ width = 0.5, height = 0.12, pxPerMeter = 1400, canvas } = {}) {
    this.panel = new Panel({ width, height, pxPerMeter, background: 'rgba(20,16,12,0.88)', radius: 22, canvas });
    this.mesh = this.panel.mesh;
    this.mesh.renderOrder = 20;
    this.material = this.panel.material;
    this.material.depthTest = false;
    this.material.side = THREE.FrontSide;
    /** @private @type {string | null} what it says now */
    this._text = null;
  }

  /**
   * What it says: drawn again only when that changes.
   * @param {string} title
   * @param {string} [sub] the line under it
   */
  setText(title, sub = '') {
    const key = `${title}\n${sub}`;
    if (key === this._text) return;
    this._text = key;
    const p = this.panel;
    p.clear();
    const pad = p.h * 0.12;
    p.add({ type: 'text', x: pad, y: pad * 0.9, w: p.w - 2 * pad, h: p.h * 0.45, text: title, size: Math.round(p.h * 0.3), weight: '600', serif: true, maxLines: 1 });
    if (sub) p.add({ type: 'text', x: pad, y: p.h * 0.56, w: p.w - 2 * pad, h: p.h * 0.36, text: sub, size: Math.round(p.h * 0.22), color: UI.muted, maxLines: 1 });
    p.redraw();
  }

  get visible() { return this.mesh.visible; }
  set visible(v) { this.mesh.visible = v; }

  dispose() {
    this.panel.dispose();
  }
}
