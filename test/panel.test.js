// The panels (src/panel.js), built in Node with three, no WebGL, and drawn on a stand-in canvas
// (test/canvas.js, which records every call): each kind of element drawn, a pointer over each,
// nothing drawn again without a change, the outline round the row pointed at, an element of a
// site's own, both sizes, and vrlbry's scroll bar dragged.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { Label, Panel, UI, wrapText } from '../src/panel.js';
import { recordingCanvas } from './canvas.js';

/** A panel 1000 × 500 px (pxPerMeter 1000) on a stand-in canvas, and the log of what it draws. */
function panel(o = {}) {
  const rec = recordingCanvas();
  const p = new Panel({ width: 1, height: 0.5, pxPerMeter: 1000, canvas: rec.canvas, ...o });
  return { p, log: rec.log };
}
/** (u, v) of a canvas pixel: panels are hit by uv, v up. */
const uv = (p, x, y) => [x / p.w, 1 - y / p.h];
/** What was drawn since `from`: each call or property set, without its canvas's id. */
const drawn = (log, from = 0) => log.slice(from).map(([, ...c]) => c);
/** The text drawn since `from`: [text, x, y] each. */
const texts = (log, from = 0) => drawn(log, from).filter((c) => c[0] === 'fillText').map((c) => c.slice(1));
/** Whether a call (or a set: ['set', key, value]) was made since `from`. */
const has = (log, call, from = 0) => drawn(log, from).some((c) => call.every((v, i) => c[i] === v));

/** vrlbry's kiosk: 1000 × 1000 px, a list of 30 rows of which 10 show. */
function kiosk(items = 30) {
  const { p, log } = panel({ height: 1 });
  const list = p.add({ id: 'places', type: 'list', x: 36, y: 208, w: 928, h: 580, rowH: 58, items: Array.from({ length: items }, (_, i) => ({ label: `Place ${i}` })), scroll: 0 });
  return { p, list, log };
}

describe('Panel: its size', () => {
  it('is pxPerMeter a metre, at most 2048 pixels a side, or px wide with its height in proportion', () => {
    const { p, log } = panel();
    assert.deepEqual([p.w, p.h], [1000, 500]);
    assert.deepEqual(log[0].slice(1), ['canvas', 1000, 500], 'the canvas made at its size');
    const big = panel({ width: 2, height: 1, pxPerMeter: 1300 }).p;
    assert.deepEqual([big.w, big.h], [2048, 1024], 'scaled down to 2048 a side');
    const wide = panel({ width: 0.3, height: 0.1, px: 900 }).p;
    assert.deepEqual([wide.w, wide.h], [900, 300], 'outside\'s: the canvas\'s width');
    const plane = wide.mesh.geometry.parameters;
    assert.deepEqual([plane.width, plane.height], [0.3, 0.1], 'the plane is its size where it is put');
    assert.equal(wide.mesh.userData.panel, wide);
    assert.equal(wide.texture.image, wide.canvas);
    assert.equal(wide.texture.colorSpace, THREE.SRGBColorSpace);
    assert.equal(wide.material.forceSinglePass, true, 'one pass, not two with a program check each');
    assert.equal(wide.ring, 0, 'no outline round a row, as vrlbry has it');
  });
});

describe('Panel: what it draws', () => {
  it('draws its background, then each element in the order added, the hidden left out', () => {
    const { p, log } = panel();
    const order = [];
    p.add({ type: 'custom', x: 0, y: 0, w: 10, h: 10, draw: () => order.push('first') });
    p.add({ type: 'custom', x: 0, y: 0, w: 10, h: 10, hidden: true, draw: () => order.push('hidden') });
    p.add({ type: 'custom', x: 0, y: 0, w: 10, h: 10, draw: () => order.push('last') });
    const version = p.texture.version;
    p.update();
    assert.deepEqual(order, ['first', 'last']);
    assert.ok(p.texture.version > version, 'the texture told');
    const calls = drawn(log, 1);
    assert.deepEqual(calls[0], ['clearRect', 0, 0, 1000, 500]);
    assert.ok(has(log, ['set', 'fillStyle', 'rgba(25,20,16,0.93)']) && has(log, ['set', 'strokeStyle', UI.border]), 'its background and border');
    const bare = panel({ background: null });
    bare.p.update();
    assert.deepEqual(drawn(bare.log, 1), [['clearRect', 0, 0, 1000, 500]], 'no background: nothing but what is on it');
    assert.equal(p.dirty, false);
  });

  it('wraps text to its width, as many lines as fit, the last cut with an ellipsis', () => {
    const { p, log } = panel();
    // 20 px text measures 10 px a character: 10 to a line of 100.
    p.add({ type: 'text', x: 10, y: 20, w: 100, h: 80, text: 'one two three four five six seven', size: 20 });
    p.add({ type: 'text', x: 300, y: 0, w: 100, h: 100, text: 'centred', size: 20, align: 'center', valign: 'middle', serif: true, weight: '600', color: '#123456' });
    p.add({ type: 'text', x: 500, y: 0, w: 100, h: 100, text: 'one two three', size: 20, align: 'right', maxLines: 1 });
    p.redraw();
    assert.deepEqual(texts(log), [['one two', 10, 20], ['three four', 10, 45], ['five six…', 10, 70], ['centred', 350, 37.5], ['one two…', 600, 0]]);
    assert.ok(has(log, ['set', 'font', `600 20px ${UI.serif}`]) && has(log, ['set', 'font', `20px ${UI.font}`]), 'the serif face, and the sans');
    assert.ok(has(log, ['set', 'fillStyle', '#123456']) && has(log, ['set', 'textAlign', 'center']));
  });

  it('draws a button lit while pointed at and pressed while active, its label cut to one line', () => {
    const { p, log } = panel();
    const b = p.add({ id: 'b', type: 'button', x: 100, y: 100, w: 200, h: 80, label: 'Contents' });
    p.add({ id: 'off', type: 'button', x: 400, y: 100, w: 200, h: 80, label: 'Off', disabled: true });
    p.redraw();
    assert.deepEqual(texts(log), [['Contents', 200, 141], ['Off', 500, 141]]);
    assert.ok(has(log, ['set', 'fillStyle', UI.button]) && has(log, ['set', 'fillStyle', 'rgba(80,70,60,0.5)']), 'plain, and disabled');
    assert.ok(!has(log, ['set', 'strokeStyle', UI.accent]), 'not lit');
    const at = log.length;
    p.pointerMove(...uv(p, 150, 120));
    assert.equal(p.hover, b);
    p.update();
    assert.ok(has(log, ['set', 'fillStyle', UI.buttonHover], at) && has(log, ['set', 'strokeStyle', UI.accent], at), 'lit');
    const pressed = log.length;
    p.pointerLeave();
    p.set('b', { active: true });
    p.update();
    assert.ok(has(log, ['set', 'fillStyle', UI.buttonActive], pressed) && has(log, ['set', 'strokeStyle', UI.accent], pressed), 'pressed');
  });

  it('draws a slider at its value, its knob larger and a line at the pointer while pointed at', () => {
    const { p, log } = panel();
    p.add({ id: 's', type: 'slider', x: 100, y: 100, w: 400, h: 50, value: 0.25 });
    p.redraw();
    assert.ok(has(log, ['arc', 200, 125, 11, 0, Math.PI * 2]), 'the knob at a quarter');
    const at = log.length;
    p.pointerMove(...uv(p, 400, 120));
    p.update();
    assert.ok(has(log, ['arc', 200, 125, 11 * 1.3, 0, Math.PI * 2], at), 'larger');
    assert.ok(has(log, ['fillRect', 399, 100, 2, 50], at), 'the line where it would go');
  });

  it('draws a list\'s rows, each its label, sub, right and indent, the active and the pointed-at marked', () => {
    const { p, log } = panel();
    const list = p.add({ id: 'l', type: 'list', x: 20, y: 40, w: 600, h: 200, rowH: 100, size: 20, serif: true, items: [
      { label: 'Walden', sub: 'Thoreau', right: '12', active: true },
      { label: 'Indented', indent: 2, disabled: true },
    ] });
    p.redraw();
    // vrlbry's: the sub-line 0.72 of the size in the list's face, the right column at the row's middle.
    assert.deepEqual(texts(log), [['Walden', 34, 76], ['Thoreau', 34, 112], ['12', 602, 90], ['Indented', 70, 190]]);
    assert.ok(has(log, ['set', 'font', `${20 * 0.72}px ${UI.serif}`]), 'the sub-line');
    assert.ok(has(log, ['set', 'fillStyle', 'rgba(143,108,52,0.55)']), 'the active row');
    assert.ok(has(log, ['set', 'fillStyle', '#857868']), 'the disabled row');
    assert.equal(list.scroll, 0);
    const at = log.length;
    p.pointerMove(...uv(p, 300, 170));
    assert.equal(list.hoverRow, 1);
    p.update();
    assert.ok(has(log, ['set', 'fillStyle', 'rgba(255,255,255,0.10)'], at), 'the row pointed at');
  });

  it('gives a list with more rows than fit a scroll bar, and draws from where it is scrolled', () => {
    const { p, list, log } = kiosk();
    p.scrollList('places', 25);
    assert.equal(list.scroll, 20, 'no further than its last rows');
    assert.equal(p.scrolls(list), true);
    p.redraw();
    const shown = texts(log).map(([t]) => t);
    assert.deepEqual(shown.slice(0, 10), Array.from({ length: 10 }, (_, i) => `Place ${20 + i}`));
    assert.deepEqual(shown.slice(10), ['▲', '▼']);
    const sb = p._scrollBar(list);
    assert.deepEqual([sb.x, sb.trackY, sb.max, sb.visible], [908, 272, 20, 10]);
    assert.ok(Math.abs(sb.thumbY + sb.thumbH - (sb.trackY + sb.trackH)) < 1e-9, 'the thumb at the end of its track');
    assert.equal(p._scrollBar(list), sb, 'the same object each time');
    const short = p.add({ id: 'short', type: 'list', x: 36, y: 820, w: 928, h: 116, rowH: 58, items: [{ label: 'a' }] });
    assert.equal(p._scrollBar(short), null);
    assert.equal(p.scrolls(short), false);
  });

  it('draws a picture as large as fits, in the middle, and a placeholder until it has a size', () => {
    const { p, log } = panel();
    const pic = p.add({ id: 'pic', type: 'image', x: 100, y: 100, w: 100, h: 100, image: null });
    p.redraw();
    assert.ok(has(log, ['set', 'fillStyle', 'rgba(255,255,255,0.06)']) && !has(log, ['drawImage']), 'the placeholder');
    pic.image = /** @type {any} */ ({ tag: 'cover', width: 200, height: 100 });
    const at = log.length;
    p.redraw();
    assert.ok(has(log, ['drawImage', 'cover', 100, 125, 100, 50], at), 'fitted, in the middle');
    pic.image = /** @type {any} */ ({ tag: 'photo', naturalWidth: 50, naturalHeight: 100, width: 0, height: 0 });
    const loaded = log.length;
    p.redraw();
    assert.ok(has(log, ['drawImage', 'photo', 125, 100, 50, 100], loaded), 'by its own size');
  });

  it('fills a rectangle, and lets an element of a site\'s own draw itself', () => {
    const { p, log } = panel();
    p.add({ type: 'rect', x: 10, y: 10, w: 50, h: 20, color: '#abcdef', radius: 4 });
    const seen = [];
    const roll = p.add({ id: 'roll', type: 'custom', x: 100, y: 0, w: 300, h: 100, notes: [60, 64], draw: (g, el) => {
      seen.push([g, el]);
      g.fillRect(el.x, el.y, el.w, el.notes.length);
    } });
    p.redraw();
    assert.ok(has(log, ['set', 'fillStyle', '#abcdef']));
    assert.deepEqual(seen, [[p.ctx, roll]], 'its draw, with the panel\'s context and itself');
    assert.ok(has(log, ['fillRect', 100, 0, 300, 2]));
    p.add({ type: 'custom', x: 0, y: 0, w: 1, h: 1 });
    p.redraw(); // one without a draw draws nothing
    assert.equal(p.elementAt(...uv(p, 200, 50)), null, 'and is not a control');
  });
});

describe('Panel: a pointer over it', () => {
  it('uses a button, the one added last on top, and never a disabled one', () => {
    const { p } = panel();
    const used = [];
    const under = p.add({ id: 'under', type: 'button', x: 0, y: 0, w: 300, h: 100, label: 'Under', onClick: () => used.push('under') });
    const top = p.add({ id: 'top', type: 'button', x: 100, y: 0, w: 300, h: 100, label: 'Top', onClick: (el) => used.push(el.id) });
    assert.equal(p.pointerMove(...uv(p, 200, 50)), true);
    assert.equal(p.hover, top);
    assert.equal(p.elementAt(...uv(p, 50, 50)), under);
    assert.equal(p.click(...uv(p, 200, 50)), true);
    assert.equal(p.click(...uv(p, 50, 50)), true);
    assert.deepEqual(used, ['top', 'under']);
    p.set('top', { disabled: true });
    assert.equal(p.pointerMove(...uv(p, 200, 50)), false, 'there, but not usable');
    assert.equal(p.elementAt(...uv(p, 200, 50)), null);
    assert.equal(p.click(...uv(p, 200, 50)), false);
    assert.deepEqual(used, ['top', 'under'], 'the one under it not used either');
    p.set('top', { hidden: true });
    assert.equal(p.elementAt(...uv(p, 200, 50)), under, 'a hidden one is not there');
    assert.equal(p.click(...uv(p, 700, 300)), false, 'nothing there');
    assert.equal(p.pointerMove(...uv(p, 700, 300)), false);
    assert.equal(p.hover, null);
  });

  it('sets a slider to where it is used, and marks where it is pointed at until the pointer leaves', () => {
    const { p } = panel();
    const set = [];
    const s = p.add({ id: 's', type: 'slider', x: 100, y: 100, w: 400, h: 50, value: 0, onClick: (v, el) => set.push([v, el.id]) });
    p.pointerMove(...uv(p, 200, 120));
    assert.equal(s.hoverValue, 0.25);
    assert.equal(p.elementAt(...uv(p, 200, 120)), s);
    assert.equal(p.click(...uv(p, 400, 120)), true);
    assert.equal(s.value, 0.75);
    assert.deepEqual(set, [[0.75, 's']]);
    p.pointerLeave();
    assert.equal(s.hoverValue, null, 'cleared');
    assert.equal(s.hoverRow, null);
    assert.equal(p.hover, null);
    p.pointerMove(...uv(p, 200, 120));
    p.add({ id: 'b', type: 'button', x: 600, y: 100, w: 100, h: 50, label: 'B' });
    p.pointerMove(...uv(p, 650, 120));
    assert.equal(s.hoverValue, null, 'cleared when the pointer moves on to another');
  });

  it('uses a list\'s item on its row, scrolled, but not a disabled one nor below its last row', () => {
    const { p } = panel();
    const used = [];
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((label) => ({ label, onClick: (it) => used.push(it.label) }));
    items[4].disabled = true;
    // Rows of 100 in 250: two shown, a strip of 50 below them; a scroll bar, as six don't fit.
    const list = p.add({ id: 'l', type: 'list', x: 0, y: 0, w: 600, h: 250, rowH: 100, items, scroll: 3 });
    p.pointerMove(...uv(p, 100, 150));
    assert.equal(list.hoverRow, 1);
    assert.equal(p.elementAt(...uv(p, 100, 50)), list);
    assert.equal(p.click(...uv(p, 100, 50)), true);
    assert.deepEqual(used, ['d'], 'the row shown first is the fourth item');
    assert.equal(p.elementAt(...uv(p, 100, 150)), null, 'a disabled item');
    assert.equal(p.click(...uv(p, 100, 150)), false);
    p.pointerMove(...uv(p, 100, 230));
    assert.equal(list.hoverRow, null, 'below the last row shown, no row');
    assert.equal(p.elementAt(...uv(p, 100, 230)), null);
    assert.equal(p.click(...uv(p, 100, 230)), false);
    assert.deepEqual(used, ['d'], 'the item not shown there is not used');
    p.pointerMove(...uv(p, 580, 20));
    assert.equal(list.hoverRow, 'up');
    assert.equal(p.elementAt(...uv(p, 580, 20)), list, 'its scroll bar can be used');
    assert.equal(p.click(...uv(p, 580, 20)), true);
    assert.equal(list.scroll, 2, 'a page up: the rows shown less one');
    assert.equal(p.click(...uv(p, 580, 240)), true);
    assert.equal(list.scroll, 3);
    p.pointerMove(...uv(p, 580, 125));
    assert.equal(list.hoverRow, 'track');
    assert.equal(p.click(...uv(p, 580, 125)), true, 'the track is a press\'s (pressAt)');
    assert.equal(list.scroll, 3);
  });

  it('marks nothing on text, a rectangle, a picture or a drawing of its own', () => {
    const { p } = panel();
    p.add({ type: 'text', x: 0, y: 0, w: 100, h: 100, text: 'Hi' });
    p.add({ type: 'rect', x: 100, y: 0, w: 100, h: 100 });
    p.add({ type: 'image', x: 200, y: 0, w: 100, h: 100 });
    p.add({ type: 'custom', x: 300, y: 0, w: 100, h: 100 });
    for (const x of [50, 150, 250, 350]) {
      assert.equal(p.pointerMove(...uv(p, x, 50)), false, String(x));
      assert.equal(p.elementAt(...uv(p, x, 50)), null);
      assert.equal(p.click(...uv(p, x, 50)), false);
    }
  });

  it('works out where a ray meets it in one point, the same each time', () => {
    const { p } = panel();
    const a = p._toPx(0.25, 0.75);
    assert.deepEqual(a, { x: 250, y: 125 });
    assert.equal(p._toPx(0.5, 0.5), a);
    assert.deepEqual(a, { x: 500, y: 250 });
  });

  it('leaves the pointer\'s marks when hidden', () => {
    const { p } = panel();
    const b = p.add({ type: 'button', x: 0, y: 0, w: 100, h: 100, label: 'B' });
    p.pointerMove(...uv(p, 50, 50));
    assert.equal(p.hover, b);
    p.visible = false;
    assert.equal(p.mesh.visible, false);
    assert.equal(p.visible, false);
    assert.equal(p.hover, null);
  });
});

describe('Panel: drawn again only on a change', () => {
  it('redraws on update only when something changed: a field set to what it is changes nothing', () => {
    const { p, log } = panel();
    p.add({ id: 'b', type: 'button', x: 0, y: 0, w: 100, h: 100, label: 'B' });
    p.update();
    const at = log.length;
    p.update();
    assert.equal(log.length, at, 'clean: nothing done');
    assert.equal(p.set('b', { label: 'B', x: 0 })?.id, 'b');
    assert.equal(p.dirty, false, 'the same values');
    p.update();
    assert.equal(log.length, at);
    p.set('b', { label: 'C' });
    assert.equal(p.dirty, true);
    p.update();
    assert.ok(texts(log, at).some(([t]) => t === 'C'));
    assert.equal(p.set('none', { label: 'D' }), undefined);
  });

  it('is not drawn again while the pointer stays on the same row or value', () => {
    const { p } = panel();
    p.add({ id: 'l', type: 'list', x: 0, y: 0, w: 400, h: 200, rowH: 50, items: [{ label: 'a' }, { label: 'b' }] });
    p.add({ id: 's', type: 'slider', x: 0, y: 300, w: 400, h: 50 });
    p.update();
    p.pointerMove(...uv(p, 100, 20));
    assert.equal(p.dirty, true);
    p.update();
    p.pointerMove(...uv(p, 200, 30));
    assert.equal(p.dirty, false, 'the same row');
    p.pointerMove(...uv(p, 200, 70));
    assert.equal(p.dirty, true, 'the next row');
    p.update();
    p.pointerMove(...uv(p, 100, 320));
    p.update();
    p.pointerMove(...uv(p, 100, 340));
    assert.equal(p.dirty, false, 'the same value');
    p.pointerLeave();
    p.update();
    p.pointerLeave();
    assert.equal(p.dirty, false, 'nothing to leave');
  });
});

describe('Panel: the outline round the row pointed at', () => {
  const rows = () => [{ label: 'a', active: true }, { label: 'b' }];
  const stroked = (log, from) => drawn(log, from).filter((c) => c[0] === 'stroke').length;

  it('is none by default, as vrlbry has it; outside\'s 2 px; music\'s 4 on a TV, set when it is one', () => {
    for (const [ring, width] of [[0, null], [2, 2], [4, 4]]) {
      const { p, log } = panel({ ring, background: null });
      p.add({ id: 'l', type: 'list', x: 0, y: 0, w: 400, h: 200, rowH: 50, items: rows() });
      p.redraw();
      assert.equal(stroked(log), 0, `${ring}: none round the active row`);
      const at = log.length;
      p.pointerMove(...uv(p, 100, 70));
      p.update();
      assert.equal(stroked(log, at), width ? 1 : 0, String(ring));
      if (width) assert.ok(has(log, ['set', 'lineWidth', width], at) && has(log, ['set', 'strokeStyle', UI.accent], at));
    }
    const { p, log } = panel({ background: null });
    p.add({ id: 'l', type: 'list', x: 0, y: 0, w: 400, h: 200, rowH: 50, items: rows() });
    p.ring = 4; // music's interaction.js, as its TV's remote comes to the contents
    p.pointerMove(...uv(p, 100, 20));
    p.update();
    assert.ok(has(log, ['set', 'lineWidth', 4]), 'set later, on a TV');
  });
});

describe('Panel: dragging a list\'s scroll bar (vrlbry\'s)', () => {
  it('drags the thumb, also beyond the track, and releases', () => {
    const { p, list } = kiosk();
    const sb = { ...p._scrollBar(list) };
    assert.equal(sb.max, 20);
    const barX = sb.x + sb.barW / 2;
    assert.equal(p.pressAt(...uv(p, barX, sb.thumbY + 5)), true, 'on the thumb');
    assert.equal(p.dragging, true);
    p.dragTo(...uv(p, barX, sb.trackY + sb.trackH / 2 + 5)); // the thumb's top to the middle (as grabbed)
    assert.ok(Math.abs(list.scroll - Math.round(((sb.trackH / 2) / (sb.trackH - sb.thumbH)) * 20)) <= 1, String(list.scroll));
    p.dragTo(...uv(p, barX, 5000));
    assert.equal(list.scroll, 20, 'past the end: the last rows');
    p.dragTo(...uv(p, 2000, -500)); // off the panel altogether
    assert.equal(list.scroll, 0, 'past the start: the first rows');
    assert.equal(p.release(), true);
    assert.equal(p.dragging, false);
    assert.equal(p.release(), false);
  });

  it('pages towards a press on the track beside the thumb, then drags from there', () => {
    const { p, list } = kiosk();
    const sb = { ...p._scrollBar(list) };
    assert.equal(p.pressAt(...uv(p, sb.x + 20, sb.trackY + sb.trackH - 4)), true);
    assert.equal(list.scroll, 9, 'one page (the visible rows less one)');
    assert.equal(p.dragging, true);
  });

  it('leaves rows, the arrows and lists that fit to clicks', () => {
    const { p, list } = kiosk();
    assert.equal(p.pressAt(...uv(p, 300, 300)), false, 'a row');
    assert.equal(p.pressAt(...uv(p, list.x + list.w - 20, list.y + 10)), false, 'the ▲ button');
    const short = p.add({ id: 'short', type: 'list', x: 36, y: 820, w: 928, h: 116, rowH: 58, items: [{ label: 'a' }] });
    assert.equal(p.pressAt(...uv(p, short.x + short.w - 20, short.y + 50)), false, 'nothing to scroll');
    p.set('places', { disabled: true });
    assert.equal(p.pressAt(...uv(p, 930, 500)), false, 'a disabled list');
  });

  it('keeps dragging when the panel is refilled with the same list', () => {
    const { p } = kiosk();
    const sb = { ...p._scrollBar(p.get('places')) };
    p.pressAt(...uv(p, sb.x + 20, sb.thumbY + 5));
    p.clear();
    const fresh = p.add({ id: 'places', type: 'list', x: 36, y: 208, w: 928, h: 580, rowH: 58, items: Array.from({ length: 30 }, () => ({ label: 'x' })), scroll: 0 });
    p.dragTo(...uv(p, sb.x + 20, 5000));
    assert.equal(fresh.scroll, 20);
  });

  it('draws the thumb wider while it is dragged or pointed at', () => {
    const { p, list, log } = kiosk();
    p.redraw();
    const thin = log.length;
    const sb = { ...p._scrollBar(list) };
    // The thumb's path: its right side at the bar's middle (28) and half its width.
    assert.ok(has(log.slice(0, thin), ['arcTo', sb.x + 28 + 6, sb.thumbY]), '12 px wide');
    p.pressAt(...uv(p, sb.x + 28, sb.thumbY + 5));
    p.update();
    assert.ok(has(log, ['arcTo', sb.x + 28 + 10, sb.thumbY], thin) && !has(log, ['arcTo', sb.x + 28 + 6, sb.thumbY], thin), '20 px wide');
    assert.ok(has(log, ['set', 'fillStyle', 'rgba(232,196,124,0.95)'], thin));
  });
});

describe('Label', () => {
  it('says a title and a line under it, drawn again only when they change', () => {
    const rec = recordingCanvas();
    const label = new Label({ width: 0.5, height: 0.12, canvas: rec.canvas });
    assert.deepEqual([label.panel.w, label.panel.h], [700, 168]);
    assert.equal(label.mesh.renderOrder, 20);
    assert.equal(label.material.depthTest, false, 'in front of what is behind it');
    assert.equal(label.material.side, THREE.FrontSide);
    label.setText('Walden', 'Thoreau');
    assert.deepEqual(texts(rec.log).map(([t]) => t), ['Walden', 'Thoreau']);
    const at = rec.log.length;
    label.setText('Walden', 'Thoreau');
    assert.equal(rec.log.length, at, 'the same: nothing drawn');
    label.setText('Walden');
    assert.deepEqual(texts(rec.log, at).map(([t]) => t), ['Walden'], 'no line under it');
    label.visible = false;
    assert.equal(label.visible, false);
  });
});

describe('wrapText', () => {
  const g = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (recordingCanvas().canvas(1, 1).getContext('2d')));
  g.font = '20px sans-serif'; // 10 px a character

  it('wraps words to a width, keeps lines broken, and cuts the last allowed with an ellipsis', () => {
    assert.deepEqual(wrapText(g, 'one two three', 70), ['one two', 'three']);
    assert.deepEqual(wrapText(g, 'one\ntwo three', 1000), ['one', 'two three']);
    assert.deepEqual(wrapText(g, 'extraordinary', 50), ['extraordinary'], 'a word too long alone on its line');
    assert.deepEqual(wrapText(g, 'one two three', 70, 1), ['one tw…']);
    assert.deepEqual(wrapText(g, '', 100), ['']);
    assert.deepEqual(wrapText(g, /** @type {any} */ (null), 100), ['']);
  });
});

describe('Panel: let go of', () => {
  it('lets go of its geometry, material and texture, and leaves the scene', () => {
    const { p } = panel();
    const scene = new THREE.Scene();
    scene.add(p.mesh);
    const gone = [];
    for (const o of [p.mesh.geometry, p.material, p.texture]) o.addEventListener('dispose', () => gone.push(o));
    p.dispose();
    assert.equal(gone.length, 3);
    assert.equal(p.mesh.parent, null);
  });
});
