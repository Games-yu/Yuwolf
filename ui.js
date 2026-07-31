const YU_ROLES = [
  ['seer', '🔮', 'Seherin'],
  ['witch', '⚗️', 'Hexe'],
  ['hunter', '🏹', 'Jäger'],
  ['cupid', '💘', 'Amor'],
  ['guardian', '🛡️', 'Schutzgeist'],
  ['fool', '🃏', 'Narr'],
  ['piper', '🎶', 'Flötenspieler'],
  ['thief', '🗝️', 'Diebin'],
  ['girl', '👁️', 'Mädchen'],
  ['witchhunter', '🔥', 'Hexenjäger'],
  ['vampire', '🧛', 'Vampir'],
  ['doppelganger', '🎭', 'Doppelgänger'],
];
const ROLE_HINTS = {
  seer: 'Erfährt nachts eine Rolle.',
  witch: 'Heilt oder vergiftet einmal.',
  hunter: 'Nimmt beim Tod jemanden mit.',
  cupid: 'Verbindet zwei Herzen.',
  guardian: 'Schützt nachts eine Person.',
  fool: 'Gewinnt bei eigener Verurteilung.',
  piper: 'Verzaubert das Dorf.',
  thief: 'Wählt ein neues Schicksal.',
  girl: 'Sieht das Wolfsrudel.',
  witchhunter: 'Spürt die Hexe auf.',
  vampire: 'Jagt nachts allein.',
  doppelganger: 'Wählt ein Schicksalsvorbild.',
};

/* ── Injected Styles ── */
const yuStyle = document.createElement('style');
yuStyle.textContent = `
  .yu-modal{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:18px;background:#03050bba;backdrop-filter:blur(7px)}
  .yu-dialog{width:min(720px,100%);max-height:min(780px,calc(100vh - 36px));overflow:auto;padding:28px;border:1px solid #ffffff20;border-radius:16px;background:#131725;color:#fff;box-shadow:0 24px 90px #000a}
  .yu-dialog-head{display:flex;align-items:start;justify-content:space-between;gap:20px}
  .yu-dialog h2{margin:5px 0 0;font-family:Cinzel,serif}
  .yu-close{border:0;background:transparent;color:#fff;font-size:30px;cursor:pointer;line-height:1}
  .yu-role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:20px 0}
  .yu-role-grid .check{position:relative}
  .yu-role-grid .check:hover:after{content:attr(title);position:absolute;left:0;bottom:calc(100% + 6px);z-index:3;width:190px;padding:8px;border-radius:7px;background:#090b13;color:#eef0f5;font-size:11px;line-height:1.35;box-shadow:0 8px 24px #0008}
  .yu-rule{margin-bottom:18px;display:block}
  .yu-settings-extras{display:grid;gap:14px;margin:10px 0 20px}
  .yu-field{display:grid;gap:7px;color:#d8dbe6;font-size:12px;font-weight:700;letter-spacing:.7px;text-transform:uppercase}
  .yu-field select,.yu-field textarea{width:100%;border:1px solid #ffffff20;border-radius:8px;background:#090b13;color:#fff;padding:11px;font:14px Inter,sans-serif;resize:vertical;min-height:42px}
  .yu-field textarea{min-height:90px}

  /* Leave confirm dialog */
  .leave-confirm-modal{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:18px;background:#03050bc0;backdrop-filter:blur(10px);animation:fadeInModal .2s ease}
  .leave-confirm-card{width:min(420px,96vw);padding:28px 24px;border:1px solid #e54d4d66;border-radius:16px;background:linear-gradient(145deg,#1a1020,#0e0a18);box-shadow:0 24px 70px #000b;text-align:center}
  .leave-confirm-card h3{font:700 22px Cinzel,serif;margin:0 0 10px;color:#ffaaaa}
  .leave-confirm-card p{font-size:13px;color:#d8dbe8;line-height:1.6;margin:0 0 20px}
  .leave-confirm-actions{display:flex;gap:10px;justify-content:center}
  .leave-confirm-actions .button{min-width:130px}

  @media(max-width:620px){
    .yu-modal{padding:0;align-items:end}
    .yu-dialog{max-height:88vh;border-radius:18px 18px 0 0;padding:22px 18px}
    .yu-role-grid{grid-template-columns:1fr}
  }
`;
document.head.appendChild(yuStyle);

/* ── Leave Confirmation Modal ── */
function showLeaveConfirm(isActiveGame) {
  document.querySelector('#leave-confirm')?.remove();
  const modal = document.createElement('div');
  modal.id = 'leave-confirm';
  modal.className = 'leave-confirm-modal';
  const inGame = isActiveGame && state?.phase && !['lobby','ended'].includes(state.phase);
  modal.innerHTML = `<div class="leave-confirm-card">
    <h3>⚠ ${inGame ? 'Laufende Runde verlassen?' : 'Lobby verlassen?'}</h3>
    <p>${inGame
      ? 'Du verlässt eine laufende Runde. Deine Rolle bleibt <strong>2 Minuten</strong> reserviert – du kannst mit demselben Namen zurückkehren.'
      : 'Möchtest du Yu\'s DüsterWald wirklich verlassen?'
    }</p>
    <div class="leave-confirm-actions">
      <button class="button secondary" id="leave-cancel">Bleiben</button>
      <button class="button" id="leave-confirm-btn" style="background:#e54d4d;color:#fff;">Verlassen</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#leave-cancel').onclick = () => modal.remove();
  modal.querySelector('#leave-confirm-btn').onclick = () => {
    modal.remove();
    socket.emit('lobby:leave');
  };
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#leave-cancel').focus();
}

/* ── Role Settings Modal ── */
function openRoleSettings() {
  document.querySelector('#role-settings')?.remove();
  const chosen = new Set(state.settings?.roles || []);
  const modal = document.createElement('div');
  modal.id = 'role-settings';
  modal.className = 'yu-modal';
  modal.innerHTML = `<div class="yu-dialog">
    <div class="yu-dialog-head">
      <div><div class="eyebrow">Host-Steuerung</div><h2>Rollen &amp; Regeln</h2></div>
      <button id="close-settings" class="yu-close" aria-label="Schließen">×</button>
    </div>
    <p class="muted">Aktiviere nur Rollen, die wirklich mitspielen sollen. Bei wenig Personen werden passende Rollen zufällig aus deiner Auswahl gezogen.</p>
    <div class="yu-role-grid">${YU_ROLES.map(([key, icon, label]) =>
      `<label class="check"><input type="checkbox" value="${key}" ${chosen.has(key) ? 'checked' : ''}> ${icon} ${label}</label>`
    ).join('')}</div>
    <label class="check yu-rule"><input id="mayor-rule" type="checkbox" ${state.settings?.mayor ? 'checked' : ''}> 👑 Bürgermeisterwahl aktivieren</label>
    <label class="check yu-rule"><input id="unlimited-time" type="checkbox" ${state.settings?.unlimitedTime ? 'checked' : ''}> ⏳ Unbegrenzte Zeit (Kein Timer)</label>
    <button id="save-settings" class="button">Regeln speichern</button>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('.yu-role-grid label').forEach((label) => {
    const hint = ROLE_HINTS[label.querySelector('input').value];
    if (hint) label.title = hint;
  });
  const extras = document.createElement('section');
  extras.className = 'yu-settings-extras';
  extras.innerHTML = `
    <label class="yu-field">Themenraum<select id="theme-rule">
      <option value="forest">Klassischer Wald</option>
      <option value="school">Verlassene Schule</option>
      <option value="fairy">Märchendorf</option>
      <option value="cyber">Cyber-DüsterWald</option>
    </select></label>
    <label class="check yu-rule"><input id="vote-reveal" type="checkbox" ${state.settings?.voteReveal !== false ? 'checked' : ''}> Abstimmungsverlauf nach dem Tag zeigen</label>
    <label class="yu-field">Hausregeln<textarea id="house-rules" maxlength="700" placeholder="z. B. Keine Rollenbehauptungen vor Tag 2.">${state.settings?.houseRules || ''}</textarea></label>
  `;
  modal.querySelector('#save-settings').before(extras);
  modal.querySelector('#theme-rule').value = state.settings?.theme || 'forest';
  modal.querySelector('#close-settings').onclick = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#save-settings').onclick = () => {
    const roles = [...modal.querySelectorAll('.yu-role-grid input:checked')].map((i) => i.value);
    socket.emit('lobby:updateSettings', {
      roles,
      mayor: modal.querySelector('#mayor-rule').checked,
      unlimitedTime: modal.querySelector('#unlimited-time').checked,
      houseRules: modal.querySelector('#house-rules').value,
      voteReveal: modal.querySelector('#vote-reveal').checked,
      theme: modal.querySelector('#theme-rule').value,
    });
    modal.remove();
  };
}

/* ════════════════════════════════════════════════
   ENHANCE UI – called after every render
   ════════════════════════════════════════════════ */
function enhanceYuWolfUi() {
  if (state?.settings?.theme) document.body.dataset.theme = state.settings.theme;
  else delete document.body.dataset.theme;

  /* ── Random name on landing ── */
  const nameInput = document.querySelector('#create-name');
  if (nameInput && !document.querySelector('#random-name')) {
    const randomNames = [
      'Mondmuffel','NebelNase','KrähenKind','Schattenfuchs','LunaLärm',
      'Wolfswatte','DunkelDachs','ZimtZahn','EulenEcho','KesselKeks',
      'MorgenMotte','RabenRudi',
    ];
    const randomName = document.createElement('button');
    randomName.id = 'random-name';
    randomName.type = 'button';
    randomName.className = 'button secondary random-name';
    randomName.style.cssText = 'justify-self:start;margin-top:-3px;min-height:34px;padding:0 12px;font-size:10px;';
    randomName.textContent = 'Zufallsname';
    randomName.onclick = () => {
      const base = randomNames[Math.floor(Math.random() * randomNames.length)];
      nameInput.value = `${base}${Math.floor(10 + Math.random() * 90)}`;
      nameInput.focus();
    };
    nameInput.insertAdjacentElement('afterend', randomName);
  }

  /* Hide inline roles (managed via settings modal) */
  const roleConfig = document.querySelector('.roles');
  if (roleConfig) roleConfig.style.display = 'none';

  /* ── Invite link autofill ── */
  if (joinMatch && !state && !document.querySelector('#invite-notice')) {
    const joinCode = document.querySelector('#join-code');
    const joinName = document.querySelector('#join-name');
    const joinButton = document.querySelector('#join');
    const joinForm = joinCode?.closest('.form');
    if (joinCode && joinName && joinButton && joinForm) {
      joinCode.value = joinMatch[1].toUpperCase();
      joinCode.readOnly = true;
      joinButton.textContent = 'Einladung beitreten';
      const inviteNotice = document.createElement('p');
      inviteNotice.id = 'invite-notice';
      inviteNotice.className = 'invite-notice';
      inviteNotice.textContent = `Einladung zu Lobby ${joinCode.value} · Gib deinen Namen ein und tritt bei.`;
      joinForm.prepend(inviteNotice);
      joinName.focus();
    }
  }

  const inLobby = Boolean(document.querySelector('.room'));
  const header = document.querySelector('header');

  /* ── Header Actions ── */
  let headerActions = document.querySelector('#header-actions');
  if (inLobby && !headerActions) {
    headerActions = document.createElement('div');
    headerActions.id = 'header-actions';
    headerActions.className = 'header-actions';
    header.appendChild(headerActions);
  }

  /* ── Leave Button – with confirmation ── */
  let leave = document.querySelector('#leave-lobby');
  if (inLobby && !leave) {
    leave = document.createElement('button');
    leave.id = 'leave-lobby';
    leave.className = 'button';
    leave.textContent = 'Lobby verlassen';
    leave.onclick = () => {
      const isActiveGame = state?.phase && !['lobby', 'ended'].includes(state.phase);
      showLeaveConfirm(isActiveGame);
    };
    headerActions.appendChild(leave);
  } else if (!inLobby && leave) leave.remove();

  /* ── Copy Invite ── */
  if (inLobby && !document.querySelector('#copy-invite')) {
    const invite = document.createElement('button');
    invite.id = 'copy-invite';
    invite.className = 'button secondary';
    invite.textContent = 'Einladungslink';
    invite.onclick = async () => {
      const link = `${location.origin}/join/${state.code}`;
      try {
        await navigator.clipboard.writeText(link);
        toast('Einladungslink kopiert.');
      } catch {
        prompt('Kopiere diesen Einladungslink:', link);
      }
    };
    headerActions?.appendChild(invite);
  }
  if (!inLobby) {
    document.querySelector('#copy-invite')?.remove();
    document.querySelector('#header-actions')?.remove();
  }

  /* ── Ready Button (Lobby Phase) ── */
  if (state?.phase === 'lobby' && !document.querySelector('#ready-button')) {
    const centerNotice = document.querySelector('.game .notice');
    if (centerNotice) {
      const me = state.players.find((p) => p.id === socket.id);
      const ready = document.createElement('button');
      ready.id = 'ready-button';
      ready.className = `button ${me?.ready ? 'secondary' : ''}`;
      ready.textContent = me?.ready ? 'Nicht bereit' : 'Ich bin bereit';
      ready.onclick = () => socket.emit('lobby:ready');
      centerNotice.appendChild(ready);
      const status = document.createElement('p');
      const readyCount = state.players.filter((p) => p.ready).length;
      status.className = 'ready-status muted';
      status.style.cssText = 'font-size:12px;margin:8px 0 0;';
      status.textContent = `${readyCount}/${state.players.length} Spielende bereit`;
      centerNotice.appendChild(status);
    }
  }

  /* ── Settings Button (Host, Lobby Phase) ── */
  const start = document.querySelector('#start');
  if (start && state?.hostId === socket.id && !document.querySelector('#open-settings')) {
    const settings = document.createElement('button');
    settings.id = 'open-settings';
    settings.className = 'button secondary';
    settings.textContent = 'Rollen & Regeln';
    settings.onclick = openRoleSettings;
    start.insertAdjacentElement('beforebegin', settings);
  }

  /* ── Lobby Actions grouping ── */
  if (state?.phase === 'lobby') {
    const notice = document.querySelector('.game .notice');
    const controls = ['#start', '#open-settings', '#ready-button']
      .map((sel) => document.querySelector(sel))
      .filter(Boolean);
    if (notice && controls.length) {
      let actions = document.querySelector('#lobby-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.id = 'lobby-actions';
        actions.className = 'lobby-actions';
        notice.appendChild(actions);
      }
      controls.forEach((ctrl) => { if (ctrl.parentElement !== actions) actions.appendChild(ctrl); });
    }
  }

  /* ── Host Moderation (Kick) ── */
  if (
    state?.phase === 'lobby' &&
    state.hostId === socket.id &&
    state.players.some((p) => p.id !== socket.id) &&
    !document.querySelector('#host-moderation')
  ) {
    const centerNotice = document.querySelector('.game .notice');
    if (centerNotice) {
      const moderation = document.createElement('section');
      moderation.id = 'host-moderation';
      moderation.className = 'host-moderation';
      moderation.innerHTML = `<div class="eyebrow">Lobby verwalten</div>${state.players
        .filter((p) => p.id !== socket.id)
        .map((p) => `<button data-kick="${p.id}">${p.name} <span>entfernen</span></button>`)
        .join('')}`;
      centerNotice.appendChild(moderation);
      moderation.querySelectorAll('[data-kick]').forEach((btn) => {
        btn.onclick = () => {
          if (confirm(`${btn.textContent.trim().replace('entfernen', '').trim()} entfernen?`))
            socket.emit('lobby:kick', btn.dataset.kick);
        };
      });
    }
  }

  /* ── Active Role Preview (Lobby) ── */
  if (state?.phase === 'lobby' && !document.querySelector('#active-role-preview')) {
    const centerNotice = document.querySelector('.game .notice');
    const activeRoles = YU_ROLES.filter(([key]) => state.settings?.roles?.includes(key));
    if (centerNotice && activeRoles.length) {
      const preview = document.createElement('section');
      preview.id = 'active-role-preview';
      preview.className = 'active-role-preview';
      preview.innerHTML = `<div class="eyebrow">Aktive Rollen</div>${activeRoles
        .map(([key, icon, label]) => `<div><span>${icon} ${label}</span><small>${ROLE_HINTS[key]}</small></div>`)
        .join('')}`;
      centerNotice.appendChild(preview);
    }
  }

  /* ── House Rules Card (Lobby) ── */
  if (state?.phase === 'lobby' && state.settings?.houseRules && !document.querySelector('#house-rules-card')) {
    const centerNotice = document.querySelector('.game .notice');
    if (centerNotice) {
      const rules = document.createElement('section');
      rules.id = 'house-rules-card';
      rules.className = 'house-rules-card';
      const safeRules = state.settings.houseRules
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      rules.innerHTML = `<div class="eyebrow">Hausregeln</div><p>${safeRules}</p>`;
      centerNotice.appendChild(rules);
    }
  }

  /* ── Rematch Button (Host, Ended) ── */
  if (state?.phase === 'ended' && state.hostId === socket.id && !document.querySelector('#rematch')) {
    const notice = document.querySelector('.game .notice');
    if (notice) {
      const rematch = document.createElement('button');
      rematch.id = 'rematch';
      rematch.className = 'button secondary';
      rematch.style.cssText = 'margin-top:12px;';
      rematch.textContent = 'Gleiche Lobby erneut spielen';
      rematch.onclick = () => socket.emit('game:rematch');
      notice.appendChild(rematch);
    }
  }

  /* ── Hide destiny card if side rolecard shown ── */
  if (document.querySelector('#destiny-card'))
    document.querySelector('.rolecard-panel')?.style.setProperty('display', 'none');

  /* ── Day vote: quick vote buttons for non-hosts ── */
  if (state?.phase === 'day' && !state.vote?.cast && !document.querySelector('[data-type="vote"]')) {
    const notice = document.querySelector('.game .notice');
    const targets = state.selection?.targets || [];
    const isSpectator = state.own && !state.own.alive;
    if (notice && targets.length && !isSpectator) {
      const vote = document.createElement('div');
      vote.id = 'quick-vote';
      const totalVoters = state.players.filter((p) => p.alive).length;
      const votedCount = state.vote?.count || 0;
      vote.innerHTML = `
        <div class="vote-progress-wrap">
          <div class="vote-progress-bar"><span class="vote-progress-fill" style="width:${totalVoters > 0 ? (votedCount/totalVoters)*100 : 0}%"></span></div>
          <span class="vote-progress-label">${votedCount} von ${totalVoters} haben abgestimmt</span>
        </div>
        <p class="action-hint" style="margin-top:12px;">Wähle, wen du für schuldig hältst. Deine Stimme ist anonym.</p>
        <div class="choice-grid">${targets.map((t) =>
          `<button class="choice" data-online-vote="${t.id}">
            <div class="choice-name">${t.name}${state.vote?.tally?.[t.id] ? `<span class="vote-count">${state.vote.tally[t.id]}</span>` : ''}</div>
          </button>`
        ).join('')}</div>`;
      notice.appendChild(vote);
      vote.querySelectorAll('[data-online-vote]').forEach(
        (btn) => (btn.onclick = () => socket.emit('game:vote', btn.dataset.onlineVote)),
      );
    }
  }

  /* ── Suspicion Board (Day) ── */
  if (state?.phase === 'day' && !document.querySelector('#suspicion-board')) {
    const notice = document.querySelector('.game .notice');
    const targets = state.selection?.targets || [];
    const isSpectator = state.own && !state.own.alive;
    if (notice && targets.length) {
      const board = document.createElement('section');
      board.id = 'suspicion-board';
      board.className = 'suspicion-board';
      board.innerHTML = `<p class="muted" style="font-size:11px;margin:0 0 8px;">Misstrauensmarker · unverbindlich</p><div>${targets
        .map((t) => `<button class="suspect" data-suspect="${t.id}">⚑ ${t.name} <small>${state.suspicions?.[t.id] || 0}</small></button>`)
        .join('')}</div>`;
      notice.appendChild(board);
      if (!isSpectator) {
        board.querySelectorAll('[data-suspect]').forEach(
          (btn) => (btn.onclick = () => socket.emit('day:mark', btn.dataset.suspect)),
        );
      }
    }
  }

  /* ── Private Notes ── */
  if (inLobby && !document.querySelector('#private-notes')) {
    const side = document.querySelector('.side');
    if (side) {
      const notes = document.createElement('article');
      notes.id = 'private-notes';
      notes.className = 'panel private-notes';
      const noteKey = `yuwolf-notes-${state.code}`;
      notes.innerHTML = `<div class="eyebrow">Privates Notizbuch</div><textarea placeholder="Nur du kannst diese Notizen sehen."></textarea><small>Wird nur in diesem Browser gespeichert.</small>`;
      const field = notes.querySelector('textarea');
      field.value = localStorage.getItem(noteKey) || '';
      field.addEventListener('input', () => localStorage.setItem(noteKey, field.value.slice(0, 2000)));
      side.appendChild(notes);
    }
  }

  /* ── Reaction Bar ── */
  if (inLobby && !document.querySelector('#reaction-bar')) {
    const send = document.querySelector('.send');
    if (send) {
      const reactions = document.createElement('div');
      reactions.id = 'reaction-bar';
      reactions.innerHTML = ['🕵️', '⚑', '😱', '👏', '🤔']
        .map((emoji) => `<button data-reaction="${emoji}" title="Reaktion senden">${emoji}</button>`)
        .join('');
      send.before(reactions);
      reactions.querySelectorAll('[data-reaction]').forEach(
        (btn) => (btn.onclick = () => socket.emit('chat:reaction', btn.dataset.reaction)),
      );
    }
  }
}

/* ── Routing ── */
socket.on('lobby:left', () => window.location.assign('/'));
const joinMatch = location.pathname.match(/^\/join\/([A-Z0-9]{6})$/i);
app.addEventListener('yuwolf:render', enhanceYuWolfUi);
enhanceYuWolfUi();
