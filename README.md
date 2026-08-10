# 🐺 YuWolf – Yu's DüsterWald

A real-time multiplayer **Werewolf / Werwolf** browser game built with Node.js, Socket.IO and vanilla HTML/CSS/JS. Play directly in your browser — no app download required.

🌐 **Live at:** [yuwolf.onrender.com](https://yuwolf.onrender.com)

---

## Features

- 🎮 **Full game loop** — Lobby → Night → Day → Repeat → End screen with role reveal
- 🐺 **All roles implemented** — Werewolf, Villager, Seer, Witch, Hunter, Cupid, Thief, Guardian, Vampire, Piper, Witch Hunter, Doppelganger (Girl), Weirdo, Fool, Mayor
- 🗳️ **Day voting** — Live vote bars, abstain option, mayor double-vote, tie handling
- 🌙 **Night phase** — Each role acts in order; wolves vote together, most votes wins
- 💀 **Spectator mode** — Dead players watch with full vote visibility
- 🔄 **Reconnect** — 10-second grace period to rejoin after disconnect
- 👑 **Host controls** — Kick players anytime, start rematch, manage lobby settings
- 📊 **Live stats** — Alive / dead / wolf count shown to all players
- ⚠️ **Wolf death alerts** — Whole village is notified when a wolf is eliminated
- 🏆 **End screen** — Role reveal grid for every player with winner highlights
- 📱 **Mobile-friendly** — Responsive layout for phones and tablets

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Real-time | Socket.IO |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Hosting | [Render](https://render.com) (Web Service) |

---

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/j4yac3/YuWolf.git
cd YuWolf

# Install dependencies
npm install

# Start the server
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Render

This project is configured for easy deployment on [Render](https://render.com).

1. **Fork or push** this repository to GitHub.
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repository.
4. Set the following:
   | Setting | Value |
   |---------|-------|
   | **Environment** | Node |
   | **Build Command** | `npm install` |
   | **Start Command** | `node server.js` |
   | **Instance Type** | Free (or higher for better performance) |
5. Click **Deploy** — Render will build and host your app automatically.

> **Note:** The free Render tier spins down after 15 minutes of inactivity. The first request after sleep may take ~30 seconds to respond. Upgrade to a paid plan for always-on hosting.

---

## Game Roles

| Role | Team | Description |
|------|------|-------------|
| 🐺 Werwolf | Wolf | Kills one villager each night |
| 🧑‍🌾 Dorfbewohner | Village | No special ability — vote wisely! |
| 🔮 Seherin | Village | Learns one player's role each night |
| ⚗️ Hexe | Village | Has one heal potion and one poison potion |
| 🏹 Jäger | Village | Takes one player with them when eliminated |
| 💘 Amor | Village | Links two players as lovers |
| 🗝️ Diebin | Village | Can steal a role from the draw pile |
| 🛡️ Schutzgeist | Village | Protects one player per night |
| 🧛 Vampir | Village/Neutral | Converts a player to their cause |
| 🎶 Flötenspieler | Neutral | Enchants players; wins when all are enchanted |
| 🔥 Hexenjäger | Village | Can eliminate the witch at night |
| 🎭 Doppelgänger | Neutral | Copies another player's role |
| 👁️ Mädchen | Village | Peeks during the wolf phase |
| 🃏 Narr | Neutral | Wins if voted out by the village |
| 👑 Bürgermeister | — | Elected role; vote counts double |

---

## Project Structure

```
YuWolf/
├── server.js        # Express + Socket.IO game server
├── game.js          # Client-side game logic & rendering
├── index.html       # Main HTML shell
├── style.css        # All styles (dark theme, animations)
├── package.json
└── README.md
```

---

## License

MIT — feel free to use, modify and host your own version.

---

*Made with ❤️ for Yu's DüsterWald*
