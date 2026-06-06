require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { createServer } = require("http");
const { Server } = require("socket.io");

const { getSalesData } = require("./services/googleSheets");
const { setupSocket } = require("./socket/socketHandler");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

setupSocket(io);

let previousData = null;

cron.schedule("*/3 * * * * *", async () => {
  try {
    const latest = await getSalesData();

    if (JSON.stringify(latest) !== JSON.stringify(previousData)) {
      io.emit("score-update", latest);
      previousData = latest;
      console.log("Score Updated", latest);
    }
  } catch (err) {
    console.log(err);
  }
});

app.get("/api/score", async (req, res) => {
  try {
    const data = await getSalesData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sales data" });
  }
});

httpServer.listen(port, () => {
  console.log(`Server Started on ${port}`);
});
