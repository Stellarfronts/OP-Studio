console.log("OP Studio loaded!");
console.log(
    "PAGE SCRIPT START:",
    new Date().toISOString(),
    "navigation type:",
    performance.getEntriesByType("navigation")[0]?.type
);

// Diagnose unexpected page reloads/navigation
window.addEventListener("pagehide", (event) => {
    console.warn("PAGEHIDE:", {
        time: new Date().toISOString(),
        persisted: event.persisted,
        href: location.href
    });
});

document.addEventListener("submit", (event) => {
    console.warn("FORM SUBMIT DETECTED:", {
        form: event.target,
        submitter: event.submitter,
        time: new Date().toISOString()
    });
});

document.addEventListener("click", (event) => {
    const link = event.target.closest("a");

    if (link) {
        console.warn("LINK CLICK DETECTED:", {
            href: link.href,
            target: link.target,
            element: link,
            time: new Date().toISOString()
        });
    }
});

const YOUTUBE_API_KEY =
    "AIzaSyDAE6ZQM1bi3OXNaMNJCb7nU08Mwj6rXeY";

const YOUTUBE_CLIENT_ID =
    "383277074386-90dvsvguvuukdg1ug72fmmm202kfg63b.apps.googleusercontent.com";

const DEFAULT_COIN_DEFS = [
    { id: "od", label: "O / D", options: [{ value: "O", label: "O" }, { value: "D", label: "D" }] },
    { id: "diDe", label: "Di / De", options: [{ value: "Di", label: "Di" }, { value: "De", label: "De" }] },
    { id: "oiOe", label: "Oi / Oe", options: [{ value: "Oi", label: "Oi" }, { value: "Oe", label: "Oe" }] },
    { id: "ns", label: "N / S", options: [{ value: "N", label: "N" }, { value: "S", label: "S" }] },
    { id: "ft", label: "F / T", options: [{ value: "F", label: "F" }, { value: "T", label: "T" }] },
    { id: "fDeMDe", label: "fDe / mDe", options: [{ value: "fDe", label: "fDe" }, { value: "mDe", label: "mDe" }] },
    { id: "fSmS", label: "fS / mS", options: [{ value: "fS", label: "fS" }, { value: "mS", label: "mS" }] },
    { id: "numOneFour", label: "#1 / #4", options: [{ value: "#1", label: "#1" }, { value: "#4", label: "#4" }] },
    { id: "numTwoThree", label: "#2 / #3", options: [{ value: "#2", label: "#2" }, { value: "#3", label: "#3" }] },
    { id: "cb", label: "C / B", options: [{ value: "C", label: "C" }, { value: "B", label: "B" }] },
    { id: "sp", label: "S / P", options: [{ value: "S", label: "S" }, { value: "P", label: "P" }] },
    { id: "special", label: "(C) / (S) / (P) / (B)", options: [{ value: "(C)", label: "(C)" }, { value: "(S)", label: "(S)" }, { value: "(P)", label: "(P)" }, { value: "(B)", label: "(B)" }] }
];

let viewMode = false; 
let readOnlyMode = false;
let viewedTemplate = null;
let templates = [];
let activeTemplateId = null;
let typeLibrary = [];

let preciseCoinLocks = {};

const GUEST_WORKSPACE_KEY =
    "opsTypingTemplatesGuest";

let activeWorkspaceKey =
    GUEST_WORKSPACE_KEY;

let activeWorkspaceUserId = null;

// Account cloud saves stay locked until
// that account's workspace has been
// deliberately loaded or created.
let accountWorkspaceReady = false;

function setWorkspaceForUser(user) {
    // Switching users/workspaces immediately
    // locks cloud writes until the new
    // workspace has been safely resolved.
    accountWorkspaceReady = false;

    if (user?.id) {

        activeWorkspaceUserId =
            user.id;

        activeWorkspaceKey =
            `opsTypingTemplatesAccount:${user.id}`;
    } else {
        activeWorkspaceUserId =
            null;

        activeWorkspaceKey =
            GUEST_WORKSPACE_KEY;
    }
}

function resetWorkspaceMemory() {
    templates = [];
    folders = [];
    trash = [];

    activeTemplateId = null;

    editingLocked = false;
    showTrash = false;
    showProjectsMenu = false;
}

let editingLocked = false;

let darkMode =
    localStorage.getItem("opsDarkMode") === "true";

let coinSelectionMode =
    localStorage.getItem("opsCoinSelectionMode") ||
    "simple";

let showProjectsMenu = false;
let showTrash = false;
let showNotificationsMenu = false;
let folders = [];
let trash = [];
let draggingTemplateId = null;
let cloudSaveTimer = null;
let cloudSavePending = false;
let cloudSaveRunning = false;
let cloudSaveNeedsAnotherPass = false;
let cloudSaveLastSucceeded = false;
let cloudSavePromise = null;
let youtubeAccessToken =
    sessionStorage.getItem(
        "opsYouTubeAccessToken"
    ) || null;
let youtubeTokenClient = null;
let youtubePlayer = null;
let youtubeProgressTimer = null;

function saveYouTubeProgress() {
    const activeTemplate =
        getActiveTemplate();

    if (
        !activeTemplate ||
        !activeTemplate.youtube ||
        !youtubePlayer ||
        typeof youtubePlayer.getCurrentTime !==
            "function"
    ) {
        return;
    }

    try {
        const currentTime =
            youtubePlayer.getCurrentTime();

        if (Number.isFinite(currentTime)) {
            activeTemplate.youtube.currentTime =
                Math.floor(currentTime);

            saveTemplates();
        }
    } catch (error) {
        console.warn(
            "Unable to save YouTube position:",
            error
        );
    }
}

function loadYouTubeForActiveTemplate() {
    const activeTemplate =
        getActiveTemplate();

    const youtubeIframe =
        document.getElementById(
            "youtubeIframe"
        );

    const youtubeToggleBtn =
        document.getElementById(
            "youtubeToggleBtn"
        );

    if (
        !activeTemplate ||
        !youtubeIframe
    ) {
        return;
    }

    const youtube =
        activeTemplate.youtube || {
            videoId: "",
            currentTime: 0,
            enabled: true
        };

    if (!youtube.videoId) {
        if (
            youtubePlayer &&
            typeof youtubePlayer.stopVideo ===
                "function"
        ) {
            try {
                youtubePlayer.stopVideo();
            } catch (error) {
                console.warn(
                    "Unable to stop YouTube player:",
                    error
                );
            }
        }

        youtubeIframe.src = "";

        document.body.classList.add(
            "youtube-disabled"
        );

        if (youtubeToggleBtn) {
            youtubeToggleBtn.classList.add(
                "off"
            );

            youtubeToggleBtn.title =
                "Turn YouTube on";

            youtubeToggleBtn.setAttribute(
                "aria-label",
                "Turn YouTube on"
            );
        }

        return;
    }

    const enabled =
        youtube.enabled !== false;

    document.body.classList.toggle(
        "youtube-disabled",
        !enabled
    );

    if (youtubeToggleBtn) {
        youtubeToggleBtn.classList.toggle(
            "off",
            !enabled
        );

        youtubeToggleBtn.title =
            enabled
                ? "Turn YouTube off"
                : "Turn YouTube on";

        youtubeToggleBtn.setAttribute(
            "aria-label",
            enabled
                ? "Turn YouTube off"
                : "Turn YouTube on"
        );
    }

    if (
        youtubePlayer &&
        typeof youtubePlayer.cueVideoById ===
            "function"
    ) {
        try {
            youtubePlayer.cueVideoById({
                videoId:
                    youtube.videoId,
                startSeconds:
                    Math.floor(
                        youtube.currentTime || 0
                    )
            });

            return;
        } catch (error) {
            console.warn(
                "Unable to cue saved YouTube video:",
                error
            );
        }
    }

    youtubeIframe.src =
        `https://www.youtube.com/embed/${encodeURIComponent(
            youtube.videoId
        )}?enablejsapi=1&start=${Math.floor(
            youtube.currentTime || 0
        )}`;
}

const notificationsPageBtn =
    document.getElementById("notificationsPageBtn");

function normalizeFolderId(title) {
    return (title || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "folder";
}

function createFolder(title, removable = true) {
    const folder = {
        id: `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        title: title || "Untitled folder",
        removable,
        open: true
    };
    folders.push(folder);
    return folder;
}

function ensureFolders() {
    if (!Array.isArray(folders) || !folders.length) {
        folders = [
            { id: "personal", title: "Personal", removable: false, open: true },
            { id: "unfiled", title: "Unfiled", removable: false, open: true }
        ];
    }

    folders = folders.map(folder => ({ ...folder, open: folder.open !== false }));

    if (!folders.some(folder => folder.id === "personal")) {
        folders.unshift({ id: "personal", title: "Personal", removable: false, open: true });
    }
    if (!folders.some(folder => folder.id === "unfiled")) {
        folders.push({ id: "unfiled", title: "Unfiled", removable: false, open: true });
    }
}

function getFolderById(folderId) {
    ensureFolders();
    return folders.find(folder => folder.id === folderId);
}

function getFolderTitle(folderId) {
    const folder = getFolderById(folderId);
    return folder ? folder.title : "Personal";
}

function normalizeCoins(coins = DEFAULT_COIN_DEFS) {
    return DEFAULT_COIN_DEFS.map(defaultCoin => {
        const existingCoin = (coins || []).find(coin => coin.id === defaultCoin.id);
        const options = (defaultCoin.options || []).map(defaultOption => {
            const existingOption = (existingCoin?.options || []).find(option => option.value === defaultOption.value);
            return {
                ...defaultOption,
                ...(existingOption || {}),
                definition: existingOption?.definition || defaultOption.definition || ""
            };
        });

        return {
            ...defaultCoin,
            ...(existingCoin || {}),
            options
        };
    });
}

function getSelectionValueFromSlider(coin, sliderValue) {
    const value = Number(sliderValue);

    // Far-left + middle-left both mean
    // the left coin is selected.
    if (value <= 1) {
        return coin.options[0].value;
    }

    // Center means neither side is selected.
    if (value === 2) {
        return undefined;
    }

    // Middle-right + far-right both mean
    // the right coin is selected.
    if (value >= 3) {
        return coin.options[1].value;
    }

    return undefined;
}

function getSliderValueFromSelection(coin, selectedValue) {
    if (selectedValue === coin.options[0].value) {
        return 0;
    }
    if (selectedValue === "__mid_left__") {
        return 1;
    }
    if (selectedValue === "__mid_center__") {
        return 2;
    }
    if (selectedValue === "__mid_right__") {
        return 3;
    }
    if (selectedValue === coin.options[1].value) {
        return 4;
    }
    return 2;
}

function setTemplateSelection(activeTemplate, coin, selectedValue) {

    if (readOnlyMode) {
        return;
    }

    if (!activeTemplate) {
        return;
    }

    if (selectedValue === undefined) {
        delete activeTemplate.selections[coin.id];
    } else {
        activeTemplate.selections[coin.id] = selectedValue;
    }

    activeTemplate.sliderStates = activeTemplate.sliderStates || {};
    activeTemplate.sliderStates[coin.id] = getSliderValueFromSelection(coin, selectedValue);

}

function normalizeTemplate(template) {
    ensureFolders();

    const coins = normalizeCoins(template?.coins);
    const selections = {};

    coins.forEach(coin => {
        const selectedValue = template?.selections?.[coin.id];
        const sliderState = template?.sliderStates?.[coin.id];
        const isValidSelection = coin.options.some(option => option.value === selectedValue) ||
            (coin.options.length === 2 && ["__mid_left__", "__mid_center__", "__mid_right__"].includes(selectedValue));

        if (selectedValue && isValidSelection) {
            selections[coin.id] = selectedValue;
        } else if (coin.options.length === 2 && Number.isFinite(sliderState)) {
            selections[coin.id] = getSelectionValueFromSlider(coin, sliderState);
        }
    });

    const legacyFolderName = template?.folder || "Personal";
    const legacyFolderId = template?.folderId || normalizeFolderId(legacyFolderName);
    const matchingFolder = folders.find(folder => folder.id === legacyFolderId || folder.title === legacyFolderName);
    const folderId = matchingFolder ? matchingFolder.id : (legacyFolderName === "Personal" ? "personal" : createFolder(legacyFolderName).id);

    return {
        ...template,
        folderId,
        folder: getFolderTitle(folderId),
        coins,
        selections,
        saviorState: template?.saviorState || "",
demonState: template?.demonState || "",

youtube: {
    videoId: template?.youtube?.videoId || "",
    currentTime: Number(template?.youtube?.currentTime) || 0,
    enabled: template?.youtube?.enabled !== false
},

images: Array.isArray(template?.images)
            ? template.images.map(image => ({
                src: image?.src || "",
                size: Number.isFinite(Number(image?.size)) ? Number(image.size) : 120,
                height: Number.isFinite(Number(image?.height)) ? Number(image.height) : 180,
                aspectRatio: Number.isFinite(Number(image?.aspectRatio)) && Number(image?.aspectRatio) > 0
                    ? Number(image.aspectRatio)
                    : ((Number.isFinite(Number(image?.height)) ? Number(image.height) : 180) /
                        Math.max(1, (Number.isFinite(Number(image?.size)) ? Number(image.size) : 120)))
            })).filter(image => image.src)
            : []
    };
}

function createTemplate() {
    ensureFolders();
    const sourceTemplate = getActiveTemplate();
    const folderId = sourceTemplate?.folderId || "personal";
    const template = {
        id: Date.now().toString(36),
        title: "",
        folderId,
        folder: getFolderTitle(folderId),
        notes: "",
        selections: {},
        sliderStates: {},
        saviorState: sourceTemplate?.saviorState || "",
demonState: sourceTemplate?.demonState || "",

youtube: {
    videoId: "",
    currentTime: 0,
    enabled: true
},

images: [],
        coins: normalizeCoins(sourceTemplate ? sourceTemplate.coins : DEFAULT_COIN_DEFS)
    };

    templates.push(template);
    activeTemplateId = template.id;
saveAll();
    render();
    return template;
}

function getActiveTemplate() {

    if (viewMode && viewedTemplate) {
        return viewedTemplate;
    }

    return templates.find(template => template.id === activeTemplateId) || templates[0];

}

function pruneTrash() {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    trash = trash.filter(entry => (entry.removedAt || 0) > cutoff);
}

function saveTemplates() {

    if (readOnlyMode) {
        return;
    }

    if (
        typeof localStorage ===
        "undefined"
    ) {
        return;
    }

    const localSavedAt =
        Date.now();

    localStorage.setItem(
        activeWorkspaceKey,
        JSON.stringify({
            templates,
            folders,
            trash,
            editingLocked,
            darkMode,
            activeTemplateId,
            showTrash,
            savedAt:
                localSavedAt
        })
    );
}

async function saveTemplatesToCloud() {
    if (readOnlyMode || viewMode) {
        return;
    }

    if (typeof supabaseClient === "undefined") {
        return;
    }

    // Never allow an authenticated account workspace
    // to write to Supabase until that workspace has
    // been deliberately loaded or safely initialized.
    if (
        activeWorkspaceUserId &&
        !accountWorkspaceReady
    ) {
        console.warn(
            "Cloud save blocked: account workspace is not ready."
        );
        return;
    }

    // If a cloud write is already happening,
    // don't queue an old snapshot behind it.
    // Just remember that we need one newest-state save afterward.
    if (cloudSaveRunning) {
        cloudSaveNeedsAnotherPass = true;
        return;
    }

cloudSaveRunning = true;

// This save attempt must prove that it
// successfully reached Supabase.
cloudSaveLastSucceeded = false;

// Create a promise that stays pending for
// the entire lifetime of this cloud save.
let resolveCloudSavePromise;

cloudSavePromise =
    new Promise(resolve => {
        resolveCloudSavePromise = resolve;
    });

try {
    // Capture the exact account/workspace this save
    // belongs to before any asynchronous work begins.
    const saveWorkspaceUserId =
        activeWorkspaceUserId;

    const saveWorkspaceKey =
        activeWorkspaceKey;

    do {
        cloudSaveNeedsAnotherPass = false;


const localSaved =
    JSON.parse(
        localStorage.getItem(
            saveWorkspaceKey
        ) || "{}"
    );

            // Snapshot is created immediately before THIS upload,
            // so it is always the newest available state.
            const cloudSnapshot =
                structuredClone({
                    templates,
                    folders,
                    trash,
                    editingLocked,
                    darkMode,
                    activeTemplateId,
                    showTrash,
                    savedAt:
                        Number(localSaved.savedAt) ||
                        Date.now()
                });

const {
    data: { user },
    error: userError
} =
    await supabaseClient.auth.getUser();

if (
    userError ||
    !user ||
    !saveWorkspaceUserId ||
    saveWorkspaceUserId !== user.id ||
activeWorkspaceUserId !== saveWorkspaceUserId ||
activeWorkspaceKey !== saveWorkspaceKey ||
!accountWorkspaceReady
) {
    console.warn(
        "Cloud save cancelled: workspace changed while save was running."
    );
    return;
}

            const { error } =
                await supabaseClient
                    .from("user_data")
                    .upsert(
                        {
                            user_id: user.id,
                            data: cloudSnapshot,
                            updated_at:
                                new Date().toISOString()
                        },
                        {
                            onConflict: "user_id"
                        }
                    );

            if (error) {
                console.error(
                    "Cloud save failed:",
                    error
                );

                return;
            }

console.log(
    "Cloud save successful!",
    new Date().toISOString()
);

// Record that this save pass reached
// Supabase successfully.
cloudSaveLastSucceeded = true;

            // If another edit happened while we were uploading,
            // loop once more and upload the newest state.
        } while (cloudSaveNeedsAnotherPass);

    } catch (error) {
        console.error(
            "Cloud save failed:",
            error
        );
} finally {
    cloudSaveRunning = false;

    if (resolveCloudSavePromise) {
        resolveCloudSavePromise(
            cloudSaveLastSucceeded
        );
    }
}
}

function scheduleCloudSave() {
    if (readOnlyMode || viewMode) {
        return;
    }

    cloudSavePending = true;

    if (cloudSaveTimer) {
        clearTimeout(cloudSaveTimer);
    }

    cloudSaveTimer = setTimeout(
        async () => {
            cloudSaveTimer = null;
            cloudSavePending = false;

            await saveTemplatesToCloud();
        },
        25
    );
}

function saveAll() {
    // Browser storage updates immediately.
    saveTemplates();

    // Supabase receives the newest state
    // after editing pauses briefly.
    scheduleCloudSave();
}

async function flushCloudSave() {
    if (cloudSaveTimer) {
        clearTimeout(cloudSaveTimer);
        cloudSaveTimer = null;
    }

    cloudSavePending = false;

    // If a save is already running, request one
    // final newest-state pass and wait for the
    // entire running save cycle to finish.
    if (cloudSaveRunning) {
        cloudSaveNeedsAnotherPass = true;

        if (cloudSavePromise) {
            await cloudSavePromise;
        }

        return cloudSaveLastSucceeded;
    }

    await saveTemplatesToCloud();

    return cloudSaveLastSucceeded;
}

function loadTemplates() {
    const saved =
        localStorage.getItem(
            activeWorkspaceKey
        );

    if (!saved) {
        createTemplate();
        return;
    }

    let parsed;

    try {
        parsed =
            JSON.parse(saved);
    } catch (error) {
        console.warn(
            "Could not load workspace:",
            error
        );

        createTemplate();
        return;
    }

    ensureFolders();

    if (
        parsed.templates &&
        parsed.templates.length
    ) {
        folders =
            Array.isArray(
                parsed.folders
            ) &&
            parsed.folders.length
                ? parsed.folders
                : folders;

        ensureFolders();

        trash =
            Array.isArray(
                parsed.trash
            )
                ? parsed.trash
                : [];

        pruneTrash();

        templates =
            parsed.templates.map(
                normalizeTemplate
            );

        editingLocked =
            Boolean(
                parsed.editingLocked
            );

        activeTemplateId =
            parsed.activeTemplateId ||
            templates[0].id;

        showTrash =
            Boolean(
                parsed.showTrash
            );
    } else {
        createTemplate();
    }
}

async function loadTemplatesFromCloud() {
    if (typeof supabaseClient === "undefined") {
        return false;
    }

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        return false;
    }

    const { data, error } = await supabaseClient
        .from("user_data")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Cloud load failed:", error);
        return false;
    }

    if (!data || !data.data) {
        console.log("No cloud data found for this account.");
        return false;
    }

    const cloudData = data.data;

/*
    Protect newer browser work from being
    overwritten by an older cloud copy.
*/
let localData = {};

try {
localData = JSON.parse(
    localStorage.getItem(
        activeWorkspaceKey
    ) || "{}"
);
} catch (error) {
    console.warn(
        "Could not read local save timestamp:",
        error
    );
}

const localSavedAt =
    Number(localData.savedAt) || 0;

const cloudSavedAt =
    Number(cloudData.savedAt) || 0;

console.log("Save comparison:", {
    localSavedAt,
    cloudSavedAt
});

if (
    localSavedAt > 0 &&
    localSavedAt > cloudSavedAt
) {
    console.log(
        "Local account cache is newer, but cloud account data takes priority on login."
    );
}

    if (Array.isArray(cloudData.folders)) {
        folders = cloudData.folders;
    }

    if (Array.isArray(cloudData.trash)) {
        trash = cloudData.trash;
    }

    if (Array.isArray(cloudData.templates) && cloudData.templates.length) {
        templates = cloudData.templates.map(normalizeTemplate);
    }

    editingLocked = Boolean(cloudData.editingLocked);
    showTrash = Boolean(cloudData.showTrash);

    if (cloudData.activeTemplateId &&
        templates.some(template => template.id === cloudData.activeTemplateId)) {
        activeTemplateId = cloudData.activeTemplateId;
    } else if (templates.length) {
        activeTemplateId = templates[0].id;
    }

    ensureFolders();
    pruneTrash();

localStorage.setItem(
    activeWorkspaceKey,
    JSON.stringify({
        templates,
        folders,
        trash,
        editingLocked,
        darkMode,
        activeTemplateId,
        showTrash,
        savedAt:
            Number(
                cloudData.savedAt
            ) || Date.now()
    })
);

// This account's real workspace has now
// been successfully resolved from Supabase.
// Cloud writes are safe from this point on.
accountWorkspaceReady = true;

console.log("Cloud load successful!");
return true;
}

function moveTemplateToTrash(templateId) {
    const index =
        templates.findIndex(
            template =>
                template.id === templateId
        );

    if (index < 0) return;

    if (activeTemplateId === templateId) {
        saveYouTubeProgress();
    }

    const [template] =
        templates.splice(index, 1);

    trash.push({
        id: template.id,
        template,
        removedAt: Date.now()
    });

    if (activeTemplateId === templateId) {
        activeTemplateId =
            templates[0]?.id || null;
    }

    saveAll();
    render();

    if (activeTemplateId) {
        loadYouTubeForActiveTemplate();
    }
}

function restoreTemplateFromTrash(trashId) {
    saveYouTubeProgress();

    const entry = trash.find(
        item => item.id === trashId
    );

    if (!entry) return;

    const restored = {
        ...entry.template
    };

    templates.push(restored);

    trash = trash.filter(
        item => item.id !== trashId
    );

    activeTemplateId =
        restored.id;

    saveAll();
    render();

    loadYouTubeForActiveTemplate();
}

function addFolder() {
    const folder = createFolder("New folder", true);
    saveAll();
    render();
    return folder;
}

function renameFolder(folderId, title) {
    const folder = getFolderById(folderId);
    if (!folder) return;
    folder.title = title || "Untitled folder";
   saveAll();
    render();
}

function removeFolder(folderId) {
    const folder = getFolderById(folderId);
    if (!folder || !folder.removable) return;
    templates.forEach(template => {
        if (template.folderId === folderId) {
            template.folderId = "unfiled";
            template.folder = getFolderTitle("unfiled");
        }
    });
    folders = folders.filter(item => item.id !== folderId);
    if (!folders.some(folder => folder.id === "unfiled")) {
        folders.push({ id: "unfiled", title: "Unfiled", removable: false });
    }
    saveAll();
    render();
}

function moveTemplateToFolder(templateId, folderId, targetTemplateId = null) {
    const template = templates.find(item => item.id === templateId);
    if (!template) return;

    template.folderId = folderId;
    template.folder = getFolderTitle(folderId);

    const fromIndex = templates.findIndex(item => item.id === templateId);
    if (fromIndex < 0) return;

    if (targetTemplateId) {
        const targetIndex = templates.findIndex(item => item.id === targetTemplateId);
        if (targetIndex >= 0 && targetIndex !== fromIndex) {
            const [moved] = templates.splice(fromIndex, 1);
            const insertIndex = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
            templates.splice(Math.max(0, insertIndex), 0, moved);
        }
    }

    saveAll();
    render();
}

function handleTemplateDragStart(templateId) {
    draggingTemplateId = templateId;
}

function handleTemplateDrop(folderId, targetTemplateId = null) {
    if (!draggingTemplateId) return;
    moveTemplateToFolder(draggingTemplateId, folderId, targetTemplateId);
    draggingTemplateId = null;
}

function filterTypesBySelections(
    types,
    activeSelections = {}
) {
    return types.filter(type => {

        return Object.entries(
            activeSelections
        ).every(([id, rawValue]) => {

            const coin =
                DEFAULT_COIN_DEFS.find(
                    item =>
                        item.id === id
                );

            let value = rawValue;

            /*
                Compatibility with older
                saved typings that used
                the temporary midpoint
                strings.
            */

            if (
                value === "__mid_center__"
            ) {
                return true;
            }

            if (
                value === "__mid_left__" &&
                coin
            ) {
                value =
                    coin.options[0].value;
            }

            if (
                value === "__mid_right__" &&
                coin
            ) {
                value =
                    coin.options[1].value;
            }

            return (
                type.selections[id] ===
                value
            );
        });
    });
}

function generateTypeLibrary() {
    const library = [];

    const binaryChoices = {
        od: ["O", "D"],
        diDe: ["Di", "De"],
        oiOe: ["Oi", "Oe"],
        ns: ["N", "S"],
        ft: ["F", "T"],
        fDeMDe: ["fDe", "mDe"],
        fSmS: ["fS", "mS"],
        numOneFour: ["#1", "#4"],
        numTwoThree: ["#2", "#3"]
    };

    const keys =
        Object.keys(binaryChoices);

    function getFirstAnimal(
        oiOe,
        diDe
    ) {
        if (
            oiOe === "Oe" &&
            diDe === "Di"
        ) {
            return "C";
        }

        if (
            oiOe === "Oe" &&
            diDe === "De"
        ) {
            return "P";
        }

        if (
            oiOe === "Oi" &&
            diDe === "De"
        ) {
            return "B";
        }

        if (
            oiOe === "Oi" &&
            diDe === "Di"
        ) {
            return "S";
        }

        return null;
    }

    function recurse(
        index,
        selections
    ) {
        if (index < keys.length) {
            const key = keys[index];

            binaryChoices[key].forEach(
                value => {
                    recurse(
                        index + 1,
                        {
                            ...selections,
                            [key]: value
                        }
                    );
                }
            );

            return;
        }

        const firstAnimal =
            getFirstAnimal(
                selections.oiOe,
                selections.diDe
            );

        if (!firstAnimal) {
            return;
        }

        /*
            First animal determines
            which axis the second animal
            must come from.
        */

        const secondChoices =
            firstAnimal === "C" ||
            firstAnimal === "B"
                ? ["S", "P"]
                : ["C", "B"];

        secondChoices.forEach(
            secondAnimal => {

                const remainingAnimals =
                    [
                        "C",
                        "S",
                        "P",
                        "B"
                    ].filter(
                        animal =>
                            animal !==
                                firstAnimal &&
                            animal !==
                                secondAnimal
                    );

                /*
                    Either one of the two
                    remaining animals can
                    occupy the final
                    parenthesized position.

                    The other is then
                    automatically third.
                */

                remainingAnimals.forEach(
                    lastAnimal => {

                        let cb;
                        let sp;

                        if (
                            firstAnimal === "C" ||
                            firstAnimal === "B"
                        ) {
                            cb =
                                firstAnimal;

                            sp =
                                secondAnimal;
                        } else {
                            sp =
                                firstAnimal;

                            cb =
                                secondAnimal;
                        }

                        const fullSelections = {
                            ...selections,
                            cb,
                            sp,
                            special:
                                `(${lastAnimal})`
                        };

                        library.push({
                            id:
                                library.length +
                                1,

                            label:
                                buildTypeLabel(
                                    fullSelections
                                ),

                            selections:
                                fullSelections
                        });
                    }
                );
            }
        );
    }

    recurse(0, {});

    console.log(
        "Complete type library:",
        library.length
    );

    return library;
}

function buildTypeLabel(selections) {
    const firstPair =
        buildPreviewFirstPair(
            selections.od,
            selections.fSmS,
            selections.fDeMDe
        );

    const styleSegment =
        buildPreviewStyleSegment(
            selections.ft,
            selections.diDe,
            selections.ns,
            selections.oiOe,
            selections.od
        );

    const axisSegment =
        buildPreviewAxisSegment(
            selections.oiOe,
            selections.diDe,
            selections.cb,
            selections.sp,
            selections.special
        );

    const numberCode =
        buildPreviewNumberCode(
            selections.numOneFour,
            selections.numTwoThree
        );

    return `${firstPair} ${styleSegment} ${axisSegment} ${numberCode}`.trim();
}

function buildSavedTypingPreviewLabel(selections) {
    const firstPair = buildPreviewFirstPair(selections.od, selections.fSmS, selections.fDeMDe);
    const styleSegment = buildPreviewStyleSegment(selections.ft, selections.diDe, selections.ns, selections.oiOe, selections.od);
const axisSegment = buildPreviewAxisSegment(
    selections.oiOe,
    selections.diDe,
    selections.cb,
    selections.sp,
    selections.special
);
    const numberCode = buildPreviewNumberCode(selections.numOneFour, selections.numTwoThree);
    return `${firstPair || "XX"} ${styleSegment || "Xx/Xx"} ${axisSegment || "XX/X(X)"} ${numberCode || "#x"}`.trim();
}

function buildPreviewFirstPair(
    od,
    fSmS,
    fDeMDe
) {
    const left =
        fSmS === "mS"
            ? "M"
            : fSmS === "fS"
                ? "F"
                : "X";

    const right =
        fDeMDe === "mDe"
            ? "M"
            : fDeMDe === "fDe"
                ? "F"
                : "X";

    return `${left}${right}`;
}

function buildPreviewStyleSegment(
    ft,
    diDe,
    ns,
    oiOe,
    od
) {
    // =========================
    // Decider function
    // F/T + Di/De
    // =========================

    const deciderLetter =
        ft === "F"
            ? "F"
            : ft === "T"
                ? "T"
                : "X";

    const deciderDirection =
        diDe === "Di"
            ? "i"
            : diDe === "De"
                ? "e"
                : "x";

    const decider =
        `${deciderLetter}${deciderDirection}`;


    // =========================
    // Observer function
    // S/N + Oi/Oe
    // =========================

    const observerLetter =
        ns === "S"
            ? "S"
            : ns === "N"
                ? "N"
                : "X";

    const observerDirection =
        oiOe === "Oi"
            ? "i"
            : oiOe === "Oe"
                ? "e"
                : "x";

    const observer =
        `${observerLetter}${observerDirection}`;


    // =========================
    // O / D determines order
    // =========================

    if (od === "O") {
        return `${observer}/${decider}`;
    }

    if (od === "D") {
        return `${decider}/${observer}`;
    }

    /*
        O/D is unknown.

        We know the functions themselves,
        but we DON'T know their order yet.

        ↔ means "order unresolved".
    */
    return `${observer}↔${decider}`;
}

function buildPreviewAxisSegment(
    oiOe,
    diDe,
    cb,
    sp,
    special
) {
    // =========================
    // First animal
    // Oi/Oe + Di/De
    // =========================

    let first = "X";

    if (oiOe === "Oe" && diDe === "Di") {
        first = "C";
    } else if (oiOe === "Oe" && diDe === "De") {
        first = "P";
    } else if (oiOe === "Oi" && diDe === "De") {
        first = "B";
    } else if (oiOe === "Oi" && diDe === "Di") {
        first = "S";
    }

    // =========================
    // Second animal
    //
    // Must come from the OTHER
    // animal axis from the first.
    // =========================

    let second = "X";

    if (first === "C" || first === "B") {
        // First animal is on C/B axis,
        // so second must come from S/P.
        if (sp === "S" || sp === "P") {
            second = sp;
        }
    } else if (first === "S" || first === "P") {
        // First animal is on S/P axis,
        // so second must come from C/B.
        if (cb === "C" || cb === "B") {
            second = cb;
        }
    }

    // =========================
    // Last animal in parentheses
    // =========================

    const last =
        special
            ? special.replace(/[()]/g, "")
            : "X";

    // =========================
    // Third animal
    //
    // Once first, second and last
    // are known, the remaining
    // animal is forced.
    // =========================

    let third = "X";

    if (
        first !== "X" &&
        second !== "X" &&
        last !== "X"
    ) {
        const allAnimals = [
            "C",
            "S",
            "P",
            "B"
        ];

        const usedAnimals =
            new Set([
                first,
                second,
                last
            ]);

        const remaining =
            allAnimals.filter(
                animal =>
                    !usedAnimals.has(animal)
            );

        if (remaining.length === 1) {
            third = remaining[0];
        }
    }

    return `${first}${second}/${third}(${last})`;
}

function buildPreviewNumberCode(oneFour, twoThree) {
    if (!oneFour && !twoThree) {
        return "#x";
    }

    if (!oneFour) {
        return twoThree;
    }

    if (!twoThree) {
        return oneFour;
    }

    if (oneFour === "#1" && twoThree === "#2") {
        return "#1";
    }

    if (oneFour === "#1" && twoThree === "#3") {
        return "#3";
    }

    if (oneFour === "#4" && twoThree === "#2") {
        return "#2";
    }

    if (oneFour === "#4" && twoThree === "#3") {
        return "#4";
    }

    return "#x";
}

function buildFirstPair(od, fSmS, fDeMDe) {
    if (!od || !fSmS || !fDeMDe) return "";
    const left = fSmS === "mS" ? "M" : "F";
    const right = fDeMDe === "mDe" ? "M" : "F";
    return od === "D" ? `${right}${left}` : `${left}${right}`;
}

function buildStyleSegment(ft, diDe, ns, oiOe = "Oi", od = "O") {
    if (!ft || !diDe || !ns || !oiOe || !od) return "";
    const base = (ft === "F" && diDe === "Di") ? "Fi" :
        (ft === "F" && diDe === "De") ? "Fe" :
        (ft === "T" && diDe === "Di") ? "Ti" :
        (ft === "T" && diDe === "De") ? "Te" : "Fi";
    const second = oiOe === "Oe"
        ? (ns === "N" ? "Ne" : "Se")
        : (oiOe === "Oi" ? (ns === "N" ? "Ni" : "Si") : (ns === "N" ? "Ni" : "Se"));
    return od === "D" ? `${second}/${base}` : `${base}/${second}`;
}

function buildAxisSegment(cb, sp, special) {
    const specialLetter = normalizeSpecialLetter(special);
    if (!cb || !sp || !specialLetter) return "";
    if (!['C', 'B'].includes(cb) || !['S', 'P'].includes(sp)) return "";

    const oppositeSp = sp === "S" ? "P" : "S";
    return `${cb}${sp}/${oppositeSp}(${specialLetter})`;
}

function buildNumberCode(oneFour, twoThree) {
    if (!oneFour || !twoThree) return "";
    const values = [oneFour, twoThree];
    if (values.includes("#1") && values.includes("#2")) return "#1";
    if (values.includes("#1") && values.includes("#3")) return "#3";
    if (values.includes("#2") && values.includes("#4")) return "#2";
    if (values.includes("#3") && values.includes("#4")) return "#4";
    return "#1";
}

function applyTheme() {
    document.body.classList.toggle("dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
}

function getTemplatePreview(template) {
    const previewType = buildSavedTypingPreviewLabel({
        ...template?.selections,
        ...(template?.selections?.special ? { special: template.selections.special } : {})
    });
    return previewType || "Select coins to build a type";
}


function toggleFolder(folderId) {
    const folder = getFolderById(folderId);
    if (!folder) return;
    folder.open = !folder.open;
    saveTemplates();
    render();
}

function renderProjectsMenu() {
    const menu = document.getElementById("projectsMenu");

    if (!menu) {
        return;
    }

    menu.innerHTML = "";

    if (!showProjectsMenu) {
        menu.classList.remove("open");
        return;
    }

    menu.classList.add("open");

    const header =
        document.createElement("div");

    header.className =
        "projects-menu-header";

    const trashBtn =
        document.createElement("button");

    trashBtn.className =
        "projects-toolbar-btn";

    trashBtn.textContent =
        showTrash
            ? "← Back"
            : "Trash";

    trashBtn.onclick = () => {
        showTrash = !showTrash;
        render();
    };

    const addFolderBtn =
        document.createElement("button");

    addFolderBtn.className =
        "projects-toolbar-btn";

    addFolderBtn.textContent =
        "+ Folder";

    addFolderBtn.onclick = () => {
        addFolder();
    };

    header.appendChild(trashBtn);
    header.appendChild(addFolderBtn);

    menu.appendChild(header);

    if (showTrash) {
        const trashList =
            document.createElement("div");

        trashList.className =
            "project-group";

        trash.forEach(entry => {
            const item =
                document.createElement("div");

            item.className =
                "project-item project-trash-item";

            item.draggable = true;

            item.ondragstart = () =>
                handleTemplateDragStart(
                    entry.template.id
                );

            item.onclick = () => {
                activeTemplateId =
                    entry.template.id;

                showProjectsMenu = false;

                saveTemplates();
                render();
            };

            const labelContent =
                document.createElement("div");

            labelContent.className =
                "project-item-content";

            const label =
                document.createElement("span");

            label.textContent =
                entry.template.title ||
                "Untitled";

            const preview =
                document.createElement("div");

            preview.className =
                "project-item-preview";

            preview.textContent =
                getTemplatePreview(
                    entry.template
                );

            labelContent.appendChild(label);
            labelContent.appendChild(preview);

            const restoreBtn =
                document.createElement("button");

            restoreBtn.className =
                "project-action-btn";

            restoreBtn.textContent =
                "Restore";

            restoreBtn.onclick = event => {
                event.stopPropagation();

                restoreTemplateFromTrash(
                    entry.id
                );
            };

            item.appendChild(labelContent);
            item.appendChild(restoreBtn);

            trashList.appendChild(item);
        });

        menu.appendChild(trashList);

        return;
    }

    ensureFolders();

    folders.forEach(folder => {
        const group =
            document.createElement("div");

        group.className =
            "project-group";

        group.ondragover =
            event =>
                event.preventDefault();

        group.ondrop = () =>
            handleTemplateDrop(
                folder.id
            );

        const heading =
            document.createElement("div");

        heading.className =
            "project-group-title";

        heading.onclick = event => {
            if (
                event.target.closest(
                    "button"
                )
            ) {
                return;
            }

            toggleFolder(folder.id);
        };

        const toggleBtn =
            document.createElement("button");

        toggleBtn.className =
            "project-action-btn project-folder-toggle";

        toggleBtn.textContent =
            folder.open
                ? "▾"
                : "▸";

        toggleBtn.onclick = event => {
            event.stopPropagation();
            toggleFolder(folder.id);
        };

        const titleLabel =
            document.createElement("span");

        titleLabel.className =
            "folder-title-label";

        titleLabel.textContent =
            folder.title;

        if (folder.removable) {
            const renameBtn =
                document.createElement(
                    "button"
                );

            renameBtn.className =
                "project-action-btn";

            renameBtn.textContent =
                "✎";

            renameBtn.onclick = () => {
                const nextTitle =
                    prompt(
                        "Folder name",
                        folder.title || ""
                    );

                if (nextTitle !== null) {
                    renameFolder(
                        folder.id,
                        nextTitle
                    );
                }
            };

            const removeBtn =
                document.createElement(
                    "button"
                );

            removeBtn.className =
                "project-action-btn";

            removeBtn.textContent =
                "×";

            removeBtn.onclick = () =>
                removeFolder(
                    folder.id
                );

            heading.appendChild(
                renameBtn
            );

            heading.appendChild(
                removeBtn
            );
        }

        heading.appendChild(toggleBtn);
        heading.appendChild(titleLabel);

        group.appendChild(heading);

        const content =
            document.createElement("div");

        content.className =
            "project-group-items";

        if (!folder.open) {
            content.style.display =
                "none";
        }

        group.appendChild(content);

        const folderTemplates =
            templates.filter(
                template =>
                    template.folderId ===
                    folder.id
            );

        folderTemplates.forEach(
            template => {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "project-item";

                item.draggable = true;

                item.ondragstart = () =>
                    handleTemplateDragStart(
                        template.id
                    );

                item.ondragover =
                    event =>
                        event.preventDefault();

                item.ondrop = () =>
                    handleTemplateDrop(
                        folder.id,
                        template.id
                    );

item.onclick = () => {
    const previousTemplate =
        getActiveTemplate();

    if (
        previousTemplate?.youtube &&
        youtubePlayer &&
        typeof youtubePlayer.getCurrentTime === "function"
    ) {
        try {
            const currentTime =
                youtubePlayer.getCurrentTime();

            if (Number.isFinite(currentTime)) {
                previousTemplate.youtube.currentTime =
                    Math.floor(currentTime);
            }
        } catch (error) {
            console.warn(
                "Unable to save previous YouTube position:",
                error
            );
        }
    }

activeTemplateId =
    template.id;

showProjectsMenu =
    false;

saveAll();
render();

loadYouTubeForActiveTemplate();
};

                const labelContent =
                    document.createElement(
                        "div"
                    );

                labelContent.className =
                    "project-item-content";

                const label =
                    document.createElement(
                        "span"
                    );

                label.textContent =
                    template.title ||
                    "Untitled";

                const preview =
                    document.createElement(
                        "div"
                    );

                preview.className =
                    "project-item-preview";

                preview.textContent =
                    getTemplatePreview(
                        template
                    );

                labelContent.appendChild(
                    label
                );

                labelContent.appendChild(
                    preview
                );

                const actions =
                    document.createElement(
                        "div"
                    );

                actions.className =
                    "project-item-actions";

                const trashBtn =
                    document.createElement(
                        "button"
                    );

                trashBtn.className =
                    "project-action-btn";

                trashBtn.textContent =
                    "🗑";

                trashBtn.onclick =
                    event => {
                        event.stopPropagation();

                        moveTemplateToTrash(
                            template.id
                        );
                    };

                actions.appendChild(
                    trashBtn
                );

                item.appendChild(
                    labelContent
                );

                item.appendChild(
                    actions
                );

                content.appendChild(item);
            }
        );

        group.classList.toggle(
            "collapsed",
            !folder.open
        );

        menu.appendChild(group);
    });
}

async function renderNotificationsMenu() {
    const menu =
        document.getElementById(
            "notificationsMenu"
        );

    if (!menu) {
        return;
    }

    menu.innerHTML = "";

    if (!showNotificationsMenu) {
        menu.classList.remove("open");
        return;
    }

    menu.classList.add("open");

    menu.innerHTML = `
        <div class="projects-menu-header">
            <strong>Notifications</strong>
        </div>

        <div class="notification-menu-loading">
            Loading notifications...
        </div>
    `;

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        menu.innerHTML = `
            <div class="projects-menu-header">
                <strong>Notifications</strong>
            </div>

            <div class="notification-empty">
                Log in to see notifications.
            </div>
        `;

        return;
    }

    const {
        data: notifications,
        error
    } = await supabaseClient
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order(
            "created_at",
            { ascending: false }
        );

    if (error) {
        console.error(
            "Notification load failed:",
            error
        );

        menu.innerHTML = `
            <div class="projects-menu-header">
                <strong>Notifications</strong>
            </div>

            <div class="notification-empty">
                Unable to load notifications.
            </div>
        `;

        return;
    }

    const notificationRows =
        notifications || [];

    if (notificationRows.length === 0) {
        menu.innerHTML = `
            <div class="projects-menu-header">
                <strong>Notifications</strong>
            </div>

            <div class="notification-empty">
                No notifications yet.
            </div>
        `;

        return;
    }

    const actorIds = [
        ...new Set(
            notificationRows
                .map(
                    notification =>
                        notification.actor_id
                )
                .filter(Boolean)
        )
    ];

    let profileMap = {};

    if (actorIds.length > 0) {
        const {
            data: profiles,
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .select("id, username")
            .in("id", actorIds);

        if (profileError) {
            console.error(
                "Notification profile lookup failed:",
                profileError
            );
        }

        (profiles || []).forEach(
            profile => {
                profileMap[profile.id] =
                    profile.username ||
                    "Unknown User";
            }
        );
    }

    menu.innerHTML = `
        <div class="projects-menu-header">
            <strong>Notifications</strong>
        </div>
    `;

    notificationRows.forEach(
        notification => {
            const item =
                document.createElement(
                    "button"
                );

            item.type = "button";
            item.className =
                "notification-item";

            if (!notification.read) {
                item.classList.add(
                    "unread"
                );
            }

            const username =
                profileMap[
                    notification.actor_id
                ] ||
                "Unknown User";

            let message =
                "You have a new notification.";

            if (
                notification.type ===
                "follow"
            ) {
                message =
                    `${username} followed you`;
            }

            if (
                notification.type ===
                "message"
            ) {
                message =
                    `${username} sent you a message`;
            }

            if (
                notification.type ===
                "typing_published"
            ) {
                message =
                    `${username} published a new typing`;
            }

            const date =
                notification.created_at
                    ? new Date(
                        notification.created_at
                    ).toLocaleString()
                    : "";

            item.innerHTML = `
                <div class="notification-message">
                    ${escapeHtml(message)}
                </div>

                ${
                    date
                        ? `
                            <div class="notification-date">
                                ${escapeHtml(date)}
                            </div>
                        `
                        : ""
                }
            `;

            item.addEventListener(
                "click",
                async () => {
                    await supabaseClient
                        .from("notifications")
                        .update({
                            read: true
                        })
                        .eq(
                            "id",
                            notification.id
                        )
                        .eq(
                            "user_id",
                            user.id
                        );

                    if (
                        notification.type ===
                            "follow" &&
                        notification.actor_id
                    ) {
                        window.location.href =
                            `profile.html?user=${encodeURIComponent(
                                notification.actor_id
                            )}`;

                        return;
                    }

                    if (
                        notification.type ===
                            "message" &&
                        notification.conversation_id
                    ) {
                        window.location.href =
                            `messages.html?conversation=${encodeURIComponent(
                                notification.conversation_id
                            )}`;

                        return;
                    }

                    if (
                        notification.type ===
                            "typing_published" &&
                        notification.typing_id
                    ) {
                        window.location.href =
                            `index.html?view=${encodeURIComponent(
                                notification.typing_id
                            )}`;
                    }
                }
            );

            menu.appendChild(item);
        }
    );
}

function renderImageGallery(activeTemplate) {
    const imageUploadArea = document.getElementById("imageUploadArea");
    const imagePlaceholder = document.getElementById("imagePlaceholder");
    const imagePreviewContainer = document.getElementById("imagePreviewContainer");
    const addImageBtn = document.getElementById("addImageBtn");
    const notesPanel = document.querySelector(".notes-panel");
    const notesArea = document.getElementById("notesArea");

    notesArea.parentElement
    .querySelectorAll(
        ".notes-scroll-indicator, .notes-fade"
    )
    .forEach(element => element.remove());

const notesScrollIndicator =
    document.createElement("div");

notesScrollIndicator.className =
    "notes-scroll-indicator";

notesArea.parentElement.appendChild(
    notesScrollIndicator
);

const notesFadeTop =
    document.createElement("div");

notesFadeTop.className =
    "notes-fade notes-fade-top";

notesArea.parentElement.appendChild(
    notesFadeTop
);

function updateNotesScrollIndicator() {
    const scrollable =
        notesArea.scrollHeight > notesArea.clientHeight;

    const parentRect =
        notesArea.parentElement.getBoundingClientRect();

    const areaRect =
        notesArea.getBoundingClientRect();

    const notesTop =
        areaRect.top - parentRect.top;

    notesFadeTop.style.top =
        `${notesTop}px`;

    notesFadeBottom.style.top =
        `${notesBottom - 28}px`;

    const atTop =
        notesArea.scrollTop <= 1;

    notesFadeTop.classList.toggle(
        "visible",
        scrollable && !atTop
    );

    if (!scrollable) {
        notesScrollIndicator.style.display = "none";
        return;
    }

    notesScrollIndicator.style.display = "block";

    const visibleRatio =
        notesArea.clientHeight /
        notesArea.scrollHeight;

    const indicatorHeight =
        Math.max(
            20,
            notesArea.clientHeight * visibleRatio
        );

    const maxIndicatorTravel =
        notesArea.clientHeight -
        indicatorHeight;

    const maxScroll =
        notesArea.scrollHeight -
        notesArea.clientHeight;

    const scrollRatio =
        maxScroll > 0
            ? notesArea.scrollTop / maxScroll
            : 0;

    notesScrollIndicator.style.height =
        `${indicatorHeight}px`;

    notesScrollIndicator.style.top =
        `${notesTop +
        (maxIndicatorTravel * scrollRatio)}px`;
}

requestAnimationFrame(
    updateNotesScrollIndicator
);

notesArea.addEventListener(
    "scroll",
    updateNotesScrollIndicator
);

let notesScrollbarDragging = false;
let notesScrollbarStartY = 0;
let notesScrollbarStartScroll = 0;

notesScrollIndicator.addEventListener(
    "mousedown",
    (event) => {
        notesScrollbarDragging = true;
        notesScrollbarStartY = event.clientY;
        notesScrollbarStartScroll =
            notesArea.scrollTop;

        event.preventDefault();
    }
);

document.addEventListener(
    "mousemove",
    (event) => {
        if (!notesScrollbarDragging) return;

        const indicatorHeight =
            notesScrollIndicator.offsetHeight;

        const availableTravel =
            notesArea.clientHeight -
            indicatorHeight;

        const availableScroll =
            notesArea.scrollHeight -
            notesArea.clientHeight;

        if (availableTravel <= 0) return;

        const movement =
            event.clientY -
            notesScrollbarStartY;

        notesArea.scrollTop =
            notesScrollbarStartScroll +
            movement *
            (availableScroll /
            availableTravel);
    }
);

document.addEventListener(
    "mouseup",
    () => {
        notesScrollbarDragging = false;
    }
);

window.addEventListener(
    "resize",
    updateNotesScrollIndicator
);

    if (!imageUploadArea || !imagePlaceholder || !imagePreviewContainer) {
        return;
    }

    imagePreviewContainer.innerHTML = "";
    const images = Array.isArray(activeTemplate?.images) ? activeTemplate.images : [];

    if (!images.length) {
        imagePlaceholder.style.display = "none";
        imageUploadArea.classList.remove("has-images");
        imageUploadArea.classList.add("no-images");
        notesPanel?.classList.add("no-images");
        if (addImageBtn) {
            addImageBtn.textContent = "＋";
            addImageBtn.setAttribute("aria-label", "Add image");
            addImageBtn.title = "Add image";
        }
        return;
    }

    imagePlaceholder.style.display = "none";
    imageUploadArea.classList.add("has-images");
    imageUploadArea.classList.remove("no-images");
    notesPanel?.classList.remove("no-images");
    if (addImageBtn) {
        addImageBtn.textContent = "＋";
        addImageBtn.setAttribute("aria-label", "Add image");
        addImageBtn.title = "Add image";
    }

    images.forEach((image, index) => {
        const card = document.createElement("div");
        card.className = "image-preview-card";
        card.dataset.imageIndex = String(index);

const notesMaxWidth =
    Math.max(
        140,
        notesArea?.clientWidth || 140
    );

const previewMaxWidth =
    Math.max(
        140,
        imagePreviewContainer?.clientWidth || 140
    );

const maxCardWidth =
    previewMaxWidth;

    const shouldStartAtMax =
    image.startAtMax === true;

const maxCardHeight = Math.max(
    160,
    (imageUploadArea.clientHeight || 0) - 24
);

        const img = document.createElement("img");
        img.className = "image-preview";
        img.src = image.src;
        img.alt = `Image ${index + 1}`;
        const savedWidth = Number(image.size) || 220;
        const savedHeight = Number(image.height) || 180;
        let baseRatio = Number(image.aspectRatio) || (savedHeight / Math.max(1, savedWidth));
        if (!Number.isFinite(baseRatio) || baseRatio <= 0) {
            baseRatio = 180 / 220;
        }

let baseWidth = shouldStartAtMax
    ? maxCardWidth
    : Math.max(
        140,
        Math.min(maxCardWidth, savedWidth)
    );

let baseHeight = baseWidth * baseRatio;
        if (baseHeight > maxCardHeight) {
            baseHeight = maxCardHeight;
            baseWidth = Math.max(140, Math.min(maxCardWidth, baseHeight / baseRatio));
        }
        card.style.width = `${baseWidth}px`;
        img.style.width = "100%";
        img.style.height = `${baseHeight}px`;

        const resizeHandle = document.createElement("div");
        resizeHandle.className = "image-resize-handle";
        resizeHandle.textContent = "↘";

        let isDragging = false;
let isResizing = false;
let resizeDirty = false;
let offsetY = 0;
        let lastPointerX = 0;
        let lastPointerY = 0;

        const setPointer = (x, y) => {
            lastPointerX = x;
            lastPointerY = y;
        };

        const maybeSwapByDropPosition = () => {
           
            if (readOnlyMode) {
    return false;
}
            const dropTarget = document.elementFromPoint(lastPointerX, lastPointerY)?.closest(".image-preview-card");
            if (!dropTarget || dropTarget === card) {
                return false;
            }

            const targetIndex = Number(dropTarget.dataset.imageIndex);
            if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= activeTemplate.images.length || targetIndex === index) {
                return false;
            }

            const temp = activeTemplate.images[index];
            activeTemplate.images[index] = activeTemplate.images[targetIndex];
            activeTemplate.images[targetIndex] = temp;
            saveAll();
            render();
            return true;
        };

        const startDrag = (event) => {
            if (isResizing) return;
            isDragging = true;
            setPointer(event.clientX, event.clientY);
            const rect = card.getBoundingClientRect();
            offsetY = event.clientY - rect.top;
            card.style.position = "relative";
            card.style.zIndex = "10";
            card.style.left = "0px";
        };

        const onMove = (event) => {
            if (!isDragging && !isResizing) return;
            setPointer(event.clientX, event.clientY);
            if (isResizing) {
                const rect = card.getBoundingClientRect();
                let nextWidth = Math.min(maxCardWidth, Math.max(140, event.clientX - rect.left + 10));
                let nextHeight = nextWidth * baseRatio;
                if (nextHeight > maxCardHeight) {
                    nextHeight = maxCardHeight;
                    nextWidth = Math.max(140, Math.min(maxCardWidth, nextHeight / baseRatio));
                }
                card.style.width = `${nextWidth}px`;
                img.style.height = `${nextHeight}px`;
                activeTemplate.images[index].size = nextWidth;
                activeTemplate.images[index].height = nextHeight;
                activeTemplate.images[index].aspectRatio = baseRatio;
                resizeDirty = true;
                return;
            }
            card.style.top = `${event.clientY - offsetY}px`;
            card.style.left = "0px";
        };

        const endDrag = () => {
    const wasDragging = isDragging;
    const wasResizing = isResizing;

    isDragging = false;
    isResizing = false;

    if (wasDragging && maybeSwapByDropPosition()) {
        return;
    }

    card.style.position = "";
    card.style.top = "";
    card.style.left = "";
    card.style.zIndex = "";

    // Save resize only once after releasing the handle
   if (wasResizing && resizeDirty) {
    resizeDirty = false;
    saveAll();
}

};

        card.addEventListener("mousedown", startDrag);
        resizeHandle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    isResizing = true;

    // Prevent the resize gesture from accidentally
    // activating the YouTube expand button.
    suppressYouTubeExpandUntil = Date.now() + 500;
});

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", endDrag);
        card.addEventListener("touchstart", (event) => {
            const touch = event.touches[0];
            startDrag(touch);
        }, { passive: true });
        window.addEventListener("touchmove", (event) => {
            if (!isDragging && !isResizing) return;
            const touch = event.touches[0];
            setPointer(touch.clientX, touch.clientY);
            if (isResizing) {
                const rect = card.getBoundingClientRect();
                let nextWidth = Math.min(maxCardWidth, Math.max(140, touch.clientX - rect.left + 10));
                let nextHeight = nextWidth * baseRatio;
                if (nextHeight > maxCardHeight) {
                    nextHeight = maxCardHeight;
                    nextWidth = Math.max(140, Math.min(maxCardWidth, nextHeight / baseRatio));
                }
                card.style.width = `${nextWidth}px`;
                img.style.height = `${nextHeight}px`;
                activeTemplate.images[index].size = nextWidth;
                activeTemplate.images[index].height = nextHeight;
                activeTemplate.images[index].aspectRatio = baseRatio;
                resizeDirty = true;
                return;
            }
            card.style.left = "0px";
            card.style.top = `${touch.clientY - offsetY}px`;
        }, { passive: true });
        window.addEventListener("touchend", endDrag);

        card.addEventListener("contextmenu", (event) => {
           
            if (readOnlyMode) {
    event.preventDefault();
    return;
}
            event.preventDefault();
            const shouldDelete = window.confirm("Delete this image?");
            if (shouldDelete) {
                activeTemplate.images.splice(index, 1);
                saveAll();
                render();
            }
        });

        card.appendChild(img);
        card.appendChild(resizeHandle);
        imagePreviewContainer.appendChild(card);
    });
}

function render() {
    const container = document.getElementById("coinContainer");
    const notesArea = document.getElementById("notesArea");
    const resultsList = document.getElementById("resultsList");
    const matchingCount = document.getElementById("matchingCount");
    const progressFill = document.getElementById("progressFill");
    const templateTitleInput = document.getElementById("templateTitle");
    const projectsBtn = document.getElementById("projectsBtn");
    const lockBtn = document.getElementById("lockBtn");
    const themeBtn = document.getElementById("themeBtn");
const viewModeControls = document.getElementById("viewModeControls");

if (!container || !notesArea || !resultsList || !matchingCount || !progressFill || !templateTitleInput || !projectsBtn || !lockBtn || !themeBtn) {
    return;
}

const activeTemplate = getActiveTemplate();
if (!activeTemplate) return;

if (viewMode && viewedTemplate) {
    templateTitleInput.value = viewedTemplate.title || "Untitled Typing";
    templateTitleInput.placeholder = "Viewing Published Typing";
} else {
    templateTitleInput.value = activeTemplate.title;
    templateTitleInput.placeholder = "Title";
}

templateTitleInput.disabled = viewMode;

templateTitleInput.disabled = readOnlyMode;

notesArea.value = activeTemplate.notes;
notesArea.disabled = readOnlyMode || viewMode;

if (viewModeControls) {
    viewModeControls.style.display = viewMode ? "flex" : "none";
}

if (viewMode) {
    projectsBtn.textContent = "Saved Typings";
    themeBtn.textContent = darkMode ? "Light" : "Dark";
} else {
projectsBtn.textContent = "Saved Typings";
    lockBtn.textContent = editingLocked ? "Edit" : "Lock";
    themeBtn.textContent = darkMode ? "Light" : "Dark";
}

    renderProjectsMenu();

    const notificationsMenu =
    document.getElementById(
        "notificationsMenu"
    );

if (notificationsMenu) {
    notificationsMenu.classList.toggle(
        "open",
        showNotificationsMenu
    );
}

    container.innerHTML = "";
    activeTemplate.coins.forEach(coin => {
        const row = document.createElement("div");
        row.className = "coin-row";

        const selectedValue = activeTemplate.selections[coin.id];

        const optionGrid = document.createElement("div");

optionGrid.className =
    "coin-option-grid" +
    (coin.id === "special"
        ? " special-option-grid"
        : "");

        if (coin.options.length === 2) {
            const pair = document.createElement("div");
            pair.className = "coin-option-pair";

            const pairRow = document.createElement("div");
            pairRow.className = "coin-option-row";
            let suppressClick = false;
            let isDragSelecting = false;
            let hasDragMoved = false;
            const pairCards = [];

coin.options.forEach((option, index) => {
    const card = document.createElement("div");

    const sliderState =
        activeTemplate.sliderStates?.[coin.id];

    const isLeftCard = index === 0;
    const isRightCard = index === 1;

    const isHalfSelected =
        typeof sliderState === "number" &&
        (
            (isLeftCard && sliderState === 1) ||
            (isRightCard && sliderState === 3)
        );

    const isFullSelected =
        typeof sliderState === "number" &&
        (
            (isLeftCard && sliderState === 0) ||
            (isRightCard && sliderState >= 4)
        );

const halfDirectionClass =
    isRightCard &&
    (isHalfSelected || isFullSelected)
        ? " reverse"
        : "";

    const isSelected =
        selectedValue === option.value &&
        !isHalfSelected;

    card.className =
        "option-card" +
        (isSelected ? " selected" : "") +
        (isHalfSelected
            ? " slider-half-selected"
            : "") +
        (isFullSelected
            ? " slider-full-selected"
            : "") +
        halfDirectionClass;

    pairCards.push(card);

const cycleSimpleSelection = () => {
    const currentState =
        typeof activeTemplate.sliderStates?.[coin.id] === "number"
            ? activeTemplate.sliderStates[coin.id]
            : 2;

    const uncertainState =
        index === 0 ? 1 : 3;

    const isThisSideSelected =
        index === 0
            ? currentState === 0 ||
              currentState === 1
            : currentState === 3 ||
              currentState === 4;

    const nextState =
        isThisSideSelected
            ? 2
            : uncertainState;

    const nextValue =
        getSelectionValueFromSlider(
            coin,
            nextState
        );

    setTemplateSelection(
        activeTemplate,
        coin,
        nextValue
    );

    activeTemplate.sliderStates[coin.id] =
        nextState;

    saveAll();
    render();
};

const button = document.createElement("button");
button.className = "option-button";
button.textContent = option.label;

button.onclick = (event) => {
    event.stopPropagation();

    if (viewMode) {
        return;
    }

    if (coinSelectionMode === "simple") {
        cycleSimpleSelection();
        return;
    }

    if (suppressClick) {
        suppressClick = false;
        return;
    }

    const nextValue =
        activeTemplate.selections[coin.id] ===
        option.value
            ? undefined
            : option.value;

    setTemplateSelection(
        activeTemplate,
        coin,
        nextValue
    );

    saveAll();
    render();
};

const input = document.createElement("textarea");

input.rows = 1;
input.wrap = "soft";

                const leftSideValues = [
    "O",
    "Di",
    "Oi",
    "N",
    "F",
    "fDe",
    "fS",
    "#1",
    "#2",
    "C",
    "S"
];

if (index === 0) {
    input.className =
        "option-definition left-definition";

    if (
        leftSideValues.includes(
            option.value
        )
    ) {
        // Keep the field visually aligned
        // toward the coin without reversing
        // normal typing/caret behavior.
        input.style.textAlign = "right";
    }

} else {
    input.className =
        "option-definition right-definition";
}

// English typing should always progress
// normally from left to right.
input.style.direction = "ltr";

input.addEventListener(
    "click",
    (event) => {
        if (viewMode) {
            event.preventDefault();
            return;
        }

        if (editingLocked) {
            event.preventDefault();

            const nextValue =
                activeTemplate
                    .selections[coin.id] ===
                option.value
                    ? undefined
                    : option.value;

            setTemplateSelection(
                activeTemplate,
                coin,
                nextValue
            );

            saveAll();
            render();
            return;
        }

        // While editing, clicking inside the
        // definition should only edit text,
        // not select the surrounding coin.
        event.stopPropagation();
    }
);

input.addEventListener(
    "pointerdown",
    (event) => {
        if (
            !editingLocked &&
            !viewMode
        ) {
            event.stopPropagation();
        }
    }
);

                input.placeholder = `Define ${option.label}`;
                input.value = option.definition || "";
const resizeDefinition = () => {
    input.style.height = "14px";

    if (input.scrollHeight > 14) {
        input.style.height = "28px";
    }
};

requestAnimationFrame(() => {
    resizeDefinition();
});

input.addEventListener("input", () => {
    option.definition = input.value;

    resizeDefinition();

    saveAll();
});


                if (index === 0) {
                    card.appendChild(input);
                    card.appendChild(button);
                } else {
                    card.appendChild(button);
                    card.appendChild(input);
                }

                pairRow.appendChild(card);
            });

            const certaintyBtn =
    document.createElement("button");

certaintyBtn.type = "button";
certaintyBtn.className = "coin-certainty-btn";

const currentCertaintyState =
    typeof activeTemplate.sliderStates?.[coin.id] === "number"
        ? activeTemplate.sliderStates[coin.id]
        : 2;

const hasSelection =
    currentCertaintyState !== 2;

const isCertain =
    currentCertaintyState === 0 ||
    currentCertaintyState === 4;

const isPreciseLocked =
    preciseCoinLocks[coin.id] === true;

if (coinSelectionMode === "precise") {
    certaintyBtn.textContent =
        isPreciseLocked ? "🔒" : "🔓";

    certaintyBtn.title =
        isPreciseLocked
            ? "Unlock position"
            : "Lock position";
} else {
    certaintyBtn.textContent =
        isCertain ? "✓" : "?";

    certaintyBtn.title =
        isCertain
            ? "Certain"
            : "Uncertain";
}

certaintyBtn.style.display =
    hasSelection ? "" : "none";

    certaintyBtn.addEventListener(
    "pointerdown",
    (event) => {
        event.stopPropagation();
    }
);

certaintyBtn.onclick = (event) => {
    event.stopPropagation();

    if (
        readOnlyMode ||
        viewMode
    ) {
        return;
    }

if (coinSelectionMode === "precise") {
    preciseCoinLocks[coin.id] =
        !preciseCoinLocks[coin.id];

    const isNowLocked =
        preciseCoinLocks[coin.id];

    certaintyBtn.textContent =
        isNowLocked ? "🔒" : "🔓";

    certaintyBtn.title =
        isNowLocked
            ? "Unlock position"
            : "Lock position";

    return;
}

    const state =
        typeof activeTemplate.sliderStates?.[coin.id] === "number"
            ? activeTemplate.sliderStates[coin.id]
            : 2;

    let nextState = state;

    if (state === 1) {
        nextState = 0;
    } else if (state === 0) {
        nextState = 1;
    } else if (state === 3) {
        nextState = 4;
    } else if (state === 4) {
        nextState = 3;
    } else {
        return;
    }

    activeTemplate.sliderStates[coin.id] =
        nextState;

    const nextValue =
        getSelectionValueFromSlider(
            coin,
            nextState
        );

    setTemplateSelection(
        activeTemplate,
        coin,
        nextValue
    );

    activeTemplate.sliderStates[coin.id] =
        nextState;

    saveAll();
    render();
};

pairRow.appendChild(certaintyBtn);

/*
    In Precise mode, restore the exact
    saved continuous position after render.
*/
if (
    coinSelectionMode === "precise" &&
    typeof activeTemplate.sliderStates?.[coin.id] === "number"
) {
    const savedPreciseState =
        activeTemplate.sliderStates[coin.id];

    requestAnimationFrame(() => {
        applyPairVisualState(
            savedPreciseState
        );
    });
}

const pairSelector =
    document.createElement("div");
                pairSelector.className = "coin-pair-selector";

            const slider = document.createElement("input");
            slider.type = "range";
            slider.className = "coin-pair-slider";
            slider.min = "0";
            slider.max = "4";
            slider.step = "any";
            let initialSliderValue = "2";
            const sliderState = activeTemplate.sliderStates?.[coin.id];
            if (typeof sliderState === "number") {
                initialSliderValue = String(sliderState);
            } else if (selectedValue === coin.options[0].value) {
                initialSliderValue = "0";
            } else if (selectedValue === "__mid_left__") {
                initialSliderValue = "1";
            } else if (selectedValue === "__mid_center__") {
                initialSliderValue = "2";
            } else if (selectedValue === "__mid_right__") {
                initialSliderValue = "3";
            } else if (selectedValue === coin.options[1].value) {
                initialSliderValue = "4";
            }
            slider.value = initialSliderValue;

            slider.disabled = editingLocked || readOnlyMode || viewMode;

slider.addEventListener("input", () => {
    if (viewMode) {
        return;
    }

    const nextValue = getSelectionValueFromSlider(coin, slider.value);
  setTemplateSelection(activeTemplate, coin, nextValue);

  activeTemplate.sliderStates[coin.id] =
    Number(slider.value);

  saveAll();
});
            slider.addEventListener("change", () => {
                render();
            });

const applyPairVisualState = (stateValue) => {
    const state = Math.max(
        0,
        Math.min(4, Number(stateValue))
    );

    pairCards.forEach((card, index) => {
        card.className = "option-card";

        card.style.removeProperty(
            "--precise-fill"
        );

        if (state === 2) {
            return;
        }

        const isLeftCard =
            index === 0;

        const isRightCard =
            index === 1;

        if (state < 2 && isLeftCard) {
            const fillAmount =
                ((2 - state) / 2) * 100;

            card.classList.add(
                "precise-selected"
            );

            card.style.setProperty(
                "--precise-fill",
                `${fillAmount}%`
            );
        }

        if (state > 2 && isRightCard) {
            const fillAmount =
                ((state - 2) / 2) * 100;

            card.classList.add(
                "precise-selected",
                "reverse"
            );

            card.style.setProperty(
                "--precise-fill",
                `${fillAmount}%`
            );
        }
    });
};

const getNearestMarker = (clientX) => {
    const rect = pairRow.getBoundingClientRect();

    if (!rect.width) {
        return Number(slider.value) || 2;
    }

    const ratio =
        (clientX - rect.left) /
        rect.width;

    const position =
        ratio * 4;

    return Math.max(
        0,
        Math.min(4, position)
    );
};

const finalizeDragSelection = (marker) => {
    if (viewMode) {
        return;
    }

    isDragSelecting = false;
    slider.value = String(marker);
    const nextValue = getSelectionValueFromSlider(coin, marker);
    setTemplateSelection(activeTemplate, coin, nextValue);
    
    activeTemplate.sliderStates[coin.id] =
    marker;

    saveAll();
                // Always suppress the trailing click fired after pointerup so selection does not get toggled off.
                suppressClick = true;
                render();
            };

pairRow.addEventListener("pointerdown", (event) => {
    if (coinSelectionMode !== "precise") {
        return;
    }

    if (preciseCoinLocks[coin.id]) {
        return;
    }

    if (event.button !== 0) return;

    if (
        !editingLocked &&
        event.target.closest(".option-definition")
    ) {
        return;
    }

    isDragSelecting = true;
    hasDragMoved = false;

    pairRow.setPointerCapture(
        event.pointerId
    );

    const marker =
        getNearestMarker(event.clientX);

    slider.value =
        String(marker);

    applyPairVisualState(marker);

    event.preventDefault();
});

            pairRow.addEventListener("pointermove", (event) => {
                if (!isDragSelecting) return;
                hasDragMoved = true;
                const marker = getNearestMarker(event.clientX);
                slider.value = String(marker);
                applyPairVisualState(marker);
            });

            pairRow.addEventListener("pointerup", (event) => {
                if (!isDragSelecting) return;
                const marker = getNearestMarker(event.clientX);
                finalizeDragSelection(marker);
            });

            pairRow.addEventListener("pointercancel", () => {
                if (!isDragSelecting) return;
                finalizeDragSelection(Number(slider.value) || 2);
            });

            pairSelector.appendChild(slider);
            pair.appendChild(pairRow);
            optionGrid.appendChild(pair);

                    } else {
            activeTemplate.specialStates =
                activeTemplate.specialStates || {};

               

            coin.options.forEach((option) => {
                const card =
                    document.createElement("div");

                const currentState =
                    activeTemplate.specialStates[
                        option.value
                    ] || 0;

                card.className = "option-card";

                if (currentState === 1) {
    card.classList.add(
        "special-half-selected"
    );
}

                if (currentState === 2) {
                    card.classList.add(
                        "selected",
                        "slider-full-selected"
                    );
                }

const cycleSelection = () => {
    if (
        readOnlyMode ||
        viewMode
    ) {
        return;
    }

    const oldState =
        activeTemplate.specialStates[
            option.value
        ] || 0;

    const newState =
        (oldState + 1) % 3;

    /*
        Only ONE of the four animals
        can be selected at a time.
    */
    Object.keys(
        activeTemplate.specialStates
    ).forEach((key) => {
        activeTemplate.specialStates[key] = 0;
    });

    if (newState > 0) {
        activeTemplate.specialStates[
            option.value
        ] = newState;

        setTemplateSelection(
            activeTemplate,
            coin,
            option.value
        );
    } else {
        setTemplateSelection(
            activeTemplate,
            coin,
            undefined
        );
    }

    saveAll();
    render();
};

                const button =
                    document.createElement("button");

                button.className =
                    "option-button";

                button.textContent =
                    option.label;

                button.disabled =
                    readOnlyMode || viewMode;

                button.addEventListener(
                    "click",
                    (event) => {
                        event.stopPropagation();
                        cycleSelection();
                    }
                );

const input =
    document.createElement("textarea");

input.className =
    "option-definition special-option-definition";

                    input.rows = 2;

                input.placeholder =
                    `Define ${option.label}`;

                input.value =
                    option.definition || "";

                input.disabled =
    readOnlyMode ||
    viewMode;

input.readOnly =
    editingLocked;

                input.style.direction = "ltr";

                input.addEventListener(
                    "input",
                    () => {
                        option.definition =
                            input.value;

                        saveAll();
                    }
                );

                input.addEventListener(
    "click",
    (event) => {
        event.stopPropagation();

        if (editingLocked) {
            cycleSelection();
        }
    }
);

                input.addEventListener(
                    "pointerdown",
                    (event) => {
                        event.stopPropagation();
                    }
                );

                card.addEventListener(
                    "click",
                    cycleSelection
                );

                if (
    option.value === "(C)" ||
    option.value === "(S)"
) {
    input.classList.add(
        "left-definition"
    );

    input.style.textAlign = "right";

    card.appendChild(input);
    card.appendChild(button);
} else {
    input.classList.add(
        "right-definition"
    );

    card.appendChild(button);
    card.appendChild(input);
}

optionGrid.appendChild(card);
            });
        }

        row.appendChild(optionGrid);
        container.appendChild(row);
    });

    const stateDefinitions = document.createElement("div");
    stateDefinitions.className = "state-definition-row";

    const saviorCard = document.createElement("div");
    saviorCard.className = "state-definition-card";
    const saviorLabel = document.createElement("div");
    saviorLabel.className = "state-definition-label";
    saviorLabel.textContent = "Savior state";
    const saviorInput = document.createElement("textarea");
    saviorInput.className = "state-definition-input";
    saviorInput.placeholder = "Define savior state";
    saviorInput.value = activeTemplate.saviorState || "";
    saviorInput.disabled = editingLocked;
    saviorInput.addEventListener("input", () => {
     activeTemplate.saviorState = saviorInput.value;
saveAll();
    });
  saviorInput.addEventListener(
    "pointerdown",
    (event) => {
        event.stopPropagation();
    }
);

saviorInput.addEventListener(
    "click",
    (event) => {
        event.stopPropagation();
    }
);
    saviorCard.appendChild(saviorLabel);
    saviorCard.appendChild(saviorInput);

    const demonCard = document.createElement("div");
    demonCard.className = "state-definition-card";
    const demonLabel = document.createElement("div");
    demonLabel.className = "state-definition-label";
    demonLabel.textContent = "Demon state";
    const demonInput = document.createElement("textarea");
    demonInput.className = "state-definition-input";
    demonInput.placeholder = "Define demon state";
    demonInput.value = activeTemplate.demonState || "";
    demonInput.disabled = editingLocked;
    demonInput.addEventListener("input", () => {
        activeTemplate.demonState = demonInput.value;
saveAll();
    });
demonInput.addEventListener(
    "pointerdown",
    (event) => {
        event.stopPropagation();
    }
);

demonInput.addEventListener(
    "click",
    (event) => {
        event.stopPropagation();
    }
);
    demonCard.appendChild(demonLabel);
    demonCard.appendChild(demonInput);

    stateDefinitions.appendChild(saviorCard);
    stateDefinitions.appendChild(demonCard);
    container.appendChild(stateDefinitions);

    renderImageGallery(activeTemplate);

    const filtered = filterTypesBySelections(typeLibrary, activeTemplate.selections);
    const totalPossible = typeLibrary.length || 1;
    const eliminated = Math.min(100, Math.max(0, Math.round(((totalPossible - filtered.length) / totalPossible) * 100)));
document.getElementById("typesRemaining").textContent =
    `${filtered.length} ${filtered.length === 1 ? "Type" : "Types"}`;

    document.getElementById("typesEliminated").textContent = `${eliminated}% Eliminated`;
    progressFill.style.width = `${Math.min(100, Math.max(0, eliminated))}%`;
    const typingPreview = document.getElementById("typingPreview");
    if (typingPreview) {
        typingPreview.textContent = buildSavedTypingPreviewLabel(activeTemplate.selections);
    }
    resultsList.innerHTML = "";

    filtered.forEach(type => {
        const chip = document.createElement("div");
        chip.className = "result-chip";
        chip.textContent = buildTypeLabel({
            ...type.selections,
            ...(activeTemplate.selections.special ? { special: activeTemplate.selections.special } : {})
        }) || "";
        if (chip.textContent) {
            resultsList.appendChild(chip);
        }
    });

applyTheme();
}

function wireEvents() {
    const templateTitleInput = document.getElementById("templateTitle");
    templateTitleInput.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            templateTitleInput.blur();
        }
    }
);
    const notesArea = document.getElementById("notesArea");
    const bulletBtn = document.getElementById("bulletBtn");
    if (bulletBtn) {
    
    bulletBtn.title = "Bulleted list";

    bulletBtn.setAttribute(
        "aria-label",
        "Bulleted list"
    );
}
    const newTemplateBtn = document.getElementById("newTemplateBtn");
    const clearBtn = document.getElementById("clearBtn");
const projectsBtn = document.getElementById("projectsBtn");
const lockBtn = document.getElementById("lockBtn");
const themeBtn = document.getElementById("themeBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");

const coinSelectionModeSelect =
    document.getElementById("coinSelectionMode");

if (coinSelectionModeSelect) {
    coinSelectionModeSelect.value =
        coinSelectionMode;

    coinSelectionModeSelect.addEventListener(
        "change",
        () => {
            coinSelectionMode =
                coinSelectionModeSelect.value;

            localStorage.setItem(
                "opsCoinSelectionMode",
                coinSelectionMode
            );
        }
    );
}

const viewModeLabel =
    document.getElementById("viewModeLabel");

const backToDatabaseBtn =
    document.getElementById("backToDatabaseBtn");

const backToPublisherProfileBtn =
    document.getElementById(
        "backToPublisherProfileBtn"
    );

const duplicateTypingBtn =
    document.getElementById("duplicateTypingBtn");

const databaseBtn = document.getElementById("databaseBtn");
const accountBtn = document.getElementById("accountBtn");
const publishBtn = document.getElementById("publishBtn");

const createAccountBtn = document.getElementById("createAccountBtn");
const loginAccountBtn = document.getElementById("loginAccountBtn");
const logoutAccountBtn = document.getElementById("logoutAccountBtn");

const accountEmailInput = document.getElementById("accountEmailInput");
const accountPasswordInput = document.getElementById("accountPasswordInput");
const accountStatus = document.getElementById("accountStatus");


if (duplicateTypingBtn) {

    duplicateTypingBtn.addEventListener(
    "click",
    async () => {

        if (!viewMode || !viewedTemplate) {
            return;
        }

const copiedTemplate = {
    ...structuredClone(viewedTemplate),

    id:
        Date.now().toString(36),

    title:
        (viewedTemplate.title ||
            "Untitled Typing") +
        " (Copy)",

    publicTypingId: null,
    publicVisibility: null,

    youtube: {
        videoId: "",
        currentTime: 0,
        enabled: true
    },

    folderId: "personal",
    folder: "Personal"
};

        sessionStorage.setItem(
            "opsPendingCopiedTyping",
            JSON.stringify(
                copiedTemplate
            )
        );

        window.location.href =
            "index.html?copied=1";
    }
);

}

if (viewMode) {

    clearBtn.style.display = "none";
    lockBtn.style.display = "none";
    databaseBtn.style.display = "none";
    publishBtn.style.display = "none";
    newTemplateBtn.style.display = "none";
    accountBtn.style.display = "none";

    projectsBtn.style.display = "";
    themeBtn.style.display = "";

    if (viewModeLabel) {
        viewModeLabel.style.display = "";
    }

if (backToDatabaseBtn) {
    backToDatabaseBtn.style.display = "";
}

if (backToPublisherProfileBtn) {
    backToPublisherProfileBtn.style.display = "";
}

if (duplicateTypingBtn) {
    duplicateTypingBtn.style.display = "";
}

    const viewYouTubeToggle =
        document.getElementById(
            "youtubeToggleBtn"
        );

    const viewYouTubePlayer =
        document.getElementById(
            "youtubePlayer"
        );

    if (viewYouTubeToggle) {
        viewYouTubeToggle.style.display =
            "none";
    }

    if (viewYouTubePlayer) {
        viewYouTubePlayer.style.display =
            "none";
    }

    document.body.classList.add(
        "youtube-disabled"
    );

} else {

    clearBtn.style.display = "";
    lockBtn.style.display = "";
    databaseBtn.style.display = "";
    publishBtn.style.display = "";
    newTemplateBtn.style.display = "";
    projectsBtn.style.display = "";
    accountBtn.style.display = "";
    themeBtn.style.display = "";

    if (viewModeLabel) {
        viewModeLabel.style.display = "none";
    }

    if (backToDatabaseBtn) {
        backToDatabaseBtn.style.display =
            "none";
    }

    if (duplicateTypingBtn) {
        duplicateTypingBtn.style.display =
            "none";
    }

    const normalYouTubeToggle =
        document.getElementById(
            "youtubeToggleBtn"
        );

    const normalYouTubePlayer =
        document.getElementById(
            "youtubePlayer"
        );

    if (normalYouTubeToggle) {
        normalYouTubeToggle.style.display =
            "";
    }

    if (normalYouTubePlayer) {
        normalYouTubePlayer.style.display =
            "";
    }
}

templateTitleInput.addEventListener("input", () => {
    const activeTemplate = getActiveTemplate();

    if (activeTemplate) {
        activeTemplate.title =
            templateTitleInput.value;

        saveAll();
        render();
    }
});

if (backToDatabaseBtn) {
    backToDatabaseBtn.addEventListener(
        "click",
        () => {
            viewMode = false;
            readOnlyMode = false;
            viewedTemplate = null;

            window.location.href =
                "database.html";
        }
    );
}

if (backToPublisherProfileBtn) {

    backToPublisherProfileBtn.addEventListener(
        "click",
        () => {

            if (
                !viewMode ||
                !viewedTemplate?.publisherUserId
            ) {
                return;
            }

            window.location.href =
                `profile.html?user=${encodeURIComponent(
                    viewedTemplate.publisherUserId
                )}`;
        }
    );
}

accountBtn.addEventListener("click", async (event) => {
    event.stopPropagation();

    const accountMenu =
        document.getElementById("accountMenu");

    const openAuthBtn =
        document.getElementById("openAuthBtn");

    const changeAccountBtn =
        document.getElementById("changeAccountBtn");

    const logoutAccountBtn =
        document.getElementById("logoutAccountBtn");

    if (!accountMenu) {
        return;
    }

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    /*
        Logged in:
        username + logout.

        Logged out:
        sign up / login.
    */
    if (openAuthBtn) {
        openAuthBtn.style.display =
            user ? "none" : "block";
    }

    if (changeAccountBtn) {
        changeAccountBtn.style.display =
            user ? "block" : "none";
    }

    if (logoutAccountBtn) {
        logoutAccountBtn.style.display =
            user ? "block" : "none";
    }

const willOpen =
    !accountMenu.classList.contains("open");

showProjectsMenu = false;
showNotificationsMenu = false;

settingsMenu?.classList.remove("open");

accountMenu.classList.toggle(
    "open",
    willOpen
);

render();
});


const viewProfileBtn =
    document.getElementById("viewProfileBtn");

if (viewProfileBtn) {
    viewProfileBtn.addEventListener(
        "click",
        async () => {
            const {
                data: { user }
            } =
                await supabaseClient.auth.getUser();

            if (!user) {
                showError(
                    "Not Logged In",
                    "Please log in to view your profile."
                );

                return;
            }

            window.location.href =
                `profile.html?user=${encodeURIComponent(
                    user.id
                )}`;
        }
    );
}


const openAuthBtn =
    document.getElementById("openAuthBtn");

const authMenu =
    document.getElementById("authMenu");

if (openAuthBtn && authMenu) {
    openAuthBtn.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            const accountMenu =
                document.getElementById(
                    "accountMenu"
                );

            accountMenu?.classList.remove(
                "open"
            );

            authMenu.classList.add(
                "open"
            );
        }
    );
}

const usernameMenu =
    document.getElementById("usernameMenu");

const changeAccountBtn =
    document.getElementById(
        "changeAccountBtn"
    );

if (
    changeAccountBtn &&
    usernameMenu
) {
    changeAccountBtn.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            const accountMenu =
                document.getElementById(
                    "accountMenu"
                );

            accountMenu?.classList.remove(
                "open"
            );

            usernameMenu.classList.add(
                "open"
            );
        }
    );
}

if (notificationsPageBtn) {
    notificationsPageBtn.addEventListener(
        "click",
        async (event) => {
            event.stopPropagation();

            showNotificationsMenu =
                !showNotificationsMenu;

                showProjectsMenu = false;

document
    .getElementById("accountMenu")
    ?.classList.remove("open");

settingsMenu?.classList.remove("open");

            showProjectsMenu = false;

            await renderNotificationsMenu();
            render();
        }
    );
}

notesArea.addEventListener("input", () => {
    if (viewMode) {
        return;
    }

    const activeTemplate = getActiveTemplate();
    if (activeTemplate) {
        activeTemplate.notes = notesArea.value;
        saveAll();
    }
});

    notesArea.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const start = notesArea.selectionStart;
        const end = notesArea.selectionEnd;
        const value = notesArea.value;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = value.indexOf("\n", start);
        const currentLine = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);
        const trimmedLine = currentLine.trim();

        if (!trimmedLine.startsWith("•")) {
            return;
        }

        event.preventDefault();
        const before = value.slice(0, start);
        const after = value.slice(end);
        const newline = before.endsWith("\n") ? "" : "\n";
        const nextValue = `${before}${newline}• ${after}`;
        notesArea.value = nextValue;
        const caretPosition = start + newline.length + 2;
notesArea.setSelectionRange(caretPosition, caretPosition);
notesArea.focus();

requestAnimationFrame(() => {
    notesArea.scrollTop = notesArea.scrollHeight;
});

        const activeTemplate = getActiveTemplate();
        if (activeTemplate) {
activeTemplate.notes = nextValue;
saveAll();
        }
    });

    notesArea.addEventListener("scroll", () => {
    const style = getComputedStyle(notesArea);
    const lineHeight = parseFloat(style.lineHeight);

    if (!lineHeight) return;

    const maxScroll =
        notesArea.scrollHeight - notesArea.clientHeight;

    const distanceFromBottom =
        maxScroll - notesArea.scrollTop;

    if (distanceFromBottom <= 1) {
        const cleanScroll =
            Math.floor(maxScroll / lineHeight) * lineHeight;

        if (Math.abs(notesArea.scrollTop - cleanScroll) > 0.25) {
            notesArea.scrollTop = cleanScroll;
        }
    }
});

    bulletBtn.addEventListener("click", () => {
        const start = notesArea.selectionStart;
        const end = notesArea.selectionEnd;
        const value = notesArea.value;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const insertText = before.endsWith("\n") || before === "" ? "• " : "\n• ";
        const nextValue = `${before}${insertText}${after}`;
        notesArea.value = nextValue;
        const nextPosition = start + insertText.length;
        notesArea.setSelectionRange(nextPosition, nextPosition);
        notesArea.focus();

        const activeTemplate = getActiveTemplate();
        if (activeTemplate) {
            activeTemplate.notes = nextValue;
saveAll();
        }
    });

newTemplateBtn.addEventListener("click", () => {
    saveYouTubeProgress();

    createTemplate();

    loadYouTubeForActiveTemplate();
});

    clearBtn.addEventListener("click", () => {
        const activeTemplate = getActiveTemplate();
        if (activeTemplate) {
activeTemplate.selections = {};
activeTemplate.sliderStates = {};
saveAll();
render();
        }
    });

projectsBtn.addEventListener(
    "click",
    (event) => {
        event.stopPropagation();

        const willOpen =
            !showProjectsMenu;

        showProjectsMenu = willOpen;
        showNotificationsMenu = false;

        document
            .getElementById("accountMenu")
            ?.classList.remove("open");

        settingsMenu?.classList.remove("open");

        render();
    }
);

    databaseBtn.addEventListener("click", (event) => {
        event.stopPropagation();
window.location.href = "database.html";
    });

    document.addEventListener("click", (event) => {
        const menu = document.getElementById("projectsMenu");
        const accountMenu = document.getElementById("accountMenu");
        const button = document.getElementById("projectsBtn");
        const accountButton = document.getElementById("accountBtn");
        if (!menu || !button) return;
        const clickedInsideMenu = (menu.contains(event.target) || (accountMenu && accountMenu.contains(event.target)));
        const clickedButton = (button.contains(event.target) || (accountButton && accountButton.contains(event.target)));
        if (!clickedInsideMenu && !clickedButton) {
            showProjectsMenu = false;
            if (accountMenu) {
                accountMenu.classList.remove("open");
            }
            render();
        }
    });

    lockBtn.addEventListener("click", () => {
editingLocked = !editingLocked;
saveAll();
render();
    });

    themeBtn.addEventListener("click", () => {
darkMode = !darkMode;
localStorage.setItem(
    "opsDarkMode",
    String(darkMode)
);
saveAll();
render();
    });

settingsBtn?.addEventListener("click", (event) => {
    event.stopPropagation();

    const willOpen =
        !settingsMenu?.classList.contains("open");

    showProjectsMenu = false;
    showNotificationsMenu = false;

    document
        .getElementById("accountMenu")
        ?.classList.remove("open");

    settingsMenu?.classList.toggle(
        "open",
        willOpen
    );

    render();
});

document.addEventListener("click", (event) => {
    if (
        settingsMenu?.classList.contains("open") &&
        !settingsMenu.contains(event.target) &&
        !settingsBtn?.contains(event.target)
    ) {
        settingsMenu.classList.remove("open");
    }
});

async function publishTyping(publishVisibility) {
    const activeTemplate = getActiveTemplate();

    if (!activeTemplate) {
        return;
    }

    const title = (
        document.getElementById("templateTitle")?.value ||
        activeTemplate.title ||
        "Untitled Typing"
    ).trim();

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        showError(
            "Login Required",
            "Please log in before publishing."
        );
        return;
    }

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        console.error(
            "Profile load failed:",
            profileError
        );

        showError(
            "Publish Failed",
            "Unable to load your profile."
        );

        return;
    }

const typingData = structuredClone({
    notes: activeTemplate.notes || "",
    selections: activeTemplate.selections || {},
    sliderStates: activeTemplate.sliderStates || {},
    saviorState: activeTemplate.saviorState || "",
    demonState: activeTemplate.demonState || "",
    images: activeTemplate.images || [],
    coins: activeTemplate.coins || []
});

    const revealedType =
        buildTypeLabel(
            activeTemplate.selections || {}
        );

    let publishedId =
        activeTemplate.publicTypingId || null;

    if (publishedId) {
        const {
            data: existingPublication,
            error: lookupError
        } = await supabaseClient
            .from("public_typings")
            .select("id, user_id")
            .eq("id", publishedId)
            .maybeSingle();

        if (lookupError) {
            console.error(
                "Publication lookup failed:",
                lookupError
            );

            showError(
                "Publish Failed",
                lookupError.message
            );

            return;
        }

        if (
            !existingPublication ||
            existingPublication.user_id !== user.id
        ) {
            console.log(
                "Old publication no longer exists. Creating new one."
            );

            publishedId = null;
        }
    }

    let createdNewPublication = false;

    if (publishedId) {
        const { error } = await supabaseClient
            .from("public_typings")
            .update({
                username: profile.username,
                title: title,
                data: typingData,
                revealed_type:
                    revealedType || null,
                visibility:
                    publishVisibility,
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", publishedId)
            .eq("user_id", user.id);

        if (error) {
            console.error(
                "Publish update failed:",
                error
            );

            showError(
                "Publish Failed",
                error.message
            );

            return;
        }

        console.log(
            "Publication updated:",
            publishedId
        );

    } else {
        const {
            data: publishedData,
            error
        } = await supabaseClient
            .from("public_typings")
            .insert([{
                user_id: user.id,
                username: profile.username,
                title: title,
                possibilities: null,
                revealed_type:
                    revealedType || null,
                visibility:
                    publishVisibility,
                data: typingData
            }])
            .select("id")
            .single();

        if (error || !publishedData) {
            console.error(
                "Publish insert failed:",
                error
            );

            showError(
                "Publish Failed",
                error?.message ||
                    "No publication ID returned."
            );

            return;
        }

        publishedId =
            publishedData.id;

        createdNewPublication = true;

        console.log(
            "New publication created:",
            publishedId
        );
    }

    // Only notify subscribers for a genuinely new publication.
    if (createdNewPublication) {
        const {
            data: subscribers,
            error: subscribersError
        } = await supabaseClient
            .from(
                "typing_notification_subscriptions"
            )
            .select("subscriber_id")
            .eq("creator_id", user.id);

        if (subscribersError) {
            console.error(
                "Typing notification subscriber lookup failed:",
                subscribersError
            );

        } else if (subscribers?.length) {

            for (
                const subscription
                of subscribers
            ) {
                const subscriberId =
                    subscription.subscriber_id;

                const {
                    data: usersBlocked,
                    error: blockCheckError
                } = await supabaseClient.rpc(
                    "users_are_blocked",
                    {
                        user_a: user.id,
                        user_b: subscriberId
                    }
                );

                if (blockCheckError) {
                    console.error(
                        "Publish notification block check failed:",
                        blockCheckError
                    );

                    continue;
                }

                if (usersBlocked) {
                    continue;
                }

                const {
                    data: isMuted,
                    error: muteCheckError
                } = await supabaseClient.rpc(
                    "has_muted",
                    {
                        recipient_id:
                            subscriberId,
                        actor_id:
                            user.id
                    }
                );

                if (muteCheckError) {
                    console.error(
                        "Publish notification mute check failed:",
                        muteCheckError
                    );

                    continue;
                }

                if (isMuted) {
                    continue;
                }

                const {
                    error: notificationError
                } = await supabaseClient
                    .from("notifications")
                    .insert({
                        user_id:
                            subscriberId,
                        actor_id:
                            user.id,
                        type:
                            "typing_published",
                        typing_id:
                            publishedId,
                        read: false
                    });

                if (notificationError) {
                    console.error(
                        "Publish notification creation failed:",
                        notificationError
                    );
                }
            }
        }
    }

    activeTemplate.publicTypingId =
        publishedId;

        activeTemplate.publicVisibility =
    publishVisibility;

    saveTemplates();
await flushCloudSave();

    console.log(
        "Publish successful:",
        publishedId
    );

    const wasUpdate =
    !createdNewPublication;

   showSuccess(
    wasUpdate
        ? (
            publishVisibility === "unlisted"
                ? "Typing Updated Unlisted"
                : "Typing Updated"
        )
        : (
            publishVisibility === "unlisted"
                ? "Typing Published Unlisted"
                : "Typing Published"
        )
);

}

publishBtn.addEventListener(
    "click",
    async () => {
        const activeTemplate =
            getActiveTemplate();

        if (!activeTemplate) {
            return;
        }

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) {
            showError(
                "Login Required",
                "Please log in before publishing."
            );

            return;
        }

        const isUpdate =
    Boolean(activeTemplate.publicTypingId);

showPopup(
    isUpdate
        ? "Update Typing"
        : "Publish Typing",

    isUpdate
        ? "Choose how you want to update this published typing."
        : "Choose who can see this published typing.",

    [
        {
            text: "Cancel"
        },
        {
            text: isUpdate
                ? "Update Unlisted"
                : "Unlisted",

            action: async () => {
                await publishTyping(
                    "unlisted"
                );
            }
        },
        {
            text: isUpdate
                ? "Update Public"
                : "Public",

            action: async () => {
                await publishTyping(
                    "public"
                );
            }
        },
        {
            text: "Publish Definitions",

action: async () => {
    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        console.error(
            "Definition profile lookup failed:",
            profileError
        );

        showError(
            "Publish Failed",
            "Could not load your profile."
        );

        return;
    }

    const description =
        prompt(
            "Add a short description for these definitions:",
            ""
        );

    /*
        Cancel means don't publish yet.
    */
    if (description === null) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("public_definitions")
            .insert([{
                user_id: user.id,
                username:
                    profile.username,

                /*
                    The database column is still
                    named "title" for now, but it
                    now represents the definition
                    set's own description — never
                    the typing's title.
                */
                title:
                    description.trim(),

                coins:
                    structuredClone(
                        activeTemplate.coins
                    )
            }]);

    if (error) {
        console.error(
            "Definition publish failed:",
            error
        );

        showError(
            "Publish Failed",
            error.message
        );

        return;
    }

    showSuccess(
        "Definitions Published"
    );
}
        }
    ]
);
    }
);

} // closes wireEvents()

async function openTypingAccessManager() {
    const activeTemplate = getActiveTemplate();

    if (!activeTemplate?.publicTypingId) {
        showError(
            "No Published Typing",
            "Publish this typing as Unlisted first."
        );
        return;
    }

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        showError(
            "Login Required",
            "Please log in first."
        );
        return;
    }

    const typingId =
        activeTemplate.publicTypingId;

    const {
        data: profiles,
        error: profilesError
    } = await supabaseClient
        .from("profiles")
        .select("id, username")
        .neq("id", user.id)
        .order("username", {
            ascending: true
        });

    if (profilesError) {
        console.error(
            "Profile lookup failed:",
            profilesError
        );

        showError(
            "Unable to Load Users",
            profilesError.message
        );

        return;
    }

    const {
        data: accessRows,
        error: accessError
    } = await supabaseClient
        .from("public_typing_access")
        .select("viewer_id")
        .eq("typing_id", typingId);

    if (accessError) {
        console.error(
            "Access lookup failed:",
            accessError
        );

        showError(
            "Unable to Load Access",
            accessError.message
        );

        return;
    }

    const selectedIds =
        new Set(
            (accessRows || []).map(
                row => row.viewer_id
            )
        );

    const overlay =
        document.createElement("div");

    overlay.className =
        "typing-access-overlay";

    overlay.innerHTML = `
        <div class="typing-access-modal">

            <div class="typing-access-header">
                <h2>Manage Access</h2>

                <button
                    type="button"
                    id="closeTypingAccessBtn">
                    ✕
                </button>
            </div>

            <input
                id="typingAccessSearch"
                type="text"
                placeholder="Search users...">

            <div
                id="typingAccessUsers"
                class="typing-access-users">
            </div>

            <div class="typing-access-actions">
                <button
                    type="button"
                    id="saveTypingAccessBtn">
                    Save Access
                </button>
            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    const usersContainer =
        overlay.querySelector(
            "#typingAccessUsers"
        );

    const searchInput =
        overlay.querySelector(
            "#typingAccessSearch"
        );

    const closeBtn =
        overlay.querySelector(
            "#closeTypingAccessBtn"
        );

    const saveBtn =
        overlay.querySelector(
            "#saveTypingAccessBtn"
        );

    function renderUsers(search = "") {
        usersContainer.innerHTML = "";

        const normalizedSearch =
            search.trim().toLowerCase();

        const filteredProfiles =
            (profiles || []).filter(profile => {
                const username =
                    (
                        profile.username ||
                        "Unknown User"
                    ).toLowerCase();

                return username.includes(
                    normalizedSearch
                );
            });

        if (filteredProfiles.length === 0) {
            usersContainer.innerHTML = `
                <div>
                    No users found.
                </div>
            `;

            return;
        }

        filteredProfiles.forEach(profile => {
            const row =
                document.createElement("label");

            row.className =
                "typing-access-user";

            const username =
                profile.username ||
                "Unknown User";

            row.innerHTML = `
                <input
                    type="checkbox"
                    value="${escapeHtml(
                        profile.id
                    )}"
                    ${
                        selectedIds.has(profile.id)
                            ? "checked"
                            : ""
                    }>

                <span>
                    ${escapeHtml(username)}
                </span>
            `;

            usersContainer.appendChild(row);
        });
    }

    renderUsers();

    searchInput.addEventListener(
        "input",
        () => {
            renderUsers(
                searchInput.value
            );
        }
    );

    closeBtn.addEventListener(
        "click",
        () => {
            overlay.remove();
        }
    );

    overlay.addEventListener(
        "click",
        event => {
            if (event.target === overlay) {
                overlay.remove();
            }
        }
    );

    saveBtn.addEventListener(
        "click",
        async () => {

            saveBtn.disabled = true;

            const checkedIds =
                Array.from(
                    usersContainer.querySelectorAll(
                        'input[type="checkbox"]:checked'
                    )
                ).map(
                    checkbox =>
                        checkbox.value
                );

            const {
                error: deleteError
            } = await supabaseClient
                .from("public_typing_access")
                .delete()
                .eq(
                    "typing_id",
                    typingId
                );

            if (deleteError) {
                console.error(
                    "Access reset failed:",
                    deleteError
                );

                saveBtn.disabled = false;
                return;
            }

            if (checkedIds.length > 0) {

                const rows =
                    checkedIds.map(
                        viewerId => ({
                            typing_id: typingId,
                            viewer_id: viewerId
                        })
                    );

                const {
                    error: insertError
                } = await supabaseClient
                    .from("public_typing_access")
                    .insert(rows);

                if (insertError) {
                    console.error(
                        "Access save failed:",
                        insertError
                    );

                    saveBtn.disabled = false;
                    return;
                }
            }

            overlay.remove();

            showSuccess(
                "Unlisted access updated"
            );
        }
    );
}

async function handlePendingGuestImport(user) {

    if (!user?.id) {
        return false;
    }

    const pendingKey =
        `opsPendingGuestImport:${user.id}`;

    /*
        GOOGLE OAUTH CASE

        Before redirecting to Google we could
        save the guest workspace, but we did
        not yet know which user would return.

        Now we do.
    */
    const pendingGoogleRaw =
        localStorage.getItem(
            "opsPendingGoogleGuestImport"
        );

    if (
        !localStorage.getItem(
            pendingKey
        ) &&
        pendingGoogleRaw
    ) {
        try {
            const pendingGoogle =
                JSON.parse(
                    pendingGoogleRaw
                );

            const createdAt =
                new Date(
                    user.created_at
                ).getTime();

            const startedAt =
                Number(
                    pendingGoogle.startedAt
                );

            /*
                A newly-created Google account's
                Supabase user creation time should
                be essentially the same time as
                this OAuth attempt.

                Existing accounts have an older
                created_at and MUST NOT receive
                guest data.
            */
            const isBrandNewGoogleUser =
                Number.isFinite(
                    createdAt
                ) &&
                Number.isFinite(
                    startedAt
                ) &&
                Math.abs(
                    createdAt -
                    startedAt
                ) <
                    5 * 60 * 1000;

            if (
                isBrandNewGoogleUser &&
                pendingGoogle.workspace
            ) {
                localStorage.setItem(
                    pendingKey,
                    pendingGoogle.workspace
                );
            }

        } catch (error) {
            console.error(
                "Google guest-import marker could not be read:",
                error
            );
        }

        /*
            Whether this was a new or existing
            Google account, this OAuth attempt
            has now been resolved.
        */
        localStorage.removeItem(
            "opsPendingGoogleGuestImport"
        );
    }

    const pendingGuestRaw =
        localStorage.getItem(
            pendingKey
        );

    /*
        No pending signup import for
        this account.
    */
    if (!pendingGuestRaw) {
        return false;
    }

    /*
        Wait here until the user chooses.
        This prevents startup/cloud sync
        from running before the decision.
    */
    await new Promise(resolve => {

        showPopup(
            "Save Current Workspace?",
            "Would you like to copy the guest workspace you had when you created this account into your new account?",
            [
               {
    text: "Start Fresh",
    action: async () => {

        /*
            Clear only this account's local
            cache first.

            Never touch the actual guest
            workspace.
        */
        localStorage.removeItem(
            activeWorkspaceKey
        );

        resetWorkspaceMemory();

        /*
            Safety check:

            If this user somehow already has
            cloud data, preserve and load it
            instead of overwriting it with a
            new blank workspace.
        */
        const cloudResult =
            await loadTemplatesFromCloud();

if (cloudResult === false) {

    /*
        Truly new account:
        create its fresh blank workspace
        and save that to Supabase.
    */
    loadTemplates();

    // Supabase confirmed there is no existing
    // cloud workspace, and the user explicitly
    // chose to start this account fresh.
    accountWorkspaceReady = true;

    await saveTemplatesToCloud();
}
        
        else {

            console.log(
                "Existing cloud workspace found. Preserving it instead of creating a blank workspace."
            );
        }

        /*
            The signup decision has now been
            handled for this account.
        */
        localStorage.removeItem(
            pendingKey
        );

        resolve();
    }
},
                {
                    text: "Keep & Save",
                    action: async () => {

                        try {
                            const guestData =
                                JSON.parse(
                                    pendingGuestRaw
                                );

                            guestData.savedAt =
                                Date.now();

                            /*
                                Copy the captured guest
                                snapshot into this account's
                                own local workspace.
                            */
                            localStorage.setItem(
                                activeWorkspaceKey,
                                JSON.stringify(
                                    guestData
                                )
                            );

                            localStorage.removeItem(
                                pendingKey
                            );

                            resetWorkspaceMemory();
loadTemplates();

// The user explicitly chose to make this
// captured guest workspace the account's
// initial workspace.
accountWorkspaceReady = true;

await saveTemplatesToCloud();

resolve();

                        } catch (error) {

                            console.error(
                                "Pending guest import failed:",
                                error
                            );

                            showError(
                                "Import Failed",
                                "Your guest workspace was left unchanged."
                            );
                        }
                    }
                }
            ]
        );
    });

    return true;
}


async function init() {
    
    typeLibrary = generateTypeLibrary();

    const copiedFromDatabase = new URLSearchParams(window.location.search).get("copied");

    const definitionsCopied =
    new URLSearchParams(
        window.location.search
    ).get("definitionsCopied");
    
if (copiedFromDatabase === "1") {
    showProjectsMenu = true;
}

const {
    data: {
        session: initialSession
    }
} =
    await supabaseClient.auth.getSession();

const initialUser =
    initialSession?.user || null;

setWorkspaceForUser(
    initialUser
);

let handledPendingGuestImport =
    false;

if (initialUser) {
    handledPendingGuestImport =
        await handlePendingGuestImport(
            initialUser
        );
}

/*
    Normal startup only loads the workspace
    here when there was no pending
    new-account guest decision.

    The pending-import handler already
    loads the correct account workspace
    after the user chooses.
*/
if (
    !handledPendingGuestImport &&
    !initialUser
) {
    loadTemplates();
}

await checkViewMode();

/*
    Before the page becomes editable,
    resolve the logged-in cloud state.
*/
if (!viewMode) {
    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (user) {
        console.log(
            "Logged-in user detected. Loading cloud data before editing..."
        );

        const cloudResult =
    await loadTemplatesFromCloud();

if (cloudResult === false) {
    console.log(
        "No cloud workspace exists. Creating the account's first workspace..."
    );

    loadTemplates();

    // Supabase explicitly confirmed that this
    // account has no existing cloud workspace.
    // It is now safe to create its first one.
    accountWorkspaceReady = true;

    await flushCloudSave();
}

else if (cloudResult === "local-newer") {
    console.log(
        "Local data is newer. Syncing newest local data to cloud..."
    );

    await saveTemplatesToCloud();
}

    }
}

/*
    If a public typing was copied, the real
    account workspace has now been loaded.

    Add the copied typing to that workspace
    instead of replacing the workspace.
*/
const pendingCopiedTyping =
    sessionStorage.getItem(
        "opsPendingCopiedTyping"
    );

if (
    copiedFromDatabase === "1" &&
    pendingCopiedTyping &&
    !viewMode
) {
    try {
        const copiedTemplate =
            normalizeTemplate(
                JSON.parse(
                    pendingCopiedTyping
                )
            );

        /*
            Give it a fresh ID so it can never
            collide with an existing saved typing.
        */
        copiedTemplate.id =
            `copy-${Date.now().toString(36)}-${Math.random()
                .toString(36)
                .slice(2, 7)}`;

        templates.push(
            copiedTemplate
        );

        activeTemplateId =
            copiedTemplate.id;

        sessionStorage.removeItem(
            "opsPendingCopiedTyping"
        );

        saveAll();

        showProjectsMenu = true;

        showSuccess(
            "Typing copied successfully!"
        );
    } catch (error) {
        console.error(
            "Unable to import copied typing:",
            error
        );

        showError(
            "Copy Failed",
            "The copied typing could not be added."
        );
    }
}

/*
    If a published definition set was copied,
    the real account workspace has now loaded.

    Apply only its coin definitions to the
    currently active typing.
*/
const pendingCopiedDefinitions =
    sessionStorage.getItem(
        "opsPendingCopiedDefinitions"
    );

if (
    definitionsCopied === "1" &&
    pendingCopiedDefinitions &&
    !viewMode
) {
    try {
        const copiedCoins =
            JSON.parse(
                pendingCopiedDefinitions
            );

        const activeTemplate =
            getActiveTemplate();

        if (
            activeTemplate &&
            Array.isArray(copiedCoins)
        ) {
            activeTemplate.coins =
                normalizeCoins(
                    copiedCoins
                );

            sessionStorage.removeItem(
                "opsPendingCopiedDefinitions"
            );

            saveAll();

            showSuccess(
                "Definitions copied successfully!"
            );
        }
    } catch (error) {
        console.error(
            "Unable to import copied definitions:",
            error
        );

        showError(
            "Copy Failed",
            "The copied definitions could not be added."
        );
    }
}

wireEvents();

render();
 
    const imageUploadArea = document.getElementById("imageUploadArea");
    const imageFileInput = document.getElementById("imageFileInput");
    const addImageBtn = document.getElementById("addImageBtn");
const youtubeBrowseBtn =
    document.getElementById("youtubeBrowseBtn");

const youtubeBrowsePanel =
    document.getElementById("youtubeBrowsePanel");

const youtubeBrowseCloseBtn =
    document.getElementById("youtubeBrowseCloseBtn");

    const youtubeIframe =
    document.getElementById("youtubeIframe");

    const youtubeToggleBtn =
    document.getElementById("youtubeToggleBtn");

    const youtubeExpandBtn =
    document.getElementById("youtubeExpandBtn");

const centerPanel =
    document.querySelector(".center-panel");

const centerTopStats =
    document.querySelector(".center-top-stats");

const coinContainer =
    document.getElementById("coinContainer");

const resultsPanel =
    document.querySelector(".results-panel");

const youtubePlayerElement =
    document.getElementById("youtubePlayer");

function setYouTubeEnabled(enabled, persist = true) {
    document.body.classList.toggle(
        "youtube-disabled",
        !enabled
    );

    if (youtubeToggleBtn) {
        youtubeToggleBtn.classList.toggle(
            "off",
            !enabled
        );

        youtubeToggleBtn.title =
            enabled
                ? "Turn YouTube off"
                : "Turn YouTube on";

        youtubeToggleBtn.setAttribute(
            "aria-label",
            enabled
                ? "Turn YouTube off"
                : "Turn YouTube on"
        );
    }

    if (persist) {
        const activeTemplate =
            getActiveTemplate();

        if (activeTemplate?.youtube) {
            activeTemplate.youtube.enabled =
                enabled;

            saveAll();
        }
    }
}

let youtubeExpanded = false;

function setYouTubeExpanded(expanded) {
if (
    !youtubePlayerElement ||
    !youtubeExpandBtn ||
    !centerPanel
) {
    return;
}

    youtubeExpanded = expanded;

    if (expanded) {
        /*
            IMPORTANT:
            Do NOT move #youtubePlayer in the DOM.
            Moving a live iframe reloads YouTube.

            Instead, measure where it used to appear
            in the center panel and let CSS place the
            existing player there visually.
        */
        const centerRect =
            centerPanel.getBoundingClientRect();

        const playerWidth =
            Math.min(
                955,
                Math.max(
                    0,
                    centerRect.width - 24
                )
            );

        const playerHeight =
            playerWidth * 9 / 16;

        const playerLeft =
            centerRect.left +
            (centerRect.width - playerWidth) / 2;

        const playerTop =
    centerRect.top + 37.5;

        document.documentElement.style.setProperty(
            "--yt-expanded-left",
            `${playerLeft}px`
        );

        document.documentElement.style.setProperty(
            "--yt-expanded-top",
            `${playerTop}px`
        );

        document.documentElement.style.setProperty(
            "--yt-expanded-width",
            `${playerWidth}px`
        );

        document.documentElement.style.setProperty(
            "--yt-expanded-height",
            `${playerHeight}px`
        );

        document.documentElement.style.setProperty(
            "--yt-expanded-space",
            `${playerHeight + 49}px`
        );
    }

    document.body.classList.toggle(
        "youtube-expanded",
        expanded
    );

    youtubeExpandBtn.title =
        expanded
            ? "Collapse YouTube"
            : "Expand YouTube";

    youtubeExpandBtn.setAttribute(
        "aria-label",
        expanded
            ? "Collapse YouTube"
            : "Expand YouTube"
    );
}

if (youtubeExpandBtn) {
    youtubeExpandBtn.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            setYouTubeExpanded(
                !youtubeExpanded
            );
        }
    );
}

loadYouTubeForActiveTemplate();

if (youtubeToggleBtn) {
    youtubeToggleBtn.addEventListener(
        "click",
        () => {
            const currentlyDisabled =
                document.body.classList.contains(
                    "youtube-disabled"
                );

            // If turning YouTube OFF, exit expanded mode first
            if (!currentlyDisabled) {
                setYouTubeExpanded(false);
            }

            setYouTubeEnabled(
                currentlyDisabled
            );
        }
    );
}

function attachYouTubePlayerTracking() {
    if (
        !youtubeIframe ||
        typeof YT === "undefined" ||
        !YT.Player
    ) {
        return;
    }

    if (youtubePlayer) {
        return;
    }

    youtubePlayer =
        new YT.Player(
            youtubeIframe,
            {
                events: {
                    onReady: () => {
                        startYouTubeProgressTracking();
                    },

                    onStateChange: event => {
                        if (
                            event.data ===
                            YT.PlayerState.PLAYING
                        ) {
                            startYouTubeProgressTracking();
                        }

                        if (
                            event.data ===
                                YT.PlayerState.PAUSED ||
                            event.data ===
                                YT.PlayerState.ENDED
                        ) {
                            saveYouTubeProgress();
                        }

if (
    event.data ===
    YT.PlayerState.ENDED
) {
    const activeTemplate =
        getActiveTemplate();

    if (activeTemplate?.youtube) {
        activeTemplate.youtube.currentTime = 0;
        saveAll();
    }
}                    }
                }
            }
        );
}

function startYouTubeProgressTracking() {
    if (youtubeProgressTimer) {
        return;
    }

    youtubeProgressTimer =
        setInterval(
            () => {
                saveYouTubeProgress();
            },
            3000
        );
}

// ALSO PASTE THIS PART HERE:
if (
    typeof YT !== "undefined" &&
    YT.Player
) {
    attachYouTubePlayerTracking();
} else {
    window.onYouTubeIframeAPIReady =
        () => {
            attachYouTubePlayerTracking();
        };
}

const youtubeSearchInput =
    document.getElementById("youtubeSearchInput");

    const youtubeAccountBtn =
    document.getElementById(
        "youtubeAccountBtn"
    );
if (
    youtubeAccessToken &&
    youtubeAccountBtn
) {
    youtubeAccountBtn.textContent =
    "✓";

youtubeAccountBtn.classList.add(
    "connected"
);
    youtubeAccountBtn.title =
        "YouTube connected";
}

    if (
    typeof google !== "undefined" &&
    google.accounts?.oauth2
) {
    youtubeTokenClient =
        google.accounts.oauth2.initTokenClient({
            client_id:
                YOUTUBE_CLIENT_ID,

            scope:
                "https://www.googleapis.com/auth/youtube.readonly",

            callback: async response => {

                if (
                    !response ||
                    !response.access_token
                ) {
                    console.error(
                        "YouTube authorization failed:",
                        response
                    );

                    return;
                }

                youtubeAccessToken =
    response.access_token;

                sessionStorage.setItem(
    "opsYouTubeAccessToken",
    youtubeAccessToken
);

                console.log(
                    "YouTube account connected."
                );

                if (youtubeAccountBtn) {
                    youtubeAccountBtn.textContent =
    "✓";

youtubeAccountBtn.classList.add(
    "connected"
);
                    youtubeAccountBtn.title =
                        "YouTube connected";
                }

                await loadYouTubeAccount();
            }
        });
}

if (
    youtubeAccountBtn &&
    youtubeTokenClient
) {
    youtubeAccountBtn.addEventListener(
        "click",
        () => {
            youtubeTokenClient
                .requestAccessToken();
        }
    );
}

    if (
    youtubeBrowseBtn &&
    youtubeBrowsePanel
) {
    youtubeBrowseBtn.addEventListener(
        "click",
        () => {
            youtubeBrowsePanel.classList.add(
                "open"
            );
        }
    );
}

if (
    youtubeBrowseCloseBtn &&
    youtubeBrowsePanel
) {
    youtubeBrowseCloseBtn.addEventListener(
        "click",
        () => {
            youtubeBrowsePanel.classList.remove(
                "open"
            );
        }
    );
}

const youtubeResultItems =
    document.querySelectorAll(
        ".youtube-result-item"
    );

youtubeResultItems.forEach(
    item => {
        item.addEventListener(
            "click",
            () => {
                const videoId =
                    item.dataset.videoId;

                if (
                    !videoId ||
                    !youtubeIframe
                ) {
                    return;
                }

const activeTemplate =
    getActiveTemplate();

if (activeTemplate?.youtube) {
    activeTemplate.youtube.videoId =
        videoId;

    activeTemplate.youtube.currentTime =
        0;

    saveAll();
}

youtubeIframe.src =
                    `https://www.youtube.com/embed/${encodeURIComponent(
                        videoId
                    )}?enablejsapi=1&autoplay=1`;

                if (youtubeBrowsePanel) {
                    youtubeBrowsePanel.classList.remove(
                        "open"
                    );
                }
            }
        );
    }
);

let youtubeSearchTimer = null;

function getYouTubeVideoId(value) {
    const text =
        String(value || "").trim();

    if (!text) {
        return null;
    }

    try {
        const url = new URL(text);

        // youtu.be/VIDEO_ID
        if (
            url.hostname === "youtu.be" ||
            url.hostname === "www.youtu.be"
        ) {
            return url.pathname
                .split("/")
                .filter(Boolean)[0] || null;
        }

        if (
            url.hostname === "youtube.com" ||
            url.hostname === "www.youtube.com" ||
            url.hostname === "m.youtube.com"
        ) {
            // youtube.com/watch?v=VIDEO_ID
            if (url.pathname === "/watch") {
                return url.searchParams.get("v");
            }

            // youtube.com/shorts/VIDEO_ID
            if (
                url.pathname.startsWith(
                    "/shorts/"
                )
            ) {
                return url.pathname
                    .split("/")[2] || null;
            }

            // youtube.com/embed/VIDEO_ID
            if (
                url.pathname.startsWith(
                    "/embed/"
                )
            ) {
                return url.pathname
                    .split("/")[2] || null;
            }

            // youtube.com/live/VIDEO_ID
            if (
                url.pathname.startsWith(
                    "/live/"
                )
            ) {
                return url.pathname
                    .split("/")[2] || null;
            }
        }
    } catch (error) {
        // It isn't a URL, so normal
        // YouTube search can handle it.
    }

    return null;
}

async function loadYouTubeAccount() {

    if (!youtubeAccessToken) {
        return;
    }

    const resultsContainer =
        document.querySelector(
            ".youtube-browse-results"
        );

    if (!resultsContainer) {
        return;
    }

    resultsContainer.innerHTML =
        `<div class="youtube-search-status">
            Loading your YouTube...
        </div>`;

    try {

        const response =
            await fetch(
                "https://www.googleapis.com/youtube/v3/subscriptions" +
                "?part=snippet" +
                "&mine=true" +
                "&maxResults=20",
                {
                    headers: {
                        Authorization:
                            `Bearer ${youtubeAccessToken}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            console.error(
                "YouTube account load failed:",
                data
            );

            resultsContainer.innerHTML =
                `<div class="youtube-search-status">
                    Unable to load YouTube account.
                </div>`;

            return;
        }

        resultsContainer.innerHTML = "";

        (data.items || []).forEach(
            subscription => {

                const snippet =
                    subscription.snippet || {};

                const channelId =
                    snippet.resourceId?.channelId;

                const item =
                    document.createElement(
                        "button"
                    );

                item.type = "button";
                item.className =
                    "youtube-result-item";

                const thumbnail =
                    snippet.thumbnails
                        ?.medium?.url ||
                    snippet.thumbnails
                        ?.default?.url ||
                    "";

                item.innerHTML = `
                    <img
                        class="youtube-result-thumb"
                        src="${thumbnail}"
                        alt=""
                    >

                    <div class="youtube-result-text">
                        <strong></strong>
                        <span>Subscription</span>
                    </div>
                `;

                item.querySelector(
    "strong"
).textContent =
    snippet.title ||
    "YouTube channel";

item.dataset.channelId =
    channelId || "";

item.onclick = async () => {
    console.log(
        "YouTube subscription clicked:",
        snippet.title,
        channelId
    );

    if (!channelId) {
        console.error(
            "Subscription has no channel ID:",
            subscription
        );
        return;
    }

    // Give immediate visual feedback so we
    // know the click actually registered.
    resultsContainer.innerHTML = `
        <div class="youtube-search-status">
            Opening ${snippet.title || "channel"}...
        </div>
    `;

    await loadYouTubeChannelVideos(
        channelId,
        snippet.title ||
            "YouTube channel"
    );
};

resultsContainer.appendChild(
    item
);
            }
        );

    } catch (error) {

        console.error(
            "YouTube account request failed:",
            error
        );
    }
}

async function loadYouTubeChannelVideos(
    channelId,
    channelTitle
) {
    const resultsContainer =
        document.querySelector(
            ".youtube-browse-results"
        );

    if (!resultsContainer) {
        return;
    }

    resultsContainer.innerHTML = `
        <div class="youtube-channel-header">
            <button
                type="button"
                class="youtube-channel-back"
            >
                ← Back
            </button>

            <strong></strong>
        </div>

        <div class="youtube-search-status">
            Loading videos...
        </div>
    `;

    resultsContainer
        .querySelector(
            ".youtube-channel-header strong"
        )
        .textContent = channelTitle;

    resultsContainer
        .querySelector(
            ".youtube-channel-back"
        )
        .addEventListener(
            "click",
            () => {
                loadYouTubeAccount();
            }
        );

    try {
        const url =
            "https://www.googleapis.com/youtube/v3/search" +
            "?part=snippet" +
            "&type=video" +
            "&order=date" +
            "&videoEmbeddable=true" +
            "&videoSyndicated=true" +
            "&maxResults=20" +
            `&channelId=${encodeURIComponent(
                channelId
            )}` +
            `&key=${encodeURIComponent(
                YOUTUBE_API_KEY
            )}`;

        const response =
            await fetch(url);

        const data =
            await response.json();

        if (!response.ok) {
            console.error(
                "Channel video load failed:",
                data
            );

            resultsContainer.innerHTML = `
                <button
                    type="button"
                    class="youtube-channel-back"
                >
                    ← Back
                </button>

                <div class="youtube-search-status">
                    Unable to load channel videos.
                </div>
            `;

            resultsContainer
                .querySelector(
                    ".youtube-channel-back"
                )
                .addEventListener(
                    "click",
                    () => {
                        loadYouTubeAccount();
                    }
                );

            return;
        }

        const items =
            data.items || [];

        resultsContainer.innerHTML = `
            <div class="youtube-channel-header">
                <button
                    type="button"
                    class="youtube-channel-back"
                >
                    ← Back
                </button>

                <strong></strong>
            </div>
        `;

        resultsContainer
            .querySelector(
                ".youtube-channel-header strong"
            )
            .textContent = channelTitle;

        resultsContainer
            .querySelector(
                ".youtube-channel-back"
            )
            .addEventListener(
                "click",
                () => {
                    loadYouTubeAccount();
                }
            );

        items.forEach(result => {
            const videoId =
                result.id?.videoId;

            if (!videoId) {
                return;
            }

            const snippet =
                result.snippet || {};

            const item =
                document.createElement(
                    "button"
                );

            item.type = "button";
            item.className =
                "youtube-result-item";

            const thumbnail =
                snippet.thumbnails
                    ?.medium?.url ||
                snippet.thumbnails
                    ?.default?.url ||
                "";

            item.innerHTML = `
                <img
                    class="youtube-result-thumb"
                    src="${thumbnail}"
                    alt=""
                >

                <div class="youtube-result-text">
                    <strong></strong>
                    <span></span>
                </div>
            `;

            item.querySelector(
                "strong"
            ).textContent =
                snippet.title ||
                "Untitled video";

            item.querySelector(
                "span"
            ).textContent =
                snippet.channelTitle ||
                channelTitle;

item.addEventListener(
    "click",
    () => {
        if (!youtubeIframe) {
            return;
        }

        const activeTemplate =
            getActiveTemplate();

        if (activeTemplate?.youtube) {
            activeTemplate.youtube.videoId =
                videoId;

            activeTemplate.youtube.currentTime =
                0;

            activeTemplate.youtube.enabled =
                true;

            saveAll();
        }

        setYouTubeEnabled(
            true,
            false
        );

        youtubeIframe.src =
            `https://www.youtube.com/embed/${encodeURIComponent(
                videoId
            )}?enablejsapi=1&autoplay=1`;

        youtubeBrowsePanel
            ?.classList
            .remove("open");
    }
);

            resultsContainer.appendChild(
                item
            );
        });

    } catch (error) {
        console.error(
            "Channel video request failed:",
            error
        );
    }
}

async function searchYouTube(query) {
    const resultsContainer =
        document.querySelector(
            ".youtube-browse-results"
        );

    if (!resultsContainer) {
        return;
    }

    if (!query) {
        resultsContainer.innerHTML = "";
        return;
    }

    resultsContainer.innerHTML =
        `<div class="youtube-search-status">
            Searching...
        </div>`;

    try {
        const url =
            "https://www.googleapis.com/youtube/v3/search" +
            "?part=snippet" +
            "&type=video" +
"&videoEmbeddable=true" +
"&videoSyndicated=true" +
"&maxResults=10" +
            `&q=${encodeURIComponent(query)}` +
            `&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

        const response =
            await fetch(url);

        const data =
            await response.json();

        if (!response.ok) {
            console.error(
                "YouTube search failed:",
                data
            );

            resultsContainer.innerHTML =
                `<div class="youtube-search-status">
                    YouTube search failed.
                </div>`;

            return;
        }

        resultsContainer.innerHTML = "";

        (data.items || []).forEach(
            result => {
                const videoId =
                    result.id?.videoId;

                if (!videoId) {
                    return;
                }

                const snippet =
                    result.snippet || {};

                const item =
                    document.createElement(
                        "button"
                    );

                item.type = "button";
                item.className =
                    "youtube-result-item";

                item.dataset.videoId =
                    videoId;

                const thumbnail =
                    snippet.thumbnails
                        ?.medium
                        ?.url ||
                    snippet.thumbnails
                        ?.default
                        ?.url ||
                    "";

                item.innerHTML = `
                    <img
                        class="youtube-result-thumb"
                        src="${thumbnail}"
                        alt=""
                    >

                    <div class="youtube-result-text">
                        <strong></strong>
                        <span></span>
                    </div>
                `;

                item.querySelector(
                    "strong"
                ).textContent =
                    snippet.title ||
                    "Untitled video";

                item.querySelector(
                    "span"
                ).textContent =
                    snippet.channelTitle ||
                    "";

item.addEventListener(
    "click",
    () => {
        if (!youtubeIframe) {
            return;
        }

        const activeTemplate =
            getActiveTemplate();

        if (activeTemplate?.youtube) {
            activeTemplate.youtube.videoId =
                videoId;

            activeTemplate.youtube.currentTime =
                0;

            activeTemplate.youtube.enabled =
                true;

            saveAll();
        }

        setYouTubeEnabled(
            true,
            false
        );

        youtubeIframe.src =
            `https://www.youtube.com/embed/${encodeURIComponent(
                videoId
            )}?enablejsapi=1&autoplay=1`;

        youtubeBrowsePanel
            ?.classList
            .remove("open");
    }
);

                resultsContainer.appendChild(
                    item
                );
            }
        );

    } catch (error) {
        console.error(
            "YouTube search request failed:",
            error
        );

        resultsContainer.innerHTML =
            `<div class="youtube-search-status">
                Unable to search YouTube.
            </div>`;
    }
}

if (youtubeSearchInput) {
    youtubeSearchInput.addEventListener(
        "input",
        () => {
            const query =
                youtubeSearchInput
                    .value
                    .trim();

            if (youtubeBrowsePanel) {
                youtubeBrowsePanel.classList.toggle(
                    "open",
                    Boolean(query)
                );
            }

            const pastedVideoId =
                getYouTubeVideoId(query);

            if (
                pastedVideoId &&
                youtubeIframe
            ) {
                if (youtubeSearchTimer) {
                    clearTimeout(
                        youtubeSearchTimer
                    );
                }

const activeTemplate =
    getActiveTemplate();

if (activeTemplate?.youtube) {
    activeTemplate.youtube.videoId =
        pastedVideoId;

    activeTemplate.youtube.currentTime =
        0;

    saveAll();
}

youtubeIframe.src =
    `https://www.youtube.com/embed/${encodeURIComponent(
        pastedVideoId
    )}?enablejsapi=1&autoplay=1`;

                if (youtubeBrowsePanel) {
                    youtubeBrowsePanel.classList.remove(
                        "open"
                    );
                }

                youtubeSearchInput.value = "";

                return;
            }

            // the existing normal YouTube
            // search timer code continues here

            if (youtubeSearchTimer) {
                clearTimeout(
                    youtubeSearchTimer
                );
            }

            youtubeSearchTimer =
                setTimeout(
                    () => {
                        searchYouTube(query);
                    },
                    350
                );
        }
    );
}

if (readOnlyMode) {

    addImageBtn.style.display = "none";

} else {

    addImageBtn.style.display = "";

}

if (imageUploadArea && imageFileInput && addImageBtn) {
        addImageBtn.addEventListener("click", () => {
            if (viewMode) {
                return;
            }

            imageFileInput.click();
        });

        imageUploadArea.addEventListener("click", (event) => {
            if (readOnlyMode || viewMode) {
                return;
            }

            if (!event.target.closest(".image-preview-card")) {
                imageFileInput.click();
            }
        });

        imageFileInput.addEventListener("change", (event) => {
            if (readOnlyMode || viewMode) {
                return;
            }

            const files = Array.from(event.target.files || []);
            if (!files.length) return;

            const activeTemplate = getActiveTemplate();
            if (!activeTemplate) return;

            activeTemplate.images = activeTemplate.images || [];

            files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = reader.result;
                    if (typeof dataUrl !== "string") return;

                    const probe = new Image();
                    probe.onload = () => {
                        const naturalWidth = Math.max(1, probe.naturalWidth || 220);
                        const naturalHeight = Math.max(1, probe.naturalHeight || 180);
                        const aspectRatio = naturalHeight / naturalWidth;

                        const notesWidth = Math.max(140, document.getElementById("notesArea")?.clientWidth || 220);
const previewContainer =
    document.getElementById("imagePreviewContainer");

const maxWidth = Math.max(
    140,
    previewContainer?.clientWidth || 140
);

const maxHeight = Math.max(
    160,
    (imageUploadArea.clientHeight || 0) - 24
);

let size = maxWidth;
let height = size * aspectRatio;

if (height > maxHeight) {
    height = maxHeight;
    size = Math.max(
        140,
        Math.min(
            maxWidth,
            height / aspectRatio
        )
    );
}

activeTemplate.images.push({
    src: dataUrl,
    size: Math.round(size),
    height: Math.round(height),
    aspectRatio,
    startAtMax: true
});
                        saveAll();
render();

const newImage =
    activeTemplate.images[
        activeTemplate.images.length - 1
    ];

if (newImage?.startAtMax) {
    delete newImage.startAtMax;
    saveAll();
}

                    };
                    probe.onerror = () => {
                        activeTemplate.images.push({
                            src: dataUrl,
                            size: 220,
                            height: 180,
                            aspectRatio: 180 / 220
                        });
                        saveAll();
                        render();
                    };
                    probe.src = dataUrl;
                };
                reader.readAsDataURL(file);
            });

            imageFileInput.value = "";
        });
    }
}

async function checkViewMode() {

    const params = new URLSearchParams(window.location.search);

    const typingId = params.get("view");

    if (!typingId) {
        return;
    }

    viewMode = true;

    const {
    data,
    error
} = await supabaseClient
    .rpc(
        "get_visible_typing",
        {
            requested_id: typingId
        }
    )
    .maybeSingle();

    if (error || !data) {
        showError("Unable to Load", "This typing could not be found.");
        return;
    }

viewedTemplate = {

    id: data.id,

    publisherUserId:
        data.user_id,

    title: data.title,

    notes: data.data.notes || "",

        selections: data.data.selections || {},

        sliderStates: data.data.sliderStates || {},

        saviorState: data.data.saviorState || "",

        demonState: data.data.demonState || "",

        images: data.data.images || [],

        coins: data.data.coins || []

    };

}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
}

document.addEventListener(
    "visibilitychange",
    () => {
        if (
            document.visibilityState ===
            "hidden"
        ) {
            saveTemplates();

            if (cloudSavePending) {
                flushCloudSave();
            }
        }
    }
);

window.addEventListener("beforeunload", () => {
    console.warn(
        "PAGE BEFOREUNLOAD:",
        new Date().toISOString()
    );
});

window.addEventListener(
    "beforeunload",
    () => {
        // Final synchronous browser save before any reload/navigation.
        saveTemplates();
        saveYouTubeProgress();
    }
);

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        filterTypesBySelections,
        generateTypeLibrary,
        buildTypeLabel
    };
}

// =========================
// OP Studio Popup System
// =========================

function showPopup(title, message = "", buttons = []) {

    const overlay = document.getElementById("popupOverlay");
    const popupTitle = document.getElementById("popupTitle");
    const popupMessage = document.getElementById("popupMessage");
    const popupButtons = document.getElementById("popupButtons");

    if (!overlay) return;

    popupTitle.textContent = title;

    if (message) {
        popupMessage.textContent = message;
        popupMessage.style.display = "block";
    } else {
        popupMessage.textContent = "";
        popupMessage.style.display = "none";
    }

    popupButtons.innerHTML = "";

    buttons.forEach(button => {

        const btn = document.createElement("button");

        btn.textContent = button.text;

        btn.onclick = async () => {
    console.log("POPUP BUTTON CLICKED:", button.text);

    overlay.classList.remove("open");

    if (button.action) {
        console.log("POPUP ACTION EXISTS");
        await button.action();
        console.log("POPUP ACTION FINISHED");
    } else {
        console.log("NO POPUP ACTION");
    }
};

        popupButtons.appendChild(btn);

    });

    overlay.classList.add("open");
}


function showInfo(title) {

    showPopup(title, "", [
        {
            text: "OK"
        }
    ]);

}


function showSuccess(title, actions = []) {

    showPopup(title, "", actions);

    if (actions.length === 0) {
        setTimeout(() => {
            const overlay = document.getElementById("popupOverlay");

            if (overlay) {
                overlay.classList.remove("open");
            }
        }, 2000);
    }

}


function showError(title, message) {

    showPopup(title, message, [
        {
            text: "OK"
        }
    ]);

}


function showConfirm(title, confirmAction) {

    showPopup(title, "", [
        {
            text: "Cancel"
        },
        {
           text: "Confirm",
            action: confirmAction
        }
    ]);

}

const emailInput = document.getElementById("accountEmailInput");
const usernameInput = document.getElementById("accountUsernameInput");
const passwordInput = document.getElementById("accountPasswordInput");
const statusBox = document.getElementById("accountStatus");

document.getElementById(
    "createAccountBtn"
).onclick = async () => {

    const email =
        emailInput.value;

    const username =
        usernameInput.value;

    const password =
        passwordInput.value;

    /*
        Capture the guest workspace BEFORE
        creating or switching to the account.
    */
    const guestWorkspaceRaw =
        localStorage.getItem(
            GUEST_WORKSPACE_KEY
        );

    const { data, error } =
        await supabaseClient.auth.signUp({
            email,
            password
        });

    if (error) {
        statusBox.textContent =
            error.message;

        console.error(error);

        showError(
            "Account Failed",
            error.message
        );

        return;
    }

    if (!data?.user) {
        showError(
            "Account Failed",
            "The account was created without a usable user record."
        );

        return;
    }

/*
    If email confirmation is required,
    the new user exists but is not yet
    authenticated.

    Save everything needed for first login
    and do NOT write to protected tables yet.
*/
if (!data.session) {

    if (guestWorkspaceRaw) {
        localStorage.setItem(
            `opsPendingGuestImport:${data.user.id}`,
            guestWorkspaceRaw
        );
    }

    localStorage.setItem(
        `opsPendingUsername:${data.user.id}`,
        username
    );

    statusBox.textContent =
        "Account created. Check your email to finish signing in.";

    showPopup(
        "Account Created",
        "Your guest workspace is safe. After you confirm your account and sign in, OP Studio will ask whether you want to save it to your new account.",
        [
            {
                text: "OK"
            }
        ]
    );

    return;
}


/*
    Immediate-session signup:
    now it is safe to create the profile.
*/
const { error: profileError } =
    await supabaseClient
        .from("profiles")
        .insert([
            {
                id: data.user.id,
                username
            }
        ]);

if (profileError) {
    console.error(
        profileError
    );

    showError(
        "Profile Failed",
        profileError.message
    );

    return;
}

    const finishNewAccount =
        async keepGuestWorkspace => {

            setWorkspaceForUser(
                data.user
            );

            resetWorkspaceMemory();

            if (
                keepGuestWorkspace &&
                guestWorkspaceRaw
            ) {
                try {
                    const guestData =
                        JSON.parse(
                            guestWorkspaceRaw
                        );

                    /*
                        Give the imported account
                        copy a fresh timestamp.
                    */
                    guestData.savedAt =
                        Date.now();

                    localStorage.setItem(
                        activeWorkspaceKey,
                        JSON.stringify(
                            guestData
                        )
                    );

                    loadTemplates();

                } catch (error) {
                    console.error(
                        "Guest workspace import failed:",
                        error
                    );

                    showError(
                        "Import Failed",
                        "Your guest workspace was left unchanged."
                    );

                    return;
                }

            } else {

                /*
                    Brand-new account:
                    start with a completely separate
                    blank account workspace.
                */
                localStorage.removeItem(
                    activeWorkspaceKey
                );

                loadTemplates();
            }

            await saveTemplatesToCloud();

            await loadAccountInfo();

            render();

            loadYouTubeForActiveTemplate();

            statusBox.textContent =
                "Account created!";

            showSuccess(
                keepGuestWorkspace
                    ? "Workspace Saved"
                    : "Fresh Account Created"
            );
        };

    showPopup(
        "Save Current Workspace?",
        "Would you like to copy your current guest workspace into your new account?",
        [
            {
                text: "Start Fresh",
                action: async () => {
                    await finishNewAccount(
                        false
                    );
                }
            },
            {
                text: "Keep & Save",
                action: async () => {
                    await finishNewAccount(
                        true
                    );
                }
            }
        ]
    );
};

document.getElementById("loginAccountBtn").onclick = async () => {
    console.log("LOGIN BUTTON CLICKED");

    const email = emailInput.value;
    const password = passwordInput.value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        statusBox.textContent = error.message;
        showError("Login Failed", error.message);
        return;
    }

    statusBox.textContent = "Logged in!";
    showSuccess("Logged In");
    console.log("LOGIN HANDLER REACHED");
    console.log(data);

console.log(
    "Starting account workspace after login..."
);

// Stop using the guest workspace.
// From this point forward local saves belong
// only to this signed-in account.
setWorkspaceForUser(
    data.user
);

resetWorkspaceMemory();

// Check Supabase before creating or loading
// any browser-local account workspace.
const cloudResult =
    await loadTemplatesFromCloud();

if (cloudResult === false) {
    console.log(
        "No cloud workspace exists. Creating the account's first workspace..."
    );

    loadTemplates();

    await flushCloudSave();
}

await createProfileIfMissing();
await loadAccountInfo();

render();

loadYouTubeForActiveTemplate();
};

document.getElementById(
    "logoutAccountBtn"
).onclick = async () => {
    showConfirm(
        "Log out?",
        async () => {

// Finish saving the signed-in
// account before leaving it.
const saveSucceeded =
    await flushCloudSave();

if (!saveSucceeded) {
    console.error(
        "Logout cancelled because the final cloud save did not succeed."
    );

    showError(
        "Could not safely save your account. Please try logging out again."
    );

    return;
}

const { error } =
    await supabaseClient
        .auth
        .signOut();

            if (error) {
                console.error(
                    "Logout failed:",
                    error
                );
                return;
            }

            // Switch away from the account
            // and into the separate guest workspace.
            setWorkspaceForUser(
                null
            );

            resetWorkspaceMemory();

            loadTemplates();

            accountEmailInput.value =
                "";

            usernameInput.value =
                "";

            passwordInput.value =
                "";

            accountEmailInput.disabled =
                false;

            usernameInput.disabled =
                false;

            accountStatus.textContent =
                "Not logged in.";

            render();

            loadYouTubeForActiveTemplate();

            showSuccess(
                "Logged Out"
            );

            await loadAccountInfo();
        }
    );
};

async function loadAccountInfo() {
    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        accountEmailInput.value = "";
        usernameInput.value = "";

        accountEmailInput.disabled = false;
        usernameInput.disabled = false;

        accountStatus.textContent = "Not logged in.";
        return;
    }

const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

    if (error) {
        console.error(error);
    }

    accountEmailInput.value = user.email;

    if (profile) {
        usernameInput.value = profile.username;
    } else {
        usernameInput.value = "";
        accountStatus.textContent = "Profile missing.";
    }

    accountEmailInput.disabled = true;
    usernameInput.disabled = true;

    passwordInput.value = "";
    passwordInput.placeholder = "Password hidden";

    if (profile) {
        accountStatus.textContent = "Logged in.";
    }
}

document.getElementById("changeAccountBtn").onclick = () => {
    usernameInput.disabled = false;
    usernameInput.focus();
};

document.getElementById("saveUsernameBtn").onclick = async () => {
    const newUsername = usernameInput.value.trim();

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        showError("Not Logged In", "Please log in first.");
        return;
    }

const { error } = await supabaseClient
    .from("profiles")
    .update({
        username: newUsername
    })
    .eq("id", user.id);

if (error) {
    console.error(error);
    showError("Username Failed", error.message);
    return;
}

/* Update username on all older published typings */
const { error: typingsUsernameError } =
    await supabaseClient
        .from("public_typings")
        .update({
            username: newUsername
        })
        .eq("user_id", user.id);

        /* Update username on all older published definitions */
const { error: definitionsUsernameError } =
    await supabaseClient
        .from("public_definitions")
        .update({
            username: newUsername
        })
        .eq("user_id", user.id);

if (definitionsUsernameError) {
    console.error(
        "Published definition username update failed:",
        definitionsUsernameError
    );

    showError(
        "Username Partially Updated",
        "Your username changed, but older published definitions could not be updated."
    );

    return;
}

if (typingsUsernameError) {
    console.error(
        "Published typing username update failed:",
        typingsUsernameError
    );

    showError(
        "Username Partially Updated",
        "Your profile username changed, but older published typings could not be updated."
    );

    return;
}

    usernameInput.disabled = true;

    const usernameMenu =
        document.getElementById(
            "usernameMenu"
        );

    usernameMenu?.classList.remove(
        "open"
    );

    showSuccess("Username Saved");
};

const showPasswordBtn = document.getElementById("showPasswordBtn");

if (showPasswordBtn) {
    showPasswordBtn.addEventListener("click", () => {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            showPasswordBtn.textContent = "🙈";
        } else {
            passwordInput.type = "password";
            showPasswordBtn.textContent = "👁";
        }
    });
}

const googleLoginBtn =
    document.getElementById(
        "googleLoginBtn"
    );

if (googleLoginBtn) {

    googleLoginBtn.onclick =
        async () => {

            /*
                Capture the current guest workspace
                before Google redirects away.

                We do NOT know the returned user ID
                yet, so this is temporarily generic.
            */
            const guestWorkspaceRaw =
                localStorage.getItem(
                    GUEST_WORKSPACE_KEY
                );

            if (guestWorkspaceRaw) {
                localStorage.setItem(
                    "opsPendingGoogleGuestImport",
                    JSON.stringify({
                        workspace:
                            guestWorkspaceRaw,
                        startedAt:
                            Date.now()
                    })
                );
            } else {
                localStorage.removeItem(
                    "opsPendingGoogleGuestImport"
                );
            }

            const { data, error } =
                await supabaseClient
                    .auth
                    .signInWithOAuth({
                        provider: "google",
                        options: {
                            redirectTo:
                                window.location.origin +
                                window.location.pathname,

                            queryParams: {
                                prompt:
                                    "select_account"
                            }
                        }
                    });

            if (error) {

                /*
                    OAuth never started successfully,
                    so discard the temporary marker.
                */
                localStorage.removeItem(
                    "opsPendingGoogleGuestImport"
                );

                console.error(error);

                showAccountPopup(
                    "Google login failed: " +
                    error.message
                );
            }
        };
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        await createProfileIfMissing();
        await loadAccountInfo();
    }
);

async function createProfileIfMissing() {
    const {
        data: { user },
        error: userError
    } =
        await supabaseClient.auth.getUser();

    if (userError || !user) {
        return;
    }

    const {
        data: profile,
        error: profileLookupError
    } =
        await supabaseClient
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

    if (profileLookupError) {
        console.error(
            "Profile lookup failed:",
            profileLookupError
        );

        return;
    }

    /*
        Profile already exists.

        If an old pending username marker
        survived for some reason, it is no
        longer needed.
    */
    if (profile) {
        localStorage.removeItem(
            `opsPendingUsername:${user.id}`
        );

        return;
    }

    /*
        Email-confirmation signup stores the
        username before the user has a session.

        On the user's first authenticated login,
        recover that username here.
    */
    const pendingUsernameKey =
        `opsPendingUsername:${user.id}`;

    const pendingUsername =
        (
            localStorage.getItem(
                pendingUsernameKey
            ) || ""
        ).trim();

    const fallbackUsername =
        user.email
            ? user.email.split("@")[0]
            : `user-${user.id.slice(0, 8)}`;

    const username =
        pendingUsername ||
        fallbackUsername;

    const { error: insertError } =
        await supabaseClient
            .from("profiles")
            .insert([
                {
                    id: user.id,
                    username
                }
            ]);

    if (insertError) {
        console.error(
            "Profile creation failed:",
            insertError
        );

        /*
            Keep the pending username marker.
            That lets a later login try again
            instead of losing the chosen name.
        */
        return;
    }

    /*
        Only remove this after the profile
        was successfully created.
    */
    localStorage.removeItem(
        pendingUsernameKey
    );

    console.log(
        "Missing profile created successfully."
    );
}

