const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// Get all Plant
router.get("/Plants", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT PlantID, PlantName FROM Config_Plant `,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});



// Get all shops
router.get("/Shops", (request, response) => {
    new sqlConnection.sql.Request().query(
      `SELECT ShopID, ShopName FROM Config_Shop`,
      (err, result) => {
        if (err) {
          middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
        } else {
          middlewares.standardResponse(response, result.recordset, 200, "success");
        }
      }
    );
  });


router.get("/Equipment", (request, response) => {
  const StationID = request.query.StationID;

  new sqlConnection.sql.Request().query(
    `SELECT EquipmentID, EquipmentName FROM Config_Equipment WHERE StationID = ${StationID}`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});

// Get all Zones 
router.get("/Zone", (request, response) => {
  const ShopID = request.query.ShopID;

  new sqlConnection.sql.Request().query(
    `SELECT ZoneID, ZoneName FROM [Config_Zone] WHERE ShopID = ${ShopID}`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});

// Get all Stations 
router.get("/Station", (request, response) => {
  const ZoneID = request.query.ZoneID;

  new sqlConnection.sql.Request().query(
    `SELECT StationID, StationName FROM Config_Station WHERE ZoneID = ${ZoneID}`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});

//for notification
router.get("/PMWarning", (request, response) => {
  new sqlConnection.sql.Request().query(
    ` SELECT 
    MouldID,
    PMStatus
FROM 
    [Config_Mould_PMSchedule]
WHERE 
    PMStatus = 2
`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});

// Reports 
router.get("/report", (req, res) => {
  try {
    const reportUrl = "http://localhost:8081";

    // Redirect to SSRS viewer in browser
    return res.redirect(reportUrl);
  } catch (err) {
    console.error("Redirection error:", err.message);
    middlewares.standardResponse(
      res,
      null,
      500,
      "Error redirecting to report: " + err.message
    );
  }
});


module.exports = router;
