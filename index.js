const { Client, GatewayIntentBits, Collection, Routes, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { getRaiderIOData } = require('./utils/wowApi');
require('dotenv').config();

const statsCommand  = require('./commands/stats');
const suiviCommand  = require('./commands/suivi');
const pvpCommand    = require('./commands/pvp');
const raidsCommand  = require('./commands/raids');
const guildeCommand = require('./commands/guilde');
const mythicCommand = require('./commands/mythic');
const joueurCommand = require('./commands/joueur');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

client.commands.set(statsCommand.data.name,  statsCommand);
client.commands.set(suiviCommand.data.name,  suiviCommand);
client.commands.set(pvpCommand.data.name,    pvpCommand);
client.commands.set(raidsCommand.data.name,  raidsCommand);
client.commands.set(guildeCommand.data.name, guildeCommand);
client.commands.set(mythicCommand.data.name, mythicCommand);
client.commands.set(joueurCommand.data.name, joueurCommand);

client.suivis = {};

async function verifierSuivis() {
  for (const [key, suivi] of Object.entries(client.suivis)) {
    try {
      const data = await getRaiderIOData(suivi.region, suivi.realm, suivi.nom);
      const newScore = data?.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;

      if (suivi.lastScore === null) {
        client.suivis[key].lastScore = newScore;
        continue;
      }

      if (newScore > suivi.lastScore) {
        const channel = await client.channels.fetch(suivi.channelId);
        const diff = (newScore - suivi.lastScore).toFixed(1);
        const embed = new EmbedBuilder()
          .setTitle(`🏆 Score M+ amélioré — ${suivi.nom}!`)
          .setColor(0x00FF99)
          .addFields(
            { name: 'Ancien score',  value: `${suivi.lastScore}`, inline: true },
            { name: 'Nouveau score', value: `${newScore}`,        inline: true },
            { name: 'Progression',   value: `+${diff} pts 🎉`,   inline: true },
          )
          .setURL(`https://raider.io/characters/${suivi.region}/${encodeURIComponent(suivi.realm.toLowerCase())}/${encodeURIComponent(suivi.nom.toLowerCase())}`)
          .setTimestamp();
        await channel.send({ embeds: [embed] });
        client.suivis[key].lastScore = newScore;
      }
    } catch (err) {
      console.error(`Erreur suivi ${key}:`, err.message);
    }
  }
}

client.once('clientReady', async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  const commands = [
    statsCommand.data.toJSON(),
    suiviCommand.data.toJSON(),
    pvpCommand.data.toJSON(),
    raidsCommand.data.toJSON(),
    guildeCommand.data.toJSON(),
    mythicCommand.data.toJSON(),
    joueurCommand.data.toJSON(),
  ];

  // Dédoublonnage par nom au cas où
  const unique = Object.values(
    Object.fromEntries(commands.map(c => [c.name, c]))
  );

  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: unique });
  console.log('✅ Commandes slash enregistrées');

  setInterval(verifierSuivis, 10 * 60 * 1000);
  console.log('⏱️ Suivi automatique activé (toutes les 10 min)');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (command) await command.execute(interaction);
});

client.login(process.env.DISCORD_TOKEN);