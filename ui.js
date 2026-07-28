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
const yuStyle = document.createElement('style');
yuStyle.textContent = `.yu-modal{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:18px;background:#03050bba;backdrop-filter:blur(7px)}.yu-dialog{width:min(720px,100%);max-height:min(780px,calc(100vh - 36px));overflow:auto;padding:28px;border:1px solid #ffffff20;border-radius:16px;background:#131725;color:#fff;box-shadow:0 24px 90px #000a}.yu-dialog-head{display:flex;align-items:start;justify-content:space-between;gap:20px}.yu-dialog h2{margin:5px 0 0;font-family:Cinzel,serif}.yu-close{border:0;background:transparent;color:#fff;font-size:30px;cursor:pointer}.yu-role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:20px 0}.yu-role-grid .check{position:relative}.yu-role-grid .check:hover:after{content:attr(title);position:absolute;left:0;bottom:calc(100% + 6px);z-index:3;width:190px;padding:8px;border-radius:7px;background:#090b13;color:#eef0f5;font-size:11px;line-height:1.35;box-shadow:0 8px 24px #0008}.yu-rule{margin-bottom:18px;display:block}.yu-settings-extras{display:grid;gap:14px;margin:10px 0 20px}.yu-field{display:grid;gap:7px;color:#d8dbe6;font-size:12px;font-weight:700;letter-spacing:.7px;text-transform:uppercase}.yu-field select,.yu-field textarea{width:100%;border:1px solid #ffffff20;border-radius:8px;background:#090b13;color:#fff;padding:11px;font:14px Inter,sans-serif;resize:vertical;min-height:42px}.yu-field textarea{min-height:90px}@media(max-width:620px){.yu-modal{padding:0;align-items:end}.yu-dialog{max-height:88vh;border-radius:18px 18px 0 0;padding:22px 18px}.yu-role-grid{grid-template-columns:1fr}.topbar,.room{gap:12px}.button{min-height:44px}}`;
document.head.appendChild(yuStyle);
const layoutStyle = document.createElement('style');
layoutStyle.textContent = `
  #app{max-width:1280px;padding:48px 24px 72px}
  .room{grid-template-columns:minmax(230px,280px) minmax(420px,1fr) minmax(260px,310px);gap:28px;align-items:start}
  .room>.side,.room>.chat{position:sticky;top:22px}
  .room>.side{gap:18px}.room>.panel,.room .side .panel{border-radius:16px}
  .game{padding:2px 0}.game .title{margin-bottom:16px}.game .notice{padding:32px 30px;min-height:260px;display:block}
  .game .notice>#open-settings,.game .notice>#start{margin:8px 5px;min-height:46px}
  .game .notice>#open-settings{min-width:176px}
  .game .notice>#start{display:block;min-width:180px;margin:14px auto 0}
  #connection{display:none}header{position:relative;justify-content:flex-start}.header-actions{margin-left:auto;display:flex;align-items:center;gap:8px}.header-actions .button{min-height:34px;padding:0 12px;border-radius:8px;font-size:10px;letter-spacing:.7px;white-space:nowrap}.header-actions #leave-lobby{background:#24293a}.header-actions #copy-invite{background:#30364b}
  .chat{border-radius:16px!important;min-height:410px}.send{gap:10px}.send .button{min-width:86px}
  .players li{min-height:44px;align-items:center}.code{font-size:30px;letter-spacing:5px}
  .landing-grid{justify-content:center}.landing-grid>.panel{width:100%;margin:0}.hero{margin-bottom:32px}
  .random-name{justify-self:start;margin-top:-3px;min-height:36px;padding:0 12px;font-size:10px}
  @media(max-width:1050px){#app{max-width:840px}.room{grid-template-columns:minmax(230px,300px) minmax(0,1fr);gap:20px}.room>.chat{grid-column:1/-1;position:static;min-height:260px}.room>.side{position:static}}
  @media(max-width:720px){#app{padding:28px 14px 52px}.topbar,header{padding-inline:16px}.brand{font-size:16px}.header-actions{gap:5px;flex-wrap:wrap;justify-content:flex-end}.header-actions .button{padding:0 8px;font-size:9px}.room{grid-template-columns:1fr;gap:14px}.room>.chat{grid-column:auto;min-height:300px}.room>.side{display:grid;grid-template-columns:1fr;gap:12px}.game .notice{padding:24px 16px;min-height:0}.game .notice>#open-settings,.game .notice>#start{display:block;width:100%;margin:10px 0}.game .notice>#open-settings{min-width:0}.hero h1{font-size:42px}.hero p{font-size:15px}.chat{min-height:310px}.send .button{min-width:76px}}
`;
document.head.appendChild(layoutStyle);
const experienceStyle = document.createElement('style');
experienceStyle.textContent = `
  .reveal .title{margin-bottom:8px}.destiny-card{outline:none}.destiny-card:focus-visible{filter:drop-shadow(0 0 12px #e5bd68)}
  .card-back{background:radial-gradient(circle at 50% 25%,#52679d,#101322 66%)!important}.card-back:after{content:'';position:absolute;inset:28px;border:1px solid #e5bd6870;border-radius:12px}.card-corner{position:absolute;top:22px;right:24px;color:#e5bd68;font-size:20px}.tap-hint{position:absolute;bottom:42px;color:#e5bd68cc;font:700 10px Inter,sans-serif;letter-spacing:1.8px;text-transform:uppercase}.role-constellation{position:absolute;top:29px;color:#f6df9d88;letter-spacing:9px}.card-instruction{min-height:24px;font-weight:600}.ceremony-ready .notice{max-width:490px;min-height:0}.ready-seal{font:64px Cinzel,serif;color:#e5bd68;text-shadow:0 0 24px #e5bd6877}.ceremony-count{margin:14px 0 10px;color:#daddea}.ceremony-count strong{font:700 28px Cinzel,serif;color:#e5bd68}.ready-progress{height:8px;border-radius:99px;background:#050711;border:1px solid #ffffff19;overflow:hidden}.ready-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#b6843d,#f1d47c);transition:width .5s ease}.small{font-size:12px;margin-top:16px}.choice{transition:transform .16s ease,border-color .16s ease,background .16s ease}.choice:hover{transform:translateY(-2px)}.phase{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid #e5bd6855;border-radius:99px;background:#11162699}.log{max-height:230px;overflow:auto}.message.system{border-left:2px solid #e5bd6888;padding-left:9px}
  @media(max-width:720px){.destiny-card{width:min(340px,94vw);height:470px}.card-name{font-size:29px}.card-art{font-size:94px}.card-copy{font-size:13px}.tap-hint{bottom:32px}.ceremony-ready .notice{padding:22px 16px}}
  .private-notes textarea{width:100%;min-height:120px;margin:12px 0 6px;resize:vertical;border:1px solid #ffffff1f;border-radius:8px;background:#090b13;color:#f3f4f8;padding:10px;font:13px/1.5 Inter,sans-serif}.private-notes small{color:#9da1b0;font-size:10px}.suspicion-board{margin-top:22px;padding-top:16px;border-top:1px solid #ffffff16}.suspicion-board>div{display:flex;flex-wrap:wrap;gap:7px}.suspect{border:1px solid #ffffff20;border-radius:99px;background:#171c2a;color:#e5e7ef;padding:7px 10px;font:600 11px Inter,sans-serif;cursor:pointer}.suspect:hover{border-color:#e5bd68;color:#f2cd77}.suspect small{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:3px;border-radius:50%;background:#343b52;color:#fff}
  .house-rules-card{margin:22px 0 4px;padding:16px;border-top:1px solid #e5bd6845;border-bottom:1px solid #e5bd6825;text-align:left}.house-rules-card p{margin:8px 0 0;color:#d9dce8;font-size:13px;line-height:1.55}
  .ready-status{margin:10px 0 0;font-size:12px}.host-moderation{display:grid;gap:6px;margin-top:18px;text-align:left}.host-moderation>.eyebrow{margin-bottom:3px}.host-moderation button{display:flex;justify-content:space-between;border:1px solid #ffffff18;border-radius:7px;background:#101421;color:#dfe2ec;padding:9px;font:600 12px Inter,sans-serif;cursor:pointer}.host-moderation button span{color:#e58a8a;font-size:10px;text-transform:uppercase}.host-moderation button:hover{border-color:#ca6970}.chat #reaction-bar{display:flex;gap:5px;margin-top:auto;padding-top:10px}.chat #reaction-bar button{border:1px solid #ffffff1d;border-radius:7px;background:#171c29;padding:5px 7px;cursor:pointer}.chat #reaction-bar button:hover{border-color:#e5bd68;transform:translateY(-1px)}
  .spectator-mode{margin:10px 0;padding:9px 10px;border-radius:8px;background:#242033;color:#ded3f4;font-size:11px;line-height:1.4}
  .active-role-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:20px;text-align:left}.active-role-preview>.eyebrow{grid-column:1/-1}.active-role-preview>div{padding:9px;border:1px solid #ffffff16;border-radius:8px;background:#0d101b}.active-role-preview span{display:block;font-size:12px;font-weight:700;color:#f0f1f5}.active-role-preview small{display:block;margin-top:4px;color:#aeb2c1;font-size:10px;line-height:1.35}
  body[data-theme="school"]{background:radial-gradient(ellipse at 50% -15%,#46505b,#151619 46%,#08090b)}body[data-theme="fairy"]{background:radial-gradient(ellipse at 50% -15%,#6c3b70,#191329 46%,#08070d)}body[data-theme="cyber"]{background:radial-gradient(ellipse at 50% -15%,#114c62,#071923 46%,#03070a)}body[data-theme="school"] .moon{background:#c6bd9b}body[data-theme="fairy"] .moon{background:#ffd5ef}body[data-theme="cyber"] .moon{background:#8cf4ff}
`;
document.head.appendChild(experienceStyle);

function openRoleSettings() {
  document.querySelector('#role-settings')?.remove();
  const chosen = new Set(state.settings?.roles || []);
  const modal = document.createElement('div');
  modal.id = 'role-settings';
  modal.className = 'yu-modal';
  modal.innerHTML = `<div class="yu-dialog"><div class="yu-dialog-head"><div><div class="eyebrow">Host-Steuerung</div><h2>Rollen & Regeln</h2></div><button id="close-settings" class="yu-close" aria-label="Schließen">×</button></div><p class="muted">Aktiviere nur Rollen, die wirklich mitspielen sollen. Bei wenig Personen werden passende Rollen zufällig aus deiner Auswahl gezogen.</p><div class="yu-role-grid">${YU_ROLES.map(([key, icon, label]) => `<label class="check"><input type="checkbox" value="${key}" ${chosen.has(key) ? 'checked' : ''}> ${icon} ${label}</label>`).join('')}</div><label class="check yu-rule"><input id="mayor-rule" type="checkbox" ${state.settings?.mayor ? 'checked' : ''}> 👑 Bürgermeisterwahl aktivieren</label><button id="save-settings" class="button">Regeln speichern</button></div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('.yu-role-grid label').forEach((label) => {
    const hint = ROLE_HINTS[label.querySelector('input').value];
    if (hint) label.title = hint;
  });
  const extras = document.createElement('section');
  extras.className = 'yu-settings-extras';
  extras.innerHTML = `<label class="yu-field">Themenraum<select id="theme-rule"><option value="forest">Klassischer Wald</option><option value="school">Verlassene Schule</option><option value="fairy">Märchendorf</option><option value="cyber">Cyber-DüsterWald</option></select></label><label class="check yu-rule"><input id="vote-reveal" type="checkbox" ${state.settings?.voteReveal !== false ? 'checked' : ''}> Abstimmungsverlauf nach dem Tag zeigen</label><label class="yu-field">Hausregeln<textarea id="house-rules" maxlength="700" placeholder="z. B. Keine Rollenbehauptungen vor Tag 2.">${state.settings?.houseRules || ''}</textarea></label>`;
  modal.querySelector('#save-settings').before(extras);
  modal.querySelector('#theme-rule').value = state.settings?.theme || 'forest';
  modal.querySelector('#close-settings').onclick = () => modal.remove();
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
  modal.querySelector('#save-settings').onclick = () => {
    const roles = [...modal.querySelectorAll('.yu-role-grid input:checked')].map(
      (input) => input.value,
    );
    socket.emit('lobby:updateSettings', {
      roles,
      mayor: modal.querySelector('#mayor-rule').checked,
      houseRules: modal.querySelector('#house-rules').value,
      voteReveal: modal.querySelector('#vote-reveal').checked,
      theme: modal.querySelector('#theme-rule').value,
    });
    modal.remove();
  };
}

function enhanceYuWolfUi() {
  if (state?.settings?.theme) document.body.dataset.theme = state.settings.theme;
  const nameInput = document.querySelector('#create-name');
  if (nameInput && !document.querySelector('#random-name')) {
    const randomNames = [
      'Mondmuffel',
      'NebelNase',
      'KrähenKind',
      'Schattenfuchs',
      'LunaLärm',
      'Wolfswatte',
      'DunkelDachs',
      'ZimtZahn',
      'EulenEcho',
      'KesselKeks',
      'MorgenMotte',
      'RabenRudi',
    ];
    const randomName = document.createElement('button');
    randomName.id = 'random-name';
    randomName.type = 'button';
    randomName.className = 'button secondary random-name';
    randomName.textContent = 'Zufallsname';
    randomName.onclick = () => {
      const base = randomNames[Math.floor(Math.random() * randomNames.length)];
      nameInput.value = `${base}${Math.floor(10 + Math.random() * 90)}`;
      nameInput.focus();
    };
    nameInput.insertAdjacentElement('afterend', randomName);
  }
  const roleConfig = document.querySelector('.roles');
  if (roleConfig) roleConfig.style.display = 'none';

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
  let headerActions = document.querySelector('#header-actions');
  if (inLobby && !headerActions) {
    headerActions = document.createElement('div');
    headerActions.id = 'header-actions';
    headerActions.className = 'header-actions';
    header.appendChild(headerActions);
  }
  let leave = document.querySelector('#leave-lobby');
  if (inLobby && !leave) {
    leave = document.createElement('button');
    leave.id = 'leave-lobby';
    leave.className = 'button secondary';
    leave.textContent = 'Lobby verlassen';
    leave.onclick = () => {
      if (confirm('Möchtest du Yu’s DüsterWald wirklich verlassen?')) socket.emit('lobby:leave');
    };
    headerActions.appendChild(leave);
  } else if (!inLobby && leave) leave.remove();

  const start = document.querySelector('#start');
  if (state?.phase === 'lobby' && !document.querySelector('#ready-button')) {
    const centerNotice = document.querySelector('.game .notice');
    if (centerNotice) {
      const ready = document.createElement('button');
      ready.id = 'ready-button';
      ready.className = `button ${state.players.find((player) => player.id === socket.id)?.ready ? 'secondary' : ''}`;
      ready.textContent = state.players.find((player) => player.id === socket.id)?.ready
        ? 'Nicht bereit'
        : 'Ich bin bereit';
      ready.onclick = () => socket.emit('lobby:ready');
      centerNotice.appendChild(ready);
      const status = document.createElement('p');
      const readyCount = state.players.filter((player) => player.ready).length;
      status.className = 'ready-status muted';
      status.textContent = `${readyCount}/${state.players.length} Spielende bereit`;
      centerNotice.appendChild(status);
    }
  }
  if (
    state?.phase === 'lobby' &&
    state.hostId === socket.id &&
    state.players.some((player) => player.id !== socket.id) &&
    !document.querySelector('#host-moderation')
  ) {
    const centerNotice = document.querySelector('.game .notice');
    if (centerNotice) {
      const moderation = document.createElement('section');
      moderation.id = 'host-moderation';
      moderation.className = 'host-moderation';
      moderation.innerHTML = `<div class="eyebrow">Lobby verwalten</div>${state.players
        .filter((player) => player.id !== socket.id)
        .map(
          (player) =>
            `<button data-kick="${player.id}">${player.name} <span>entfernen</span></button>`,
        )
        .join('')}`;
      centerNotice.appendChild(moderation);
      moderation.querySelectorAll('[data-kick]').forEach((button) => {
        button.onclick = () => {
          if (confirm(`${button.textContent.trim()}?`))
            socket.emit('lobby:kick', button.dataset.kick);
        };
      });
    }
  }
  if (state?.phase === 'lobby' && !document.querySelector('#active-role-preview')) {
    const centerNotice = document.querySelector('.game .notice');
    const activeRoles = YU_ROLES.filter(([key]) => state.settings?.roles?.includes(key));
    if (centerNotice && activeRoles.length) {
      const preview = document.createElement('section');
      preview.id = 'active-role-preview';
      preview.className = 'active-role-preview';
      preview.innerHTML = `<div class="eyebrow">Aktive Rollen</div>${activeRoles.map(([key, icon, label]) => `<div><span>${icon} ${label}</span><small>${ROLE_HINTS[key]}</small></div>`).join('')}`;
      centerNotice.appendChild(preview);
    }
  }
  if (
    state?.phase === 'lobby' &&
    state.settings?.houseRules &&
    !document.querySelector('#house-rules-card')
  ) {
    const centerNotice = document.querySelector('.game .notice');
    if (centerNotice) {
      const rules = document.createElement('section');
      rules.id = 'house-rules-card';
      rules.className = 'house-rules-card';
      const safeRules = state.settings.houseRules
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      rules.innerHTML = `<div class="eyebrow">Hausregeln</div><p>${safeRules}</p>`;
      centerNotice.appendChild(rules);
    }
  }
  if (inLobby && !document.querySelector('#copy-invite')) {
    const invite = document.createElement('button');
    invite.id = 'copy-invite';
    invite.className = 'button secondary';
    invite.textContent = 'Einladungslink kopieren';
    invite.onclick = async () => {
      const link = `${location.origin}/join/${state.code}`;
      try {
        await navigator.clipboard.writeText(link);
        toast('Einladungslink kopiert.');
      } catch {
        prompt('Kopiere diesen Einladungslink:', link);
      }
    };
    headerActions.appendChild(invite);
  }
  if (!inLobby) {
    document.querySelector('#copy-invite')?.remove();
    document.querySelector('#header-actions')?.remove();
  }
  if (start && state.hostId === socket.id && !document.querySelector('#open-settings')) {
    const settings = document.createElement('button');
    settings.id = 'open-settings';
    settings.className = 'button secondary';
    settings.textContent = 'Rollen & Regeln';
    settings.onclick = openRoleSettings;
    start.insertAdjacentElement('beforebegin', settings);
  }

  if (state?.phase === 'lobby') {
    const notice = document.querySelector('.game .notice');
    const controls = ['#start', '#open-settings', '#ready-button']
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);
    if (notice && controls.length) {
      let actions = document.querySelector('#lobby-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.id = 'lobby-actions';
        actions.className = 'lobby-actions';
        notice.appendChild(actions);
      }
      controls.forEach((control) => {
        if (control.parentElement !== actions) actions.appendChild(control);
      });
    }
  }

  if (
    state?.phase === 'ended' &&
    state.hostId === socket.id &&
    !document.querySelector('#rematch')
  ) {
    const notice = document.querySelector('.game .notice');
    if (notice) {
      const rematch = document.createElement('button');
      rematch.id = 'rematch';
      rematch.className = 'button secondary';
      rematch.textContent = 'Gleiche Lobby erneut spielen';
      rematch.onclick = () => socket.emit('game:rematch');
      notice.appendChild(rematch);
    }
  }
  if (document.querySelector('#destiny-card'))
    document.querySelector('.side .rolecard')?.style.setProperty('display', 'none');
  if (inLobby && state?.own && !state.own.alive && !document.querySelector('#spectator-mode')) {
    const chat = document.querySelector('.chat');
    if (chat) {
      const spectator = document.createElement('div');
      spectator.id = 'spectator-mode';
      spectator.className = 'spectator-mode';
      spectator.textContent =
        'Zuschauermodus · Du kannst den Verlauf verfolgen, aber keine Aktionen mehr ausführen.';
      chat.prepend(spectator);
    }
  }
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
      field.addEventListener('input', () =>
        localStorage.setItem(noteKey, field.value.slice(0, 2000)),
      );
      side.appendChild(notes);
    }
  }
  if (
    state?.phase === 'day' &&
    !state.vote?.cast &&
    !document.querySelector('[data-type="vote"]')
  ) {
    const notice = document.querySelector('.game .notice'),
      targets = state.selection?.targets || [];
    if (notice && targets.length) {
      const vote = document.createElement('div');
      vote.id = 'quick-vote';
      vote.innerHTML = `<p class="muted">Gib deine geheime Stimme ab.</p><div class="choice-grid">${targets.map((target) => `<button class="choice" data-online-vote="${target.id}">${target.name}</button>`).join('')}</div>`;
      notice.appendChild(vote);
      vote
        .querySelectorAll('[data-online-vote]')
        .forEach(
          (button) => (button.onclick = () => socket.emit('game:vote', button.dataset.onlineVote)),
        );
    }
  }
  if (state?.phase === 'day' && !document.querySelector('#suspicion-board')) {
    const notice = document.querySelector('.game .notice');
    const targets = state.selection?.targets || [];
    if (notice && targets.length) {
      const board = document.createElement('section');
      board.id = 'suspicion-board';
      board.className = 'suspicion-board';
      board.innerHTML = `<p class="muted">Misstrauensmarker · unverbindlich</p><div>${targets.map((target) => `<button class="suspect" data-suspect="${target.id}">⚑ ${target.name} <small>${state.suspicions?.[target.id] || 0}</small></button>`).join('')}</div>`;
      notice.appendChild(board);
      board.querySelectorAll('[data-suspect]').forEach((button) => {
        button.onclick = () => socket.emit('day:mark', button.dataset.suspect);
      });
    }
  }
  if (inLobby && !document.querySelector('#reaction-bar')) {
    const send = document.querySelector('.send');
    if (send) {
      const reactions = document.createElement('div');
      reactions.id = 'reaction-bar';
      reactions.innerHTML = ['🕵️', '⚑', '😱', '👏', '🤔']
        .map(
          (emoji) => `<button data-reaction="${emoji}" title="Reaktion senden">${emoji}</button>`,
        )
        .join('');
      send.before(reactions);
      reactions
        .querySelectorAll('[data-reaction]')
        .forEach(
          (button) =>
            (button.onclick = () => socket.emit('chat:reaction', button.dataset.reaction)),
        );
    }
  }
}
socket.on('lobby:left', () => window.location.assign('/'));
const joinMatch = location.pathname.match(/^\/join\/([A-Z0-9]{6})$/i);
app.addEventListener('yuwolf:render', enhanceYuWolfUi);
enhanceYuWolfUi();
