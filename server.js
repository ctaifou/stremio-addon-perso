const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

const manifest = {
  id: "community.perso.torrents",
  version: "1.0.5",
  name: "Catalogue Perso",
  description: "Lecture directe des torrents sans debrid",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"]
};

// =========================================================================
// TRACKERS & SOURCES
// =========================================================================
const TRACKER_YGG = "tracker:https://tracker.yggreborn.org/807e922cd4cb90f9809126e50420e71c/announce";

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

const library = {
  movie: {},
  series: {}
};

// =========================================================================
// 1. TEST TECHNIQUE : L'ARÈNE (S01E01 - tt38234547)
// =========================================================================
library.series["tt38234547:1:1"] = [
  {
    name: "Test Ygg (HTTPS)",
    title: "L'Arène S01E01 - 1080p VF\nTest Tracker HTTPS",
    infoHash: "b94e808aae11b13fe9adbd14fcf400feb89ccee0".toLowerCase(),
    fileIdx: 0,
    sources: [
      TRACKER_YGG,
      ...DEFAULT_TRACKERS
    ]
  },
  {
    name: "Test Ygg (HTTP)",
    title: "L'Arène S01E01 - 1080p VF\nTest Tracker HTTP",
    infoHash: "b94e808aae11b13fe9adbd14fcf400feb89ccee0".toLowerCase(),
    fileIdx: 0,
    sources: [
      "tracker:http://tracker.yggreborn.org/807e922cd4cb90f9809126e50420e71c/announce",
      ...DEFAULT_TRACKERS
    ]
  }
];

// =========================================================================
// 2. ONE PIECE (PACK YGG 1 À 1095)
// =========================================================================
const HASH_YGG_OP = "9d59b08cde8dfa97af361bfb13b2274885c18ac1".toLowerCase();

async function initOnePieceMapping() {
  try {
    console.log("Synchronisation One Piece...");
    const res = await fetch("https://v3-cinemeta.strem.io/meta/series/tt0388629.json");
    const data = await res.json();
    let episodes = data.meta.videos.filter(ep => ep.season > 0);

    episodes.sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.episode - b.episode;
    });

    episodes.forEach((ep, index) => {
      const episodeNum = index + 1;
      if (episodeNum <= 1095) {
        if (!library.series[ep.id]) {
          library.series[ep.id] = [];
        }
        library.series[ep.id].push({
          name: "Ygg 1080p VF",
          title: `One Piece - Épisode ${episodeNum} (1080p Multi/VF)\nDirect P2P`,
          infoHash: HASH_YGG_OP,
          fileIdx: episodeNum - 1,
          sources: [
            TRACKER_YGG,
            ...DEFAULT_TRACKERS
          ]
        });
      }
    });
    console.log("Mapping One Piece prêt.");
  } catch (err) {
    console.error("Erreur mapping One Piece :", err);
  }
}

// =========================================================================
// ROUTES
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

const PORT = process.env.PORT || 7000;
app.listen(PORT, async () => {
  await initOnePieceMapping();
  console.log(`Serveur actif sur le port ${PORT}`);
});
