const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

// Manifeste officiel de l'extension
const manifest = {
  id: "community.perso.torrents",
  version: "1.0.0",
  name: "Catalogue Perso",
  description: "Lecture directe des torrents sans debrid",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"]
};

// =========================================================================
// 1. LISTE DES PACKS ONE PIECE (ÉPISODES 1 À 700)
// =========================================================================
const PACKS_ONE_PIECE = [
  { start: 1,   end: 100, infoHash: "7F0FE0C9E39958D7D01ECA479717355EFE37DB4A" },
  { start: 101, end: 200, infoHash: "3960037D0F814CB07D6F687468277C465E7331A3" },
  { start: 201, end: 300, infoHash: "605E1890CF165635001A8193C1AC3D932F4457FD" },
  { start: 301, end: 400, infoHash: "EF5A82E95B9BCECE9EA5AE54788EBFD3688A0F44" },
  { start: 401, end: 500, infoHash: "E1BAEAB42BA30FCFD0095462757885046B892DE5" },
  { start: 501, end: 600, infoHash: "1905E121F050EC114861EBCE852BF875DC1F5C99" },
  { start: 601, end: 650, infoHash: "ADA74247D502AD771FF469DEF10A8AAA9B15B41B" },
  { start: 651, end: 700, infoHash: "C8DD221A1792F7DEA8417F12DB753E90C9E05B09" }
];

// =========================================================================
// 2. BIBLIOTHÈQUE POUR AJOUTS MANUELS (FILMS OU AUTRES SÉRIES)
// =========================================================================
const library = {
  movie: {
    // Exemple : "tt0137523": { infoHash: "...", fileIdx: 0, title: "Fight Club" }
  },
  series: {}
};

// =========================================================================
// 3. SYNCHRONISATION AUTOMATIQUE AVEC LE CATALOGUE OFFICIEL STREMIO
// =========================================================================
async function initOnePieceMapping() {
  try {
    console.log("Synchronisation des épisodes One Piece avec Stremio...");
    const res = await fetch("https://v3-cinemeta.strem.io/meta/series/tt0388629.json");
    const data = await res.json();
    const episodes = data.meta.videos;

    episodes.forEach((ep, index) => {
      const episodeNum = index + 1;
      if (episodeNum > 700) return;

      const pack = PACKS_ONE_PIECE.find(p => episodeNum >= p.start && episodeNum <= p.end);
      if (pack) {
        // fileIdx suit l'ordre des fichiers dans le torrent (commence à 0)
        const fileIdx = episodeNum - pack.start;

        library.series[ep.id] = {
          infoHash: pack.infoHash,
          fileIdx: fileIdx,
          title: `One Piece - Épisode ${episodeNum} (VF)`
        };
      }
    });

    console.log(`Mapping terminé : ${Object.keys(library.series).length} épisodes prêts.`);
  } catch (err) {
    console.error("Erreur lors de la récupération des épisodes :", err);
  }
}

// =========================================================================
// 4. ROUTES STREMIO
// =========================================================================
app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

app.get("/stream/:type/:id.json", (req, res) => {
  const { type, id } = req.params;
  const item = library[type]?.[id];

  if (!item) {
    return res.json({ streams: [] });
  }

  res.json({
    streams: [
      {
        name: "TPB VF",
        title: `${item.title}\nDirect P2P`,
        infoHash: item.infoHash,
        fileIdx: item.fileIdx
      }
    ]
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
