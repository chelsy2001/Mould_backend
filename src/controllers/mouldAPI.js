const express = require("express");
const sqlConnection = require("../databases/ssmsConn");
const middlewares = require("../middlewares/middlewares.js");
const moment = require("moment");

const router = express.Router();

router.get("/details/:machine/:mould", (request, response) => {
  new sqlConnection.sql.Request().query(
    ` SELECT 
      MMM.EquipmentID,
      MMM.MouldID,
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
      MMM.ProductGroupID,
      MMM.ValidationStatus,
      PG.ProductGroupName
    FROM 
      Mould_MachineMatrix MMM
    JOIN 
      Mould_Monitoring MM ON MMM.MouldID = MM.MouldID
    JOIN 
      Config_MouldProductGroup PG ON MMM.ProductGroupID = PG.ProductGroupID
    WHERE 
      MMM.EquipmentID = '${request.params.machine}' AND
      MMM.MouldID = '${request.params.mould}'
    ORDER BY 
      MMM.MouldID;
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
    WHERE EquipmentID =  \'${request.body.EquipmentID}\' AND MouldID = \'${request.body.MouldID}\';
 
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

router.post("/updateValidationStatus", (req, res) => {
  const { EquipmentID, mouldID } = req.body;

  const updateAndInsertQuery = `
    BEGIN TRANSACTION;

    -- 1. Update the ValidationStatus
    UPDATE Mould_MachineMatrix
    SET ValidationStatus = 1,
        LastUpdatedTime = GETDATE(),
        LastUpdatedBy = 'system'
    WHERE EquipmentID = '${EquipmentID}' AND MouldID = '${mouldID}';

    -- 2. Insert into the Equipment Log
    INSERT INTO Mould_EquipmentLog (MouldID, EquipmentID, ValidationStatus, Timestamp)
    VALUES ('${mouldID}', '${EquipmentID}', 1, GETDATE());

    COMMIT;
  `;

  new sqlConnection.sql.Request().query(updateAndInsertQuery, (err, result) => {
    if (err) {
      console.error("Error updating and logging ValidationStatus:", err);
      return middlewares.standardResponse(res, null, 500, "Database error");
    } else {
      return middlewares.standardResponse(res, result.rowsAffected, 200, "ValidationStatus updated and log inserted successfully");
    }
  });
});


router.post("/updateValidationStatusFailed", async (req, res) => {
  const { EquipmentID, mouldID } = req.body;

  if (!EquipmentID && !mouldID) {
    return middlewares.standardResponse(res, null, 400, "EquipmentID or MouldID is required");
  }

  try {
    const request = new sqlConnection.sql.Request();
    request.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
    request.input("MouldID", sqlConnection.sql.VarChar, mouldID);

    // Step 1: Check if both IDs exist
    const checkQuery = `
      SELECT 
        (SELECT COUNT(*) FROM Mould_MachineMatrix WHERE EquipmentID = @EquipmentID) AS EquipmentExists,
        (SELECT COUNT(*) FROM Mould_MachineMatrix WHERE MouldID = @MouldID) AS MouldExists
    `;

    const checkResult = await request.query(checkQuery);
    const { EquipmentExists, MouldExists } = checkResult.recordset[0];

    // Step 2: If either is NOT found, then update
    if (EquipmentExists === 0 || MouldExists === 0) {
      const updateRequest = new sqlConnection.sql.Request();
      updateRequest.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
      updateRequest.input("MouldID", sqlConnection.sql.VarChar, mouldID);

      const updateQuery = `
        UPDATE Mould_MachineMatrix
        SET ValidationStatus = 0,
            LastUpdatedTime = GETDATE(),
            LastUpdatedBy = 'system'
        WHERE EquipmentID = @EquipmentID OR MouldID = @MouldID

      `;

      const updateResult = await updateRequest.query(updateQuery);
      return middlewares.standardResponse(
        res,
        updateResult.rowsAffected,
        200,
        "ValidationStatus updated because one or both IDs were not found"
      );
    } else {
      return middlewares.standardResponse(
        res,
        null,
        200,
        "No update performed. Both EquipmentID and MouldID exist."
      );
    }
  } catch (err) {
    console.error("Error during validation update check:", err);
    return middlewares.standardResponse(res, null, 500, "Server error");
  }
});


router.post("/load", (request, response) => {
  console.log(moment().format("yyyy-MM-DD"));
  new sqlConnection.sql.Request().query(
    `SELECT Count(1) AS temp FROM Mould_Monitoring where EquipmentID = \'${request.body.EquipmentID}\' and MouldID = \'${request.body.MouldID}\'`,
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
            WHERE EquipmentID = \'${request.body.EquipmentID}\' AND MouldID = \'${request.body.MouldID}\';

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
            `INSERT INTO Mould_Monitoring VALUES (\'${request.body.EquipmentID}\',\'${request.body.MouldID}\',${request.body.MouldActualLife},${request.body.HealthCheckThreshold},${request.body.NextPMDue},${request.body.PMWarning},NULL,NULL,${request.body.HealthCheckDue},${request.body.HealthCheckWarning},NULL,NULL,${request.body.MouldLifeStatus},${request.body.MouldPMStatus},${request.body.MouldHealthStatus},${request.body.MouldStatus},GETDATE());
            
            INSERT INTO Mould_EquipmentLog VALUES (\'${request.body.MouldID}\',\'${request.body.EquipmentID}\',${request.body.MouldStatus},GETDATE());

            INSERT INTO Mould_Genealogy VALUES (\'${request.body.MouldID}\',${request.body.CurrentMouldLife},${request.body.ParameterID},${request.body.ParameterValue},GETDATE());
            INSERT INTO Mould_EquipmentLog VALUES (\'${request.body.MouldID}\',${request.body.EquipmentID},${request.body.MouldStatus},GETDATE());
            
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
    MM.EquipmentID,
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
    EquipmentID,
    CurrentMouldLife,
    ParameterID,
    ParameterValue
  } = req.body;

  try {
    const sqlRequest = new sqlConnection.sql.Request();

    // Step 1: Check if an active breakdown exists
    const activeCheck = await sqlRequest
      .input('MouldID', sqlConnection.sql.NVarChar, MouldID)
      .query(`
        SELECT TOP 1 * 
        FROM Mould_BreakDownLog 
        WHERE MouldID = @MouldID AND BDEndTime IS NULL 
        ORDER BY BDStartTime DESC;
      `);

    const hasActiveBreakdown = activeCheck.recordset.length > 0;

    if (hasActiveBreakdown) {
      const updateRequest = new sqlConnection.sql.Request();

      // Step 2: Update the existing breakdown with end time and remarks
      await updateRequest
        .input('MouldID', sqlConnection.sql.NVarChar, MouldID)
        .input('BDEndTime', sqlConnection.sql.DateTimeOffset, BDEndTime)
        .input('BDDuration', sqlConnection.sql.Int, BDDuration)
        .input('BDStatus', sqlConnection.sql.Int, BDStatus)
        .input('BDRemark', sqlConnection.sql.NVarChar, BDRemark)
        .query(`
          SET ANSI_WARNINGS OFF;
          UPDATE Mould_BreakDownLog
          SET BDEndTime = @BDEndTime,
              BDDuration = @BDDuration,
              BDStatus = @BDStatus,
              BDRemark = @BDRemark,
              LastUpdatedTime = GETDATE()
          WHERE MouldID = @MouldID AND BDEndTime IS NULL;
        `);
      console.log("✅ Updated active Mould_BreakDownLog");
    } else {
      const insertRequest = new sqlConnection.sql.Request();

      // Step 3: Insert a new breakdown log
      await insertRequest
        .input('MouldID', sqlConnection.sql.NVarChar, MouldID)
        .input('BDStartTime', sqlConnection.sql.DateTimeOffset, BDStartTime)
        .input('BDEndTime', sqlConnection.sql.DateTimeOffset, BDEndTime)
        .input('BDDuration', sqlConnection.sql.Int, BDDuration)
        .input('TotalBDCount', sqlConnection.sql.Int, TotalBDCount)
        .input('UserID', sqlConnection.sql.NVarChar, UserID)
        .input('BDReason', sqlConnection.sql.NVarChar, BDReason)
        .input('BDRemark', sqlConnection.sql.NVarChar, BDRemark)
        .input('BDStatus', sqlConnection.sql.Int, BDStatus)
        .query(`
          SET ANSI_WARNINGS OFF;
          INSERT INTO Mould_BreakDownLog
          (MouldID, BDStartTime, BDEndTime, BDDuration, TotalBDCount, UserID, BDReason, BDRemark, BDStatus, LastUpdatedTime)
          VALUES (@MouldID, @BDStartTime, @BDEndTime, @BDDuration, @TotalBDCount, @UserID, @BDReason, @BDRemark, @BDStatus, GETDATE());
        `);
      console.log("✅ Inserted new Mould_BreakDownLog");
    }

    // Update Mould_Monitoring
    const monitoringRequest = new sqlConnection.sql.Request();
    await monitoringRequest
      .input('MouldStatus', sqlConnection.sql.Int, MouldStatus)
      .input('MouldLifeStatus', sqlConnection.sql.NVarChar, MouldLifeStatus)
      .input('EquipmentID', sqlConnection.sql.BigInt, EquipmentID)
      .input('MouldID', sqlConnection.sql.NVarChar, MouldID)
      .query(`
        SET ANSI_WARNINGS OFF;
        UPDATE Mould_Monitoring
        SET MouldStatus = @MouldStatus,
            MouldLifeStatus = @MouldLifeStatus,
            LastUpdatedTime = GETDATE()
        WHERE EquipmentID = @EquipmentID AND MouldID = @MouldID;
      `);
    console.log("✅ Updated Mould_Monitoring");

    // Insert into Mould_Genealogy
    const genealogyRequest = new sqlConnection.sql.Request();
    await genealogyRequest
      .input('MouldID', sqlConnection.sql.NVarChar, MouldID)
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
    const configRequest = new sqlConnection.sql.Request();
    await configRequest
      .input('MouldID', sqlConnection.sql.NVarChar, MouldID)
      .input('MouldStatus', sqlConnection.sql.Int, MouldStatus)
      .query(`
        SET ANSI_WARNINGS OFF;
        UPDATE CONFIG_MOULD
        SET MouldStatus = @MouldStatus, LastUpdatedTime = GETDATE()
        WHERE MouldID = @MouldID;
      `);
    console.log("✅ Updated CONFIG_MOULD");

    middlewares.standardResponse(res, null, 200, "success");
  } catch (err) {
    console.error("❌ Error executing query:", err);
    middlewares.standardResponse(res, null, 300, "Error executing query: " + err.message);
  }
});


router.get("/activebreakdown/:mouldId", async (req, res) => {
  const { mouldId } = req.params;

  try {
    const request = new sqlConnection.sql.Request();
    request.input("MouldID", sqlConnection.sql.VarChar, mouldId);

    const result = await request.query(`
      SELECT TOP 1 BDReason, BDRemark, BDStartTime 
      FROM [Mould_BreakDownLog] 
      WHERE MouldID = @MouldID AND BDEndTime IS NULL
      ORDER BY BDStartTime DESC
    `);

    if (result.recordset.length > 0) {
      res.status(200).json({ status: 200, data: result.recordset[0] });
    } else {
      res.status(404).json({ status: 404, message: "No active breakdown" });
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ status: 500, message: "Server error" });
  }
});



module.exports = router;
