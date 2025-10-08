const express = require("express");
const cors = require("cors");
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
const PMMouldApproval = require("./src/controllers/PMMouldApproval.js");
const HCMouldApproval = require("./src/controllers/HCMouldApproval.js");
const HCMouldExecution = require("./src/controllers/HCMouldExecution.js");
const SeperatePMApproval = require("./src/controllers/SeperatePMApproval.js");
const SeperateHCApproval = require("./src/controllers/SeperateHCApproval.js");

const downtimeRoute = require("./src/controllers/downTimeApi.js");
const reworkRoute = require("./src/controllers/reworkApi.js");
const OEE = require("./src/controllers/oee.js");
const Common=require("./src/controllers/Common.js");


const Image = require("./src/controllers/imageApi.js");

const limiter = rateLimit({
  //set up transaction rate limiter
  windowMs: 15 * 60 * 1000,
  max: 100,
});

const app = express();
app.use(cors({
  origin: true, // Allow all origins
  credentials: true, // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
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
app.use("/api/PMMouldApproval",PMMouldApproval);
app.use("/api/HCMouldApproval",HCMouldApproval);
app.use("/api/SeperatePMApproval",SeperatePMApproval);
app.use("/api/SeperateHCApproval",SeperateHCApproval);
app.use("/api/image",Image)

app.use("/api/downtime",downtimeRoute);
app.use("/api/rework",reworkRoute) 
app.use("/api/OEE",OEE);
app.use("/api/Common",Common);

const PORT = process.env.PORT || 4000;

// Start the server on port 3000
app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
});

app.get("/api/status", (request, response) => {
  middlewares.standardResponse(response, null, 200, "running");
});
