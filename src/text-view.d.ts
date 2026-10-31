/**
 * The shell's rules (vrlbry's style.css): the themes (each its color-scheme, as outside's), the
 * toolbar and how it slides away, the contents, the column, the title, the parts, the focus rings
 * and what a narrow screen leaves out (.tv-wide). The text's own (.tv-body's) are the sites'.
 * @type {string}
 */
export const TEXT_VIEW_CSS: string;
/**
 * What the view needs of the page; the book is its subclass's.
 * @typedef {object} TextViewOptions
 * @property {HTMLElement} root where the view goes (the overlay, inside the page's <main>)
 * @property {boolean} [tv] a TV's remote that gives the focus to the view (vrlbry's, music's): it
 *   holds the focus while reading, not its title, and ↑ ↓ scroll it
 * @property {(height: number) => number} [step] how far ↑ ↓ and scrollStep scroll, for the height
 *   shown below the toolbar: 0.4 of it (vrlbry, music); outside's 0.75 of it, at least 40 px
 * @property {(away: boolean) => HTMLElement | null | undefined} [returnFocus] where the focus goes
 *   when the view closes (away: the book is being put back)
 * @property {() => void} [onOpen] the view has opened (and has the focus)
 * @property {() => void} [onClose] the view has closed, the 3D book still open
 */
/**
 * A part built for the view (renderPart): what its title says (the book's, or an article's), and
 * the line under it, none when empty.
 * @typedef {{ title?: string, subtitle?: string }} RenderedPart
 */
/**
 * An entry of the contents (contents): its title, the place it leads to, its level (1 the top,
 * indented down to 6), what follows its link (outside's author), and its link's address ('#').
 * @template [P=unknown]
 * @typedef {{ title: string, place: P, level?: number, after?: string, href?: string }} ContentsEntry
 */
/**
 * The text view of the open book, on a screen. The site calls follow() after every page turn or jump
 * of its 3D book, aim(place) before a jump to a place the view should show (a link, Back, the
 * contents), toggle() for T and its "Text view" button, and close() as the book is put back or VR
 * begins. What it gives are the methods below its "The site's" mark, which its subclass overrides:
 * common's know no book.
 * @template [P=unknown] the site's place in its book
 */
export class TextView<P = unknown> {
    /** @param {TextViewOptions} options */
    constructor({ root, tv, step, returnFocus, onOpen, onClose }: TextViewOptions);
    doc: Document;
    el: HTMLElement;
    /** One of the view's own elements, by its selector. @type {(sel: string) => HTMLElement} */
    $: (sel: string) => HTMLElement;
    tv: boolean;
    step: (height: number) => number;
    returnFocus: (away: boolean) => HTMLElement | null | undefined;
    onOpen: () => void;
    onClose: () => void;
    /** The part shown, or -1. */
    part: number;
    /** @private */
    private _open;
    /** @private A part shown waits for the one before (_show). @type {Promise<void>} */
    private _showing;
    /** @private @type {P | null} */
    private _at;
    /** @private Where a jump is going (aim): the view shows it, not the 3D page's first place. @type {P | null} */
    private _aim;
    /** @private */
    private _self;
    /** @private @type {number | null} */
    private _selfTop;
    /** @private */
    private _moved;
    /** @private The jumps under way of the 3D book to the view's place: the view stays as it is. */
    private _quiet;
    /** @private Where the view was scrolled to, when last seen (_headroom). @type {number | null} */
    private _lastY;
    /** @private The toolbar's control focused last (cardStart). @type {HTMLElement | null} */
    private _barFocus;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    private _restTimer;
    /** @private The book whose part is shown (bookKey). @type {unknown} */
    private _book;
    /** @private The contents shown, filled once a book. @type {ContentsEntry<P>[] | null} */
    private _toc;
    /** @private A screen too short for a toolbar that stays. */
    private _short;
    get isOpen(): boolean;
    /** Whether its contents are open. */
    get tocOpen(): boolean;
    /** Closes its contents (Back on a TV). */
    closeToc(): void;
    /**
     * The height of the sticky toolbar over the text (0 while it is slid away).
     * @protected
     */
    protected _barH(): number;
    /**
     * On a short screen (a phone held sideways, 400% zoom) the toolbar slides away while the reader
     * scrolls down and comes back when they scroll up or reach it with Tab: it would otherwise cover
     * half the text (87 px of outside's at 320 × 256), and one that scrolled away would take the
     * reader to the top, away from their place, for a size or a theme.
     * @private
     */
    private _headroom;
    /** @private */
    private _wire;
    /**
     * ← →: the 3D book a page on (1) or back (-1) from the reader's place, the view following it
     * (outside's; also for a remote that leaves the focus on the 3D view).
     * @param {number} side
     */
    turn(side: number): Promise<void>;
    /**
     * Reads on (dir 1) or back (-1) by a step (the step option) of what shows below the toolbar: a TV
     * remote's ↑ ↓, held (repeat) without a smooth scroll each.
     * @param {number} dir
     * @param {boolean} [repeat]
     */
    scrollStep(dir: number, repeat?: boolean): void;
    /** The text size, one step, the view staying at its place. @private @param {number} step */
    private _size;
    /** A theme: the colours change, the text and its place do not. @private @param {string} name */
    private _theme;
    /** The view scrolled: once it rests (a quarter second), its place is shared (_rest). @private */
    private _restSoon;
    /** A smooth scroll of the view's own: its scroll events, until the next rest, are not the reader's. @private */
    private _selfScrolled;
    /** @private */
    private _rest;
    /** Where the toolbar's foot is, in the page's coordinates: what is above it is under the toolbar. @private */
    private _top;
    /**
     * The reader's place, the place at the view's top once they have scrolled, becomes the shared one:
     * the 3D book goes there in place (the view covers it), unless it shows it already. Also at once,
     * before anything that starts from the place (a size, Back, Put back, a turn, a link).
     * @protected
     */
    protected _sync(): Promise<void>;
    /** T, and the site's "Text view" button: opens it, or closes it back to the 3D book. */
    toggle(): Promise<void>;
    /**
     * Opens it at the 3D book's place, or at the view's own last one while the 3D book still shows it
     * (closed and opened again). A screen only: in VR nothing changes.
     */
    open(): Promise<void>;
    /** fn on the next frame (or soon, without frames). @private @param {() => void} fn */
    private _frame;
    /**
     * Where the focus goes in the view: its title, for the keyboard and a screen reader to carry on
     * from; on a TV (tv) the view itself, which holds the remote's focus while reading.
     * @protected
     */
    protected _home(): HTMLElement;
    /** What a TV remote's card is while the view is open: its contents when open, else the whole view. */
    layer(): HTMLElement;
    /**
     * Menu on a TV: the toolbar's control used last, else its first that can be used.
     * @returns {HTMLElement | null}
     */
    cardStart(): HTMLElement | null;
    /**
     * OK on a TV: the first link on the screen, below the toolbar, to go on from link to link; or none.
     * @returns {HTMLElement | null}
     */
    linkHere(): HTMLElement | null;
    /** Whether a control is in its toolbar (a TV remote's ↑ ↓ between it and the text). @param {Node | null} el */
    inBar(el: Node | null): boolean;
    /** Whether an element's top is on the screen, below the toolbar: the focus can go there without a scroll. @param {Element} el */
    onScreen(el: Element): boolean;
    /**
     * Closes it, leaving the 3D book open at the place at the top of the view (keepPlace), and gives
     * focus back (returnFocus). In VR too: the place is shared all the same.
     * @param {{ keepPlace?: boolean }} [options] keepPlace false: the book is being put back
     */
    close({ keepPlace }?: {
        keepPlace?: boolean;
    }): Promise<void>;
    /**
     * Where a jump is going (a link, Back, the contents, a part), or null: the view shows it, not the 3D
     * book's place, which may be a spread beginning on the part before (its left page). A site that
     * cleans up its places does so here (vrlbry's { c, b, f }) and calls super.
     * @param {P | null | undefined} place
     */
    aim(place: P | null | undefined): void;
    /** After every page turn or jump of the 3D book: the view follows it. */
    follow(): void;
    /** The theme's colours and the text size, as the 3D book has them. @protected */
    protected _style(): void;
    /**
     * Shows the part a place is in (building it when it is another), scrolled to the place: once the
     * one before has been shown.
     * @protected
     * @param {P | null} place
     * @param {{ smooth?: boolean }} [options] a smooth scroll (as motion allows) within the part shown
     */
    protected _show(place: P | null, { smooth }?: {
        smooth?: boolean;
    }): Promise<void>;
    /**
     * @private
     * @param {P | null} place
     * @param {boolean} smooth
     */
    private _showNow;
    /**
     * Scrolls a place to just below the toolbar (placeTop), or the view to its top.
     * @private
     * @param {P} place
     * @param {boolean} smooth
     */
    private _scrollTo;
    /** Where the reader is, Back, and the parts. @protected */
    protected _header(): void;
    /** The previous or next part, from its start. @private @param {number} dir */
    private _part;
    /**
     * A place, the view showing it (a part's start, an entry of the contents), and the focus on the
     * view's home.
     * @protected
     * @param {P | null} place
     */
    protected _goTo(place: P | null): Promise<void>;
    /**
     * Opens or closes the contents: a panel under the toolbar, over the text, so the reader's place
     * stays where it is; its entries (contents) once a book, the focus on where the reader is.
     * @protected
     * @param {boolean} [show]
     */
    protected _toggleToc(show?: boolean): void;
    /** Whether a book is open, for the view to show (a book in VR too: close shares its place). @returns {boolean} */
    bookOpen(): boolean;
    /** Whether in VR, where the view does not open. @returns {boolean} */
    presenting(): boolean;
    /**
     * Which book is open, as anything compared with ===: when it changes, the view builds its part
     * again, fills its contents again and forgets its place (vrlbry's library and id). One book: null.
     * @returns {unknown}
     */
    bookKey(): unknown;
    /** How many parts the book has (vrlbry's chunks; outside's title page, pieces and sources). @returns {number} */
    partCount(): number;
    /**
     * The part a place is in.
     * @param {P} place
     * @returns {number}
     */
    partOf(place: P): number;
    /**
     * The place a part begins at: where the previous and next part go.
     * @param {number} part
     * @returns {P | null}
     */
    partStart(part: number): P | null;
    /**
     * Builds a part into body, a new element the view puts in once it is built (vrlbry's chunk's blocks,
     * outside's pieces): text as text, never as HTML. Each link's click calls onLink with what it leads
     * to, and the view brings the 3D book to its place and follows it (followLink). Returns what the
     * view's title and the line under it say; it may be waited for (vrlbry's fetches the part).
     * @param {HTMLElement} body
     * @param {number} part
     * @param {{ onLink: (link: unknown) => void }} options
     * @returns {RenderedPart | Promise<RenderedPart>}
     */
    renderPart(body: HTMLElement, part: number, options: {
        onLink: (link: unknown) => void;
    }): RenderedPart | Promise<RenderedPart>;
    /** The 3D book's place: where the view opens and what it follows. @returns {P | null} */
    placeShown(): P | null;
    /**
     * Whether the 3D book's open pages show a place: the view opens again at its own while they do
     * (vrlbry's _showsBlock, outside's showsPlace).
     * @param {P} place
     * @returns {boolean}
     */
    showsPlace(place: P): boolean;
    /**
     * What the view shows for a place aimed at (aim), once the 3D book has gone there: the place itself
     * by default (vrlbry's names an element the 3D page found, and shows the page's place then).
     * @param {P} aim
     * @returns {P | null}
     */
    placeAimed(aim: P): P | null;
    /**
     * Where a place is in the view, in the page's coordinates (a getBoundingClientRect's top), for it to
     * land below the toolbar; null for the part's top (its heading). vrlbry's finds its block, outside's
     * the line with its word.
     * @param {P} place
     * @returns {number | null}
     */
    placeTop(place: P): number | null;
    /**
     * The place at the view's top, top being the toolbar's foot in the page's coordinates: the first
     * block reaching below it (vrlbry's topBlock), and outside's first word there in sight. null keeps
     * the place the view has.
     * @param {number} top
     * @returns {P | null}
     */
    placeAt(top: number): P | null;
    /**
     * Brings the 3D book to a place: in place (inPlace) when the view covers it, the reader's place
     * shared; returns whether it moved (a spread showing it already does not).
     * @param {P} place
     * @param {{ inPlace: boolean }} options
     * @returns {boolean | Promise<boolean>}
     */
    jumpTo(place: P, options: {
        inPlace: boolean;
    }): boolean | Promise<boolean>;
    /** The 3D book a page on (1) or back (-1). @param {number} dir @returns {unknown} */
    turnPage(dir: number): unknown;
    /** The 3D book to a fraction of the way through (0…1): the slider. @param {number} f @returns {unknown} */
    jumpToProgress(f: number): unknown;
    /** The text a size larger (1) or smaller (-1): the 3D book's and the view's. @param {number} step @returns {unknown} */
    changeFont(step: number): unknown;
    /** A theme by name (paper, sepia, night): the 3D book's and the view's. @param {string} name @returns {unknown} */
    setTheme(name: string): unknown;
    /** Back along the links followed (hasTrail). @returns {unknown} */
    goBack(): unknown;
    /** Puts the book back (outside's puts it down), which closes the view (close with keepPlace false). @returns {unknown} */
    putBack(): unknown;
    /** Follows a link of the text (renderPart's onLink), the reader's place shared first, for Back. @param {unknown} link @returns {unknown} */
    followLink(link: unknown): unknown;
    /** The book's contents: vrlbry's by level, outside's pieces with their authors after them. @returns {ContentsEntry<P>[]} */
    contents(): ContentsEntry<P>[];
    /**
     * Goes to an entry of the contents (the contents closed): its place by default, the view showing
     * it. vrlbry's jumps as its 3D contents do.
     * @param {ContentsEntry<P>} entry
     * @returns {unknown}
     */
    useContents(entry: ContentsEntry<P>): unknown;
    /** Where the reader is, said ("12 / 340", or what a page is called). @returns {string} */
    label(): string;
    /** How far through the book the reader is, 0…1. @returns {number} */
    progress(): number;
    /** Whether Back has a link to go back along. @returns {boolean} */
    hasTrail(): boolean;
    /** What a part is called: 'part', or 'article' in a Wikipedia volume. @returns {string} */
    partWord(): string;
    /** The theme the 3D book has: paper, sepia or night. @returns {string} */
    theme(): string;
    /** The text's size, 1 its own. @returns {number} */
    fontScale(): number;
    /** Less motion (access.js reduceMotion): no smooth scrolls, the toolbar not sliding. @returns {boolean} */
    reduced(): boolean;
}
/**
 * What the view needs of the page; the book is its subclass's.
 */
export type TextViewOptions = {
    /**
     * where the view goes (the overlay, inside the page's <main>)
     */
    root: HTMLElement;
    /**
     * a TV's remote that gives the focus to the view (vrlbry's, music's): it
     * holds the focus while reading, not its title, and ↑ ↓ scroll it
     */
    tv?: boolean | undefined;
    /**
     * how far ↑ ↓ and scrollStep scroll, for the height
     * shown below the toolbar: 0.4 of it (vrlbry, music); outside's 0.75 of it, at least 40 px
     */
    step?: ((height: number) => number) | undefined;
    /**
     * where the focus goes
     * when the view closes (away: the book is being put back)
     */
    returnFocus?: ((away: boolean) => HTMLElement | null | undefined) | undefined;
    /**
     * the view has opened (and has the focus)
     */
    onOpen?: (() => void) | undefined;
    /**
     * the view has closed, the 3D book still open
     */
    onClose?: (() => void) | undefined;
};
/**
 * A part built for the view (renderPart): what its title says (the book's, or an article's), and
 * the line under it, none when empty.
 */
export type RenderedPart = {
    title?: string;
    subtitle?: string;
};
/**
 * An entry of the contents (contents): its title, the place it leads to, its level (1 the top,
 * indented down to 6), what follows its link (outside's author), and its link's address ('#').
 */
export type ContentsEntry<P = unknown> = {
    title: string;
    place: P;
    level?: number;
    after?: string;
    href?: string;
};
