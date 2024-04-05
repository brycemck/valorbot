# valorbot

This project requires creating your own bot in your Discord developer console, and then adding it into your server. You'll need a .env file at the root of the project containing the Application ID, the Bot Token, and the Guild ID (the server ID).

1. Create a file called `.env` at the root of the project, and copy the following properties:
```
DISCORD_APP_ID=
DISCORD_GUILD_ID=
BOT_TOKEN=
```
2. Copy the Application ID and the Bot token from the Discord Developer console, and the Server ID into the guild ID field. It should look like this:
```
DISCORD_APP_ID=0000000000000
DISCORD_GUILD_ID=000000000000
BOT_TOKEN=sdfsdfssdfsf.sfsfsf.sdfsdfsdfdf-sdfsfsdfsdf
```
3. Add the bot into your server (ideally a test server to start) by replacing the client_id with the Application ID, then navigating to the link:
```
https://discord.com/oauth2/authorize?client_id=[App/Client ID]&permissions=4452018825296&scope=bot
```
4. Install all necessary dependencies by running `npm install` in a terminal window at the root of this project.
5. Run `npm start` and you should have a running bot!