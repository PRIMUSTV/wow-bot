const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suivi')
    .setDescription('Suit automatiquement un personnage WoW')
    .addSubcommand(sub =>
      sub.setName('ajouter')
        .setDescription('Ajouter un personnage à suivre')
        .addStringOption(opt => opt.setName('nom').setDescription('Nom du personnage').setRequired(true))
        .addStringOption(opt => opt.setName('royaume').setDescription('Royaume (ex: Hyjal)').setRequired(true))
        .addStringOption(opt => opt.setName('region').setDescription('Région').setRequired(false)
          .addChoices(
            { name: 'Europe', value: 'eu' },
            { name: 'US', value: 'us' },
          )))
    .addSubcommand(sub =>
      sub.setName('liste')
        .setDescription('Voir les personnages suivis'))
    .addSubcommand(sub =>
      sub.setName('retirer')
        .setDescription('Retirer un personnage du suivi')
        .addStringOption(opt => opt.setName('nom').setDescription('Nom du personnage').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ajouter') {
      const nom    = interaction.options.getString('nom');
      const realm  = interaction.options.getString('royaume');
      const region = interaction.options.getString('region') ?? 'eu';
      const key    = `${region}-${realm}-${nom}`.toLowerCase();

      if (!interaction.client.suivis) interaction.client.suivis = {};
      if (interaction.client.suivis[key]) {
        return interaction.reply(`⚠️ **${nom}** est déjà suivi !`);
      }

      interaction.client.suivis[key] = {
        nom, realm, region,
        channelId: interaction.channelId,
        lastScore: null,
      };

      return interaction.reply(`✅ **${nom} — ${realm}** ajouté au suivi ! Les alertes seront postées dans ce salon.`);
    }

    if (sub === 'liste') {
      if (!interaction.client.suivis || Object.keys(interaction.client.suivis).length === 0) {
        return interaction.reply('📋 Aucun personnage suivi pour le moment.');
      }
      const liste = Object.values(interaction.client.suivis)
        .map(s => `• **${s.nom}** — ${s.realm} (${s.region.toUpperCase()})`)
        .join('\n');
      return interaction.reply(`📋 **Personnages suivis :**\n${liste}`);
    }

    if (sub === 'retirer') {
      const nom = interaction.options.getString('nom').toLowerCase();
      if (!interaction.client.suivis) return interaction.reply('❌ Aucun suivi actif.');
      const key = Object.keys(interaction.client.suivis).find(k => k.includes(nom));
      if (!key) return interaction.reply(`❌ **${nom}** n'est pas dans la liste de suivi.`);
      delete interaction.client.suivis[key];
      return interaction.reply(`🗑️ **${nom}** retiré du suivi.`);
    }
  }
};