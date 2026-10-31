// A stand-in for the page's canvas, for painting in Node: it records every call and property set,
// in order, and keeps the pixels put with putImageData. Text measures half its font's size a
// character, unrecorded (a panel wraps its lines by it). Not a test file itself (test/*.test.js).

/**
 * A canvas factory (as skyTexture and Panel take) whose canvases record into one log.
 * @returns {{ canvas: (width: number, height: number) => object, log: any[][], images: Map<number, ImageData> }}
 */
export function recordingCanvas() {
  const log = [];
  const images = new Map();
  let canvases = 0, gradients = 0;
  const describe = (v) => (v && typeof v === 'object' ? v.tag ?? '[object]' : v);
  const canvas = (width, height) => {
    const id = canvases++;
    let font = '10px sans-serif';
    const known = {
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img, x, y) => {
        images.set(id, img);
        log.push([id, 'putImageData', img.width, img.height, x, y]);
      },
      createRadialGradient: (...args) => gradient(id, 'radial', args),
      createLinearGradient: (...args) => gradient(id, 'linear', args),
      measureText: (text) => ({ width: String(text).length * Number(/([\d.]+)px/.exec(font)?.[1] ?? 10) * 0.5 }),
    };
    const ctx = new Proxy({}, {
      get: (_, key) => known[key] ?? ((...args) => { log.push([id, key, ...args.map(describe)]); }),
      set: (_, key, value) => {
        if (key === 'font') font = value;
        log.push([id, 'set', key, describe(value)]);
        return true;
      },
    });
    log.push([id, 'canvas', width, height]);
    return { tag: `canvas#${id}`, width, height, getContext: (kind) => (kind === '2d' ? ctx : null) };
  };
  const gradient = (id, kind, args) => {
    const tag = `gradient#${gradients++}`;
    log.push([id, kind, tag, ...args]);
    return { tag, addColorStop: (offset, color) => { log.push([tag, 'stop', offset, color]); } };
  };
  return { canvas, log, images };
}
