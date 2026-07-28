const socket = io(),
  app = document.querySelector('#app'),
  connection = document.querySelector('#connection');
let state = null,
  selected = null,
  vision = null,
  cardOpen = false,
  lobbyRequestPending = false,
  pendingChatMessages = [],
  chatFlushQueued = false;
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c],
  );
function toast(text) {
  const e = document.querySelector('#toast');
  e.textContent = text;
  e.className = 'toast show';
  setTimeout(() => (e.className = 'toast'), 2600);
}
function button(text, cls = 'button', id = '') {
  return `<button type="button" ${id ? `id="${id}"` : ''} class="${cls}">${text}</button>`;
}
function landing(lobbies = []) {
  state = null;
  app.innerHTML = `<section class="hero"><div class="eyebrow">Echtzeit-Mehrspieler · 5–16 Personen</div><h1>Die Nacht kennt<br>deinen Namen.</h1><p>Erstelle ein Dorf, teile einen Lobby-Code oder finde eine öffentliche Runde. Alle geheimen Rollen bleiben auf dem Server verborgen.</p></section><section class="landing-grid"><article class="panel"><h2 class="section-title">Eine Lobby eröffnen</h2><p class="muted">Du bist Spielleitung und bestimmst die Rollen.</p><div class="form"><input id="create-name" class="input" placeholder="Dein Spielername" maxlength="22"><input id="lobby-name" class="input" placeholder="Name der Lobby, z. B. Vollmond" maxlength="30"><select id="max"><option value="8">Bis 8 Personen</option><option value="12" selected>Bis 12 Personen</option><option value="16">Bis 16 Personen</option></select><label class="check"><input id="private" type="checkbox"> Private Lobby mit Passwort</label><input id="password" class="input" placeholder="Passwort (nur private Lobby)" maxlength="32" disabled><div class="roles"><label class="check"><input type="checkbox" value="seer" checked> 🔮 Seherin</label><label class="check"><input type="checkbox" value="witch" checked> ⚗️ Hexe</label><label class="check"><input type="checkbox" value="hunter" checked> 🏹 Jäger</label><label class="check"><input type="checkbox" value="cupid" checked> 💘 Amor</label></div>${button('Lobby erstellen', 'button', 'create')}</div></article><article class="panel"><h2 class="section-title">Öffentliche Dörfer</h2><p class="muted">Oder trete mit einem Lobby-Code bei.</p><div class="form"><input id="join-name" class="input" placeholder="Dein Spielername" maxlength="22"><input id="join-code" class="input" placeholder="Lobby-Code" maxlength="6"><input id="join-password" class="input" placeholder="Passwort, falls benötigt" maxlength="32">${button('Mit Code beitreten', 'button secondary', 'join')}</div><div id="public-list" class="players"></div></article></section>`;
  document.querySelector('#private').onchange = (e) =>
    (document.querySelector('#password').disabled = !e.target.checked);
  document.querySelector('#create').onclick = () => {
    const playerName = document.querySelector('#create-name').value.trim();
    const name = document.querySelector('#lobby-name').value.trim();
    const isPrivate = document.querySelector('#private').checked;
    const password = document.querySelector('#password').value;
    if (!playerName || !name) return toast('Bitte gib einen Spieler- und Lobby-Namen ein.');
    if (isPrivate && !password.trim()) return toast('Private Lobbys benötigen ein Passwort.');
    if (lobbyRequestPending) return;
    lobbyRequestPending = true;
    document.querySelector('#create').disabled = true;
    socket.emit('lobby:create', {
      playerName,
      name,
      maxPlayers: +document.querySelector('#max').value,
      private: isPrivate,
      password,
      roles: [...document.querySelectorAll('.roles input:checked')].map((x) => x.value),
    });
  };
  document.querySelector('#join').onclick = () => join();
  renderList(lobbies);
  app.dispatchEvent(new Event('yuwolf:render'));
}
function join(code) {
  const playerName = document.querySelector('#join-name').value.trim();
  const lobbyCode = String(code || document.querySelector('#join-code').value)
    .trim()
    .toUpperCase();
  if (!playerName) return toast('Bitte gib zuerst deinen Spielernamen ein.');
  if (!/^[A-Z0-9]{6}$/.test(lobbyCode)) return toast('Bitte gib einen gültigen Lobby-Code ein.');
  if (lobbyRequestPending) return;
  lobbyRequestPending = true;
  document.querySelector('#join').disabled = true;
  socket.emit('lobby:join', {
    playerName,
    code: lobbyCode,
    password: document.querySelector('#join-password').value,
  });
}
function renderList(list) {
  const e = document.querySelector('#public-list');
  if (!e) return;
  e.innerHTML = list.length
    ? `<p class="eyebrow public-lobbies-title">Jetzt offen</p><div class="public-lobbies">${list
        .map(
          (l) =>
            `<article class="public-lobby"><div><b>${esc(l.name)}</b><span>${l.count}/${l.max} Personen · Code ${l.code}</span></div>${button('Beitreten', 'button secondary', 'open-' + l.code)}</article>`,
        )
        .join('')}</div>`
    : '<p class="muted public-lobbies-empty">Noch kein öffentliches Dorf wartet auf dich.</p>';
  list.forEach(
    (l) =>
      (document.querySelector('#open-' + l.code).onclick = () => {
        const name = document.querySelector('#join-name');
        if (name.value.trim()) return join(l.code);
        document.querySelector('#join-code').value = l.code;
        name.focus();
        toast('Gib zuerst deinen Spielernamen ein.');
      }),
  );
}
function render() {
  if (!state) return;
  pendingChatMessages.length = 0;
  const own = state.own,
    isHost = state.hostId === socket.id;
  const everyone = state.players
    .map(
      (p) =>
        `<li class="${!p.alive ? 'dead' : ''} ${!p.connected ? 'offline' : ''}">${p.host ? '♛ ' : ''}${esc(p.name)} ${!p.connected ? '· getrennt' : ''}</li>`,
    )
    .join('');
  let center;
  if (state.phase === 'lobby')
    center = `<div class="game"><div class="phase">Warte auf das Rudel</div><h1 class="title">${esc(state.name)}</h1><div class="notice"><h2 class="section-title">Teile diesen Code</h2><div class="code">${state.code}</div><p class="muted">${state.private ? 'Private Lobby · Passwort erforderlich' : 'Öffentliche Lobby'} · ${state.players.length}/${state.max} Personen</p>${isHost ? button('Spiel starten', 'button', 'start') : '<p class="muted">Der Host startet, sobald alle da sind.</p>'}</div>${isHost ? `<div class="log">Aktive Sonderrollen: ${state.settings.roles.map((r) => ({ seer: 'Seherin', witch: 'Hexe', hunter: 'Jäger', cupid: 'Amor' })[r]).join(', ') || 'keine'}</div>` : ''}</div>`;
  else if (state.phase === 'ended')
    center = `<div class="game"><div class="phase">Die letzte Nacht ist vorbei</div><h1 class="title">${state.winner}</h1><div class="notice"><p class="muted">Die Rollen werden enthüllt:</p><div class="choice-grid">${state.players.map((p) => `<div class="choice ${p.alive ? '' : 'dead'}">${esc(p.name)}<br><small>${p.alive ? 'überlebt' : 'ausgeschieden'}</small></div>`).join('')}</div>${button('Zur Startseite', 'button', 'home')}</div></div>`;
  else if (state.phase === 'reveal') center = revealCeremony();
  else center = gameCenter(own, isHost);
  app.innerHTML = `<section class="room"><aside class="side"><article class="panel"><div class="eyebrow">Lobby-Code</div><div class="code">${state.code}</div><ul class="players">${everyone}</ul></article><article class="panel"><div class="eyebrow">Deine geheime Rolle</div>${own?.role ? `<div class="rolecard"><div class="icon">${own.role.icon}</div><h2>${own.role.name}</h2><p>${own.role.description}</p></div>` : '<p class="muted">Die Rollen werden beim Start verteilt.</p>'}</article><article class="panel"><div class="eyebrow">Chronik</div><div class="log">${state.log.map((x) => '• ' + esc(x)).join('<br>')}</div></article></aside><section>${center}</section><aside class="panel chat"><div class="eyebrow">Dorfplatz</div><div id="messages" class="messages">${state.messages.map((m) => (m.system ? `<div class="message system">${esc(m.text)}</div>` : `<div class="message"><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`)).join('')}</div><div class="send"><input id="chat-input" class="input" maxlength="360" placeholder="Schreibe ins Dorf…">${button('Senden', 'button', 'send')}</div></aside></section>`;
  wireRender();
  app.dispatchEvent(new Event('yuwolf:render'));
}
function gameCenter(own, isHost) {
  const s = state.selection,
    active = s?.actorIds?.includes(socket.id),
    targets = s?.targets || [];
  let action = '';
  if (state.phase === 'day') {
    action = isHost
      ? `<p class="muted">Trage nach der Diskussion das Abstimmungsergebnis ein.</p>${targetButtons(targets, 'vote')}${button('Niemand wird verurteilt', 'button secondary', 'skip')}`
      : '<p class="muted">Diskutiert im Chat. Der Host trägt anschließend das Ergebnis der Abstimmung ein.</p>';
  } else if (state.phase === 'hunter') {
    action = active
      ? `${targetButtons(targets, 'hunter')}${button('Keinen Schuss abgeben', 'button secondary', 'skip')}`
      : '<p class="muted">Der Jäger entscheidet über seinen letzten Schuss.</p>';
  } else if (active) {
    if (s.task === 'cupid')
      action = `<p class="muted">Wähle zwei Menschen, die miteinander verbunden werden.</p>${targetButtons(targets, 'love')}${button('Herzen verbinden', 'button', 'act')}`;
    else if (s.task === 'witch')
      action = `<p class="muted">${state.own?.witch?.heal && state.night ? 'Du kannst heilen oder vergiften.' : ''}</p>${state.own.witch?.heal ? button('Heiltrank verwenden', 'button secondary', 'heal') : ''} ${state.own.witch?.poison ? targetButtons(targets, 'poison') : ''} ${button('Nichts tun', 'button secondary', 'skip')}`;
    else
      action = `${targetButtons(targets, 'act')}${button('Nicht handeln', 'button secondary', 'skip')}`;
  } else
    action =
      '<p class="muted">Die Nacht ist still. Warte, bis die anderen Rollen gehandelt haben.</p>';
  return `<div class="game"><div class="phase">${state.phase === 'day' ? '☀ Tag' : '☾ Nacht'} ${state.night}</div><h1 class="title">${state.phase === 'day' ? 'Das Dorf erwacht' : s?.task === 'wolf' ? 'Das Rudel erwacht' : s?.task === 'seer' ? 'Die Seherin erwacht' : s?.task === 'witch' ? 'Die Hexe erwacht' : s?.task === 'cupid' ? 'Amor erwacht' : 'Der Jäger zielt'}</h1><div class="notice"><p>${esc(s?.text || '')}</p>${vision ? `<div class="rolecard"><div class="icon">${vision.role.icon}</div><h2>${vision.name} ist ${vision.role.name}</h2><p>Dieses Wissen gehört nur dir.</p></div>` : ''}${action}</div></div>`;
}
function targetButtons(targets, type) {
  return `<div class="choice-grid">${targets.map((t) => `<button class="choice ${selected === t.id ? 'selected' : ''}" data-target="${t.id}" data-type="${type}">${esc(t.name)}</button>`).join('')}</div>`;
}
function revealCeremony() {
  if (state.revealDone)
    return `<div class="game ceremony-ready"><div class="phase">Kartenzeremonie</div><h1 class="title">Du bist bereit.</h1><div class="notice"><div class="ready-seal">✦</div><p class="muted">Deine Schicksalskarte ist wieder sicher verborgen.</p><p class="ceremony-count"><strong>${state.revealedCount}</strong> von ${state.players.length} Personen sind bereit</p><div class="ready-progress"><span style="width:${(state.revealedCount / state.players.length) * 100}%"></span></div><p class="muted small">Die Nacht beginnt automatisch, sobald alle ihre Karte geschlossen haben.</p></div></div>`;
  const r = state.own.role;
  const roleKey = r.name.toLowerCase().replace('ä', 'a');
  return `<div class="game reveal"><div class="phase">Kartenzeremonie · Nur für deine Augen</div><h1 class="title">Dein Schicksal wartet.</h1><p class="muted">Achte darauf, dass niemand auf deinen Bildschirm sieht.</p><button id="destiny-card" class="destiny-card ${cardOpen ? 'is-open' : ''}" aria-label="Schicksalskarte umdrehen"><span class="card-face card-back"><span class="card-corner">✦</span><span class="rune">☾</span><b>YuWolf</b><small>YU’S DÜSTERWALD</small><span class="tap-hint">Antippen zum Aufdecken</span></span><span class="card-face card-front role-${roleKey}"><span class="role-constellation">✦ ✧ ✦</span><span class="card-art">${r.icon}</span><span class="card-name">${esc(r.name)}</span><span class="card-copy">${esc(r.description)}</span><span class="card-team">${r.team === 'wolf' ? 'Rudel der Nacht' : 'Dorf von Yu'}</span></span></button><p class="muted card-instruction">${cardOpen ? 'Noch einmal tippen: Karte schließen und bereit melden.' : 'Deine Karte ist verdeckt und nur für dich bestimmt.'}</p></div>`;
}
function wireRender() {
  document.querySelector('#start')?.addEventListener('click', () => socket.emit('game:start'));
  document.querySelector('#home')?.addEventListener('click', () => landing());
  document.querySelector('#destiny-card')?.addEventListener('click', () => {
    if (cardOpen) {
      cardOpen = false;
      socket.emit('reveal:done');
    } else {
      cardOpen = true;
      render();
    }
  });
  document.querySelector('#send')?.addEventListener('click', sendChat);
  document.querySelector('#chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });
  document.querySelector('#skip')?.addEventListener('click', () => {
    vision = null;
    socket.emit('game:skip');
  });
  document.querySelector('#heal')?.addEventListener('click', () => {
    vision = null;
    socket.emit('game:action', { target: state.selection.targets[0]?.id, kind: 'heal' });
  });
  document.querySelectorAll('[data-target]').forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.target;
        let type = b.dataset.type;
        if (type === 'vote') return socket.emit('game:vote', selected);
        if (type === 'hunter') return socket.emit('game:action', { target: selected });
        if (type === 'poison')
          return socket.emit('game:action', { target: selected, kind: 'poison' });
        if (type === 'love') return render();
        socket.emit('game:action', { target: selected });
      }),
  );
  document.querySelector('#act')?.addEventListener('click', () => {
    if (!selected) return toast('Wähle zwei verschiedene Personen.');
    const others = state.selection.targets.filter((t) => t.id !== selected);
    if (!window.loveSecond) {
      window.loveSecond = others[0]?.id;
      toast('Wähle jetzt die zweite Person.');
      return;
    }
    socket.emit('game:action', { target: selected, second: window.loveSecond });
    window.loveSecond = null;
    selected = null;
  });
  const messages = document.querySelector('#messages');
  if (messages) messages.scrollTop = messages.scrollHeight;
}
function sendChat() {
  const e = document.querySelector('#chat-input');
  if (e?.value.trim()) {
    socket.emit('chat:send', e.value);
    e.value = '';
  }
}
function appendChatMessages() {
  chatFlushQueued = false;
  const messages = document.querySelector('#messages');
  if (!messages || !pendingChatMessages.length) return;
  const shouldScroll = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 48;
  const fragment = document.createDocumentFragment();
  pendingChatMessages.splice(0).forEach((message) => {
    const row = document.createElement('div');
    row.className = message.system ? 'message system' : 'message';
    if (message.system) row.textContent = message.text;
    else {
      const name = document.createElement('b');
      name.textContent = `${message.name}: `;
      row.append(name, document.createTextNode(message.text));
    }
    fragment.appendChild(row);
  });
  messages.appendChild(fragment);
  while (messages.children.length > 100) messages.firstElementChild?.remove();
  if (shouldScroll) messages.scrollTop = messages.scrollHeight;
}
socket.on('connect', () => (connection.textContent = '● Verbunden'));
socket.on('disconnect', () => (connection.textContent = '○ Verbindung verloren'));
socket.on('app:error', (message) => {
  lobbyRequestPending = false;
  document
    .querySelectorAll('#create, #join')
    .forEach((buttonElement) => buttonElement.removeAttribute('disabled'));
  toast(message);
});
socket.on('lobby:list', (list) => {
  if (!state) renderList(list);
});
socket.on('chat:message', (message) => {
  if (!state || !message) return;
  state.messages = [...state.messages, message].slice(-100);
  pendingChatMessages.push(message);
  if (!chatFlushQueued) {
    chatFlushQueued = true;
    requestAnimationFrame(appendChatMessages);
  }
});
socket.on('lobby:state', (s) => {
  lobbyRequestPending = false;
  if (location.pathname.startsWith('/join/')) history.replaceState({}, '', '/');
  if (s.phase !== 'reveal') cardOpen = false;
  state = s;
  selected = null;
  vision = null;
  render();
});
socket.on('game:vision', (v) => {
  vision = v;
  render();
});
landing();
