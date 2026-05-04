const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guilde')
    .setDescription('Affiche les infos d\'une guilde WoW')
    .addStringOption(opt =>
      opt.setName('nom').setDescription('Nom de la guilde').setRequired(true))
    .addStringOption(opt =>
      opt.setName('royaume').setDescription('Nom du royaume (ex: Hyjal)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('region').setDescription('Région').setRequired(false)
        .addChoices(
          { name: 'Europe', value: 'eu' },
          { name: 'US', value: 'us' },
        )),

  async execute(interaction) {
    await interaction.deferReply();

    const nom    = interaction.options.getString('nom');
    const realm  = interaction.options.getString('royaume');
    const region = interaction.options.getString('region') ?? 'eu';

    try {
      const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

      const realmSlug  = realm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      const guildeSlug = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const url = `https://raider.io/api/v1/guilds/profile?region=${region}&realm=${realmSlug}&name=${encodeURIComponent(nom)}&fields=raid_progression,raid_rankings,members`;
      const res = await fetch(url);
      const data = await res.json();

      console.log('Guilde RIO:', JSON.stringify(data).slice(0, 300));

      if (data.statusCode === 400 || data.statusCode === 404 || !data.name) {
        return interaction.editReply('❌ Guilde introuvable. Vérifie le nom et le royaume.');
      }

      const faction = data.faction === 'horde' ? '🔴 Horde' : '🔵 Alliance';
      const color   = data.faction === 'horde' ? 0xFF0000 : 0x0000FF;

      const raidProg = data.raid_progression;
      const latestRaid = raidProg ? Object.entries(raidProg)[0] : null;
      const raidText = latestRaid
        ? `${latestRaid[1].normal_bosses_killed}N / ${latestRaid[1].heroic_bosses_killed}H / ${latestRaid[1].mythic_bosses_killed}M`
        : 'N/A';

      const nbMembres = data.members?.length ?? 'N/A';

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${data.name} — ${data.realm}`)
        .setURL(`https://raider.io/guilds/${region}/${realmSlug}/${encodeURIComponent(nom)}`)
        .setColor(color)
        .addFields(
          { name: '🏰 Faction',         value: faction, inline: true },
          { name: '👥 Membres',         value: `${nbMembres}`, inline: true },
          { name: '🐉 Progression Raid', value: raidText, inline: true },
        )
        .setFooter({ text: 'Données via Raider.IO' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Une erreur est survenue : ' + err.message);
    }
  }
};