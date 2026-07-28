const path = require('path');
const http = require('http');
const { randomInt, scryptSync, timingSafeEqual } = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 100_000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 120_000,
    skipMiddlewares: true,
  },
});
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'werwolf.html')));
app.get('/join/:code', (_, res) => res.sendFile(path.join(__dirname, 'werwolf.html')));
for (const clientFile of ['style.css', 'game.js', 'ui.js']) {
  app.get(`/${clientFile}`, (_, res) => res.sendFile(path.join(__dirname, clientFile)));
}
app.get('/health', (_, res) => res.json({ ok: true }));

const lobbies = new Map();
const roleInfo = {
  wolf: {
    name: 'Werwolf',
    icon: '🐺',
    team: 'wolf',
    description: 'Wähle nachts gemeinsam mit dem Rudel ein Opfer.',
  },
  seer: {
    name: 'Seherin',
    icon: '🔮',
    team: 'village',
    description: 'Erfahre jede Nacht die Rolle einer Person.',
  },
  witch: {
    name: 'Hexe',
    icon: '⚗️',
    team: 'village',
    description: 'Du hast je einen Heil- und Gifttrank.',
  },
  hunter: {
    name: 'Jäger',
    icon: '🏹',
    team: 'village',
    description: 'Stirbst du, nimmst du jemanden mit.',
  },
  cupid: {
    name: 'Amor',
    icon: '💘',
    team: 'village',
    description: 'Verbinde in der ersten Nacht zwei Herzen.',
  },
  guardian: {
    name: 'Schutzgeist',
    icon: '🛡️',
    team: 'village',
    description: 'Schütze jede Nacht eine Person vor dem Angriff der Wölfe.',
  },
  fool: {
    name: 'Narr',
    icon: '🃏',
    team: 'solo',
    description: 'Wirst du vom Dorf verurteilt, gewinnst du sofort allein.',
  },
  piper: {
    name: 'Flötenspieler',
    icon: '🎶',
    team: 'solo',
    description: 'Verzaubere nachts Menschen. Sind alle verzaubert, gewinnst du allein.',
  },
  thief: {
    name: 'Diebin',
    icon: '🗝️',
    team: 'village',
    description: 'Deine erste Nacht hält eine besondere Wahl für dich bereit.',
  },
  girl: {
    name: 'Mädchen',
    icon: '👁️',
    team: 'village',
    description: 'Du kannst nachts einen Blick auf das Rudel erhaschen.',
  },
  witchhunter: {
    name: 'Hexenjäger',
    icon: '🔥',
    team: 'village',
    description: 'Spüre nachts Magie auf und jage die Hexe.',
  },
  vampire: {
    name: 'Vampir',
    icon: '🧛',
    team: 'vampire',
    description: 'Jage nachts allein. Bleib am Ende als letzte Fraktion übrig.',
  },
  doppelganger: {
    name: 'Doppelgänger',
    icon: '🎭',
    team: 'village',
    description: 'Wähle in der ersten Nacht ein Vorbild und übernimm später sein Schicksal.',
  },
  villager: {
    name: 'Weirdo',
    icon: '🛸',
    team: 'village',
    description:
      'Du bist ein herrlich seltsamer Weirdo von Yu’s DüsterWald. Vertraue deinem Bauchgefühl und finde die Wölfe.',
  },
};
const publicLobby = (l) => ({
  code: l.code,
  name: l.name,
  count: l.players.length,
  max: l.maxPlayers,
  phase: l.phase,
  private: l.private,
});
const normalizeName = (value) =>
  String(value || '')
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE');
const cleanText = (value, maxLength) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
const passwordHash = (value, lobbyCode) =>
  scryptSync(String(value), `YuWolf:${lobbyCode}`, 32).toString('hex');
const passwordsMatch = (stored, received, lobbyCode) => {
  if (!stored) return false;
  const expected = Buffer.from(stored, 'hex');
  const attempted = Buffer.from(passwordHash(received, lobbyCode), 'hex');
  return expected.length === attempted.length && timingSafeEqual(expected, attempted);
};
const code = () => {
  let c;
  do
    c = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
  while (lobbies.has(c));
  return c;
};
const alive = (l) => l.players.filter((p) => p.alive);
const find = (l, id) => l.players.find((p) => p.id === id);
function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
const emitList = () =>
  io.emit(
    'lobby:list',
    [...lobbies.values()].filter((l) => !l.private && l.phase === 'lobby').map(publicLobby),
  );
function error(socket, message) {
  socket.emit('app:error', message);
}
function lobbyFor(socket) {
  return socket.data.lobbyCode ? lobbies.get(socket.data.lobbyCode) : undefined;
}
function leaveLobby(socket, l) {
  const player = find(l, socket.id);
  if (!player) return;
  const wasHost = l.hostId === socket.id;
  l.players = l.players.filter((p) => p.id !== socket.id);
  socket.leave(l.code);
  socket.data.lobbyCode = undefined;
  if (!l.players.length) {
    lobbies.delete(l.code);
    emitList();
    return;
  }
  if (wasHost) {
    const newHost = l.players.find((p) => p.connected) || l.players[0];
    if (newHost) {
      l.hostId = newHost.id;
      system(l, `${newHost.name} ist jetzt Host.`);
    }
  }
  system(l, `${player.name} hat Yu’s DüsterWald verlassen.`);
  if (l.phase === 'reveal') {
    l.revealed?.delete(socket.id);
    if (l.revealed?.size >= l.players.length) return beginNight(l);
  } else if (l.phase === 'night') {
    if (checkWinner(l)) return setPhase(l, 'ended');
    return beginNight(l);
  } else if (l.phase === 'day') {
    if (checkWinner(l)) return setPhase(l, 'ended');
    return dayVote(l);
  } else if (l.phase === 'hunter') {
    l.hunter = null;
    return beginNight(l);
  }
  broadcast(l);
}
function playerView(l, player) {
  const own = player
    ? {
        role: player.role && roleInfo[player.role],
        alive: player.alive,
        lover: l.lovers.includes(player.id),
        witch: player.role === 'witch' ? { heal: l.potions.heal, poison: l.potions.poison } : null,
      }
    : null;
  return {
    code: l.code,
    name: l.name,
    hostId: l.hostId,
    max: l.maxPlayers,
    phase: l.phase,
    night: l.night,
    players: l.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      connected: p.connected,
      ready: !!p.ready,
      host: p.id === l.hostId,
      role: l.phase === 'ended' ? roleInfo[p.role] : undefined,
    })),
    messages: l.messages.slice(-80),
    log: l.log.slice(-12),
    own,
    selection: l.selection,
    winner: l.winner,
    settings: l.settings,
    voteHistory: l.settings.voteReveal ? (l.voteHistory || []).slice(-8) : [],
    suspicions: Object.fromEntries(
      [...(l.suspicions || [])].map(([id, voters]) => [id, voters.size]),
    ),
    revealDone: l.revealed?.has(player.id) || false,
    revealedCount: l.revealed?.size || 0,
    vote:
      l.phase === 'day'
        ? { cast: l.votes?.has(player.id) || false, count: l.votes?.size || 0 }
        : null,
  };
}
function broadcast(l) {
  l.players.forEach((p) => io.to(p.id).emit('lobby:state', playerView(l, p)));
  emitList();
}
function addMessage(l, message) {
  l.messages.push(message);
  if (l.messages.length > 200) l.messages.splice(0, l.messages.length - 200);
}
function emitChatMessage(l, message) {
  l.players.forEach((player) => io.to(player.id).emit('chat:message', message));
}
function system(l, text) {
  l.log.push(text);
  if (l.log.length > 80) l.log.splice(0, l.log.length - 80);
  addMessage(l, { system: true, text, at: Date.now() });
}
function setPhase(l, phase, selection = null) {
  l.phase = phase;
  l.selection = selection;
  broadcast(l);
}
function validTarget(l, id) {
  const p = find(l, id);
  return Boolean(p?.alive);
}
function startGame(l) {
  if (l.players.length < 5) return false;
  const configuredRoles = l.settings.roles.filter((role) => roleInfo[role]);
  const wolves = Math.max(1, Math.floor(l.players.length / 4));
  const special = shuffle(configuredRoles).slice(0, Math.max(0, l.players.length - wolves));
  const deck = [...Array(wolves).fill('wolf'), ...special];
  while (deck.length > l.players.length) deck.pop();
  while (deck.length < l.players.length) deck.push('villager');
  const randomizedDeck = shuffle(deck);
  l.players.forEach((p, i) => Object.assign(p, { role: randomizedDeck[i], alive: true }));
  Object.assign(l, {
    night: 0,
    potions: { heal: true, poison: true },
    lovers: [],
    charmed: [],
    mayorId: null,
    winner: null,
    log: [],
    revealed: new Set(),
  });
  system(l, 'Die Karten wurden gemischt und im Schatten verteilt.');
  setPhase(l, 'reveal', { text: 'Deine Schicksalskarte wartet auf dich.' });
  return true;
}
function beginNight(l) {
  l.night++;
  const tasks = [];
  if (l.night === 1 && alive(l).some((p) => p.role === 'cupid')) tasks.push('cupid');
  if (l.night === 1 && alive(l).some((p) => p.role === 'thief')) tasks.push('thief');
  if (l.night === 1 && alive(l).some((p) => p.role === 'doppelganger')) tasks.push('doppelganger');
  if (alive(l).some((p) => p.role === 'guardian')) tasks.push('guardian');
  if (alive(l).some((p) => p.role === 'piper')) tasks.push('piper');
  if (alive(l).some((p) => p.role === 'vampire')) tasks.push('vampire');
  if (alive(l).some((p) => p.role === 'wolf')) tasks.push('wolf');
  if (alive(l).some((p) => p.role === 'seer')) tasks.push('seer');
  if (alive(l).some((p) => p.role === 'girl')) tasks.push('girl');
  if (alive(l).some((p) => p.role === 'witchhunter')) tasks.push('witchhunter');
  if (alive(l).some((p) => p.role === 'witch') && (l.potions.heal || l.potions.poison))
    tasks.push('witch');
  l.tasks = tasks;
  l.taskIndex = 0;
  l.nightData = {};
  nextTask(l);
}
function nextTask(l) {
  const task = l.tasks[l.taskIndex];
  if (!task) return dawn(l);
  const actors = alive(l).filter((p) => p.role === task);
  if (!actors.length) {
    l.taskIndex++;
    return nextTask(l);
  }
  const actorIds = actors.map((p) => p.id);
  let text = {
    wolf: 'Die Werwölfe wählen gemeinsam ein Opfer.',
    seer: 'Die Seherin darf eine Rolle prüfen.',
    witch: 'Die Hexe entscheidet über ihre Tränke.',
    cupid: 'Amor verbindet zwei Herzen.',
    guardian: 'Der Schutzgeist wählt eine Person unter seinem Schild.',
    piper: 'Der Flötenspieler verzaubert eine Person.',
    vampire: 'Der Vampir sucht sein Opfer.',
    thief: 'Die Diebin wählt ein Vorbild aus dem Dorf.',
    doppelganger: 'Der Doppelgänger wählt sein Schicksalsvorbild.',
    girl: 'Das Mädchen hält nach dem Rudel Ausschau.',
    witchhunter: 'Der Hexenjäger sucht nach magischer Spur.',
  }[task];
  const targets = alive(l).filter((p) => (task === 'wolf' ? p.role !== 'wolf' : true));
  setPhase(l, 'night', {
    task,
    actorIds,
    text,
    targets: targets.map((p) => ({ id: p.id, name: p.name })),
  });
}
function kill(l, id, reason) {
  const p = find(l, id);
  if (!p || !p.alive) return;
  p.alive = false;
  system(l, `${p.name} ${reason}.`);
  const other = l.lovers.find((x) => x !== id);
  if (l.lovers.includes(id) && other) {
    const lover = find(l, other);
    if (lover?.alive) {
      lover.alive = false;
      system(l, `${lover.name} stirbt an gebrochenem Herzen.`);
    }
  }
  if (p.role === 'hunter') l.hunter = p.id;
}
function checkWinner(l) {
  const living = alive(l),
    wolves = living.filter((p) => p.role === 'wolf').length;
  const piper = living.find((p) => p.role === 'piper');
  if (piper && living.filter((p) => p.id !== piper.id).every((p) => l.charmed.includes(p.id))) {
    l.winner = 'Der Flötenspieler gewinnt';
    return true;
  }
  if (
    l.lovers.length === 2 &&
    living.length === 2 &&
    l.lovers.every((id) => living.some((p) => p.id === id))
  ) {
    l.winner = 'Das Liebespaar gewinnt';
    return true;
  }
  const vampires = living.filter((p) => p.role === 'vampire').length;
  if (vampires && vampires >= living.length - vampires) {
    l.winner = 'Der Vampir gewinnt';
    return true;
  }
  if (wolves === 0) {
    l.winner = 'Das Dorf gewinnt';
    return true;
  }
  if (wolves >= living.length - wolves) {
    l.winner = 'Die Werwölfe gewinnen';
    return true;
  }
  return false;
}
function afterDeaths(l, next) {
  if (checkWinner(l)) {
    setPhase(l, 'ended');
    return;
  }
  if (l.hunter) {
    const hunter = l.hunter;
    l.hunter = null;
    setPhase(l, 'hunter', {
      actorIds: [hunter],
      text: 'Der Jäger nimmt eine Person mit in den Tod.',
      targets: alive(l)
        .filter((p) => p.id !== hunter)
        .map((p) => ({ id: p.id, name: p.name })),
      next,
    });
    return;
  }
  next();
}
function dawn(l) {
  const d = l.nightData;
  system(l, 'Der Nebel lichtet sich. DüsterWald erwacht langsam.');
  if (d.wolfTarget && !d.healed && d.wolfTarget !== d.protected)
    kill(l, d.wolfTarget, 'ist in der Nacht gestorben');
  else if (d.wolfTarget === d.protected)
    system(l, 'Ein unsichtbarer Schild hat ein Leben bewahrt.');
  if (d.poisonTarget) kill(l, d.poisonTarget, 'wurde vergiftet');
  if (d.vampireTarget) kill(l, d.vampireTarget, 'wurde vom Vampir heimgesucht');
  if (d.witchhunterTarget && find(l, d.witchhunterTarget)?.role === 'witch')
    kill(l, d.witchhunterTarget, 'wurde vom Hexenjäger enttarnt');
  if (!d.wolfTarget && !d.poisonTarget) system(l, 'Diese Nacht ist niemand gestorben.');
  afterDeaths(l, () => dayVote(l));
}
function dayVote(l) {
  l.votes = new Map();
  l.suspicions = new Map();
  system(l, 'Das Dorf versammelt sich auf dem Platz. Die Abstimmung beginnt.');
  setPhase(l, 'day', {
    text: 'Diskutiert im Chat und stimmt dann ab.',
    targets: alive(l).map((p) => ({ id: p.id, name: p.name })),
  });
}
function resolveVotes(l) {
  const tally = new Map();
  for (const target of l.votes.values()) tally.set(target, (tally.get(target) || 0) + 1);
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const [winner, votes] = sorted[0] || [];
  const tied = sorted.length > 1 && sorted[1][1] === votes;
  const record = {
    round: l.night,
    votes: [...l.votes.entries()].map(([voter, target]) => ({ voter, target })),
    winner: winner || null,
    tied,
  };
  l.voteHistory = [...(l.voteHistory || []), record];
  if (l.settings.voteReveal) {
    const readable = record.votes
      .map(({ voter, target }) => `${find(l, voter)?.name} → ${find(l, target)?.name}`)
      .join(', ');
    system(l, `Abstimmungsverlauf: ${readable}.`);
  }
  if (!winner || tied) {
    system(l, 'Die Abstimmung endet unentschieden. Niemand wird verurteilt.');
    return afterDeaths(l, () => beginNight(l));
  }
  if (find(l, winner)?.role === 'fool') {
    l.winner = 'Der Narr gewinnt';
    system(l, 'Das Dorf hat den Narren verurteilt – der Narr lacht zuletzt.');
    return setPhase(l, 'ended');
  }
  kill(l, winner, `wurde mit ${votes} Stimme${votes === 1 ? '' : 'n'} verurteilt`);
  afterDeaths(l, () => beginNight(l));
}
io.on('connection', (socket) => {
  if (socket.recovered) {
    const recoveredLobby = lobbyFor(socket);
    const recoveredPlayer = recoveredLobby && find(recoveredLobby, socket.id);
    if (recoveredPlayer) {
      recoveredPlayer.connected = true;
      socket.emit('lobby:state', playerView(recoveredLobby, recoveredPlayer));
      broadcast(recoveredLobby);
    }
  }
  socket.emit(
    'lobby:list',
    [...lobbies.values()].filter((l) => !l.private && l.phase === 'lobby').map(publicLobby),
  );
  socket.on('lobby:create', (data) => {
    if (lobbyFor(socket)) return error(socket, 'Verlasse zuerst deine aktuelle Lobby.');
    const name = cleanText(data?.name, 30),
      playerName = cleanText(data?.playerName, 22);
    if (!name || !playerName) return error(socket, 'Bitte gib einen Lobby- und Spielernamen ein.');
    if (data.private && !String(data.password || '').trim())
      return error(socket, 'Private Lobbys benötigen ein Passwort.');
    const lobbyCode = code();
    const requestedMax = Number(data?.maxPlayers);
    const l = {
      code: lobbyCode,
      name,
      hostId: socket.id,
      maxPlayers: [5, 8, 12, 16].includes(requestedMax) ? requestedMax : 12,
      private: !!data.private,
      passwordHash:
        data.private && data.password
          ? passwordHash(String(data.password).slice(0, 32), lobbyCode)
          : '',
      phase: 'lobby',
      night: 0,
      players: [{ id: socket.id, name: playerName, alive: true, connected: true, ready: false }],
      messages: [],
      log: [],
      settings: {
        roles: Array.isArray(data.roles) ? data.roles : ['seer', 'witch', 'hunter', 'cupid'],
        mayor: false,
        houseRules: '',
        voteReveal: true,
        theme: 'forest',
      },
      potions: {},
      lovers: [],
    };
    lobbies.set(l.code, l);
    socket.data.lobbyCode = l.code;
    socket.join(l.code);
    system(l, `${playerName} hat die Lobby eröffnet.`);
    broadcast(l);
  });
  socket.on('lobby:join', (data) => {
    if (lobbyFor(socket)) return error(socket, 'Verlasse zuerst deine aktuelle Lobby.');
    const l = lobbies.get(
        String(data?.code || '')
          .trim()
          .toUpperCase(),
      ),
      name = cleanText(data?.playerName, 22);
    if (!l) return error(socket, 'Diese Lobby existiert nicht.');
    if (l.phase !== 'lobby') return error(socket, 'Diese Runde läuft bereits.');
    if (l.players.length >= l.maxPlayers) return error(socket, 'Die Lobby ist voll.');
    if (l.private && !passwordsMatch(l.passwordHash, String(data?.password || ''), l.code))
      return error(socket, 'Das Passwort ist nicht korrekt.');
    if (!name) return error(socket, 'Bitte gib einen Spielernamen ein.');
    if (l.players.some((p) => normalizeName(p.name) === normalizeName(name)))
      return error(socket, 'Dieser Name ist bereits vergeben.');
    l.players.push({ id: socket.id, name, alive: true, connected: true, ready: false });
    socket.data.lobbyCode = l.code;
    socket.join(l.code);
    system(l, `${name} ist dem Dorf beigetreten.`);
    broadcast(l);
  });
  socket.on('lobby:updateSettings', (data = {}) => {
    const l = lobbyFor(socket);
    if (!l || l.hostId !== socket.id || l.phase !== 'lobby')
      return error(socket, 'Nur der Host kann die Rollen vor Spielbeginn ändern.');
    const requestedRoles = Array.isArray(data.roles) ? data.roles : [];
    l.settings.roles = [...new Set(requestedRoles.filter((role) => roleInfo[role]))];
    l.settings.mayor = !!data.mayor;
    l.settings.houseRules = String(data.houseRules || '')
      .trim()
      .slice(0, 700);
    l.settings.voteReveal = data.voteReveal !== false;
    l.settings.theme = ['forest', 'school', 'fairy', 'cyber'].includes(data.theme)
      ? data.theme
      : 'forest';
    system(l, 'Die Rollenregeln wurden vom Host aktualisiert.');
    broadcast(l);
  });
  socket.on('lobby:ready', () => {
    const l = lobbyFor(socket);
    const player = l && find(l, socket.id);
    if (!l || !player || l.phase !== 'lobby') return;
    player.ready = !player.ready;
    broadcast(l);
  });
  socket.on('lobby:kick', (targetId) => {
    const l = lobbyFor(socket);
    if (!l || l.hostId !== socket.id || l.phase !== 'lobby' || targetId === socket.id) return;
    const target = find(l, targetId);
    if (!target) return;
    l.players = l.players.filter((player) => player.id !== targetId);
    const targetSocket = io.sockets.sockets.get(targetId);
    targetSocket?.leave(l.code);
    if (targetSocket) targetSocket.data.lobbyCode = undefined;
    io.to(targetId).emit('app:error', 'Du wurdest vom Host aus der Lobby entfernt.');
    io.to(targetId).emit('lobby:left');
    system(l, `${target.name} wurde aus der Lobby entfernt.`);
    broadcast(l);
  });
  socket.on('lobby:leave', () => {
    const l = lobbyFor(socket);
    if (!l) return;
    leaveLobby(socket, l);
    socket.emit('lobby:left');
  });
  socket.on('game:rematch', () => {
    const l = lobbyFor(socket);
    if (!l || l.hostId !== socket.id || l.phase !== 'ended')
      return error(socket, 'Nur der Host kann eine neue Runde starten.');
    l.players.forEach((player) => {
      player.alive = true;
      player.ready = false;
      delete player.role;
    });
    l.night = 0;
    l.winner = null;
    l.selection = null;
    l.votes = new Map();
    l.revealed = new Set();
    system(l, 'Eine neue Runde von YuWolf wird vorbereitet.');
    setPhase(l, 'lobby');
  });
  socket.on('chat:send', (raw) => {
    const l = lobbyFor(socket),
      p = l && find(l, socket.id),
      text = cleanText(raw, 360);
    if (!l || !p || !text) return;
    const now = Date.now();
    if (socket.data.lastChat && now - socket.data.lastChat < 450)
      return error(socket, 'Warte einen Moment, bevor du erneut schreibst.');
    socket.data.lastChat = now;
    const message = { name: p.name, text, at: now };
    addMessage(l, message);
    emitChatMessage(l, message);
  });
  socket.on('chat:reaction', (emoji) => {
    const l = lobbyFor(socket);
    const player = l && find(l, socket.id);
    if (!l || !player || !['🕵️', '⚑', '😱', '👏', '🤔'].includes(emoji)) return;
    const now = Date.now();
    if (socket.data.lastReaction && now - socket.data.lastReaction < 700) return;
    socket.data.lastReaction = now;
    const message = { name: player.name, text: emoji, at: now, reaction: true };
    addMessage(l, message);
    emitChatMessage(l, message);
  });
  socket.on('game:start', () => {
    const l = lobbyFor(socket);
    if (!l || l.hostId !== socket.id) return error(socket, 'Nur der Host kann starten.');
    if (l.players.some((player) => !player.ready || !player.connected))
      return error(socket, 'Alle verbundenen Spielenden müssen zuerst bereit sein.');
    if (!startGame(l)) error(socket, 'Mindestens 5 Personen werden benötigt.');
  });
  socket.on('reveal:done', () => {
    const l = lobbyFor(socket),
      p = l && find(l, socket.id);
    if (!l || !p || l.phase !== 'reveal') return;
    l.revealed.add(socket.id);
    if (l.revealed.size >= l.players.length) {
      system(l, 'Alle Schicksalskarten wurden wieder verborgen. Die erste Nacht beginnt.');
      beginNight(l);
    } else broadcast(l);
  });
  socket.on('game:action', (data) => {
    const l = lobbyFor(socket),
      p = l && find(l, socket.id);
    if (!l || !p || !p.alive) return;
    const s = l.selection,
      target = String(data?.target || '');
    if (!s || !s.actorIds.includes(socket.id))
      return error(socket, 'Du bist gerade nicht an der Reihe.');
    if (!s.targets?.some((t) => t.id === target)) return error(socket, 'Ungültiges Ziel.');
    if (s.task === 'wolf') {
      l.nightData.wolfTarget = target;
      l.taskIndex++;
      return nextTask(l);
    }
    if (s.task === 'seer') {
      const t = find(l, target);
      socket.emit('game:vision', { name: t.name, role: roleInfo[t.role] });
      l.taskIndex++;
      return nextTask(l);
    }
    if (s.task === 'cupid') {
      if (!data.second || data.second === target || !alive(l).some((x) => x.id === data.second))
        return error(socket, 'Wähle zwei unterschiedliche Personen.');
      l.lovers = [target, data.second];
      system(l, 'Zwei Herzen wurden verbunden.');
      l.taskIndex++;
      return nextTask(l);
    }
    if (s.task === 'witch') {
      if (data.kind === 'heal' && l.potions.heal && l.nightData.wolfTarget) {
        l.potions.heal = false;
        l.nightData.healed = true;
      } else if (data.kind === 'poison' && l.potions.poison) {
        l.potions.poison = false;
        l.nightData.poisonTarget = target;
      } else return error(socket, 'Dieser Trank ist nicht verfügbar.');
      l.taskIndex++;
      return nextTask(l);
    }
    if (s.task === 'guardian') {
      l.nightData.protected = target;
    } else if (s.task === 'piper') {
      if (!l.charmed.includes(target)) l.charmed.push(target);
    } else if (s.task === 'vampire') {
      l.nightData.vampireTarget = target;
    } else if (s.task === 'thief') {
      p.role = find(l, target)?.role || p.role;
      system(l, 'Die Diebin hat ein neues Schicksal angenommen.');
    } else if (s.task === 'doppelganger') {
      p.copies = target;
    } else if (s.task === 'girl') {
      const wolves = alive(l)
        .filter((player) => player.role === 'wolf')
        .map((player) => player.name);
      socket.emit('game:vision', {
        name: wolves.join(', ') || 'niemand',
        role: { name: 'Werwolf-Rudel', icon: '🐺' },
      });
    } else if (s.task === 'witchhunter') {
      l.nightData.witchhunterTarget = target;
    } else if (l.phase === 'hunter') {
      kill(l, target, 'wurde vom Jäger getroffen');
      return afterDeaths(l, () => beginNight(l));
    } else {
      return error(socket, 'Diese Nachtaktion ist nicht verfügbar.');
    }
    l.taskIndex++;
    return nextTask(l);
  });
  socket.on('game:skip', () => {
    const l = lobbyFor(socket);
    if (!l || !l.selection?.actorIds.includes(socket.id)) return;
    if (l.phase === 'night') {
      l.taskIndex++;
      nextTask(l);
    } else if (l.phase === 'day') {
      system(l, 'Das Dorf konnte sich nicht einigen.');
      beginNight(l);
    }
  });
  socket.on('game:vote', (target) => {
    const l = lobbyFor(socket);
    const voter = l && find(l, socket.id);
    if (!l || !voter || !voter.alive || l.phase !== 'day')
      return error(socket, 'Die Abstimmung ist gerade nicht aktiv.');
    if (!validTarget(l, target)) return error(socket, 'Ungültiges Ziel.');
    l.votes.set(socket.id, target);
    const required = alive(l).filter((p) => p.connected);
    if (
      [...l.votes.keys()].filter((id) => required.some((p) => p.id === id)).length >=
      required.length
    )
      resolveVotes(l);
    else broadcast(l);
  });
  socket.on('day:mark', (target) => {
    const l = lobbyFor(socket);
    const voter = l && find(l, socket.id);
    if (!l || !voter?.alive || l.phase !== 'day' || !validTarget(l, target)) return;
    for (const voters of l.suspicions.values()) voters.delete(socket.id);
    if (!l.suspicions.has(target)) l.suspicions.set(target, new Set());
    l.suspicions.get(target).add(socket.id);
    broadcast(l);
  });
  socket.on('disconnect', () => {
    const l = lobbyFor(socket);
    if (!l) return;
    const p = find(l, socket.id);
    if (p) {
      p.connected = false;
      broadcast(l);
    }
    setTimeout(() => {
      const cur = lobbies.get(l.code);
      const disconnectedPlayer = cur && find(cur, socket.id);
      if (!cur || !disconnectedPlayer || disconnectedPlayer.connected) return;
      if (cur.hostId === socket.id) {
        const newHost = cur.players.find((x) => x.connected);
        if (newHost) {
          cur.hostId = newHost.id;
          system(cur, `${newHost.name} ist jetzt Host.`);
        }
      }
      if (cur.players.every((x) => !x.connected)) lobbies.delete(cur.code);
      else broadcast(cur);
      emitList();
    }, 120_000);
  });
});
server.listen(PORT, () => console.log(`YuWolf läuft auf Port ${PORT}`));
