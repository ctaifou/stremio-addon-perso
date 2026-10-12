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
// ZONE DE CONFIGURATION : AJOUT DES FILMS ET SÉRIES
// =========================================================================
const library = {
  movie: {
    // FORMAT : "ID_IMDb_DU_FILM": { infoHash: "...", fileIdx: 0, title: "..." }
    "tt0137523": {
      infoHash: "b602167d648f07010a30b42c4dbd88bb7101869e",
      fileIdx: 0,
      title: "Fight Club (1999) 1080p VF"
    }
  },
  series: {
    // FORMAT : "ID_IMDb:SAISON:EPISODE": { infoHash: "...", fileIdx: 0, title: "..." }
    // One Piece Épisode 159 (Saison 4, Épisode 29 sur IMDb)
    "tt0388629:4:29": {
      infoHash: "40_CARACTERES_HEX_DU_TORRENT",
      fileIdx: 0,
      title: "One.Piece.159.French.mkv"
    }
  }
};
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
        name: "Torrent Perso",
        title: `${item.title}\nDirect P2P`,
        infoHash: item.infoHash,
        fileIdx: item.fileIdx
      }
    ]
  });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Addon en ligne sur le port ${PORT}`);
});
