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
const NIGHT_ACTION_MS = 45_000;
const DAY_VOTE_MS = 90_000;
const HUNTER_ACTION_MS = 30_000;
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
function removePlayerFromLobby(l, playerId) {
  const player = find(l, playerId);
  if (!player) return;
  const wasHost = l.hostId === playerId;
  l.players = l.players.filter((p) => p.id !== playerId);
  
  const s = io.sockets.sockets.get(playerId);
  if (s) {
    s.leave(l.code);
    s.data.lobbyCode = undefined;
  }
  
  if (!l.players.length) {
    clearPhaseTimer(l);
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
    l.revealed?.delete(playerId);
    if (l.revealed?.size >= l.players.length) return beginNight(l);
  } else if (l.phase === 'night') {
    if (checkWinner(l)) return setPhase(l, 'ended');
    // If the active role disconnected, skip to next task, otherwise just broadcast
    const task = l.tasks?.[l.taskIndex];
    if (task) {
      const actors = alive(l).filter((p) => p.role === task);
      if (!actors.length || !actors.some((p) => p.connected)) {
        l.taskIndex++;
        return nextTask(l);
      }
    }
  } else if (l.phase === 'day') {
    if (checkWinner(l)) return setPhase(l, 'ended');
    if (l.votes) l.votes.delete(playerId);
  } else if (l.phase === 'hunter') {
    if (l.hunter === playerId) {
      l.hunter = null;
      const nextFn = l.selection?.next || (() => beginNight(l));
      return afterDeaths(l, nextFn);
    }
  }
  broadcast(l);
}
function selectionView(l, player) {
  return l.selection?.actorIds?.includes(player.id)
      ? {
        task: l.selection.task,
        targets: l.selection.targets,
        text: l.selection.text,
        actorIds: l.selection.actorIds,
        wolfTotalCount: l.selection.task === 'wolf' ? alive(l).filter((p) => p.role === 'wolf').length : null,
        wolfVotedCount: l.selection.task === 'wolf' ? l.nightData?.wolfVotes?.size || 0 : null,
        wolfVoteCast: l.selection.task === 'wolf' ? l.nightData?.wolfVotes?.has(player.id) : null,
        wolfMyTarget: l.selection.task === 'wolf' ? l.nightData?.wolfVotes?.get(player.id) : null,
      }
    : { task: l.selection?.task };
}
function playerView(l, player) {
  const isHost = l.hostId === player.id;
  const role = roleInfo[player.role];
  const wolfTeam =
    player.role === 'wolf' || l.phase === 'ended'
      ? l.players
          .filter((p) => p.role === 'wolf' && p.id !== player.id)
          .map((p) => ({ id: p.id, name: p.name, alive: p.alive }))
      : null;
  const own =
    l.phase === 'lobby'
      ? { role: null, alive: true }
      : {
          role,
          alive: player.alive,
          lover: l.lovers.includes(player.id) ? l.lovers.find((id) => id !== player.id) : null,
          witch: player.role === 'witch' ? { heal: l.potions.heal, poison: l.potions.poison } : null,
          wolfTeam,
          playAgain: player.playAgain,
          isMayor: l.mayorId === player.id,
        };
  const anonymousTally = ['day', 'mayor_election'].includes(l.phase)
    ? Object.fromEntries(
        [...(l.votes?.values() || [])].reduce((counts, target) => {
          counts.set(target, (counts.get(target) || 0) + 1);
          return counts;
        }, new Map()),
      )
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
    selection: selectionView(l, player),
    timer: l.phaseDeadline ? { deadline: l.phaseDeadline, phase: l.phase } : null,
    winner: l.winner,
    winners: l.winners || [],
    settings: l.settings,
    voteHistory: l.settings.voteReveal ? (l.voteHistory || []).slice(-8) : [],
    suspicions: Object.fromEntries(
      (l.suspicions ? [...l.suspicions.entries()] : []).map(([k, v]) => [k, Array.from(v)]),
    ),
    mayorId: l.mayorId,
    revealDone: l.revealed?.has(player.id) || false,
    revealedCount: l.revealed?.size || 0,
    vote:
      l.phase === 'day'
        ? {
            cast: l.votes?.has(player.id) || false,
            count: l.votes?.size || 0,
            myTarget: l.votes?.get(player.id) || null,
            tally: anonymousTally,
          }
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
function clearPhaseTimer(l) {
  if (l.phaseTimer) clearTimeout(l.phaseTimer);
  l.phaseTimer = null;
  l.phaseDeadline = null;
}
function phaseDuration(phase) {
  if (phase === 'night') return NIGHT_ACTION_MS;
  if (phase === 'day') return DAY_VOTE_MS;
  if (phase === 'hunter') return HUNTER_ACTION_MS;
  return null;
}
function handlePhaseTimeout(l, phase) {
  if (!lobbies.has(l.code) || l.phase !== phase) return;
  if (phase === 'night') {
    if (l.selection?.task === 'wolf') return resolveWolfVotes(l);
    system(l, 'Die Nachtzeit ist abgelaufen. Die nächste Rolle erwacht.');
    l.taskIndex++;
    return nextTask(l);
  }
  if (phase === 'day') {
    system(l, 'Die Abstimmungszeit ist abgelaufen.');
    return resolveVotes(l);
  }
  if (phase === 'hunter') {
    system(l, 'Der Jäger hat keinen letzten Schuss abgegeben.');
    const nextFn = l.selection?.next || (() => beginNight(l));
    return afterDeaths(l, nextFn);
  }
}
function setPhase(l, phase, selection = null) {
  clearPhaseTimer(l);
  l.phase = phase;
  l.selection = selection;
  const duration = l.settings?.unlimitedTime ? null : phaseDuration(phase);
  if (duration) {
    l.phaseDeadline = Date.now() + duration;
    l.phaseTimer = setTimeout(() => handlePhaseTimeout(l, phase), duration);
  }
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
  if (!actors.length || !actors.some((p) => p.connected)) {
    l.taskIndex++;
    return nextTask(l);
  }
  const actorIds = actors.map((p) => p.id);
  if (task === 'wolf') l.nightData.wolfVotes = new Map();
  let text = {
    wolf: 'Die Werwölfe wählen gemeinsam ein Opfer.',
    seer: 'Die Seherin darf eine Rolle prüfen.',
    witch: l.nightData?.wolfTarget
      ? `Das Rudel hat ${find(l, l.nightData.wolfTarget)?.name || 'jemanden'} angegriffen. Möchtest du den Heiltrank nutzen oder jemanden vergiften?`
      : 'Das Rudel hat niemanden angegriffen. Du kannst den Gifttrank nutzen oder passen.',
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
function resolveWolfVotes(l) {
  const votes = l.nightData.wolfVotes || new Map();
  const tally = new Map();
  for (const target of votes.values()) tally.set(target, (tally.get(target) || 0) + 1);
  const highest = Math.max(0, ...tally.values());
  const candidates = [...tally.entries()]
    .filter(([, count]) => count === highest)
    .map(([target]) => target);
  if (candidates.length) {
    l.nightData.wolfTarget = shuffle(candidates)[0];
    system(l, 'Das Rudel hat sein Opfer gewählt.');
  } else system(l, 'Das Rudel hat in dieser Nacht kein Opfer gewählt.');
  l.taskIndex++;
  nextTask(l);
}
function kill(l, id, reason) {
  if (!validTarget(l, id)) return;
  const p = find(l, id);
  if (!p) return;
  p.alive = false;
  system(l, `${p.name} ${reason}.`);
  if (l.mayorId === id) {
    l.deadMayor = id;
    l.mayorId = null;
  }
  const checkDoppel = (deadId, deadRole) => {
    for (const x of alive(l)) {
      if (x.role === 'doppelganger' && x.copies === deadId) {
        x.role = deadRole;
        system(l, `Der Doppelgänger nimmt eine neue Gestalt an.`);
      }
    }
  };
  checkDoppel(id, p.role);
  const other = l.lovers.find((x) => x !== id);
  if (l.lovers.includes(id) && other) {
    const lover = find(l, other);
    if (lover?.alive) {
      lover.alive = false;
      system(l, `${lover.name} stirbt an gebrochenem Herzen.`);
      checkDoppel(lover.id, lover.role);
      if (lover.role === 'hunter') l.hunter = lover.id;
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
    l.winners = [piper.id];
    return true;
  }
  if (
    l.lovers.length === 2 &&
    living.length === 2 &&
    l.lovers.every((id) => living.some((p) => p.id === id))
  ) {
    l.winner = 'Das Liebespaar gewinnt';
    l.winners = [...l.lovers];
    return true;
  }
  const vampires = living.filter((p) => p.role === 'vampire');
  if (vampires.length && vampires.length >= living.length - vampires.length) {
    l.winner = 'Der Vampir gewinnt';
    l.winners = vampires.map((v) => v.id);
    return true;
  }
  if (wolves === 0) {
    l.winner = 'Das Dorf gewinnt';
    l.winners = l.players.filter((p) => p.role !== 'wolf' && p.role !== 'vampire' && p.role !== 'piper' && p.role !== 'fool').map((p) => p.id);
    return true;
  }
  if (wolves >= living.length - wolves) {
    l.winner = 'Die Werwölfe gewinnen';
    l.winners = l.players.filter((p) => p.role === 'wolf').map((p) => p.id);
    return true;
  }
  return false;
}
function afterDeaths(l, next) {
  if (l.deadMayor) {
    const mayor = l.deadMayor;
    l.deadMayor = null;
    const targets = alive(l).map((p) => ({ id: p.id, name: p.name }));
    if (targets.length) {
      setPhase(l, 'mayor_succession', {
        actorIds: [mayor],
        text: 'Der Bürgermeister ist gestorben und muss einen Nachfolger bestimmen.',
        targets,
        next,
      });
      return;
    }
  }
  if (l.hunter) {
    const hunter = l.hunter;
    l.hunter = null;
    const targets = alive(l)
      .filter((p) => p.id !== hunter)
      .map((p) => ({ id: p.id, name: p.name }));
    if (!targets.length) return next();
    setPhase(l, 'hunter', {
      actorIds: [hunter],
      text: 'Der Jäger nimmt eine Person mit in den Tod.',
      targets,
      next,
    });
    return;
  }
  if (checkWinner(l)) {
    setPhase(l, 'ended');
    return;
  }
  next();
}
function dawn(l) {
  const d = l.nightData;
  system(l, 'Der Nebel lichtet sich. DüsterWald erwacht langsam.');
  let deaths = 0;
  if (d.wolfTarget && !d.healed && d.wolfTarget !== d.protected) {
    kill(l, d.wolfTarget, 'ist in der Nacht gestorben');
    deaths++;
  } else if (d.wolfTarget && d.wolfTarget === d.protected) {
    system(l, 'Ein unsichtbarer Schild hat ein Leben bewahrt.');
  } else if (d.wolfTarget && d.healed) {
    system(l, 'Die Hexe hat das Opfer der Wölfe gerettet.');
  }
  if (d.poisonTarget) {
    kill(l, d.poisonTarget, 'wurde vergiftet');
    deaths++;
  }
  if (d.vampireTarget) {
    kill(l, d.vampireTarget, 'wurde vom Vampir heimgesucht');
    deaths++;
  }
  if (d.witchhunterTarget && find(l, d.witchhunterTarget)?.role === 'witch') {
    kill(l, d.witchhunterTarget, 'wurde vom Hexenjäger enttarnt');
    deaths++;
  }
  if (deaths === 0) system(l, 'Diese Nacht ist niemand gestorben.');
  
  if (l.settings.mayor && !l.mayorId && l.night === 1) {
    afterDeaths(l, () => mayorElection(l));
  } else {
    afterDeaths(l, () => dayVote(l));
  }
}
function mayorElection(l) {
  l.votes = new Map();
  system(l, 'Das Dorf wählt einen Bürgermeister!');
  setPhase(l, 'mayor_election', {
    text: 'Wählt einen Anführer. Stimmt im Chat ab.',
    targets: alive(l).map((p) => ({ id: p.id, name: p.name })),
  });
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
function resolveMayorElection(l) {
  const tally = new Map();
  for (const target of l.votes.values()) tally.set(target, (tally.get(target) || 0) + 1);
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    system(l, 'Das Dorf konnte sich auf keinen Bürgermeister einigen.');
    return dayVote(l);
  }
  
  // On a tie, pick one of the tied randomly
  const topVotes = sorted[0][1];
  const candidates = sorted.filter(x => x[1] === topVotes).map(x => x[0]);
  const winner = candidates[Math.floor(Math.random() * candidates.length)];
  
  l.mayorId = winner;
  system(l, `${find(l, winner)?.name} wurde zum Bürgermeister gewählt! (Stimme zählt doppelt)`);
  dayVote(l);
}
function resolveVotes(l) {
  const tally = new Map();
  for (const [voter, target] of l.votes.entries()) {
    const weight = (voter === l.mayorId) ? 2 : 1;
    tally.set(target, (tally.get(target) || 0) + weight);
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const [winner, votes] = sorted[0] || [];
  const tied = sorted.length > 1 && sorted[1][1] === votes;
  const record = {
    day: l.night,
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
    l.winners = [winner];
    system(l, 'Das Dorf hat den Narren verurteilt – der Narr lacht zuletzt.');
    return setPhase(l, 'ended');
  }
  kill(l, winner, `wurde mit ${votes} Stimme${votes === 1 ? '' : 'n'} verurteilt`);
  // Notify the eliminated player with a personal popup
  io.to(winner).emit('game:privateResult', {
    title: 'Du wurdest verurteilt!',
    icon: '⚖️',
    text: `Das Dorf hat dich mit ${votes} Stimme${votes === 1 ? '' : 'n'} verurteilt. Du scheidest als Zuschauer weiter.`,
    theme: 'is-wolf',
  });
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
    const requestedMax = Number.parseInt(data?.maxPlayers, 10);
    const l = {
      code: lobbyCode,
      name,
      hostId: socket.id,
      maxPlayers: Number.isInteger(requestedMax) ? Math.min(99, Math.max(5, requestedMax)) : 12,
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
    if (!name) return error(socket, 'Bitte gib einen Spielernamen ein.');
    const existingPlayer = l.players.find((p) => normalizeName(p.name) === normalizeName(name));
    if (existingPlayer) {
      if (l.phase === 'lobby') {
        return error(socket, 'Dieser Name ist in der Lobby bereits vergeben. Bitte wähle einen anderen.');
      }
      if (existingPlayer.connected) return error(socket, 'Dieser Name ist bereits online.');
      if (l.private && !passwordsMatch(l.passwordHash, String(data?.password || ''), l.code))
        return error(socket, 'Das Passwort ist nicht korrekt.');
      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.connected = true;
      if (l.hostId === oldId) l.hostId = socket.id;
      socket.data.lobbyCode = l.code;
      socket.join(l.code);
      system(l, `${existingPlayer.name} ist wieder verbunden.`);
      broadcast(l);
      return;
    }
    if (l.phase !== 'lobby') return error(socket, 'Diese Runde läuft bereits.');
    if (l.players.length >= l.maxPlayers) return error(socket, 'Die Lobby ist voll.');
    if (l.private && !passwordsMatch(l.passwordHash, String(data?.password || ''), l.code))
      return error(socket, 'Das Passwort ist nicht korrekt.');
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
    l.settings.unlimitedTime = !!data.unlimitedTime;
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
    // Allow kicking during the game too, not just in lobby
    if (!l || l.hostId !== socket.id || targetId === socket.id) return;
    const target = find(l, targetId);
    if (!target) return;
    
    io.to(targetId).emit('app:error', 'Du wurdest vom Host aus der Lobby entfernt.');
    io.to(targetId).emit('lobby:left');
    removePlayerFromLobby(l, targetId);
  });
  socket.on('lobby:leave', () => {
    // If lobbyFor fails (e.g. data lost on reconnect), search for player in all lobbies
    const l = lobbyFor(socket) || [...lobbies.values()].find(lobby => lobby.players.some(p => p.id === socket.id));
    if (l) {
      removePlayerFromLobby(l, socket.id);
    } else {
      socket.data.lobbyCode = undefined;
    }
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
    // Dead players cannot use chat during game
    if (!l || !p || !text) return;
    if (l.phase !== 'lobby' && l.phase !== 'ended' && !p.alive)
      return error(socket, 'Tote können nicht im Chat schreiben.');
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
    // Dead players cannot react during game
    if (!l || !player || (l.phase !== 'lobby' && l.phase !== 'ended' && !player.alive)) return;
    if (!['🕵️', '⚑', '😱', '👏', '🤔'].includes(emoji)) return;
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
    if (!startGame(l)) return error(socket, 'Mindestens 5 Personen werden benötigt.');
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
  socket.on('game:vote', (target) => {
    const l = lobbyFor(socket);
    if (!l || !['day', 'mayor_election'].includes(l.phase)) return;
    const p = find(l, socket.id);
    if (!p || !p.alive || !validTarget(l, target))
      return error(socket, 'Ungültige Aktion.');
    if (target === socket.id) return error(socket, 'Du kannst nicht für dich selbst stimmen.');
    
    l.votes.set(socket.id, target);
    
    // Only resolve votes automatically if EVERY living player has voted
    // If setting is mayor and we're at day vote, Mayor's vote isn't magically 2 people, 
    // it's still 1 person voting, so we still expect alive(l).length votes.
    if (l.votes.size === alive(l).length) {
      if (l.phase === 'mayor_election') resolveMayorElection(l);
      else resolveVotes(l);
    } else broadcast(l);
  });
  socket.on('game:action', (data) => {
    const l = lobbyFor(socket),
      p = l && find(l, socket.id);
    const isHunterLastShot = l?.phase === 'hunter' && l.selection?.actorIds?.includes(socket.id);
    if (!l || !p || (!p.alive && !isHunterLastShot)) return;
    const s = l.selection,
      target = String(data?.target || '');
    if (!s || !s.actorIds.includes(socket.id))
      return error(socket, 'Du bist gerade nicht an der Reihe.');
    if (data?.kind !== 'heal' && data?.kind !== 'poison' && s.task !== 'girl' && !s.targets?.some((t) => t.id === target))
      return error(socket, 'Ungültiges Ziel.');
    // For poison, target must be alive
    if (data?.kind === 'poison' && !validTarget(l, target))
      return error(socket, 'Ungültiges Ziel.');
    if (s.task === 'wolf') {
      l.nightData.wolfVotes ??= new Map();
      l.nightData.wolfVotes.set(socket.id, target);
      const requiredWolves = alive(l).filter(
        (player) => player.role === 'wolf' && player.connected,
      );
      if (requiredWolves.every((wolf) => l.nightData.wolfVotes.has(wolf.id)))
        return resolveWolfVotes(l);
      return broadcast(l);
    }
    if (s.task === 'seer') {
      const t = find(l, target);
      if (!t) return error(socket, 'Ungültiges Ziel.');
      const isWolf = t.role === 'wolf';
      const roleName = roleInfo[t.role]?.name || 'Dorfbewohner';
      socket.emit('game:privateResult', {
        title: 'Seherinnenblick',
        targetName: t.name,
        isWolf,
        roleName,
        text: isWolf
          ? `${t.name} gehört zum Werwolf-Rudel! 🐺`
          : `${t.name} ist kein Werwolf (${roleName}). 👤`,
        icon: isWolf ? '🐺' : '🔮',
        theme: isWolf ? 'is-wolf' : 'is-safe',
      });
    } else if (s.task === 'cupid') {
      if (!data.second || data.second === target || !alive(l).some((x) => x.id === data.second))
        return error(socket, 'Wähle zwei unterschiedliche Personen.');
      l.lovers = [target, data.second];
      system(l, 'Zwei Herzen wurden verbunden.');
    } else if (s.task === 'witch') {
      if (data.kind === 'heal') {
        const victim = l.nightData.wolfTarget;
        if (l.potions.heal && victim) {
          l.potions.heal = false;
          l.nightData.healed = true;
        } else return error(socket, 'Heiltrank ist gerade nicht verfügbar.');
      } else if (data.kind === 'poison' && l.potions.poison) {
        // Cannot poison the already-healed wolf victim (waste prevention)
        if (target === l.nightData.wolfTarget && l.nightData.healed)
          return error(socket, 'Du hast dieses Opfer bereits geheilt.');
        l.potions.poison = false;
        l.nightData.poisonTarget = target;
      } else return error(socket, 'Dieser Trank ist nicht verfügbar.');
    } else if (s.task === 'guardian') {
      l.nightData.protected = target;
    } else if (s.task === 'piper') {
      if (!l.charmed.includes(target)) l.charmed.push(target);
    } else if (s.task === 'vampire') {
      l.nightData.vampireTarget = target;
    } else if (s.task === 'thief') {
      const stolenRole = find(l, target)?.role;
      p.role = stolenRole || p.role;
      system(l, 'Die Diebin hat ein neues Schicksal angenommen.');
      const roleName = roleInfo[p.role]?.name || 'Dorfbewohner';
      socket.emit('game:privateResult', {
        title: 'Neues Schicksal',
        icon: roleInfo[p.role]?.icon || '👤',
        text: `Du hast die Rolle von ${find(l, target)?.name} kopiert. Du bist jetzt: ${roleName}.`,
      });
    } else if (s.task === 'doppelganger') {
      p.copies = target;
    } else if (s.task === 'girl') {
      const wolves = alive(l).filter((player) => player.role === 'wolf');
      let text = 'Die Nacht war zu dunkel, du konntest niemanden erkennen.';
      if (wolves.length > 0) {
        l.girlState = l.girlState || { targetId: null, hintLevel: 0 };
        const currentTarget = find(l, l.girlState.targetId);
        if (!currentTarget || !currentTarget.alive || currentTarget.role !== 'wolf') {
           const wolf = wolves[Math.floor(Math.random() * wolves.length)];
           l.girlState.targetId = wolf.id;
           l.girlState.hintLevel = 1;
        } else {
           l.girlState.hintLevel++;
        }
        
        const wolf = find(l, l.girlState.targetId);
        const name = wolf.name;
        const level = l.girlState.hintLevel;
        
        if (level === 1) {
           text = `Du blinzelst und erkennst einen Wolf... Sein Name hat ${name.length} Buchstaben und beginnt mit "${name[0].toUpperCase()}".`;
        } else if (level === 2) {
           text = `Der Wolf streift wieder umher... Sein Name endet auf "${name[name.length - 1].toUpperCase()}". (Tipp 1: ${name.length} Buchstaben, beginnt mit "${name[0].toUpperCase()}")`;
        } else {
           const middle = name.length > 2 ? name.substring(1, name.length - 1) : name;
           text = `Du siehst ihn nun klarer... Weitere Buchstaben in seinem Namen sind: "${middle}". (Tipp 1: Beginnt mit "${name[0].toUpperCase()}", Tipp 2: Endet auf "${name[name.length - 1].toUpperCase()}")`;
        }
      }
      socket.emit('game:privateResult', {
        title: 'Blick in die Nacht',
        icon: '👁️',
        text: text,
      });
    } else if (s.task === 'witchhunter') {
      l.nightData.witchhunterTarget = target;
    } else if (l.phase === 'hunter') {
      kill(l, target, 'wurde vom Jäger getroffen');
      const nextFn = s.next || (() => beginNight(l));
      return afterDeaths(l, nextFn);
    } else if (l.phase === 'mayor_succession') {
      l.mayorId = target;
      system(l, `${find(l, target)?.name} wurde als Nachfolger zum Bürgermeister bestimmt.`);
      const nextFn = s.next || (() => beginNight(l));
      return afterDeaths(l, nextFn); // Check if target immediately died somehow? Usually they are alive.
    } else {
      return error(socket, 'Diese Nachtaktion ist nicht verfügbar.');
    }
    
    s.actorIds = s.actorIds.filter((id) => id !== socket.id);
    if (s.actorIds.length === 0) {
      l.taskIndex++;
      return nextTask(l);
    }
    return broadcast(l);
  });
  socket.on('game:skip', () => {
    const l = lobbyFor(socket);
    if (!l || !l.selection?.actorIds.includes(socket.id)) return;
    if (l.phase === 'night') {
      if (l.selection.task === 'wolf')
        return error(socket, 'Stimme mit dem Rudel über ein Ziel ab.');
      l.selection.actorIds = l.selection.actorIds.filter((id) => id !== socket.id);
      if (l.selection.actorIds.length === 0) {
        l.taskIndex++;
        nextTask(l);
      } else {
        broadcast(l);
      }
    } else if (l.phase === 'day' || l.phase === 'mayor_election') {
      system(l, 'Das Dorf konnte sich nicht einigen.');
      if (l.phase === 'mayor_election') dayVote(l);
      else beginNight(l);
    } else if (l.phase === 'hunter') {
      system(l, 'Der Jäger verzichtet auf seinen letzten Schuss.');
      const nextFn = l.selection?.next || (() => beginNight(l));
      afterDeaths(l, nextFn);
    }
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
      if (cur.players.every((x) => !x.connected)) {
        clearPhaseTimer(cur);
        lobbies.delete(cur.code);
      } else broadcast(cur);
      emitList();
    }, 120_000);
  });
});
server.listen(PORT, () => console.log(`YuWolf läuft auf Port ${PORT}`));
