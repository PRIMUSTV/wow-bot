const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCharacterProfile, getRaiderIOData } = require('../utils/wowApi');

const CLASS_COLORS = {
  'Warrior': 0xC79C6E, 'Paladin': 0xF58CBA, 'Hunter': 0xABD473,
  'Rogue': 0xFFF569, 'Priest': 0xFFFFFF, 'Death Knight': 0xC41F3B,
  'Shaman': 0x0070DE, 'Mage': 0x69CCF0, 'Warlock': 0x9482C9,
  'Monk': 0x00FF96, 'Druid': 0xFF7D0A, 'Demon Hunter': 0xA330C9,
  'Evoker': 0x33937F,
};

const SPEC_EMOJI = {
  'Protection': '🛡️', 'Holy': '✨', 'Retribution': '⚔️',
  'Arms': '🗡️', 'Fury': '💥', 'Beast Mastery': '🐾',
  'Marksmanship': '🏹', 'Survival': '🔪', 'Assassination': '🗡️',
  'Outlaw': '⚔️', 'Subtlety': '🌑', 'Discipline': '🔮',
  'Shadow': '💜', 'Elemental': '⚡', 'Enhancement': '🔥',
  'Restoration': '💚', 'Arcane': '🌟', 'Fire': '🔥', 'Frost': '❄️',
  'Affliction': '☠️', 'Demonology': '👿', 'Destruction': '🔥',
  'Brewmaster': '🍺', 'Mistweaver': '🌿', 'Windwalker': '🌀',
  'Balance': '🌙', 'Feral': '🐱', 'Guardian': '🐻',
  'Blood': '🩸', 'Unholy': '💀', 'Havoc': '😈', 'Vengeance': '🛡️',
  'Devastation': '🐉', 'Preservation': '🌿', 'Augmentation': '⚗️'
};

function ilvlBar(ilvl) {
  const max = 700, min = 300;
  const pct = Math.min(Math.max((ilvl - min) / (max - min), 0), 1);
  const filled = Math.round(pct * 12);
  return '█'.repeat(filled) + '░'.repeat(12 - filled) + ` **${ilvl}**`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joueur')
    .setDescription('Affiche le profil complet d\'un joueur WoW')
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

      const profile   = blizzData?.profile;
      const charClass = profile?.character_class?.name ?? rioData?.class ?? 'Inconnu';
      const spec      = rioData?.spec ?? profile?.active_spec?.name ?? 'N/A';
      const color     = CLASS_COLORS[charClass] ?? 0x0099FF;
      const specEmoji = SPEC_EMOJI[spec] ?? '⚔️';

      const ilvl      = rioData?.gear?.item_level_equipped ?? profile?.average_item_level ?? 0;
      const mScore    = rioData?.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;
      const guilde    = profile?.guild?.name ?? rioData?.guild?.name ?? 'Sans guilde';
      const faction   = profile?.faction?.type === 'HORDE' ? '🔴 Horde' : '🔵 Alliance';
      const level     = profile?.level ?? rioData?.level ?? 'N/A';

      // Progression raid
      const raidProg   = rioData?.raid_progression;
      const latestRaid = raidProg ? Object.entries(raidProg)[0] : null;
      const raidText   = latestRaid
        ? `${latestRaid[1].normal_bosses_killed}N / ${latestRaid[1].heroic_bosses_killed}H / ${latestRaid[1].mythic_bosses_killed}M`
        : 'N/A';

      // Score par rôle
      const scores    = rioData?.mythic_plus_scores_by_season?.[0]?.scores ?? {};
      const scoreDps  = scores.dps ?? 0;
      const scoreHeal = scores.healer ?? 0;
      const scoreTank = scores.tank ?? 0;

      const embed = new EmbedBuilder()
        .setTitle(`${specEmoji} ${profile?.name ?? name} — ${realm}`)
        .setURL(`https://raider.io/characters/${region}/${encodeURIComponent(realm.toLowerCase())}/${encodeURIComponent(name.toLowerCase())}`)
        .setColor(color)
        .setThumbnail(rioData?.thumbnail_url ?? null)
        .addFields(
          { name: '🎮 Classe / Spé',     value: `${charClass} · ${spec}`, inline: true },
          { name: '🏰 Faction',          value: faction, inline: true },
          { name: '🌟 Niveau',           value: `${level}`, inline: true },
          { name: '⚔️ Item Level',       value: ilvlBar(ilvl), inline: false },
          { name: '🏆 Score M+',         value: `**${mScore}** pts`, inline: true },
          { name: '🗡️ DPS',             value: `${scoreDps}`, inline: true },
          { name: '💚 Heal',             value: `${scoreHeal}`, inline: true },
          { name: '🛡️ Tank',            value: `${scoreTank}`, inline: true },
          { name: '🎯 Guilde',           value: guilde, inline: true },
          { name: '🐉 Progression Raid', value: raidText, inline: true },
        )
        .setFooter({ text: `Données via Blizzard API & Raider.IO · ${region.toUpperCase()}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Une erreur est survenue : ' + err.message);
    }
  }
};