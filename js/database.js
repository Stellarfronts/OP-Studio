async function loadDatabaseEntries() {
    const container = document.getElementById('databaseEntries');
    if (!container) return;

    try {
        const response = await fetch('/api/people');
        const data = await response.json();
        const entries = (data.people || []).flatMap(person => (person.typings || []).map(typing => ({ ...typing, name: person.name })));

        if (!entries.length) {
            container.innerHTML = '<div class="database-item"><div class="database-item-title">No published typings yet</div></div>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'database-list';

        entries.forEach(entry => {
            const item = document.createElement('a');
            item.className = 'database-item';
            item.href = `/view.html?id=${encodeURIComponent(entry.id || '')}`;
            item.style.display = 'block';
            item.style.textDecoration = 'none';
            item.style.color = 'inherit';

            const title = document.createElement('div');
            title.className = 'database-item-title';
            title.textContent = entry.title || 'Untitled typing';

            const meta = document.createElement('div');
            meta.className = 'database-item-meta';
            meta.textContent = `${entry.name || 'public'} • ${new Date(entry.publishedAt || Date.now()).toLocaleDateString()}`;

            const notes = document.createElement('div');
            notes.className = 'database-item-meta';
            notes.textContent = entry.notes || '';

            item.appendChild(title);
            item.appendChild(meta);
            item.appendChild(notes);
            list.appendChild(item);
        });

        container.innerHTML = '';
        container.appendChild(list);
    } catch (error) {
        container.innerHTML = '<div class="database-item"><div class="database-item-title">Unable to load entries right now.</div></div>';
    }
}

document.addEventListener('DOMContentLoaded', loadDatabaseEntries);
