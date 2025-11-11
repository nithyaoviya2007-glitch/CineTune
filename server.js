import express from "express";
import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Needed for resolving paths in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static("public"));

// 🔑 Environment variables
const omdbKey = process.env.OMDB_API_KEY;
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

let spotifyToken = "";
let tokenExpiry = 0;

// 🎧 Get Spotify token
async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken;

  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    qs.stringify({ grant_type: "client_credentials" }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64"),
      },
    }
  );

  spotifyToken = res.data.access_token;
  tokenExpiry = Date.now() + res.data.expires_in * 1000;
  return spotifyToken;
}

// 🎬 Fetch movie details from OMDb
async function getMovieDetails(movieName) {
  const movieRes = await axios.get(
    `http://www.omdbapi.com/?t=${encodeURIComponent(movieName)}&apikey=${omdbKey}`
  );
  return movieRes.data.Response === "True" ? movieRes.data : null;
}

// 🎵 Get verified soundtrack albums from MusicBrainz
async function getSoundtrackFromMusicBrainz(movieName) {
  try {
    const res = await axios.get("https://musicbrainz.org/ws/2/release-group/", {
      params: { query: `${movieName} AND secondarytype:soundtrack`, fmt: "json" },
      headers: { "User-Agent": "CineTune/1.0 (nithyaoviya@example.com)" },
    });

    const releaseGroups = res.data["release-groups"];
    if (!releaseGroups || releaseGroups.length === 0) return null;

    const bestMatch = releaseGroups[0];
    return {
      title: bestMatch.title,
      id: bestMatch.id,
    };
  } catch (err) {
    console.error("MusicBrainz error:", err.message);
    return null;
  }
}

// 🎧 Fetch songs for soundtrack album from Spotify
async function getSpotifyTracksForAlbum(albumName) {
  try {
    const token = await getSpotifyToken();

    const searchRes = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(albumName)}&type=album&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const album = searchRes.data.albums.items[0];
    if (!album) return [];

    const tracksRes = await axios.get(
      `https://api.spotify.com/v1/albums/${album.id}/tracks`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return tracksRes.data.items.map((t) => ({
      title: t.name,
      preview_url: t.preview_url,
      spotify_url: t.external_urls.spotify,
      artists: t.artists.map((a) => a.name).join(", "),
      album: album.name,
    }));
  } catch (err) {
    console.error("Spotify track fetch error:", err.message);
    return [];
  }
}

// 🧩 Main API route
app.post("/query", async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: "No movie name provided" });

  try {
    const movie = await getMovieDetails(input);
    if (!movie) return res.json({ unknown: true });

    const soundtrack = await getSoundtrackFromMusicBrainz(movie.Title);
    if (!soundtrack) return res.json({ movie, songs: [] });

    const songs = await getSpotifyTracksForAlbum(soundtrack.title);

    res.json({ movie, soundtrack, songs });
  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// 🌐 Catch-all route for frontend (important for Render)
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
