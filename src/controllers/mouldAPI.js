const express = require("express");
const sqlConnection = require("../databases/ssmsConn");
const middlewares = require("../middlewares/middlewares.js");
const moment = require("moment");
const axios = require("axios");
const base64 = require("base-64");

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

const { execFile } = require("child_process");


router.post("/updateValidationStatusLoad", async (req, res) => {
  const { EquipmentID, mouldID } = req.body;

  if (!EquipmentID || !mouldID) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields");
  }

  try {
    const request = new sqlConnection.sql.Request();

    // 1️⃣ Get StationID from Config_Equipment
    request.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
    const equipmentResult = await request.query(`
      SELECT TOP 1 StationID FROM Config_Equipment WHERE EquipmentID = @EquipmentID
    `);

    if (!equipmentResult.recordset.length) {
      return middlewares.standardResponse(res, null, 404, `EquipmentID not found in DB: ${EquipmentID}`);
    }

    const StationID = equipmentResult.recordset[0].StationID;

    // 2️⃣ Get ProdDate & ProdShift from Prod_ShiftInformation
    const prodShiftResult = await new sqlConnection.sql.Request()
      .input("StationID", sqlConnection.sql.Int, StationID)
      .query(`
        SELECT TOP 1 ProdDate, ShiftName
        FROM Prod_ShiftInformation
        WHERE StationID = @StationID
        ORDER BY ProdDate DESC
      `);

    const ProdDate = prodShiftResult.recordset[0]?.ProdDate || null;
    const ProdShift = prodShiftResult.recordset[0]?.ShiftName || null;

    // 3️⃣ Get AtMouldLife from Mould_Monitoring
    const mouldLifeResult = await new sqlConnection.sql.Request()
      .input("MouldID", sqlConnection.sql.NVarChar, mouldID)
      .input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID)
      .query(`
        SELECT TOP 1 MouldActualLife
        FROM Mould_Monitoring
        WHERE MouldID = @MouldID AND EquipmentID = @EquipmentID
        ORDER BY UID DESC
      `);

    const AtMouldLife = mouldLifeResult.recordset[0]?.MouldActualLife || 0;

    // 4️⃣ Map StationID → Machine Tag
    const stationTagMap = {
      "1": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-1/ValidationStatus",
      "2": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-2/ValidationStatus",
      "3": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-3/ValidationStatus",
      "4": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-4/ValidationStatus",
      "5": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-5/ValidationStatus",
      "6": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-6/ValidationStatus",
      "7": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-7/ValidationStatus",
      "8": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-8/ValidationStatus",
      "9": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-9/ValidationStatus",
      "10": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-10/ValidationStatus",
    };

    const machineTag = stationTagMap[StationID];
    if (!machineTag) {
      return middlewares.standardResponse(res, null, 400, `No tag found for StationID: ${StationID}`);
    }

    // 5️⃣ Update Mould_MachineMatrix & Insert into Mould_EquipmentLog
    const updateAndInsertQuery = `
      BEGIN TRANSACTION;
        UPDATE Mould_MachineMatrix
        SET ValidationStatus = 1,
            LastUpdatedTime = GETDATE(),
            LastUpdatedBy = 'system'
        WHERE EquipmentID = @EquipmentID AND MouldID = @MouldID;

        INSERT INTO Mould_EquipmentLog
        (MouldID, EquipmentID, ValidationStatus, ProdDate, ProdShift, AtMouldLife, Timestamp)
        VALUES (@MouldID, @EquipmentID, 1, @ProdDate, @ProdShift, @AtMouldLife, GETDATE());
      COMMIT;
    `;

    const updateRequest = new sqlConnection.sql.Request();
    updateRequest.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
    updateRequest.input("MouldID", sqlConnection.sql.NVarChar, mouldID);
    updateRequest.input("ProdDate", sqlConnection.sql.Date, ProdDate);
    updateRequest.input("ProdShift", sqlConnection.sql.NVarChar, ProdShift);
    updateRequest.input("AtMouldLife", sqlConnection.sql.Int, AtMouldLife);

    const dbResult = await updateRequest.query(updateAndInsertQuery);
    console.log("✅ Database updated successfully");

    // 6️⃣ Execute Binary File
    const exePath = "D:\\ToshibaIntegrationTesting\\Application\\Write2Machine\\Debug\\Debug\\ToshibaLocal2Machines.exe";
    const validationStatus = "1";
    const exeArgs = [EquipmentID, mouldID, validationStatus];

    const runExe = () =>
      new Promise((resolve, reject) => {
        execFile(exePath, exeArgs, (error, stdout, stderr) => {
          if (error) return reject(stderr || error.message);
          resolve(stdout || stderr);
        });
      });

    const exeOutput = await runExe();
    console.log("✅ EXE executed successfully:", exeOutput);

    // 7️⃣ Send Tag Update to Machine API
    const timestamp = new Date().toISOString();
    const payload = [{ pointName: machineTag, timestamp, quality: 9, value: 1 }];
    const credentials = base64.encode("Chelsy:Dalisoft@123");

    const apiResponse = await axios.post(
      "http://DESKTOP-T266BV5/ODataConnector/rest/RealtimeData/Write",
      payload,
      { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" } }
    );

    return middlewares.standardResponse(
      res,
      { dbUpdate: dbResult.rowsAffected, exeOutput, apiPayload: payload, apiResponse: apiResponse.data },
      200,
      "ValidationStatus updated, binary executed, and tag updated successfully"
    );

  } catch (err) {
    console.error("❌ Error in process:", err);
    return middlewares.standardResponse(res, { error: err.message }, 500, "Error occurred while updating ValidationStatus or machine tag");
  }
});



router.post("/updateValidationStatUnload", async (req, res) => {
  const { EquipmentID, mouldID } = req.body;

  if (!EquipmentID || !mouldID) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields");
  }

  try {
    const request = new sqlConnection.sql.Request();

    // 1️⃣ Get StationID from Config_Equipment
    request.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
    const equipmentResult = await request.query(`
      SELECT TOP 1 StationID FROM Config_Equipment WHERE EquipmentID = @EquipmentID
    `);

    if (!equipmentResult.recordset.length) {
      return middlewares.standardResponse(res, null, 404, `EquipmentID not found in DB: ${EquipmentID}`);
    }

    const StationID = equipmentResult.recordset[0].StationID;

    // 2️⃣ Get ProdDate & ProdShift from Prod_ShiftInformation
    const prodShiftResult = await new sqlConnection.sql.Request()
      .input("StationID", sqlConnection.sql.Int, StationID)
      .query(`
        SELECT TOP 1 ProdDate, ShiftName
        FROM Prod_ShiftInformation
        WHERE StationID = @StationID
        ORDER BY ProdDate DESC
      `);

    const ProdDate = prodShiftResult.recordset[0]?.ProdDate || null;
    const ProdShift = prodShiftResult.recordset[0]?.ShiftName || null;

    // 3️⃣ Get AtMouldLife from Mould_Monitoring
    const mouldLifeResult = await new sqlConnection.sql.Request()
      .input("MouldID", sqlConnection.sql.NVarChar, mouldID)
      .input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID)
      .query(`
        SELECT TOP 1 MouldActualLife
        FROM Mould_Monitoring
        WHERE MouldID = @MouldID AND EquipmentID = @EquipmentID
        ORDER BY UID DESC
      `);

    const AtMouldLife = mouldLifeResult.recordset[0]?.MouldActualLife || 0;

    // 4️⃣ Map StationID → Machine Tag
    const stationTagMap = {
      "1": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-1/ValidationStatus",
      "2": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-2/ValidationStatus",
      "3": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-3/ValidationStatus",
      "4": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-4/ValidationStatus",
      "5": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-5/ValidationStatus",
      "6": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-6/ValidationStatus",
      "7": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-7/ValidationStatus",
      "8": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-8/ValidationStatus",
      "9": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-9/ValidationStatus",
      "10": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-10/ValidationStatus",
    };

    const machineTag = stationTagMap[StationID];
    if (!machineTag) {
      return middlewares.standardResponse(res, null, 400, `No tag found for StationID: ${StationID}`);
    }

    // 5️⃣ Update Mould_MachineMatrix & Insert into Mould_EquipmentLog (ValidationStatus = 0)
    const updateAndInsertQuery = `
      BEGIN TRANSACTION;
        UPDATE Mould_MachineMatrix
        SET ValidationStatus = 0,
            LastUpdatedTime = GETDATE(),
            LastUpdatedBy = 'system'
        WHERE EquipmentID = @EquipmentID AND MouldID = @MouldID;

        INSERT INTO Mould_EquipmentLog
        (MouldID, EquipmentID, ValidationStatus, ProdDate, ProdShift, AtMouldLife, Timestamp)
        VALUES (@MouldID, @EquipmentID, 0, @ProdDate, @ProdShift, @AtMouldLife, GETDATE());
      COMMIT;
    `;

    const updateRequest = new sqlConnection.sql.Request();
    updateRequest.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
    updateRequest.input("MouldID", sqlConnection.sql.NVarChar, mouldID);
    updateRequest.input("ProdDate", sqlConnection.sql.Date, ProdDate);
    updateRequest.input("ProdShift", sqlConnection.sql.NVarChar, ProdShift);
    updateRequest.input("AtMouldLife", sqlConnection.sql.Int, AtMouldLife);

    const dbResult = await updateRequest.query(updateAndInsertQuery);
    console.log("✅ Database updated successfully (ValidationStatus = 0)");

    // 6️⃣ Execute Binary File
    const exePath = "D:\\ToshibaIntegrationTesting\\Application\\Write2Machine\\Debug\\Debug\\ToshibaLocal2Machines.exe";
    const validationStatus = "0";
    const exeArgs = [EquipmentID, mouldID, validationStatus];

    const runExe = () =>
      new Promise((resolve, reject) => {
        execFile(exePath, exeArgs, (error, stdout, stderr) => {
          if (error) return reject(stderr || error.message);
          resolve(stdout || stderr);
        });
      });

    const exeOutput = await runExe();
    console.log("✅ EXE executed successfully:", exeOutput);

    // 7️⃣ Send Tag Update to Machine API
    const timestamp = new Date().toISOString();
    const payload = [{ pointName: machineTag, timestamp, quality: 9, value: 0 }];
    const credentials = base64.encode("Chelsy:Dalisoft@123");

    const apiResponse = await axios.post(
      "http://DESKTOP-T266BV5/ODataConnector/rest/RealtimeData/Write",
      payload,
      { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" } }
    );

    return middlewares.standardResponse(
      res,
      { dbUpdate: dbResult.rowsAffected, exeOutput, apiPayload: payload, apiResponse: apiResponse.data },
      200,
      "ValidationStatus unloaded, binary executed, and tag updated successfully"
    );

  } catch (err) {
    console.error("❌ Error in unloading process:", err);
    return middlewares.standardResponse(res, { error: err.message }, 500, "Error occurred while unloading ValidationStatus or updating machine tag");
  }
});



// router.post("/load", (request, response) => {
//   console.log(moment().format("yyyy-MM-DD"));
//   new sqlConnection.sql.Request().query(
//     `SELECT Count(1) AS temp FROM Mould_Monitoring where EquipmentID = \'${request.body.EquipmentID}\' and MouldID = \'${request.body.MouldID}\'`,
//     (err, result) => {
//       if (err) {
//         middlewares.standardResponse(
//           response,
//           null,
//           300,
//           "Error executing query: " + err
//         );
//         console.error("Error executing query:", err);
//       } else {
//         if (parseInt(result.recordset[0].temp) > 0) {
//           new sqlConnection.sql.Request().query(
//             `UPDATE M
// SET 
//     M.MouldStatus = ${request.body.MouldStatus},
//     M.LastUpdatedTime = GETDATE(),
//     M.MouldInstanceLife = D.Total_Shots,
//     M.MouldCurrentLife = D.Total_Shots
// FROM [PPMS_LILBawal].[dbo].[Mould_Monitoring] M
// INNER JOIN [ToshibaBinaryFileDb].[dbo].[Machine_Data] D
//     ON M.EquipmentID COLLATE SQL_Latin1_General_CP1_CI_AS = D.Machine_ID COLLATE SQL_Latin1_General_CP1_CI_AS
//    OR M.MouldID COLLATE SQL_Latin1_General_CP1_CI_AS = D.Mould_ID COLLATE SQL_Latin1_General_CP1_CI_AS
// WHERE EquipmentID = \'${request.body.EquipmentID}\' OR MouldID = \'${request.body.MouldID}\';
//   INSERT INTO Mould_Genealogy VALUES (\'${request.body.MouldID}\',${request.body.CurrentMouldLife},${request.body.ParameterID},${request.body.ParameterValue},GETDATE());
//             UPDATE CONFIG_MOULD set MouldStatus = ${request.body.MouldStatus}, LastUpdatedTime = GETDATE() where MouldID = \'${request.body.MouldID}\';
//             `,
//             (err, result) => {
//               if (err) {
//                 middlewares.standardResponse(
//                   response,
//                   null,
//                   300,
//                   "Error executing query: " + err
//                 );
//                 console.error("Error executing query:", err);
//               } else {
//                 middlewares.standardResponse(
//                   response,
//                   result.recordset,
//                   200,
//                   "success"
//                 );
//                 console.dir(result.recordset);
//               }
//             }
//           );
//         } else {
//           new sqlConnection.sql.Request().query(
//             `INSERT INTO Mould_Monitoring VALUES (\'${request.body.EquipmentID}\',\'${request.body.MouldID}\',${request.body.MouldActualLife},${request.body.HealthCheckThreshold},${request.body.NextPMDue},${request.body.PMWarning},NULL,NULL,${request.body.HealthCheckDue},${request.body.HealthCheckWarning},NULL,NULL,${request.body.MouldLifeStatus},${request.body.MouldPMStatus},${request.body.MouldHealthStatus},${request.body.MouldStatus},GETDATE());
            
//             INSERT INTO Mould_EquipmentLog VALUES (\'${request.body.MouldID}\',\'${request.body.EquipmentID}\',${request.body.MouldStatus},GETDATE());

//             INSERT INTO Mould_Genealogy VALUES (\'${request.body.MouldID}\',${request.body.CurrentMouldLife},${request.body.ParameterID},${request.body.ParameterValue},GETDATE());
//             INSERT INTO Mould_EquipmentLog VALUES (\'${request.body.MouldID}\',${request.body.EquipmentID},${request.body.MouldStatus},GETDATE());
            
//             UPDATE CONFIG_MOULD set MouldStatus = ${request.body.MouldStatus}, LastUpdatedTime = GETDATE() where MouldID = \'${request.body.MouldID}\';`,
//             (err, result) => {
//               if (err) {
//                 middlewares.standardResponse(
//                   response,
//                   null,
//                   300,
//                   "Error executing query: " + err
//                 );
//                 console.error("Error executing query:", err);
//               } else {
//                 middlewares.standardResponse(
//                   response,
//                   result.recordset,
//                   200,
//                   "success"
//                 );
//                 console.dir(result.recordset);
//               }
//             }
//           );
//         }
//       }
//     }
//   );
// });

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


router.post("/load", async (req, res) => {
  const {
    EquipmentID,
    MouldID,
    MouldStatus,
    MouldLifeStatus,
    MouldActualLife,
    HealthCheckThreshold,
    NextPMDue,
    PMWarning,
    HealthCheckDue,
    HealthCheckWarning,
    MouldPMStatus,
    MouldHealthStatus,
    CurrentMouldLife,
    ParameterID,
    ParameterValue,
    NewMouldLife
  } = req.body;

  if (!EquipmentID || !MouldID) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields");
  }

  try {
    // 🔹 Get StationID
    const getStationReq = new sqlConnection.sql.Request();
    getStationReq.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
    const stationResult = await getStationReq.query(`
      SELECT StationID 
      FROM [PPMS_LILBawal].[dbo].[Config_Equipment] 
      WHERE EquipmentID = @EquipmentID
    `);

    const StationID = stationResult.recordset.length
      ? stationResult.recordset[0].StationID
      : 1; // fallback

    // 🔹 Check if record exists
    const checkReq = new sqlConnection.sql.Request();
    const checkQuery = `
      SELECT COUNT(1) AS temp 
      FROM [PPMS_LILBawal].[dbo].[Mould_Monitoring] 
      WHERE EquipmentID = '${EquipmentID}' AND MouldID = '${MouldID}'
    `;
    const checkResult = await checkReq.query(checkQuery);
    const exists = parseInt(checkResult.recordset[0].temp) > 0;

    const dbReq = new sqlConnection.sql.Request();

    if (exists) {
      // 🔹 Update existing
      await dbReq.query(`
        UPDATE M
        SET 
            M.MouldStatus = ${MouldStatus},
            M.MouldLifeStatus = ${MouldLifeStatus},
            M.LastUpdatedTime = GETDATE(),
            M.MouldActualLife = ${NewMouldLife}
        FROM [PPMS_LILBawal].[dbo].[Mould_Monitoring] M
        WHERE EquipmentID = '${EquipmentID}' AND MouldID = '${MouldID}';

        INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Genealogy]
        VALUES ('${MouldID}', ${CurrentMouldLife}, ${ParameterID}, ${ParameterValue}, GETDATE());

        UPDATE [PPMS_LILBawal].[dbo].[CONFIG_MOULD]
        SET MouldStatus = ${MouldStatus}, LastUpdatedTime = GETDATE()
        WHERE MouldID = '${MouldID}';
      `);
    } else {
      // 🔹 Insert new
      await dbReq.query(`
        INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Monitoring]
        VALUES ('${EquipmentID}','${MouldID}',${MouldActualLife},${HealthCheckThreshold},${NextPMDue},${PMWarning},
                NULL,NULL,${HealthCheckDue},${HealthCheckWarning},NULL,NULL,${MouldLifeStatus},
                ${MouldPMStatus},${MouldHealthStatus},${MouldStatus},GETDATE());

        INSERT INTO [PPMS_LILBawal].[dbo].[Mould_EquipmentLog]
        VALUES ('${MouldID}','${EquipmentID}',${MouldStatus},GETDATE());

        INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Genealogy]
        VALUES ('${MouldID}',${CurrentMouldLife},${ParameterID},${ParameterValue},GETDATE());

        UPDATE [PPMS_LILBawal].[dbo].[CONFIG_MOULD]
        SET MouldStatus = ${MouldStatus}, LastUpdatedTime = GETDATE()
        WHERE MouldID = '${MouldID}';
      `);
    }

    // 🔹 Compute Multiplier and ShotCount for PLC
    const a = Math.floor(NewMouldLife / 10000);
    const b = a * 10000;
    const ShotCount = NewMouldLife - b;

    const multiplierTag = `ac:PPMS_SolutionLIL/TotalMouldLife/Machine${StationID}/Multiplier`;
    const shotCountTag = `ac:PPMS_SolutionLIL/TotalMouldLife/Machine${StationID}/ShotCount`;

    // 🔹 Send data to PLC
    const timestamp = new Date().toISOString();
    const credentials = base64.encode("Chelsy:Dalisoft@123");

    const tagPayloads = [
      { pointName: multiplierTag, timestamp, quality: 9, value: a },
      { pointName: shotCountTag, timestamp, quality: 9, value: ShotCount }
    ];

    const apiResponse = await axios.post(
      "http://DESKTOP-T266BV5/ODataConnector/rest/RealtimeData/Write",
      tagPayloads,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json"
        }
      }
    );

    return middlewares.standardResponse(
      res,
      {
        updatedTags: tagPayloads,
        apiResponse: apiResponse.data,
      },
      200,
      "Mould data and tag values updated successfully"
    );
  } catch (err) {
    console.error("❌ Error executing query:", err);
    return middlewares.standardResponse(res, null, 500, "Error: " + err.message);
  }
});

module.exports = router;
