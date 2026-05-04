const folderTreeEl = document.getElementById("folder-tree");
const baseFolderLabel = document.getElementById("base-folder-label");
const viewerFolderTitle = document.getElementById("viewer-folder-title");
const viewerSubtitle = document.getElementById("viewer-subtitle");
const viewerCounter = document.getElementById("viewer-counter");
const videoPlayer = document.getElementById("video-player");
const emptyState = document.getElementById("empty-state");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const refreshFoldersBtn = document.getElementById("refresh-folders-btn");
const videoStage = document.querySelector(".video-stage");
const startVideoSelect = document.getElementById("start-video-select");
const applyStartBtn = document.getElementById("apply-start-btn");
const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
const sidebarEl = document.getElementById("folder-sidebar");

const mediaPlayer = window.Plyr
    ? new window.Plyr(videoPlayer, {
        autoplay: false,
        fullscreen: {
            enabled: false,
            fallback: false,
            iosNative: false
        },
        controls: [
            "play-large",
            "restart",
            "rewind",
            "play",
            "fast-forward",
            "progress",
            "current-time",
            "duration",
            "mute",
            "volume",
            "captions",
            "settings",
            "pip",
            "airplay"
        ]
    })
    : null;

const state = {
    selectedFolder: "",
    selectedFolderLabel: "",
    videos: [],
    currentIndex: 0,
    activeButton: null,
    folderTree: null,
    expandedPaths: new Set([""]),
    pendingScrollPath: null
};

let touchStartX = null;

function getScrollBehavior() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function queueFolderIntoView(path) {
    state.pendingScrollPath = path;
}

function queueExpandedChildrenIntoView(path) {
    state.pendingScrollPath = {
        path,
        mode: "children"
    };
}

function ensureSidebarElementVisible(element) {
    if (!sidebarEl || !element) {
        return;
    }

    const sidebarRect = sidebarEl.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const padding = 16;
    const visibleTop = sidebarRect.top + padding;
    const visibleBottom = sidebarRect.bottom - padding;

    if (elementRect.top < visibleTop) {
        sidebarEl.scrollTo({
            top: sidebarEl.scrollTop - (visibleTop - elementRect.top),
            behavior: getScrollBehavior()
        });
        return;
    }

    if (elementRect.bottom > visibleBottom) {
        sidebarEl.scrollTo({
            top: sidebarEl.scrollTop + (elementRect.bottom - visibleBottom),
            behavior: getScrollBehavior()
        });
    }
}

function scrollFolderIntoView(path) {
    if (!sidebarEl || path === null) {
        return;
    }

    const targetPath = typeof path === "string" ? path : path.path;
    const mode = typeof path === "string" ? "row" : path.mode;

    const folderItems = folderTreeEl.querySelectorAll(".folder-item");
    const targetItem = Array.from(folderItems).find((item) => item.dataset.folderPath === targetPath);
    if (!targetItem) {
        return;
    }

    if (mode === "children") {
        const firstChildRow = targetItem.querySelector(".children:not(.collapsed) .folder-row");
        if (firstChildRow) {
            ensureSidebarElementVisible(firstChildRow);
            return;
        }
    }

    const targetRow = targetItem.querySelector(".folder-row");
    const sidebarRect = sidebarEl.getBoundingClientRect();
    const itemRect = targetItem.getBoundingClientRect();
    const padding = 16;
    const visibleTop = sidebarRect.top + padding;
    const visibleBottom = sidebarRect.bottom - padding;
    const maxVisibleHeight = sidebarRect.height - (padding * 2);

    if (itemRect.height > maxVisibleHeight && targetRow) {
        targetRow.scrollIntoView({
            behavior: getScrollBehavior(),
            block: "start",
            inline: "nearest"
        });
        return;
    }

    if (itemRect.top < visibleTop) {
        const offset = visibleTop - itemRect.top;
        sidebarEl.scrollTo({
            top: sidebarEl.scrollTop - offset,
            behavior: getScrollBehavior()
        });
        return;
    }

    if (itemRect.bottom > visibleBottom) {
        const offset = itemRect.bottom - visibleBottom;
        sidebarEl.scrollTo({
            top: sidebarEl.scrollTop + offset,
            behavior: getScrollBehavior()
        });
    }
}

function flushPendingFolderScroll() {
    if (state.pendingScrollPath === null) {
        return;
    }

    const path = state.pendingScrollPath;
    state.pendingScrollPath = null;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            scrollFolderIntoView(path);
        });
    });
}

function setButtonsEnabled() {
    const hasVideos = state.videos.length > 0;
    prevBtn.disabled = !hasVideos || state.currentIndex <= 0;
    nextBtn.disabled = !hasVideos || state.currentIndex >= state.videos.length - 1;
}

function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);

    if (!toggleSidebarBtn) {
        return;
    }

    toggleSidebarBtn.setAttribute("aria-expanded", String(!collapsed));
    toggleSidebarBtn.textContent = collapsed ? "☰ Show Folders" : "☰ Folders";
}

function showError(message) {
    emptyState.style.display = "grid";
    emptyState.textContent = message;
    if (mediaPlayer) {
        mediaPlayer.stop();
        mediaPlayer.source = {
            type: "video",
            sources: []
        };
    } else {
        videoPlayer.removeAttribute("src");
        videoPlayer.load();
    }
    setButtonsEnabled();
    viewerCounter.textContent = "0 / 0";
    populateStartVideoOptions();
}

function formatVideoOption(fileName, index) {
    const displayIndex = String(index + 1).padStart(2, "0");
    return `${displayIndex}. ${fileName}`;
}

function populateStartVideoOptions() {
    if (!startVideoSelect) {
        return;
    }

    startVideoSelect.innerHTML = "";

    if (state.videos.length === 0) {
        const emptyOption = document.createElement("option");
        emptyOption.textContent = "No videos available";
        emptyOption.value = "";
        startVideoSelect.appendChild(emptyOption);
        startVideoSelect.disabled = true;
        if (applyStartBtn) {
            applyStartBtn.disabled = true;
        }
        return;
    }

    state.videos.forEach((video, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = formatVideoOption(video.fileName, index);
        if (index === state.currentIndex) {
            option.selected = true;
        }
        startVideoSelect.appendChild(option);
    });

    startVideoSelect.disabled = false;
    if (applyStartBtn) {
        applyStartBtn.disabled = false;
    }
}

function applyStartSelection() {
    if (!startVideoSelect || state.videos.length === 0) {
        return;
    }

    const nextIndex = Number.parseInt(startVideoSelect.value, 10);
    if (Number.isNaN(nextIndex) || nextIndex < 0 || nextIndex >= state.videos.length) {
        return;
    }

    state.currentIndex = nextIndex;
    updateVideoDisplay(true);
}

function attemptAutoplay() {
    const playbackPromise = mediaPlayer ? mediaPlayer.play() : videoPlayer.play();
    if (playbackPromise && typeof playbackPromise.catch === "function") {
        // Browsers may block autoplay depending on user-gesture rules.
        playbackPromise.catch(() => { });
    }
}

function updateVideoDisplay(shouldAutoplay = false) {
    if (state.videos.length === 0) {
        showError("No videos found in this folder.");
        return;
    }

    const current = state.videos[state.currentIndex];
    if (mediaPlayer) {
        mediaPlayer.source = {
            type: "video",
            title: current.fileName,
            sources: [
                {
                    src: current.url,
                    type: current.mimeType
                }
            ]
        };
    } else {
        videoPlayer.src = current.url;
        videoPlayer.load();
    }

    emptyState.style.display = "none";
    viewerSubtitle.textContent = current.fileName;
    viewerCounter.textContent = `${state.currentIndex + 1} / ${state.videos.length}`;
    setButtonsEnabled();
    populateStartVideoOptions();

    if (shouldAutoplay) {
        attemptAutoplay();
    }
}

function moveVideo(step) {
    if (state.videos.length === 0) {
        return;
    }

    const nextIndex = state.currentIndex + step;
    if (nextIndex < 0 || nextIndex >= state.videos.length) {
        return;
    }

    state.currentIndex = nextIndex;
    updateVideoDisplay(true);
}

async function loadVideos(folderPath, folderLabel) {
    try {
        viewerFolderTitle.textContent = folderLabel;
        viewerSubtitle.textContent = "Loading videos...";

        const response = await fetch(`/api/videos?folder=${encodeURIComponent(folderPath)}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || "Failed to fetch videos.");
        }

        state.selectedFolder = folderPath;
        state.selectedFolderLabel = folderLabel;
        state.videos = payload.videos;
        state.currentIndex = 0;

        populateStartVideoOptions();
        updateVideoDisplay();
    } catch (error) {
        showError(error.message);
    }
}

function toggleFolderExpanded(path) {
    if (state.expandedPaths.has(path)) {
        state.expandedPaths.delete(path);
    } else {
        state.expandedPaths.add(path);
        queueExpandedChildrenIntoView(path);
    }

    renderFolderTree();
}

function makeFolderNode(node) {
    const container = document.createElement("div");
    container.className = "folder-item";
    container.dataset.folderPath = node.path || "";

    const row = document.createElement("div");
    row.className = "folder-row";

    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const nodePath = node.path || "";
    const isExpanded = hasChildren ? state.expandedPaths.has(nodePath) : false;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "folder-button";

    if (node.path === state.selectedFolder && state.activeButton) {
        state.activeButton.classList.remove("active");
        state.activeButton = null;
    }

    const folderGlyph = document.createElement("span");
    folderGlyph.className = "folder-glyph";
    folderGlyph.classList.add(hasChildren && isExpanded ? "folder-glyph-open" : "folder-glyph-closed");
    if (hasChildren) {
        folderGlyph.classList.add("folder-glyph-expandable");
    }

    const label = document.createElement("span");
    label.textContent = node.name;

    const meta = document.createElement("span");
    meta.className = "folder-meta";
    meta.textContent = node.videoCount > 0 ? `${node.videoCount} video${node.videoCount === 1 ? "" : "s"}` : "";

    button.append(folderGlyph, label, meta);

    if (node.path === state.selectedFolder) {
        button.classList.add("active");
        state.activeButton = button;
    }

    button.addEventListener("click", (event) => {
        if (hasChildren && event.target instanceof Element && event.target.closest(".folder-glyph")) {
            toggleFolderExpanded(nodePath);
            return;
        }

        if (node.hasVideos) {
            if (state.activeButton) {
                state.activeButton.classList.remove("active");
            }
            button.classList.add("active");
            state.activeButton = button;
            queueFolderIntoView(nodePath);
            loadVideos(node.path, node.path === "" ? node.name : node.path);
            return;
        }

        if (hasChildren) {
            toggleFolderExpanded(nodePath);
        }
    });

    button.title = node.hasVideos
        ? "Open folder videos"
        : hasChildren
            ? "Expand or collapse subfolders"
            : "No videos in this folder";

    row.appendChild(button);
    container.appendChild(row);

    if (hasChildren) {
        const childrenWrap = document.createElement("div");
        childrenWrap.className = "children";

        if (!state.expandedPaths.has(nodePath)) {
            childrenWrap.classList.add("collapsed");
        }

        for (const child of node.children) {
            childrenWrap.appendChild(makeFolderNode(child));
        }

        container.appendChild(childrenWrap);
    }

    return container;
}

function renderFolderTree() {
    if (!state.folderTree) {
        folderTreeEl.textContent = "No folder data found.";
        return;
    }

    folderTreeEl.innerHTML = "";
    folderTreeEl.appendChild(makeFolderNode(state.folderTree));
    flushPendingFolderScroll();
}

async function loadConfig() {
    try {
        const response = await fetch("/api/config");
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || "Could not load configuration.");
        }

        baseFolderLabel.textContent = `Base: ${payload.baseFolder}`;
    } catch (error) {
        baseFolderLabel.textContent = `Config error: ${error.message}`;
        showError(error.message);
    }
}

async function loadFolderTree() {
    try {
        folderTreeEl.textContent = "Scanning folders...";

        const response = await fetch("/api/folders");
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || "Could not load folders.");
        }

        state.folderTree = payload;
        state.expandedPaths.add("");
        renderFolderTree();
    } catch (error) {
        folderTreeEl.textContent = `Error: ${error.message}`;
        showError(error.message);
    }
}

prevBtn.addEventListener("click", () => moveVideo(-1));
nextBtn.addEventListener("click", () => moveVideo(1));
refreshFoldersBtn.addEventListener("click", () => {
    loadFolderTree();
});

if (startVideoSelect) {
    startVideoSelect.addEventListener("change", () => {
        applyStartSelection();
    });
}

if (applyStartBtn) {
    applyStartBtn.addEventListener("click", () => {
        applyStartSelection();
    });
}

window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
        moveVideo(-1);
    }

    if (event.key === "ArrowRight") {
        moveVideo(1);
    }
});

if (videoStage) {
    videoStage.addEventListener("touchstart", (event) => {
        const point = event.changedTouches[0];
        touchStartX = point ? point.clientX : null;
    }, { passive: true });

    videoStage.addEventListener("touchend", (event) => {
        if (touchStartX === null) {
            return;
        }

        const point = event.changedTouches[0];
        const touchEndX = point ? point.clientX : touchStartX;
        const deltaX = touchEndX - touchStartX;
        touchStartX = null;

        // Horizontal swipe switches videos; threshold avoids accidental triggers.
        if (Math.abs(deltaX) < 48) {
            return;
        }

        if (deltaX > 0) {
            moveVideo(-1);
        } else {
            moveVideo(1);
        }
    }, { passive: true });
}

if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener("click", () => {
        const collapsed = document.body.classList.contains("sidebar-collapsed");
        setSidebarCollapsed(!collapsed);
    });
}

function enforceInlinePlayback() {
    videoPlayer.setAttribute("playsinline", "");
    videoPlayer.setAttribute("webkit-playsinline", "");

    try {
        if (typeof videoPlayer.webkitSetPresentationMode === "function") {
            videoPlayer.webkitSetPresentationMode("inline");
        } else if (typeof videoPlayer.webkitSupportsPresentationMode === "function" && videoPlayer.webkitSupportsPresentationMode("inline")) {
            videoPlayer.webkitPresentationMode = "inline";
        }
    } catch (_error) {
        // Some browsers expose partial WebKit APIs that can throw.
    }
}

videoPlayer.addEventListener("webkitbeginfullscreen", () => {
    if (typeof videoPlayer.webkitExitFullscreen === "function") {
        videoPlayer.webkitExitFullscreen();
    }
    enforceInlinePlayback();
});

videoPlayer.addEventListener("play", () => {
    enforceInlinePlayback();
});

videoPlayer.addEventListener("play", () => {
    setSidebarCollapsed(true);
});

enforceInlinePlayback();
setButtonsEnabled();
populateStartVideoOptions();
loadConfig();
loadFolderTree();
