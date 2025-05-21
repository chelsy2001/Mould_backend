const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");
const moment = require("moment");

const router = express.Router();

router.get("/details/:EquipmentTypeID/:mould", (request, response) => {
  new sqlConnection.sql.Request().query(
    ` SELECT 
    MM.EquipmentTypeID,
    MM.MouldID,
    MM.MouldActualLife,
    MM.HealthCheckThreshold,
    MM.NextPMDue,
    MM.PMWarning,
    MM.HealthCheckDue,
    MM.HealthCheckWarning,
    MM.MouldHealthStatus,
    MM.MouldPMStatus,
    MM.MouldLifeStatus,
    MM.MouldStatus,
    PE.ProductGroupID,
    PG.ProductGroupName
FROM 
    [dbo].[Mould_Monitoring] MM
JOIN 
    [dbo].[Config_Mould] PE ON MM.MouldID = PE.MouldID
Join Config_MouldProductGroup PG ON PE.ProductGroupID = PG.ProductGroupID
Where
    MM.EquipmentTypeID = '${request.params.EquipmentTypeID}'
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

router.post("/update", (request, response) => {
  console.log(moment().format("yyyy-MM-DD"));
  new sqlConnection.sql.Request().query(
    `UPDATE Mould_Monitoring SET MouldStatus = ${request.body.MouldStatus}, MouldLifeStatus =\'${request.body.MouldLifeStatus}\',
    LastUpdatedTime = GETDATE()
    WHERE EquipmentTypeID=  \'${request.body.EquipmentTypeID}\' AND MouldID = \'${request.body.MouldID}\';
 
    INSERT INTO Mould_Genealogy VALUES (\'${request.body.MouldID}\',${request.body.CurrentMouldLife},${request.body.ParameterID},${request.body.ParameterValue},GETDATE());

    UPDATE CONFIG_MOULD set MouldStatus = ${request.body.MouldStatus},
    LastUpdatedTime = GETDATE()
    where MouldID = \'${request.body.MouldID}\'; 
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
    `SELECT Count(1) AS temp FROM [PPMS_Solution].[dbo].[Mould_Monitoring] where EquipmentTypeID = \'${request.body.EquipmentTypeID}\' and MouldID = \'${request.body.MouldID}\'`,
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
            `UPDATE Mould_Monitoring SET MouldStatus = ${request.body.MouldStatus}, LastUpdatedTime = GETDATE()
            WHERE EquipmentTypeID = \'${request.body.EquipmentTypeID}\' AND MouldID = \'${request.body.MouldID}\';

            INSERT INTO Mould_Genealogy VALUES (\'${request.body.MouldID}\',${request.body.CurrentMouldLife},${request.body.ParameterID},${request.body.ParameterValue},GETDATE());

            UPDATE CONFIG_MOULD set MouldStatus = ${request.body.MouldStatus}, LastUpdatedTime = GETDATE() where MouldID = \'${request.body.MouldID}\';
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
            `INSERT INTO [Mould_Monitoring] VALUES (\'${request.body.EquipmentTypeID}\',\'${request.body.MouldID}\',${request.body.MouldActualLife},${request.body.HealthCheckThreshold},${request.body.NextPMDue},${request.body.PMWarning},NULL,NULL,${request.body.HealthCheckDue},${request.body.HealthCheckWarning},NULL,NULL,${request.body.MouldLifeStatus},${request.body.MouldPMStatus},${request.body.MouldHealthStatus},${request.body.MouldStatus},GETDATE());
            
            INSERT INTO Mould_MachineLog VALUES (\'${request.body.MouldID}\',\'${request.body.EquipmentTypeID}\',${request.body.MouldStatus},GETDATE());

            INSERT INTO Mould_Genealogy VALUES (\'${request.body.MouldID}\',${request.body.CurrentMouldLife},${request.body.ParameterID},${request.body.ParameterValue},GETDATE());
            
            UPDATE CONFIG_MOULD set MouldStatus = ${request.body.MouldStatus}, LastUpdatedTime = GETDATE() where MouldID = \'${request.body.MouldID}\';`,
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
    MM.MouldStatus,
    MM.EquipmentTypeID,
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
    CM.MouldID = \'${request.params.mouldid}\';
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

router.post("/users", (request, response) => {
  new sqlConnection.sql.Request().query(
    "Select * from Config_Users",
    (err, result) => {
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query: " + err);
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


router.post("/addbreakdownlog", async (req, res) => {
  const {
    MouldID,
    BDStartTime,
    BDEndTime,
    BDDuration,
    TotalBDCount,
    UserID,
    BDReason,
    BDRemark,
    BDStatus,
    MouldStatus,
    MouldLifeStatus,
    EquipmentTypeID,
    CurrentMouldLife,
    ParameterID,
    ParameterValue,
    LastUpdatedTime
  } = req.body;

  // Validate required fields
  // if (
  //   !MouldID || !BDStartTime || !BDEndTime === null ||
  //   BDDuration === undefined || TotalBDCount === undefined ||
  //   !UserID || !BDReason || !BDRemark ||
  //   BDStatus === undefined || MouldStatus === undefined ||
  //   !MouldLifeStatus || EquipmentTypeID === undefined ||
  //   CurrentMouldLife === undefined || ParameterID === undefined || ParameterValue === undefined
  // ) {
  //   return ;
  // }
  

  console.log("Request body:", req.body);
  
  try {
    const sqlRequest = new sqlConnection.sql.Request();

    // Insert into Mould_BreakDownLog
    await sqlRequest
      .input('MouldID', sqlConnection.sql.NVarChar, MouldID)
      .input('BDStartTime', sqlConnection.sql.DateTimeOffset, BDStartTime)
      .input('BDEndTime', sqlConnection.sql.DateTimeOffset, BDEndTime)
      .input('BDDuration', sqlConnection.sql.Int, BDDuration)
      .input('TotalBDCount', sqlConnection.sql.Int, TotalBDCount)
      .input('UserID', sqlConnection.sql.NVarChar, UserID)
      .input('BDReason', sqlConnection.sql.NVarChar, BDReason)
      .input('BDRemark', sqlConnection.sql.NVarChar, BDRemark)
      .input('BDStatus', sqlConnection.sql.Int, BDStatus)
      .input('LastUpdatedTime', sqlConnection.sql.DateTime, LastUpdatedTime)

      .query(`
        SET ANSI_WARNINGS OFF;
        INSERT INTO Mould_BreakDownLog
        (MouldID, BDStartTime, BDEndTime, BDDuration, TotalBDCount, UserID, BDReason, BDRemark, BDStatus, LastUpdatedTime)
        VALUES (@MouldID, @BDStartTime, @BDEndTime, @BDDuration, @TotalBDCount, @UserID, @BDReason, @BDRemark, @BDStatus, GETDATE());
      `);
    console.log("✅ Inserted into Mould_BreakDownLog");

    // Update Mould_Monitoring
    await sqlRequest
      .input('MouldStatus', sqlConnection.sql.Int, MouldStatus)
      .input('MouldLifeStatus', sqlConnection.sql.NVarChar, MouldLifeStatus)
      .input('EquipmentTypeID', sqlConnection.sql.BigInt, EquipmentTypeID)
      .query(`
        SET ANSI_WARNINGS OFF;
        UPDATE Mould_Monitoring
SET MouldStatus = @MouldStatus,
    MouldLifeStatus = @MouldLifeStatus,
    LastUpdatedTime = GETDATE()
WHERE EquipmentTypeID = @EquipmentTypeID AND MouldID = @MouldID;
      `);
    console.log("✅ Updated Mould_Monitoring");

    // Insert into Mould_Genealogy
    await sqlRequest
      .input('CurrentMouldLife', sqlConnection.sql.Int, CurrentMouldLife)
      .input('ParameterID', sqlConnection.sql.Int, ParameterID)
      .input('ParameterValue', sqlConnection.sql.Int, ParameterValue)
      .query(`
        SET ANSI_WARNINGS OFF;
        INSERT INTO Mould_Genealogy
        (MouldID, CurrentMouldLife, ParameterID, ParameterValue, Timestamp)
        VALUES (@MouldID, @CurrentMouldLife, @ParameterID, @ParameterValue, GETDATE());
      `);
    console.log("✅ Inserted into Mould_Genealogy");

    // Update CONFIG_MOULD
    await sqlRequest.query(`
      SET ANSI_WARNINGS OFF;
      UPDATE CONFIG_MOULD
      SET MouldStatus = @MouldStatus, LastUpdatedTime = GETDATE()
      WHERE MouldID = @MouldID;
    `);
    console.log("✅ Updated CONFIG_MOULD");

    // Respond success
    middlewares.standardResponse(res, null, 200, "success");
  } catch (err) {
    console.error("❌ Error executing query:", err);
    middlewares.standardResponse(res, null, 300, "Error executing query: " + err.message);
  }
});


module.exports = router;
