const { EmbedBuilder, RoleSelectMenuBuilder } = require('discord.js');

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  name: 'test',
  description: 'Test command confirming that the bot is working.',
  usage: '',
  embeddedMessage: {
    color: 0x9013FE,
    title: 'VALORBOT',
    fields: []
  },
  process: () => {
    return 'The bot is working! Congrats brotha'
  },
  SlashCommand: {
    run: async (client, interaction) => {
      const that = module.exports;
      that.embeddedMessage.fields = []      
      that.embeddedMessage.fields.push({name: ':CATDANCE:', value: that.process()})
      return interaction.reply({embeds: [that.embeddedMessage]})
    }
  }
}