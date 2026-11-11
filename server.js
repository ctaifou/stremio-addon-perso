const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

const manifest = {
  id: "community.perso.onepiece",
  version: "1.2.1",
  name: "Catalogue Perso (IPTV)",
  description: "One Piece VF direct HTTP via Portal",
  resources: ["stream"],
  types: ["series"],
  idPrefixes: ["tt"]
};

// =========================================================================
// TABLES DE DÉCOUPAGE CORRIGÉES
// =========================================================================
const STREMIO_SEASONS = [
  8, 22, 17, 13, 9, 22, 39, 13, 52, 31, 
  99, 56, 100, 35, 62, 49, 118, 33, 98, 14, 
  194, 70, 25
];

const IPTV_SEASONS = [
  64, 16, 14, 39, 13, 52, 33, 35, 73, 45, 
  26, 14, 37, 57, 62, 50, 118, 36, 92, 14, 
  204, 7
];

function mapStremioToIptv(stremioSeason, stremioEpisode) {
  const sNum = parseInt(stremioSeason, 10);
  const epNum = parseInt(stremioEpisode, 10);

  // 1. Calcul de l'épisode global
  let absoluteNumber = 0;
  for (let i = 0; i < sNum - 1 && i < STREMIO_SEASONS.length; i++) {
    absoluteNumber += STREMIO_SEASONS[i];
  }
  absoluteNumber += epNum;

  // 2. Décomposition selon les blocs IPTV
  let remaining = absoluteNumber;
  let iptvSeason = 1;
  let iptvEpisode = 1;

  for (let i = 0; i < IPTV_SEASONS.length; i++) {
    if (remaining <= IPTV_SEASONS[i]) {
      iptvSeason = i + 1;
      iptvEpisode = remaining;
      break;
    }
    remaining -= IPTV_SEASONS[i];
  }

  return {
    season: iptvSeason,
    episode: iptvEpisode,
    absolute: absoluteNumber
  };
}

// =========================================================================
// CONFIGURATION DU PORTAIL STALKER
// =========================================================================
const PORTAL_URL = "http://nk.team-tx.st:80/portal.php";
const MAC_ADDR = "00:1A:79:00:3D:E8";
const TOKEN = "51D7CD0AF593647CBFBE42B532ED73AC";
const SERIES_ID = 6051;

const STB_HEADERS = {
  "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
  "X-User-Agent": "Model: MAG250; Link: WiFi",
  "Cookie": `mac=${encodeURIComponent(MAC_ADDR)}; stb_lang=en; timezone=Europe%2FParis;`,
  "Authorization": `Bearer ${TOKEN}`
};

// =========================================================================
// GÉNÉRATION DU LIEN DE STREAMING EN DIRECT
// =========================================================================
async function getLiveStreamUrl(iptvSeason, iptvEpisode) {
  try {
    const cmdPayload = JSON.stringify({
      series_id: SERIES_ID,
      season_num: iptvSeason,
      type: "series"
    });
    const cmdBase64 = Buffer.from(cmdPayload).toString("base64");

    const url = `${PORTAL_URL}?type=vod&action=create_link&cmd=${encodeURIComponent(cmdBase64)}&series=${iptvEpisode}&force_storage=0&disable_ad=0&download=0&force_ch_link_check=0&JsHttpRequest=1-xml`;

    const response = await fetch(url, { headers: STB_HEADERS });
    const data = await response.json();

    if (data && data.js && data.js.cmd) {
      return data.js.cmd.replace(/^ffmpeg\s+/, "");
    }
  } catch (err) {
    console.error("Erreur lors de la génération du lien :", err);
  }
  return null;
}

// =========================================================================
// ROUTES
// =========================================================================
app.get("/", (req, res) => res.redirect("/manifest.json"));
app.get("/manifest.json", (req, res) => res.json(manifest));

app.get("/stream/:type/:id.json", async (req, res) => {
  const { type, id } = req.params;

  if (id.startsWith("tt0388629:")) {
    const [, sSeason, sEpisode] = id.split(":");

    const mapped = mapStremioToIptv(sSeason, sEpisode);
    console.log(`Stremio S${sSeason}E${sEpisode} (Global #${mapped.absolute}) => IPTV S${mapped.season}E${mapped.episode}`);

    const directUrl = await getLiveStreamUrl(mapped.season, mapped.episode);

    if (directUrl) {
      return res.json({
        streams: [
          {
            name: "IPTV Direct VF",
            title: `One Piece - Épisode ${mapped.absolute} (VF)\nDirect HTTP`,
            url: directUrl,
            behaviorHints: {
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "User-Agent": "VLC/3.0.11.1 LibVLC/3.0.11.1"
                }
              }
            }
          }
        ]
      });
    }
  }

  res.json({ streams: [] });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
