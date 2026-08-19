console.log("Notifications page loaded");

const notificationsList =
    document.getElementById("notificationsList");

const backToDatabaseBtn =
    document.getElementById("backToDatabaseBtn");

const markAllReadBtn =
    document.getElementById("markAllReadBtn");


async function loadNotifications() {

    notificationsList.textContent =
        "Loading notifications...";

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {

        notificationsList.textContent =
            "Please log in to view your notifications.";

        return;
    }

    const { data, error } = await supabaseClient
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error(
            "Notification load failed:",
            error
        );

        notificationsList.textContent =
            "Unable to load notifications.";

        return;
    }

    const notifications = data || [];

    const actorIds = [
        ...new Set(
            notifications
                .map(notification =>
                    notification.actor_id
                )
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

    renderNotifications(
        notifications,
        profileMap
    );
}


function renderNotifications(
    notifications,
    profileMap = {}
) {

    notificationsList.innerHTML = "";

    if (notifications.length === 0) {

        notificationsList.textContent =
            "No notifications yet.";

        return;
    }

    notifications.forEach(notification => {

        const item =
            document.createElement("button");

        item.type = "button";

        item.className =
            "notification-item";

        if (!notification.read) {
            item.classList.add("unread");
        }

        const username =
            profileMap[notification.actor_id] ||
            "Unknown User";

        const date =
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

                await markNotificationRead(
                    notification.id
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

        return;
    }

    loadNotifications();
}


async function markAllRead() {

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) return;

    const { error } = await supabaseClient
        .from("notifications")
        .update({
            read: true
        })
        .eq("user_id", user.id)
        .eq("read", false);

    if (error) {

        console.error(
            "Mark all notifications read failed:",
            error
        );

        return;
    }

    loadNotifications();
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


if (backToDatabaseBtn) {

    backToDatabaseBtn.addEventListener(
        "click",
        () => {
            window.location.href =
                "database.html";
        }
    );
}


if (markAllReadBtn) {

    markAllReadBtn.addEventListener(
        "click",
        markAllRead
    );
}


document.addEventListener(
    "DOMContentLoaded",
    loadNotifications
);