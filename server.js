const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

// Manifeste officiel de l'extension
const manifest = {
  id: "community.perso.torrents",
  version: "1.0.3",
  name: "Catalogue Perso",
  description: "Lecture directe des torrents sans debrid",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"]
};

// =========================================================================
// 1. CONFIGURATION DU PACK YGG REBORN (ÉPISODES 1 À 1095)
// =========================================================================
// Remplacer impérativement par l'URL exacte du tracker trouvée dans le magnet (&tr=...)
// Exemple : "tracker:http://tracker.exemple.re:8080/announce"
const TRACKER_YGG = "tracker:https://tracker.yggreborn.org/807e922cd4cb90f9809126e50420e71c/announce";

const HASH_YGG = "9d59b08cde8dfa97af361bfb13b2274885c18ac1".toLowerCase();

// Trackers publics pour les flux alternatifs
const DEFAULT_TRACKERS = [
  "tracker:udp://tracker.opentrackr.org:1337/announce",
  "tracker:udp://open.demonii.com:1337/announce",
  "tracker:udp://open.stealth.si:80/announce",
  "tracker:udp://tracker.torrent.eu.org:451/announce",
  "tracker:http://nyaa.tracker.wf:7777/announce",
  "tracker:udp://explodie.org:6969/announce",
  "tracker:udp://tracker.coppersurfer.tk:6969/announce",
  "tracker:udp://open.tracker.cl:1337/announce"
];

// =========================================================================
// 2. PACKS SECONDAIRES EN SECOURS (TPB & NYAA)
// =========================================================================
const PACKS_SECOURS = [
  { start: 1,   end: 100, infoHash: "7F0FE0C9E39958D7D01ECA479717355EFE37DB4A", sourceName: "TPB VF" },
  { start: 101, end: 200, infoHash: "3960037D0F814CB07D6F687468277C465E7331A3", sourceName: "TPB VF" },
  { start: 201, end: 300, infoHash: "605E1890CF165635001A8193C1AC3D932F4457FD", sourceName: "TPB VF" },
  { start: 301, end: 400, infoHash: "EF5A82E95B9BCECE9EA5AE54788EBFD3688A0F44", sourceName: "TPB VF" },
  { start: 401, end: 500, infoHash: "E1BAEAB42BA30FCFD0095462757885046B892DE5", sourceName: "TPB VF" },
  { start: 501, end: 600, infoHash: "1905E121F050EC114861EBCE852BF875DC1F5C99", sourceName: "TPB VF" },
  { start: 601, end: 650, infoHash: "ADA74247D502AD771FF469DEF10A8AAA9B15B41B", sourceName: "TPB VF" },
  { start: 651, end: 700, infoHash: "C8DD221A1792F7DEA8417F12DB753E90C9E05B09", sourceName: "TPB VF" },
  { start: 93,  end: 130, infoHash: "cbdd80c1b2251e471a30408402afae7bdaf0c554", sourceName: "Nyaa VF" }
];

const library = {
  movie: {},
  series: {}
};

// =========================================================================
// 3. SYNCHRONISATION AUTOMATIQUE AVEC CINEMETA
// =========================================================================
async function initOnePieceMapping() {
  try {
    console.log("Synchronisation et tri des épisodes One Piece...");
    const res = await fetch("https://v3-cinemeta.strem.io/meta/series/tt0388629.json");
    const data = await res.json();
    let episodes = data.meta.videos;

    // Retrait des épisodes spéciaux (saison 0)
    episodes = episodes.filter(ep => ep.season > 0);

    // Tri chronologique strict par saison puis par épisode
    episodes.sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.episode - b.episode;
    });

    episodes.forEach((ep, index) => {
      const episodeNum = index + 1;

      if (!library.series[ep.id]) {
        library.series[ep.id] = [];
      }

      // Source principale : Ygg Reborn (1 à 1095)
      if (episodeNum <= 1095) {
        library.series[ep.id].push({
          name: "Ygg 1080p VF",
          title: `One Piece - Épisode ${episodeNum} (1080p Multi/VF)\nDirect P2P [Ygg Reborn]`,
          infoHash: HASH_YGG,
          fileIdx: episodeNum - 1, // Découpage propre : l'épisode 1 est à l'index 0
          sources: [
            TRACKER_YGG,
            ...DEFAULT_TRACKERS
          ]
        });
      }

      // Sources secondaires : TPB et Nyaa (secours)
      const matchingPacks = PACKS_SECOURS.filter(p => episodeNum >= p.start && episodeNum <= p.end);
      matchingPacks.forEach(pack => {
        const fileIdx = episodeNum - pack.start;
        library.series[ep.id].push({
          name: pack.sourceName,
          title: `One Piece - Épisode ${episodeNum} (VF)\nDirect P2P [${pack.sourceName}]`,
          infoHash: pack.infoHash.toLowerCase(),
          fileIdx: fileIdx,
          sources: DEFAULT_TRACKERS
        });
      });
    });

    console.log(`Mapping terminé : ${Object.keys(library.series).length} épisodes prêts avec multi-sources.`);
  } catch (err) {
    console.error("Erreur lors de la synchronisation :", err);
  }
}

// =========================================================================
// 4. ROUTES DU SERVEUR
// =========================================================================
app.get("/", (req, res) => {
  res.redirect("/manifest.json");
});

app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

app.get("/stream/:type/:id.json", (req, res) => {
  const { type, id } = req.params;
  const items = library[type]?.[id];

  if (!items || items.length === 0) {
    return res.json({ streams: [] });
  }

  res.json({
    streams: Array.isArray(items) ? items : [items]
  });
});

// =========================================================================
// 5. DÉMARRAGE DU SERVEUR
// =========================================================================
const PORT = process.env.PORT || 7000;
app.listen(PORT, async () => {
  await initOnePieceMapping();
  console.log(`Addon en ligne sur le port ${PORT}`);
});
