const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CLASS_COLORS = {
  'Warrior': 0xC79C6E, 'Paladin': 0xF58CBA, 'Hunter': 0xABD473,
  'Rogue': 0xFFF569, 'Priest': 0xFFFFFF, 'Death Knight': 0xC41F3B,
  'Shaman': 0x0070DE, 'Mage': 0x69CCF0, 'Warlock': 0x9482C9,
  'Monk': 0x00FF96, 'Druid': 0xFF7D0A, 'Demon Hunter': 0xA330C9,
  'Evoker': 0x33937F,
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
      const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

      // Récupère le token Blizzard
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

      const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');
      const charName = name.toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

      // Récupère les stats PvP
      const pvpRes = await fetch(
        `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName}/pvp-summary` +
        `?namespace=profile-${region}&locale=fr_FR&access_token=${token}`
      );
      const pvpText = await pvpRes.text();
      const pvpData = pvpText ? JSON.parse(pvpText) : {};

      // Récupère le profil de base
      const profileRes = await fetch(
        `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName}` +
        `?namespace=profile-${region}&locale=fr_FR&access_token=${token}`
      );
      const profile = await profileRes.json();

      if (pvpData.code === 404 || profile.code === 404) {
        return interaction.editReply('❌ Personnage introuvable.');
      }

      const charClass = profile?.character_class?.name ?? 'Inconnu';
      const color     = CLASS_COLORS[charClass] ?? 0xFF0000;

      // Brackets PvP
      const brackets  = pvpData.brackets ?? [];
      const arena2v2  = brackets.find(b => b.bracket?.type === 'ARENA_2v2');
      const arena3v3  = brackets.find(b => b.bracket?.type === 'ARENA_3v3');
      const rbg       = brackets.find(b => b.bracket?.type === 'BATTLEGROUND');

      const formatBracket = (b) => {
        if (!b) return 'N/A';
        const rating = b.rating ?? 0;
        const wins   = b.season_match_statistics?.won ?? 0;
        const losses = b.season_match_statistics?.lost ?? 0;
        return `${rating} CR (${wins}V / ${losses}D)`;
      };

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Stats PvP — ${profile.name} (${realm})`)
        .setURL(`https://worldofwarcraft.blizzard.com/fr-fr/character/${region}/${realmSlug}/${charName}`)
        .setColor(color)
        .setThumbnail(profile.media?.assets?.[0]?.value ?? null)
        .addFields(
          { name: '🧙 Classe / Spé', value: `${charClass} — ${profile?.active_spec?.name ?? 'N/A'}`, inline: true },
          { name: '⚔️ Item Level',   value: `${profile?.average_item_level ?? 'N/A'}`, inline: true },
          { name: '🏆 Hauts faits PvP', value: `${pvpData.honorable_kills ?? 0} kills honorables`, inline: true },
          { name: '2v2', value: formatBracket(arena2v2), inline: true },
          { name: '3v3', value: formatBracket(arena3v3), inline: true },
          { name: 'RBG', value: formatBracket(rbg), inline: true },
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