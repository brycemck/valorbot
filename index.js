const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, Routes, REST } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const crypto = require('node:crypto');

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] }); // Initiates the client

// slash commands
client.commands = new Collection();
client.slashCommands = [];

// uncomment the below and replace the ID with the ID of a command you want to delete from the guild
// (async () => {
//     rest.delete(Routes.applicationGuildCommand(process.env.DISCORD_APP_ID, process.env.DISCORD_GUILD_ID, '1224290861295341601'))
//     .then(() => {
//         console.log('successfully deleted')
//     })
//     .catch((e) => { console.log(e) })
// })();

let CommandsDir = path.join(__dirname, ".", "commands");
fs.readdir(CommandsDir, (err, files) => {
  if (err) console.log(err);
  else
    files.forEach(async (file) => {
    let cmd = require(CommandsDir + "/" + file);
    if (!cmd.name || !cmd.description)
      return console.log(
      "Unable to load Command: " +
        file.split(".")[0] +
        ", Reason: File doesn't have name/description"
      );
    client.commands.set(file.split(".")[0].toLowerCase(), cmd);
    console.log("Command Loaded: " + file.split(".")[0]);

    if (cmd.SlashCommand) {
      let commandData = {
        name: cmd.name,
        description: cmd.description,
        options: cmd.SlashCommand.options
      }
      client.slashCommands.push(commandData)
    }
    });
    loadSlashCommands()
});

async function loadSlashCommands() {
  try {
    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, process.env.DISCORD_GUILD_ID),
      { body: client.slashCommands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
}

// const cooldowns = new Discord.Collection(); // Creates an empty list for storing timeouts so people can't spam with commands

// Starts the bot and makes it begin listening for commands.
client.once(Events.ClientReady, async (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  await initStores()
  savedData.init()
});

client.on(Events.InteractionCreate, async interaction => {
  // console.log(interaction)
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);

    // console.log(command)
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.SlashCommand.run(client, interaction, savedData);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}`);
      console.error(error);
    }
  } else if (interaction.isButton()) {
    await buttonHandler(interaction)
  }
});

client.login(process.env.BOT_TOKEN);

const buttonHandler = async (interaction) => {
  const buttonId = interaction.customId.split('-')
  const action = buttonId[0]
  const gameId = buttonId[1]
  if (action == 'queue') {
    savedData.games.addPlayerToQueue(interaction, gameId)
    savedData.games.save()

    return interaction.reply({content: `You're in the queue for #${gameId}. View game information and join VC with your queuemates in queue-${gameId}.`, ephemeral: true})
  }
} 
const initStores = async () => {
  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
  // get users and add them to players store
  let members = await guild.members.fetch()
  members.forEach((member) => {
    if (!member.user.bot) {
      const userInSavedData = savedData.players.Players.findIndex((player) => player.id == member.user.id)
      if (userInSavedData == -1) { // new user being added to player list
        let thisUser = Object.assign({}, savedData.players.schema)
        thisUser.id = member.user.id
        thisUser.username = member.user.username
        savedData.players.Players.push(thisUser)
      }
    }
  })
  savedData.players.save()
}
const savedData = {
  players: {
    path: 'data/players.json',
    schema: {
      id: '',
      username: ''
    },
    updatePlayer: (id, data) => {
      const thisPlayerIndex = savedData.players.Players.findIndex((player) => player.id == id)
      console.log(savedData.players.Players[thisPlayerIndex])
    },
    save: () => {
      fs.writeFileSync(savedData.players.path, JSON.stringify(savedData.players.Players))
    },
    Players: []
  },
  games: {
    path: 'data/games.json',
    schema: {
      id: '',
      players: [],
      defenders: [],
      attackers: [],
      map: '',
      state: '' // active | completed | queue
    },
    Games: [],
    save: () => {
      fs.writeFileSync(savedData.games.path, JSON.stringify(savedData.games.Games))
    },
    getGame: (id) => {
      const gameIndex = savedData.games.Games.findIndex((game) => game.id == id)
      if (gameIndex == -1) {
        return null
      } else {
        return savedData.games.Games[gameIndex]
      }
    },
    generateId: () => {
      return [crypto.randomUUID(), `${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`]
    },
    newQueue: () => {
      let thisQueue = Object.assign({}, savedData.games.schema)
      const newId = savedData.games.generateId()

      thisQueue.id = newId[0]
      thisQueue.cleanId = newId[1]
      thisQueue.timestamp = Date.now()
      thisQueue.state = 'queue'

      savedData.games.Games.push(thisQueue)
      savedData.games.save()

      return thisQueue
    },
    addPlayerToQueue: (interaction, id) => {
      const thisGameIndex = savedData.games.Games.findIndex((game) => game.cleanId == id)
      const thisGame = savedData.games.Games[thisGameIndex]

      thisGame.players.push(interaction.user.id)

      let channels = interaction.guild.channels.cache.find(channel => channel.name == `queue-${id}`)
      console.log(channels)
    }
  },
  init: () => {
    // init players
    savedData.players.data = fs.readFileSync(savedData.players.path, {flag: 'as+'})
    savedData.players.Players = savedData.players.data.length > 0 ? JSON.parse(savedData.players.data) : []

    // init games
    savedData.games.data = fs.readFileSync(savedData.games.path, {flag: 'as+'})
    savedData.games.Games = savedData.games.data.length > 0 ? JSON.parse(savedData.games.data) : []

    // savedData.games.newGame()
  }
}