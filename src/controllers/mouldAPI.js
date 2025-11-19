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


// router.post("/updateValidationStatusLoad", async (req, res) => {
//   const { EquipmentID, mouldID } = req.body;

//   if (!EquipmentID || !mouldID) {
//     return middlewares.standardResponse(res, null, 400, "Missing required fields");
//   }

//   try {
//     const request = new sqlConnection.sql.Request();

//     // 1️⃣ Get StationID and EquipmentName from Config_Equipment
//     request.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
//     const equipmentResult = await request.query(`
//       SELECT TOP 1 StationID, EquipmentName 
//       FROM Config_Equipment 
//       WHERE EquipmentID = @EquipmentID
//     `);

//     if (!equipmentResult.recordset.length) {
//       return middlewares.standardResponse(res, null, 404, `EquipmentID not found in DB: ${EquipmentID}`);
//     }

//     const { StationID, EquipmentName } = equipmentResult.recordset[0];

//     // 2️⃣ Get ProdDate & ProdShift from Prod_ShiftInformation
//     const prodShiftResult = await new sqlConnection.sql.Request()
//       .input("StationID", sqlConnection.sql.Int, StationID)
//       .query(`
//         SELECT TOP 1 ProdDate, ShiftName
//         FROM Prod_ShiftInformation
//         WHERE StationID = @StationID
//         ORDER BY ProdDate DESC
//       `);

//     const ProdDate = prodShiftResult.recordset[0]?.ProdDate || null;
//     const ProdShift = prodShiftResult.recordset[0]?.ShiftName || null;

//     // 3️⃣ Get AtMouldLife from Mould_Monitoring
//     const mouldLifeResult = await new sqlConnection.sql.Request()
//       .input("MouldID", sqlConnection.sql.NVarChar, mouldID)
//       .input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID)
//       .query(`
//         SELECT TOP 1 MouldActualLife
//         FROM Mould_Monitoring
//         WHERE MouldID = @MouldID AND EquipmentID = @EquipmentID
//         ORDER BY UID DESC
//       `);

//     const AtMouldLife = mouldLifeResult.recordset[0]?.MouldActualLife || 0;

//     // 4️⃣ Map StationID → Machine Tag
//     const stationTagMap = {
//       "1": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-1/ValidationStatus",
//       "2": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-2/ValidationStatus",
//       "3": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-3/ValidationStatus",
//       "4": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-4/ValidationStatus",
//       "5": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-5/ValidationStatus",
//       "6": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-6/ValidationStatus",
//       "7": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-7/ValidationStatus",
//       "8": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-8/ValidationStatus",
//       "9": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-9/ValidationStatus",
//       "10": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-10/ValidationStatus",
//     };

//     const machineTag = stationTagMap[StationID];

//     // 5️⃣ Update Mould_MachineMatrix & Insert into Mould_EquipmentLog
//     const updateAndInsertQuery = `
//       BEGIN TRANSACTION;
//         UPDATE Mould_MachineMatrix
//         SET ValidationStatus = 1,
//             LastUpdatedTime = GETDATE(),
//             LastUpdatedBy = 'system'
//         WHERE EquipmentID = @EquipmentID AND MouldID = @MouldID;

//         INSERT INTO Mould_EquipmentLog
//         (MouldID, EquipmentID, ValidationStatus, ProdDate, ProdShift, AtMouldLife, Timestamp)
//         VALUES (@MouldID, @EquipmentID, 1, @ProdDate, @ProdShift, @AtMouldLife, GETDATE());
//       COMMIT;
//     `;

//     const updateRequest = new sqlConnection.sql.Request();
//     updateRequest.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
//     updateRequest.input("MouldID", sqlConnection.sql.NVarChar, mouldID);
//     updateRequest.input("ProdDate", sqlConnection.sql.Date, ProdDate);
//     updateRequest.input("ProdShift", sqlConnection.sql.NVarChar, ProdShift);
//     updateRequest.input("AtMouldLife", sqlConnection.sql.Int, AtMouldLife);

//     const dbResult = await updateRequest.query(updateAndInsertQuery);
//     console.log("✅ Database updated successfully");

//     let exeOutput = null;
//     let apiResponseData = null;

//     if (EquipmentName.includes("Shibaura")) {
//       // Shibura → DB + Binary, skip tag
//       const exePath = "D:\\ToshibaIntegrationTesting\\Application\\Write2Machine\\Debug\\Debug\\ToshibaLocal2Machines.exe";
//       const validationStatus = "1";
//       const exeArgs = [EquipmentID, mouldID, validationStatus];

//       const runExe = () =>
//         new Promise((resolve, reject) => {
//           execFile(exePath, exeArgs, (error, stdout, stderr) => {
//             if (error) return reject(stderr || error.message);
//             resolve(stdout || stderr);
//           });
//         });

//       exeOutput = await runExe();
//       console.log("✅ Binary executed for Shibaura machine, skipping tag update");
//     } else {
//       // Non-Shibura → DB + Tag, skip binary
//       if (machineTag) {
//         const timestamp = new Date().toISOString();
//         const payload = [{ pointName: machineTag, timestamp, quality: 9, value: 1 }];
//         const credentials = base64.encode("Chelsy:Dalisoft@123");

//         const apiResponse = await axios.post(
//           "http://DESKTOP-T266BV5/ODataConnector/rest/RealtimeData/Write",
//           payload,
//           { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" } }
//         );

//         apiResponseData = apiResponse.data;
//         console.log("✅ Tag updated for non-Shibura machine");
//       }
//     }

//     return middlewares.standardResponse(
//       res,
//       { dbUpdate: dbResult.rowsAffected, exeOutput, apiResponse: apiResponseData },
//       200,
//       "ValidationStatus updated successfully with conditional execution"
//     );

//   } catch (err) {
//     console.error("❌ Error in process:", err);
//     return middlewares.standardResponse(res, { error: err.message }, 500, "Error occurred while updating ValidationStatus or machine tag");
//   }
// });

router.post("/updateValidationStatusLoad", async (req, res) => {
  const { EquipmentID, mouldID } = req.body;

  if (!EquipmentID || !mouldID) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields");
  }

  try {
    // **********************************************
    // 0️⃣ VALIDATION CHECK – BLOCK MULTIPLE VALID MOULDS FOR SAME EQUIPMENT
    // **********************************************
    const validationCheck = await new sqlConnection.sql.Request()
      .input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID)
      .query(`
        SELECT TOP 1 MouldID 
        FROM Mould_MachineMatrix
        WHERE EquipmentID = @EquipmentID AND ValidationStatus = 1
      `);

    if (validationCheck.recordset.length > 0) {
      const alreadyValidated = validationCheck.recordset[0].MouldID;

     return res.status(403).json({
  success: false,
  message: `Machine ${EquipmentID} already has a validated mould (${alreadyValidated}).`
});
    }

    // **********************************************
    // 0️⃣.2 VALIDATION – CHECK IF SAME MOULD RUNNING IN ANOTHER EQUIPMENT
    // **********************************************
    const mouldRunningElsewhere = await new sqlConnection.sql.Request()
      .input("MouldID", sqlConnection.sql.NVarChar, mouldID)
      .input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID)
      .query(`
        SELECT TOP 1 EquipmentID 
        FROM Mould_MachineMatrix
        WHERE MouldID = @MouldID 
          AND ValidationStatus = 1
          AND EquipmentID <> @EquipmentID
      `);

    if (mouldRunningElsewhere.recordset.length > 0) {
      const otherEquipment = mouldRunningElsewhere.recordset[0].EquipmentID;

     return res.status(403).json({
  success: false,
  message: `❌ This mould is already running on Machine ${otherEquipment}. Please unload it from that machine before validating here.`
});
    }

    // --------------------------------------------------
    // 1️⃣ Get StationID, EquipmentName from Config_Equipment
    // --------------------------------------------------
    const request = new sqlConnection.sql.Request();
    request.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);

    const equipmentResult = await request.query(`
      SELECT TOP 1 StationID, EquipmentName 
      FROM Config_Equipment 
      WHERE EquipmentID = @EquipmentID
    `);

    if (!equipmentResult.recordset.length) {
      return middlewares.standardResponse(res, null, 404, `EquipmentID not found in DB: ${EquipmentID}`);
    }

    const { StationID, EquipmentName } = equipmentResult.recordset[0];

    // --------------------------------------------------
    // 2️⃣ Fetch ProdDate & ProdShift
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 3️⃣ Fetch AtMouldLife
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 4️⃣ Tag Mapping
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 5️⃣ Update Matrix & Insert Log
    // --------------------------------------------------
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

    let exeOutput = null;
    let apiResponseData = null;

    // --------------------------------------------------
    // 6️⃣ SHIBAURA case → Run EXE only
    // --------------------------------------------------
    if (EquipmentName.includes("Shibaura")) {
      const exePath = "D:\\ToshibaIntegrationTesting\\Application\\Write2Machine\\Debug\\Debug\\ToshibaLocal2Machines.exe";
      const exeArgs = [EquipmentID, mouldID, "1"];

      exeOutput = await new Promise((resolve, reject) => {
        execFile(exePath, exeArgs, (error, stdout, stderr) => {
          if (error) return reject(stderr || error.message);
          resolve(stdout || stderr);
        });
      });

    } else {
      // --------------------------------------------------
      // 7️⃣ NON–SHIBAURA → Write Tag Only
      // --------------------------------------------------
      if (machineTag) {
        const timestamp = new Date().toISOString();
        const payload = [{ pointName: machineTag, timestamp, quality: 9, value: 1 }];
        const credentials = base64.encode("Chelsy:Dalisoft@123");

        const apiResponse = await axios.post(
          "http://DESKTOP-T266BV5/ODataConnector/rest/RealtimeData/Write",
          payload,
          { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" } }
        );

        apiResponseData = apiResponse.data;
      }
    }

    // --------------------------------------------------
    // 8️⃣ Final Response
    // --------------------------------------------------
    return middlewares.standardResponse(
      res,
      { dbUpdate: dbResult.rowsAffected, exeOutput, apiResponse: apiResponseData },
      200,
      "ValidationStatus updated successfully with conditional execution"
    );

  } catch (err) {
  console.error("❌ Error in process:", err);

  // Force proper axios error response structure
  return res.status(500).json({
    success: false,
    message: "Error occurred while updating ValidationStatus or machine tag",
    error: err.message || "Unknown error",
  });
}
});




// router.post("/updateValidationStatUnload", async (req, res) => {
//   const { EquipmentID, mouldID } = req.body;

//   if (!EquipmentID || !mouldID) {
//     return middlewares.standardResponse(res, null, 400, "Missing required fields");
//   }

//   try {
//     const request = new sqlConnection.sql.Request();

//     // 1️⃣ Get StationID & EquipmentName from Config_Equipment
//     request.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
//     const equipmentResult = await request.query(`
//       SELECT TOP 1 StationID, EquipmentName 
//       FROM Config_Equipment 
//       WHERE EquipmentID = @EquipmentID
//     `);

//     if (!equipmentResult.recordset.length) {
//       return middlewares.standardResponse(res, null, 404, `EquipmentID not found in DB: ${EquipmentID}`);
//     }

//     const { StationID, EquipmentName } = equipmentResult.recordset[0];

//     // 2️⃣ Get ProdDate & ProdShift from Prod_ShiftInformation
//     const prodShiftResult = await new sqlConnection.sql.Request()
//       .input("StationID", sqlConnection.sql.Int, StationID)
//       .query(`
//         SELECT TOP 1 ProdDate, ShiftName
//         FROM Prod_ShiftInformation
//         WHERE StationID = @StationID
//         ORDER BY ProdDate DESC
//       `);

//     const ProdDate = prodShiftResult.recordset[0]?.ProdDate || null;
//     const ProdShift = prodShiftResult.recordset[0]?.ShiftName || null;

//     // 3️⃣ Get AtMouldLife from Mould_Monitoring
//     const mouldLifeResult = await new sqlConnection.sql.Request()
//       .input("MouldID", sqlConnection.sql.NVarChar, mouldID)
//       .input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID)
//       .query(`
//         SELECT TOP 1 MouldActualLife
//         FROM Mould_Monitoring
//         WHERE MouldID = @MouldID AND EquipmentID = @EquipmentID
//         ORDER BY UID DESC
//       `);

//     const AtMouldLife = mouldLifeResult.recordset[0]?.MouldActualLife || 0;

//     // 4️⃣ Map StationID → Machine Tag
//     const stationTagMap = {
//       "1": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-1/ValidationStatus",
//       "2": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-2/ValidationStatus",
//       "3": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-3/ValidationStatus",
//       "4": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-4/ValidationStatus",
//       "5": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-5/ValidationStatus",
//       "6": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-6/ValidationStatus",
//       "7": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-7/ValidationStatus",
//       "8": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-8/ValidationStatus",
//       "9": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-9/ValidationStatus",
//       "10": "ac:PPMS_SolutionLIL/ScadaToPLC/Machine-10/ValidationStatus",
//     };

//     const machineTag = stationTagMap[StationID];

//     // 5️⃣ Update Mould_MachineMatrix & Insert into Mould_EquipmentLog (ValidationStatus = 0)
//     const updateAndInsertQuery = `
//       BEGIN TRANSACTION;
//         UPDATE Mould_MachineMatrix
//         SET ValidationStatus = 0,
//             LastUpdatedTime = GETDATE(),
//             LastUpdatedBy = 'system'
//         WHERE EquipmentID = @EquipmentID AND MouldID = @MouldID;

//         INSERT INTO Mould_EquipmentLog
//         (MouldID, EquipmentID, ValidationStatus, ProdDate, ProdShift, AtMouldLife, Timestamp)
//         VALUES (@MouldID, @EquipmentID, 0, @ProdDate, @ProdShift, @AtMouldLife, GETDATE());
//       COMMIT;
//     `;

//     const updateRequest = new sqlConnection.sql.Request();
//     updateRequest.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
//     updateRequest.input("MouldID", sqlConnection.sql.NVarChar, mouldID);
//     updateRequest.input("ProdDate", sqlConnection.sql.Date, ProdDate);
//     updateRequest.input("ProdShift", sqlConnection.sql.NVarChar, ProdShift);
//     updateRequest.input("AtMouldLife", sqlConnection.sql.Int, AtMouldLife);

//     const dbResult = await updateRequest.query(updateAndInsertQuery);
//     console.log("✅ Database updated successfully (ValidationStatus = 0)");

//     let exeOutput = null;
//     let apiResponseData = null;

//     if (EquipmentName.includes("Shibaura")) {
//       // ✅ Shibura → DB + Binary only
//       const exePath = "D:\\ToshibaIntegrationTesting\\Application\\Write2Machine\\Debug\\Debug\\ToshibaLocal2Machines.exe";
//       const validationStatus = "0";
//       const exeArgs = [EquipmentID, mouldID, validationStatus];

//       const runExe = () =>
//         new Promise((resolve, reject) => {
//           execFile(exePath, exeArgs, (error, stdout, stderr) => {
//             if (error) return reject(stderr || error.message);
//             resolve(stdout || stderr);
//           });
//         });

//       exeOutput = await runExe();
//       console.log("✅ Binary executed for Shibura machine, skipping tag update");
//     } else {
//       // ✅ Non-Shibura → DB + Tag only
//       if (machineTag) {
//         const timestamp = new Date().toISOString();
//         const payload = [{ pointName: machineTag, timestamp, quality: 9, value: 0 }];
//         const credentials = base64.encode("Chelsy:Dalisoft@123");

//         const apiResponse = await axios.post(
//           "http://DESKTOP-T266BV5/ODataConnector/rest/RealtimeData/Write",
//           payload,
//           { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" } }
//         );

//         apiResponseData = apiResponse.data;
//         console.log("✅ Tag updated for non-Shibura machine, skipping binary execution");
//       }
//     }

//     return middlewares.standardResponse(
//       res,
//       { dbUpdate: dbResult.rowsAffected, exeOutput, apiResponse: apiResponseData },
//       200,
//       "ValidationStatus unloaded successfully with conditional execution"
//     );

//   } catch (err) {
//     console.error("❌ Error in unloading process:", err);
//     return middlewares.standardResponse(res, { error: err.message }, 500, "Error occurred while unloading ValidationStatus or updating machine tag");
//   }
// });

router.post("/updateValidationStatUnload", async (req, res) => {
  const { EquipmentID, mouldID } = req.body;

  if (!EquipmentID || !mouldID) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields");
  }

  try {

    // --------------------------------------------------
    // 0️⃣ ❗ ALLOW UNLOAD ONLY IF THIS MOULD IS VALIDATED (Status = 1)
    // --------------------------------------------------
    const validateCheck = await new sqlConnection.sql.Request()
      .input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID)
      .input("MouldID", sqlConnection.sql.NVarChar, mouldID)
      .query(`
        SELECT TOP 1 *
        FROM Mould_MachineMatrix
        WHERE EquipmentID = @EquipmentID 
          AND MouldID = @MouldID
          AND ValidationStatus = 1
      `);

    if (validateCheck.recordset.length === 0) {
      return middlewares.standardResponse(
        res,
        null,
        403,
        `⚠ Mould ${mouldID} is not in Production on Equipment ${EquipmentID}. Only validated mould can be unloaded.`
      );
    }

    // --------------------------------------------------
    // 1️⃣ Get StationID & EquipmentName
    // --------------------------------------------------
    const request = new sqlConnection.sql.Request();
    request.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);

    const equipmentResult = await request.query(`
      SELECT TOP 1 StationID, EquipmentName 
      FROM Config_Equipment 
      WHERE EquipmentID = @EquipmentID
    `);

    if (!equipmentResult.recordset.length) {
      return middlewares.standardResponse(res, null, 404, `EquipmentID not found in DB: ${EquipmentID}`);
    }

    const { StationID, EquipmentName } = equipmentResult.recordset[0];

    // --------------------------------------------------
    // 2️⃣ Get ProdDate & ProdShift
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 3️⃣ Get AtMouldLife
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 4️⃣ Machine tag map
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 5️⃣ Update DB (ValidationStatus = 0)
    // --------------------------------------------------
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

    let exeOutput = null;
    let apiResponseData = null;

    // --------------------------------------------------
    // 6️⃣ Shibaura → EXE only
    // --------------------------------------------------
    if (EquipmentName.includes("Shibaura")) {
      const exePath = "D:\\ToshibaIntegrationTesting\\Application\\Write2Machine\\Debug\\Debug\\ToshibaLocal2Machines.exe";
      const exeArgs = [EquipmentID, mouldID, "0"];

      exeOutput = await new Promise((resolve, reject) => {
        execFile(exePath, exeArgs, (error, stdout, stderr) => {
          if (error) return reject(stderr || error.message);
          resolve(stdout || stderr);
        });
      });
    }

    // --------------------------------------------------
    // 7️⃣ Non-Shibaura → Tag only
    // --------------------------------------------------
    else if (machineTag) {
      const timestamp = new Date().toISOString();
      const payload = [{ pointName: machineTag, timestamp, quality: 9, value: 0 }];
      const credentials = base64.encode("Chelsy:Dalisoft@123");

      const apiResponse = await axios.post(
        "http://DESKTOP-T266BV5/ODataConnector/rest/RealtimeData/Write",
        payload,
        { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" } }
      );

      apiResponseData = apiResponse.data;
    }

    return middlewares.standardResponse(
      res,
      { dbUpdate: dbResult.rowsAffected, exeOutput, apiResponse: apiResponseData },
      200,
      "ValidationStatus unloaded successfully"
    );

  } catch (err) {
    return middlewares.standardResponse(res, { error: err.message }, 500,
      "Error occurred while unloading ValidationStatus");
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
      .input('EquipmentID', sqlConnection.sql.NVarChar, EquipmentID)
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


// router.post("/load", async (req, res) => {
//   const {
//     EquipmentID,
//     MouldID,
//     MouldStatus,
//     MouldLifeStatus,
//     MouldActualLife,
//     HealthCheckThreshold,
//     NextPMDue,
//     PMWarning,
//     HealthCheckDue,
//     HealthCheckWarning,
//     MouldPMStatus,
//     MouldHealthStatus,
//     CurrentMouldLife,
//     ParameterID,
//     ParameterValue,
//     NewMouldLife
//   } = req.body;

//   if (!EquipmentID || !MouldID) {
//     return middlewares.standardResponse(res, null, 400, "Missing required fields: EquipmentID or MouldID");
//   }

//   try {
//     // 🔹 Get StationID
//     const getStationReq = new sqlConnection.sql.Request();
//     getStationReq.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
//     const stationResult = await getStationReq.query(`
//       SELECT StationID 
//       FROM [PPMS_LILBawal].[dbo].[Config_Equipment] 
//       WHERE EquipmentID = @EquipmentID
//     `);

//     const StationID = stationResult.recordset.length
//       ? stationResult.recordset[0].StationID
//       : 1; // fallback

//     // 🔹 Check if record exists
//     const checkReq = new sqlConnection.sql.Request();
//     checkReq.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
//     checkReq.input("MouldID", sqlConnection.sql.VarChar, MouldID);
//     const checkResult = await checkReq.query(`
//       SELECT COUNT(1) AS temp 
//       FROM [PPMS_LILBawal].[dbo].[Mould_Monitoring] 
//       WHERE EquipmentID = @EquipmentID AND MouldID = @MouldID
//     `);

//     const exists = parseInt(checkResult.recordset[0].temp) > 0;
//     const dbReq = new sqlConnection.sql.Request();

//     // Common inputs
//     dbReq.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
//     dbReq.input("MouldID", sqlConnection.sql.VarChar, MouldID);
//     dbReq.input("MouldStatus", sqlConnection.sql.Int, MouldStatus || 0);
//     dbReq.input("MouldLifeStatus", sqlConnection.sql.Int, MouldLifeStatus || 0);
//     dbReq.input("MouldActualLife", sqlConnection.sql.Int, MouldActualLife || 0);
//     dbReq.input("NewMouldLife", sqlConnection.sql.Int, NewMouldLife || 0);
//     dbReq.input("CurrentMouldLife", sqlConnection.sql.Int, CurrentMouldLife || 0);
//     dbReq.input("ParameterID", sqlConnection.sql.Int, ParameterID || 0);
//     dbReq.input("ParameterValue", sqlConnection.sql.Int, ParameterValue || 0);
//     dbReq.input("HealthCheckThreshold", sqlConnection.sql.Int, HealthCheckThreshold || 0);
//     dbReq.input("NextPMDue", sqlConnection.sql.Int, NextPMDue || 0);
//     dbReq.input("PMWarning", sqlConnection.sql.Int, PMWarning || 0);
//     dbReq.input("HealthCheckDue", sqlConnection.sql.Int, HealthCheckDue || 0);
//     dbReq.input("HealthCheckWarning", sqlConnection.sql.Int, HealthCheckWarning || 0);
//     dbReq.input("MouldPMStatus", sqlConnection.sql.Int, MouldPMStatus || 0);
//     dbReq.input("MouldHealthStatus", sqlConnection.sql.Int, MouldHealthStatus || 0);

//     if (exists) {
//       // 🔹 Update existing record
//       await dbReq.query(`
//         UPDATE M
//         SET 
//             M.MouldStatus = @MouldStatus,
//             M.MouldLifeStatus = @MouldLifeStatus,
//             M.LastUpdatedTime = GETDATE(),
//             M.MouldActualLife = @NewMouldLife
//         FROM [PPMS_LILBawal].[dbo].[Mould_Monitoring] M
//         WHERE EquipmentID = @EquipmentID AND MouldID = @MouldID;

//         INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Genealogy]
//         VALUES (@MouldID, @CurrentMouldLife, @ParameterID, @ParameterValue, GETDATE());

//         UPDATE [PPMS_LILBawal].[dbo].[CONFIG_MOULD]
//         SET MouldStatus = @MouldStatus, LastUpdatedTime = GETDATE()
//         WHERE MouldID = @MouldID;
//       `);
//     } else {
//       // 🔹 Insert new record
//       await dbReq.query(`
//         INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Monitoring]
//         VALUES (@EquipmentID, @MouldID, @MouldActualLife, @HealthCheckThreshold, @NextPMDue, @PMWarning,
//                 NULL, NULL, @HealthCheckDue, @HealthCheckWarning, NULL, NULL,
//                 @MouldLifeStatus, @MouldPMStatus, @MouldHealthStatus, @MouldStatus, GETDATE());

//         INSERT INTO [PPMS_LILBawal].[dbo].[Mould_EquipmentLog]
//         VALUES (@MouldID, @EquipmentID, @MouldStatus, GETDATE());

//         INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Genealogy]
//         VALUES (@MouldID, @CurrentMouldLife, @ParameterID, @ParameterValue, GETDATE());

//         UPDATE [PPMS_LILBawal].[dbo].[CONFIG_MOULD]
//         SET MouldStatus = @MouldStatus, LastUpdatedTime = GETDATE()
//         WHERE MouldID = @MouldID;
//       `);
//     }

//     // 🔹 Compute values for PLC
//     const a = Math.floor((NewMouldLife || 0) / 10000);
//     const b = a * 10000;
//     const ShotCount = (NewMouldLife || 0) - b;

//     const multiplierTag = `ac:PPMS_SolutionLIL/TotalMouldLife/Machine${StationID}/Multiplier`;
//     const shotCountTag = `ac:PPMS_SolutionLIL/TotalMouldLife/Machine${StationID}/ShotCount`;

//     const timestamp = new Date().toISOString();
//     const credentials = base64.encode("Chelsy:Dalisoft@123");

//     const tagPayloads = [
//       { pointName: multiplierTag, timestamp, quality: 9, value: a },
//       { pointName: shotCountTag, timestamp, quality: 9, value: ShotCount }
//     ];

//     // 🔹 Write to PLC
//     const apiResponse = await axios.post(
//       "http://DESKTOP-T266BV5/ODataConnector/rest/RealtimeData/Write",
//       tagPayloads,
//       {
//         headers: {
//           Authorization: `Basic ${credentials}`,
//           "Content-Type": "application/json"
//         }
//       }
//     );

//     return middlewares.standardResponse(
//       res,
//       {
//         updatedTags: tagPayloads,
//         apiResponse: apiResponse.data,
//       },
//       200,
//       "Mould data and tag values updated successfully"
//     );
//   } catch (err) {
//     console.error("❌ Error executing query:", err);
//     return middlewares.standardResponse(res, null, 500, "Error occurred while updating mould data: " + err.message);
//   }
// });
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
    return middlewares.standardResponse(res, null, 400, "Missing required fields: EquipmentID or MouldID");
  }

  try {
    // 🔹 Get StationID & EquipmentName
    const getStationReq = new sqlConnection.sql.Request();
    getStationReq.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
    const stationResult = await getStationReq.query(`
      SELECT StationID, EquipmentName
      FROM [PPMS_LILBawal].[dbo].[Config_Equipment]
      WHERE EquipmentID = @EquipmentID
    `);

    const StationID = stationResult.recordset.length ? stationResult.recordset[0].StationID : 1;
    const EquipmentName = stationResult.recordset.length ? stationResult.recordset[0].EquipmentName : "";

    // 🔹 Check if record exists
    const checkReq = new sqlConnection.sql.Request();
    checkReq.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
    checkReq.input("MouldID", sqlConnection.sql.VarChar, MouldID);
    const checkResult = await checkReq.query(`
      SELECT COUNT(1) AS temp 
      FROM [PPMS_LILBawal].[dbo].[Mould_Monitoring] 
      WHERE EquipmentID = @EquipmentID AND MouldID = @MouldID
    `);

    const exists = parseInt(checkResult.recordset[0].temp) > 0;
    const dbReq = new sqlConnection.sql.Request();

    // Common inputs
    dbReq.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
    dbReq.input("MouldID", sqlConnection.sql.VarChar, MouldID);
    dbReq.input("MouldStatus", sqlConnection.sql.Int, MouldStatus || 0);
    dbReq.input("MouldLifeStatus", sqlConnection.sql.Int, MouldLifeStatus || 0);
    dbReq.input("MouldActualLife", sqlConnection.sql.Int, MouldActualLife || 0);
    dbReq.input("NewMouldLife", sqlConnection.sql.Int, NewMouldLife || 0);
    dbReq.input("CurrentMouldLife", sqlConnection.sql.Int, CurrentMouldLife || 0);
    dbReq.input("ParameterID", sqlConnection.sql.Int, ParameterID || 0);
    dbReq.input("ParameterValue", sqlConnection.sql.Int, ParameterValue || 0);
    dbReq.input("HealthCheckThreshold", sqlConnection.sql.Int, HealthCheckThreshold || 0);
    dbReq.input("NextPMDue", sqlConnection.sql.Int, NextPMDue || 0);
    dbReq.input("PMWarning", sqlConnection.sql.Int, PMWarning || 0);
    dbReq.input("HealthCheckDue", sqlConnection.sql.Int, HealthCheckDue || 0);
    dbReq.input("HealthCheckWarning", sqlConnection.sql.Int, HealthCheckWarning || 0);
    dbReq.input("MouldPMStatus", sqlConnection.sql.Int, MouldPMStatus || 0);
    dbReq.input("MouldHealthStatus", sqlConnection.sql.Int, MouldHealthStatus || 0);

    if (exists) {
      // 🔹 Update existing record
      await dbReq.query(`
        UPDATE M
SET 
    M.MouldStatus = @MouldStatus,
    M.MouldLifeStatus = @MouldLifeStatus,
    M.MouldInstanceLife = D.Total_Shots,
    M.MouldCurrentLife = D.Total_Shots,
    M.LastUpdatedTime = GETDATE()
FROM [PPMS_LILBawal].[dbo].[Mould_Monitoring] M
LEFT JOIN [PPMS_LILBawal].[dbo].[Machine_Data] D
    ON M.EquipmentID COLLATE SQL_Latin1_General_CP1_CI_AS = D.Machine_ID COLLATE SQL_Latin1_General_CP1_CI_AS
    OR M.MouldID COLLATE SQL_Latin1_General_CP1_CI_AS = D.Mould_ID COLLATE SQL_Latin1_General_CP1_CI_AS
WHERE M.EquipmentID = @EquipmentID 
  AND M.MouldID = @MouldID;

  INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Genealogy]
        VALUES (@MouldID, @CurrentMouldLife, @ParameterID, @ParameterValue, GETDATE());

UPDATE [PPMS_LILBawal].[dbo].[CONFIG_MOULD]
SET 
    MouldStatus = @MouldStatus, 
    LastUpdatedTime = GETDATE()
WHERE MouldID = @MouldID;

      `);
    } else {
      // 🔹 Insert new record
      await dbReq.query(`
        INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Monitoring]
        VALUES (@EquipmentID, @MouldID, @MouldActualLife, @HealthCheckThreshold, @NextPMDue, @PMWarning,
                NULL, NULL, @HealthCheckDue, @HealthCheckWarning, NULL, NULL,
                @MouldLifeStatus, @MouldPMStatus, @MouldHealthStatus, @MouldStatus, GETDATE());

        INSERT INTO [PPMS_LILBawal].[dbo].[Mould_EquipmentLog]
        VALUES (@MouldID, @EquipmentID, @MouldStatus, GETDATE());

        INSERT INTO [PPMS_LILBawal].[dbo].[Mould_Genealogy]
        VALUES (@MouldID, @CurrentMouldLife, @ParameterID, @ParameterValue, GETDATE());

        UPDATE [PPMS_LILBawal].[dbo].[CONFIG_MOULD]
        SET MouldStatus = @MouldStatus, LastUpdatedTime = GETDATE()
        WHERE MouldID = @MouldID;
      `);
    }
// 🔹 Call the Stored Procedure after update/insert
    const spReq = new sqlConnection.sql.Request();
    spReq.input("MouldID", sqlConnection.sql.NVarChar, MouldID);
    spReq.input("EquipmentID", sqlConnection.sql.NVarChar, EquipmentID);
    await spReq.execute("[dbo].[ShiftEvent_MachineDataUpdate]");
    console.log("✅ Called Stored Procedure ShiftEvent_MachineDataUpdate");
    // 🔹 Skip PLC Tag Update for Shibura Machines
    if (EquipmentName && EquipmentName.includes("Shibaura")) {
      return middlewares.standardResponse(
        res,
        { updatedTags: [], apiResponse: null, EquipmentName },
        200,
        "Mould data updated successfully (with conditional tag write)"
      );
    }

    // 🔹 Compute values for PLC
    const a = Math.floor((NewMouldLife || 0) / 10000);
    const b = a * 10000;
    const ShotCount = (NewMouldLife || 0) - b;

    const multiplierTag = `ac:PPMS_SolutionLIL/TotalMouldLife/Machine${StationID}/Multiplier`;
    const shotCountTag = `ac:PPMS_SolutionLIL/TotalMouldLife/Machine${StationID}/ShotCount`;

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
        EquipmentName
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
