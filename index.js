// Add at the TOP of your file
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Only for development!

const { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  PermissionsBitField, 
  ApplicationCommandOptionType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

// Store configuration
const serverConfig = {
  channels: new Set(),
  isActive: false
};

// Register slash commands
const commands = [
  {
    name: 'setchannel',
    description: 'Add a channel for mentions',
    options: [{
      name: 'channel',
      description: 'Select a channel to add',
      type: ApplicationCommandOptionType.Channel,
      required: true,
      channel_types: [ChannelType.GuildText]
    }]
  },
  {
    name: 'removechannel',
    description: 'Remove channels from mention list'
  },
  {
    name: 'start',
    description: 'Start mentioning new members'
  },
  {
    name: 'stop',
    description: 'Stop mentioning new members'
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Commands registered!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    // Handle slash commands
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You need administrator permissions!', ephemeral: true });
    }

    // Setchannel command - Add single channel
    if (interaction.commandName === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      
      if (!channel) {
        return interaction.reply({ 
          content: 'Invalid channel selected!', 
          ephemeral: true 
        });
      }

      if (serverConfig.channels.has(channel.id)) {
        return interaction.reply({ 
          content: `#${channel.name} is already in the mention list!`, 
          ephemeral: true 
        });
      }

      serverConfig.channels.add(channel.id);

      const embed = new EmbedBuilder()
        .setTitle('✅ Channel Added')
        .setColor(0x00FF00)
        .setDescription(`Added #${channel.name} to mention list`)
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'ID', value: channel.id, inline: true }
        )
        .setFooter({ text: `Total channels: ${serverConfig.channels.size}` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Removechannel command - Interactive menu
    if (interaction.commandName === 'removechannel') {
      if (serverConfig.channels.size === 0) {
        return interaction.reply({ 
          content: 'No channels are set for mentions!', 
          ephemeral: true 
        });
      }

      const options = Array.from(serverConfig.channels).map(channelId => {
        const channel = interaction.guild.channels.cache.get(channelId);
        return {
          label: channel?.name || 'Deleted Channel',
          value: channelId,
          description: channel ? `Remove #${channel.name}` : 'Channel not found'
        };
      });

      const menu = new StringSelectMenuBuilder()
        .setCustomId('remove_channel')
        .setPlaceholder('Select channels to remove')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(menu);

      const embed = new EmbedBuilder()
        .setTitle('Remove Mention Channels')
        .setColor(0xFF0000)
        .setDescription(`Currently tracking ${serverConfig.channels.size} channels`);

      await interaction.reply({ 
        embeds: [embed], 
        components: [row], 
        ephemeral: true 
      });
    }

    // Start command
    if (interaction.commandName === 'start') {
      serverConfig.isActive = true;
      await interaction.reply({ 
        content: '✅ Mentions activated!', 
        ephemeral: true 
      });
    }

    // Stop command
    if (interaction.commandName === 'stop') {
      serverConfig.isActive = false;
      await interaction.reply({ 
        content: '❌ Mentions deactivated!', 
        ephemeral: true 
      });
    }
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'remove_channel') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'You need administrator permissions!', ephemeral: true });
      }

      const removedChannels = [];
      for (const channelId of interaction.values) {
        if (serverConfig.channels.has(channelId)) {
          serverConfig.channels.delete(channelId);
          const channel = interaction.guild.channels.cache.get(channelId);
          removedChannels.push(channel?.name || channelId);
        }
      }

      if (removedChannels.length === 0) {
        return interaction.reply({ 
          content: 'No channels were removed!', 
          ephemeral: true 
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Channels Removed')
        .setColor(0xFFA500)
        .setDescription(`Removed ${removedChannels.length} channel(s):\n${removedChannels.map(c => `• ${c}`).join('\n')}`)
        .setFooter({ text: `Remaining channels: ${serverConfig.channels.size}` });

      await interaction.update({ 
        embeds: [embed], 
        components: [] 
      });
    }
  }
});

// Welcome message handler
client.on('guildMemberAdd', async member => {
  if (!serverConfig.isActive || serverConfig.channels.size === 0) return;

  for (const channelId of serverConfig.channels) {
    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
      try {
        const message = await channel.send(`Welcome ${member}!`);
        setTimeout(() => message.delete().catch(() => {}), 1000);
      } catch (error) {
        console.error(`Failed to send message in channel ${channelId}:`, error);
      }
    }
  }
});
// Add at the BOTTOM (before client.login)
app.get('/', (req, res) => res.status(200).send('Bot is running!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

client.login(process.env.TOKEN);