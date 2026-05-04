const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRaiderIOData } = require('../utils/wowApi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raids')
    .setDescription('Affiche la progression raid d\'un personnage WoW')
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
      const data = await getRaiderIOData(region, realm, name);

      if (!data) {
        return interaction.editReply('❌ Personnage introuvable.');
      }

      const raidProg = data.raid_progression;
      if (!raidProg || Object.keys(raidProg).length === 0) {
        return interaction.editReply('❌ Aucune progression raid trouvée pour ce personnage.');
      }

      const embed = new EmbedBuilder()
        .setTitle(`🐉 Progression Raid — ${data.name} (${realm})`)
        .setURL(`https://raider.io/characters/${region}/${encodeURIComponent(realm.toLowerCase())}/${encodeURIComponent(name.toLowerCase())}`)
        .setColor(0xFF6600)
        .setThumbnail(data.thumbnail_url ?? null)
        .setFooter({ text: 'Données via Raider.IO' })
        .setTimestamp();

      for (const [raidKey, prog] of Object.entries(raidProg)) {
        const raidName = raidKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const total    = prog.total_bosses ?? '?';
        const normal   = prog.normal_bosses_killed ?? 0;
        const heroic   = prog.heroic_bosses_killed ?? 0;
        const mythic   = prog.mythic_bosses_killed ?? 0;

        const barN = `${'█'.repeat(normal)}${'░'.repeat(total - normal)}`;
        const barH = `${'█'.repeat(heroic)}${'░'.repeat(total - heroic)}`;
        const barM = `${'█'.repeat(mythic)}${'░'.repeat(total - mythic)}`;

        embed.addFields({
          name: `📍 ${raidName}`,
          value: `Normal  : ${barN} ${normal}/${total}\nHéroïque: ${barH} ${heroic}/${total}\nMythique: ${barM} ${mythic}/${total}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Une erreur est survenue : ' + err.message);
    }
  }
};