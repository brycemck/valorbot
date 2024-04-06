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
  process: () => {
    return 'The bot is working! Congrats brotha'
  },
  SlashCommand: {
    run: async (client, interaction, data) => {
      const that = module.exports;

      const newQueue = data.games.newQueue()
      try {
        const newTextChannel = await interaction.channel.parent.children.create({
          name: `queue-${newQueue.cleanId}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {type: 'member', id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel]},
            {type: 'role', id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel]}
          ]
        })
        const newVoiceChannel = await interaction.channel.parent.children.create({
          name: `queue-${newQueue.cleanId}`,
          type: ChannelType.GuildVoice,
          permissionOverwrites: [
            {type: 'member', id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel]},
            {type: 'role', id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel]}
          ]
        })
        that.embeddedMessage.fields = []     
        that.embeddedMessage.fields.push({name: `Queue #${newQueue.cleanId} Open`, value: ''})

        const queueJoiner = new ButtonBuilder()
          .setCustomId(`queue-${newQueue.cleanId}`)
          .setLabel('Join the queue')
          .setStyle(1)
  
        const row = new ActionRowBuilder().addComponents(queueJoiner)
        return interaction.reply({embeds: [that.embeddedMessage], components: [row]})
      } catch (error) {
        that.embeddedMessage.fields = []     
        that.embeddedMessage.fields.push({name: `Failure to start new queue`, value: 'Something went wrong, sorry there bud'})
        interaction.reply({embeds: [that.embeddedMessage]})
      }
      // console.log(interaction)
    }
  }
}