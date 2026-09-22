import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_CLASS = "ImageOptionPicker";
const ACTIVE_COLOR = "#0b8ce8";
const SOUND_URL = new URL("./pause_option.mp3", import.meta.url).href;

const BUTTON_HEIGHT = 36;
const BUTTON_GAP = 8;
const CONTAINER_PADDING = 6;
const PREVIEW_HEIGHT = 280;

const pausedNodeIds = new Set();

function postSelect(nodeId, option) {
    return fetch(`/image_option_picker/select/${nodeId}/${option}`, { method: "POST" });
}
function postCancel(nodeId) {
    return fetch(`/image_option_picker/cancel/${nodeId}`, { method: "POST" });
}
function postCancelAll() {
    return fetch(`/image_option_picker/cancel`, { method: "POST" });
}
function postReload(nodeId) {
    return fetch(`/image_option_picker/reload/${nodeId}`, { method: "POST" });
}

function imageInfoToUrl(info) {
    if (!info) return null;
    if (typeof info === "string") return info;
    if (info.src) return info.src;
    const params = new URLSearchParams();
    params.set("filename", info.filename || "");
    params.set("type", info.type || "temp");
    if (info.subfolder) params.set("subfolder", info.subfolder);
    return `/view?${params.toString()}`;
}

function getNode(nodeId) {
    const id = String(nodeId);
    return app.graph.getNodeById(id)
        || app.graph.getNodeById(Number(id))
        || app.graph._nodes?.find(n => String(n.id) === id);
}

function createButton(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText = `
        width: 100%; height: ${BUTTON_HEIGHT}px; margin: 0; padding: 0 10px;
        box-sizing: border-box; border: 1px solid #555; border-radius: 6px;
        background: #2a2a2a; color: #eee; font-size: 13px; cursor: pointer; outline: none;
        transition: background 0.12s, border-color 0.12s;
    `;
    const stop = (e) => { e.stopPropagation(); };
    btn.addEventListener("pointerdown", stop, true);
    btn.addEventListener("mousedown", stop, true);
    btn.addEventListener("click", (e) => { stop(e); onClick(); }, true);
    btn.addEventListener("mouseenter", () => {
        if (!btn.disabled && !btn.dataset.active) btn.style.background = "#3a3a3a";
    });
    btn.addEventListener("mouseleave", () => {
        if (btn.dataset.active) {
            btn.style.background = ACTIVE_COLOR;
            btn.style.borderColor = ACTIVE_COLOR;
        } else if (!btn.disabled) {
            btn.style.background = "#2a2a2a";
            btn.style.borderColor = "#555";
        }
    });
    return btn;
}

function setButtonsState(buttons, paused, activeIndex = -1) {
    // buttons: [btn1, btn2, btn3, btnCancel] - index 0,1,2 = options
    buttons.forEach((btn, i) => {
        const isOption = i < 3;
        btn.disabled = !paused;
        btn.style.opacity = paused ? "1" : "0.55";
        btn.style.cursor = paused ? "pointer" : "default";

        if (paused && isOption) {
            // When paused, all three selection buttons are blue
            btn.dataset.active = "1";
            btn.style.background = ACTIVE_COLOR;
            btn.style.borderColor = ACTIVE_COLOR;
        } else if (!paused && i === activeIndex) {
            // After selection, only the pressed one remains blue
            btn.dataset.active = "1";
            btn.style.background = ACTIVE_COLOR;
            btn.style.borderColor = ACTIVE_COLOR;
        } else {
            delete btn.dataset.active;
            btn.style.background = "#2a2a2a";
            btn.style.borderColor = "#555";
        }
    });
}

function setReloadStyle(btn, highlight) {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    if (highlight) {
        btn.dataset.active = "1";
        btn.style.background = ACTIVE_COLOR;
        btn.style.borderColor = ACTIVE_COLOR;
    } else {
        delete btn.dataset.active;
        btn.style.background = "#2a2a2a";
        btn.style.borderColor = "#555";
    }
}

function createPreviewCarousel() {
    const root = document.createElement("div");
    root.style.cssText = `
        position: relative;
        width: 100%;
        height: ${PREVIEW_HEIGHT}px;
        min-height: ${PREVIEW_HEIGHT}px;
        max-height: ${PREVIEW_HEIGHT}px;
        background: #1a1a1a;
        border-radius: 8px;
        overflow: hidden;
        user-select: none;
        box-sizing: border-box;
        flex-shrink: 0;
    `;

    const img = document.createElement("img");
    img.style.cssText = `
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        object-position: center;
        display: block;
        background: #111;
    `;
    img.draggable = false;

    const badge = document.createElement("div");
    badge.style.cssText = `
        position: absolute; top: 8px; left: 8px;
        min-width: 28px; height: 28px; padding: 0 8px;
        border-radius: 14px; background: rgba(0,0,0,0.65);
        color: #fff; font-size: 13px; font-weight: 600;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none; z-index: 2;
    `;
    badge.textContent = "–";

    const makeArrow = (side, symbol) => {
        const a = document.createElement("button");
        a.type = "button";
        a.textContent = symbol;
        a.style.cssText = `
            position: absolute; top: 50%; ${side}: 6px; transform: translateY(-50%);
            width: 40px; height: 52px; border: none; border-radius: 8px;
            background: rgba(0,0,0,0.55); color: #fff; font-size: 28px; line-height: 1;
            cursor: pointer; z-index: 5; outline: none;
            transition: background 0.12s;
        `;
        a.addEventListener("mouseenter", () => { a.style.background = "rgba(0,0,0,0.85)"; });
        a.addEventListener("mouseleave", () => { a.style.background = "rgba(0,0,0,0.55)"; });
        a.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
        a.addEventListener("mousedown", (e) => e.stopPropagation(), true);
        return a;
    };

    const prevBtn = makeArrow("left", "‹");
    const nextBtn = makeArrow("right", "›");

    const empty = document.createElement("div");
    empty.style.cssText = `
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        color: #666; font-size: 13px; pointer-events: none;
    `;
    empty.textContent = "No Preview";

    root.append(img, badge, prevBtn, nextBtn, empty);

    root.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
    root.addEventListener("mousedown", (e) => e.stopPropagation(), true);

    let urls = [];
    let index = 0;

    function render() {
        if (!urls.length) {
            img.style.display = "none";
            img.removeAttribute("src");
            empty.style.display = "flex";
            badge.textContent = "–";
            prevBtn.style.visibility = "hidden";
            nextBtn.style.visibility = "hidden";
            return;
        }
        empty.style.display = "none";
        img.style.display = "block";
        img.src = urls[index];
        badge.textContent = String(index + 1);
        const many = urls.length > 1;
        prevBtn.style.visibility = many ? "visible" : "hidden";
        nextBtn.style.visibility = many ? "visible" : "hidden";
    }

    prevBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (urls.length < 2) return;
        index = (index - 1 + urls.length) % urls.length;
        render();
    });

    nextBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (urls.length < 2) return;
        index = (index + 1) % urls.length;
        render();
    });

    return {
        element: root,
        setImages(list) {
            urls = (list || []).map(imageInfoToUrl).filter(Boolean);
            if (index >= urls.length) index = 0;
            render();
        },
        setIndex(i) {
            if (!urls.length) return;
            index = ((i % urls.length) + urls.length) % urls.length;
            render();
        },
        getIndex() { return index; },
    };
}

app.registerExtension({
    name: "Comfy.ImageOptionPicker",

    nodeCreated(node) {
        if (node.comfyClass !== NODE_CLASS) return;

        try {
            Object.defineProperty(node, "imgs", {
                get() { return null; },
                set() {},
                configurable: true,
            });
        } catch (e) {
            node.imgs = null;
        }

        const carousel = createPreviewCarousel();
        const previewWidget = node.addDOMWidget("option_preview", "custom", carousel.element, {
            serialize: false,
            hideOnZoom: false,
            getMinHeight: () => PREVIEW_HEIGHT,
            getMaxHeight: () => PREVIEW_HEIGHT,
            getHeight: () => PREVIEW_HEIGHT,
        });
        previewWidget.computeSize = (w) => [w, PREVIEW_HEIGHT];

        const btnContainer = document.createElement("div");
        btnContainer.style.cssText = `
            display: flex; flex-direction: column;
            gap: ${BUTTON_GAP}px; padding: ${CONTAINER_PADDING}px;
            width: 100%; box-sizing: border-box;
        `;
        btnContainer.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
        btnContainer.addEventListener("mousedown", (e) => e.stopPropagation(), true);

        const optionsRow = document.createElement("div");
        optionsRow.style.cssText = `
            display: flex; flex-direction: row;
            gap: ${BUTTON_GAP}px; width: 100%; box-sizing: border-box;
        `;

        node._optionPickerActiveIndex = -1;

        const onPick = (optionIndex) => {
            pausedNodeIds.delete(String(node.id));
            node._optionPickerActiveIndex = optionIndex;
            setButtonsState([btn1, btn2, btn3, btnCancel], false, optionIndex);
            setReloadStyle(btnReload, true);
            carousel.setIndex(optionIndex);
            postSelect(node.id, optionIndex + 1);
        };

        const btn1 = createButton("1", () => onPick(0));
        const btn2 = createButton("2", () => onPick(1));
        const btn3 = createButton("3", () => onPick(2));
        [btn1, btn2, btn3].forEach((btn) => {
            btn.style.flex = "1 1 0";
            btn.style.minWidth = "0";
        });

        const btnCancel = createButton("⛔ Cancel", () => {
            pausedNodeIds.delete(String(node.id));
            node._optionPickerActiveIndex = -1;
            setButtonsState([btn1, btn2, btn3, btnCancel], false, -1);
            setReloadStyle(btnReload, true);
            postCancel(node.id);
        });

        const btnReload = createButton("Reload", () => {
            postReload(node.id);
            pausedNodeIds.delete(String(node.id));
            node._optionPickerActiveIndex = -1;
            setButtonsState([btn1, btn2, btn3, btnCancel], false, -1);
            setReloadStyle(btnReload, false);
            try {
                node.setDirtyCanvas?.(true, true);
                app.graph?.setDirtyCanvas?.(true, true);
            } catch (e) {}
        });
        setReloadStyle(btnReload, false);

        optionsRow.append(btn1, btn2, btn3);
        btnContainer.append(optionsRow, btnCancel, btnReload);

        const buttonsHeight = 3 * BUTTON_HEIGHT + 2 * BUTTON_GAP + 2 * CONTAINER_PADDING;
        const buttonsWidget = node.addDOMWidget("option_buttons", "custom", btnContainer, {
            serialize: false,
            hideOnZoom: false,
            getMinHeight: () => buttonsHeight,
            getHeight: () => buttonsHeight,
        });
        buttonsWidget.computeSize = (w) => [w, buttonsHeight];

        setButtonsState([btn1, btn2, btn3, btnCancel], false, -1);

        node._optionPickerButtons = [btn1, btn2, btn3, btnCancel];
        node._optionPickerCarousel = carousel;
        node._optionPickerReloadBtn = btnReload;
        node._optionPickerSetState = (paused, activeIndex) => {
            if (activeIndex === undefined) {
                activeIndex = paused ? -1 : (node._optionPickerActiveIndex ?? -1);
            } else {
                node._optionPickerActiveIndex = activeIndex;
            }
            setButtonsState(node._optionPickerButtons, paused, activeIndex);
            setReloadStyle(btnReload, !paused);
        };
    },

    loadedGraphNode(node) {
        if (node.comfyClass !== NODE_CLASS) return;
        if (!node._optionPickerButtons) return;
        const paused = pausedNodeIds.has(String(node.id));
        node._optionPickerSetState?.(paused);
    },

    setup() {
        api.addEventListener("image_option_paused", (event) => {
            const detail = event.detail || event;
            const nodeId = String(detail.node_id ?? detail.nodeId ?? "");
            if (!nodeId) return;

            pausedNodeIds.add(nodeId);
            const node = getNode(nodeId);
            if (!node) return;

            node._optionPickerActiveIndex = -1;
            node._optionPickerSetState?.(true, -1);

            const images = detail.images || detail.output?.images || [];
            if (images.length && node._optionPickerCarousel) {
                node._optionPickerCarousel.setImages(images);
            }

            try {
                const audio = new Audio(SOUND_URL);
                audio.play().catch(() => {});
            } catch (e) {}
        });

        const originalInterrupt = api.interrupt;
        api.interrupt = function () {
            pausedNodeIds.clear();
            postCancelAll();
            return originalInterrupt.apply(this, arguments);
        };
    }
});
