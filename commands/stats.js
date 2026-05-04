const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCharacterProfile, getRaiderIOData } = require('../utils/wowApi');

const CLASS_COLORS = {
  'Warrior': 0xC79C6E, 'Paladin': 0xF58CBA, 'Hunter': 0xABD473,
  'Rogue': 0xFFF569, 'Priest': 0xFFFFFF, 'Death Knight': 0xC41F3B,
  'Shaman': 0x0070DE, 'Mage': 0x69CCF0, 'Warlock': 0x9482C9,
  'Monk': 0x00FF96, 'Druid': 0xFF7D0A, 'Demon Hunter': 0xA330C9,
  'Evoker': 0x33937F,
};

const CLASS_FR = {
  'Warrior': 'Guerrier', 'Paladin': 'Paladin', 'Hunter': 'Chasseur',
  'Rogue': 'Voleur', 'Priest': 'Prêtre', 'Death Knight': 'Chevalier de la mort',
  'Shaman': 'Chaman', 'Mage': 'Mage', 'Warlock': 'Démoniste',
  'Monk': 'Moine', 'Druid': 'Druide', 'Demon Hunter': 'Chasseur de démons',
  'Evoker': 'Évocateur',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Affiche les stats générales d\'un personnage WoW')
    .addStringOption(opt =>
      opt.setName('personnage').setDescription('Nom du personnage').setRequired(true))
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

    const name   = interaction.options.getString('personnage');
    const realm  = interaction.options.getString('royaume');
    const region = interaction.options.getString('region') ?? 'eu';

    try {
      const [blizzData, rioData] = await Promise.all([
        getCharacterProfile(region, realm, name).catch(() => null),
        getRaiderIOData(region, realm, name).catch(() => null),
      ]);

      if (!blizzData?.profile && !rioData) {
        return interaction.editReply('❌ Personnage introuvable.');
      }

      const profile    = blizzData?.profile;
      const charClass  = profile?.character_class?.name ?? rioData?.class ?? 'Unknown';
      const charClassFR = CLASS_FR[charClass] ?? charClass;
      const spec       = profile?.active_spec?.name ?? rioData?.active_spec_name ?? 'N/A';
      const color      = CLASS_COLORS[charClass] ?? 0x0099FF;

      const ilvl    = rioData?.gear?.item_level_equipped ?? profile?.average_item_level ?? 0;
      const mScore  = rioData?.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;

      // Progression raid
      const raidProg   = rioData?.raid_progression;
      const latestRaid = raidProg ? Object.entries(raidProg)[0] : null;
      const raidText   = latestRaid
        ? `${latestRaid[1].normal_bosses_killed}N / ${latestRaid[1].heroic_bosses_killed}H / ${latestRaid[1].mythic_bosses_killed}M`
        : 'N/A';

      // Derniers M+
      const recentRuns = rioData?.mythic_plus_recent_runs ?? [];
      const runsText = recentRuns.length > 0
        ? recentRuns.slice(0, 3).map(r => `+${r.mythic_level} ${r.dungeon} (${r.num_keystone_upgrades}⭐)`).join('\n')
        : 'Aucun run récent';

      const embed = new EmbedBuilder()
        .setTitle(`${profile?.name ?? rioData?.name ?? name} — ${realm}`)
        .setURL(`https://raider.io/characters/${region}/${encodeURIComponent(realm.toLowerCase())}/${encodeURIComponent(name.toLowerCase())}`)
        .setColor(color)
        .setThumbnail(rioData?.thumbnail_url ?? null)
        .addFields(
          { name: '🎮 Classe / Spé',     value: `${charClassFR} — ${spec}`, inline: true },
          { name: '⚔️ Item Level',        value: `${ilvl}`, inline: true },
          { name: '🏆 Score M+',          value: `${mScore}`, inline: true },
          { name: '🐉 Progression Raid',  value: raidText, inline: false },
          { name: '🔑 Derniers M+',       value: runsText, inline: false },
        )
        .setFooter({ text: `Données via Blizzard API & Raider.IO · ${region.toUpperCase()}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Une erreur est survenue : ' + err.message);
    }
  },
};