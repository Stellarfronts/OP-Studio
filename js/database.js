console.log("Database page loaded");

const databaseEntries = document.getElementById("databaseEntries");

const databaseSearch = document.getElementById("databaseSearch");

async function loadPublicTypings() {

    const { data, error } = await supabaseClient
        .from("public_typings")
        .select("*")
        .order("created_at", { ascending: false });


    if (error) {
        console.error(error);
        databaseEntries.textContent = "Failed to load public typings.";
        return;
    }


    if (!data || data.length === 0) {
        databaseEntries.textContent = "No published typings yet.";
        return;
    }


    databaseEntries.innerHTML = "";

    const {
    data: { user }
} = await supabaseClient.auth.getUser();

data
.filter((typing) => {

    if (!databaseSearch.value) return true;

    const search = databaseSearch.value.toLowerCase();

    return (
        (typing.title || "").toLowerCase().includes(search) ||
        (typing.username || "").toLowerCase().includes(search)
    );

})
.forEach((typing) => {

        const card = document.createElement("div");
        card.className = "database-entry-card";


card.innerHTML = `
    <div class="typing-card-header">

        <div class="typing-card-user">
            ${typing.username || "Unknown User"}
        </div>

        <div class="typing-card-date">
            ${new Date(typing.created_at).toLocaleDateString()}
        </div>

    </div>

    <h2>${typing.title}</h2>

    <button class="reveal-type-btn">
        Reveal Type
    </button>

    <div class="revealed-type" style="display:none;">
        ${typing.revealed_type || "No type saved"}
    </div>

    <button class="view-typing-btn">
        View Typing
    </button>

    ${user && user.id === typing.user_id ? `
<button class="delete-typing-btn">
    Delete
</button>
` : ""}
`;


        databaseEntries.appendChild(card);
const revealBtn = card.querySelector(".reveal-type-btn");
const revealText = card.querySelector(".revealed-type");

const viewBtn = card.querySelector(".view-typing-btn");

viewBtn.onclick = () => {

    window.location.href = `index.html?view=${typing.id}`;

};

revealBtn.onclick = () => {

    if (revealText.style.display === "none") {

        revealText.style.display = "block";
        revealBtn.textContent = "Hide Type";

    } else {

        revealText.style.display = "none";
        revealBtn.textContent = "Reveal Type";

    }

};

const deleteBtn = card.querySelector(".delete-typing-btn");

if (deleteBtn) {

    deleteBtn.onclick = async () => {

        const confirmed = window.confirm("Delete this typing?");

        if (!confirmed) {
            return;
        }

        const { error } = await supabaseClient
            .from("public_typings")
            .delete()
            .eq("id", typing.id)
            .eq("user_id", user.id);

        if (error) {
            console.error("Delete failed:", error);
            alert("Delete failed: " + error.message);
            return;
        }

        card.remove();

        console.log("Typing deleted.");
    };
}
    });

}


document.addEventListener("DOMContentLoaded", () => {

    loadPublicTypings();

    databaseSearch.addEventListener("input", loadPublicTypings);

});