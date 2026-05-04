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

      const credentials = Buffer.from(
        `${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`
      ).toString('base64');

      const tokenRes = await fetch('https://oauth.battle.net/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.access_token;

      const realmSlug  = realm.toLowerCase().replace(/\s+/g, '-');
      const guildeSlug = nom.toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, '');

      const [guildeRes, membresRes, activiteRes] = await Promise.all([
        fetch(
          `https://${region}.api.blizzard.com/data/wow/guild/${realmSlug}/${guildeSlug}` +
          `?namespace=profile-${region}&locale=fr_FR&access_token=${token}&region=${region}`
        ).then(async r => { const t = await r.text(); return t ? JSON.parse(t) : {}; }),
        fetch(
          `https://${region}.api.blizzard.com/data/wow/guild/${realmSlug}/${guildeSlug}/roster` +
          `?namespace=profile-${region}&locale=fr_FR&access_token=${token}&region=${region}`
        ).then(async r => { const t = await r.text(); return t ? JSON.parse(t) : {}; }),
        fetch(
          `https://${region}.api.blizzard.com/data/wow/guild/${realmSlug}/${guildeSlug}/achievements` +
          `?namespace=profile-${region}&locale=fr_FR&access_token=${token}&region=${region}`
        ).then(async r => { const t = await r.text(); return t ? JSON.parse(t) : {}; }),
      ]);

      console.log('Guilde data:', JSON.stringify(guildeRes).slice(0, 200));

      if (guildeRes.code === 404 || !guildeRes.name) {
        return interaction.editReply('❌ Guilde introuvable. Vérifie le nom et le royaume.');
      }

      const membres    = membresRes.members ?? [];
      const nbMembres  = membres.length;
      const officiers  = membres.filter(m => m.rank <= 2).length;

      const topMembres = membres
        .sort((a, b) => b.character.level - a.character.level)
        .slice(0, 5)
        .map(m => `• **${m.character.name}** — Niv. ${m.character.level} (Rang ${m.rank})`)
        .join('\n');

      const faction = guildeRes.faction?.type === 'HORDE' ? '🔴 Horde' : '🔵 Alliance';

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${guildeRes.name} — ${realm}`)
        .setColor(guildeRes.faction?.type === 'HORDE' ? 0xFF0000 : 0x0000FF)
        .addFields(
          { name: '🏰 Faction',      value: faction, inline: true },
          { name: '👥 Membres',      value: `${nbMembres}`, inline: true },
          { name: '⭐ Officiers',    value: `${officiers}`, inline: true },
          { name: '🏆 Hauts faits',  value: `${activiteRes.total_quantity ?? 'N/A'}`, inline: true },
          { name: '📅 Créée en',     value: guildeRes.created_timestamp
            ? new Date(guildeRes.created_timestamp).toLocaleDateString('fr-FR')
            : 'N/A', inline: true },
          { name: '🎖️ Top membres', value: topMembres || 'N/A' },
        )
        .setFooter({ text: 'Données via Blizzard API' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Une erreur est survenue : ' + err.message);
    }
  }
};