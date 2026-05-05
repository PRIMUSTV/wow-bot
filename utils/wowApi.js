const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

let blizzardToken = null;
let tokenExpiry = 0;

async function getBlizzardToken() {
  if (blizzardToken && Date.now() < tokenExpiry) return blizzardToken;
  const credentials = Buffer.from(
    `${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  blizzardToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return blizzardToken;
}

// Transforme "Temple Noir" → "temple-noir", "Laïntime" → "laintime"
function toSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, ''); // supprime tout caractère non standard restant
}

async function getCharacterProfile(region, realm, name) {
  const token = await getBlizzardToken();
  const realmSlug = toSlug(realm);
  const charSlug  = toSlug(name);

  const baseUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charSlug}`;
  const params  = `?namespace=profile-${region}&locale=fr_FR&access_token=${token}`;

  console.log('🔍 Blizzard URL:', baseUrl);

  const [profileRes, equipmentRes] = await Promise.all([
    fetch(baseUrl + params),
    fetch(baseUrl + '/equipment' + params),
  ]);

  const profile   = await profileRes.json().catch(() => null);
  const equipment = await equipmentRes.json().catch(() => null);

  // Log complet pour debug
  console.log('📦 Blizzard profile status:', profileRes.status);
  console.log('📦 Blizzard profile réponse:', JSON.stringify(profile)?.slice(0, 300));

  // Si erreur Blizzard, on retourne null proprement
  if (profile?.code || profile?.type === 'BLIZZ_NOT_FOUND') {
    console.log('❌ Blizzard erreur:', profile?.detail ?? 'Personnage introuvable');
    return { profile: null, equipment: null };
  }

  return { profile, equipment };
}

async function getRaiderIOData(region, realm, name) {
  const realmSlug = toSlug(realm);
  const nameSafe  = toSlug(name);

  const fields = 'mythic_plus_scores_by_season:current,mythic_plus_recent_runs,raid_progression,gear,guild';
  const url = `https://raider.io/api/v1/characters/profile` +
    `?region=${region}&realm=${encodeURIComponent(realmSlug)}&name=${encodeURIComponent(nameSafe)}&fields=${fields}`;

  console.log('🔍 Raider.IO URL:', url);

  const res = await fetch(url);

  console.log('📦 Raider.IO status:', res.status);

  if (!res.ok) throw new Error('Personnage introuvable sur Raider.IO');
  return res.json();
}

module.exports = { getCharacterProfile, getRaiderIOData, getBlizzardToken };