/**
 * Text in lines that fit `width`, at the font set on `g`; the last allowed line gets an ellipsis.
 * @param {CanvasRenderingContext2D} g
 * @param {string} text
 * @param {number} width
 * @param {number} [maxLines]
 * @returns {string[]}
 */
export function wrapText(g: CanvasRenderingContext2D, text: string, width: number, maxLines?: number): string[];
/**
 * The faces and colours panels are drawn in, for a site's own drawing to match.
 * @type {{ font: string, serif: string, text: string, muted: string, accent: string, button: string, buttonHover: string, buttonActive: string, border: string }}
 */
export const UI: {
    font: string;
    serif: string;
    text: string;
    muted: string;
    accent: string;
    button: string;
    buttonHover: string;
    buttonActive: string;
    border: string;
};
/** A panel: its canvas, the texture on it and the plane it textures, and what is drawn there. */
export class Panel {
    /** @param {PanelOptions} options */
    constructor({ width, height, pxPerMeter, px, background, radius, anisotropy, ring, canvas }: PanelOptions);
    width: number;
    height: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    background: string | null;
    radius: number;
    texture: THREE.CanvasTexture<HTMLCanvasElement>;
    material: THREE.MeshBasicMaterial;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    /** What is on it, drawn in this order. @type {PanelElement[]} */
    elements: PanelElement[];
    /** What a pointer is on (pointerMove's), lit. @type {Control | null} */
    hover: Control | null;
    /**
     * The outline round the list row pointed at, its width in canvas pixels: 0 for none, as vrlbry
     * has it; 2 outside's; 4 music's on a TV, its remote's highlight seen from the sofa.
     */
    ring: number;
    dirty: boolean;
    /** @private Where a ray meets it, in canvas pixels (_toPx): the same object each time. */
    private _p;
    /** @private @type {ScrollBar} the same object each time (_scrollBar) */
    private _sb;
    /**
     * @private A scroll bar being dragged (pressAt): its list, where on the thumb it was taken, and
     * while the panel is refilled (clear) the id of the list it carries on with.
     * @type {{ el: ListElement, grab: number, id: string | null } | null}
     */
    private _drag;
    /** Its canvas's width and height, in pixels: what its elements' boxes are in. */
    get w(): number;
    get h(): number;
    set visible(v: boolean);
    get visible(): boolean;
    /** Takes everything off it. */
    clear(): void;
    /**
     * Adds an element; returns it. Elements are drawn in the order they were added.
     * @param {PanelElement} el
     */
    add(el: PanelElement): PanelElement;
    /** Takes the element with this id off it. @param {string} id */
    remove(id: string): void;
    /** The element with this id, if there is one. @param {string} id */
    get(id: string): PanelElement | undefined;
    /**
     * Changes fields of an element by id, redrawn only when one of them is new.
     * @param {string} id
     * @param {Record<string, unknown>} fields its fields' new values, by name
     */
    set(id: string, fields: Record<string, unknown>): PanelElement | undefined;
    markDirty(): void;
    /** Repaints if anything changed. Once a frame: nothing is done when nothing did. */
    update(): void;
    redraw(): void;
    /**
     * An element's font, size pixels high: the serif face or the sans.
     * @protected
     * @param {{ serif?: boolean }} el
     * @param {number} size
     * @param {string} [weight]
     */
    protected _font(el: {
        serif?: boolean;
    }, size: number, weight?: string): string;
    /**
     * @protected
     * @param {CanvasRenderingContext2D} g
     * @param {CustomElement} el
     */
    protected _draw_custom(g: CanvasRenderingContext2D, el: CustomElement): void;
    /**
     * @protected
     * @param {CanvasRenderingContext2D} g
     * @param {RectElement} el
     */
    protected _draw_rect(g: CanvasRenderingContext2D, el: RectElement): void;
    /**
     * @protected
     * @param {CanvasRenderingContext2D} g
     * @param {TextElement} el
     */
    protected _draw_text(g: CanvasRenderingContext2D, el: TextElement): void;
    /**
     * @protected
     * @param {CanvasRenderingContext2D} g
     * @param {ImageElement} el
     */
    protected _draw_image(g: CanvasRenderingContext2D, el: ImageElement): void;
    /**
     * @protected
     * @param {CanvasRenderingContext2D} g
     * @param {ButtonElement} el
     */
    protected _draw_button(g: CanvasRenderingContext2D, el: ButtonElement): void;
    /**
     * @protected
     * @param {CanvasRenderingContext2D} g
     * @param {SliderElement} el
     */
    protected _draw_slider(g: CanvasRenderingContext2D, el: SliderElement): void;
    /**
     * @protected
     * @param {CanvasRenderingContext2D} g
     * @param {ListElement} el
     */
    protected _draw_list(g: CanvasRenderingContext2D, el: ListElement): void;
    /**
     * Scrolls the list with this id by `rows` (positive: down).
     * @param {string} id
     * @param {number} rows
     */
    scrollList(id: string, rows: number): void;
    /**
     * Scrolls a list of this panel's by `rows`, within its ends (as it is drawn).
     * @param {ListElement} el
     * @param {number} rows
     */
    scrollBy(el: ListElement, rows: number): void;
    /** Whether an element is a list with more rows than it shows. @param {PanelElement} el */
    scrolls(el: PanelElement): boolean;
    /**
     * (u, v), from 0 to 1 from its bottom left, in the canvas's pixels: the same object each time.
     * @protected
     * @param {number} u
     * @param {number} v
     */
    protected _toPx(u: number, v: number): {
        x: number;
        y: number;
    };
    /**
     * The Control at p (in the canvas's pixels), disabled or not, the one added last on top; or null.
     * @protected
     * @param {{ x: number, y: number }} p
     * @returns {Control | null}
     */
    protected _hit(p: {
        x: number;
        y: number;
    }): Control | null;
    /**
     * Where on a list p (in the canvas's pixels, on it) is: a row shown, or its scroll bar's ▲, ▼ or
     * track; null below its last row.
     * @protected
     * @param {ListElement} el
     * @param {{ x: number, y: number }} p
     * @returns {ListRow | null}
     */
    protected _listRow(el: ListElement, p: {
        x: number;
        y: number;
    }): ListRow | null;
    /**
     * A list's scroll bar (null when everything fits): the same object each time.
     * @protected
     * @param {ListElement} el
     * @returns {ScrollBar | null}
     */
    protected _scrollBar(el: ListElement): ScrollBar | null;
    /**
     * The element that can be used at (u, v), or null: a button or a slider not disabled, a list on a
     * row of an item not disabled or on its scroll bar.
     * @param {number} u
     * @param {number} v
     * @returns {Control | null}
     */
    elementAt(u: number, v: number): Control | null;
    /**
     * A press at (u, v): on a list's scroll bar it starts dragging the thumb (pressing the track
     * beside the thumb first jumps a page towards the press). Returns true when it did; dragTo and
     * release follow.
     * @param {number} u
     * @param {number} v
     */
    pressAt(u: number, v: number): boolean;
    /**
     * Moves a dragged scroll bar's thumb to follow (u, v), which may have left the bar meanwhile.
     * @param {number} u
     * @param {number} v
     */
    dragTo(u: number, v: number): void;
    /** Ends a scroll bar's drag. Returns true when one was going on. */
    release(): boolean;
    /** True while a scroll bar is being dragged. */
    get dragging(): boolean;
    /**
     * Hover feedback at (u, v); whether something usable is there.
     * @param {number} u
     * @param {number} v
     */
    pointerMove(u: number, v: number): boolean;
    /** The pointer has left it: nothing is lit. */
    pointerLeave(): void;
    /**
     * Uses the element at (u, v). Whether something did.
     * @param {number} u
     * @param {number} v
     */
    click(u: number, v: number): boolean;
    /** Lets go of its geometry, material and texture, and takes its mesh out of the scene. */
    dispose(): void;
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
    constructor({ width, height, pxPerMeter, canvas }?: LabelOptions);
    panel: Panel;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    material: THREE.MeshBasicMaterial;
    /** @private @type {string | null} what it says now */
    private _text;
    /**
     * What it says: drawn again only when that changes.
     * @param {string} title
     * @param {string} [sub] the line under it
     */
    setText(title: string, sub?: string): void;
    set visible(v: boolean);
    get visible(): boolean;
    dispose(): void;
}
/**
 * A panel's size and look.
 */
export type PanelOptions = {
    /**
     * its size where it is put, in metres (or the site's units)
     */
    width: number;
    height: number;
    /**
     * its canvas's pixels for each of those (1200), at most 2048 a side
     */
    pxPerMeter?: number | undefined;
    /**
     * instead, its canvas's width in pixels, its height in proportion
     */
    px?: number | undefined;
    /**
     * behind what is on it, a CSS colour, or none
     */
    background?: string | null | undefined;
    /**
     * its corners', in canvas pixels
     */
    radius?: number | undefined;
    /**
     * its texture's anisotropic filtering
     */
    anisotropy?: number | undefined;
    /**
     * the outline round the list row pointed at, its width in canvas pixels: 0 for none
     */
    ring?: number | undefined;
    /**
     * makes its canvas: the page's by default
     */
    canvas?: CanvasFactory | undefined;
};
/**
 * What is on a panel, as its type says.
 */
export type PanelElement = TextElement | ButtonElement | SliderElement | ListElement | ImageElement | RectElement | CustomElement;
/**
 * Where an element is: x, y its top left and w × h, in its panel's canvas pixels; id, what get and
 * set find it by; hidden, neither drawn nor pointed at.
 */
export type Box = {
    id?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    hidden?: boolean;
};
/**
 * What a pointer can use (a button, a slider or a list), unless it is disabled. pointerMove marks
 * where on it the pointer is: hoverRow a list's (ListRow), hoverValue a slider's value (null when not).
 */
export type Control = ButtonElement | SliderElement | ListElement;
/**
 * A Box a pointer can use: a Control's fields.
 */
export type Usable = Box & {
    disabled?: boolean;
    hoverRow?: ListRow | null;
    hoverValue?: number | null;
};
/**
 * Where on a list a pointer is: a row shown, from 0 at its top, or its scroll bar's ▲, ▼ or track.
 */
export type ListRow = number | "up" | "down" | "track";
/**
 * Text in the lines that fit w (as many as fit h, or maxLines; the last with an ellipsis if it runs
 * over), size pixels high (34), from the top of h or in its middle.
 */
export type TextElement = Box & {
    type: "text";
    text: string;
    size?: number;
    weight?: string;
    serif?: boolean;
    color?: string;
    align?: CanvasTextAlign;
    valign?: "middle";
    maxLines?: number;
};
/**
 * A button, its label on one line: lit while pointed at, drawn pressed while active; onClick(el)
 * when it is used.
 */
export type ButtonElement = Usable & {
    type: "button";
    label: string;
    size?: number;
    weight?: string;
    serif?: boolean;
    color?: string;
    radius?: number;
    active?: boolean;
    onClick?: (el: ButtonElement) => void;
};
/**
 * A slider, its value 0…1 from its left; used, it is set to the value there, and onClick(value, el).
 */
export type SliderElement = Usable & {
    type: "slider";
    value?: number;
    onClick?: (value: number, el: SliderElement) => void;
};
/**
 * A list, its items in rows rowH high (64), as many as fit h, from the item scroll down. With more
 * than fit, a scroll bar at its right: ▲ and ▼ a page up or down, and a thumb to drag (pressAt). What
 * is used is an item.
 */
export type ListElement = Usable & {
    type: "list";
    items: ListItem[];
    rowH?: number;
    size?: number;
    serif?: boolean;
    scroll?: number;
};
/**
 * A list's entry: its label, sub under it and right at the row's end, indent steps in; marked while
 * active; onClick(it) when it is used (unless disabled), or onClick() from a key.
 */
export type ListItem = {
    label: string;
    sub?: string;
    right?: string;
    weight?: string;
    indent?: number;
    active?: boolean;
    disabled?: boolean;
    onClick?: (it?: ListItem) => void;
};
/**
 * A picture as large as fits the box, in its middle, a shadow under it; until it has a size, a
 * placeholder.
 */
export type ImageElement = Box & {
    type: "image";
    image?: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;
};
/**
 * A rectangle filled with color (a faint white), its corners rounded by radius (0).
 */
export type RectElement = Box & {
    type: "rect";
    color?: string;
    radius?: number;
};
/**
 * An element that draws itself: draw(g, el), each time the panel is redrawn (music's piano roll).
 * Its other fields are the site's.
 */
export type CustomElement = Box & {
    type: "custom";
    draw?: (g: CanvasRenderingContext2D, el: CustomElement) => void;
} & Record<string, unknown>;
/**
 * How an element is drawn: Panel's method named _draw_ and its type (redraw finds it by name).
 */
export type Draw = (g: CanvasRenderingContext2D, el: PanelElement) => void;
/**
 * A list's scroll bar, between its ▲ and ▼: its left x and width, the track, the thumb (its height
 * shows how much of the list is shown), the largest scroll and the rows shown.
 */
export type ScrollBar = {
    x: number;
    barW: number;
    trackY: number;
    trackH: number;
    thumbH: number;
    thumbY: number;
    max: number;
    visible: number;
};
/**
 * A canvas for a panel: the page's, or a stand-in where there is none (Node).
 */
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;
/**
 * A label's size.
 */
export type LabelOptions = {
    /**
     * where it is put, in metres (0.5)
     */
    width?: number | undefined;
    /**
     * (0.12)
     */
    height?: number | undefined;
    /**
     * its canvas's pixels for each (1400)
     */
    pxPerMeter?: number | undefined;
    /**
     * makes its canvas: the page's by default
     */
    canvas?: CanvasFactory | undefined;
};
import * as THREE from 'three';
