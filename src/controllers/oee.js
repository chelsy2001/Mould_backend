const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
//const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");
const { sql, config } = require('../databases/ssmsConn.js');

const router = express.Router();
 


router.get("/ProdDate/Shift", (request, response) => {
    new sqlConnection.sql.Request().query(
      `SELECT TOP 1 ProdDate, ShiftName
      FROM [Prod_ShiftInformation]
      ORDER BY ProdDate DESC, ShiftName DESC`,
      (err, result) => {
        if (err) {
          middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
        } else {
          middlewares.standardResponse(response, result.recordset, 200, "success");
        }
      }
    );
  });
//-----------------get the lineid by linename----
//   router.get("/getLineID/:LineName", (request, response) => {
//   const lineName = request.params.LineName;

//   new sqlConnection.sql.Request()
//     .input("LineName", sqlConnection.sql.VarChar, lineName)
//     .query("SELECT LineID FROM Config_Line WHERE LineName = @LineName", (err, result) => {
//       if (err) {
//         middlewares.standardResponse(response, null, 300, "Error fetching LineID: " + err);
//       } else if (result.recordset.length > 0) {
//         response.json({ LineID: result.recordset[0].LineID });
//       } else {
//         response.status(404).json({ message: "LineName not found" });
//       }
//     });
// });

//---------get the equipmentid by equipmentname----
router.get("/getEquipmentID/:EquipmentName", (request, response) => {
  const equipmentName = request.params.EquipmentName;

  new sqlConnection.sql.Request()
    .input("EquipmentName", sqlConnection.sql.VarChar, equipmentName)
    .query("SELECT EquipmentID FROM Config_Equipment WHERE EquipmentName = @EquipmentName", (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error fetching EquipmentID: " + err);
      } else if (result.recordset.length > 0) {
        response.json({ EquipmentID: result.recordset[0].EquipmentID });
      } else {
        response.status(404).json({ message: "EquipmentName not found" });
      }
    });
});


//Fetch the OEE Details based on lineid
// router.get("/OEEDetails/:EquipmentID", async (req, res) => {
//   const EquipmentID = parseInt(req.params.EquipmentID);

//   if (!EquipmentID) {
//     return res.status(400).json({ error: "Missing or invalid EquipmentID parameter" });
//   }

//   try {
//     await sql.connect(config);

//     const request = new sql.Request();
//     request.input("LineID", sql.Int, lineId);

//     const result = await request.execute("[PPMS].[dbo].[Dashboard_Perf_OEE_LineWise]");

//     res.status(200).json({
//       status: 200,
//       message: "success",
//       data: result.recordset
//     });
//   } catch (err) {
//     console.error("Error executing stored procedure:", err);
//     res.status(500).json({
//       status: 500,
//       message: "Internal server error",
//       error: err.message
//     });
//   }
// });
router.get("/OEEDetails/:EquipmentID", async (req, res) => {
  const EquipmentID = parseInt(req.params.EquipmentID);

  if (!EquipmentID) {
    return res.status(400).json({ error: "Missing or invalid EquipmentID parameter" });
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();

    // Step 1: Fetch StationID (or LineID) based on EquipmentID
    request.input("EquipmentID", sql.Int, EquipmentID);
    const stationResult = await request.query(`
      SELECT TOP 1 StationID, LineID
      FROM [PPMS_LILBawal].[dbo].[Config_Station]
      WHERE StationID IN (
        SELECT StationID
        FROM [PPMS_LILBawal].[dbo].[Config_Equipment]
        WHERE EquipmentID = @EquipmentID
      )
    `);

    if (stationResult.recordset.length === 0) {
      return res.status(404).json({ error: "No Station found for the given EquipmentID" });
    }

    const { StationID } = stationResult.recordset[0];

    // Step 2: Call the OEE stored procedure with LineID
    const oeeRequest = new sql.Request();
    oeeRequest.input("StationID", sql.Int, StationID); // Assuming the SP expects LineID

    const oeeResult = await oeeRequest.execute("[PPMS_LILBawal].[dbo].[Dashboard_Perf_OEE_StationWise]");

    res.status(200).json({
      status: 200,
      message: "success",
      data: oeeResult.recordset
    });
  } catch (err) {
    console.error("Error executing stored procedure:", err);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: err.message
    });
  }
});


  //Fetch the unassigned downtime count
// router.get('/unassigned-downtime-count/:LineID', async (req, res) => {
//   const lineId = parseInt(req.params.LineID);

//   if (isNaN(lineId)) {
//     return res.status(400).json({ error: 'Invalid or missing LineID parameter' });
//   }

//   try {
//     await sql.connect(config);

//     const result = await new sql.Request()
//       .input('LineID', sql.Int, lineId)
//       .query(`
//         SELECT COUNT(*) AS UnassignedDowntimeCount
//         FROM PPMS.dbo.Perf_Downtime PD
//         JOIN PPMS.dbo.Config_Station CS ON PD.StationID = CS.StationID
//         JOIN PPMS.dbo.Config_LossCategory CL ON PD.LossID = CL.LossID
//         WHERE CL.LossName = 'Unassigned'
//           AND (PD.Reason IS NULL OR PD.Reason = '')
//           AND CS.LineID = @LineID
//       `);

//     res.status(200).json({ count: result.recordset[0].UnassignedDowntimeCount });
//   } catch (error) {
//     console.error('Database error:', error);
//     res.status(500).json({ error: 'Internal server error', details: error.message });
//   }
// });

router.get('/unassigned-downtime-count/:EquipmentID', async (req, res) => {
  const equipmentId = parseInt(req.params.EquipmentID);

  if (isNaN(equipmentId)) {
    return res.status(400).json({ error: 'Invalid or missing EquipmentID parameter' });
  }

  try {
    await sql.connect(config);

    // Step 1: Get StationID from EquipmentID
    const stationResult = await new sql.Request()
      .input('EquipmentID', sql.Int, equipmentId)
      .query(`
        SELECT TOP 1 StationID
        FROM PPMS.dbo.Config_Equipment
        WHERE EquipmentID = @EquipmentID
      `);

    if (stationResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Station not found for the given EquipmentID' });
    }

    const stationId = stationResult.recordset[0].StationID;

    // Step 2: Fetch unassigned downtime count using StationID
    const result = await new sql.Request()
      .input('StationID', sql.Int, stationId)
      .query(`
        SELECT COUNT(*) AS UnassignedDowntimeCount
        FROM PPMS.dbo.Perf_Downtime PD
        JOIN PPMS.dbo.Config_LossCategory CL ON PD.LossID = CL.LossID
        WHERE CL.LossName = 'Unassigned'
          AND (PD.Reason IS NULL OR PD.Reason = '')
          AND PD.StationID = @StationID
      `);

    res.status(200).json({ count: result.recordset[0].UnassignedDowntimeCount });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


//Fetch the Empty reason count 



router.get('/unassigned-ReworkReason-count/:LineID', async (req, res) => {
  const lineId = parseInt(req.params.LineID);

  if (isNaN(lineId)) {
    return res.status(400).json({ error: 'Invalid or missing LineID parameter' });
  }

  try {
    await sql.connect(config);

    const result = await new sql.Request()
      .input('LineID', sql.Int, lineId)
      .query(`
       SELECT COUNT(*) AS UnassignedReworkCount
FROM [PPMS].[dbo].[Rework_Genealogy]
WHERE LineID = @LineID
  AND (Reason IS NULL OR Reason = '')
      `);

    res.status(200).json({ count: result.recordset[0].UnassignedReworkCount });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

  

module.exports = router;
