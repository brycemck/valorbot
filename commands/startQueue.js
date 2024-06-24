const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  name: 'startqueue',
  description: 'Start a new queue that other players can join.',
  usage: '',
  embeddedMessage: {
    color: 0x9013FE,
    title: 'VALORBOT',
    fields: []
  },
  SlashCommand: {
    run: async (client, interaction, data) => {
      const that = module.exports;

      const newQueue = await data.games.newQueue(interaction)
      that.embeddedMessage.fields = []     
      that.embeddedMessage.fields.push({name: `Queue #${newQueue.cleanId} opened, and you've been added to it. View game information and join VC with your queuemates in queue-${newQueue.cleanId}.`, value: ''})

      return interaction.reply({embeds: [that.embeddedMessage], ephemeral: true})
      // console.log(interaction)
    }
  }
}