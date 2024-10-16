const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// Define your routes here
router.get("/:mouldid", (request, response) => {
  // Execute a SELECT  query
  new sqlConnection.sql.Request().query(
    `SELECT 
    SP.SparePartID,
    SP.SparePartName,
    SP.LotSize,
    SP.SparePartLoc,
    SP.SpareWarningQuantity,
    SP.SpareAlarmQuantity,
    SPM.CurrentQuantity,
    SPM.SparePartStatus
FROM 
    Config_SparePart AS SP
JOIN 
    Mould_SparePartMonitoring AS SPM ON SP.SparePartID = SPM.SparePartID
WHERE 
    SP.MouldID = ${request.params.mouldid};`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query:", err);
      } else {
        middlewares.standardResponse(
          response,
          result.recordset,
          200,
          "success"
        );
        // response.send(result.recordset); // Send query result as response
        console.dir(result.recordset);
      }
    }
  );
});

router.post("/movement", (request, response) => {
  // Execute a SELECT  query
  new sqlConnection.sql.Request().query(
    `Update Mould_SparePartMonitoring set CurrentQuantity = CurrentQuantity -  ${request.body.Quantity} where SparePartID  = ${request.body.SparePartID}`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query:", err);
      } else {
        middlewares.standardResponse(
          response,
          result.recordset,
          200,
          "success"
        );
        // response.send(result.recordset); // Send query result as response
        console.dir(result.recordset);
      }
    }
  );
});

module.exports = router;
