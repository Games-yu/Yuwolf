const socket = io(),
  app = document.querySelector('#app'),
  connection = document.querySelector('#connection');
let state = null,
  selected = null,
  vision = null,
  cardOpen = false,
  lobbyRequestPending = false,
  pendingChatMessages = [],
  chatFlushQueued = false,
  cupidChoices = [],
  timerInterval = null;
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c],
  );
function toast(text, type = '') {
  const e = document.querySelector('#toast');
  e.textContent = text;
  e.className = `toast show${type ? ' toast-' + type : ''}`;
  setTimeout(() => (e.className = 'toast'), 3200);
}
function button(text, cls = 'button', id = '') {
  return `<button type="button" ${id ? `id="${id}"` : ''} class="${cls}">${text}</button>`;
}

/* ─── Landing ─── */
function landing(lobbies = []) {
  state = null;
  clearPhaseTimerDisplay();
  app.innerHTML = `<div class="landing-wrapper"><section class="hero"><div class="eyebrow">Echtzeit-Mehrspieler · 5–99 Personen</div><h1>Die Nacht kennt<br>deinen Namen.</h1><p>Erstelle ein Dorf, teile einen Lobby-Code oder finde eine öffentliche Runde. Alle geheimen Rollen bleiben auf dem Server verborgen.</p></section><section class="landing-grid"><article class="panel"><h2 class="section-title">Eine Lobby eröffnen</h2><p class="muted">Du bist Spielleitung und bestimmst die Rollen.</p><div class="form"><input id="create-name" class="input" placeholder="Dein Spielername" maxlength="22"><input id="lobby-name" class="input" placeholder="Name der Lobby, z. B. Vollmond" maxlength="30"><label class="eyebrow" style="margin-top:4px;display:block;">Spieleranzahl</label><div class="max-player-options"><button type="button" class="max-opt-btn" data-val="8">8</button><button type="button" class="max-opt-btn active" data-val="12">12</button><button type="button" class="max-opt-btn" data-val="16">16</button><button type="button" class="max-opt-btn" data-val="custom">Custom</button></div><input id="max" type="hidden" value="12"><div id="custom-max-wrapper" style="display:none;"><input id="custom-max" type="number" class="input" placeholder="Spieleranzahl (5 - 99)" min="5" max="99" value="20"></div><label class="check"><input id="private" type="checkbox"> Private Lobby mit Passwort</label><input id="password" class="input" placeholder="Passwort (nur private Lobby)" maxlength="32" disabled><div class="roles"><label class="check"><input type="checkbox" value="seer" checked> 🔮 Seherin</label><label class="check"><input type="checkbox" value="witch" checked> ⚗️ Hexe</label><label class="check"><input type="checkbox" value="hunter" checked> 🏹 Jäger</label><label class="check"><input type="checkbox" value="cupid" checked> 💘 Amor</label></div>${button('Lobby erstellen', 'button', 'create')}</div></article><article class="panel"><h2 class="section-title">Öffentliche Dörfer</h2><p class="muted">Oder trete mit einem Lobby-Code bei.</p><div class="form"><input id="join-name" class="input" placeholder="Dein Spielername" maxlength="22"><input id="join-code" class="input" placeholder="Lobby-Code" maxlength="6"><input id="join-password" class="input" placeholder="Passwort, falls benötigt" maxlength="32">${button('Mit Code beitreten', 'button secondary', 'join')}</div><div id="public-list" class="players"></div></article></section></div>`;
  document.querySelectorAll('.max-opt-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.max-opt-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.val;
      document.querySelector('#max').value = val;
      const customWrapper = document.querySelector('#custom-max-wrapper');
      if (customWrapper) customWrapper.style.display = val === 'custom' ? 'block' : 'none';
    };
  });
  document.querySelector('#private').onchange = (e) =>
    (document.querySelector('#password').disabled = !e.target.checked);
  document.querySelector('#create').onclick = () => {
    const playerName = document.querySelector('#create-name').value.trim();
    const name = document.querySelector('#lobby-name').value.trim();
    const isPrivate = document.querySelector('#private').checked;
    const password = document.querySelector('#password').value;
    const selectedLimit = document.querySelector('#max').value;
    const maxPlayers =
      selectedLimit === 'custom'
        ? Number(document.querySelector('#custom-max')?.value)
        : Number(selectedLimit);
    if (!playerName || !name) return toast('Bitte gib einen Spieler- und Lobby-Namen ein.');
    if (isPrivate && !password.trim()) return toast('Private Lobbys benötigen ein Passwort.');
    if (!Number.isInteger(maxPlayers) || maxPlayers < 5 || maxPlayers > 99)
      return toast('Wähle eine Spielerzahl zwischen 5 und 99.');
    if (lobbyRequestPending) return;
    lobbyRequestPending = true;
    document.querySelector('#create').disabled = true;
    socket.emit('lobby:create', {
      playerName,
      name,
      maxPlayers,
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

/* ─── Main Render ─── */
function render() {
  if (!state) return;
  const previousScroll = window.scrollY;
  const activeEl = document.activeElement;
  const activeId = activeEl?.id;
  const activeStart = activeEl?.selectionStart;
  const activeEnd = activeEl?.selectionEnd;
  const chatVal = document.querySelector('#chat-input')?.value;
  const houseRulesVal = document.querySelector('#house-rules')?.value;
  const notesVal = document.querySelector('#private-notes textarea')?.value;

  pendingChatMessages.length = 0;
  const own = state.own,
    isHost = state.hostId === socket.id;
  // Dead hunter MUST still see their action – they are NOT a spectator during hunter phase
  const isHunterActing = state.phase === 'hunter' && state.selection?.actorIds?.includes(socket.id);
  const isSpectator = own && !own.alive && !isHunterActing;

  // Detect phase change to 'ended' for end-game popup
  const wasEnded = render._lastPhase === 'ended';
  if (state.phase === 'ended' && !wasEnded) {
    render._lastPhase = 'ended';
    // Show end-game popup after short delay so render finishes first
    setTimeout(() => showGameEndModal(state.winner, state.players, state.own), 400);
  } else if (state.phase !== 'ended') {
    render._lastPhase = state.phase;
  }

  const everyone = state.players
    .map((p) => {
      const isMe = p.id === socket.id;
      const isWolfTeam = own?.wolfTeam?.some((w) => w.id === p.id);
      const hostKick = (isHost && !isMe) ? ` <button class="kick-btn" data-kick="${p.id}" title="${esc(p.name)} entfernen">✕</button>` : '';
      return `<li class="${!p.alive ? 'dead' : ''} ${!p.connected ? 'offline' : ''} ${isWolfTeam ? 'wolf-ally' : ''} ${isMe ? 'me' : ''}" title="${isWolfTeam ? '🐺 Dein Rudel-Mitglied' : ''}">
        <span class="player-name">${p.host ? '♛ ' : ''}${esc(p.name)}${isMe ? ' <span class="me-tag">Ich</span>' : ''}${isWolfTeam ? ' <span class="wolf-tag">🐺</span>' : ''}</span>
        <span class="player-status">${!p.connected ? '· getrennt' : !p.alive ? '· ☠' : p.ready && state.phase === 'lobby' ? '· ✓' : ''}${hostKick}</span>
      </li>`;
    })
    .join('');

  let center;
  if (state.phase === 'lobby') center = lobbyCenter(isHost, own);
  else if (state.phase === 'ended') center = endedCenter();
  else if (state.phase === 'reveal') center = revealCeremony();
  else center = gameCenter(own, isHost, isSpectator);

  // Phase banner
  const phaseBanner = buildPhaseBanner();

  app.innerHTML = `<section class="room">
    <aside class="side">
      <article class="panel players-panel">
        <div class="eyebrow">Lobby-Code</div>
        <div class="code">${state.code}</div>
        <ul class="players">${everyone}</ul>
      </article>
      <article class="panel rolecard-panel">
        <div class="eyebrow">Deine geheime Rolle</div>
        ${own?.role ? roleCardSidebar(own) : '<p class="muted">Die Rollen werden beim Start verteilt.</p>'}
      </article>
      <article class="panel log-panel">
        <div class="eyebrow">Chronik</div>
        <div class="log">${state.log.map((x) => `<div class="log-entry">• ${esc(x)}</div>`).join('')}</div>
      </article>
    </aside>
    <section class="center-col">
      ${phaseBanner}
      ${center}
    </section>
    <aside class="panel chat">
      ${isSpectator ? '<div class="spectator-banner">👁 Zuschauermodus · Du schaust zu, kannst aber nicht abstimmen.</div>' : ''}
      <div class="eyebrow">Dorfplatz</div>
      <div id="messages" class="messages">${state.messages.map((m) => m.system
        ? `<div class="message system"><span class="msg-icon">◆</span>${esc(m.text)}</div>`
        : `<div class="message"><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('')}</div>
      <div class="send">
        <input id="chat-input" class="input" maxlength="360" placeholder="Schreibe ins Dorf…">
        ${button('Senden', 'button', 'send')}
      </div>
    </aside>
  </section>`;

  wireRender();
  app.dispatchEvent(new Event('yuwolf:render'));
  updatePhaseTimerDisplay();

  if (chatVal !== undefined && document.querySelector('#chat-input'))
    document.querySelector('#chat-input').value = chatVal;
  if (houseRulesVal !== undefined && document.querySelector('#house-rules'))
    document.querySelector('#house-rules').value = houseRulesVal;
  if (notesVal !== undefined && document.querySelector('#private-notes textarea'))
    document.querySelector('#private-notes textarea').value = notesVal;
  if (activeId) {
    const el = document.querySelector('#' + activeId);
    if (el && typeof el.focus === 'function') {
      el.focus();
      if (typeof activeStart === 'number' && typeof activeEnd === 'number' && el.setSelectionRange) {
        try { el.setSelectionRange(activeStart, activeEnd); } catch (_) {}
      }
    }
  }
  requestAnimationFrame(() => window.scrollTo({ top: previousScroll, behavior: 'auto' }));
}

/* ─── Role card in sidebar ─── */
function roleCardSidebar(own) {
  const r = own.role;
  let extra = '';
  if (own.wolfTeam && own.wolfTeam.length > 0) {
    extra = `<div class="wolf-team-panel">
      <div class="wolf-team-label">🐺 Dein Rudel</div>
      ${own.wolfTeam.map((w) => `<span class="wolf-team-member ${!w.alive ? 'dead' : ''}">${esc(w.name)}${!w.alive ? ' ☠' : ''}</span>`).join('')}
    </div>`;
  } else if (own.wolfTeam && own.wolfTeam.length === 0) {
    extra = `<div class="wolf-team-panel"><div class="wolf-team-label">🐺 Du bist allein im Rudel</div></div>`;
  }
  if (own.lover) {
    extra += `<div class="lover-badge">💘 Du bist verliebt</div>`;
  }
  return `<div class="rolecard-side">
    <div class="role-icon-big">${r.icon}</div>
    <h2 class="role-name">${esc(r.name)}</h2>
    <p class="role-desc">${esc(r.description)}</p>
    ${extra}
  </div>`;
}

/* ─── Phase Banner ─── */
function buildPhaseBanner() {
  if (!state || state.phase === 'lobby' || state.phase === 'ended' || state.phase === 'reveal') return '';
  const isDay = state.phase === 'day';
  const phaseIcon = isDay ? '☀' : '☾';
  const phaseLabel = isDay ? 'Tag' : 'Nacht';
  const task = state.selection?.task;
  const TASK_LABELS = {
    wolf: '🐺 Werwölfe erwachen',
    seer: '🔮 Seherin erwacht',
    witch: '⚗️ Hexe erwacht',
    cupid: '💘 Amor erwacht',
    guardian: '🛡️ Schutzgeist erwacht',
    piper: '🎶 Flötenspieler erwacht',
    vampire: '🧛 Vampir erwacht',
    thief: '🗝️ Diebin erwacht',
    doppelganger: '🎭 Doppelgänger erwacht',
    girl: '👁️ Mädchen erwacht',
    witchhunter: '🔥 Hexenjäger erwacht',
    hunter: '🏹 Jäger zielt',
    waiting: '💤 Die Nacht ist still',
    day: '☀ Tag beginnt',
  };
  const taskLabel = task ? (TASK_LABELS[task] || '') : (isDay ? TASK_LABELS.day : '');
  return `<div class="phase-banner ${isDay ? 'day' : 'night'}">
    <span class="phase-icon">${phaseIcon}</span>
    <span class="phase-num">${phaseLabel} ${state.night}</span>
    ${taskLabel ? `<span class="phase-sep">·</span><span class="phase-task">${taskLabel}</span>` : ''}
  </div>`;
}

/* ─── Lobby Center ─── */
function lobbyCenter(isHost) {
  return `<div class="game"><div class="phase">Warte auf das Rudel</div><h1 class="title">${esc(state.name)}</h1>
    <div class="notice">
      <h2 class="section-title">Teile diesen Code</h2>
      <div class="code">${state.code}</div>
      <p class="muted">${state.private ? 'Private Lobby · Passwort erforderlich' : 'Öffentliche Lobby'} · ${state.players.length}/${state.max} Personen</p>
      ${isHost ? button('Spiel starten', 'button', 'start') : '<p class="muted">Der Host startet, sobald alle da sind.</p>'}
      ${isHost ? `<div class="log" style="margin-top:14px;">Aktive Sonderrollen: ${state.settings.roles.map((r) => ({ seer: 'Seherin', witch: 'Hexe', hunter: 'Jäger', cupid: 'Amor' })[r]).join(', ') || 'keine'}</div>` : ''}
    </div>
  </div>`;
}

/* ─── Ended Center ─── */
function endedCenter() {
  const voteHistory = state.voteHistory || [];
  const voteHistoryHtml = voteHistory.length
    ? `<div class="vote-history-reveal">
        <div class="eyebrow" style="margin-bottom:10px;">Abstimmungschronik</div>
        ${voteHistory.map((r) => `<div class="vote-record">
          <span class="vote-record-round">Tag ${r.round}</span>
          <div class="vote-record-entries">${r.votes.map((v) => {
            const voter = state.players.find((p) => p.id === v.voter);
            const target = state.players.find((p) => p.id === v.target);
            return `<span>${esc(voter?.name || '?')} → ${esc(target?.name || '?')}</span>`;
          }).join('')}</div>
        </div>`).join('')}
      </div>`
    : '';
  return `<div class="game"><div class="phase">Die letzte Nacht ist vorbei</div>
    <h1 class="title">${esc(state.winner)}</h1>
    <div class="notice">
      <p class="muted">Die Rollen werden enthüllt:</p>
      <div class="choice-grid result-grid">
        ${state.players.map((p) => `<div class="choice result-card ${p.alive ? 'alive' : 'dead'}">
          <div class="result-role-icon">${p.role?.icon || '?'}</div>
          <div class="result-name">${esc(p.name)}</div>
          <small>${p.role?.name || ''}</small>
          <small class="${p.alive ? 'alive-tag' : 'dead-tag'}">${p.alive ? '✓ überlebt' : '☠ ausgeschieden'}</small>
        </div>`).join('')}
      </div>
      ${voteHistoryHtml}
      ${button('Zur Startseite', 'button', 'home')}
    </div>
  </div>`;
}

/* ─── Game Center ─── */
function gameCenter(own, isHost, isSpectator) {
  const s = state.selection;
  const active = s?.actorIds?.includes(socket.id);
  const targets = s?.targets || [];

  const timer = state.timer
    ? `<div class="phase-timer"><span>${state.phase === 'day' ? 'Abstimmung endet in' : 'Entscheidung endet in'}</span><strong id="phase-timer" data-deadline="${state.timer.deadline}">--:--</strong></div>`
    : '';

  const TITLE_MAP = {
    day: 'Das Dorf erwacht',
    hunter: 'Der Jäger zielt',
    wolf: 'Das Rudel erwacht',
    seer: 'Die Seherin erwacht',
    witch: 'Die Hexe erwacht',
    cupid: 'Amor erwacht',
    guardian: 'Der Schutzgeist erwacht',
    piper: 'Der Flötenspieler erwacht',
    vampire: 'Der Vampir erwacht',
    thief: 'Die Diebin erwacht',
    doppelganger: 'Der Doppelgänger erwacht',
    girl: 'Das Mädchen erwacht',
    witchhunter: 'Der Hexenjäger erwacht',
    waiting: 'Die Nacht ist still',
  };
  const titleText = state.phase === 'night'
    ? TITLE_MAP[s?.task] || 'Die Nacht ist still'
    : TITLE_MAP[state.phase] || 'YuWolf';

  let action = '';
  if (isSpectator) {
    action = buildSpectatorView(s);
  } else if (state.phase === 'day') {
    action = buildDayVoteAction(targets, isHost);
  } else if (state.phase === 'hunter') {
    action = active
      ? `<p class="action-hint">Du wirst sterben – nimm jemanden mit dir.</p>${targetButtons(targets, 'hunter')}${button('Keinen Schuss abgeben', 'button secondary', 'skip')}`
      : '<div class="waiting-card"><span>🏹</span><p>Der Jäger entscheidet über seinen letzten Schuss.</p></div>';
  } else if (active) {
    if (s.task === 'wolf') action = buildWolfAction(targets, own);
    else if (s.task === 'cupid')
      action = `<p class="action-hint">Wähle zwei Menschen, die miteinander verbunden werden.</p>${targetButtons(targets, 'love')}${button('Herzen verbinden', 'button', 'act')}`;
    else if (s.task === 'witch') {
      const victimName = s.wolfTargetName || null;
      const canHeal = s.canHeal && own.witch?.heal;
      const canPoison = own.witch?.poison;
      const healTargets = targets.filter((t) => t.id !== s.wolfTargetId);
      action = `
        ${victimName
          ? `<div class="witch-victim-card">
               <span class="witch-victim-icon">🐺</span>
               <div>
                 <strong>Das Rudel hat <span class="witch-victim-name">${esc(victimName)}</span> angegriffen!</strong>
                 <div class="witch-victim-sub">Du kannst ${canHeal ? 'heilen oder ' : ''}${canPoison ? 'vergiften oder passen' : 'nichts tun'}.</div>
               </div>
             </div>`
          : '<p class="action-hint">Das Rudel hat dieses Mal niemanden angegriffen.</p>'
        }
        ${canHeal ? button('Heile ' + esc(victimName || ''), 'button secondary', 'heal') : ''}
        ${canPoison ? '<p class="action-hint" style="margin-top:10px;">Oder jemanden vergiften:</p>' + targetButtons(healTargets, 'poison') : ''}
        ${button('Nichts tun', 'button secondary', 'skip')}
      `;
    }
    else
      action = `${targetButtons(targets, 'act')}${button('Nicht handeln', 'button secondary', 'skip')}`;
  } else {
    action = `<div class="waiting-card"><span>💤</span><p>Die Nacht ist still. Warte, bis die anderen Rollen gehandelt haben.</p></div>`;
  }

  // Mini-Eventlog for mobile/center visibility
  const recentLogs = state.log.slice(-2);
  const miniLogHtml = recentLogs.length > 0
    ? `<div class="mini-eventlog">
         ${recentLogs.map((x) => `<div>• ${esc(x)}</div>`).join('')}
       </div>`
    : '';

  return `<div class="game">
    <h1 class="title">${titleText}</h1>
    ${timer}
    <div class="notice">
      ${miniLogHtml}
      <p class="notice-text">${esc(s?.text || '')}</p>
      ${vision ? `<div class="vision-card"><div class="icon">${vision.role.icon}</div><h2>${esc(vision.name)} ist ${esc(vision.role.name)}</h2><p>Dieses Wissen gehört nur dir.</p></div>` : ''}
      ${action}
    </div>
  </div>`;
}

/* ─── Spectator view ─── */
function buildSpectatorView(s) {
  if (state.phase === 'day') {
    const targets = state.selection?.targets || [];
    const totalVoters = state.players.filter((p) => p.alive).length;
    const votedCount = state.vote?.count || 0;
    return `<div class="spectator-vote-view">
      <p class="action-hint">Abstimmung läuft – Du beobachtest als Zuschauer.</p>
      <div class="vote-progress-bar">
        <span class="vote-progress-fill" style="width:${totalVoters > 0 ? (votedCount / totalVoters) * 100 : 0}%"></span>
      </div>
      <p class="muted" style="font-size:12px;margin:6px 0 16px;">${votedCount} von ${totalVoters} haben abgestimmt</p>
      <div class="choice-grid">
        ${targets.map((t) => {
          const count = state.vote?.tally?.[t.id] || 0;
          return `<div class="choice spectator-choice"><span>${esc(t.name)}</span>${count > 0 ? `<span class="vote-count">${count}</span>` : ''}</div>`;
        }).join('')}
      </div>
    </div>`;
  }
  // Night spectator view: show who is currently acting
  const NIGHT_TASK_NAMES = {
    wolf: { icon: '🐺', label: 'Die Werwölfe erwachen' },
    seer: { icon: '🔮', label: 'Die Seherin erwacht' },
    witch: { icon: '⚗️', label: 'Die Hexe erwacht' },
    cupid: { icon: '💘', label: 'Amor erwacht' },
    guardian: { icon: '🛡️', label: 'Der Schutzgeist erwacht' },
    piper: { icon: '🎶', label: 'Der Flötenspieler erwacht' },
    vampire: { icon: '🧛', label: 'Der Vampir erwacht' },
    thief: { icon: '🗝️', label: 'Die Diebin erwacht' },
    doppelganger: { icon: '🎭', label: 'Der Doppelgänger erwacht' },
    girl: { icon: '👁️', label: 'Das Mädchen schaut' },
    witchhunter: { icon: '🔥', label: 'Der Hexenjäger erwacht' },
    waiting: { icon: '💤', label: 'Die Nacht ist still…' },
  };
  const taskInfo = s?.task ? NIGHT_TASK_NAMES[s.task] : null;
  if (taskInfo) {
    return `<div class="night-actor-banner">
      <span class="night-actor-icon">${taskInfo.icon}</span>
      <div>
        <div class="night-actor-label">${taskInfo.label}</div>
        <div class="night-actor-sub">Warte, bis die Nacht vorbei ist.</div>
      </div>
    </div>`;
  }
  return `<div class="waiting-card"><span>👁</span><p>Du beobachtest das Spielgeschehen. Viel Spaß beim Zuschauen!</p></div>`;
}

/* ─── Day Vote Action ─── */
function buildDayVoteAction(targets, isHost) {
  const totalVoters = state.players.filter((p) => p.alive).length;
  const votedCount = state.vote?.count || 0;
  const hasCast = state.vote?.cast || false;
  const myTarget = state.vote?.myTarget || null;

  const progressBar = `<div class="vote-progress-wrap">
    <div class="vote-progress-bar">
      <span class="vote-progress-fill" style="width:${totalVoters > 0 ? (votedCount / totalVoters) * 100 : 0}%"></span>
    </div>
    <span class="vote-progress-label">${votedCount} von ${totalVoters} haben abgestimmt</span>
  </div>`;

  if (hasCast) {
    const myTargetName = targets.find((t) => t.id === myTarget)?.name || '?';
    return `${progressBar}
      <div class="vote-cast-confirm">
        <span class="vote-cast-icon">✓</span>
        <p>Du hast für <strong>${esc(myTargetName)}</strong> gestimmt.</p>
        <p class="muted" style="font-size:12px;">Abstimmung ist anonym – Ergebnis nach der Auflösung.</p>
      </div>
      <div class="choice-grid anon-vote-grid">
        ${targets.map((t) => {
          const count = state.vote?.tally?.[t.id] || 0;
          return `<div class="choice ${t.id === myTarget ? 'selected' : ''}"><span>${esc(t.name)}</span>${count > 0 ? `<span class="vote-count">${count}</span>` : ''}</div>`;
        }).join('')}
      </div>`;
  }

  // Players cannot vote for themselves – render self as greyed-out, non-clickable
  const voteGridItems = targets.map((t) => {
    const isSelf = t.id === socket.id;
    if (isSelf) {
      // Show self but make it non-interactive
      return `<div class="choice vote-self-disabled" title="Du kannst nicht für dich selbst stimmen">
        <span>${esc(t.name)}</span>
        <span class="self-tag">Ich</span>
      </div>`;
    }
    const count = state.vote?.tally?.[t.id] || 0;
    const voteBar = count > 0
      ? `<div class="anon-vote-bar" style="width:${Math.min(count * 20, 100)}%"></div>`
      : '';
    return `<button class="choice vote-choice" data-target="${t.id}" data-type="vote">
      <span>${esc(t.name)}</span>
      ${count > 0 ? `<span class="vote-count">${count}</span>` : ''}
      ${voteBar}
    </button>`;
  }).join('');

  return `${progressBar}
    <p class="action-hint">Wähle, wen du für schuldig hältst. Deine Stimme ist anonym.</p>
    <div class="choice-grid">${voteGridItems}</div>
    ${isHost ? button('Niemand wird verurteilt', 'button secondary', 'skip') : ''}`;
}

/* ─── Wolf Action ─── */
function buildWolfAction(targets, own) {
  const s = state.selection;
  const totalWolves = s?.wolfTotalCount || 1;
  const votedWolves = s?.wolfVotedCount || 0;
  const hasCast = s?.wolfVoteCast || false;
  const myTarget = s?.wolfMyTarget || null;

  const wolfProgressBar = `<div class="wolf-vote-progress">
    <div class="vote-progress-bar wolf-bar">
      <span class="vote-progress-fill" style="width:${totalWolves > 0 ? (votedWolves / totalWolves) * 100 : 0}%"></span>
    </div>
    <span class="vote-progress-label">${votedWolves} von ${totalWolves} Wölfen haben abgestimmt</span>
  </div>`;

  return `<p class="action-hint">Wählt gemeinsam ein Opfer. Eure Abstimmung ist für das Rudel sichtbar.</p>
    ${wolfProgressBar}
    ${targetButtons(targets, 'act')}`;
}

/* ─── Target Buttons ─── */
function targetButtons(targets, type) {
  return `<div class="choice-grid">${targets
    .map((target) => {
      const isSelected =
        type === 'love'
          ? cupidChoices.includes(target.id)
          : type === 'act' && state.selection?.task === 'wolf'
            ? state.selection.wolfMyTarget === target.id
            : selected === target.id;

      const voteCount = type === 'vote' ? state.vote?.tally?.[target.id] || 0 : null;
      const wolfVoteCount =
        type === 'act' && state.selection?.task === 'wolf'
          ? state.selection.wolfVotes?.[target.id] || 0
          : null;
      const count = voteCount ?? wolfVoteCount;

      // Wolf voters: show who voted for this target (only for wolf task)
      const wolfVoters =
        type === 'act' && state.selection?.task === 'wolf'
          ? state.selection.wolfVoters?.[target.id] || []
          : [];
      const votersMarkup = wolfVoters.length
        ? `<div class="wolf-voters-list">${wolfVoters.map((v) => `<span class="wolf-voter-tag">🐺 ${esc(v)}</span>`).join('')}</div>`
        : '';

      // For day voting: only show count, no voter names (anonymous)
      const voteBar = type === 'vote' && count !== null && count > 0
        ? `<div class="anon-vote-bar" style="width:${Math.min(count * 20, 100)}%"></div>`
        : '';

      return `<button class="choice ${isSelected ? 'selected' : ''} ${type === 'vote' ? 'vote-choice' : ''}" data-target="${target.id}" data-type="${type}">
        <div class="choice-name">${esc(target.name)}${count !== null && count > 0 ? `<span class="vote-count">${count}</span>` : ''}</div>
        ${voteBar}
        ${votersMarkup}
      </button>`;
    })
    .join('')}</div>`;
}

/* ─── Reveal Ceremony ─── */
function revealCeremony() {
  if (state.revealDone)
    return `<div class="game ceremony-ready">
      <div class="phase">Kartenzeremonie</div>
      <h1 class="title">Du bist bereit.</h1>
      <div class="notice">
        <div class="ready-seal">✦</div>
        <p class="muted">Deine Schicksalskarte ist wieder sicher verborgen.</p>
        <p class="ceremony-count"><strong>${state.revealedCount}</strong> von ${state.players.length} Personen sind bereit</p>
        <div class="ready-progress"><span style="width:${(state.revealedCount / state.players.length) * 100}%"></span></div>
        <p class="muted small">Die Nacht beginnt automatisch, sobald alle ihre Karte geschlossen haben.</p>
      </div>
    </div>`;
  const r = state.own.role;
  const roleKey = r.name.toLowerCase().replace('ä', 'a');
  return `<div class="game reveal">
    <div class="phase">Kartenzeremonie · Nur für deine Augen</div>
    <h1 class="title">Dein Schicksal wartet.</h1>
    <p class="muted">Achte darauf, dass niemand auf deinen Bildschirm sieht.</p>
    <button id="destiny-card" class="destiny-card ${cardOpen ? 'is-open' : ''}" aria-label="Schicksalskarte umdrehen">
      <span class="card-face card-back">
        <span class="card-corner">✦</span>
        <span class="rune">☾</span>
        <b>YuWolf</b>
        <small>YU'S DÜSTERWALD</small>
        <span class="tap-hint">Antippen zum Aufdecken</span>
      </span>
      <span class="card-face card-front role-${roleKey}">
        <span class="role-constellation">✦ ✧ ✦</span>
        <span class="card-art">${r.icon}</span>
        <span class="card-name">${esc(r.name)}</span>
        <span class="card-copy">${esc(r.description)}</span>
        <span class="card-team">${r.team === 'wolf' ? 'Rudel der Nacht' : 'Dorf von Yu'}</span>
      </span>
    </button>
    <p class="muted card-instruction">${cardOpen ? 'Noch einmal tippen: Karte schließen und bereit melden.' : 'Deine Karte ist verdeckt und nur für dich bestimmt.'}</p>
  </div>`;
}

/* ─── Wire Events ─── */
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
    socket.emit('game:action', { kind: 'heal' });
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
        if (type === 'love') {
          if (cupidChoices.includes(selected))
            cupidChoices = cupidChoices.filter((id) => id !== selected);
          else if (cupidChoices.length < 2) cupidChoices.push(selected);
          else return toast('Du kannst nur zwei Personen auswählen.');
          return render();
        }
        socket.emit('game:action', { target: selected });
      }),
  );
  document.querySelector('#act')?.addEventListener('click', () => {
    if (cupidChoices.length !== 2) return toast('Wähle genau zwei verschiedene Personen.');
    socket.emit('game:action', { target: cupidChoices[0], second: cupidChoices[1] });
    cupidChoices = [];
    selected = null;
  });
  document.querySelectorAll('.kick-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (confirm('Diesen Spieler wirklich aus dem Spiel werfen?')) {
        socket.emit('lobby:kick', btn.dataset.kick);
      }
    };
  });
  const messages = document.querySelector('#messages');
  if (messages) messages.scrollTop = messages.scrollHeight;

  // Disable chat and reactions for dead players during active game
  const chatInput = document.querySelector('#chat-input');
  const sendBtn = document.querySelector('#send');
  const reactionBar = document.querySelector('#reaction-bar');
  const isDead = state?.own && !state.own.alive;
  const isActiveGame = state?.phase !== 'lobby' && state?.phase !== 'ended';
  if (isDead && isActiveGame) {
    if (chatInput) {
      chatInput.disabled = true;
      chatInput.placeholder = '💀 Tote können nicht schreiben';
      chatInput.title = 'Du bist ausgeschieden und kannst nicht mehr chatten';
    }
    if (sendBtn) sendBtn.disabled = true;
    if (reactionBar) reactionBar.style.opacity = '0.3';
    if (reactionBar) reactionBar.style.pointerEvents = 'none';
  } else {
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.placeholder = 'Schreibe ins Dorf\u2026';
      chatInput.title = '';
    }
    if (sendBtn) sendBtn.disabled = false;
    if (reactionBar) { reactionBar.style.opacity = ''; reactionBar.style.pointerEvents = ''; }
  }
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
    // Reactions render as normal chat messages – no special huge emoji display
    row.className = message.system ? 'message system' : 'message';
    if (message.system) {
      const icon = document.createElement('span');
      icon.className = 'msg-icon';
      icon.textContent = '◆';
      row.append(icon, document.createTextNode(message.text));
    } else {
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
function clearPhaseTimerDisplay() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}
function updatePhaseTimerDisplay() {
  clearPhaseTimerDisplay();
  const display = document.querySelector('#phase-timer');
  if (!display) return;
  const deadline = Number(display.dataset.deadline);
  const update = () => {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    display.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    display.closest('.phase-timer')?.classList.toggle('is-ending', seconds <= 10);
    if (seconds === 0) clearPhaseTimerDisplay();
  };
  update();
  timerInterval = setInterval(update, 250);
}

/* ─── Socket Events ─── */
socket.on('connect', () => (connection.textContent = '● Verbunden'));
socket.on('disconnect', () => (connection.textContent = '○ Verbindung verloren'));
socket.on('app:error', (message) => {
  lobbyRequestPending = false;
  document
    .querySelectorAll('#create, #join')
    .forEach((buttonElement) => buttonElement.removeAttribute('disabled'));
  toast(message, 'error');
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
  cupidChoices = [];
  vision = null;
  render();
});
socket.on('game:vision', (v) => {
  vision = v;
  render();
});
socket.on('game:privateResult', showPrivateResult);
function showPrivateResult(result) {
  document.querySelector('#private-result')?.remove();
  const modal = document.createElement('section');
  modal.id = 'private-result';
  modal.className = 'private-result';
  const card = document.createElement('div');
  card.className = `private-result-card ${result?.theme || ''}`;
  const icon = document.createElement('div');
  icon.className = 'private-result-icon';
  icon.textContent = result?.icon || '✦';
  const title = document.createElement('h2');
  title.textContent = result?.title || 'Geheime Information';
  const text = document.createElement('p');
  text.textContent = result?.text || '';
  const hint = document.createElement('small');
  hint.textContent = 'Dieses Wissen gehört nur dir.';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'button';
  close.textContent = 'Verstanden';
  close.onclick = () => modal.remove();
  card.append(icon, title, text, hint, close);
  modal.append(card);
  modal.onclick = (event) => {
    if (event.target === modal) modal.remove();
  };
  document.body.append(modal);
  close.focus();
}
function showGameEndModal(winner, players, own) {
  document.querySelector('#game-end-modal')?.remove();
  const modal = document.createElement('section');
  modal.id = 'game-end-modal';
  modal.className = 'game-end-modal';
  const isWolfWin = winner?.toLowerCase().includes('werwölfe');
  const isVillageWin = winner?.toLowerCase().includes('dorf');
  const themeClass = isWolfWin ? 'wolf-win' : (isVillageWin ? 'village-win' : 'other-win');

  const content = document.createElement('div');
  content.className = `game-end-content ${themeClass}`;
  
  const title = document.createElement('h1');
  title.className = 'game-end-title';
  title.textContent = winner || 'Das Spiel ist vorbei';
  
  const subtitle = document.createElement('p');
  subtitle.className = 'game-end-subtitle';
  subtitle.textContent = own?.alive ? 'Du hast überlebt!' : 'Du bist ausgeschieden.';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'button game-end-close';
  closeBtn.textContent = 'Ergebnisse ansehen';
  closeBtn.onclick = () => {
    modal.classList.add('fade-out');
    setTimeout(() => modal.remove(), 400);
  };

  content.append(title, subtitle, closeBtn);
  modal.append(content);
  document.body.append(modal);

  // Trigger animation frame for CSS transition
  requestAnimationFrame(() => modal.classList.add('visible'));
}

landing();
