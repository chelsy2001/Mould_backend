const express = require("express");
const rateLimit = require("express-rate-limit");
const middlewares = require("./src/middlewares/middlewares.js");
const loginRoute = require("./src/controllers/loginAPI.js");
const mouldRoute = require("./src/controllers/mouldAPI.js");
const pmRoute = require("./src/controllers/pmAPI.js");
const hcRoute = require("./src/controllers/hcAPI.js");
const sparePartRoute = require("./src/controllers/sparePartAPI.js");
const PMMouldMonitoring = require("./src/controllers/PMMouldMonitoring.js");
const HCMouldMonitoring = require("./src/controllers/HCMouldMonitoring.js");
const PMMouldPreparation = require("./src/controllers/PMMouldPreparation.js");
const PMMouldExecution = require("./src/controllers/PMMouldExecution.js");
const HCMouldExecution = require("./src/controllers/HCMouldExecution.js");

const limiter = rateLimit({
  //set up transaction rate limiter
  windowMs: 15 * 60 * 1000,
  max: 100,
});

const app = express();

app.use(limiter);
app.use(express.json());

app.use("/api/login", loginRoute);
app.use("/api/mould", mouldRoute);
app.use("/api/pm", pmRoute);
app.use("/api/hc", hcRoute);
app.use("/api/sparepart", sparePartRoute);
app.use("/api/PMMouldMonitoring",PMMouldMonitoring);
app.use("/api/HCMouldMonitoring",HCMouldMonitoring);
app.use("/api/PMMouldPreparation",PMMouldPreparation);
app.use("/api/PMMouldExecution",PMMouldExecution)
app.use("/api/HCMouldExecution",HCMouldExecution);

const PORT = process.env.PORT || 3000;

// Start the server on port 3000
app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
});

app.get("/api/status", (request, response) => {
  middlewares.standardResponse(response, null, 200, "running");
});
