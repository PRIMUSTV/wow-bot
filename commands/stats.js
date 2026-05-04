const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CLASS_COLORS = {
  'Warrior': 0xC79C6E, 'Paladin': 0xF58CBA, 'Hunter': 0xABD473,
  'Rogue': 0xFFF569, 'Priest': 0xFFFFFF, 'Death Knight': 0xC41F3B,
  'Shaman': 0x0070DE, 'Mage': 0x69CCF0, 'Warlock': 0x9482C9,
  'Monk': 0x00FF96, 'Druid': 0xFF7D0A, 'Demon Hunter': 0xA330C9,
  'Evoker': 0x33937F,
};

// Traduction EN → FR pour l'affichage
const CLASS_FR = {
  'Warrior': 'Guerrier', 'Paladin': 'Paladin', 'Hunter': 'Chasseur',
  'Rogue': 'Voleur', 'Priest': 'Prêtre', 'Death Knight': 'Chevalier de la mort',
  'Shaman': 'Chaman', 'Mage': 'Mage', 'Warlock': 'Démoniste',
  'Monk': 'Moine', 'Druid': 'Druide', 'Demon Hunter': 'Chasseur de démons',
  'Evoker': 'Évocateur',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pvp')
    .setDescription('Affiche les stats PvP d\'un personnage WoW')
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
      const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

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

      const realmSlug = realm.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents du royaume
        .replace(/\s+/g, '-');
      const charName = name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // retire les accents du nom

      // locale=en_US obligatoire pour que character_class.name matche CLASS_COLORS
      const [profileRes, pvpRes, rioRes] = await Promise.all([
        fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName}?namespace=profile-${region}&locale=en_US&access_token=${token}`),
        fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName}/pvp-summary?namespace=profile-${region}&locale=en_US&access_token=${token}`),
        fetch(`https://raider.io/api/v1/characters/profile?region=${region}&realm=${realmSlug}&name=${encodeURIComponent(name)}&fields=gear`),
      ]);

      const profile = await profileRes.json().catch(() => ({}));
      const pvpData = await pvpRes.json().catch(() => ({}));
      const rioData = await rioRes.json().catch(() => ({}));

      if (!profile.name) {
        return interaction.editReply('❌ Personnage introuvable.');
      }

      const charClass  = profile?.character_class?.name ?? 'Unknown';
      const specName   = profile?.active_spec?.name ?? 'N/A';
      const color      = CLASS_COLORS[charClass] ?? 0xFF0000;
      const honorKills = pvpData?.honorable_kills ?? 0;

      // Nom FR pour l'affichage, fallback sur l'anglais
      const charClassFR = CLASS_FR[charClass] ?? charClass;

      const brackets = Array.isArray(pvpData?.brackets) ? pvpData.brackets : [];
      const arena2v2  = brackets.find(b => b.bracket?.type === 'ARENA_2v2');
      const arena3v3  = brackets.find(b => b.bracket?.type === 'ARENA_3v3');
      const rbg       = brackets.find(b => b.bracket?.type === 'BATTLEGROUND');

      const formatBracket = (b) => {
        if (!b || !b.rating) return 'Non classé';
        const wins   = b.season_match_statistics?.won  ?? 0;
        const losses = b.season_match_statistics?.lost ?? 0;
        return `**${b.rating}** CR (${wins}V / ${losses}D)`;
      };

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Stats PvP — ${profile.name} (${realm})`)
        .setColor(color)
        .setThumbnail(rioData?.thumbnail_url ?? null)
        .addFields(
          { name: '🧙 Classe / Spé',    value: `${charClassFR} — ${specName}`, inline: true },
          { name: '⚔️ Item Level',       value: `${rioData?.gear?.item_level_equipped ?? profile?.average_item_level ?? 'N/A'}`, inline: true },
          { name: '💀 Kills honorables', value: `${honorKills.toLocaleString('fr-FR')}`, inline: true },
          { name: '🏆 2v2',             value: formatBracket(arena2v2), inline: true },
          { name: '🏆 3v3',             value: formatBracket(arena3v3), inline: true },
          { name: '⚔️ RBG',             value: formatBracket(rbg),     inline: true },
        )
        .setFooter({ text: 'Données via Blizzard API' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Une erreur est survenue : ' + err.message);
    }
  },
};