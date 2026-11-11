const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

const manifest = {
  id: "community.perso.torrents",
  version: "1.2.5",
  name: "Catalogue Perso (IPTV)",
  description: "One Piece VF direct HTTP via Portal",
  resources: ["stream"],
  types: ["series", "movie"],
  idPrefixes: ["tt"]
};

const PORTAL_URL = "http://nk.team-tx.st:80/portal.php";
const MAC_ADDR = "00:1A:79:00:3D:E8";
const SERIES_ID = 6051;
let currentToken = "51D7CD0AF593647CBFBE42B532ED73AC";

const STB_USER_AGENT = "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3";

function getHeaders(token) {
  return {
    "User-Agent": STB_USER_AGENT,
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    "Cookie": `mac=${encodeURIComponent(MAC_ADDR)}; stb_lang=en; timezone=Europe%2FParis;`,
    "Authorization": `Bearer ${token}`,
    "Accept": "*/*"
  };
}

// Handshake pour générer un nouveau token frais
async function doHandshake() {
  try {
    const handshakeUrl = `${PORTAL_URL}?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    console.log("[HANDSHAKE] Appel vers :", handshakeUrl);
    
    const res = await fetch(handshakeUrl, {
      headers: {
        "User-Agent": STB_USER_AGENT,
        "Cookie": `mac=${encodeURIComponent(MAC_ADDR)};`
      }
    });

    const status = res.status;
    const text = await res.text();
    console.log(`[HANDSHAKE HTTP ${status}] Réponse brute :`, text.slice(0, 300));

    if (text.startsWith("{")) {
      const data = JSON.parse(text);
      if (data?.js?.token) {
        currentToken = data.js.token;
        console.log("[HANDSHAKE SUCCÈS] Nouveau token :", currentToken);
        return currentToken;
      }
    }
  } catch (err) {
    console.error("[HANDSHAKE ERREUR]", err.message);
  }
  return null;
}

async function requestStream(seasonNum, episodeNum) {
  const cmdPayload = JSON.stringify({
    series_id: SERIES_ID,
    season_num: parseInt(seasonNum, 10),
    type: "series"
  });
  const cmdBase64 = Buffer.from(cmdPayload).toString("base64");
  const url = `${PORTAL_URL}?type=vod&action=create_link&cmd=${encodeURIComponent(cmdBase64)}&series=${episodeNum}&force_storage=0&disable_ad=0&download=0&force_ch_link_check=0&JsHttpRequest=1-xml`;

  console.log(`[CREATE_LINK] Demande S${seasonNum}E${episodeNum}`);
  let res = await fetch(url, { headers: getHeaders(currentToken) });
  let text = await res.text();
  console.log(`[CREATE_LINK HTTP ${res.status}] Réponse brute :`, text.slice(0, 300));

  // Si on reçoit du HTML ou une erreur, on fait un handshake puis on réessaie
  if (text.startsWith("<") || res.status === 401 || res.status === 403) {
    console.log("[REPONSE HTML OU ERREUR AUTH] Tentative de renouvellement du token...");
    const newToken = await doHandshake();
    if (newToken) {
      res = await fetch(url, { headers: getHeaders(newToken) });
      text = await res.text();
      console.log(`[RETRY CREATE_LINK HTTP ${res.status}] Réponse brute :`, text.slice(0, 300));
    }
  }

  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      if (data?.js?.cmd) {
        return data.js.cmd.replace(/^ffmpeg\s+/, "");
      }
    } catch (e) {
      console.error("[JSON PARSE ERROR]", e.message);
    }
  }

  return null;
}

// =========================================================================
// ROUTES
// =========================================================================
app.get("/", (req, res) => res.redirect("/manifest.json"));
app.get("/manifest.json", (req, res) => res.json(manifest));

// Route de test direct dans le navigateur
app.get("/debug", async (req, res) => {
  const videoUrl = await requestStream(1, 1);
  res.json({
    status: videoUrl ? "SUCCES" : "ECHEC",
    videoUrl: videoUrl || "Regarder les logs Render"
  });
});

app.get("/stream/:type/:id.json", async (req, res) => {
  const { type, id } = req.params;
  if (id.startsWith("tt0388629:")) {
    const [, s, e] = id.split(":");
    const videoUrl = await requestStream(s, e);
    if (videoUrl) {
      return res.json({
        streams: [{
          name: "IPTV Direct VF",
          title: `One Piece S${s}E${e} (VF)\nDirect HTTP`,
          url: videoUrl,
          behaviorHints: {
            notWebReady: true,
            proxyHeaders: { request: { "User-Agent": "VLC/3.0.11.1 LibVLC/3.0.11.1" } }
          }
        }]
      });
    }
  }
  res.json({ streams: [] });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
