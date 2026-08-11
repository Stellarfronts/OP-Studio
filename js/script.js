console.log("OP Studio loaded!");

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
let editingLocked = false;
let darkMode = false;
let showProjectsMenu = false;
let showTrash = false;
let folders = [];
let trash = [];
let draggingTemplateId = null;

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
    if (value <= 0) {
        return coin.options[0].value;
    }
    if (value === 1) {
        return "__mid_left__";
    }
    if (value === 2) {
        return "__mid_center__";
    }
    if (value === 3) {
        return "__mid_right__";
    }
    if (value >= 4) {
        return coin.options[1].value;
    }
    return coin.options[1].value;
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

    if (typeof localStorage === "undefined") {
        return;
    }

    localStorage.setItem("opsTypingTemplates", JSON.stringify({
        templates,
        folders,
        trash,
        editingLocked,
        darkMode,
        activeTemplateId,
        showTrash
    }));

}

async function saveTemplatesToCloud() {
    if (readOnlyMode || viewMode) {
        return;
    }

    if (typeof supabaseClient === "undefined") {
        return;
    }

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        return;
    }

    const cloudData = {
        templates,
        folders,
        trash,
        editingLocked,
        darkMode,
        activeTemplateId,
        showTrash
    };

    const { error } = await supabaseClient
        .from("user_data")
        .upsert({
            user_id: user.id,
            data: cloudData,
            updated_at: new Date().toISOString()
        }, {
            onConflict: "user_id"
        });

    if (error) {
        console.error("Cloud save failed:", error);
        return;
    }

    console.log("Cloud save successful!");
}

function saveAll() {
    saveTemplates();
    saveTemplatesToCloud();
}

function loadTemplates() {
    const saved = localStorage.getItem("opsTypingTemplates");

    if (!saved) {
        createTemplate();
        return;
     }

    const parsed = JSON.parse(saved);
    ensureFolders();

    if (parsed.templates && parsed.templates.length) {
        folders = Array.isArray(parsed.folders) && parsed.folders.length ? parsed.folders : folders;
        ensureFolders();
        trash = Array.isArray(parsed.trash) ? parsed.trash : [];
        pruneTrash();
        templates = parsed.templates.map(normalizeTemplate);
        editingLocked = Boolean(parsed.editingLocked);
        darkMode = Boolean(parsed.darkMode);
        activeTemplateId = parsed.activeTemplateId || templates[0].id;
        showTrash = Boolean(parsed.showTrash);
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
    darkMode = Boolean(cloudData.darkMode);
    showTrash = Boolean(cloudData.showTrash);

    if (cloudData.activeTemplateId &&
        templates.some(template => template.id === cloudData.activeTemplateId)) {
        activeTemplateId = cloudData.activeTemplateId;
    } else if (templates.length) {
        activeTemplateId = templates[0].id;
    }

    ensureFolders();
    pruneTrash();

    localStorage.setItem("opsTypingTemplates", JSON.stringify({
        templates,
        folders,
        trash,
        editingLocked,
        darkMode,
        activeTemplateId,
        showTrash
    }));

    console.log("Cloud load successful!");
    return true;
}

function moveTemplateToTrash(templateId) {
    const index = templates.findIndex(template => template.id === templateId);
    if (index < 0) return;

    const [template] = templates.splice(index, 1);
    trash.push({
        id: template.id,
        template,
        removedAt: Date.now()
    });

    if (activeTemplateId === templateId) {
        activeTemplateId = templates[0]?.id || null;
    }

   saveAll();
    render();
}

function restoreTemplateFromTrash(trashId) {
    const entry = trash.find(item => item.id === trashId);
    if (!entry) return;

    const restored = { ...entry.template };
    templates.push(restored);
    trash = trash.filter(item => item.id !== trashId);
    activeTemplateId = restored.id;
   saveAll();
    render();
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

function filterTypesBySelections(types, activeSelections = {}) {
    const { special, ...selectionFilters } = activeSelections;

    return types.filter(type => {
        const directMatches = Object.entries(selectionFilters).every(([id, value]) => {
            const selectedValue = type.selections ? type.selections[id] : type[id];
            return selectedValue === value;
        });

        if (!directMatches) return false;

        if (special) {
            const axis = buildAxisSegment(type.selections.cb, type.selections.sp, special);
            const topPair = axis.split("/")[0].split("");
            const conflictMap = {
                "(P)": ["P"],
                "(S)": ["S"],
                "(C)": ["C"],
                "(B)": ["B"]
            };
            const blocked = conflictMap[special] || [];
            if (blocked.some(letter => topPair.includes(letter))) {
                return false;
            }
        }

        return true;
    });
}


function generateTypeLibrary() {
    const library = [];
    const coinIds = DEFAULT_COIN_DEFS.map(coin => coin.id);
    const optionSets = DEFAULT_COIN_DEFS.map(coin => coin.options.map(option => option.value));

    const recurse = (index, selections) => {
        if (index === coinIds.length) {
            const label = buildTypeLabel(selections);
            if (label) {
                library.push({
                    id: library.length + 1,
                    label,
                    selections
                });
            }
            return;
        }

        optionSets[index].forEach(option => {
            recurse(index + 1, { ...selections, [coinIds[index]]: option });
        });
    };

    recurse(0, {});
    return library;
}

function buildTypeLabel(selections) {
    const firstPair = buildFirstPair(selections.od, selections.fSmS, selections.fDeMDe);
    const styleSegment = buildStyleSegment(selections.ft, selections.diDe, selections.ns, selections.oiOe, selections.od);
    const axisSegment = buildAxisSegment(selections.cb, selections.sp, selections.special);
    const numberCode = buildNumberCode(selections.numOneFour, selections.numTwoThree);
    if (!firstPair || !styleSegment || !axisSegment || !numberCode) return "";
    return `${firstPair} ${styleSegment} ${axisSegment} ${numberCode}`.trim();
}

function buildSavedTypingPreviewLabel(selections) {
    const firstPair = buildPreviewFirstPair(selections.od, selections.fSmS, selections.fDeMDe);
    const styleSegment = buildPreviewStyleSegment(selections.ft, selections.diDe, selections.ns, selections.oiOe, selections.od);
    const axisSegment = buildPreviewAxisSegment(selections.cb, selections.sp, selections.special);
    const numberCode = buildPreviewNumberCode(selections.numOneFour, selections.numTwoThree);
    return `${firstPair || "XX"} ${styleSegment || "Xx/Xx"} ${axisSegment || "XX/X(X)"} ${numberCode || "#X"}`.trim();
}

function buildPreviewFirstPair(od, fSmS, fDeMDe) {
    const leftValue = fSmS ? (fSmS === "mS" ? "M" : "F") : "X";
    const rightValue = fDeMDe ? (fDeMDe === "mDe" ? "M" : "F") : "X";
    if (od === "D") {
        return `${rightValue}${leftValue}`;
    }
    return `${leftValue}${rightValue}`;
}

function buildPreviewStyleSegment(ft, diDe, ns, oiOe, od) {
    if (!ft || !diDe || !ns || !oiOe || !od) {
        return "Xx/Xx";
    }

    const firstPart = `${ft === "F" ? "F" : "T"}${diDe === "Di" ? "i" : "e"}`;
    const secondPart = (oiOe === "Oe"
        ? (ns === "N" ? "Ne" : "Se")
        : (oiOe === "Oi" ? (ns === "N" ? "Ni" : "Si") : "Xx"));
    const leftPart = od === "O" ? secondPart : firstPart;
    const rightPart = od === "O" ? firstPart : secondPart;
    return `${leftPart}/${rightPart}`;
}

function normalizeSpecialLetter(special) {
    return (special || "").replace(/[()]/g, "");
}

function buildPreviewAxisSegment(cb, sp, special) {
    const specialLetter = normalizeSpecialLetter(special);
    if (!cb || !sp || !specialLetter) {
        return "XX/X(X)";
    }

    if (!['C', 'B'].includes(cb) || !['S', 'P'].includes(sp)) {
        return "XX/X(X)";
    }

    const oppositeSp = sp === "S" ? "P" : "S";
    return `${cb}${sp}/${oppositeSp}(${specialLetter})`;
}

function buildPreviewNumberCode(oneFour, twoThree) {
    if (!oneFour && !twoThree) {
        return "#X";
    }
    if (oneFour && twoThree) {
        return buildNumberCode(oneFour, twoThree);
    }
    return oneFour || twoThree || "#X";
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
    if (!menu) return;

    menu.innerHTML = "";
    if (!showProjectsMenu) {
        menu.classList.remove("open");
        return;
    }

    menu.classList.add("open");

    const header = document.createElement("div");
    header.className = "projects-menu-header";

    const trashBtn = document.createElement("button");
    trashBtn.className = "projects-toolbar-btn";
    trashBtn.textContent = showTrash ? "← Back" : "Trash";
    trashBtn.onclick = () => {
        showTrash = !showTrash;
        render();
    };

    const addFolderBtn = document.createElement("button");
    addFolderBtn.className = "projects-toolbar-btn";
    addFolderBtn.textContent = "+ Folder";
    addFolderBtn.onclick = () => {
        addFolder();
    };

    header.appendChild(trashBtn);
    header.appendChild(addFolderBtn);
    menu.appendChild(header);

    if (showTrash) {
        const trashList = document.createElement("div");
        trashList.className = "project-group";
        trash.forEach(entry => {
            const item = document.createElement("div");
            item.className = "project-item project-trash-item";
            item.draggable = true;
            item.ondragstart = () => handleTemplateDragStart(entry.template.id);
            item.onclick = () => {
                activeTemplateId = entry.template.id;
                showProjectsMenu = false;
                saveTemplates();
                render();
            };
            const labelContent = document.createElement("div");
            labelContent.className = "project-item-content";
            const label = document.createElement("span");
            label.textContent = entry.template.title || "Untitled";
            const preview = document.createElement("div");
            preview.className = "project-item-preview";
            preview.textContent = getTemplatePreview(entry.template);
            labelContent.appendChild(label);
            labelContent.appendChild(preview);
            const restoreBtn = document.createElement("button");
            restoreBtn.className = "project-action-btn";
            restoreBtn.textContent = "Restore";
            restoreBtn.onclick = (event) => {
                event.stopPropagation();
                restoreTemplateFromTrash(entry.id);
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
        const group = document.createElement("div");
        group.className = "project-group";
        group.ondragover = (event) => event.preventDefault();
        group.ondrop = () => handleTemplateDrop(folder.id);

        const heading = document.createElement("div");
        heading.className = "project-group-title";
        heading.onclick = (event) => {
            if (event.target.closest("button")) return;
            toggleFolder(folder.id);
        };

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "project-action-btn project-folder-toggle";
        toggleBtn.textContent = folder.open ? "▾" : "▸";
        toggleBtn.onclick = (event) => {
            event.stopPropagation();
            toggleFolder(folder.id);
        };

        const titleLabel = document.createElement("span");
        titleLabel.className = "folder-title-label";
        titleLabel.textContent = folder.title;

        if (folder.removable) {
            const renameBtn = document.createElement("button");
            renameBtn.className = "project-action-btn";
            renameBtn.textContent = "✎";
            renameBtn.onclick = () => {
                const nextTitle = prompt("Folder name", folder.title || "");
                if (nextTitle !== null) renameFolder(folder.id, nextTitle);
            };

            const removeBtn = document.createElement("button");
            removeBtn.className = "project-action-btn";
            removeBtn.textContent = "×";
            removeBtn.onclick = () => removeFolder(folder.id);
            heading.appendChild(renameBtn);
            heading.appendChild(removeBtn);
        }

        heading.appendChild(toggleBtn);
        heading.appendChild(titleLabel);
        group.appendChild(heading);

        const content = document.createElement("div");
        content.className = "project-group-items";
        if (!folder.open) {
            content.style.display = "none";
        }
        group.appendChild(content);

        const folderTemplates = templates.filter(template => template.folderId === folder.id);
        folderTemplates.forEach(template => {
            const item = document.createElement("div");
            item.className = "project-item";
            item.draggable = true;
            item.ondragstart = () => handleTemplateDragStart(template.id);
            item.ondragover = (event) => event.preventDefault();
            item.ondrop = () => handleTemplateDrop(folder.id, template.id);
            item.onclick = () => {
                activeTemplateId = template.id;
                showProjectsMenu = false;
                saveTemplates();
                render();
            };

            const labelContent = document.createElement("div");
            labelContent.className = "project-item-content";
            const label = document.createElement("span");
            label.textContent = template.title || "Untitled";
            const preview = document.createElement("div");
            preview.className = "project-item-preview";
            preview.textContent = getTemplatePreview(template);
            labelContent.appendChild(label);
            labelContent.appendChild(preview);

            const actions = document.createElement("div");
actions.className = "project-item-actions";



const trashBtn = document.createElement("button");
trashBtn.className = "project-action-btn";
trashBtn.textContent = "🗑";

trashBtn.onclick = (event) => {
    event.stopPropagation();
    moveTemplateToTrash(template.id);
};

actions.appendChild(trashBtn);

item.appendChild(labelContent);
item.appendChild(actions);
            content.appendChild(item);
        });

        group.classList.toggle("collapsed", !folder.open);
        menu.appendChild(group);
    });
}

function renderImageGallery(activeTemplate) {
    const imageUploadArea = document.getElementById("imageUploadArea");
    const imagePlaceholder = document.getElementById("imagePlaceholder");
    const imagePreviewContainer = document.getElementById("imagePreviewContainer");
    const addImageBtn = document.getElementById("addImageBtn");
    const notesPanel = document.querySelector(".notes-panel");
    const notesArea = document.getElementById("notesArea");

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

        const notesMaxWidth = Math.max(140, notesArea?.clientWidth || 140);
        const areaMaxWidth = Math.max(140, (imageUploadArea.clientWidth || 0) - 2);
        const maxCardWidth = Math.max(140, Math.min(areaMaxWidth, notesMaxWidth));
        const maxCardHeight = Math.max(160, (imageUploadArea.clientHeight || 0) - 24);

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

        let baseWidth = Math.max(140, Math.min(maxCardWidth, savedWidth));
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
            saveTemplates();
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
                saveTemplates();
                return;
            }
            card.style.top = `${event.clientY - offsetY}px`;
            card.style.left = "0px";
        };

        const endDrag = () => {
            const wasDragging = isDragging;
            isDragging = false;
            isResizing = false;
            if (wasDragging && maybeSwapByDropPosition()) {
                return;
            }
            card.style.position = "";
            card.style.top = "";
            card.style.left = "";
            card.style.zIndex = "";
        };

        card.addEventListener("mousedown", startDrag);
        resizeHandle.addEventListener("mousedown", (event) => {
            event.stopPropagation();
            isResizing = true;
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
                saveTemplates();
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
                saveTemplates();
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
    projectsBtn.textContent = showProjectsMenu ? "Close" : "Saved Typings";
    lockBtn.textContent = editingLocked ? "Edit" : "Lock";
    themeBtn.textContent = darkMode ? "Light" : "Dark";
}

    renderProjectsMenu();

    container.innerHTML = "";
    activeTemplate.coins.forEach(coin => {
        const row = document.createElement("div");
        row.className = "coin-row";

        const selectedValue = activeTemplate.selections[coin.id];

        const optionGrid = document.createElement("div");
        optionGrid.className = "coin-option-grid";

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
                const sliderState = activeTemplate.sliderStates?.[coin.id];
                const isLeftCard = index === 0;
                const isRightCard = index === 1;
                const isHalfSelected = typeof sliderState === "number" && ((isLeftCard && sliderState === 1) || (isRightCard && sliderState === 3));
                const isFullSelected = typeof sliderState === "number" && ((isLeftCard && sliderState === 0) || (isRightCard && sliderState >= 4));
                const halfDirectionClass = isHalfSelected && isRightCard && sliderState === 3 ? " reverse" : "";
                const isSelected = selectedValue === option.value;
                card.className = "option-card" + (isSelected ? " selected" : "") + (isHalfSelected ? " slider-half-selected" : "") + (isFullSelected ? " slider-full-selected" : "") + halfDirectionClass;
                pairCards.push(card);

                const button = document.createElement("button");
                button.className = "option-button";
                button.textContent = option.label;
                button.onclick = () => {
                    if (suppressClick) {
                        suppressClick = false;
                        return;
                    }
                    const nextValue = activeTemplate.selections[coin.id] === option.value ? undefined : option.value;
                    setTemplateSelection(activeTemplate, coin, nextValue);
                    saveTemplates();
                    render();
                };

                const input = document.createElement("input");
                const leftSideValues = ["O", "Di", "Oi", "N", "F", "fDe", "fS", "#1", "#2", "C", "S"];
                if (index === 0) {
                    input.className = "option-definition left-definition";
                    if (leftSideValues.includes(option.value)) {
                        input.style.textAlign = "right";
                        input.style.direction = "rtl";
                    }
                } else {
                    input.className = "option-definition right-definition";
                }
                input.addEventListener("click", (e) => {
input.addEventListener("click", (e) => {
    if (viewMode) {
        e.preventDefault();
        return;
    }

    if (editingLocked) {
        e.preventDefault();

        const nextValue =
            activeTemplate.selections[coin.id] === option.value
                ? undefined
                : option.value;

        setTemplateSelection(activeTemplate, coin, nextValue);
        saveTemplates();
        render();
        return;
    }

    e.stopPropagation();
});
                    e.stopPropagation();
                });
                input.placeholder = `Define ${option.label}`;
                input.value = option.definition || "";
input.disabled = editingLocked || readOnlyMode || viewMode;input.addEventListener("input", () => {
                    option.definition = input.value;
saveAll();
                });

card.onclick = () => {
    if (viewMode) {
        return;
    }

    if (suppressClick) {
        suppressClick = false;
        return;
    }
                    const nextValue = activeTemplate.selections[coin.id] === option.value ? undefined : option.value;
setTemplateSelection(activeTemplate, coin, nextValue);
saveAll();
render();
                };

                if (index === 0) {
                    card.appendChild(input);
                    card.appendChild(button);
                } else {
                    card.appendChild(button);
                    card.appendChild(input);
                }

                pairRow.appendChild(card);
            });

            const pairSelector = document.createElement("div");
            pairSelector.className = "coin-pair-selector";

            const slider = document.createElement("input");
            slider.type = "range";
            slider.className = "coin-pair-slider";
            slider.min = "0";
            slider.max = "4";
            slider.step = "1";
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
saveAll();
});
            slider.addEventListener("change", () => {
                render();
            });

            const applyPairVisualState = (stateValue) => {
                const state = Math.max(0, Math.min(4, Number(stateValue) || 2));
                pairCards.forEach((card, index) => {
                    const isLeftCard = index === 0;
                    const isRightCard = index === 1;
                    const isHalfSelected = (isLeftCard && state === 1) || (isRightCard && state === 3);
                    const isFullSelected = (isLeftCard && state === 0) || (isRightCard && state === 4);

                    card.className = "option-card";
                    if (isFullSelected) {
                        card.classList.add("selected", "slider-full-selected");
                    } else if (isHalfSelected) {
                        card.classList.add("slider-half-selected");
                        if (isRightCard && state === 3) {
                            card.classList.add("reverse");
                        }
                    }
                });
            };

            const getNearestMarker = (clientX) => {
                const rect = pairRow.getBoundingClientRect();
                if (!rect.width) {
                    return Number(slider.value) || 2;
                }
                const ratio = (clientX - rect.left) / rect.width;
                const marker = Math.round(ratio * 4);
                return Math.max(0, Math.min(4, marker));
            };

const finalizeDragSelection = (marker) => {
    if (viewMode) {
        return;
    }

    isDragSelecting = false;
    slider.value = String(marker);
    const nextValue = getSelectionValueFromSlider(coin, marker);
    setTemplateSelection(activeTemplate, coin, nextValue);
    saveTemplates();
                // Always suppress the trailing click fired after pointerup so selection does not get toggled off.
                suppressClick = true;
                render();
            };

            pairRow.addEventListener("pointerdown", (event) => {
                if (event.button !== 0) return;
                if (!editingLocked && event.target.closest(".option-definition")) return;

                isDragSelecting = true;
                hasDragMoved = false;
                pairRow.setPointerCapture(event.pointerId);
                const marker = getNearestMarker(event.clientX);
                slider.value = String(marker);
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
            coin.options.forEach((option) => {
                const card = document.createElement("div");
                const isSelected = selectedValue === option.value;
                card.className = "option-card" + (isSelected ? " selected" : "");

                const button = document.createElement("button");
                button.className = "option-button";
                button.textContent = option.label;
                button.onclick = () => {
                    const nextValue = activeTemplate.selections[coin.id] === option.value ? undefined : option.value;
                    setTemplateSelection(activeTemplate, coin, nextValue);
                    saveTemplates();
                    render();
                };

                card.onclick = () => {
                    const nextValue = activeTemplate.selections[coin.id] === option.value ? undefined : option.value;
                    setTemplateSelection(activeTemplate, coin, nextValue);
                    saveTemplates();
                    render();
                };
                card.appendChild(button);
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
    saviorInput.addEventListener("mousedown", (event) => {
        event.stopPropagation();
        saviorInput.focus();
    });
    saviorInput.addEventListener("touchstart", (event) => {
        event.stopPropagation();
        saviorInput.focus();
    });
    saviorInput.addEventListener("focus", () => {
        saviorInput.setSelectionRange(saviorInput.value.length, saviorInput.value.length);
    });
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
    demonInput.addEventListener("mousedown", (event) => {
        event.stopPropagation();
        demonInput.focus();
    });
    demonInput.addEventListener("touchstart", (event) => {
        event.stopPropagation();
        demonInput.focus();
    });
    demonInput.addEventListener("focus", () => {
        demonInput.setSelectionRange(demonInput.value.length, demonInput.value.length);
    });
    demonCard.appendChild(demonLabel);
    demonCard.appendChild(demonInput);

    stateDefinitions.appendChild(saviorCard);
    stateDefinitions.appendChild(demonCard);
    container.appendChild(stateDefinitions);

    renderImageGallery(activeTemplate);

    const filtered = filterTypesBySelections(typeLibrary, activeTemplate.selections);
    const totalPossible = typeLibrary.length || 1;
    const eliminated = Math.min(100, Math.max(0, Math.round(((totalPossible - filtered.length) / totalPossible) * 100)));
    document.getElementById("typesRemaining").textContent = `${filtered.length} Types`;
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
    const notesArea = document.getElementById("notesArea");
    const bulletBtn = document.getElementById("bulletBtn");
    const newTemplateBtn = document.getElementById("newTemplateBtn");
    const clearBtn = document.getElementById("clearBtn");
const projectsBtn = document.getElementById("projectsBtn");
const lockBtn = document.getElementById("lockBtn");
const themeBtn = document.getElementById("themeBtn");
const viewModeLabel = document.getElementById("viewModeLabel");
const backToDatabaseBtn = document.getElementById("backToDatabaseBtn");
const duplicateTypingBtn = document.getElementById("duplicateTypingBtn");

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

    duplicateTypingBtn.addEventListener("click", () => {

        if (!viewMode || !viewedTemplate) {
            return;
        }

        const copiedTemplate = {
            ...structuredClone(viewedTemplate),
            id: Date.now().toString(36),
            title: viewedTemplate.title + " (Copy)"
        };

        templates.push(copiedTemplate);

        activeTemplateId = copiedTemplate.id;

        saveTemplates();

        showSuccess("Typing copied successfully!");

        setTimeout(() => {
window.location.href = "index.html?copied=1";
        }, 1500);

    });

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

    if (viewModeLabel) viewModeLabel.style.display = "";
    if (backToDatabaseBtn) backToDatabaseBtn.style.display = "";
    if (duplicateTypingBtn) duplicateTypingBtn.style.display = "";

} else {


    clearBtn.style.display = "";
    lockBtn.style.display = "";
    databaseBtn.style.display = "";
    publishBtn.style.display = "";
    newTemplateBtn.style.display = "";
    projectsBtn.style.display = "";
    accountBtn.style.display = "";
    themeBtn.style.display = "";

    if (viewModeLabel) viewModeLabel.style.display = "none";
    if (backToDatabaseBtn) backToDatabaseBtn.style.display = "none";
    if (duplicateTypingBtn) duplicateTypingBtn.style.display = "none";
}

    templateTitleInput.addEventListener("input", () => {
        const activeTemplate = getActiveTemplate();
        if (activeTemplate) {
activeTemplate.title = templateTitleInput.value;
saveAll();
render();
        }
    });

if (backToDatabaseBtn) {
    backToDatabaseBtn.addEventListener("click", () => {
        viewMode = false;
        readOnlyMode = false;
        viewedTemplate = null;

        window.location.href = "database.html";
    });
}

    accountBtn.addEventListener("click", (event) => {
    event.stopPropagation();

    const accountMenu = document.getElementById("accountMenu");

    if (accountMenu) {
        accountMenu.classList.toggle("open");
    }
});

notesArea.addEventListener("input", () => {
    if (viewMode) {
        return;
    }

    const activeTemplate = getActiveTemplate();
    if (activeTemplate) {
        activeTemplate.notes = notesArea.value;
        saveTemplates();
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

        const activeTemplate = getActiveTemplate();
        if (activeTemplate) {
activeTemplate.notes = nextValue;
saveAll();
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
            saveTemplates();
        }
    });

    newTemplateBtn.addEventListener("click", () => {
        createTemplate();
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

    projectsBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        showProjectsMenu = !showProjectsMenu;
        render();
    });

    databaseBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        window.location.href = "/database.html";
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
saveAll();
render();
    });

  publishBtn.addEventListener("click", async () => {

    const activeTemplate = getActiveTemplate();
    if (!activeTemplate) return;

    const title = (templateTitleInput?.value || activeTemplate.title || "Untitled Typing").trim();

    // Make sure the user is logged in
    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
showError("Login Required", "Please log in before publishing.");        return;
    }

    // Confirmation popup
publishBtn.addEventListener("click", async () => {

    const activeTemplate = getActiveTemplate();
    if (!activeTemplate) return;

    const title = (templateTitleInput?.value || activeTemplate.title || "Untitled Typing").trim();

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        showError("Login Required", "Please log in before publishing.");
        return;
    }

    showConfirm("Publish Typing?", async () => {

const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

if (profileError || !profile) {
    console.error(profileError);
    showError("Publish Failed", "Unable to load your profile.");
    return;
}

const typingData = {
    notes: activeTemplate.notes || "",
    selections: activeTemplate.selections || {},
    sliderStates: activeTemplate.sliderStates || {},
    saviorState: activeTemplate.saviorState || "",
    demonState: activeTemplate.demonState || "",
    images: activeTemplate.images || [],
    coins: activeTemplate.coins || []
};

let publishedId = activeTemplate.publicTypingId;

if (publishedId) {

    // Update existing publication
    const { error } = await supabaseClient
        .from("public_typings")
        .update({
            username: profile.username,
            title: title,
            data: typingData,
            updated_at: new Date().toISOString()
        })
        .eq("id", publishedId)
        .eq("user_id", user.id);

    if (error) {
        console.error("Publish update failed:", error);
        showError("Publish Failed", error.message);
        return;
    }

} else {

    // Create new publication
    const { data: publishedData, error } = await supabaseClient
        .from("public_typings")
        .insert([
            {
                user_id: user.id,
                username: profile.username,
                title: title,
                possibilities: null,
                revealed_type: null,
                data: typingData
            }
        ])
        .select("id")
        .single();

    if (error) {
        console.error("Publish failed:", error);
        showError("Publish Failed", error.message);
        return;
    }

    publishedId = publishedData.id;
}

activeTemplate.publicTypingId = publishedId;

saveAll();

showSuccess(
    activeTemplate.publicTypingId
        ? "Typing Published"
        : "Typing Published"
);

    });

});

console.log("Successfully saved!");
showSuccess("Typing Published");
});

}

async function init() {
    typeLibrary = generateTypeLibrary();

    const copiedFromDatabase = new URLSearchParams(window.location.search).get("copied");

if (copiedFromDatabase === "1") {
    showProjectsMenu = true;
}

loadTemplates();

await checkViewMode();

wireEvents();

render();

    const imageUploadArea = document.getElementById("imageUploadArea");
    const imageFileInput = document.getElementById("imageFileInput");
    const addImageBtn = document.getElementById("addImageBtn");

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

    if (readOnlyMode) {
        return;
    }

        });

imageFileInput.addEventListener("change", (event) => {
    if (readOnlyMode) {
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
                        const areaWidth = Math.max(140, (imageUploadArea.clientWidth || 0) - 2);
                        const maxWidth = Math.max(140, Math.min(notesWidth, areaWidth));
                        const maxHeight = Math.max(160, (imageUploadArea.clientHeight || 0) - 24);

                        let size = Math.max(140, Math.min(maxWidth, naturalWidth));
                        let height = size * aspectRatio;
                        if (height > maxHeight) {
                            height = maxHeight;
                            size = Math.max(140, Math.min(maxWidth, height / aspectRatio));
                        }

                        activeTemplate.images.push({
                            src: dataUrl,
                            size: Math.round(size),
                            height: Math.round(height),
                            aspectRatio
                        });
                        saveTemplates();
                        render();
                    };
                    probe.onerror = () => {
                        activeTemplate.images.push({
                            src: dataUrl,
                            size: 220,
                            height: 180,
                            aspectRatio: 180 / 220
                        });
                        saveTemplates();
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

    const { data, error } = await supabaseClient
        .from("public_typings")
        .select("*")
        .eq("id", typingId)
        .single();

    if (error || !data) {
        showError("Unable to Load", "This typing could not be found.");
        return;
    }

    viewedTemplate = {

        id: data.id,

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

        btn.onclick = () => {
            overlay.classList.remove("open");

            if (button.action) {
                button.action();
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

document.getElementById("createAccountBtn").onclick = async () => {

    const email = emailInput.value;
    const username = usernameInput.value;
    const password = passwordInput.value;

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
    });

    if(error){
        statusBox.textContent = error.message;
        console.error(error);
        showError("Account Failed", error.message);
        return;
    }

    const { error: profileError } = await supabaseClient
        .from("profiles")
        .insert([
            {
                id: data.user.id,
                username: username
            }
        ]);

    if(profileError){
        console.error(profileError);
        showError("Profile Failed", profileError.message);
        return;
    }

    statusBox.textContent = "Account created!";
    showSuccess("Account Created");

};


document.getElementById("loginAccountBtn").onclick = async () => {
    console.log("LOGIN BUTTON CLICKED");

    const email = emailInput.value;
    const password = passwordInput.value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

if(error){
    statusBox.textContent = error.message;
    showError("Login Failed", error.message);
    return;
}

statusBox.textContent = "Logged in!";
showSuccess("Logged In");
console.log("LOGIN HANDLER REACHED");
console.log(data);

console.log("Starting cloud load after login...");

await loadTemplatesFromCloud();
loadAccountInfo();
render();

};


document.getElementById("logoutAccountBtn").onclick = async () => {

    showConfirm("Log out?", async () => {

const { error } = await supabaseClient.auth.signOut();

if (error) {
    console.error("Logout failed:", error);
    return;
}

accountEmailInput.value = "";
usernameInput.value = "";
passwordInput.value = "";

accountEmailInput.disabled = false;
usernameInput.disabled = false;

accountStatus.textContent = "Not logged in.";

showSuccess("Logged Out");

await loadAccountInfo();

    });

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
        .single();


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


    usernameInput.disabled = true;

    showSuccess("Username Saved");

};

const showPasswordBtn = document.getElementById("showPasswordBtn");

if(showPasswordBtn){
    showPasswordBtn.addEventListener("click", () => {

        if(passwordInput.type === "password"){
            passwordInput.type = "text";
            showPasswordBtn.textContent = "🙈";
        } else {
            passwordInput.type = "password";
            showPasswordBtn.textContent = "👁";
        }

    });
}const googleLoginBtn = document.getElementById("googleLoginBtn");

if (googleLoginBtn) {
    googleLoginBtn.onclick = async () => {

        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) {
            showAccountPopup("Google login failed: " + error.message);
            console.error(error);
        }

    };
}
document.addEventListener("DOMContentLoaded", async () => {

    await createProfileIfMissing();

    await loadAccountInfo();

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

if (user) {
    console.log("Logged-in user detected. Loading cloud data...");

    const cloudLoaded = await loadTemplatesFromCloud();

    if (!cloudLoaded) {
        console.log("No cloud data found. Saving local Typings to cloud...");
        await saveTemplatesToCloud();
    }

    render();
}

});

async function createProfileIfMissing() {

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();


    if (!user) return;


    const { data: profile } = await supabaseClient
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();


    if (!profile) {

        const { error } = await supabaseClient
            .from("profiles")
            .insert([
                {
                    id: user.id,
                    username: user.email.split("@")[0]
                }
            ]);


        if (error) {
            console.error("Profile creation failed:", error);
        }
    }

}