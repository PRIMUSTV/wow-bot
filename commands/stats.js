const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCharacterProfile, getRaiderIOData } = require('../utils/wowApi');

const CLASS_COLORS = {
  'Warrior': 0xC79C6E, 'Paladin': 0xF58CBA, 'Hunter': 0xABD473,
  'Rogue': 0xFFF569, 'Priest': 0xFFFFFF, 'Death Knight': 0xC41F3B,
  'Shaman': 0x0070DE, 'Mage': 0x69CCF0, 'Warlock': 0x9482C9,
  'Monk': 0x00FF96, 'Druid': 0xFF7D0A, 'Demon Hunter': 0xA330C9,
  'Evoker': 0x33937F,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Affiche les stats d\'un personnage WoW')
    .addStringOption(opt =>
      opt.setName('nom').setDescription('Nom du personnage').setRequired(true))
    .addStringOption(opt =>
      opt.setName('royaume').setDescription('Nom du royaume (ex: Hyjal)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('region').setDescription('Région').setRequired(false)
        .addChoices(
          { name: 'Europe', value: 'eu' },
          { name: 'US', value: 'us' },
          { name: 'Corée', value: 'kr' },
        )),

  async execute(interaction) {
    await interaction.deferReply();

    const name   = interaction.options.getString('nom');
    const realm  = interaction.options.getString('royaume');
    const region = interaction.options.getString('region') ?? 'eu';

    try {
      const [blizzData, rioData] = await Promise.all([
        getCharacterProfile(region, realm, name).catch(() => null),
        getRaiderIOData(region, realm, name).catch(() => null),
      ]);

      if (!blizzData?.profile && !rioData) {
        return interaction.editReply('❌ Personnage introuvable. Vérifie le nom et le royaume.');
      }

      const profile   = blizzData?.profile;
      const charClass = profile?.character_class?.name ?? rioData?.class ?? 'Inconnu';
      const color     = CLASS_COLORS[charClass] ?? 0x0099FF;

      const mScore  = rioData?.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 'N/A';
      const ilvl    = rioData?.gear?.item_level_equipped ?? profile?.average_item_level ?? 'N/A';

      const raidProg  = rioData?.raid_progression;
      const latestRaid = raidProg ? Object.entries(raidProg)[0] : null;
      const raidText  = latestRaid
        ? `${latestRaid[1].normal_bosses_killed}N / ${latestRaid[1].heroic_bosses_killed}H / ${latestRaid[1].mythic_bosses_killed}M`
        : 'N/A';

      const recentRuns = rioData?.mythic_plus_recent_runs?.slice(0, 3) ?? [];
      const runsText   = recentRuns.length
        ? recentRuns.map(r => `+${r.mythic_level} ${r.dungeon} (${r.score} pts)`).join('\n')
        : 'Aucun run récent';

      const embed = new EmbedBuilder()
        .setTitle(`${profile?.name ?? name} — ${realm}`)
        .setURL(`https://raider.io/characters/${region}/${encodeURIComponent(realm.toLowerCase())}/${encodeURIComponent(name.toLowerCase())}`)
        .setColor(color)
        .setThumbnail(rioData?.thumbnail_url ?? null)
        .addFields(
          { name: '🧙 Classe / Spé', value: `${charClass} — ${rioData?.spec ?? profile?.active_spec?.name ?? 'N/A'}`, inline: true },
          { name: '⚔️ Item Level',       value: `${ilvl}`, inline: true },
          { name: '🏆 Score M+',         value: `${mScore}`, inline: true },
          { name: '🐉 Progression Raid', value: raidText, inline: true },
          { name: '🔑 Derniers M+',      value: runsText },
        )
        .setFooter({ text: 'Données via Blizzard API & Raider.IO' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Une erreur est survenue : ' + err.message);
    }
  }
};