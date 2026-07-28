# YuWolf — Yu's DüsterWald

**YuWolf — Yu's DüsterWald** is a real-time multiplayer social-deduction game built with Node.js, Express, and Socket.IO. Players create or join a village, receive secret roles, survive the night, and work together to identify the wolves before the village falls apart.

YuWolf is designed for community game nights and private friend groups. The server manages roles, votes, night actions, and lobby state so secret information is not exposed to other players in the browser.

> **Language notice:** This README is written in English, but the game interface and all in-game text are currently available in **German only**. An English game interface has not been implemented yet.

## Technology Stack

**Runtime and Server** Node.js, Express, Socket.IO

**Client** Vanilla JavaScript, HTML5, CSS3

**Deployment** Railway

**Code Formatting** Prettier

## Features

- Real-time multiplayer villages with public and private lobbies
- Password-protected private lobbies and shareable invite links
- Public lobby browser with player counts and direct joining
- Dedicated host controls for roles, house rules, themes, ready checks, and player moderation
- Random server-side role distribution with private role cards
- Classic Werewolf roles and YuWolf special roles, including Seer, Witch, Hunter, Cupid, Guardian, Fool, Piper, Vampire, and more
- Private night actions with server-side validation
- Day chat, emoji reactions, suspicion markers, and village voting
- Optional visible vote history and custom house rules
- Private player notes stored locally in the browser
- Reconnection support for short connection interruptions
- End-of-round winner screen with revealed roles
- Four visual village themes: Forest, Abandoned School, Fairy Tale Village, and Cyber-DüsterWald
- Responsive layout for desktop and mobile players
- No bots — YuWolf is built for real community games

## Requirements

- Node.js 20 or newer
- npm

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open the game in your browser:

   ```text
   http://localhost:3000
   ```

If PowerShell blocks `npm`, use:

```powershell
npm.cmd start
```

If port `3000` is already in use, choose another port:

```powershell
$env:PORT=3001
npm start
```

Then open `http://localhost:3001`.

## Deploy on Railway

YuWolf uses Socket.IO and needs a continuously running Node.js server. Railway is a suitable deployment option.

1. Push the project to a GitHub repository.
2. Create a new Railway project and select **Deploy from GitHub Repo**.
3. Select the YuWolf repository.
4. Railway runs the included `npm start` script.
5. Create a public domain under **Networking**.
6. Open the generated URL and share it with your players.

The included `railway.toml` configures the start command, health check, and restart policy.

## Project Structure

```text
server.js       Socket.IO server, lobby handling, and game rules
werwolf.html    Main game interface
game.js         Browser game and lobby logic
ui.js           UI helpers, dialogs, invite flow, and role settings
style.css       Responsive styling, cards, and visual themes
railway.toml    Railway deployment configuration
package.json    Dependencies and npm scripts
```

## Notes

- The host manages the lobby but plays normally once the match starts.
- Secret roles and night actions are only handled by the server.
- Private lobby passwords are stored as hashes in server memory.
- Lobbies and active games are reset when the server restarts or is redeployed.
- The game is designed for entertainment and does not use real money.

## License

This project currently has no explicit license. Do not reuse or redistribute it without permission from the project owner.
