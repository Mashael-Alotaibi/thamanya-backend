// index.js
const fastify = require("fastify")({ logger: true });
const axios = require("axios");
const postgres = require("@fastify/postgres");
const fastifyCors = require("@fastify/cors");

fastify.register(fastifyCors, {
  origin: "*", // You can set this to '*' to allow all origins
  // For production, it's better to specify the exact origin:
  // origin: 'http://localhost:3000',
  methods: ["GET", "POST", "PUT", "DELETE"],
});
// Register the PostgreSQL plugin
fastify.register(postgres, {
  connectionString: "postgres://postgres:Mashael1@localhost:5432/thamanya", // Replace with your connection string
});

// Error handling (optional, but recommended)
fastify.setErrorHandler((error, request, reply) => {
  console.error(error);
  reply.status(error.statusCode || 500).send({ error: error.message });
});

fastify.get("/search-itunes", async (request, reply) => {
  const { term, media, limit } = request.query; // Get search parameters from query string

  if (!term) {
    return reply.status(400).send({ error: "Search term is required." });
  }

  try {
    const itunesApiUrl = `https://itunes.apple.com/search?term=${term}&media=${
      media || "all"
    }`;
    // const itunesApiUrl = `https://itunes.apple.com/search?term=${term}&entity=${entity || 'all'}&limit=${limit || 25}`;
    const response = await axios.get(itunesApiUrl);

    const itunesData = response.data.results;

    // Acquire a client from the pool
    const client = await fastify.pg.connect(); //

    // return reply.send(response.data);
    try {
      for (const item of itunesData) {
        // Example: Saving track data
        // You would need a table like 'tracks' with columns for trackId, trackName, artistName, etc.

        // Check if the trackId is missing, as it's a primary key
        if (!item.trackId) {
          request.log.warn("Skipping track due to missing trackId:", item);
          continue; // Skip this track and continue with the next one
        }
        await client.query(
          "INSERT INTO itunes_tracks(track_id, track_name, artist_name, collection_name, artwork_url, genre, json_data) VALUES($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (track_id) DO UPDATE SET track_name = $2, artist_name = $3, collection_name = $4, artwork_url = $5, genre = $6, json_data = $7",
          [
            item.trackId,
            item.trackName,
            item.artistName,
            item.collectionName,
            item.artworkUrl100, // or artworkUrl60, etc.
            item.primaryGenreName,
            item, // Store the full JSON in a JSONB column
          ]
        );
      }
      reply.send({
        message: "iTunes results saved to PostgreSQL",
        results: itunesData,
      });
    } finally {
      client.release(); // Release the client back to the pool
    }
  } catch (error) {
    fastify.log.error("iTunes Search API Error:", error);
    fastify.log.error(error);

    if (error.response) {
      // If it's an Axios error with a response
      reply.status(error.response.status).send({ error: error.response.data });
    } else {
      // Other errors
      reply
        .status(500)
        .send({ error: "Failed to fetch iTunes search results" });
    }
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 4000, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error("err");
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
