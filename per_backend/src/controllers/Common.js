const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// Get all Plant
router.get("/Plants", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT PlantID, PlantName FROM PPMS_Solution.dbo.Config_Plant `,
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
      `SELECT ShopID, ShopName FROM PPMS_Solution.dbo.Config_Shop`,
      (err, result) => {
        if (err) {
          middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
        } else {
          middlewares.standardResponse(response, result.recordset, 200, "success");
        }
      }
    );
  });

// Get all lines
router.get("/Lines", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT LineID, LineName FROM PPMS_Solution.dbo.Config_Line`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});

module.exports = router;
