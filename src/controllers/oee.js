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

// fetch the oee details
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
        FROM Config_Equipment
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
        FROM Perf_Downtime PD
        JOIN Config_LossCategory CL ON PD.LossID = CL.LossID
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

//---------call log
router.post('/logCall', async (req, res) => {
  const { EquipmentName, DepartmentName } = req.body;

  if (!EquipmentName || !DepartmentName) {
    return res.status(400).json({ message: 'EquipmentName and DepartmentName are required.' });
  }

  try {
    const request = new sql.Request();

    // Step 1: Get StationID from EquipmentName
    const stationResult = await request
      .input('EquipmentName', sql.VarChar, EquipmentName)
      .query(`SELECT TOP 1 StationID FROM Config_Equipment WHERE EquipmentName = @EquipmentName`);

    if (stationResult.recordset.length === 0) {
      return res.status(404).json({ message: 'StationID not found for the given EquipmentName.' });
    }

    const StationID = stationResult.recordset[0].StationID;

    // Step 2: Get DepartmentID from DepartmentName
    const deptResult = await request
      .input('DepartmentName', sql.VarChar, DepartmentName)
      .query(`SELECT TOP 1 DepartmentID FROM Config_Department WHERE DepartmentName = @DepartmentName`);

    if (deptResult.recordset.length === 0) {
      return res.status(404).json({ message: 'DepartmentID not found for the given DepartmentName.' });
    }

    const DepartmentID = deptResult.recordset[0].DepartmentID;

    // Step 3: Call the stored procedure
    const callLogRequest = new sql.Request();
    callLogRequest.input('StationID', sql.Int, StationID);
    callLogRequest.input('DepartmentID', sql.Int, DepartmentID);

    await callLogRequest.execute('Prod_Call_Logging');

    return res.status(200).json({ message: 'Call logging successful.' });
  } catch (error) {
    console.error('Error executing Prod_Call_Logging:', error);
    return res.status(500).json({ message: 'Internal server error.', error });
  }
});

//get the call which is not ended

// routes/oeeRoutes.js or similar
router.get('/activeCall/:equipmentName', async (req, res) => {
  const { equipmentName } = req.params;

  try {
    const request = new sqlConnection.sql.Request();
    request.input('EquipmentName', sqlConnection.sql.VarChar, equipmentName);

    const result = await request.query(`
      SELECT 
          pcl.UID,
          pcl.LineID,
          pcl.StationID,
          pcl.ProdDate,
          pcl.ProdShift,
          pcl.DepartmentID,
          pcl.StartTime,
          pcl.EndTime,
          pcl.CallDuration,
          pcl.CallStatus
      FROM Prod_Call_Log pcl
      JOIN Config_Station cs ON pcl.StationID = cs.StationID
      JOIN Config_Equipment ce ON ce.StationID = cs.StationID
      WHERE ce.EquipmentName = @EquipmentName
        AND pcl.EndTime IS NULL
      ORDER BY pcl.StartTime DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching active calls by equipment:", error);
    return res.status(500).json({ message: 'Error fetching active calls', error });
  }
});



//Fetch the Empty reason count 



// router.get('/unassigned-ReworkReason-count/:LineID', async (req, res) => {
//   const lineId = parseInt(req.params.LineID);

//   if (isNaN(lineId)) {
//     return res.status(400).json({ error: 'Invalid or missing LineID parameter' });
//   }

//   try {
//     await sql.connect(config);

//     const result = await new sql.Request()
//       .input('LineID', sql.Int, lineId)
//       .query(`
//        SELECT COUNT(*) AS UnassignedReworkCount
// FROM [PPMS].[dbo].[Rework_Genealogy]
// WHERE LineID = @LineID
//   AND (Reason IS NULL OR Reason = '')
//       `);

//     res.status(200).json({ count: result.recordset[0].UnassignedReworkCount });
//   } catch (error) {
//     console.error('Database error:', error);
//     res.status(500).json({ error: 'Internal server error', details: error.message });
//   }
// });

  

module.exports = router;
