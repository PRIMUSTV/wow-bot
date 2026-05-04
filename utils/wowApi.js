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
  console.log('Token Blizzard:', blizzardToken);
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return blizzardToken;
}

function toSlug(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

async function getCharacterProfile(region, realm, name) {
  const token = await getBlizzardToken();
  const realmSlug = toSlug(realm);
  const charName = name.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  console.log('Blizzard URL:', `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName}`);

  const [profile, equipment] = await Promise.all([
    fetch(
      `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName}` +
      `?namespace=profile-${region}&locale=en_US&access_token=${token}`
    ).then(r => r.json()).catch(() => null),
    fetch(
      `https://${region}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName}/equipment` +
      `?namespace=profile-${region}&locale=en_US&access_token=${token}`
    ).then(r => r.json()).catch(() => null),
  ]);

  console.log('Blizzard reponse:', profile?.name ?? profile?.code ?? 'null');
  return { profile, equipment };
}

async function getRaiderIOData(region, realm, name) {
  const fields = 'mythic_plus_scores_by_season:current,mythic_plus_recent_runs,raid_progression,gear,guild';
  const url = `https://raider.io/api/v1/characters/profile` +
    `?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=${fields}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Personnage introuvable sur Raider.IO');
  return res.json();
}

module.exports = { getCharacterProfile, getRaiderIOData, getBlizzardToken };