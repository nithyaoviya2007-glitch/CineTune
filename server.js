import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import qs from "qs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// OMDB Route
app.get("/api/movie", async (req, res) => {
  const title = req.query.title;
  const omdbKey = process.env.OMDB_API_KEY;

  try {
    const response = await axios.get(`https://www.omdbapi.com/?t=${title}&apikey=${omdbKey}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Error fetching movie data" });
  }
});

// Spotify Token Fetch
app.get("/api/spotify-token", async (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      qs.stringify({ grant_type: "client_credentials" }),
      {
        headers: {
          Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Error getting Spotify token" });
  }
});



app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
