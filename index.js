const fastify = require("fastify")({ logger: true });
const axios = require("axios");
const postgres = require("@fastify/postgres");
const fastifyCors = require("@fastify/cors");

fastify.register(fastifyCors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
});

fastify.register(postgres, {
  connectionString: "postgres://postgres:Mashael1@localhost:5432/thamanya",
});

fastify.setErrorHandler((error, request, reply) => {
  console.error(error);
  reply.status(error.statusCode || 500).send({ error: error.message });
});

fastify.get("/search-itunes", async (request, reply) => {
  const { term, media, limit } = request.query;

  if (!term) {
    return reply.status(400).send({ error: "Search term is required." });
  }

  try {
    const itunesApiUrl = `https://itunes.apple.com/search?term=${term}&media=${
      media || "all"
    }`;
    const response = await axios.get(itunesApiUrl);

    const itunesData = response.data.results;

    const client = await fastify.pg.connect();

    try {
      for (const item of itunesData) {
        if (!item.trackId) {
          request.log.warn("Skipping track due to missing trackId:", item);
          continue;
        }
        await client.query(
          "INSERT INTO itunes_tracks(track_id, track_name, artist_name, collection_name, artwork_url, genre, json_data) VALUES($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (track_id) DO UPDATE SET track_name = $2, artist_name = $3, collection_name = $4, artwork_url = $5, genre = $6, json_data = $7",
          [
            item.trackId,
            item.trackName,
            item.artistName,
            item.collectionName,
            item.artworkUrl100,
            item.primaryGenreName,
            item,
          ]
        );
      }
      reply.send({
        message: "iTunes results saved to PostgreSQL",
        results: itunesData,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    fastify.log.error("iTunes Search API Error:", error);
    fastify.log.error(error);

    if (error.response) {
      reply.status(error.response.status).send({ error: error.response.data });
    } else {
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
