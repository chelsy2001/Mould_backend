const express = require("express");
const sqlConnection = require("../databases/ssmsConn");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// Define your routes here
router.get("/details/:machine/:mould", (request, response) => {
  // Execute a SELECT query
  new sqlConnection.sql.Request().query(
    `SELECT 
    MM.MachineID,
    MM.MouldID,
    MM.MouldActualLife,
    MM.HealthCheckThreshold,
    MM.NextPMDue,
    MM.PMWarning,
    MM.HealthCheckDue,
    MM.HealthCheckWarning,
    MM.MouldHealthStatus,
    MM.MouldStatus,
    PE.PlanID,
    PE.ProuductGroupID,
    PE.PlanStatus
FROM 
    [dbo].[Mould_Monitoring] MM
JOIN 
    [dbo].[Prod_Execution] PE ON MM.MouldID = PE.MouldID
WHERE 
    MM.MachineID = '${request.params.machine}'
AND 
	MM.MouldID = '${request.params.mould}'
ORDER BY 
    MM.MouldID;
`,
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

router.get("/status", (request, response) => {
  // Execute a SELECT query
  new sqlConnection.sql.Request().query(
    `update Mould_Monitoring set MouldStatus = ${request.body.MouldStatus} where MachineID = ${request.body.MachineID} and MouldID = ${request.body.MouldID}`,
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
