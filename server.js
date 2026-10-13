const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

const manifest = {
  id: "community.perso.torrents",
  version: "1.0.2",
  name: "Catalogue Perso",
  description: "Lecture directe des torrents sans debrid",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"]
};

// Liste des trackers BitTorrent publics
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

const PACKS_ONE_PIECE = [
  { start: 1,   end: 100, infoHash: "7F0FE0C9E39958D7D01ECA479717355EFE37DB4A", sourceName: "TPB VF" },
  { start: 101, end: 200, infoHash: "3960037D0F814CB07D6F687468277C465E7331A3", sourceName: "TPB VF" },
  { start: 201, end: 300, infoHash: "605E1890CF165635001A8193C1AC3D932F4457FD", sourceName: "TPB VF" },
  { start: 301, end: 400, infoHash: "EF5A82E95B9BCECE9EA5AE54788EBFD3688A0F44", sourceName: "TPB VF" },
  { start: 401, end: 500, infoHash: "E1BAEAB42BA30FCFD0095462757885046B892DE5", sourceName: "TPB VF" },
  { start: 501, end: 600, infoHash: "1905E121F050EC114861EBCE852BF875DC1F5C99", sourceName: "TPB VF" },
  { start: 601, end: 650, infoHash: "ADA74247D502AD771FF469DEF10A8AAA9B15B41B", sourceName: "TPB VF" },
  { start: 651, end: 700, infoHash: "C8DD221A1792F7DEA8417F12DB753E90C9E05B09", sourceName: "TPB VF" },

  // Pack Nyaa (épisodes 93 à 130)
  { start: 93,  end: 130, infoHash: "cbdd80c1b2251e471a30408402afae7bdaf0c554", sourceName: "Nyaa VF" }
];

const library = {
  movie: {},
  series: {}
};

async function initOnePieceMapping() {
  try {
    console.log("Synchronisation et tri des épisodes...");
    const res = await fetch("https://v3-cinemeta.strem.io/meta/series/tt0388629.json");
    const data = await res.json();
    let episodes = data.meta.videos;

    // 1. Élimination des épisodes hors-série
    episodes = episodes.filter(ep => ep.season > 0);

    // 2. Tri chronologique rigoureux
    episodes.sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.episode - b.episode;
    });

    // 3. Attribution des flux (supporte plusieurs packs par épisode)
    episodes.forEach((ep, index) => {
      const episodeNum = index + 1;
      if (episodeNum > 700) return;

      const matchingPacks = PACKS_ONE_PIECE.filter(p => episodeNum >= p.start && episodeNum <= p.end);

      matchingPacks.forEach(pack => {
        const fileIdx = episodeNum - pack.start;

        if (!library.series[ep.id]) {
          library.series[ep.id] = [];
        }

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

app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

app.get("/stream/:type/:id.json", (req, res) => {
  const { type, id } = req.params;
  const items = library[type]?.[id];

  if (!items || items.length === 0) {
    return res.json({ streams: [] });
  }

  // Renvoie un tableau contenant tous les flux disponibles pour cet épisode
  res.json({
    streams: Array.isArray(items) ? items : [items]
  });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, async () => {
  await initOnePieceMapping();
  console.log(`Addon en ligne sur le port ${PORT}`);
});
