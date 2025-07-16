const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// Get all Plant
router.get("/Plants", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT PlantID, PlantName FROM PPMS.dbo.Config_Plant `,
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
      `SELECT ShopID, ShopName FROM PPMS.dbo.Config_Shop`,
      (err, result) => {
        if (err) {
          middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
        } else {
          middlewares.standardResponse(response, result.recordset, 200, "success");
        }
      }
    );
  });


router.get("/Lines", (request, response) => {
  const shopId = request.query.shopId;

  new sqlConnection.sql.Request().query(
    `SELECT LineID, LineName FROM PPMS.dbo.Config_Line WHERE ShopID = ${shopId}`,
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
    [PPMS].[dbo].[Config_Mould_PMSchedule]
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


module.exports = router;
