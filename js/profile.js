console.log("Profile page loaded");

const profileUsername = document.getElementById("profileUsername");
const profileTypings = document.getElementById("profileTypings");
const backToDatabaseBtn = document.getElementById("backToDatabaseBtn");

const profileTypingCount = document.getElementById("profileTypingCount");
const profileFollowerCount = document.getElementById("profileFollowerCount");
const profileFollowingCount = document.getElementById("profileFollowingCount");
const profileFollowBtn = document.getElementById("profileFollowBtn");
const profileMessageBtn =
    document.getElementById("profileMessageBtn");
    const profileMuteBtn =
    document.getElementById("profileMuteBtn");
    const profileBlockBtn =
    document.getElementById("profileBlockBtn");
    const profileTypingNotifyBtn =
    document.getElementById("profileTypingNotifyBtn");
const profileBio = document.getElementById("profileBio");
const profileBioEditor = document.getElementById("profileBioEditor");
const profileBioInput = document.getElementById("profileBioInput");
const saveBioBtn = document.getElementById("saveBioBtn");
let profileUserId = null;
let currentUser = null;


// =========================
// Load Profile
// =========================

async function loadProfile() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user");

    if (!userId) {
        profileUsername.textContent = "User not found";
        profileTypings.textContent = "No user was specified.";
        return;
    }

    profileUserId = userId;

    console.log("Loading profile:", userId);

    // Get currently logged-in user
    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    currentUser = user || null;


    // =========================
    // Load Profile
    // =========================

    const { data: profile, error: profileError } =
    await supabaseClient
        .from("profiles")
        .select("id, username, bio")
            .eq("id", userId)
            .single();

    if (profileError || !profile) {
        console.error("Profile load failed:", profileError);

        profileUsername.textContent = "User not found";
        profileTypings.textContent = "This profile could not be found.";

        return;
    }

    profileUsername.textContent =
        profile.username || "Unknown User";

        // =========================
// Profile Bio
// =========================

if (profileBio) {
    profileBio.textContent =
        profile.bio || "No bio yet.";
}

if (currentUser && currentUser.id === profileUserId) {

    if (profileBioEditor) {
        profileBioEditor.style.display = "block";
    }

    if (profileBioInput) {
        profileBioInput.value =
            profile.bio || "";
    }

} else {

    if (profileBioEditor) {
        profileBioEditor.style.display = "none";
    }
}


    // =========================
    // Load Profile Stats
    // =========================

    await loadProfileStats();


    // =========================
// Follow / Mute Buttons
// =========================

await updateFollowButton();
await updateMuteButton();
await updateBlockButton();
await updateTypingNotifyButton();


// =========================
// Load Published Typings
// =========================

const {
    data: visibleTypings,
    error: typingsError
} = await supabaseClient
    .rpc("get_visible_typings");

const typings = (visibleTypings || [])
    .filter(
        typing =>
            typing.user_id === userId
    )
    .sort(
        (a, b) =>
            new Date(b.created_at) -
            new Date(a.created_at)
    );

    if (typingsError) {
        console.error(
            "Published typings load failed:",
            typingsError
        );

        profileTypings.textContent =
            "Unable to load published typings.";

        return;
    }

    renderProfileTypings(typings || []);
}


// =========================
// Profile Stats
// =========================

async function loadProfileStats() {

    if (!profileUserId) {
        return;
    }


    // Published typings count

    const {
    data: visibleTypings,
    error: typingError
} = await supabaseClient
    .rpc("get_visible_typings");

const typingCount =
    (visibleTypings || []).filter(
        typing =>
            typing.user_id === profileUserId
    ).length;

    if (typingError) {
        console.error(
            "Typing count failed:",
            typingError
        );
    }


    // Followers
    // Other users following this profile

    const {
        count: followerCount,
        error: followerError
    } = await supabaseClient
        .from("follows")
        .select("*", {
            count: "exact",
            head: true
        })
        .eq("following_id", profileUserId);

    if (followerError) {
        console.error(
            "Follower count failed:",
            followerError
        );
    }


    // Following
    // Users this profile follows

    const {
        count: followingCount,
        error: followingError
    } = await supabaseClient
        .from("follows")
        .select("*", {
            count: "exact",
            head: true
        })
        .eq("follower_id", profileUserId);

    if (followingError) {
        console.error(
            "Following count failed:",
            followingError
        );
    }


    if (profileTypingCount) {
        profileTypingCount.textContent =
            typingCount ?? 0;
    }

    if (profileFollowerCount) {
        profileFollowerCount.textContent =
            followerCount ?? 0;
    }

    if (profileFollowingCount) {
        profileFollowingCount.textContent =
            followingCount ?? 0;
    }
}


// =========================
// Detect Follow State
// =========================

async function updateFollowButton() {

    if (!profileFollowBtn || !profileUserId) {
        return;
    }


    // Not logged in

    if (!currentUser) {
        profileFollowBtn.style.display = "none";
        return;
    }


    // Own profile

    if (currentUser.id === profileUserId) {
    profileFollowBtn.style.display = "none";

    if (profileMessageBtn) {
        profileMessageBtn.style.display = "none";
    }

    return;
}


   profileFollowBtn.style.display = "";

if (profileMessageBtn) {
    profileMessageBtn.style.display = "";
}

    const {
        data: existingFollow,
        error
    } = await supabaseClient
        .from("follows")
        .select("id")
        .eq("follower_id", currentUser.id)
        .eq("following_id", profileUserId)
        .maybeSingle();


    if (error) {
        console.error(
            "Follow state check failed:",
            error
        );

        profileFollowBtn.textContent = "Follow";
        return;
    }


    if (existingFollow) {
        profileFollowBtn.textContent = "Unfollow";
        profileFollowBtn.dataset.following = "true";
    } else {
        profileFollowBtn.textContent = "Follow";
        profileFollowBtn.dataset.following = "false";
    }
}


// =========================
// Follow / Unfollow
// =========================

async function startConversation() {
    if (!currentUser || !profileUserId) {
        alert("You must be logged in to send a message.");
        return;
    }

    if (currentUser.id === profileUserId) {
        return;
    }

    const {
    data: usersBlocked,
    error: blockCheckError
} = await supabaseClient.rpc(
    "users_are_blocked",
    {
        user_a: currentUser.id,
        user_b: profileUserId
    }
);

if (blockCheckError) {
    console.error(
        "Block check failed:",
        blockCheckError
    );

    alert(
        "Unable to check block status."
    );

    return;
}

if (usersBlocked) {
    alert(
        "Messaging is unavailable between blocked users."
    );

    return;
}

    profileMessageBtn.disabled = true;

    try {
        // Check whether a conversation already exists
        const { data: myMemberships, error: membershipError } =
            await supabaseClient
                .from("conversation_members")
                .select("conversation_id")
                .eq("user_id", currentUser.id);

        if (membershipError) {
            throw membershipError;
        }

        let existingConversationId = null;

        for (const membership of myMemberships || []) {
            const { data: otherMember, error: otherMemberError } =
                await supabaseClient
                    .from("conversation_members")
                    .select("id")
                    .eq("conversation_id", membership.conversation_id)
                    .eq("user_id", profileUserId)
                    .maybeSingle();

            if (otherMemberError) {
                throw otherMemberError;
            }

            if (otherMember) {
                existingConversationId = membership.conversation_id;
                break;
            }
        }

        // If we already have a conversation, open it
        if (existingConversationId) {
            window.location.href =
                `messages.html?conversation=${encodeURIComponent(
                    existingConversationId
                )}`;

            return;
        }

        // Otherwise create a new conversation
        const { data: conversation, error: conversationError } =
            await supabaseClient
                .from("conversations")
                .insert({})
                .select("id")
                .single();

        if (conversationError) {
            throw conversationError;
        }

        // Add both users to the conversation
        const { error: membersError } =
            await supabaseClient
                .from("conversation_members")
                .insert([
                    {
                        conversation_id: conversation.id,
                        user_id: currentUser.id
                    },
                    {
                        conversation_id: conversation.id,
                        user_id: profileUserId
                    }
                ]);

        if (membersError) {
            throw membersError;
        }

        window.location.href =
            `messages.html?conversation=${encodeURIComponent(
                conversation.id
            )}`;

    } catch (error) {
        console.error(
            "Failed to start conversation:",
            error
        );

        alert(
            "Unable to start conversation: " +
            error.message
        );
    } finally {
        profileMessageBtn.disabled = false;
    }
}

async function updateMuteButton() {

    if (!profileMuteBtn || !profileUserId) {
        return;
    }

    if (!currentUser) {
        profileMuteBtn.style.display = "none";
        return;
    }

    if (currentUser.id === profileUserId) {
        profileMuteBtn.style.display = "none";
        return;
    }

    profileMuteBtn.style.display = "";

    const {
        data: existingMute,
        error
    } = await supabaseClient
        .from("mutes")
        .select("muted_id")
        .eq("muter_id", currentUser.id)
        .eq("muted_id", profileUserId)
        .maybeSingle();

    if (error) {
        console.error(
            "Mute state check failed:",
            error
        );

        profileMuteBtn.textContent = "Mute";
        profileMuteBtn.dataset.muted = "false";
        return;
    }

    if (existingMute) {
        profileMuteBtn.textContent = "Unmute";
        profileMuteBtn.dataset.muted = "true";
    } else {
        profileMuteBtn.textContent = "Mute";
        profileMuteBtn.dataset.muted = "false";
    }
}

async function toggleMute() {

    if (
        !currentUser ||
        !profileUserId ||
        currentUser.id === profileUserId
    ) {
        return;
    }

    const currentlyMuted =
        profileMuteBtn.dataset.muted === "true";

    profileMuteBtn.disabled = true;

    if (currentlyMuted) {

        const { error } = await supabaseClient
            .from("mutes")
            .delete()
            .eq("muter_id", currentUser.id)
            .eq("muted_id", profileUserId);

        if (error) {
            console.error(
                "Unmute failed:",
                error
            );

            profileMuteBtn.disabled = false;
            return;
        }

    } else {

        const { error } = await supabaseClient
            .from("mutes")
            .insert({
                muter_id: currentUser.id,
                muted_id: profileUserId
            });

        if (error) {
            console.error(
                "Mute failed:",
                error
            );

            profileMuteBtn.disabled = false;
            return;
        }
    }

    await updateMuteButton();

    profileMuteBtn.disabled = false;
}

async function updateBlockButton() {

    if (!profileBlockBtn || !profileUserId) {
        return;
    }

    if (!currentUser) {
        profileBlockBtn.style.display = "none";
        return;
    }

    if (currentUser.id === profileUserId) {
        profileBlockBtn.style.display = "none";
        return;
    }

    profileBlockBtn.style.display = "";

    const {
        data: existingBlock,
        error
    } = await supabaseClient
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", currentUser.id)
        .eq("blocked_id", profileUserId)
        .maybeSingle();

    if (error) {
        console.error(
            "Block state check failed:",
            error
        );

        profileBlockBtn.textContent = "Block";
        profileBlockBtn.dataset.blocked = "false";
        return;
    }

    if (existingBlock) {
    profileBlockBtn.textContent = "Unblock";
    profileBlockBtn.dataset.blocked = "true";

    if (profileFollowBtn) {
        profileFollowBtn.style.display = "none";
    }

    if (profileMessageBtn) {
        profileMessageBtn.style.display = "none";
    }

    if (profileMuteBtn) {
        profileMuteBtn.style.display = "none";
    }

} else {
    profileBlockBtn.textContent = "Block";
    profileBlockBtn.dataset.blocked = "false";

    if (profileFollowBtn) {
        profileFollowBtn.style.display = "";
    }

    if (profileMessageBtn) {
        profileMessageBtn.style.display = "";
    }

    if (profileMuteBtn) {
        profileMuteBtn.style.display = "";
    }
}
}

async function toggleBlock() {

    if (
        !currentUser ||
        !profileUserId ||
        currentUser.id === profileUserId
    ) {
        return;
    }

    const currentlyBlocked =
        profileBlockBtn.dataset.blocked === "true";

    profileBlockBtn.disabled = true;

    if (currentlyBlocked) {

        const { error } = await supabaseClient
            .from("blocks")
            .delete()
            .eq("blocker_id", currentUser.id)
            .eq("blocked_id", profileUserId);

        if (error) {
            console.error(
                "Unblock failed:",
                error
            );

            profileBlockBtn.disabled = false;
            return;
        }

    } else {

        const { error } = await supabaseClient
            .from("blocks")
            .insert({
                blocker_id: currentUser.id,
                blocked_id: profileUserId
            });

        if (error) {
            console.error(
                "Block failed:",
                error
            );

            profileBlockBtn.disabled = false;
            return;
        }

        // Remove follow relationship in either direction.
        await supabaseClient
            .from("follows")
            .delete()
            .or(
                `and(follower_id.eq.${currentUser.id},following_id.eq.${profileUserId}),and(follower_id.eq.${profileUserId},following_id.eq.${currentUser.id})`
            );

        // Remove any mute you had for this person.
        await supabaseClient
            .from("mutes")
            .delete()
            .eq("muter_id", currentUser.id)
            .eq("muted_id", profileUserId);
    }

    await updateBlockButton();
    await updateFollowButton();
    await updateMuteButton();
    await loadProfileStats();

    profileBlockBtn.disabled = false;
}

async function updateTypingNotifyButton() {

    if (!profileTypingNotifyBtn || !profileUserId) {
        return;
    }

    if (!currentUser) {
        profileTypingNotifyBtn.style.display = "none";
        return;
    }

    if (currentUser.id === profileUserId) {
        profileTypingNotifyBtn.style.display = "none";
        return;
    }

    profileTypingNotifyBtn.style.display = "";

    const {
        data: existingSubscription,
        error
    } = await supabaseClient
        .from("typing_notification_subscriptions")
        .select("creator_id")
        .eq("subscriber_id", currentUser.id)
        .eq("creator_id", profileUserId)
        .maybeSingle();

    if (error) {
        console.error(
            "Typing notification state check failed:",
            error
        );

        profileTypingNotifyBtn.textContent =
            "Typing Notifications";

        profileTypingNotifyBtn.dataset.subscribed =
            "false";

        return;
    }

    if (existingSubscription) {
        profileTypingNotifyBtn.textContent =
            "Typing Notifications On";

        profileTypingNotifyBtn.dataset.subscribed =
            "true";
    } else {
        profileTypingNotifyBtn.textContent =
            "Typing Notifications";

        profileTypingNotifyBtn.dataset.subscribed =
            "false";
    }
}

async function toggleTypingNotifications() {

    if (
        !currentUser ||
        !profileUserId ||
        currentUser.id === profileUserId
    ) {
        return;
    }

    const currentlySubscribed =
        profileTypingNotifyBtn.dataset.subscribed ===
        "true";

    profileTypingNotifyBtn.disabled = true;

    if (currentlySubscribed) {

        const { error } = await supabaseClient
            .from("typing_notification_subscriptions")
            .delete()
            .eq("subscriber_id", currentUser.id)
            .eq("creator_id", profileUserId);

        if (error) {
            console.error(
                "Typing notification unsubscribe failed:",
                error
            );

            profileTypingNotifyBtn.disabled = false;
            return;
        }

    } else {

        const { error } = await supabaseClient
            .from("typing_notification_subscriptions")
            .insert({
                subscriber_id: currentUser.id,
                creator_id: profileUserId
            });

        if (error) {
            console.error(
                "Typing notification subscribe failed:",
                error
            );

            profileTypingNotifyBtn.disabled = false;
            return;
        }
    }

    await updateTypingNotifyButton();

    profileTypingNotifyBtn.disabled = false;
}

async function toggleFollow() {

    if (!currentUser || !profileUserId) {
        return;
    }

    // Prevent following yourself
    if (currentUser.id === profileUserId) {
        return;
    }

    const {
    data: usersBlocked,
    error: blockCheckError
} = await supabaseClient.rpc(
    "users_are_blocked",
    {
        user_a: currentUser.id,
        user_b: profileUserId
    }
);

if (blockCheckError) {
    console.error(
        "Block check failed:",
        blockCheckError
    );
    return;
}

if (usersBlocked) {
    alert(
        "Following is unavailable between blocked users."
    );
    return;
}

if (profileTypingNotifyBtn) {
    profileTypingNotifyBtn.addEventListener(
        "click",
        toggleTypingNotifications
    );
}

    const currentlyFollowing =
        profileFollowBtn.dataset.following === "true";

    profileFollowBtn.disabled = true;

    if (currentlyFollowing) {

        // =========================
        // UNFOLLOW
        // =========================

        const { error } = await supabaseClient
            .from("follows")
            .delete()
            .eq("follower_id", currentUser.id)
            .eq("following_id", profileUserId);

        if (error) {
            console.error("Unfollow failed:", error);

            alert(
                "Unable to unfollow this user: " +
                error.message
            );

            profileFollowBtn.disabled = false;
            return;
        }

        console.log("Unfollow successful");

    } else {

        // =========================
        // FOLLOW
        // =========================

        const { error } = await supabaseClient
            .from("follows")
            .insert({
                follower_id: currentUser.id,
                following_id: profileUserId
            });

        if (error) {
            console.error("Follow failed:", error);

            alert(
                "Unable to follow this user: " +
                error.message
            );

            profileFollowBtn.disabled = false;
            return;
        }

        console.log("Follow successful");

const {
    data: isMuted,
    error: muteCheckError
} = await supabaseClient.rpc(
    "has_muted",
    {
        recipient_id: profileUserId,
        actor_id: currentUser.id
    }
);

if (muteCheckError) {
    console.error(
        "Mute check failed:",
        muteCheckError
    );
}

if (!isMuted) {

    const { error: notificationError } =
        await supabaseClient
            .from("notifications")
            .insert({
                user_id: profileUserId,
                actor_id: currentUser.id,
                type: "follow",
                read: false
            });

    if (notificationError) {
        console.error(
            "Notification creation failed:",
            notificationError
        );
    } else {
        console.log(
            "Follow notification created."
        );
    }

} else {

    console.log(
        "Follow notification suppressed because user is muted."
    );
}

// Refresh profile counts and button state
await loadProfileStats();
await updateFollowButton();
await updateMuteButton();

profileFollowBtn.disabled = false;
}
}


// =========================
// Published Typings
// =========================

function renderProfileTypings(typings) {

    profileTypings.innerHTML = "";

    if (typings.length === 0) {
        profileTypings.textContent =
            "This user has no published typings yet.";

        return;
    }


    typings.forEach((typing) => {

        const card = document.createElement("div");

        card.className =
            "profile-typing-card";


        const title =
            typing.title || "Untitled Typing";


        const createdDate =
            typing.created_at
                ? new Date(
                    typing.created_at
                ).toLocaleDateString()
                : "";


        card.innerHTML = `
            <h3>
                ${escapeHtml(title)}
            </h3>

            ${
                createdDate
                    ? `
                        <div class="profile-typing-date">
                            ${escapeHtml(createdDate)}
                        </div>
                    `
                    : ""
            }

            <button
                class="profile-view-typing-btn"
                type="button">
                View Typing
            </button>
        `;


        const viewButton =
            card.querySelector(
                ".profile-view-typing-btn"
            );


        viewButton.addEventListener(
            "click",
            () => {
                window.location.href =
                    `index.html?view=${typing.id}`;
            }
        );


        profileTypings.appendChild(card);
    });
}


// =========================
// HTML Safety
// =========================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function saveBio() {

    if (!currentUser || currentUser.id !== profileUserId) {
        return;
    }

    const bio = profileBioInput
        ? profileBioInput.value.trim()
        : "";

    saveBioBtn.disabled = true;

    const { error } = await supabaseClient
        .from("profiles")
        .update({
            bio: bio
        })
        .eq("id", currentUser.id);

    if (error) {

        console.error("Bio save failed:", error);

        alert(
            "Unable to save bio: " +
            error.message
        );

        saveBioBtn.disabled = false;
        return;
    }

    if (profileBio) {
        profileBio.textContent =
            bio || "No bio yet.";
    }

    saveBioBtn.disabled = false;

    console.log("Bio saved successfully.");
}

// =========================
// Buttons
// =========================

if (profileFollowBtn) {

    profileFollowBtn.addEventListener(
        "click",
        toggleFollow
    );
}

if (profileMessageBtn) {
    profileMessageBtn.addEventListener(
        "click",
        startConversation
    );
}

if (profileMuteBtn) {
    profileMuteBtn.addEventListener(
        "click",
        toggleMute
    );
}

if (saveBioBtn) {
    saveBioBtn.addEventListener(
        "click",
        saveBio
    );
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

if (profileBlockBtn) {
    profileBlockBtn.addEventListener(
        "click",
        toggleBlock
    );
}

// =========================
// Start
// =========================

document.addEventListener(
    "DOMContentLoaded",
    loadProfile
);