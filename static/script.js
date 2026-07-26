let currentActiveChannel = null;
let currentPlayingChannelId = null;
let isSwitchingChannel = false;
let infobarTimer = null;
let hideTimer = null;
let cachedChannels = [];
let cachedEpgEvents = {};

// Uhrzeit in der Infobar laufend aktualisieren
setInterval(() => {
    const clockEl = document.getElementById('infoClock');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}, 1000);

// Hilfsfunktion: Formatierung von UNIX-Timestamps zu HH:MM Uhr
function formatTime(timestamp) {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// TV-Box Infobar anzeigen
function showInfobar(channelId) {
    const infobar = document.getElementById('tvInfobar');
    if (!infobar) return;

    const channel = cachedChannels.find(c => c.uuid === channelId);
    const event = cachedEpgEvents[channelId];
    const now = Math.floor(Date.now() / 1000);

    if (channel) {
        document.getElementById('infoChannelTitle').innerText = channel.name;
    }

    if (event) {
        const startTime = formatTime(event.start);
        const stopTime = formatTime(event.stop);
        const totalDuration = event.stop - event.start;
        const elapsed = now - event.start;
        const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        document.getElementById('infoEpgTitle').innerText = event.title;
        document.getElementById('infoEpgTime').innerText = `${startTime} - ${stopTime}`;
        document.getElementById('infoProgressBar').style.width = `${progressPercent}%`;
    } else {
        document.getElementById('infoEpgTitle').innerText = "Keine EPG-Informationen verfügbar";
        document.getElementById('infoEpgTime').innerText = "--:-- - --:--";
        document.getElementById('infoProgressBar').style.width = "0%";
    }

    infobar.classList.remove('is-hidden');
}

// Stream abspielen mit Lade-Spinner & Infobar
async function playStream(channelId) {
    currentPlayingChannelId = channelId;
    if (isSwitchingChannel) return;
    isSwitchingChannel = true;

    const video = document.getElementById('videoPlayer');
    const placeholder = document.getElementById('playerPlaceholder');
    const spinner = document.getElementById('loadingSpinner');

    // 1. Platzhalter ausblenden & Video als "loading" markieren
    if (placeholder) placeholder.classList.add('is-hidden');
    video.classList.add('is-loading');

    // 2. Eigenen Spinner & Infobar aktivieren
    if (spinner) spinner.classList.remove('is-hidden');
    showInfobar(channelId);
    
    // 3. Sender in Liste markieren
    if (currentActiveChannel) {
        currentActiveChannel.classList.remove('is-active');
    }
    const selectedItem = document.getElementById(`channel-${channelId}`);
    if (selectedItem) {
        selectedItem.classList.add('is-active');
        currentActiveChannel = selectedItem;
    }

    // 4. Alten Stream trennen
    video.pause();
    video.removeAttribute('src');
    video.load();

    await new Promise(resolve => setTimeout(resolve, 150));

    // 5. Neuen Stream anstoßen
    video.src = `/video_proxy/${channelId}?t=${Date.now()}`;
    video.load();

    let attempts = 0;
    const maxAttempts = 2;

    const tryPlay = () => {
        video.play().then(() => {
            console.log("Stream erfolgreich gestartet!");
            if (spinner) spinner.classList.add('is-hidden');
            video.classList.remove('is-loading');
            isSwitchingChannel = false;
        }).catch(err => {
            if (err.name === 'AbortError') {
                isSwitchingChannel = false;
                return;
            }

            console.warn(`Wiedergabeversuch ${attempts + 1} fehlgeschlagen, versuche erneut...`);
            attempts++;

            if (attempts < maxAttempts) {
                setTimeout(() => {
                    console.log("Starte 2. Versuch automatisch...");
                    video.load();
                    tryPlay();
                }, 1000);
            } else {
                console.error("Sender konnte nicht gestartet werden.");
                if (spinner) spinner.classList.add('is-hidden');
                isSwitchingChannel = false;
            }
        });
    };

    tryPlay();
}

// Sender und EPG-Daten laden
async function loadChannelsAndEPG() {
    const container = document.getElementById('channelList');

    try {
        const [channelsRes, epgRes] = await Promise.all([
            fetch('/api/channels'),
            fetch('/api/epg')
        ]);

        const channelsData = await channelsRes.json();
        const epgData = await epgRes.json();

        const now = Math.floor(Date.now() / 1000);
        cachedEpgEvents = {};

        if (epgData.entries) {
            epgData.entries.forEach(event => {
                if (event.start <= now && event.stop >= now) {
                    cachedEpgEvents[event.channelUuid] = event;
                }
            });
        }

        if (channelsData.entries) {
            cachedChannels = channelsData.entries;
        }

        container.innerHTML = '';

        if (cachedChannels) {
            cachedChannels.forEach(channel => {
                const event = cachedEpgEvents[channel.uuid];
                let epgHtml = '<div class="epg-title">Keine EPG-Daten</div>';
                
                if (event) {
                    const startTime = formatTime(event.start);
                    const stopTime = formatTime(event.stop);
                    const totalDuration = event.stop - event.start;
                    const elapsed = now - event.start;
                    const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

                    epgHtml = `
                        <div class="epg-title">${event.title}</div>
                        <div class="epg-time">${startTime} - ${stopTime}</div>
                        <progress class="progress is-primary epg-progress" value="${progressPercent}" max="100"></progress>
                    `;
                }

                const item = document.createElement('div');
                item.id = `channel-${channel.uuid}`;
                item.className = 'channel-item';
                item.onclick = () => playStream(channel.uuid);

                // Wenn ein Logo vorhanden ist, anzeigen
                const logoHtml = channel.icon_public_url ? 
                    `<div class="channel-logo"><img src="${channel.icon_public_url}" alt="${channel.name}" onerror="this.style.display='none'"></div>` : '';

                item.innerHTML = `
                    <div class="channel-info" style="flex: 1; min-width: 0;">
                        <div class="channel-title">${channel.name}</div>
                        ${epgHtml}
                    </div>
                    ${logoHtml}
                `;

                container.appendChild(item);
            });
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="has-text-danger p-3">Fehler beim Laden!</div>`;
    }
}

// Auto-Hide Logik für Sidebar und Infobar bei Mausbewegung
function resetHideTimer() {
    const sidebar = document.querySelector('.sidebar');
    const infobar = document.getElementById('tvInfobar');

    if (sidebar) sidebar.classList.remove('is-hidden');
    document.body.style.cursor = 'default';

    if (currentPlayingChannelId) {
        showInfobar(currentPlayingChannelId);
    }

    clearTimeout(hideTimer);

    hideTimer = setTimeout(() => {
        if (sidebar) sidebar.classList.add('is-hidden');
        if (infobar) infobar.classList.add('is-hidden');
        document.body.style.cursor = 'none';
    }, 3500);
}

// Event-Listener registrieren sobald DOM bereit ist
document.addEventListener('DOMContentLoaded', () => {
    const channelList = document.getElementById('channelList');

    window.addEventListener('mousemove', resetHideTimer);
    window.addEventListener('click', resetHideTimer);
    window.addEventListener('wheel', resetHideTimer);

    if (channelList) {
        channelList.addEventListener('scroll', resetHideTimer);
    }

    loadChannelsAndEPG();
    resetHideTimer();

    // EPG alle 60 Sekunden aktualisieren
    setInterval(loadChannelsAndEPG, 60000);
});