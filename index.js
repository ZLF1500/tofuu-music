const path = require('path');
const { spawn } = require('child_process');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const playdl = require('play-dl');
const Genius = require('genius-lyrics');
const fs = require('fs');
require('dotenv').config();

const VOICE_CHANNEL_ID = '1467448487082852394';
const GUILD_ID         = '1278222559363600465';
const SPOTIFY_CLIENT_ID     = '9e6caf932a7f4418a28520e7950b4887';
const SPOTIFY_CLIENT_SECRET = 'b3ff13689eb0452cbf000748874aaa88';
const SAVED_QUEUE_FILE  = path.join(__dirname, 'saved_queue.json');
const PLAYLISTS_FILE    = path.join(__dirname, 'playlists.json');
const mode247  = new Set();
const djMode   = new Set();
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

const DEFAULT_SETTINGS = {
  mode247:      false,
  djMode:       false,
  autoplay:     true,
  announceNext: true,
  defaultVol:   100,
  maxPlaylist:  100,
  loop:         'off',
  genreOnly:    null,
};
const guildSettings = new Map();

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    try {
      const all = fs.existsSync(SETTINGS_FILE) ? JSON.parse(fs.readFileSync(SETTINGS_FILE)) : {};
      guildSettings.set(guildId, { ...DEFAULT_SETTINGS, ...(all[guildId] || {}) });
    } catch { guildSettings.set(guildId, { ...DEFAULT_SETTINGS }); }
  }
  return guildSettings.get(guildId);
}
function saveSettings(guildId) {
  try {
    const all = fs.existsSync(SETTINGS_FILE) ? JSON.parse(fs.readFileSync(SETTINGS_FILE)) : {};
    all[guildId] = guildSettings.get(guildId);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(all, null, 2));
  } catch(e) { console.error('saveSettings error:', e.message); }
}

const QUEUE_PER_PAGE    = 10;
const C = { np:0x1DB954, queue:0x5865F2, success:0x1DB954, danger:0xED4245, warn:0xFEE75C, muted:0x36393F, info:0x5865F2 };
const BOT_ICON = () => client.user?.displayAvatarURL();
const footer   = () => ({ text:'Tofuu Music', iconURL:BOT_ICON() });

const client = new Client({ intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent] });
const queues       = new Map();
const geniusClient = new Genius.Client();

const GENRE_OPTIONS = [
  { label: '🎵 Off (semua genre)',  value: 'off',        description: 'Autoplay tidak difilter genre' },
  { label: '🎤 Vocaloid',           value: 'vocaloid',   description: 'Hatsune Miku, UTAU, Vocaloid' },
  { label: '⚡ Nightcore',          value: 'nightcore',  description: 'Nightcore only' },
  { label: '🎛️ Audio Edit',         value: 'audioedit',  description: 'Speed up, slowed, reverb, pitch, remix' },
  { label: '🎸 Funk',               value: 'funk',       description: 'Funk, groove, slap bass, disco' },
  { label: '🌀 Phonk',              value: 'phonk',      description: 'Phonk, drift phonk, memphis' },
  { label: '🎧 EDM',                value: 'edm',        description: 'Electronic, techno, house, dubstep' },
  { label: '🌸 J-Pop / Anime',      value: 'jpop',       description: 'J-Pop, anime OST, opening/ending' },
  { label: '💎 K-Pop',              value: 'kpop',       description: 'K-Pop, idol, BTS, BLACKPINK' },
  { label: '🎹 Lo-Fi',              value: 'lofi',       description: 'Lo-fi, chill hop, study beats' },
  { label: '🤘 Metal',              value: 'metal',      description: 'Metal, metalcore, djent' },
  { label: '🎷 Jazz',               value: 'jazz',       description: 'Jazz, blues, bossa nova' },
  { label: '🎻 Classical',          value: 'classical',  description: 'Orkestra, piano solo, symphony' },
  { label: '🎤 Pop',                value: 'pop',        description: 'Pop Indonesia & internasional' },
  { label: '🌿 Indie',              value: 'indie',      description: 'Indie pop, indie folk, alternative' },
  { label: '🇮🇩 Indonesian Music',  value: 'indonesian', description: 'Musik Indonesia, dangdut, keroncong' },
  { label: '🕌 Islamic Music',      value: 'islamic',    description: 'Nasyid, sholawat, nasheed' },
  { label: '🎤 R&B / Soul',         value: 'rnb',        description: 'R&B, soul, neo soul' },
  { label: '🎤 Rap / Hip-Hop',      value: 'rap',        description: 'Rap, hip-hop, trap' },
  { label: '🪗 Acoustic / Folk',    value: 'acoustic',   description: 'Acoustic, unplugged, fingerstyle' },
  { label: '🇧🇷 Montagem / Baile Funk', value: 'montagem', description: 'Montagem, Baile Funk, Funk Carioca' },
];

const GENRE_KEYWORD_MAP = {
  vocaloid:   [
    // Engine
    'vocaloid','synthv','synth v','cevio','cevio ai','utau','vocalo','voiceroid','neutrino','diffsinger','nnsvs',
    // Vocaloid characters
    'hatsune miku','kagamine rin','kagamine len','megurine luka','kaito vocaloid','meiko vocaloid',
    'gumi vocaloid','ia vocaloid','v flower','zunko','mayu vocaloid','yukari yuzuki','galaco',
    // SynthV characters
    'kasane teto synthv','eleanor forte','saki ai','kevin synthv','solaria synthv','anri rune','asterian',
    'natalie synthv','var synthv','eri synthv','chiyu synthv','yae miko synthv',
    // CeVIO / CeVIO AI characters
    'kafu cevio','cevio kafu','ia cevio','one cevio','koharu rikka','sato sasara','takahashi','tsurumaki maki',
    'natsuki karin','tsuina chan','suzuki tsudumi',
    // UTAU characters
    'namine ritsu','teto kasane','kasane teto','sukone tei','defoko','ruko yokune','momo momone',
    // Japanese terms
    '初音ミク','鏡音リン','鏡音レン','巡音ルカ','歌い手','utaite','niconico','ボカロ','ボーカロイド',
  ],
  nightcore:  ['nightcore'],
  audioedit:  ['sped up','speed up','spedup','pitched up','slowed reverb','slowed + reverb','slowed down','reverb version','pitch up','pitched','remix','edit audio','audio edit','lofi edit','phonk edit','anime edit','amv','nightcore -'],
  funk:       ['funk music','funky','slap bass','disco funk','funk guitar','funk band','g-funk'],
  phonk:      ['phonk','drift phonk','memphis rap','hard phonk','cowbell phonk','phonk music'],
  edm:        ['edm','electronic dance','techno music','trance music','dubstep','drum and bass','dnb music','house music','future bass','hyperpop'],
  jpop:       ['anime','jpop','j-pop','japanese pop','anime ost','anime opening','anime ending','anime cover','anime song','アニメ','日本語'],
  kpop:       ['kpop','k-pop','korean pop','blackpink','bts official','twice official','stray kids','aespa official','newjeans official','ive official','itzy official'],
  lofi:       ['lofi hip hop','lo-fi hip hop','lofi beats','chillhop','chill hop music','study beats','lofi music'],
  metal:      ['metal music','metalcore','deathcore','djent','heavy metal','thrash metal','screamo','death metal','black metal'],
  jazz:       ['jazz music','bossa nova','jazz guitar','bebop','smooth jazz','jazz piano','big band'],
  classical:  ['classical music','orchestral','symphony orchestra','piano concerto','violin concerto','chamber music','opera music','philharmonic'],
  pop:        ['pop music official','pop song official','official music video','official audio','pop indonesia official'],
  indie:      ['indie pop','indie folk','indie rock','bedroom pop','indie music','alternative indie','lo-fi indie'],
  indonesian: ['lagu indonesia','musik indonesia','pop indonesia','dangdut','keroncong','lagu indo','band indonesia','penyanyi indonesia','lagu melayu'],
  islamic:    ['nasyid','sholawat','salawat','musik islami','islamic music','nasheed','hadroh','murottal','qasidah marawis'],
  rnb:        ['r&b music','rnb music','soul music','neo soul','contemporary r&b','smooth rnb'],
  rap:        ['rap music','hip hop music','trap music','freestyle rap','cypher rap','rap song','hip-hop'],
  acoustic:   ['acoustic cover','acoustic version','unplugged','fingerstyle guitar','acoustic guitar','folk music','acoustic session'],
  montagem:   ['montagem','baile funk','funk carioca','funk brasil','funk brasileiro','funk melody','tamborzão','proibidão','mc ','phonk montagem','brazilian phonk','brega funk','piseiro'],
};

const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Putar lagu').addStringOption(o=>o.setName('lagu').setDescription('Nama lagu atau link').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Skip lagu'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop musik'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause musik'),
  new SlashCommandBuilder().setName('resume').setDescription('Lanjutkan musik'),
  new SlashCommandBuilder().setName('queue').setDescription('Lihat antrian'),
  new SlashCommandBuilder().setName('np').setDescription('Now playing'),
  new SlashCommandBuilder().setName('remove').setDescription('Hapus lagu dari queue').addIntegerOption(o=>o.setName('posisi').setDescription('Nomor posisi lagu di queue').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('loop').setDescription('Loop lagu/queue').addStringOption(o=>o.setName('mode').setDescription('off/song/queue').setRequired(true).addChoices({name:'off',value:'off'},{name:'song',value:'song'},{name:'queue',value:'queue'})),
  new SlashCommandBuilder().setName('volume').setDescription('Atur volume').addIntegerOption(o=>o.setName('level').setDescription('0-100').setRequired(true).setMinValue(0).setMaxValue(100)),
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle queue'),
  new SlashCommandBuilder().setName('voteskip').setDescription('Vote skip lagu'),
  new SlashCommandBuilder().setName('save').setDescription('Simpan queue'),
  new SlashCommandBuilder().setName('load').setDescription('Load queue tersimpan'),
  new SlashCommandBuilder().setName('lyrics').setDescription('Lirik lagu').addStringOption(o=>o.setName('judul').setDescription('Judul lagu').setRequired(false)),
  new SlashCommandBuilder().setName('bass').setDescription('Bassboost').addIntegerOption(o=>o.setName('level').setDescription('0-10').setRequired(true).setMinValue(0).setMaxValue(10)),
  new SlashCommandBuilder().setName('autoplay').setDescription('Toggle autoplay'),
  new SlashCommandBuilder().setName('undo').setDescription('Hapus lagu terakhir di antrian'),
  new SlashCommandBuilder().setName('move').setDescription('Pindahkan lagu di queue')
    .addIntegerOption(o=>o.setName('dari').setDescription('Posisi asal lagu').setRequired(true).setMinValue(1))
    .addIntegerOption(o=>o.setName('ke').setDescription('Posisi tujuan lagu').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('help').setDescription('Daftar semua command'),
  new SlashCommandBuilder().setName('247').setDescription('Toggle 24/7 mode (bot stay di VC)'),
  new SlashCommandBuilder().setName('dj').setDescription('Toggle DJ mode (auto-queue berdasarkan selera)'),
  new SlashCommandBuilder().setName('savepl').setDescription('Simpan queue sebagai playlist').addStringOption(o=>o.setName('nama').setDescription('Nama playlist').setRequired(true)),
  new SlashCommandBuilder().setName('loadpl').setDescription('Load playlist tersimpan').addStringOption(o=>o.setName('nama').setDescription('Nama playlist').setRequired(true)),
  new SlashCommandBuilder().setName('listpl').setDescription('Lihat semua playlist tersimpan'),
  new SlashCommandBuilder().setName('delpl').setDescription('Hapus playlist').addStringOption(o=>o.setName('nama').setDescription('Nama playlist').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Hapus semua lagu di queue kecuali yang sedang diputar'),
  new SlashCommandBuilder().setName('settings').setDescription('Lihat & atur semua pengaturan bot'),
  new SlashCommandBuilder().setName('setgenre').setDescription('Set filter genre autoplay')
    .addStringOption(o => o.setName('genre').setDescription('Pilih genre').setRequired(true)
      .addChoices(...GENRE_OPTIONS.map(g => ({ name: g.label, value: g.value })))),
].map(c=>c.toJSON());

// ─── PLAYLIST HELPERS ────────────────────────────────────────────────────────
function loadPlaylists() {
  try { return fs.existsSync(PLAYLISTS_FILE) ? JSON.parse(fs.readFileSync(PLAYLISTS_FILE)) : {}; } catch { return {}; }
}
function savePlaylists(data) { fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(data, null, 2)); }

// ─── SPOTIFY ──────────────────────────────────────────────────────────────────
let spotifyToken = null, spotifyTokenExpiry = 0;
async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded','Authorization':'Basic '+Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')},
    body:'grant_type=client_credentials'
  });
  const d = await res.json();
  spotifyToken = d.access_token;
  spotifyTokenExpiry = Date.now() + (d.expires_in - 60) * 1000;
  return spotifyToken;
}
async function getSpotifyTrack(url) {
  try {
    const token = await getSpotifyToken();
    const id = url.split('/track/')[1]?.split('?')[0]; if (!id) return null;
    const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`,{headers:{'Authorization':`Bearer ${token}`}});
    const t = await res.json();
    return `${t.name} ${t.artists[0].name}`;
  } catch { return null; }
}
async function getSpotifyPlaylist(url, maxLimit=100) {
  try {
    const token = await getSpotifyToken();
    const id = url.split('/playlist/')[1]?.split('?')[0]; if (!id) return [];
    let tracks = [], offset = 0, limit = 50;
    while (tracks.length < maxLimit) {
      const res = await fetch(`https://api.spotify.com/v1/playlists/${id}/tracks?limit=${limit}&offset=${offset}`,{headers:{'Authorization':`Bearer ${token}`}});
      const d = await res.json();
      if (!d.items?.length) break;
      tracks.push(...d.items.filter(i=>i.track).map(i=>`${i.track.name} ${i.track.artists[0].name}`));
      if (!d.next || tracks.length >= maxLimit) break;
      offset += limit;
    }
    return tracks.slice(0, maxLimit);
  } catch { return []; }
}

// ─── AUTOPLAY ─────────────────────────────────────────────────────────────────

// Genre keyword groups — kalau judul/channel cocok, prioritaskan lagu dari grup yang sama
const GENRE_GROUPS = [
  ['vocaloid','synthv','synth v','cevio','utau','vocalo','voiceroid','neutrino','diffsinger',
   'hatsune miku','kagamine','megurine luka','gumi vocaloid','ia vocaloid','v flower',
   'kasane teto','kafu cevio','eleanor forte','saki ai','solaria','namine ritsu',
   'utaite','niconico','初音ミク','鏡音','巡音','ボカロ','ボーカロイド','歌い手'],
  ['nightcore'],
  ['sped up','speed up','spedup','pitched up','slowed reverb','slowed + reverb','slowed down','reverb version','pitch up','audio edit','lofi edit','phonk edit','anime edit','amv'],
  ['funk','funky','groove','bass guitar','slap bass','disco funk','soul funk'],
  ['lofi','lo-fi','lo fi','chill hop','chillhop','study music','beats to'],
  ['phonk','drift phonk','memphis','hard phonk','cowbell phonk'],
  ['metal','metalcore','deathcore','djent','heavy metal','thrash metal','screamo'],
  ['jazz','bossa nova','swing jazz','bebop','blues jazz'],
  ['classical','orchestral','symphony','piano solo','violin solo','cello solo','chamber music'],
  ['kpop','k-pop','idol group','blackpink','bts ','twice ','stray kids','aespa','newjeans','ive ','itzy','nmixx','lesserafim'],
  ['anime','ost','opening','ending','insert song','jpop','j-pop','japanese','japan','romaji',
   'anime cover','anime song','anime music',
   '\u3000','\u3041','\u3042','\u304b','\u3053','\u3055','\u305f','\u306a','\u306f','\u307e','\u3084','\u3089','\u308f',
   '\u30a1','\u30a2','\u30ab','\u30b3','\u30b5','\u30bf','\u30ca','\u30cf','\u30de','\u30e4','\u30e9','\u30ef',
  ],
  ['edm','electronic','techno','trance','dubstep','drum and bass','dnb','house music','future bass','hyperpop'],
  ['acoustic','unplugged','folk','singer songwriter','indie folk','fingerstyle'],
  ['rap','hip hop','hip-hop','trap beat','freestyle rap','cypher','diss track'],
  ['rnb','r&b','soul music','neo soul','smooth rnb'],
  ['montagem','baile funk','funk carioca','funk brasil','tamborzão','mc ','phonk montagem','brazilian phonk','brega funk'],
];

// Deteksi tambahan: kalau judul mengandung karakter CJK (Chinese/Japanese/Korean), treat as anime/jpop
function hasCJK(text) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/.test(text||'');
}

function detectGenreKeywords(text) {
  const lower = (text||'').toLowerCase();
  const matched = [];
  for (const group of GENRE_GROUPS) {
    if (group.some(k => lower.includes(k))) {
      matched.push(...group);
    }
  }
  // Kalau ada karakter CJK, tambahkan keyword anime/jpop
  if (hasCJK(text) && !matched.some(k => k === 'anime')) {
    const animeGroup = GENRE_GROUPS.find(g => g.includes('anime'));
    if (animeGroup) matched.push(...animeGroup);
  }
  return [...new Set(matched)]; // dedupe
}

// ─── GENRE FILTER ─────────────────────────────────────────────────────────────

async function searchGenreDirect(query, histSet=new Set()) {
  return new Promise(resolve => {
    try {
      const proc = spawn('python',['-m','yt_dlp','--dump-json','--flat-playlist','--no-warnings','--quiet',
        '--cookies',path.join(__dirname,'cookies.txt'),
        '--playlist-end','15',`ytsearch15:${query}`]);
      let out = '';
      proc.stdout.on('data',d=>out+=d.toString());
      proc.stderr.on('data',()=>{});
      proc.on('close',()=>{
        try {
          const lines = out.trim().split('\n').filter(l=>{try{JSON.parse(l);return true;}catch{return false;}});
          const candidates = lines
            .map(l=>{try{return JSON.parse(l);}catch{return null;}})
            .filter(v=>{
              if (!v || histSet.has(v.id)) return false;
              const dur = v.duration || 0;
              return dur > 0 && dur <= 600;
            });
          if (!candidates.length) return resolve(null);
          const pick = candidates[Math.floor(Math.random()*Math.min(candidates.length,5))];
          const uploader = (pick.uploader||pick.channel||'').replace(/\s*(VEVO|Official|Music|Topic)$/i,'').trim();
          resolve({
            title:    pick.title||'Unknown',
            url:      `https://www.youtube.com/watch?v=${pick.id}`,
            duration: pick.duration_string||'N/A',
            requester:'Autoplay',
            source:   'youtube',
            artist:   uploader,
          });
        } catch { resolve(null); }
      });
      proc.on('error',()=>resolve(null));
    } catch { resolve(null); }
  });
}

async function getRelatedSong(lastUrl, history=[], artistHistory=[], genreHints=[], guildId=null) {
  return new Promise(resolve=>{
    try {
      const videoId = lastUrl.split('v=')[1]?.split('&')[0]; if (!videoId) return resolve(null);
      const proc = spawn('python',['-m','yt_dlp','--dump-json','--flat-playlist','--no-warnings','--quiet',
        '--cookies',path.join(__dirname,'cookies.txt'),'--remote-components','ejs:github',
        '--playlist-end','30',`https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`]);
      let out='';
      proc.stdout.on('data',d=>out+=d.toString()); proc.stderr.on('data',()=>{});
      proc.on('close',()=>{
        try {
          const lines = out.trim().split('\n').filter(l=>{try{JSON.parse(l);return true;}catch{return false;}});
          const histSet = new Set(history);
          let candidates = lines.slice(1)
            .map(l=>{ try { return JSON.parse(l); } catch { return null; } })
            .filter(v => {
              if (!v || histSet.has(v.id)) return false;
              // Block lagu > 10 menit di autoplay
              const dur = v.duration || 0;
              return dur > 0 && dur <= 600;
            });

          if (!candidates.length) return resolve(null);

          // Hard filter: kalau genreOnly aktif, hanya lagu yang cocok keyword genre itu
          const genreOnly = guildId ? getSettings(guildId).genreOnly : null;
          if (genreOnly && genreOnly !== 'off' && GENRE_KEYWORD_MAP[genreOnly]) {
            const hardKeywords = GENRE_KEYWORD_MAP[genreOnly];
            const filtered = candidates.filter(v => {
              const combined = ((v.title||'') + ' ' + (v.uploader||v.channel||'')).toLowerCase();
              return hardKeywords.some(k => combined.includes(k));
            });
            if (filtered.length) {
              candidates = filtered;
            } else {
              const searchQuery = hardKeywords.slice(0,3).join(' ') + ' music';
              return searchGenreDirect(searchQuery, histSet).then(resolve);
            }
          }

          // Score tiap kandidat dengan recency weight:
          // keyword dari lagu yang lebih baru di genreHistory dapat bobot lebih tinggi
          const scored = candidates.map(v => {
            const titleLower = (v.title||'').toLowerCase();
            const channelLower = (v.uploader||v.channel||'').toLowerCase();
            const combined = titleLower + ' ' + channelLower;
            let score = 0;
            const total = genreHints.length || 1;
            genreHints.forEach((k, i) => {
              if (combined.includes(k)) {
                score += 1 + (i / total);
              }
            });
            return { v, score };
          });

          // Prioritas: genre match dulu, fallback ke random kalau tidak ada
          scored.sort((a, b) => b.score - a.score);
          const topScore = scored[0].score;

          let pool;
          if (topScore > 0) {
            pool = scored.filter(x => x.score === topScore).map(x => x.v);
          } else {
            pool = scored.map(x => x.v);
          }

          pool = pool.sort(() => Math.random() - 0.5);
          const pick = pool[0];
          const uploader = (pick.uploader||pick.channel||'').replace(/\s*(VEVO|Official|Music|Topic)$/i,'').trim();
          resolve({
            title:    pick.title||'Unknown',
            url:      `https://www.youtube.com/watch?v=${pick.id}`,
            duration: pick.duration_string||'N/A',
            requester:'Autoplay',
            source:   'youtube',
            artist:   uploader,
          });
        } catch { resolve(null); }
      });
      proc.on('error',()=>resolve(null));
    } catch { resolve(null); }
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const thumb    = url => { const id=url.split('v=')[1]?.split('&')[0]||url.split('youtu.be/')[1]?.split('?')[0]; return id?`https://img.youtube.com/vi/${id}/maxresdefault.jpg`:null; };
const thumbMed = url => { const id=url.split('v=')[1]?.split('&')[0]||url.split('youtu.be/')[1]?.split('?')[0]; return id?`https://img.youtube.com/vi/${id}/mqdefault.jpg`:null; };
const toTime   = s => { if(!s||isNaN(s)) return '0:00'; const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sec=s%60; return h>0?`${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`:`${m}:${sec.toString().padStart(2,'0')}`; };
const durToSec = d => { if(!d||d==='N/A') return 0; const p=d.split(':').map(Number); return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+(p[1]||0); };
const progressBar = (cur, total, size=20) => {
  const p = total > 0 ? Math.min(cur / total, 1) : 0;
  const f = Math.round(size * p);
  const pct = Math.round(p * 100);
  const filled = '▬'.repeat(Math.max(0, f));
  const empty  = '╌'.repeat(Math.max(0, size - f));
  return `\`${toTime(cur)}\`\n${filled}◉${empty}\n\`${toTime(total)}\`  ·  \`${pct}%\``;
};
const volBar   = vol => { const f=Math.round(vol/10); return '█'.repeat(f)+'░'.repeat(10-f)+` **${vol}%**`; };
const fmtDur   = sec => { if(sec<60) return `${sec}s`; if(sec<3600) return `${Math.floor(sec/60)}m ${sec%60}s`; return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`; };

const NOISE_TAGS = [
  /\[official lyric video\]/gi, /\(official lyric video\)/gi,
  /\[official\]/gi, /\[hd\]/gi, /\[hq\]/gi, /\[4k\]/gi, /\[explicit\]/gi,
  /\[audio\]/gi, /\[visualizer\]/gi, /\[lyric video\]/gi, /\[live\]/gi,
  /\(official (music )?video\)/gi, /\(official audio\)/gi, /\(official\)/gi,
  /\(lyrics?( video)?\)/gi, /\(music video\)/gi, /\(explicit\)/gi,
  /\(audio\)/gi, /\(visualizer\)/gi, /\(lyric video\)/gi, /\(live\)/gi,
  /\(prod\.?[^)]*\)/gi, /\[prod\.?[^\]]*\]/gi,
];
function shortTitle(title, max=40) {
  if (!title) return 'Music';
  let t = title;
  for (const re of NOISE_TAGS) t = t.replace(re, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  const dash = t.indexOf(' - ');
  if (dash > 0) {
    const artist = t.slice(0, dash).trim();
    const song   = t.slice(dash + 3).trim();
    t = `${song} - ${artist}`;
  }
  return t.length > max ? t.slice(0, max-1).trim() + '…' : t;
}

function updateStatus(title) {
  client.user.setPresence({activities:[{name:shortTitle(title)||'Music',type:ActivityType.Listening}],status:'online'});
}
async function updateChannelStatus(title, q=null) {
  try {
    let status = '';
    if (title) {
      const pos   = q ? 1 : 1;
      const total = q ? q.songs.length : 1;
      const cleanTitle = title
        .replace(/#\S+/g, '')
        .replace(/\[(?!.*(?:feat|ft|ver|version|mix|edit))[^\]]*\]/gi, '')
        .replace(/\((?!.*(?:feat|ft|ver|version|mix|edit|cover))[^)]*\)/gi, '')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      status = `**${pos}/${total} │ ${shortTitle(cleanTitle, 35)}**`;
    }
    await client.rest.put(`/channels/${VOICE_CHANNEL_ID}/voice-status`, { body: { status } });
  } catch {}
}

// ─── EMBEDS ───────────────────────────────────────────────────────────────────
function npEmbed(song, q, elapsed=0) {
  const img = thumb(song.url);
  const total = durToSec(song.duration);
  const loopLabel = {off:'Off',song:'Song 🔂',queue:'Queue 🔁'}[q.loop]||'Off';
  const sourceIcon = {soundcloud:'☁️', direct:'🔗', youtube:'▶️'}[song.source||'youtube'] || '▶️';
  const e = new EmbedBuilder()
    .setColor(song.source==='soundcloud' ? 0xFF5500 : C.np)
    .setAuthor({name:`${sourceIcon}  Now Playing`,iconURL:BOT_ICON()})
    .setTitle(song.title).setURL(song.url)
    .setDescription(progressBar(elapsed,total))
    .addFields(
      {name:'👤  Requested by',value:song.requester,inline:true},
      {name:'⏱  Duration',    value:`\`${song.duration}\``,inline:true},
      {name:'📋  In Queue',   value:`\`${q.songs.length} song${q.songs.length!==1?'s':''}\``,inline:true},
      {name:'🔊  Volume',     value:volBar(q.volume),inline:true},
      {name:'🔁  Loop',       value:`\`${loopLabel}\``,inline:true},
      {name:'🔄  Autoplay',   value:q.autoplay?'`On  ✓`':'`Off`',inline:true},
    )
    .setFooter(footer()).setTimestamp();
  if (img) e.setImage(img);
  return e;
}

function queuedEmbed(song, pos) {
  const img = thumbMed(song.url);
  const e = new EmbedBuilder()
    .setColor(C.info).setAuthor({name:'📋  Track Queued',iconURL:BOT_ICON()})
    .setTitle(song.title).setURL(song.url)
    .addFields(
      {name:'Duration',    value:`\`${song.duration}\``,inline:true},
      {name:'Position',    value:`\`#${pos}\``,inline:true},
      {name:'Requested by',value:song.requester,inline:true},
    )
    .setFooter(footer()).setTimestamp();
  if (img) e.setThumbnail(img);
  return e;
}

function queueEmbed(q, page=1) {
  const np        = q.songs[0];
  const img       = thumbMed(np.url);
  const userSongs = q.songs.slice(1).filter(s => s.requester !== 'Autoplay');
  const autoQueue = q.songs.slice(1).filter(s => s.requester === 'Autoplay');

  // Hanya tampilkan lagu yang benar-benar sudah ada di queue (no predictions)
  const allDisplay = [...userSongs, ...autoQueue];
  const totalPages = Math.max(1, Math.ceil(allDisplay.length / QUEUE_PER_PAGE));
  page = Math.min(Math.max(1, page), totalPages);

  const npRemaining = q.startTime ? Math.max(0, durToSec(np.duration) - getElapsed(q)) : durToSec(np.duration);
  let accum = npRemaining;
  const etaMap = [];
  for (const s of allDisplay) { etaMap.push(accum); accum += durToSec(s.duration); }

  const totalSec = q.songs.reduce((a,s)=>a+durToSec(s.duration),0);
  const npTitle  = np.title.length > 60 ? np.title.slice(0,57)+'…' : np.title;
  const isNpAuto = np.requester === 'Autoplay';
  const npLine   = `**[${npTitle}](${np.url})**${isNpAuto ? '  🔄 *@autoplay*' : ''}\n\`${np.duration}\`  ·  by **${np.requester}**`;

  const start = (page-1)*QUEUE_PER_PAGE;
  const slice = allDisplay.slice(start, start+QUEUE_PER_PAGE);

  let upNextValue = '';

  const userInSlice = slice.filter(s => s.requester !== 'Autoplay');
  if (userInSlice.length) {
    upNextValue += userInSlice.map(s => {
      const idx    = allDisplay.indexOf(s);
      const eta    = Math.max(0, etaMap[idx] ?? 0);
      const etaStr = eta < 3600 ? `in ${toTime(eta)}` : fmtDur(eta);
      const title  = s.title.length > 45 ? s.title.slice(0,42)+'…' : s.title;
      return `\`${String(idx+1).padStart(2,' ')}.\`  [${title}](${s.url})  \`${s.duration}\`  ·  *${etaStr}*`;
    }).join('\n');
  }

  const autoInSlice = slice.filter(s => s.requester === 'Autoplay');
  if (autoInSlice.length) {
    if (upNextValue) upNextValue += '\n\n';
    upNextValue += '**Autoplay queue:**\n';
    upNextValue += autoInSlice.map(s => {
      const idx    = allDisplay.indexOf(s);
      const eta    = Math.max(0, etaMap[idx] ?? 0);
      const etaStr = eta < 3600 ? `in ${toTime(eta)}` : fmtDur(eta);
      const title  = s.title.length > 45 ? s.title.slice(0,42)+'…' : s.title;
      return `\`${String(idx+1).padStart(2,' ')}.\`  🔄 [${title}](${s.url})  \`${s.duration}\`  ·  *${etaStr}*`;
    }).join('\n');
  }

  if (!upNextValue) upNextValue = '*Queue kosong*';

  const totalCount = q.songs.length - 1;
  return new EmbedBuilder()
    .setColor(C.queue)
    .setAuthor({name:`📋  Queue  ·  ${totalCount} song${totalCount!==1?'s':''}  ·  ${fmtDur(totalSec)}`,iconURL:BOT_ICON()})
    .setDescription(`**Page:** ${page}/${totalPages}  ·  **Playing position:** 1/${q.songs.length}`)
    .addFields(
      {name:'▶  Now Playing', value:npLine},
      {name:'⏭  Up Next',     value:upNextValue.slice(0,1020)},
      {name:'🔁 Loop',     value:`\`${q.loop}\``,              inline:true},
      {name:'🔄 Autoplay', value:q.autoplay?'`On`':'`Off`',    inline:true},
      {name:'🔊 Volume',   value:`\`${q.volume}%\``,           inline:true},
    )
    .setThumbnail(img||null)
    .setFooter({text:`Tofuu Music  ·  Page ${page} of ${totalPages}`,iconURL:BOT_ICON()})
    .setTimestamp();
}

function queueNavButtons(q, page=1) {
  const totalPages = Math.max(1,Math.ceil((q.songs.length-1)/QUEUE_PER_PAGE));
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('q_first').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page<=1),
    new ButtonBuilder().setCustomId('q_prev') .setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page<=1),
    new ButtonBuilder().setCustomId('q_page') .setLabel(`| ${page} / ${totalPages} |`).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId('q_next') .setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page>=totalPages),
    new ButtonBuilder().setCustomId('q_last') .setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page>=totalPages),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('q_close').setLabel('✕').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2];
}

function notif(msg, color=C.np, title=null) {
  const e = new EmbedBuilder().setColor(color).setDescription(msg).setFooter(footer());
  if (title) e.setAuthor({name:title,iconURL:BOT_ICON()});
  return e;
}


function helpEmbed() {
  const cmds = [
    ['🎵 Musik',      ['`mp/play` — Putar lagu/URL/SC/Spotify (autocomplete tersedia)','`mskip/skip` — Skip lagu','`mstop/stop` — Stop & keluar','`mpause/pause` — Pause','`mresume/resume` — Resume']],
    ['📋 Queue',      ['`mq/queue` — Lihat antrian (paginated)','`mremove/remove` — Hapus lagu dari queue','`mclear/clear` — Hapus semua lagu di queue','`mmove/move` — Pindahkan lagu di queue','`mshuffle/shuffle` — Shuffle queue','`mundo/undo` — Hapus lagu terakhir']],
    ['💽 Playlist',   ['`msavepl/savepl <nama>` — Simpan queue sebagai playlist','`mloadpl/loadpl <nama>` — Load playlist','`mlistpl/listpl` — Lihat semua playlist','`mdelpl/delpl <nama>` — Hapus playlist','`msave/save` — Simpan queue (satu slot)','`mload/load` — Load queue tersimpan']],
    ['⚙️ Pengaturan', ['`mvol/volume` — Volume (0-100)','`mloop/loop` — Loop (off/song/queue)','`mbass/bass` — Bassboost (0-10)','`mautoplay/autoplay` — Toggle autoplay','`m247/247` — Toggle 24/7 mode','`mdj/dj` — Toggle DJ mode','`msettings/settings` — Panel pengaturan lengkap']],
    ['📝 Lainnya',    ['`mnp/np` — Now playing','`mlyrics/lyrics` — Lirik lagu','`mvskip/voteskip` — Vote skip']],
  ];
  const e = new EmbedBuilder()
    .setColor(C.np)
    .setAuthor({name:'🎀  Tofuu Music Bot — Help',iconURL:BOT_ICON()})
    .setDescription('Prefix: `m`  ·  Slash commands tersedia');
  for (const [cat, list] of cmds) e.addFields({name:cat, value:list.join('\n'), inline:false});
  e.setFooter(footer()).setTimestamp();
  return e;
}

// ─── SETTINGS UI ─────────────────────────────────────────────────────────────
function settingsEmbed(guildId) {
  const s = getSettings(guildId);
  const on  = '🟢 On';
  const off = '🔴 Off';
  const genreLabel = s.genreOnly && s.genreOnly !== 'off'
    ? (GENRE_OPTIONS.find(g => g.value === s.genreOnly)?.label || s.genreOnly)
    : '🎵 Off (semua genre)';
  return new EmbedBuilder()
    .setColor(C.info)
    .setAuthor({ name: '⚙️  Bot Settings', iconURL: BOT_ICON() })
    .setDescription('Klik tombol di bawah untuk mengubah pengaturan.')
    .addFields(
      { name: '🌙  24/7 Mode',       value: s.mode247      ? on : off, inline: true },
      { name: '🎧  DJ Mode',          value: s.djMode       ? on : off, inline: true },
      { name: '🔄  Autoplay',         value: s.autoplay     ? on : off, inline: true },
      { name: '📢  Announce Next',    value: s.announceNext ? on : off, inline: true },
      { name: '🔁  Default Loop',     value: `\`${s.loop}\``,          inline: true },
      { name: '🔊  Default Volume',   value: `\`${s.defaultVol}%\``,   inline: true },
      { name: '📋  Max Playlist',     value: `\`${s.maxPlaylist} songs\``, inline: true },
      { name: '🎼  Genre Only',       value: genreLabel,               inline: true },
    )
    .setFooter({ text: 'Tofuu Music  ·  Pengaturan tersimpan otomatis', iconURL: BOT_ICON() })
    .setTimestamp();
}

function settingsButtons(guildId) {
  const s = getSettings(guildId);
  const loopModes = ['off', 'song', 'queue'];
  const nextLoop  = loopModes[(loopModes.indexOf(s.loop) + 1) % loopModes.length];
  // Row 1: Genre select menu
  const currentGenre = s.genreOnly || 'off';
  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('set_genre')
      .setPlaceholder('🎼  Genre Only — pilih filter autoplay...')
      .addOptions(GENRE_OPTIONS.map(g => ({
        label:       g.label,
        value:       g.value,
        description: g.description,
        default:     g.value === currentGenre,
      })))
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('set_247')    .setLabel('24/7')         .setEmoji('🌙').setStyle(s.mode247      ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('set_dj')     .setLabel('DJ Mode')      .setEmoji('🎧').setStyle(s.djMode       ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('set_ap')     .setLabel('Autoplay')     .setEmoji('🔄').setStyle(s.autoplay     ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('set_ann')    .setLabel('Announce')     .setEmoji('📢').setStyle(s.announceNext ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('set_loop')   .setLabel(`Loop: ${nextLoop}`).setEmoji('🔁').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('set_vol_down') .setLabel('Vol -10')      .setEmoji('🔉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('set_vol_up')   .setLabel('Vol +10')      .setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('set_pl_modal') .setLabel('Max Playlist') .setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('set_reset')    .setLabel('Reset Default').setEmoji('🔃').setStyle(ButtonStyle.Danger),
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('set_close').setLabel('X').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2, row3, row4];
}

// prefetchAutoplay masih ada tapi hanya untuk kebutuhan internal DJ mode / autoplay normal
async function prefetchAutoplay(q, songUrl, guildId) {
  if (!q.autoplay || !songUrl) return;
  try {
    const usedIds = new Set([
      ...q.history,
      ...(q.upcomingAutoplay||[]).map(s=>s.url.split('v=')[1]?.split('&')[0]).filter(Boolean)
    ]);
    const recentTitles = (q.genreHistory||[]).join(' ');
    const genreHints = detectGenreKeywords(recentTitles);

    let lastUrl = songUrl;
    const suggestions = [];
    for (let i=0; i<3; i++) {
      const rel = await getRelatedSong(lastUrl, [...usedIds], q.artistHistory||[], genreHints, guildId);
      if (!rel) break;
      const id = rel.url.split('v=')[1]?.split('&')[0];
      if (id) usedIds.add(id);
      suggestions.push(rel);
      lastUrl = rel.url;
    }
    q.upcomingAutoplay = suggestions;
  } catch(e) { console.error('prefetchAutoplay:', e.message); }
}

function makeButtons(paused=false, loop='off', autoplay=true) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_shuffle') .setEmoji('🔀')             .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_prev')    .setEmoji('⏮️')             .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_pause')   .setEmoji(paused?'▶️':'⏸️') .setStyle(paused?ButtonStyle.Success:ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_skip')    .setEmoji('⏭️')             .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_autoplay').setEmoji('🔄')             .setStyle(autoplay?ButtonStyle.Success:ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_loop_off')  .setLabel('Off').setStyle(loop==='off'  ?ButtonStyle.Primary:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_loop_song') .setEmoji('🔂') .setStyle(loop==='song' ?ButtonStyle.Primary:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_loop_queue').setEmoji('🔁') .setStyle(loop==='queue'?ButtonStyle.Primary:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_voldown')   .setEmoji('🔉') .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_volup')     .setEmoji('🔊') .setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}
function disabledButtons() { return makeButtons().map(row=>{row.components.forEach(b=>b.setDisabled(true));return row;}); }

function getElapsed(q) {
  if (!q?.startTime) return 0;
  if (q.paused) return q.pausedElapsed || 0;
  return Math.floor((Date.now() - q.startTime) / 1000) + (q.pausedElapsed || 0);
}

// ─── PLAYER FACTORY ───────────────────────────────────────────────────────────
function createPlayer() {
  const p = createAudioPlayer();
  p.setMaxListeners(20);
  return p;
}

function startProgressUpdater(q, msg, song) {
  if (q.progressInterval) clearInterval(q.progressInterval);
  q.progressInterval = setInterval(async()=>{
    if (!q.songs[0]||q.songs[0].url!==song.url) { clearInterval(q.progressInterval); return; }
    if (q.paused) return;
    try {
      await msg.edit({embeds:[npEmbed(song,q,getElapsed(q))],components:makeButtons(q.paused,q.loop,q.autoplay)});
    } catch { clearInterval(q.progressInterval); }
  }, 5000);
}

// ─── PLAY ─────────────────────────────────────────────────────────────────────
async function play(guild, textChannel) {
  const q = queues.get(guild.id);
  if (!q||!q.songs.length) { updateStatus(null); updateChannelStatus(null); return; }
  const song = q.songs[0];
  if (!song?.url) { q.songs.shift(); return play(guild,textChannel); }
  try {
    let resource;
    q.startTime=Date.now(); q.paused=false; q.pausedElapsed=0;

    if (song.source === 'direct') {
      const res = await fetch(song.url);
      resource = createAudioResource(res.body, { inputType:'arbitrary', inlineVolume:true });
    } else if (song.source === 'soundcloud') {
      const scStream = await playdl.stream(song.url, { quality:2 });
      resource = createAudioResource(scStream.stream, { inputType:scStream.type, inlineVolume:true });
    } else {
      const proc = spawn('python',['-m','yt_dlp','-f','bestaudio/best','-o','-','--quiet',
        '--extractor-args','youtube:player_client=mweb','--cookies',path.join(__dirname,'cookies.txt'),song.url]);
      proc.stderr.on('data',d=>{ const m=d.toString(); if(!m.includes('Broken pipe')&&!m.includes('Invalid argument')) console.error('yt-dlp:',m.trim()); });
      q.currentProcess=proc;
      resource = createAudioResource(proc.stdout, { inputType:'arbitrary', inlineVolume:true });
    }
    resource.volume?.setVolume(((q.volume||100)/100)*2);
    q.resource=resource;
    q.player.removeAllListeners(AudioPlayerStatus.Idle);
    q.player.removeAllListeners(AudioPlayerStatus.Playing);
    q.player.removeAllListeners('error');
    q.player.once(AudioPlayerStatus.Playing, ()=>{ q.startTime=Date.now(); q.pausedElapsed=0; });
    q.player.play(resource);
    updateStatus(song.title); updateChannelStatus(song.title, q);
    const msg = await textChannel.send({embeds:[npEmbed(song,q,0)],components:makeButtons(false,q.loop,q.autoplay)});
    q.npMessage=msg;
    startProgressUpdater(q,msg,song);
    if (q.autoplay) prefetchAutoplay(q, song.url, guild.id);
    q.player.once(AudioPlayerStatus.Idle, async()=>{
      const lastUrl=q.songs[0]?.url||''; const lastId=lastUrl.split('v=')[1]?.split('&')[0];
      if (q.currentProcess) { q.currentProcess.kill('SIGTERM'); q.currentProcess=null; }
      if (q.progressInterval) { clearInterval(q.progressInterval); q.progressInterval=null; }
      if (lastId) { q.history.push(lastId); if(q.history.length>300) q.history.shift(); }
      const lastArtist = q.songs[0]?.artist;
      if (lastArtist) { q.artistHistory.push(lastArtist.toLowerCase()); if(q.artistHistory.length>50) q.artistHistory.shift(); }
      // Track judul ke genreHistory untuk genre-aware autoplay
      const lastTitle = q.songs[0]?.title||'';
      if (lastTitle) { q.genreHistory = q.genreHistory||[]; q.genreHistory.push(lastTitle); if(q.genreHistory.length>50) q.genreHistory.shift(); }
      const genreHints = detectGenreKeywords((q.genreHistory||[]).join(' '));
      try { await msg.edit({components:disabledButtons()}); } catch {}
      if (q.loop !== 'song') setTimeout(() => msg.delete().catch(()=>{}), 3000);

      if (q.loop==='song') return play(guild,textChannel);
      q.prevSong = q.songs[0] || null; // simpan sebelum shift
      if (q.loop==='queue') { q.songs.push(q.songs.shift()); } else { q.songs.shift(); }

      if (djMode.has(guild.id) && q.songs.length < 2) {
        if (q.upcomingAutoplay?.length) {
          q.songs.push(q.upcomingAutoplay.shift());
        } else if (lastUrl) {
          const rel = await getRelatedSong(lastUrl, q.history, q.artistHistory||[], genreHints, guild.id);
          if (rel) q.songs.push(rel);
        }
      }

      if (!q.songs.length && q.autoplay && lastUrl) {
        const next = q.upcomingAutoplay?.shift();
        if (next) {
          q.songs.push(next);
          textChannel.send({embeds:[notif(`🔄  **Autoplay →** [${next.title}](${next.url})  \`${next.duration}\``,C.muted)]});
        } else {
          const rel = await getRelatedSong(lastUrl, q.history, q.artistHistory||[], genreHints, guild.id);
          if (rel) {
            q.songs.push(rel);
            textChannel.send({embeds:[notif(`🔄  **Autoplay →** [${rel.title}](${rel.url})  \`${rel.duration}\``,C.muted)]});
          }
        }
      }

      if (!q.songs.length) {
        if (mode247.has(guild.id)) {
          textChannel.send({embeds:[notif('🌙  Queue habis, bot tetap standby di VC (24/7 mode aktif)',C.muted)]});
        }
        updateStatus(null); updateChannelStatus(null);
        return;
      }

      const next = q.songs[0];
      const s = getSettings(guild.id);
      if (next && s.announceNext && next.requester !== 'Autoplay') {
        const img = thumbMed(next.url);
        const e = new EmbedBuilder()
          .setColor(C.muted)
          .setDescription(`⏭  **Up next:** [${next.title}](${next.url})  \`${next.duration}\``)
          .setFooter(footer());
        if (img) e.setThumbnail(img);
        textChannel.send({embeds:[e]});
      }

      play(guild,textChannel);
    });
    q.player.on('error',err=>{ console.error('Player:',err.message); if(q.currentProcess){q.currentProcess.kill('SIGTERM');q.currentProcess=null;} if(q.progressInterval){clearInterval(q.progressInterval);q.progressInterval=null;} q.songs.shift(); play(guild,textChannel); });
  } catch(err) { console.error(err); q.songs.shift(); play(guild,textChannel); }
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
async function searchSong(input) {
  let url, title, duration;

  if (/^https?:\/\/.+\.(mp3|ogg|webm|wav|flac|aac|m4a)(\?.*)?$/i.test(input)) {
    const filename = input.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '').replace(/[-_]/g,' ');
    return { url: input, title: filename || 'Direct Audio', duration: 'N/A', source: 'direct' };
  }

  if (input.includes('soundcloud.com')) {
    try {
      const info = await playdl.soundcloud(input);
      return { url: info.url, title: info.name, duration: new Date(info.durationInMs).toISOString().substr(11,8).replace(/^00:/,''), source: 'soundcloud' };
    } catch { return null; }
  }

  if (input.includes('spotify.com') && input.includes('/track/')) {
    const qr = await getSpotifyTrack(input); if (!qr) return null;
    const r = await playdl.search(qr, { source:{ youtube:'video' }, limit:1 }); if (!r.length) return null;
    url = r[0].url; title = r[0].title; duration = r[0].durationRaw;
    return { url, title, duration: duration||'N/A', source:'youtube', artist: r[0].channel?.name?.replace(/\s*(VEVO|Official|Music|Topic)$/i,'').trim()||'' };
  }
  else if (input.includes('youtube.com') || input.includes('youtu.be')) {
    const r = await playdl.search(input, { source:{ youtube:'video' }, limit:1 });
    url = input; title = r[0]?.title||input; duration = r[0]?.durationRaw;
    return { url, title, duration: duration||'N/A', source:'youtube', artist: r[0]?.channel?.name?.replace(/\s*(VEVO|Official|Music|Topic)$/i,'').trim()||'' };
  }
  else {
    const r = await playdl.search(input, { source:{ youtube:'video' }, limit:1 }); if (!r.length) return null;
    url = r[0].url; title = r[0].title; duration = r[0].durationRaw;
    return { url, title, duration: duration||'N/A', source:'youtube', artist: r[0].channel?.name?.replace(/\s*(VEVO|Official|Music|Topic)$/i,'').trim()||'' };
  }
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
async function handleCommand(command, args, guild, channel, member, reply) {
  const q = queues.get(guild.id)||null;

  if (command==='play') {
    const vc=member?.voice.channel; if(!vc) return reply('❌  Join voice channel dulu!');
    const input=args.join(' '); if(!input) return reply('❌  Masukkan nama atau link lagu!');
    if (input.includes('spotify.com')&&input.includes('/playlist/')) {
      const maxPl = getSettings(guild.id).maxPlaylist;
      await reply(`🔍  Memuat playlist Spotify... (maks. **${maxPl} lagu**)`);
      try {
        const queries=await getSpotifyPlaylist(input, maxPl); if(!queries.length) return channel.send({embeds:[notif('❌  Playlist tidak ditemukan.',C.danger)]});
        let added=0;
        for (const qr of queries) {
          const r=await playdl.search(qr,{source:{youtube:'video'},limit:1}); if(!r.length) continue;
          const song={url:r[0].url,title:r[0].title,duration:r[0].durationRaw||'N/A',requester:member.user.username};
          if (!queues.has(guild.id)) {
            const player=createPlayer(); const conn=joinVoiceChannel({channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator});
            conn.on('error',err=>console.error('VoiceConnection error:',err.message));
            conn.subscribe(player); queues.set(guild.id,{connection:conn,player,songs:[song],volume:getSettings(guild.id).defaultVol,loop:getSettings(guild.id).loop,autoplay:getSettings(guild.id).autoplay,voteSkips:new Set(),paused:false,history:[],artistHistory:[],genreHistory:[],prevSong:null,upcomingAutoplay:[],progressInterval:null});
            play(guild,channel);
          } else { queues.get(guild.id).songs.push(song); }
          added++;
        }
        channel.send({embeds:[notif(`✅  **${added} lagu** dari playlist Spotify dimuat!`,C.success,'Spotify Playlist')]});
      } catch(err) { console.error(err); channel.send({embeds:[notif('❌  Gagal memuat playlist.',C.danger)]}); }
      return;
    }
    await reply('🔍  Mencari lagu...');
    try {
      const result=await searchSong(input); if(!result) return channel.send({embeds:[notif('❌  Lagu tidak ditemukan.',C.danger)]});
      const song={...result,requester:member.user.username};
      if (!queues.has(guild.id)) {
        const player=createPlayer(); const conn=joinVoiceChannel({channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator});
        conn.on('error',err=>console.error('VoiceConnection error:',err.message));
        conn.subscribe(player); queues.set(guild.id,{connection:conn,player,songs:[song],volume:getSettings(guild.id).defaultVol,loop:getSettings(guild.id).loop,autoplay:getSettings(guild.id).autoplay,voteSkips:new Set(),paused:false,history:[],artistHistory:[],genreHistory:[],prevSong:null,upcomingAutoplay:[],progressInterval:null});
        play(guild,channel);
      } else { q.songs.push(song); channel.send({embeds:[queuedEmbed(song,q.songs.length)]}); }
    } catch(err) { console.error(err); channel.send({embeds:[notif('❌  Gagal mencari lagu.',C.danger)]}); }
  }


  else if (command==='remove') {
    if(!q||q.songs.length<=1) return reply('❌  Tidak ada lagu di antrian.');
    const pos=parseInt(args[0]);
    if (isNaN(pos)||pos<1||pos>=q.songs.length) return reply(`❌  Posisi tidak valid. Queue punya \`${q.songs.length-1}\` lagu.`);
    const removed=q.songs.splice(pos,1)[0];
    channel.send({embeds:[notif(`🗑  **#${pos}. ${removed.title}** dihapus dari queue.`,C.warn,'Removed')]});
  }

  else if (command==='skip') {
    if(!q) return reply('❌  Tidak ada lagu yang diputar.');
    q.prevSong = q.songs[0]||null;
    const s=q.songs[0]?.title||'Unknown'; q.player.stop();
    channel.send({embeds:[notif(`⏭  Melewati **${s}**`,C.info,'Skipped')]});
  }

  else if (command==='stop') {
    if(!q) return reply('❌  Tidak ada lagu yang diputar.');
    if(q.progressInterval) clearInterval(q.progressInterval);
    q.songs=[]; q.currentProcess?.kill('SIGTERM'); q.player.stop(); q.connection.destroy();
    queues.delete(guild.id); updateStatus(null); updateChannelStatus(null);
    channel.send({embeds:[notif('⏹  Musik dihentikan dan queue dikosongkan.',C.danger,'Stopped')]});
  }

  else if (command==='pause') {
    if(!q) return reply('❌  Tidak ada lagu yang diputar.');
    q.pausedElapsed = getElapsed(q); q.player.pause(); q.paused=true;
    if(q.npMessage) q.npMessage.edit({embeds:[npEmbed(q.songs[0],q,q.pausedElapsed)],components:makeButtons(true,q.loop,q.autoplay)}).catch(()=>{});
    channel.send({embeds:[notif(`⏸  **${q.songs[0]?.title}** dijeda.`,C.warn,'Paused')]});
  }
  else if (command==='resume') {
    if(!q) return reply('❌  Tidak ada lagu.');
    q.startTime=Date.now(); q.player.unpause(); q.paused=false;
    if(q.npMessage) q.npMessage.edit({embeds:[npEmbed(q.songs[0],q,q.pausedElapsed||0)],components:makeButtons(false,q.loop,q.autoplay)}).catch(()=>{});
    channel.send({embeds:[notif(`▶  **${q.songs[0]?.title}** dilanjutkan.`,C.success,'Resumed')]});
  }
  else if (command==='queue') {
    if(!q||!q.songs.length) return reply('📋  Antrian kosong.');
    const embed=queueEmbed(q,1);
    const needsNav=q.songs.length>QUEUE_PER_PAGE+1;
    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('q_close').setLabel('✕').setStyle(ButtonStyle.Danger),
    );
    channel.send({embeds:[embed],components:needsNav?queueNavButtons(q,1):[closeRow]});
  }
  else if (command==='np') {
    if(!q||!q.songs[0]) return reply('❌  Tidak ada lagu yang diputar.');
    const elapsed=getElapsed(q);
    channel.send({embeds:[npEmbed(q.songs[0],q,elapsed)],components:makeButtons(q.paused,q.loop,q.autoplay)});
  }
  else if (command==='loop') {
    if(!q) return reply('❌  Tidak ada lagu yang diputar.');
    const mode=args[0]||(q.loop==='off'?'song':'off');
    if(!['off','song','queue'].includes(mode)) return reply('❌  Mode: off / song / queue');
    q.loop=mode;
    const elapsed=getElapsed(q);
    if(q.npMessage) q.npMessage.edit({embeds:[npEmbed(q.songs[0],q,elapsed)],components:makeButtons(q.paused,q.loop,q.autoplay)}).catch(()=>{});
    channel.send({embeds:[notif(`${{off:'➡️',song:'🔂',queue:'🔁'}[mode]}  Loop diset ke **${mode}**`,C.info,'Loop')]});
  }
  else if (command==='volume') {
    if(!q) return reply('❌  Tidak ada lagu yang diputar.');
    const vol=parseInt(args[0]); if(isNaN(vol)||vol<0||vol>100) return reply('❌  Volume harus 0–100!');
    q.volume=vol; q.resource?.volume?.setVolume((vol/100)*2);
    const elapsed=getElapsed(q);
    if(q.npMessage) q.npMessage.edit({embeds:[npEmbed(q.songs[0],q,elapsed)],components:makeButtons(q.paused,q.loop,q.autoplay)}).catch(()=>{});
    channel.send({embeds:[notif(`🔊  ${volBar(vol)}`,C.info,'Volume')]});
  }
  else if (command==='shuffle') {
    if(!q||q.songs.length<2) return reply('❌  Tidak cukup lagu.');
    const cur=q.songs.shift(); q.songs.sort(()=>Math.random()-0.5); q.songs.unshift(cur);
    channel.send({embeds:[notif(`🔀  **${q.songs.length-1} lagu** di-shuffle!`,C.info,'Shuffled')]});
  }
  else if (command==='voteskip') {
    if(!q) return reply('❌  Tidak ada lagu yang diputar.');
    const vc=member?.voice.channel; if(!vc) return reply('❌  Join voice channel dulu!');
    q.voteSkips.add(member.user.id);
    const needed=Math.ceil((vc.members.size-1)*0.5);
    if (q.voteSkips.size>=needed) { q.voteSkips.clear(); q.player.stop(); channel.send({embeds:[notif('✅  Vote skip berhasil!',C.success,'Vote Skip')]}); }
    else { const f=Math.round((q.voteSkips.size/needed)*10); channel.send({embeds:[notif(`🗳  \`${'█'.repeat(f)}${'░'.repeat(10-f)}\`  **${q.voteSkips.size}** / **${needed}** votes`,C.warn,'Vote Skip')]}); }
  }
  else if (command==='save') {
    if(!q||!q.songs.length) return reply('❌  Antrian kosong.');
    fs.writeFileSync(SAVED_QUEUE_FILE,JSON.stringify(q.songs));
    channel.send({embeds:[notif(`💾  Queue **${q.songs.length} lagu** berhasil disimpan!`,C.success,'Saved')]});
  }
  else if (command==='load') {
    if(!fs.existsSync(SAVED_QUEUE_FILE)) return reply('❌  Tidak ada queue tersimpan.');
    const vc=member?.voice.channel; if(!vc) return reply('❌  Join voice channel dulu!');
    const saved=JSON.parse(fs.readFileSync(SAVED_QUEUE_FILE));
    if (!queues.has(guild.id)) {
      const player=createPlayer(); const conn=joinVoiceChannel({channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator});
      conn.subscribe(player); queues.set(guild.id,{connection:conn,player,songs:saved,volume:getSettings(guild.id).defaultVol,loop:getSettings(guild.id).loop,autoplay:getSettings(guild.id).autoplay,voteSkips:new Set(),paused:false,history:[],artistHistory:[],genreHistory:[],prevSong:null,upcomingAutoplay:[],progressInterval:null});
      play(guild,channel);
    } else { q.songs.push(...saved); }
    channel.send({embeds:[notif(`📂  **${saved.length} lagu** berhasil dimuat!`,C.success,'Loaded')]});
  }
  else if (command==='lyrics') {
    const title=args.join(' ')||q?.songs[0]?.title; if(!title) return reply('❌  Masukkan judul lagu!');
    await reply('🔍  Mencari lirik...');
    try {
      const results=await geniusClient.songs.search(title); if(!results.length) return channel.send({embeds:[notif('❌  Lirik tidak ditemukan.',C.danger)]});
      const lyrics=await results[0].lyrics(); const trimmed=lyrics.slice(0,1900);
      channel.send({embeds:[new EmbedBuilder().setColor(C.np).setAuthor({name:`🎵  ${results[0].title}`,iconURL:BOT_ICON()}).setDescription(trimmed+(lyrics.length>1900?'\n\n*...terpotong*':'')).setFooter(footer()).setTimestamp()]});
    } catch { channel.send({embeds:[notif('❌  Gagal mengambil lirik.',C.danger)]}); }
  }
  else if (command==='bass') {
    if(!q) return reply('❌  Tidak ada lagu yang diputar.');
    const level=parseInt(args[0]); if(isNaN(level)||level<0||level>10) return reply('❌  Level 0–10!');
    const baseVol = (q.volume||100)/100;
    q.resource?.volume?.setVolume(baseVol*(1+level*0.3));
    channel.send({embeds:[notif(`🎸  \`${'█'.repeat(level)}${'░'.repeat(10-level)}\`  Bass Level **${level}**`,C.info,'Bassboost')]});
  }
  else if (command==='autoplay') {
    if(!q) return reply('❌  Tidak ada lagu yang diputar.');
    q.autoplay=!q.autoplay;
    const elapsed=getElapsed(q);
    if(q.npMessage) q.npMessage.edit({embeds:[npEmbed(q.songs[0],q,elapsed)],components:makeButtons(q.paused,q.loop,q.autoplay)}).catch(()=>{});
    channel.send({embeds:[notif(`🔄  Autoplay **${q.autoplay?'diaktifkan ✓':'dinonaktifkan'}**`,q.autoplay?C.success:C.danger,'Autoplay')]});
  }
  else if (command==='move') {
    if(!q||q.songs.length<=2) return reply('❌  Tidak cukup lagu untuk dipindahkan.');
    const from=parseInt(args[0]); const to=parseInt(args[1]);
    const max=q.songs.length-1;
    if (isNaN(from)||from<1||from>max) return reply(`❌  Posisi asal tidak valid. Queue punya \`${max}\` lagu.`);
    if (isNaN(to)||to<1||to>max)       return reply(`❌  Posisi tujuan tidak valid. Queue punya \`${max}\` lagu.`);
    if (from===to) return reply('❌  Posisi asal dan tujuan sama!');
    const [moved] = q.songs.splice(from, 1);
    q.songs.splice(to, 0, moved);
    channel.send({embeds:[notif(`↕  **${moved.title}**\nDipindahkan dari posisi \`#${from}\` ke \`#${to}\``,C.info,'Moved')]});
  }
  else if (command==='undo') {
    if(!q||q.songs.length<=1) return reply('❌  Tidak ada lagu yang bisa di-undo.');
    const removed=q.songs.pop();
    channel.send({embeds:[notif(`↩  **${removed.title}** dihapus dari queue.`,C.warn,'Undo')]});
  }
  else if (command==='247') {
    if (mode247.has(guild.id)) {
      mode247.delete(guild.id);
      channel.send({embeds:[notif('🌙  24/7 mode **dinonaktifkan** — bot akan keluar saat queue habis.',C.danger,'24/7 Mode')]});
    } else {
      mode247.add(guild.id);
      const vc=member?.voice.channel;
      if (vc && !queues.has(guild.id)) {
        const player=createPlayer(); const conn=joinVoiceChannel({channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator});
        conn.on('error',err=>console.error('VoiceConnection error:',err.message));
        conn.subscribe(player);
        queues.set(guild.id,{connection:conn,player,songs:[],volume:100,loop:'off',autoplay:true,voteSkips:new Set(),paused:false,history:[],artistHistory:[],genreHistory:[],prevSong:null,upcomingAutoplay:[],progressInterval:null,currentProcess:null});
      }
      channel.send({embeds:[notif('🌙  24/7 mode **diaktifkan** — bot akan stay di VC walau queue kosong.',C.success,'24/7 Mode')]});
    }
  }

  else if (command==='dj') {
    if (djMode.has(guild.id)) {
      djMode.delete(guild.id);
      channel.send({embeds:[notif('🎧  DJ mode **dinonaktifkan**.',C.danger,'DJ Mode')]});
    } else {
      djMode.add(guild.id);
      channel.send({embeds:[notif('🎧  DJ mode **diaktifkan** — bot akan otomatis queue lagu mirip selera kamu!',C.success,'DJ Mode')]});
    }
  }

  else if (command==='savepl') {
    if(!q||!q.songs.length) return reply('❌  Antrian kosong.');
    const name = args.join(' ').toLowerCase().trim();
    if (!name) return reply('❌  Masukkan nama playlist!');
    const pls = loadPlaylists();
    pls[name] = q.songs;
    savePlaylists(pls);
    channel.send({embeds:[notif(`💾  Playlist **"${name}"** disimpan dengan **${q.songs.length} lagu**!`,C.success,'Playlist Saved')]});
  }

  else if (command==='loadpl') {
    const name = args.join(' ').toLowerCase().trim();
    if (!name) return reply('❌  Masukkan nama playlist!');
    const pls = loadPlaylists();
    if (!pls[name]) return reply(`❌  Playlist **"${name}"** tidak ditemukan.`);
    const vc=member?.voice.channel; if(!vc) return reply('❌  Join voice channel dulu!');
    const saved = pls[name];
    if (!queues.has(guild.id)) {
      const player=createPlayer(); const conn=joinVoiceChannel({channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator});
      conn.on('error',err=>console.error('VoiceConnection error:',err.message));
      conn.subscribe(player);
      queues.set(guild.id,{connection:conn,player,songs:[...saved],volume:getSettings(guild.id).defaultVol,loop:getSettings(guild.id).loop,autoplay:getSettings(guild.id).autoplay,voteSkips:new Set(),paused:false,history:[],artistHistory:[],genreHistory:[],prevSong:null,upcomingAutoplay:[],progressInterval:null,currentProcess:null});
      play(guild,channel);
    } else { q.songs.push(...saved); }
    channel.send({embeds:[notif(`📂  Playlist **"${name}"** dimuat — **${saved.length} lagu**!`,C.success,'Playlist Loaded')]});
  }

  else if (command==='listpl') {
    const pls = loadPlaylists();
    const keys = Object.keys(pls);
    if (!keys.length) return reply('📋  Belum ada playlist tersimpan.');
    const lines = keys.map((k,i)=>`\`${i+1}.\`  **${k}**  — ${pls[k].length} lagu`).join('\n');
    channel.send({embeds:[new EmbedBuilder().setColor(C.queue).setAuthor({name:`💽  Playlists  ·  ${keys.length} playlist`,iconURL:BOT_ICON()}).setDescription(lines).setFooter(footer()).setTimestamp()]});
  }

  else if (command==='delpl') {
    const name = args.join(' ').toLowerCase().trim();
    if (!name) return reply('❌  Masukkan nama playlist!');
    const pls = loadPlaylists();
    if (!pls[name]) return reply(`❌  Playlist **"${name}"** tidak ditemukan.`);
    delete pls[name];
    savePlaylists(pls);
    channel.send({embeds:[notif(`🗑  Playlist **"${name}"** dihapus.`,C.warn,'Playlist Deleted')]});
  }

  else if (command==='clear') {
    if(!q||q.songs.length<=1) return reply('❌  Tidak ada lagu di antrian.');
    const count = q.songs.length - 1;
    q.songs.splice(1);
    channel.send({embeds:[notif(`🗑  **${count} lagu** dihapus dari queue.`,C.warn,'Queue Cleared')]});
  }

  else if (command==='settings') {
    channel.send({ embeds: [settingsEmbed(guild.id)], components: settingsButtons(guild.id) });
  }

  else if (command==='setgenre') {
    const genre = args[0] || 'off';
    const s = getSettings(guild.id);
    s.genreOnly = genre;
    saveSettings(guild.id);
    const label = GENRE_OPTIONS.find(g => g.value === genre)?.label || genre;
    channel.send({ embeds: [notif(`🎼  Genre filter diset ke **${label}**`, C.success, 'Genre Filter')] });
  }

  else if (command==='help') {
    channel.send({embeds:[helpEmbed()]});
  }
}

// ─── INTERACTION HANDLER ─────────────────────────────────────────────────────
client.on('interactionCreate', async interaction=>{
  // ── Autocomplete ──────────────────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'play') {
      const query = interaction.options.getFocused();
      if (!query || query.length < 2) return interaction.respond([]);
      try {
        const results = await playdl.search(query, { source:{ youtube:'video' }, limit:10 });
        await interaction.respond(
          results.map(r => ({
            name: `${r.title} — ${r.durationRaw||'N/A'}`.slice(0, 100),
            value: r.url,
          }))
        );
      } catch { await interaction.respond([]); }
    }
    return;
  }

  if (!interaction.isButton()&&!interaction.isChatInputCommand()&&!interaction.isModalSubmit()&&!interaction.isStringSelectMenu()) return;

  // ── Select Menu: genre filter ─────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'set_genre') {
    try { await interaction.deferUpdate(); } catch { return; }
    const s = getSettings(interaction.guild.id);
    s.genreOnly = interaction.values[0] || 'off';
    saveSettings(interaction.guild.id);
    await interaction.message.edit({ embeds: [settingsEmbed(interaction.guild.id)], components: settingsButtons(interaction.guild.id) });
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('set_')) {
    const guildId = interaction.guild.id;
    const s = getSettings(guildId);
    const q = queues.get(guildId);
    const id = interaction.customId;

    if (id === 'set_close') { await interaction.message.delete().catch(()=>{}); return; }

    if (id === 'set_pl_modal') {      const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId('modal_maxpl')
        .setTitle('Set Max Playlist')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('maxpl_input')
              .setLabel('Jumlah maksimal lagu (10-500)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Sekarang: ' + s.maxPlaylist)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    try { await interaction.deferUpdate(); } catch { return; }

    if      (id === 'set_247')      { s.mode247      = !s.mode247;      if(s.mode247) mode247.add(guildId); else mode247.delete(guildId); }
    else if (id === 'set_dj')       { s.djMode       = !s.djMode;       if(s.djMode)  djMode.add(guildId);  else djMode.delete(guildId); }
    else if (id === 'set_ap')       { s.autoplay     = !s.autoplay;     if(q) q.autoplay = s.autoplay; }
    else if (id === 'set_ann')      { s.announceNext = !s.announceNext; }
    else if (id === 'set_loop')     { const m=['off','song','queue']; s.loop = m[(m.indexOf(s.loop)+1)%m.length]; if(q) q.loop = s.loop; }
    else if (id === 'set_vol_down') { s.defaultVol = Math.max(0,   s.defaultVol - 10); if(q) { q.volume=s.defaultVol; q.resource?.volume?.setVolume((s.defaultVol/100)*2); } }
    else if (id === 'set_vol_up')   { s.defaultVol = Math.min(100, s.defaultVol + 10); if(q) { q.volume=s.defaultVol; q.resource?.volume?.setVolume((s.defaultVol/100)*2); } }
    else if (id === 'set_reset')    { guildSettings.set(guildId, { ...DEFAULT_SETTINGS }); }

    saveSettings(guildId);
    await interaction.message.edit({ embeds: [settingsEmbed(guildId)], components: settingsButtons(guildId) });
    return;
  }

  // ── Modal submit ──────────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_maxpl') {
    const val = parseInt(interaction.fields.getTextInputValue('maxpl_input'));
    if (isNaN(val) || val < 10 || val > 500) {
      return interaction.reply({ content: '❌  Masukkan angka antara 10–500!', flags: 64 });
    }
    const s = getSettings(interaction.guild.id);
    s.maxPlaylist = val;
    saveSettings(interaction.guild.id);
    try { await interaction.deferUpdate(); } catch {}
    await interaction.message.edit({ embeds: [settingsEmbed(interaction.guild.id)], components: settingsButtons(interaction.guild.id) }).catch(()=>{});
    return;
  }


  if (interaction.isButton()&&['q_first','q_prev','q_next','q_last','q_close'].includes(interaction.customId)) {
    const q = queues.get(interaction.guild.id);
    if (!q||!q.songs.length) return interaction.reply({content:'❌  Queue kosong.',flags:64});
    try { await interaction.deferUpdate(); } catch { return; }
    if (interaction.customId==='q_close') { await interaction.message.delete().catch(()=>{}); return; }
    const totalPages = Math.max(1,Math.ceil((q.songs.length-1)/QUEUE_PER_PAGE));
    const footerText = interaction.message.embeds[0]?.footer?.text||'';
    const match = footerText.match(/Page (\d+) of/);
    let page = match?parseInt(match[1]):1;
    if (interaction.customId==='q_first') page=1;
    else if (interaction.customId==='q_prev')  page=Math.max(1,page-1);
    else if (interaction.customId==='q_next')  page=Math.min(totalPages,page+1);
    else if (interaction.customId==='q_last')  page=totalPages;
    await interaction.message.edit({embeds:[queueEmbed(q,page)],components:queueNavButtons(q,page)});
    return;
  }

  if (interaction.isButton()) {
    const q = queues.get(interaction.guild.id);
    if (!q) return interaction.reply({content:'❌  Tidak ada lagu yang diputar.',flags:64}).catch(()=>{});
    try { await interaction.deferUpdate(); } catch { return; }
    const id = interaction.customId;
    const elapsed = q.startTime?Math.floor((Date.now()-q.startTime)/1000):0;
    const refresh = ()=>interaction.message.edit({embeds:[npEmbed(q.songs[0],q,elapsed)],components:makeButtons(q.paused,q.loop,q.autoplay)});
    if (id==='btn_pause') { if(q.paused){q.startTime=Date.now();q.player.unpause();q.paused=false;}else{q.pausedElapsed=getElapsed(q);q.player.pause();q.paused=true;} await refresh(); }
    else if (id==='btn_prev') {
      // Restart lagu sekarang dari awal
      if(q.currentProcess){q.currentProcess.kill('SIGTERM');q.currentProcess=null;}
      if(q.progressInterval){clearInterval(q.progressInterval);q.progressInterval=null;}
      q.pausedElapsed=0; q.paused=false;
      // Taruh lagu sekarang kembali di depan supaya play() memutarnya ulang
      const current = q.songs[0];
      if(!current) return;
      q.songs.unshift(current); // duplikat sementara, idle handler akan shift satu
      q.player.stop();
    }
    else if (id==='btn_skip') { q.prevSong = q.songs[0]||null; q.player.stop(); }
    else if (id==='btn_shuffle') {
      if(q.songs.length>=2){const c=q.songs.shift();q.songs.sort(()=>Math.random()-0.5);q.songs.unshift(c);}
      interaction.channel.send({embeds:[notif(`🔀  **${q.songs.length-1} lagu** di-shuffle!`,C.info,'Shuffled')]});
    }
    else if (id==='btn_autoplay') { q.autoplay=!q.autoplay; await refresh(); }
    else if (id==='btn_loop_off')   { q.loop='off';   await refresh(); }
    else if (id==='btn_loop_song')  { q.loop='song';  await refresh(); }
    else if (id==='btn_loop_queue') { q.loop='queue'; await refresh(); }
    else if (id==='btn_voldown') { q.volume=Math.max(0,q.volume-10); q.resource?.volume?.setVolume((q.volume/100)*2); await refresh(); }
    else if (id==='btn_volup')   { q.volume=Math.min(100,q.volume+10); q.resource?.volume?.setVolume((q.volume/100)*2); await refresh(); }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  try { await interaction.deferReply({ flags: 64 }); } catch { return; }
  const cmd=interaction.commandName;
  let args=[];
  if (cmd==='play')   args=[interaction.options.getString('lagu')];
  if (cmd==='loop')   args=[interaction.options.getString('mode')];
  if (cmd==='volume') args=[interaction.options.getInteger('level').toString()];
  if (cmd==='bass')   args=[interaction.options.getInteger('level').toString()];
  if (cmd==='lyrics') { const j=interaction.options.getString('judul'); if(j) args=[j]; }
  if (cmd==='remove') args=[interaction.options.getInteger('posisi').toString()];
  if (cmd==='move')   args=[interaction.options.getInteger('dari').toString(), interaction.options.getInteger('ke').toString()];
  if (cmd==='savepl') args=[interaction.options.getString('nama')];
  if (cmd==='loadpl') args=[interaction.options.getString('nama')];
  if (cmd==='delpl')  args=[interaction.options.getString('nama')];
  if (cmd==='setgenre') args=[interaction.options.getString('genre')];
  await handleCommand(cmd,args,interaction.guild,interaction.channel,interaction.member,t=>interaction.editReply(t));
});

// ─── PREFIX ───────────────────────────────────────────────────────────────────
client.on('messageCreate', async message=>{
  if (message.author.bot) return;
  const content=message.content.trim();
  if (!content.startsWith('m')) return;
  const map=[
    ['mp ','play',3],['mskip','skip',5],['mstop','stop',5],
    ['mpause','pause',6],['mresume','resume',7],['mq','queue',2],['mnp','np',3],
    ['mremove ','remove',8],['mmove ','move',6],['mloop','loop',5],['mvol','volume',4],['mshuffle','shuffle',8],
    ['mvskip','voteskip',6],['msave','save',5],['mload','load',5],['mlyrics','lyrics',7],
    ['mbass','bass',5],['mautoplay','autoplay',9],['mundo','undo',5],['mhelp','help',5],
    ['m247','247',4],['mdj','dj',3],
    ['msavepl ','savepl',8],['mloadpl ','loadpl',8],['mlistpl','listpl',7],['mdelpl ','delpl',7],
    ['msettings','settings',9],
    ['mclear','clear',6],
  ];
  let cmd=null,args=[];
  for (const [prefix,command,len] of map) {
    if (content.startsWith(prefix)||content===prefix.trim()) { cmd=command; args=content.slice(len).trim().split(/ +/).filter(Boolean); break; }
  }
  if (!cmd) return;
  await handleCommand(cmd,args,message.guild,message.channel,message.member,t=>message.reply(t));
});

// ─── READY ────────────────────────────────────────────────────────────────────
client.once('ready', async()=>{
  console.log(`✅  ${client.user.tag} online`);
  const rest=new REST({version:'10'}).setToken(process.env.TOKEN);
  try { await rest.put(Routes.applicationGuildCommands(client.user.id,GUILD_ID),{body:commands}); console.log('✅  Slash commands registered'); }
  catch(err) { console.error('Slash error:',err.message); }
  updateStatus(null); updateChannelStatus(null);
});

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  process.on('unhandledRejection', err => console.error('Unhandled rejection (ignored):', err?.message || err));
  process.on('uncaughtException',  err => console.error('Uncaught exception (ignored):',  err?.message || err));

  const cookies=JSON.parse(fs.readFileSync('./cookies.json','utf8'));
  await playdl.setToken({youtube:{cookie:cookies.map(c=>`${c.name}=${c.value}`).join('; ')}});
  await client.login(process.env.TOKEN);
}
main();
