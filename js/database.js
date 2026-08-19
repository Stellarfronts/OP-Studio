console.log("Database page loaded");

const databaseEntries = document.getElementById("databaseEntries");
const databaseSearch = document.getElementById("databaseSearch");
const databaseSort = document.getElementById("databaseSort");
const databaseTypeFilter = document.getElementById("databaseTypeFilter");
const databasePossibilitiesFilter = document.getElementById("databasePossibilitiesFilter");
const databaseDateFilter = document.getElementById("databaseDateFilter");
const clearDatabaseFilters = document.getElementById("clearDatabaseFilters");

const notificationsBtn =
    document.getElementById("notificationsBtn");

const notificationBadge =
    document.getElementById("notificationBadge");

const notificationsPanel =
    document.getElementById("notificationsPanel");

const notificationsList =
    document.getElementById("notificationsList");

const closeNotificationsBtn =
    document.getElementById("closeNotificationsBtn");

let publicTypings = [];
let currentUser = null;
let userNotifications = [];

async function loadNotifications() {
    if (!notificationsList) {
        return;
    }

    if (!currentUser) {
        notificationsList.innerHTML = `
            <div class="notification-empty">
                Log in to see your notifications.
            </div>
        `;

        updateNotificationBadge();
        return;
    }

    notificationsList.textContent = "Loading notifications...";

    const { data: notifications, error } =
        await supabaseClient
            .from("notifications")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

    if (error) {
        console.error(
            "Notification load failed:",
            error
        );

        notificationsList.innerHTML = `
            <div class="notification-empty">
                Unable to load notifications.
            </div>
        `;

        return;
    }

    userNotifications = notifications || [];

    const actorIds = [
        ...new Set(
            userNotifications
                .map(notification => notification.actor_id)
                .filter(Boolean)
        )
    ];

    let profiles = [];

    if (actorIds.length > 0) {
        const {
            data: profileData,
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
        } else {
            profiles = profileData || [];
        }
    }

    const profileMap = {};

    profiles.forEach(profile => {
        profileMap[profile.id] =
            profile.username || "Unknown User";
    });

    renderNotifications(profileMap);
}


function renderNotifications(profileMap = {}) {
    if (!notificationsList) {
        return;
    }

    notificationsList.innerHTML = "";

    if (userNotifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="notification-empty">
                No notifications yet.
            </div>
        `;

        updateNotificationBadge();
        return;
    }

    userNotifications.forEach(notification => {
        const item =
            document.createElement("button");

        item.type = "button";
        item.className = "notification-item";

        if (!notification.read) {
            item.classList.add("unread");
        }

        const username =
            profileMap[notification.actor_id] ||
            "Unknown User";

        const createdDate =
            notification.created_at
                ? new Date(
                    notification.created_at
                ).toLocaleString()
                : "";

        let message =
    "You have a new notification.";

if (notification.type === "follow") {
    message =
        `${username} followed you`;
}

if (notification.type === "message") {
    message =
        `${username} sent you a message`;
}

if (notification.type === "typing_published") {
    message =
        `${username} published a new typing`;
}

        item.innerHTML = `
            <div class="notification-message">
                ${escapeHtml(message)}
            </div>

            ${
                createdDate
                    ? `<div class="notification-date">
                        ${escapeHtml(createdDate)}
                    </div>`
                    : ""
            }
        `;

        item.addEventListener(
            "click",
            async () => {

                await markNotificationRead(
                    notification
                );

                if (
    notification.type === "follow" &&
    notification.actor_id
) {
    window.location.href =
        `profile.html?user=${encodeURIComponent(
            notification.actor_id
        )}`;

    return;
}

if (
    notification.type === "message" &&
    notification.conversation_id
) {
    window.location.href =
        `messages.html?conversation=${encodeURIComponent(
            notification.conversation_id
        )}`;

    return;
}

if (
    notification.type === "typing_published" &&
    notification.typing_id
) {
    window.location.href =
        `index.html?view=${encodeURIComponent(
            notification.typing_id
        )}`;

    return;
}

            }
        );

        notificationsList.appendChild(item);
    });

    updateNotificationBadge();
}

function updateNotificationBadge() {
    if (!notificationsBtn) {
        return;
    }

    const unreadCount = userNotifications.filter(
        notification => !notification.read
    ).length;

    if (!notificationBadge) {
        return;
    }

    if (unreadCount === 0) {
        notificationBadge.style.display = "none";
        return;
    }

    notificationBadge.style.display = "inline-flex";

    notificationBadge.textContent =
        unreadCount > 99 ? "99+" : String(unreadCount);
}


async function markNotificationRead(notification) {
    if (!notification || notification.read) {
        return;
    }

    const { error } = await supabaseClient
        .from("notifications")
        .update({ read: true })
        .eq("id", notification.id)
        .eq("user_id", currentUser.id);

    if (error) {
        console.error(
            "Failed to mark notification as read:",
            error
        );

        return;
    }

    notification.read = true;

    renderNotifications();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeSpecialLetterDatabase(special) {
    if (!special) return "";

    return String(special)
        .replace(/[()]/g, "")
        .trim();
}

function buildDatabaseFirstPair(selections) {
    const { od, fSmS, fDeMDe } = selections;

    if (!od || !fSmS || !fDeMDe) return "";

    const left = fSmS === "mS" ? "M" : "F";
    const right = fDeMDe === "mDe" ? "M" : "F";

    return od === "D" ? `${right}${left}` : `${left}${right}`;
}

function buildDatabaseStyleSegment(selections) {
    const {
        ft,
        diDe,
        ns,
        oiOe = "Oi",
        od = "O"
    } = selections;

    if (!ft || !diDe || !ns || !oiOe || !od) {
        return "";
    }

    const base =
        ft === "F" && diDe === "Di" ? "Fi" :
        ft === "F" && diDe === "De" ? "Fe" :
        ft === "T" && diDe === "Di" ? "Ti" :
        ft === "T" && diDe === "De" ? "Te" :
        "Fi";

    const second =
        oiOe === "Oe"
            ? (ns === "N" ? "Ne" : "Se")
            : (oiOe === "Oi"
                ? (ns === "N" ? "Ni" : "Si")
                : (ns === "N" ? "Ni" : "Se"));

    return od === "D"
        ? `${second}/${base}`
        : `${base}/${second}`;
}

function buildDatabaseAxisSegment(selections) {
    const {
        cb,
        sp,
        special
    } = selections;

    const specialLetter = normalizeSpecialLetterDatabase(special);

    if (!cb || !sp || !specialLetter) {
        return "";
    }

    if (!["C", "B"].includes(cb) || !["S", "P"].includes(sp)) {
        return "";
    }

    const oppositeSp = sp === "S" ? "P" : "S";

    return `${cb}${sp}/${oppositeSp}(${specialLetter})`;
}

function buildDatabaseNumberCode(selections) {
    const {
        numOneFour,
        numTwoThree
    } = selections;

    if (!numOneFour || !numTwoThree) {
        return "";
    }

    const values = [numOneFour, numTwoThree];

    if (values.includes("#1") && values.includes("#2")) return "#1";
    if (values.includes("#1") && values.includes("#3")) return "#3";
    if (values.includes("#2") && values.includes("#4")) return "#2";
    if (values.includes("#3") && values.includes("#4")) return "#4";

    return "#1";
}

function buildDatabaseTypeLabel(selections = {}) {
    const firstPair = buildDatabaseFirstPair(selections);
    const styleSegment = buildDatabaseStyleSegment(selections);
    const axisSegment = buildDatabaseAxisSegment(selections);
    const numberCode = buildDatabaseNumberCode(selections);

    if (!firstPair || !styleSegment || !axisSegment || !numberCode) {
        return "";
    }

    return `${firstPair} ${styleSegment} ${axisSegment} ${numberCode}`.trim();
}

function getPossibilityCount(typing) {
    const value = typing.possibilities;

    if (typeof value === "number") {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }

    // Some older/newer typings may store this inside data.
    const data = typing.data || {};

    if (typeof data.possibilities === "number") {
        return data.possibilities;
    }

    if (typeof data.possibilities === "string") {
        const parsed = Number(data.possibilities);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }

    return null;
}

function getTypingType(typing) {
    return (
        typing.revealed_type ||
        typing.data?.revealed_type ||
        ""
    ).trim();
}

function matchesPossibilitiesFilter(typing) {
    const filter = databasePossibilitiesFilter?.value || "all";

    if (filter === "all") {
        return true;
    }

    const count = getPossibilityCount(typing);

    if (count === null) {
        return false;
    }

    switch (filter) {
        case "1":
            return count === 1;

        case "2-5":
            return count >= 2 && count <= 5;

        case "6-10":
            return count >= 6 && count <= 10;

        case "11-20":
            return count >= 11 && count <= 20;

        case "21+":
            return count >= 21;

        default:
            return true;
    }
}

function matchesDateFilter(typing) {
    const filter = databaseDateFilter?.value || "all";

    if (filter === "all") {
        return true;
    }

    if (!typing.created_at) {
        return false;
    }

    const created = new Date(typing.created_at);
    const now = new Date();

    switch (filter) {
        case "today": {
            return (
                created.getFullYear() === now.getFullYear() &&
                created.getMonth() === now.getMonth() &&
                created.getDate() === now.getDate()
            );
        }

        case "week": {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            return created >= cutoff;
        }

        case "month": {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - 1);
            return created >= cutoff;
        }

        case "year": {
            const cutoff = new Date();
            cutoff.setFullYear(cutoff.getFullYear() - 1);
            return created >= cutoff;
        }

        default:
            return true;
    }
}

function updateTypeFilter() {
    if (!databaseTypeFilter) {
        return;
    }

    const currentValue = databaseTypeFilter.value;

    const types = [...new Set(
        publicTypings
            .map(getTypingType)
            .filter(type => type)
    )].sort((a, b) => a.localeCompare(b));

    databaseTypeFilter.innerHTML = `
        <option value="all">All Types</option>
    `;

    types.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        databaseTypeFilter.appendChild(option);
    });

    if (types.includes(currentValue)) {
        databaseTypeFilter.value = currentValue;
    }
}

function getSortValue(typing) {
    const sort = databaseSort?.value || "newest";

    switch (sort) {
        case "username-asc":
        case "username-desc":
            return (typing.username || "Unknown User").toLowerCase();

        case "title-asc":
        case "title-desc":
            return (typing.title || "Untitled Typing").toLowerCase();

        case "oldest":
        case "newest":
        default:
            return new Date(typing.created_at || 0).getTime();
    }
}

function sortTypings(typings) {
    const sort = databaseSort?.value || "newest";

    return [...typings].sort((a, b) => {
        if (sort === "username-asc") {
            return getSortValue(a).localeCompare(getSortValue(b));
        }

        if (sort === "username-desc") {
            return getSortValue(b).localeCompare(getSortValue(a));
        }

        if (sort === "title-asc") {
            return getSortValue(a).localeCompare(getSortValue(b));
        }

        if (sort === "title-desc") {
            return getSortValue(b).localeCompare(getSortValue(a));
        }

        if (sort === "oldest") {
            return getSortValue(a) - getSortValue(b);
        }

        return getSortValue(b) - getSortValue(a);
    });
}


async function markNotificationRead(
    notificationId
) {
    const { error } = await supabaseClient
        .from("notifications")
        .update({
            read: true
        })
        .eq("id", notificationId);

    if (error) {
        console.error(
            "Mark notification read failed:",
            error
        );

        return false;
    }

    return true;
}


function updateNotificationBadge(count) {
    if (!notificationBadge) return;

    if (count > 0) {
        notificationBadge.textContent =
            count > 99 ? "99+" : String(count);

        notificationBadge.style.display =
            "inline-flex";
    } else {
        notificationBadge.style.display =
            "none";
    }
}

function getFilteredTypings() {
    const search = (databaseSearch?.value || "")
        .trim()
        .toLowerCase();

    const selectedType =
        databaseTypeFilter?.value || "all";

    const filtered = publicTypings.filter((typing) => {
        const title = (typing.title || "").toLowerCase();
        const username = (typing.username || "").toLowerCase();

        // Search
        if (
            search &&
            !title.includes(search) &&
            !username.includes(search)
        ) {
            return false;
        }

        // Type
        if (selectedType !== "all") {
            if (getTypingType(typing) !== selectedType) {
                return false;
            }
        }

        // Possibilities
        if (!matchesPossibilitiesFilter(typing)) {
            return false;
        }

        // Date
        if (!matchesDateFilter(typing)) {
            return false;
        }

        return true;
    });

    return sortTypings(filtered);
}

function renderPublicTypings() {
    databaseEntries.innerHTML = "";

    const typings = getFilteredTypings();

    if (typings.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "database-empty-state";

        const hasFilters =
            (databaseSearch?.value || "").trim() ||
            (databaseTypeFilter?.value || "all") !== "all" ||
            (databasePossibilitiesFilter?.value || "all") !== "all" ||
            (databaseDateFilter?.value || "all") !== "all";

        emptyState.textContent = publicTypings.length === 0
            ? "No published typings yet."
            : hasFilters
                ? "No typings match your filters."
                : "No published typings yet.";

        databaseEntries.appendChild(emptyState);
        return;
    }

    typings.forEach((typing) => {
        const card = document.createElement("div");
        card.className = "database-entry-card";

        const username = typing.username || "Unknown User";
        const title = typing.title || "Untitled Typing";
const isUnlisted =
    typing.visibility === "unlisted";

        const createdDate = typing.created_at
            ? new Date(typing.created_at).toLocaleDateString()
            : "Unknown date";

const wasUpdated =
    Boolean(
        typing.updated_at &&
        typing.created_at &&
        (
            new Date(
                typing.updated_at
            ).getTime() -
            new Date(
                typing.created_at
            ).getTime()
        ) > 2000
    );

const updatedDate =
    wasUpdated
        ? new Date(
            typing.updated_at
        ).toLocaleString()
        : "";

        const possibilityCount = getPossibilityCount(typing);
        const typingType = getTypingType(typing);

        card.innerHTML = `
            <div class="typing-card-header">

                <button
                    class="typing-card-user"
                    type="button">
                    ${escapeHtml(username)}
                </button>

                <div class="typing-card-date">
                    ${escapeHtml(createdDate)}
                </div>

                ${
    wasUpdated
        ? `
            <div
                class="typing-card-updated"
                title="Last updated ${escapeHtml(
                    updatedDate
                )}">
                ↻ Updated ${escapeHtml(
                    updatedDate
                )}
            </div>
        `
        : ""
}

            </div>

            <h2>${escapeHtml(title)}</h2>

            ${
    isUnlisted
        ? `<div class="typing-visibility-label">
            Unlisted
           </div>`
        : ""
}

            <div class="typing-card-info">
    ${possibilityCount !== null
        ? `<span>${possibilityCount} result${possibilityCount === 1 ? "" : "s"}</span>`
        : ""}
</div>

        <button class="reveal-type-btn" type="button">
    Reveal Type
</button>

            <button class="view-typing-btn" type="button">
                View Typing
            </button>

            ${
    currentUser && currentUser.id === typing.user_id
        ? `
            ${
                isUnlisted
                    ? `
                        <button
                            class="manage-typing-access-btn"
                            type="button">
                            Manage Access
                        </button>
                    `
                    : ""
            }

            <button
                class="delete-typing-btn"
                type="button">
                Unpublish
            </button>
        `
        : ""
}
        `;

        databaseEntries.appendChild(card);

        // Username
        const userBtn = card.querySelector(".typing-card-user");

        userBtn.onclick = () => {
    const userId = typing.user_id;

    if (!userId) {
        return;
    }

    console.log("Opening user profile:", userId);

    window.location.href = `profile.html?user=${encodeURIComponent(userId)}`;
};

       // Reveal type
const revealBtn = card.querySelector(".reveal-type-btn");

revealBtn.onclick = () => {
    const selections = typing.data?.selections || {};

   const finalType =
    typing.revealed_type ||
    typing.data?.revealed_type ||
    buildDatabaseTypeLabel(selections) ||
    "";

    if (!finalType) {
        return;
    }

    if (revealBtn.dataset.revealed === "true") {
        revealBtn.textContent = "Reveal Type";
        revealBtn.dataset.revealed = "false";
    } else {
        revealBtn.textContent = finalType;
        revealBtn.dataset.revealed = "true";
    }
};

        // View typing
        const viewBtn = card.querySelector(".view-typing-btn");

        viewBtn.onclick = () => {
            window.location.href = `index.html?view=${typing.id}`;
        };

        const manageAccessBtn =
    card.querySelector(
        ".manage-typing-access-btn"
    );

if (manageAccessBtn) {
    manageAccessBtn.onclick = () => {
        openDatabaseAccessManager(
            typing.id
        );
    };
}

        // Delete own typing
        const deleteBtn = card.querySelector(".delete-typing-btn");

        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                const confirmed = window.confirm(
    "Unpublish this typing?"
);

                if (!confirmed) {
                    return;
                }

                const { error } = await supabaseClient
                    .from("public_typings")
                    .delete()
                    .eq("id", typing.id)
                    .eq("user_id", currentUser.id);

                if (error) {
                    console.error("Delete failed:", error);
                    alert("Delete failed: " + error.message);
                    return;
                }

                publicTypings = publicTypings.filter(
                    item => item.id !== typing.id
                );

                const saved = JSON.parse(
                    localStorage.getItem("opsTypingTemplates") ||
                    '{"templates":[],"folders":[],"trash":[],"activeTemplateId":null}'
                );

                saved.templates = (saved.templates || []).map(
                    (template) => {
                        if (template.publicTypingId === typing.id) {
                            return {
                                ...template,
                                publicTypingId: null
                            };
                        }

                        return template;
                    }
                );

                localStorage.setItem(
                    "opsTypingTemplates",
                    JSON.stringify(saved)
                );

                renderPublicTypings();

                console.log("Typing deleted.");
            };
        }
    });
}

async function openDatabaseAccessManager(
    typingId
) {
    if (!currentUser || !typingId) {
        return;
    }

    const {
        data: profiles,
        error: profilesError
    } = await supabaseClient
        .from("profiles")
        .select("id, username")
        .neq("id", currentUser.id)
        .order("username", {
            ascending: true
        });

    if (profilesError) {
        console.error(
            "Profile lookup failed:",
            profilesError
        );

        alert(
            "Unable to load users."
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

        alert(
            "Unable to load access."
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
                    id="closeTypingAccessBtn"
                    type="button">
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
                    id="saveTypingAccessBtn"
                    type="button">
                    Save Access
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(
        overlay
    );

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

        const normalized =
            search
                .trim()
                .toLowerCase();

        const filtered =
            (profiles || []).filter(
                profile =>
                    (
                        profile.username ||
                        "Unknown User"
                    )
                        .toLowerCase()
                        .includes(normalized)
            );

        if (filtered.length === 0) {
            usersContainer.innerHTML =
                "<div>No users found.</div>";

            return;
        }

        filtered.forEach(profile => {
            const row =
                document.createElement(
                    "label"
                );

            row.className =
                "typing-access-user";

            const username =
                profile.username ||
                "Unknown User";

            const checkbox =
                document.createElement(
                    "input"
                );

            checkbox.type = "checkbox";
            checkbox.value = profile.id;
            checkbox.checked =
                selectedIds.has(
                    profile.id
                );

            const label =
                document.createElement(
                    "span"
                );

            label.textContent =
                username;

            row.appendChild(checkbox);
            row.appendChild(label);

            usersContainer.appendChild(
                row
            );
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
            if (
                event.target === overlay
            ) {
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
                    usersContainer
                        .querySelectorAll(
                            'input[type="checkbox"]:checked'
                        )
                ).map(
                    checkbox =>
                        checkbox.value
                );

            const {
                error: deleteError
            } = await supabaseClient
                .from(
                    "public_typing_access"
                )
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

                saveBtn.disabled =
                    false;

                return;
            }

            if (
                checkedIds.length > 0
            ) {
                const rows =
                    checkedIds.map(
                        viewerId => ({
                            typing_id:
                                typingId,
                            viewer_id:
                                viewerId
                        })
                    );

                const {
                    error: insertError
                } = await supabaseClient
                    .from(
                        "public_typing_access"
                    )
                    .insert(rows);

                if (insertError) {
                    console.error(
                        "Access save failed:",
                        insertError
                    );

                    saveBtn.disabled =
                        false;

                    return;
                }
            }

            overlay.remove();

            console.log(
                "Unlisted access updated."
            );
        }
    );
}

async function loadPublicTypings() {
    databaseEntries.textContent = "Loading public entries...";

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    currentUser = user || null;

    const { data, error } = await supabaseClient
    .rpc("get_visible_typings");

    if (error) {
        console.error(error);

        databaseEntries.textContent =
            "Failed to load public typings.";

        return;
    }

   publicTypings = (data || []).sort(
    (a, b) =>
        new Date(b.created_at) -
        new Date(a.created_at)
);

    updateTypeFilter();
    renderPublicTypings();
}

document.addEventListener("DOMContentLoaded", () => {
    loadPublicTypings();

    if (notificationsBtn) {
    notificationsBtn.addEventListener("click", async () => {
        if (!notificationsPanel) {
            return;
        }

        notificationsPanel.classList.toggle("open");

        if (notificationsPanel.classList.contains("open")) {
            await loadNotifications();
        }
    });
}

if (closeNotificationsBtn) {
    closeNotificationsBtn.addEventListener("click", () => {
        if (notificationsPanel) {
            notificationsPanel.classList.remove("open");
        }
    });
}


    if (databaseSearch) {
        databaseSearch.addEventListener(
            "input",
            renderPublicTypings
        );
    }

    if (databaseSort) {
        databaseSort.addEventListener(
            "change",
            renderPublicTypings
        );
    }

    if (databaseTypeFilter) {
        databaseTypeFilter.addEventListener(
            "change",
            renderPublicTypings
        );
    }

    if (databasePossibilitiesFilter) {
        databasePossibilitiesFilter.addEventListener(
            "change",
            renderPublicTypings
        );
    }

    if (databaseDateFilter) {
        databaseDateFilter.addEventListener(
            "change",
            renderPublicTypings
        );
    }

    if (clearDatabaseFilters) {
        clearDatabaseFilters.addEventListener(
            "click",
            () => {
                if (databaseSearch) {
                    databaseSearch.value = "";
                }

                if (databaseSort) {
                    databaseSort.value = "newest";
                }

                if (databaseTypeFilter) {
                    databaseTypeFilter.value = "all";
                }

                if (databasePossibilitiesFilter) {
                    databasePossibilitiesFilter.value = "all";
                }

                if (databaseDateFilter) {
                    databaseDateFilter.value = "all";
                }

                renderPublicTypings();
            }
        );
    }
});