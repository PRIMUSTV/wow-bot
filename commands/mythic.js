const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRaiderIOData } = require('../utils/wowApi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mythic')
    .setDescription('Affiche les clés Mythic+ d\'un personnage WoW')
    .addStringOption(opt =>
      opt.setName('nom').setDescription('Nom du personnage').setRequired(true))
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

    const name   = interaction.options.getString('nom');
    const realm  = interaction.options.getString('royaume');
    const region = interaction.options.getString('region') ?? 'eu';

    try {
      const fields = 'mythic_plus_scores_by_season:current,mythic_plus_best_runs,mythic_plus_recent_runs,mythic_plus_highest_level_runs,gear';
      const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
      const url = `https://raider.io/api/v1/characters/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=${fields}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Personnage introuvable sur Raider.IO');
      const data = await res.json();

      const score      = data.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;
      const ilvl       = data.gear?.item_level_equipped ?? 'N/A';
      const highestRun = data.mythic_plus_highest_level_runs?.[0];
      const bestRuns   = data.mythic_plus_best_runs?.slice(0, 5) ?? [];
      const recentRuns = data.mythic_plus_recent_runs?.slice(0, 3) ?? [];

      // Score par rôle
      const scores = data.mythic_plus_scores_by_season?.[0]?.scores ?? {};
      const scoreDps  = scores.dps ?? 0;
      const scoreHeal = scores.healer ?? 0;
      const scoreTank = scores.tank ?? 0;

      // Meilleures runs
      const bestText = bestRuns.length
        ? bestRuns.map((r, i) =>
            `**${i + 1}.** ${r.short_name ?? r.dungeon} · +${r.mythic_level} · ${r.score?.toFixed(1) ?? '?'} pts · ${r.num_keystone_upgrades >= 1 ? '✅' : '⏱️'}`
          ).join('\n')
        : 'Aucune donnée';

      // Runs récents
      const recentText = recentRuns.length
        ? recentRuns.map(r =>
            `• ${r.short_name ?? r.dungeon} · +${r.mythic_level} · ${r.score?.toFixed(1) ?? '?'} pts`
          ).join('\n')
        : 'Aucun run récent';

      const embed = new EmbedBuilder()
        .setTitle(`🗝️ Mythic+ — ${data.name} (${realm})`)
        .setURL(`https://raider.io/characters/${region}/${encodeURIComponent(realm.toLowerCase())}/${encodeURIComponent(name.toLowerCase())}`)
        .setColor(0x00B4D8)
        .setThumbnail(data.thumbnail_url ?? null)
        .addFields(
          { name: '🏆 Score M+ (saison)',  value: `**${score}** pts`, inline: true },
          { name: '⚔️ Item Level',          value: `${ilvl}`, inline: true },
          { name: '🔑 Meilleure clé',       value: highestRun ? `+${highestRun.mythic_level} ${highestRun.short_name ?? highestRun.dungeon}` : 'N/A', inline: true },
          { name: '🗡️ Score DPS',           value: `${scoreDps}`, inline: true },
          { name: '💚 Score Heal',          value: `${scoreHeal}`, inline: true },
          { name: '🛡️ Score Tank',          value: `${scoreTank}`, inline: true },
          { name: '🏅 5 Meilleures runs',   value: bestText },
          { name: '📅 Runs récents',        value: recentText },
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