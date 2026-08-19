console.log("Messages page loaded");

let conversationId =
    new URLSearchParams(window.location.search).get("conversation");

const conversationList =
    document.getElementById("conversationList");

const chatPanel =
    document.getElementById("chatPanel");

let currentUser = null;
let conversations = [];
let messagesRealtimeChannel = null;

async function loadCurrentUser() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error(
            "Unable to get current user:",
            error
        );

        return null;
    }

    currentUser = user;

    return user;
}

async function loadConversations() {

    if (!conversationList) {
        return;
    }

    const user = await loadCurrentUser();

    if (!user) {

        conversationList.innerHTML = `
            <div class="conversation-empty">
                Please log in to view your messages.
            </div>
        `;

        return;
    }

    conversationList.innerHTML = `
        <div class="conversation-empty">
            Loading conversations...
        </div>
    `;

    const {
        data,
        error
    } = await supabaseClient
        .from("conversation_members")
        .select(`
    conversation_id,
    last_read_at,
    conversations (
        id,
        created_at
    )
`)
        .eq("user_id", user.id);

    if (error) {

        console.error(
            "Conversation load failed:",
            error
        );

        conversationList.innerHTML = `
            <div class="conversation-empty">
                Unable to load conversations.
            </div>
        `;

        return;
    }

    const loadedConversations = data || [];

    conversations = [];

    for (const conversation of loadedConversations) {

        const {
            data: members,
            error: membersError
        } = await supabaseClient
            .from("conversation_members")
            .select("user_id")
            .eq(
                "conversation_id",
                conversation.conversation_id
            )
            .neq(
                "user_id",
                user.id
            );

        if (membersError) {

            console.error(
                "Conversation member lookup failed:",
                membersError
            );

            continue;
        }

        const otherUserId =
            members?.[0]?.user_id || null;

        let username = "Unknown User";

        if (otherUserId) {

            const {
                data: profile,
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .select("username")
                .eq("id", otherUserId)
                .maybeSingle();

            if (profileError) {

                console.error(
                    "Conversation profile lookup failed:",
                    profileError
                );

            } else if (profile?.username) {

                username = profile.username;
            }
        }

        // Get the most recent message
        let lastMessage = null;
        let lastMessageDate = null;

        const {
    data: latestMessage,
    error: latestMessageError
} = await supabaseClient
    .from("messages")
    .select("content, created_at, sender_id")
    .eq(
        "conversation_id",
        conversation.conversation_id
    )
    .order(
        "created_at",
        {
            ascending: false
        }
    )
    .limit(1)
    .maybeSingle();

let hasUnreadMessages = false;

if (
    latestMessage &&
    latestMessage.created_at &&
    conversation.last_read_at
) {
    hasUnreadMessages =
        new Date(latestMessage.created_at) >
        new Date(conversation.last_read_at);
} else if (latestMessage && !conversation.last_read_at) {
    // If the user has never opened this conversation,
    // treat messages from the other person as unread.
    hasUnreadMessages =
        latestMessage.sender_id !== user.id;
}

        if (latestMessageError) {

            console.error(
                "Latest message lookup failed:",
                latestMessageError
            );

        } else if (latestMessage) {

            lastMessage =
                latestMessage.content || "";

            lastMessageDate =
                latestMessage.created_at || null;
        }

        conversations.push({
    ...conversation,
    otherUserId,
    username,
    lastMessage,
    lastMessageDate,
    hasUnreadMessages
});
    }

    conversations.sort((a, b) => {
    const aDate =
        a.lastMessageDate ||
        a.conversations?.created_at ||
        0;

    const bDate =
        b.lastMessageDate ||
        b.conversations?.created_at ||
        0;

    return new Date(bDate) - new Date(aDate);
});

    renderConversations();
}

async function loadSelectedConversation() {
    if (!conversationId) {
        return;
    }

    console.log(
        "Loading conversation:",
        conversationId
    );

    markConversationRead(conversationId);

    // Make sure the current user is logged in
    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        return;
    }

    // Verify that the current user belongs to this conversation
    const {
        data: membership,
        error: membershipError
    } = await supabaseClient
        .from("conversation_members")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (membershipError) {
        console.error(
            "Conversation membership check failed:",
            membershipError
        );
        return;
    }

    if (!membership) {
        console.error(
            "You are not a member of this conversation."
        );
        return;
    }

    console.log(
        "Conversation membership verified."
    );

    const messageForm =
    document.getElementById("messageForm");

if (messageForm) {
    messageForm.style.display = "";
}

    // Load messages
    const {
        data: messages,
        error: messagesError
    } = await supabaseClient
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", {
            ascending: true
        });

    if (messagesError) {
        console.error(
            "Messages load failed:",
            messagesError
        );
        return;
    }

    console.log(
        "Messages loaded:",
        messages
    );

    renderMessages(messages || []);
}

function renderMessages(messages) {
    const messageList =
        document.getElementById("messageList");

    if (!messageList) {
        return;
    }

    if (messages.length === 0) {
        messageList.innerHTML = `
            <div class="conversation-empty">
                No messages yet.
            </div>
        `;
        return;
    }

    messageList.innerHTML = "";

    messages.forEach(message => {
        const item =
            document.createElement("div");

        const isMine =
            currentUser &&
            message.sender_id === currentUser.id;

        item.className =
            isMine
                ? "message-item message-mine"
                : "message-item message-theirs";

        const messageDate =
            message.created_at
                ? new Date(
                    message.created_at
                ).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit"
                })
                : "";

        item.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">
                    ${escapeHtml(message.content)}
                </div>

                ${
                    messageDate
                        ? `<div class="message-date">
                            ${escapeHtml(messageDate)}
                        </div>`
                        : ""
                }
            </div>
        `;

        messageList.appendChild(item);
    });

    messageList.scrollTop =
        messageList.scrollHeight;
}

async function sendMessage(event) {
    event.preventDefault();

    if (!conversationId) {
        return;
    }

    const messageInput =
        document.getElementById("messageInput");

    if (!messageInput) {
        return;
    }

    const content = messageInput.value.trim();

    if (!content) {
        return;
    }

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        alert("Please log in to send messages.");
        return;
    }

    const sendMessageBtn =
        document.getElementById("sendMessageBtn");

    if (sendMessageBtn) {
        sendMessageBtn.disabled = true;
    }

    const conversation =
    conversations.find(
        item =>
            item.conversation_id ===
            conversationId
    );

if (conversation?.otherUserId) {

    const {
        data: usersBlocked,
        error: blockCheckError
    } = await supabaseClient.rpc(
        "users_are_blocked",
        {
            user_a: user.id,
            user_b: conversation.otherUserId
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

        if (sendMessageBtn) {
            sendMessageBtn.disabled = false;
        }

        return;
    }

    if (usersBlocked) {
        alert(
            "Messaging is unavailable between blocked users."
        );

        if (sendMessageBtn) {
            sendMessageBtn.disabled = false;
        }

        return;
    }
}

    const { data: newMessage, error } =
        await supabaseClient
            .from("messages")
            .insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: content
            })
            .select()
            .single();

    if (error) {
        console.error(
            "Message send failed:",
            error
        );

        alert(
            "Unable to send message: " +
            error.message
        );

        if (sendMessageBtn) {
            sendMessageBtn.disabled = false;
        }

        return;
    }

    console.log(
        "Message sent:",
        newMessage
    );

    messageInput.value = "";

    // Notify the other person that a new message was sent

if (conversation?.otherUserId) {

    const {
        data: isMuted,
        error: muteCheckError
    } = await supabaseClient.rpc(
        "has_muted",
        {
            recipient_id: conversation.otherUserId,
            actor_id: user.id
        }
    );

    if (muteCheckError) {
        console.error(
            "Mute check failed:",
            muteCheckError
        );
    }

    if (!isMuted) {

        const {
            data: existingNotification,
            error: existingNotificationError
        } = await supabaseClient
            .from("notifications")
            .select("id")
            .eq(
                "user_id",
                conversation.otherUserId
            )
            .eq("type", "message")
            .eq(
                "conversation_id",
                conversationId
            )
            .eq("read", false)
            .limit(1)
            .maybeSingle();

        if (existingNotificationError) {
            console.error(
                "Message notification lookup failed:",
                existingNotificationError
            );
        }

        let notificationError = null;

        if (existingNotification) {

            const { error } =
                await supabaseClient
                    .from("notifications")
                    .update({
                        actor_id: user.id,
                        created_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        existingNotification.id
                    );

            notificationError = error;

        } else {

            const { error } =
                await supabaseClient
                    .from("notifications")
                    .insert({
                        user_id:
                            conversation.otherUserId,
                        actor_id: user.id,
                        type: "message",
                        conversation_id:
                            conversationId,
                        read: false
                    });

            notificationError = error;
        }

        if (notificationError) {
            console.error(
                "Message notification creation failed:",
                notificationError
            );
        } else {
            console.log(
                existingNotification
                    ? "Message notification refreshed."
                    : "Message notification created."
            );
        }

    } else {

        console.log(
            "Message notification suppressed because user is muted."
        );
    }
}

    await loadSelectedConversation();

    if (sendMessageBtn) {
        sendMessageBtn.disabled = false;
    }
}

function renderConversations() {

    if (!conversationList) {
        return;
    }

    if (conversations.length === 0) {

        conversationList.innerHTML = `
            <div class="conversation-empty">
                No conversations yet.
            </div>
        `;

        return;
    }

    conversationList.innerHTML = "";

    conversations.forEach(conversation => {

        const item =
            document.createElement("button");

        item.type = "button";
        item.className = "conversation-item";

        const lastMessage =
            conversation.lastMessage ||
            "No messages yet.";

        const lastMessageDate =
    formatMessageDate(
        conversation.lastMessageDate
    );

        item.innerHTML = `
            <div class="conversation-name">
    ${escapeHtml(
        conversation.username ||
        "Unknown User"
    )}

    ${
        conversation.hasUnreadMessages
            ? `<span class="conversation-unread-dot"></span>`
            : ""
    }
</div>

            <div class="conversation-preview">
                ${escapeHtml(lastMessage)}
            </div>

            ${
                lastMessageDate
                    ? `
                        <div class="conversation-date">
                            ${escapeHtml(
                                lastMessageDate
                            )}
                        </div>
                    `
                    : ""
            }
        `;

        item.addEventListener(
            "click",
            () => {
                openConversation(
                    conversation.conversation_id
                );
            }
        );

        conversationList.appendChild(item);

    });
}

function openConversation(selectedConversationId) {

    if (!chatPanel) {
        return;
    }

    conversationId = selectedConversationId;

    const conversation =
        conversations.find(
            item =>
                item.conversation_id ===
                selectedConversationId
        );

    const username =
        conversation?.username ||
        "Unknown User";

    chatPanel.innerHTML = `

        <div class="chat-header">

            <div class="chat-header-info">

                <h2>
                    ${escapeHtml(username)}
                </h2>

                ${
                    conversation?.otherUserId
                        ? `
                            <button
                                type="button"
                                class="chat-profile-btn"
                                id="chatProfileBtn">
                                View Profile
                            </button>
                        `
                        : ""
                }

            </div>

        </div>

        <div
            id="messageList"
            class="message-list">

            <div class="conversation-empty">
                Loading messages...
            </div>

        </div>

        <form
            id="messageForm"
            class="message-form">

            <input
                id="messageInput"
                type="text"
                placeholder="Write a message..."
                autocomplete="off">

            <button
                id="sendMessageBtn"
                type="submit">
                Send
            </button>

        </form>

    `;

    console.log(
        "Opened conversation:",
        selectedConversationId
    );

    const chatProfileBtn =
        document.getElementById("chatProfileBtn");

    if (chatProfileBtn && conversation?.otherUserId) {

        chatProfileBtn.addEventListener(
            "click",
            () => {

                window.location.href =
                    `profile.html?user=${encodeURIComponent(
                        conversation.otherUserId
                    )}`;

            }
        );
    }

    const messageForm =
        document.getElementById("messageForm");

    if (messageForm) {

        messageForm.addEventListener(
            "submit",
            sendMessage
        );
    }

    loadSelectedConversation();
}

function subscribeToRealtimeMessages() {
    if (messagesRealtimeChannel) {
        return;
    }

    messagesRealtimeChannel = supabaseClient
        .channel("messages-realtime")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages"
            },
            async payload => {
                const newMessage = payload.new;

                console.log(
                    "Realtime message received:",
                    newMessage
                );

                await loadConversations();

                if (
                    conversationId &&
                    String(newMessage.conversation_id) ===
                        String(conversationId) &&
                    newMessage.sender_id !== currentUser?.id
                ) {
                    await loadSelectedConversation();
                }
            }
        )
        .subscribe(status => {
            console.log(
                "Messages realtime status:",
                status
            );
        });
}

async function markConversationRead(conversationId) {

    const user = await loadCurrentUser();

    if (!user || !conversationId) {
        return;
    }

    const { error } = await supabaseClient
        .from("conversation_members")
        .update({
            last_read_at: new Date().toISOString()
        })
        .eq(
            "conversation_id",
            conversationId
        )
        .eq(
            "user_id",
            user.id
        );

    if (error) {
        console.error(
            "Failed to mark conversation as read:",
            error
        );

        return;
    }

    const conversation =
        conversations.find(
            item =>
                item.conversation_id ===
                conversationId
        );

    if (conversation) {
        conversation.hasUnreadMessages = false;
    }

    renderConversations();
}

function formatMessageDate(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);
    const now = new Date();

    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const startOfMessageDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    const dayDifference = Math.round(
        (startOfToday - startOfMessageDay) /
        (1000 * 60 * 60 * 24)
    );

    if (dayDifference === 0) {
    const time = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    return `Today, ${time}`;
}

    if (dayDifference === 1) {
    const time = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    return `Yesterday, ${time}`;
}

    if (dayDifference < 7) {
        return date.toLocaleDateString([], {
            weekday: "long"
        });
    }

    return date.toLocaleDateString();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


document.addEventListener("DOMContentLoaded", async () => {
    await loadConversations();

    subscribeToRealtimeMessages();

    const messageForm =
        document.getElementById("messageForm");

    if (messageForm) {
        messageForm.addEventListener(
            "submit",
            sendMessage
        );
    }

    if (conversationId) {
    openConversation(conversationId);
}
});