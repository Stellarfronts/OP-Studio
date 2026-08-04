console.log("OPS Studio loaded!");

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

function normalizeTemplate(template) {
    ensureFolders();

    const coins = normalizeCoins(template?.coins);
    const selections = {};

    coins.forEach(coin => {
        const selectedValue = template?.selections?.[coin.id];
        if (selectedValue && coin.options.some(option => option.value === selectedValue)) {
            selections[coin.id] = selectedValue;
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
        selections
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
        coins: normalizeCoins(sourceTemplate ? sourceTemplate.coins : DEFAULT_COIN_DEFS)
    };

    templates.push(template);
    activeTemplateId = template.id;
    saveTemplates();
    render();
    return template;
}

function getActiveTemplate() {
    return templates.find(template => template.id === activeTemplateId) || templates[0];
}

function pruneTrash() {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    trash = trash.filter(entry => (entry.removedAt || 0) > cutoff);
}

function saveTemplates() {
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

function loadTemplates() {
    if (typeof localStorage === "undefined") {
        return;
    }

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

    saveTemplates();
    render();
}

function restoreTemplateFromTrash(trashId) {
    const entry = trash.find(item => item.id === trashId);
    if (!entry) return;

    const restored = { ...entry.template };
    templates.push(restored);
    trash = trash.filter(item => item.id !== trashId);
    activeTemplateId = restored.id;
    saveTemplates();
    render();
}

function addFolder() {
    const folder = createFolder("New folder", true);
    saveTemplates();
    render();
    return folder;
}

function renameFolder(folderId, title) {
    const folder = getFolderById(folderId);
    if (!folder) return;
    folder.title = title || "Untitled folder";
    saveTemplates();
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
    saveTemplates();
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

    saveTemplates();
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
            const axis = buildAxisSegment(type.selections.oiOe, type.selections.diDe, special);
            const topPair = axis.split("/")[0].split("");
            const conflictMap = {
                "(P)": ["S"],
                "(S)": ["P"],
                "(C)": ["B"],
                "(B)": ["C"]
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
    const axisSegment = buildAxisSegment(selections.oiOe, selections.diDe, selections.special);
    const numberCode = buildNumberCode(selections.numOneFour, selections.numTwoThree);
    if (!firstPair || !styleSegment || !axisSegment || !numberCode) return "";
    return `${firstPair} ${styleSegment} ${axisSegment} ${numberCode}`.trim();
}

function buildSavedTypingPreviewLabel(selections) {
    const firstPair = buildFirstPair(selections.od, selections.fSmS, selections.fDeMDe);
    const styleSegment = buildStyleSegment(selections.ft, selections.diDe, selections.ns, selections.oiOe, selections.od);
    const axisSegment = buildAxisSegment(selections.oiOe, selections.diDe, selections.special);
    const numberCode = buildNumberCode(selections.numOneFour, selections.numTwoThree);
    if (!firstPair || !styleSegment || !axisSegment || !numberCode) {
        return "XX Xx/Xx XX/X(X) #x";
    }
    return buildTypeLabel(selections);
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

function buildAxisSegment(oiOe, diDe, special) {
    if (!oiOe || !diDe || !special) return "";
    const pairMap = {
        OiDi: ["P", "C"],
        OiDe: ["B", "S"],
        OeDi: ["C", "P"],
        OeDe: ["P", "C"]
    };
    const firstPair = pairMap[`${oiOe}${diDe}`] || ["P", "C"];
    const specialLetter = (special || "(S)").replace(/[()]/g, "");
    const remainingLetters = ["C", "P", "B", "S"].filter(letter => !firstPair.includes(letter));
    const chosenSpecial = remainingLetters.includes(specialLetter) ? specialLetter : remainingLetters[0];
    const thirdLetter = remainingLetters.find(letter => letter !== chosenSpecial) || remainingLetters[0];
    const axisBody = `${chosenSpecial}(${thirdLetter})`;
    return `${firstPair.join("")}/${axisBody}`;
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

            const trashBtn = document.createElement("button");
            trashBtn.className = "project-action-btn";
            trashBtn.textContent = "🗑";
            trashBtn.onclick = (event) => {
                event.stopPropagation();
                moveTemplateToTrash(template.id);
            };

            item.appendChild(labelContent);
            item.appendChild(trashBtn);
            content.appendChild(item);
        });

        group.classList.toggle("collapsed", !folder.open);
        menu.appendChild(group);
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

    if (!container || !notesArea || !resultsList || !matchingCount || !progressFill || !templateTitleInput || !projectsBtn || !lockBtn || !themeBtn) {
        return;
    }

    const activeTemplate = getActiveTemplate();
    if (!activeTemplate) return;

    templateTitleInput.value = activeTemplate.title;
    templateTitleInput.placeholder = "Title";
    notesArea.value = activeTemplate.notes;
    projectsBtn.textContent = showProjectsMenu ? "Close" : "Saved Typings";
    lockBtn.textContent = editingLocked ? "Edit" : "Lock";
    themeBtn.textContent = darkMode ? "Light" : "Dark";

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

            coin.options.forEach((option, index) => {
                const card = document.createElement("div");
                card.className = "option-card";

                const button = document.createElement("button");
                button.className = "option-button" + (selectedValue === option.value ? " selected" : "");
                button.textContent = option.label;
                button.onclick = () => {
                    if (activeTemplate.selections[coin.id] === option.value) {
                        delete activeTemplate.selections[coin.id];
                    } else {
                        activeTemplate.selections[coin.id] = option.value;
                    }
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
                    e.stopPropagation();
                });
                input.placeholder = `Define ${option.label}`;
                input.value = option.definition || "";
                input.disabled = editingLocked;
                input.addEventListener("input", () => {
                    option.definition = input.value;
                    saveTemplates();
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

            const pairSelector = document.createElement("div");
            pairSelector.className = "coin-pair-selector";

            const slider = document.createElement("input");
            slider.type = "range";
            slider.className = "coin-pair-slider";
            slider.min = "0";
            slider.max = "4";
            slider.step = "1";
            let initialSliderValue = "2";
            if (selectedValue === coin.options[0].value) {
                initialSliderValue = "0";
            } else if (selectedValue === "__mid_left__") {
                initialSliderValue = "1";
            } else if (selectedValue === "__mid_right__") {
                initialSliderValue = "3";
            } else if (selectedValue === coin.options[1].value) {
                initialSliderValue = "4";
            }
            slider.value = initialSliderValue;
            slider.disabled = editingLocked;
            slider.addEventListener("input", () => {
                const value = Number(slider.value);
                if (value <= 0) {
                    activeTemplate.selections[coin.id] = coin.options[0].value;
                } else if (value === 1) {
                    activeTemplate.selections[coin.id] = "__mid_left__";
                } else if (value === 2) {
                    delete activeTemplate.selections[coin.id];
                } else if (value === 3) {
                    activeTemplate.selections[coin.id] = "__mid_right__";
                } else if (value >= 4) {
                    activeTemplate.selections[coin.id] = coin.options[1].value;
                }
                saveTemplates();
            });
            slider.addEventListener("change", () => {
                render();
            });

            pairSelector.appendChild(slider);
            pair.appendChild(pairRow);
            pair.appendChild(pairSelector);
            optionGrid.appendChild(pair);
        } else {
            coin.options.forEach((option, index) => {
                const card = document.createElement("div");
                card.className = "option-card";

                const button = document.createElement("button");
                button.className = "option-button" + (selectedValue === option.value ? " selected" : "");
                button.textContent = option.label;
                button.onclick = () => {
                    if (activeTemplate.selections[coin.id] === option.value) {
                        delete activeTemplate.selections[coin.id];
                    } else {
                        activeTemplate.selections[coin.id] = option.value;
                    }
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
                    e.stopPropagation();
                });
                input.placeholder = `Define ${option.label}`;
                input.value = option.definition || "";
                input.disabled = editingLocked;
                input.addEventListener("input", () => {
                    option.definition = input.value;
                    saveTemplates();
                });

                if (index === 0) {
                    card.appendChild(input);
                    card.appendChild(button);
                } else {
                    card.appendChild(button);
                    card.appendChild(input);
                }
                optionGrid.appendChild(card);
            });
        }

        row.appendChild(optionGrid);
        container.appendChild(row);
    });

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
    const newTemplateBtn = document.getElementById("newTemplateBtn");
    const clearBtn = document.getElementById("clearBtn");
    const projectsBtn = document.getElementById("projectsBtn");
    const lockBtn = document.getElementById("lockBtn");
    const themeBtn = document.getElementById("themeBtn");

    templateTitleInput.addEventListener("input", () => {
        const activeTemplate = getActiveTemplate();
        if (activeTemplate) {
            activeTemplate.title = templateTitleInput.value;
            saveTemplates();
            render();
        }
    });

    notesArea.addEventListener("input", () => {
        const activeTemplate = getActiveTemplate();
        if (activeTemplate) {
            activeTemplate.notes = notesArea.value;
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
            saveTemplates();
            render();
        }
    });

    projectsBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        showProjectsMenu = !showProjectsMenu;
        render();
    });

    document.addEventListener("click", (event) => {
        const menu = document.getElementById("projectsMenu");
        const button = document.getElementById("projectsBtn");
        if (!menu || !button) return;
        if (!menu.contains(event.target) && !button.contains(event.target)) {
            showProjectsMenu = false;
            render();
        }
    });

    lockBtn.addEventListener("click", () => {
        editingLocked = !editingLocked;
        saveTemplates();
        render();
    });

    themeBtn.addEventListener("click", () => {
        darkMode = !darkMode;
        saveTemplates();
        render();
    });

}

function init() {
    typeLibrary = generateTypeLibrary();
    loadTemplates();
    wireEvents();
    render();
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