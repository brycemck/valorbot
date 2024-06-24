const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, Routes, REST, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ChannelType, AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, CommandInteractionOptionResolver } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const crypto = require('node:crypto');

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] }); // Initiates the client

// slash commands
client.commands = new Collection();
client.slashCommands = [];

let imagesForMessges = {}

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
  initImages()
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
  } else if (interaction.isModalSubmit()) {
    await modalInputHandler(interaction)
  }
});

client.login(process.env.BOT_TOKEN);

const buttonHandler = async (interaction) => {
  const buttonId = interaction.customId.split('-')
  const action = buttonId[0]
  const gameId = buttonId[1]
  const thisGameIndex = savedData.games.Games.findIndex(game => game.cleanId == gameId);
  const thisGame = savedData.games.Games[thisGameIndex]
  
  if (action == 'queue') {
    if (!thisGame.players.includes(interaction.user.id)) {
      savedData.games.addPlayerToQueue(interaction, gameId)
      savedData.games.save()

      return interaction.reply({content: `You're in the queue for #${gameId}. View game information and join VC with your queuemates in queue-${gameId}.`, ephemeral: true})
    } else {
      return interaction.reply({content: `You're already in the queue for #${gameId}, silly.`, ephemeral: true})
    }
  } else if (action == 'shuffleteams') {
    savedData.games.shuffleTeams(interaction, gameId)
    return interaction.reply({content: `Reshuffling the teams!`})
  } else if (action == 'shufflemap') {
    savedData.games.shuffleMap(interaction, gameId)
    return interaction.reply({content: `Reshuffling the map!`})
  } else if (action == 'init') {
    savedData.games.startGame(interaction, thisGame)
    return interaction.reply({content: `Initializing the game...`})
  } else if (action == 'cancel') {
    savedData.games.cancelGame(interaction, gameId)
    return interaction.reply({content: `Cancelling the game! Byeeeeeee`})
  } else if (action == 'confirm') {
    savedData.games.confirmGame(interaction, gameId)
    return interaction.reply({content: `Confirmed game, stand by`})
  } else if (action == 'complete') {
    return savedData.games.completeGame(interaction, gameId)
    // return interaction.reply({content: `Game marked as completed!`})
  } else {
    interaction.reply({content: `There isn't a response configured for this kind of interaction.`})
    console.log(action)
  }
}
const modalInputHandler = (interaction) => {
  const modalId = interaction.customId.split('-')
  const type = modalId[0]
  const gameId = modalId[1]
  const thisGameIndex = savedData.games.Games.findIndex(game => game.cleanId == gameId);
  const thisGame = savedData.games.Games[thisGameIndex]

  const attackerScoreInput = interaction.fields.getTextInputValue(`attackerscore-${gameId}`)
  const defenderScoreInput = interaction.fields.getTextInputValue(`defenderscore-${gameId}`)

  thisGame.score = {}
  thisGame.score.attackers = attackerScoreInput
  thisGame.score.defenders = defenderScoreInput

  savedData.games.save()

  interaction.reply({content: `Attackers: ${thisGame.score.attackers}\nDefenders: ${thisGame.score.defenders}\nGGWP`})

  savedData.games.initiateSelfDestructSequence(interaction, thisGame)
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
const initImages = () => {
  imagesForMessges.abyss = new AttachmentBuilder('images/abyss.jpg').setName('abyss.jpg')
  imagesForMessges.ascent = new AttachmentBuilder('images/ascent.jpg').setName('ascent.jpg')
  imagesForMessges.bind = new AttachmentBuilder('images/bind.jpg').setName('bind.jpg')
  imagesForMessges.breeze = new AttachmentBuilder('images/breeze.jpg').setName('breeze.jpg')
  imagesForMessges.fracture = new AttachmentBuilder('images/fracture.jpg').setName('fracture.jpg')
  imagesForMessges.haven = new AttachmentBuilder('images/haven.jpg').setName('haven.jpg')
  imagesForMessges.icebox = new AttachmentBuilder('images/icebox.jpg').setName('icebox.jpg')
  imagesForMessges.lotus = new AttachmentBuilder('images/lotus.jpg').setName('lotus.jpg')
  imagesForMessges.pearl = new AttachmentBuilder('images/pearl.jpg').setName('pearl.jpg')
  imagesForMessges.split = new AttachmentBuilder('images/split.jpg').setName('split.jpg')
  imagesForMessges.sunset = new AttachmentBuilder('images/sunset.jpg').setName('sunset.jpg')
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
      state: '', // active | completed | queue | cancelled
      voiceChannelId: '',
      textChannelId: '',
      gameStartingMessageId: ''
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
      return [crypto.randomUUID(), `${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`]
    },
    newQueue: async (interaction) => {
      let thisQueue = Object.assign({}, savedData.games.schema)
      const newId = savedData.games.generateId()

      thisQueue.id = newId[0]
      thisQueue.cleanId = newId[1]
      thisQueue.timestamp = Date.now()
      thisQueue.state = 'queue'
      thisQueue.channelStartedFromId = interaction.channel.id
      thisQueue.players = []
      thisQueue.defenders = []
      thisQueue.attackers = []

      try {
        const newTextChannel = await interaction.channel.parent.children.create({
          name: `${thisQueue.cleanId}-queue`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {type: 'member', id: client.user.id, allow: [PermissionFlagsBits.ViewChannel]}, // add Valorbot to the channel so it can manage it
            {type: 'role', id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel]} // deny @everyone
          ]
        })
        const newVoiceChannel = await interaction.channel.parent.children.create({
          name: `${thisQueue.cleanId}-queue`,
          type: ChannelType.GuildVoice,
          permissionOverwrites: [
            {type: 'member', id: client.user.id, allow: [PermissionFlagsBits.ViewChannel]}, // add Valorbot to the channel so it can manage it
            {type: 'role', id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel]} // deny @everyone
          ]
        })
        thisQueue.voiceChannelId = newVoiceChannel.id
        thisQueue.textChannelId = newTextChannel.id

        const queueStartedMessage = await savedData.games.queueStartedMessage(thisQueue)
        newTextChannel.send(queueStartedMessage)
      } catch (error) {

      }

      savedData.games.Games.push(thisQueue)
      savedData.games.save()

      // send message to Queues channel with new queue
      const queueJoiner = new ButtonBuilder()
          .setCustomId(`queue-${thisQueue.cleanId}`)
          .setLabel('Join the queue')
          .setStyle(1)
  
      const row = new ActionRowBuilder().addComponents(queueJoiner)

      let embeddedMessage = {}
      embeddedMessage.fields = [{name: `Queue #${thisQueue.cleanId} opened!`, value: ''}]
      const queueOpenedMessage = await interaction.channel.send({embeds: [embeddedMessage], components: [row]})
      thisQueue.queueMessageId = queueOpenedMessage.id
      
      // add player to the queue
      savedData.games.addPlayerToQueue(interaction, thisQueue.cleanId)

      return thisQueue
    },
    addPlayerToQueue: async (interaction, id) => {
      // console.log(`adding ${interaction.user.username} to queue ${id}`)
      const thisGameIndex = savedData.games.Games.findIndex(game => game.cleanId == id);
      const thisGame = savedData.games.Games[thisGameIndex]

      // add player id to players array in game object
      thisGame.players.push(interaction.user.id)
      
      // get text and voice channels for this queue
      interaction.guild.channels.fetch()
      const queueTextChannel = await interaction.guild.channels.fetch(thisGame.textChannelId)
      const queueVoiceChannel = await interaction.guild.channels.fetch(thisGame.voiceChannelId)
      
      // add permissions to both cnhannels
      try {
        queueTextChannel.permissionOverwrites.edit(interaction.user.id, {'ViewChannel': true})
        queueVoiceChannel.permissionOverwrites.edit(interaction.user.id, {'ViewChannel': true})
      } catch (error) {
        interaction.reply({content: `Something went wrong, please try again.`, ephemeral: true})
        console.log('error when trying to change channel permissions')
        console.log(error)
      }

      // send message to text channel that player joined
      let embeddedMessage = {}
      embeddedMessage.fields = [{name: `Queue`, value: `Player <@${interaction.user.id}> has joined the queue!`}]
      queueTextChannel.send({embeds: [embeddedMessage]})

      // update initial 'queue started' message with members in queue
      const queueStartedMessage = await interaction.channel.messages.fetch(thisGame.queueMessageId)

      let listedPlayers = ''
      thisGame.players.forEach(player => {
        listedPlayers += `<@${player}>, `
      })
      
      embeddedMessage = {}
      embeddedMessage.fields = [{name: `Queue #${thisGame.cleanId} opened!`, value: `Currently in queue:\n${listedPlayers}`}]
      queueStartedMessage.edit({embeds: [embeddedMessage]})

      // start the game once we get a full queue
      if (thisGame.players.length == 10) {
        savedData.games.startGame(interaction, thisGame)
      }
      savedData.games.save()
    },
    randomizeTeams: (players) => {
      let currentIndex = players.length;
      // While there remain elements to shuffle...
      while (currentIndex != 0) {
        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [players[currentIndex], players[randomIndex]] = [
          players[randomIndex], players[currentIndex]];
      }
    },
    randomMap: () => {
      let mapPool = ['Abyss', 'Ascent', 'Bind', 'Breeze', 'Fracture', 'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset']
      return mapPool[Math.floor(Math.random() * mapPool.length)];
    },
    shuffleMap: async (interaction, gameId) => {
      const thisGameIndex = savedData.games.Games.findIndex(game => game.cleanId == gameId);
      const thisGame = savedData.games.Games[thisGameIndex]

      thisGame.map = savedData.games.randomMap()
      const gameReadyMessage = await interaction.channel.messages.fetch(thisGame.gameStartingMessageId)
      let editedMessage = await savedData.games.gameReadyMessage(thisGame)
      gameReadyMessage.edit(editedMessage)
    },
    shuffleTeams: async (interaction, gameId) => {
      const thisGameIndex = savedData.games.Games.findIndex(game => game.cleanId == gameId);
      const thisGame = savedData.games.Games[thisGameIndex]

      savedData.games.randomizeTeams(thisGame.players)
      thisGame.defenders = []
      thisGame.attackers = []
      let halfOfPlayers = Math.floor(thisGame.players.length / 2);
      let i = 0;
      while (i < halfOfPlayers) { // first half
        thisGame.attackers.push(thisGame.players[i])
        i++
      }
      while (i < thisGame.players.length) { // second half
        thisGame.defenders.push(thisGame.players[i])
        i++
      }
      let attackersNames = ''
      let defendersNames = ''
      thisGame.attackers.forEach(id => { // list attacker usernames
        const foundPlayerIndex = savedData.players.Players.findIndex(player => player.id == id);
        attackersNames += `${savedData.players.Players[foundPlayerIndex].username}, `
      })
      thisGame.defenders.forEach(id => { // list defender usernames
        const foundPlayerIndex = savedData.players.Players.findIndex(player => player.id == id);
        defendersNames += `${savedData.players.Players[foundPlayerIndex].username}, `
      })
      thisGame.attackerNames = attackersNames
      thisGame.defenderNames = defendersNames
      
      savedData.games.save()
      const gameReadyMessage = await interaction.channel.messages.fetch(thisGame.gameStartingMessageId)
      let editedMessage = await savedData.games.gameReadyMessage(thisGame)
      gameReadyMessage.edit(editedMessage)
    },
    gameReadyMessage: async (thisGame, confirmed) => {
      let message = {}
      let embeddedMessage = {}
      if (thisGame.map !== '') {
        const row = new ActionRowBuilder()
        if (!confirmed) {
          // create buttons for confirm, reshuffle teams and reshuffle map
          const confirmGameButton = new ButtonBuilder()
              .setCustomId(`confirm-${thisGame.cleanId}`)
              .setLabel('Confirm & Start Game')
              .setStyle(3)
          const reshuffleTeamsButton = new ButtonBuilder()
              .setCustomId(`shuffleteams-${thisGame.cleanId}`)
              .setLabel('Re-shuffle Teams')
              .setStyle(2)
          const reshuffleMapButton = new ButtonBuilder()
              .setCustomId(`shufflemap-${thisGame.cleanId}`)
              .setLabel('Re-shuffle Map')
              .setStyle(2)
          const cancelGameButton = new ButtonBuilder()
              .setCustomId(`cancel-${thisGame.cleanId}`)
              .setLabel('Cancel Game')
              .setStyle(4)
          row.addComponents(confirmGameButton, reshuffleTeamsButton, reshuffleMapButton, cancelGameButton) 
        } else {
          const completeGameButton = new ButtonBuilder()
              .setCustomId(`complete-${thisGame.cleanId}`)
              .setLabel('Complete Game')
              .setStyle(3)
          const cancelGameButton = new ButtonBuilder()
              .setCustomId(`cancel-${thisGame.cleanId}`)
              .setLabel('Cancel Game')
              .setStyle(4)
          row.addComponents(completeGameButton, cancelGameButton)
        }
        message.components = [row]
        embeddedMessage.image = {}

        if (thisGame.map == 'Ascent') {
          embeddedMessage.image.url = 'attachment://ascent.jpg'
          message.files = [imagesForMessges.ascent]
        } else if (thisGame.map == 'abyss') {
          embeddedMessage.image.url = 'attachment://abyss.jpg'
          message.files = [imagesForMessges.abyss]
        } else if (thisGame.map == 'Bind') {
          embeddedMessage.image.url = 'attachment://bind.jpg'
          message.files = [imagesForMessges.bind]
        } else if (thisGame.map == 'Breeze') {
          embeddedMessage.image.url = 'attachment://breeze.jpg'
          message.files = [imagesForMessges.breeze]
        } else if (thisGame.map == 'Fracture') {
          embeddedMessage.image.url = 'attachment://fracture.jpg'
          message.files = [imagesForMessges.fracture]
        } else if (thisGame.map == 'Haven') {
          embeddedMessage.image.url = 'attachment://haven.jpg'
          message.files = [imagesForMessges.haven]
        } else if (thisGame.map == 'Icebox') {
          embeddedMessage.image.url = 'attachment://icebox.jpg'
          message.files = [imagesForMessges.icebox]
        } else if (thisGame.map == 'Lotus') {
          embeddedMessage.image.url = 'attachment://lotus.jpg'
          message.files = [imagesForMessges.lotus]
        } else if (thisGame.map == 'Pearl') {
          embeddedMessage.image.url = 'attachment://pearl.jpg'
          message.files = [imagesForMessges.pearl]
        } else if (thisGame.map == 'Split') {
          embeddedMessage.image.url = 'attachment://split.jpg'
          message.files = [imagesForMessges.split]
        } else if (thisGame.map == 'Sunset') {
          embeddedMessage.image.url = 'attachment://sunset.jpg'
          message.files = [imagesForMessges.sunset]
        }
        embeddedMessage.fields = [
          { name: 'Map', value: `${thisGame.map}` },
          { name: 'Defenders', value: `${thisGame.defenderNames}`, inline: true },
          { name: 'Attackers', value: `${thisGame.attackerNames}`, inline: true }
        ]
      } else {
        embeddedMessage.fields = [{ name: 'Starting soon', value: `Game has reached ${thisGame.players.length} players! Starting game...` }]
      }
      embeddedMessage.title = 'Game is ready!'
      message.embeds = [embeddedMessage]
      
      return message
    },
    queueStartedMessage: async (thisGame) => {
      let message = {}
      let embeddedMessage = {}
      
      const startGameButton = new ButtonBuilder()
          .setCustomId(`init-${thisGame.cleanId}`)
          .setLabel('Initialize Game')
          .setStyle(1)
      const cancelGameButton = new ButtonBuilder()
          .setCustomId(`cancel-${thisGame.cleanId}`)
          .setLabel('Cancel Game')
          .setStyle(4)
      const row = new ActionRowBuilder().addComponents(startGameButton, cancelGameButton)
      message.components = [row]
      embeddedMessage.title = "Queue has started!"
      embeddedMessage.fields = [{ name: '', value: 'Come back here to start or cancel the game. The game will be initialized automatically when there are 10 people in queue.' }]
      message.embeds = [embeddedMessage]
      
      return message
    },
    startGame: async (interaction, thisGame) => {
      const queueTextChannel = await interaction.guild.channels.fetch(thisGame.textChannelId)
      let newMessage = await savedData.games.gameReadyMessage(thisGame)
      
      const gameStartingMessage = await queueTextChannel.send(newMessage)
      thisGame.gameStartingMessageId = gameStartingMessage.id
      
      // randomize teams
      savedData.games.randomizeTeams(thisGame.players)
      // assign attackers and defenders
      let halfOfPlayers = Math.floor(thisGame.players.length / 2);
      let i = 0;
      while (i < halfOfPlayers) { // first half
        thisGame.attackers.push(thisGame.players[i])
        i++
      }
      while (i < thisGame.players.length) { // second half
        thisGame.defenders.push(thisGame.players[i])
        i++
      }
      // set random map
      thisGame.map = savedData.games.randomMap()

      // wait 5 seconds and then display game info (map, attackers/defenders) and buttons
      await new Promise(resolve => setTimeout(resolve, 5000)) // wait 5 seconds to build suspense

      let attackersNames = ''
      let defendersNames = ''
      thisGame.attackers.forEach(id => { // list attacker usernames
        const foundPlayerIndex = savedData.players.Players.findIndex(player => player.id == id);
        attackersNames += `${savedData.players.Players[foundPlayerIndex].username}, `
      })
      thisGame.defenders.forEach(id => { // list defender usernames
        const foundPlayerIndex = savedData.players.Players.findIndex(player => player.id == id);
        defendersNames += `${savedData.players.Players[foundPlayerIndex].username}, `
      })
      thisGame.attackerNames = attackersNames
      thisGame.defenderNames = defendersNames
      let updatedMessage = await savedData.games.gameReadyMessage(thisGame)

      savedData.games.save()

      await gameStartingMessage.edit(updatedMessage)
    },
    cancelGame: async (interaction, gameId) => {
      const thisGameIndex = savedData.games.Games.findIndex(game => game.cleanId == gameId);
      const thisGame = savedData.games.Games[thisGameIndex]

      thisGame.state = 'cancelled'
      const queueMessageChannel = await interaction.guild.channels.fetch(thisGame.channelStartedFromId)
      const queueStartedMessage = await queueMessageChannel.messages.fetch(thisGame.queueMessageId);
      let embeddedMessage = {}
      embeddedMessage.fields = [{name: `Queue #${thisGame.cleanId} is closed`, value: `*we'll get em next time*`}]
      queueStartedMessage.edit({embeds: [embeddedMessage], components: []})

      savedData.games.save()
      savedData.games.initiateSelfDestructSequence(interaction, thisGame)
    },
    confirmGame: async (interaction, gameId) => {
      const thisGameIndex = savedData.games.Games.findIndex(game => game.cleanId == gameId);
      const thisGame = savedData.games.Games[thisGameIndex]

      thisGame.state = 'active'
      const queueTextChannel = await interaction.guild.channels.fetch(thisGame.textChannelId)
      const gameReadyMessage = await savedData.games.gameReadyMessage(thisGame, true)
      gameReadyMessage.embeds[0].title = `HERE'S YOUR GAME!`
      gameReadyMessage.embeds[0].fields.push({ name: 'No takebacksies!', value: `Don't forget to come back after the game is done to mark it as completed!` })
      queueTextChannel.send(gameReadyMessage)

      const queueMessageChannel = await interaction.guild.channels.fetch(thisGame.channelStartedFromId)
      const queueStartedMessage = await queueMessageChannel.messages.fetch(thisGame.queueMessageId);
      let embeddedMessage = {}
      embeddedMessage.fields = [{name: `Queue #${thisGame.cleanId} is closed`, value: `*we'll get em next time*`}]
      queueStartedMessage.edit({embeds: [embeddedMessage], components: []})

      savedData.games.save()
    },
    completeGame: async (interaction, gameId) => {
      const thisGameIndex = savedData.games.Games.findIndex(game => game.cleanId == gameId);
      const thisGame = savedData.games.Games[thisGameIndex]

      thisGame.state = 'complete'
      savedData.games.save()

      const modal = new ModalBuilder().setCustomId(`modal-${gameId}`).setTitle('Game scoring information')
      const attackerScoreRow = new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`attackerscore-${gameId}`).setLabel('Attacker score').setStyle(1))
      const defenderScoreRow = new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`defenderscore-${gameId}`).setLabel('Defender score').setStyle(1))

      modal.addComponents(attackerScoreRow, defenderScoreRow)
      await interaction.showModal(modal)
    },
    initiateSelfDestructSequence: async (interaction, thisGame) => {
      let selfDestructCountdown = 5;
      let embeddedMessage = {}
      embeddedMessage.fields = [{name: `Queue #${thisGame.cleanId} is a goner.`, value: `This channel, along with its associated voice chat, will self destruct in ${selfDestructCountdown} seconds. Byeeeeeee`}]
      try {
        const queueTextChannel = await interaction.guild.channels.fetch(thisGame.textChannelId)
        const queueVoiceChannel = await interaction.guild.channels.fetch(thisGame.voiceChannelId)
        const selfDestructMessage = await queueTextChannel.send({embeds: [embeddedMessage]})
        while (selfDestructCountdown > 0) {
          selfDestructCountdown--
          await new Promise(resolve => setTimeout(resolve, 1000))
          embeddedMessage.fields[0].value = `This channel, along with its associated voice chat, will self destruct in ${selfDestructCountdown} seconds. Byeeeeeee`
          selfDestructMessage.edit({embeds: [embeddedMessage]})
          if (selfDestructCountdown == 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)) // have to wait a couple seconds otherwise it gets angy
            queueTextChannel.delete()
            queueVoiceChannel.delete()
          }
        }
      } catch(error) {
        console.log(error)
      }
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