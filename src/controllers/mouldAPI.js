const express = require("express");
const sqlConnection = require("../databases/ssmsConn");
const middlewares = require("../middlewares/middlewares.js");
const moment = require("moment");

const router = express.Router();

router.get("/details/:machine/:mould", (request, response) => {
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
    PE.ProductGroupID,
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
        console.dir(result.recordset);
      }
    }
  );
});

// INSERT INTO Mould_Genealogy VALUES (${request.body.MouldID},${request.body.CurrentMouldLife},${request.body.ParameterID},${request.body.ParameterValue},${Date.now}

router.post("/update", (request, response) => {
  console.log(moment().format("yyyy-MM-DD"));
  new sqlConnection.sql.Request().query(
    `UPDATE Mould_Monitoring SET MouldStatus = ${
      request.body.MouldStatus
    } WHERE MachineID = ${request.body.MachineID} AND MouldID = ${
      request.body.MouldID
    };
    INSERT INTO Mould_Genealogy VALUES (${request.body.MouldID},${
      request.body.CurrentMouldLife
    },${request.body.ParameterID},${
      request.body.ParameterValue
    },${moment().format("yyyy-MM-DD")})

    UPDATE  CONFIG_MOULD set MouldStatus = ${
      request.body.MouldStatus
    } where MouldID = ${request.body.MouldID}; 
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
        console.dir(result.recordset);
      }
    }
  );
});

router.post("/load", (request, response) => {
  console.log(moment().format("yyyy-MM-DD"));
  new sqlConnection.sql.Request().query(
    `SELECT Count(1) AS temp FROM [PPMS].[dbo].[Mould_Monitoring] where MachineID = ${request.body.MachineID} and MouldID = ${request.body.MouldID}`,
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
        if (parseInt(result.recordset[0].temp) > 0) {
          new sqlConnection.sql.Request().query(
            `UPDATE Mould_Monitoring SET MouldStatus = ${
              request.body.MouldStatus
            } WHERE MachineID = ${request.body.MachineID} AND MouldID = ${
              request.body.MouldID
            };

            INSERT INTO Mould_Genealogy VALUES (${request.body.MouldID},${
              request.body.CurrentMouldLife
            },${request.body.ParameterID},${
              request.body.ParameterValue
            },${moment().format("yyyy-MM-DD")});

            UPDATE  CONFIG_MOULD set MouldStatus = ${
              request.body.MouldStatus
            } where MouldID = ${request.body.MouldID};
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
                console.dir(result.recordset);
              }
            }
          );
        } else {
          new sqlConnection.sql.Request().query(
            `INSERT INTO [Mould_Monitoring] VALUES (${request.body.MachineID},${
              request.body.MouldID
            },${request.body.MouldActualLife},${
              request.body.HealthCheckThreshold
            },${request.body.NextPMDue},${request.body.PMWarning},${
              request.body.HealthCheckDue
            },${request.body.HealthCheckWarning},${
              request.body.MouldLifeStatus
            },${request.body.MouldPMStatus},${request.body.MouldHealthStatus},${
              request.body.MouldStatus
            },'${moment().format("yyyy-MM-DD")}');
            
            INSERT INTO Mould_MachineLog VALUES (${request.body.MouldID},${
              request.body.MachineID
            },${request.body.MouldStatus},${moment().format("yyyy-MM-DD")});

            INSERT INTO Mould_Genealogy VALUES (${request.body.MouldID},${
              request.body.CurrentMouldLife
            },${request.body.ParameterID},${
              request.body.ParameterValue
            },${moment().format("yyyy-MM-DD")});
            
            UPDATE CONFIG_MOULD set MouldStatus = ${
              request.body.MouldStatus
            } where MouldID = ${request.body.MouldID};`,
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
                console.dir(result.recordset);
              }
            }
          );
        }
      }
    }
  );
});

router.get("/ids", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT MouldID, MouldName, MouldDesc FROM Config_Mould`,
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
        console.dir(result.recordset);
      }
    }
  );
});

//Get Mould details
router.get("/details/:mouldid", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT 
    CM.MouldID,
    CM.MouldName,
    CM.MouldDesc,
    CM.MouldLife,
    CM.MouldHCThreshold,
    CM.MouldStorageLoc,
    CM.MouldStatus,
    MM.MachineID,
    MM.MouldActualLife,
    MM.HealthCheckThreshold,
    MM.NextPMDue,
    MM.PMWarning,
    MM.MouldLifeStatus,
    MM.MouldPMStatus,
    MM.MouldHealthStatus 
FROM 
    Config_Mould AS CM
JOIN 
    Mould_Monitoring AS MM 
ON 
    CM.MouldID = MM.MouldID
WHERE 
    CM.MouldID = ${request.params.mouldid};
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
        console.dir(result.recordset);
      }
    }
  );
});

module.exports = router;
