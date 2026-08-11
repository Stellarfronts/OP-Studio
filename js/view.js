function getTypingIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || '';
}

function renderPublishedTyping(typing) {
    const container = document.getElementById('viewContent');
    if (!container || !typing) return;

    document.getElementById('viewTitle').textContent = typing.title || 'Published Typing';

    const title = document.createElement('h1');
    title.className = 'view-title';
    title.textContent = typing.title || 'Untitled typing';

    const meta = document.createElement('div');
    meta.className = 'view-meta';
    meta.textContent = `Published by ${typing.personName || 'public'}`;

    const notes = document.createElement('div');
    notes.className = 'view-notes';
    notes.textContent = typing.notes || 'No notes';

    const preview = document.createElement('div');
    preview.className = 'view-preview';
    preview.textContent = typing.title || 'Untitled typing';

    const selections = document.createElement('div');
    selections.className = 'view-selections';
    const selectionEntries = Object.entries(typing.selections || {});
    if (!selectionEntries.length) {
        selections.innerHTML = '<div class="view-empty">No selections were recorded for this typing.</div>';
    } else {
        selectionEntries.forEach(([key, value]) => {
            const row = document.createElement('div');
            row.className = 'view-selection-row';
            row.innerHTML = `<strong>${key}</strong><span>${value}</span>`;
            selections.appendChild(row);
        });
    }

    container.innerHTML = '';
    container.appendChild(title);
    container.appendChild(meta);
    container.appendChild(notes);
    container.appendChild(preview);
    container.appendChild(selections);
}

async function loadPublishedTyping() {
    const id = getTypingIdFromUrl();
    const container = document.getElementById('viewContent');
    if (!id) {
        if (container) {
            container.innerHTML = '<div class="view-empty">No typing selected.</div>';
        }
        return;
    }

    try {
        const response = await fetch(`/api/typing/${encodeURIComponent(id)}`);
        const data = await response.json();
        renderPublishedTyping(data.typing);
    } catch (error) {
        if (container) {
            container.innerHTML = '<div class="view-empty">Unable to load this published typing.</div>';
        }
    }
}

document.addEventListener('DOMContentLoaded', loadPublishedTyping);
