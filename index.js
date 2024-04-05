const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, Routes, REST } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] }); // Initiates the client

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
client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  // console.log(command)
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.SlashCommand.run(client, interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}`);
    console.error(error);
  }
});

client.login(process.env.BOT_TOKEN);