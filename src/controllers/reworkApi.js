const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");
const { sql, config } = require('../databases/ssmsConn.js');

const router = express.Router();



// GET Rework data by EquipmentID from Rework_Genealogy table
router.get('/ReworkGenelogy/:EquipmentID', (request, response) => {
  const EquipmentID = parseInt(request.params.EquipmentID);

  if (isNaN(EquipmentID)) {
    return middlewares.standardResponse(response, null, 400, 'Invalid EquipmentID');
  }

  const query = `
   SELECT 
      RG.UID,
      RG.EquipmentID,
      CE.EquipmentName,
      RG.UserID,
      CU.UserName,
      RG.ProdDate,
      RG.ProdShift,
      RG.NOKQuantity,
      RG.Reason,
      RG.Remark,
	  MM.MouldID,
	  MM.MouldName
    FROM [Rework_Genealogy] RG
    LEFT JOIN [Config_User] CU ON RG.UserID = CU.UserID
    LEFT JOIN [Config_Equipment] CE ON RG.EquipmentID = CE.EquipmentID
    LEFT JOIN [Mould_MachineMatrix] MM ON RG.EquipmentID = MM.EquipmentID 
    WHERE RG.EquipmentID = @EquipmentID AND MM.validationStatus = 1
    ORDER BY RG.UID DESC
  `;

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input('EquipmentID', sqlConnection.sql.Int, EquipmentID);

  sqlRequest.query(query, (err, result) => {
    if (err) {
      middlewares.standardResponse(response, null, 500, 'Error executing query: ' + err);
    } else {
      middlewares.standardResponse(response, result.recordset, 200, 'Success');
    }
  });
});



  //get Rework reasons 
  router.get("/ReworkReason", (request, response) => {
      new sqlConnection.sql.Request().query(
        `select * from [Config_ReworkReason]`,
        (err, result) => {
          if (err) {
            middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
          } else {
            middlewares.standardResponse(response, result.recordset, 200, "success");
          }
        }
      );
    });
  


  
//--------get the qty's---
 router.get("/CycleSummary", async (request, response) => {
  const { ProdDate, ProdShift, EquipmentID } = request.query;

  if (!ProdDate || !ProdShift || !EquipmentID) {
    return middlewares.standardResponse(response, null, 400, "Missing required parameters: ProdDate, ProdShift, EquipmentID");
  }

  try {
    // Connect to SQL if not already connected
    await sqlConnection.sql.connect(config);

    // Step 1: Get StationID from Config_Station based on EquipmentID (assumed in Token)
    const stationResult = await new sqlConnection.sql.Request()
      .input('EquipmentID', sqlConnection.sql.VarChar, EquipmentID)
      .query(`
        SELECT StationID 
        FROM [PPMS_LILBawal].[dbo].[Config_Equipment]
        WHERE EquipmentID = @EquipmentID
      `);

    if (stationResult.recordset.length === 0) {
      return middlewares.standardResponse(response, null, 404, "No StationID found for the given EquipmentID");
    }

    const stationID = stationResult.recordset[0].StationID;

    // Step 2: Fetch latest production data for the StationID
    const productionResult = await new sqlConnection.sql.Request()
      .input('ProdDate', sqlConnection.sql.Date, ProdDate)
      .input('ProdShift', sqlConnection.sql.VarChar, ProdShift)
     .input('StationID', sqlConnection.sql.Int, stationID)
      .query(`
        SELECT TOP 1 
          TotalCount, 
          GoodPart, 
          RejectedCount
        FROM [PPMS_LILBawal].[dbo].[Perf_CycleTime]
        WHERE ProdDate = @ProdDate 
          AND ProdShift = @ProdShift 
          AND StationID = @StationID
        ORDER BY [Timestamp] DESC
      `);

    middlewares.standardResponse(response, productionResult.recordset, 200, "Success");

  } catch (err) {
    middlewares.standardResponse(response, null, 500, "Error executing query: " + err.message);
  }
});

//Update API
// // POST /rework/update-rework
// router.post('/update-rework-cycle-summary', async (req, res) => {
//   const { EquipmentName, MouldName,UserName, ProdDate, ProdShift, NOTOKQuantity, ReworkReason, Remark } = req.body;

//   if (!EquipmentName ||!MouldName || !UserName || !ProdDate || !ProdShift || !NOTOKQuantity || !ReworkReason) {
//     return middlewares.standardResponse(res, null, 400, "Missing required parameters");
//   }

//   try {
//     // Connect to SQL
//     await sqlConnection.sql.connect(config);

//     // Step 1: Get EquipmentID and StationID from EquipmentName
//     const equipResult = await new sqlConnection.sql.Request()
//       .input('EquipmentName', sqlConnection.sql.NVarChar, EquipmentName)
//       .query(`
//         SELECT EquipmentID, StationID 
//         FROM [PPMS_LILBawal].[dbo].[Config_Equipment] 
//         WHERE EquipmentName = @EquipmentName
//       `);

//     if (equipResult.recordset.length === 0) {
//       return middlewares.standardResponse(res, null, 404, "Equipment not found");
//     }

//     const { EquipmentID, StationID } = equipResult.recordset[0];

//     // Step 2: Call stored procedure to update rework
//     await new sqlConnection.sql.Request()
//       .input('EquipmentID', sqlConnection.sql.Int, EquipmentID)
//       .input('UserID', sqlConnection.sql.NVarChar, UserName)
//       .input('ProdDate', sqlConnection.sql.Date, ProdDate)
//       .input('ProdShift', sqlConnection.sql.NVarChar(10), ProdShift)
//       .input('NOTOKQuantity', sqlConnection.sql.Int, NOTOKQuantity)
//       .input('ReworkReason', sqlConnection.sql.NVarChar(255), ReworkReason)
//       .input('Remark', sqlConnection.sql.NVarChar(1000), Remark)
//       .input('MouldName', sqlConnection.sql.NVarChar(255), MouldName)
//       .execute('RejectedUpdateWithReworkGenealogy');

//     // Step 3: Fetch latest CycleSummary
//     const cycleResult = await new sqlConnection.sql.Request()
//       .input('ProdDate', sqlConnection.sql.Date, ProdDate)
//       .input('ProdShift', sqlConnection.sql.VarChar, ProdShift)
//       .input('StationID', sqlConnection.sql.Int, StationID)
//       .query(`
//         SELECT TOP 1 
//           TotalCount, 
//           GoodPart, 
//           RejectedCount
//         FROM [PPMS_LILBawal].[dbo].[Perf_CycleTime]
//         WHERE ProdDate = @ProdDate 
//           AND ProdShift = @ProdShift 
//           AND StationID = @StationID
//         ORDER BY [Timestamp] DESC
//       `);

//     return middlewares.standardResponse(
//       res,
//       cycleResult.recordset[0] || {},
//       200,
//       "Rework updated and cycle summary fetched successfully"
//     );

//   } catch (error) {
//     console.error('Error in update-rework-cycle-summary:', error);
//     return middlewares.standardResponse(res, null, 500, "Internal server error: " + error.message);
//   }
// });

// 📁 routes/mouldRoutes.js
router.get("/getValidatedMoulds/:EquipmentName", async (req, res) => {
  const { EquipmentName } = req.params;

  if (!EquipmentName) {
    return middlewares.standardResponse(res, null, 400, "Missing EquipmentName parameter");
  }

  try {
    const request = new sqlConnection.sql.Request();

    // ✅ SQL Query: fetch moulds for that EquipmentName where ValidationStatus = 1 or 4 and MLossID = 5
    const query = `
      SELECT 
          [UID],
          [EquipmentName],
          [EquipmentID],
          [MouldName],
          [MouldID]
      FROM [PPMS_LILBawal].[dbo].[Mould_MachineMatrix]
      WHERE EquipmentName = @EquipmentName
        AND ValidationStatus = 1
      ORDER BY MouldName;
    `;

    request.input("EquipmentName", sqlConnection.sql.NVarChar, EquipmentName);

    const result = await request.query(query);

    middlewares.standardResponse(res, result.recordset, 200, "Validated moulds fetched successfully");
  } catch (err) {
    console.error("❌ Error fetching validated moulds:", err);
    middlewares.standardResponse(res, null, 500, "Error executing query: " + err.message);
  }
});


// 📁 routes/reworkRoutes.js

router.post('/update-rework-cycle-summary', async (req, res) => {
  const { EquipmentName, MouldName, UserName, ProdDate, ProdShift, NOTOKQuantity, ReworkReason, Remark } = req.body;

  // 1️⃣ Validate required fields
  if (!EquipmentName || !MouldName || !UserName || !ProdDate || !ProdShift || !NOTOKQuantity || !ReworkReason) {
    return middlewares.standardResponse(res, null, 400, "Missing required parameters");
  }

  try {
    await sqlConnection.sql.connect(config);

    // 2️⃣ Get EquipmentID & StationID from EquipmentName
    const equipResult = await new sqlConnection.sql.Request()
      .input('EquipmentName', sqlConnection.sql.NVarChar, EquipmentName)
      .query(`
        SELECT EquipmentID, StationID 
        FROM [PPMS_LILBawal].[dbo].[Config_Equipment] 
        WHERE EquipmentName = @EquipmentName
      `);

    if (equipResult.recordset.length === 0) {
      return middlewares.standardResponse(res, null, 404, "Equipment not found");
    }

    const { EquipmentID, StationID } = equipResult.recordset[0];

    // 3️⃣ Get MouldID from Mould_MachineMatrix
    const mouldResult = await new sqlConnection.sql.Request()
      .input('EquipmentID', sqlConnection.sql.NVarChar, EquipmentID)
      .input('MouldName', sqlConnection.sql.NVarChar, MouldName)
      .query(`
        SELECT TOP 1 MouldID 
        FROM [PPMS_LILBawal].[dbo].[Mould_MachineMatrix]
        WHERE EquipmentID = @EquipmentID AND MouldName = @MouldName
      `);

    if (mouldResult.recordset.length === 0) {
      return middlewares.standardResponse(res, null, 404, "Mould not found for this equipment");
    }

    const { MouldID } = mouldResult.recordset[0];

    // 4️⃣ Call Stored Procedure for Update
    await new sqlConnection.sql.Request()
      .input('EquipmentID', sqlConnection.sql.NVarChar, EquipmentID)
      .input('UserID', sqlConnection.sql.NVarChar, UserName)
      .input('ProdDate', sqlConnection.sql.Date, ProdDate)
      .input('ProdShift', sqlConnection.sql.NVarChar(10), ProdShift)
      .input('NOTOKQuantity', sqlConnection.sql.Int, NOTOKQuantity)
      .input('ReworkReason', sqlConnection.sql.NVarChar(200), ReworkReason)
      .input('Remark', sqlConnection.sql.NVarChar(200), Remark)
      .input('MouldID', sqlConnection.sql.NVarChar(100), MouldID)
      .execute('RejectedUpdateWithReworkGenealogy');

    // 5️⃣ Fetch updated cycle summary
    const cycleResult = await new sqlConnection.sql.Request()
      .input('ProdDate', sqlConnection.sql.Date, ProdDate)
      .input('ProdShift', sqlConnection.sql.VarChar, ProdShift)
      .input('StationID', sqlConnection.sql.Int, StationID)
      .query(`
        SELECT TOP 1 
          TotalCount, 
          GoodPart, 
          RejectedCount
        FROM [PPMS_LILBawal].[dbo].[Perf_CycleTime]
        WHERE ProdDate = @ProdDate 
          AND ProdShift = @ProdShift 
          AND StationID = @StationID
        ORDER BY [Timestamp] DESC
      `);

    return middlewares.standardResponse(
      res,
      cycleResult.recordset[0] || {},
      200,
      "Rework update successful and cycle summary fetched"
    );

  } catch (error) {
    console.error("❌ Error in update-rework-cycle-summary:", error);
    return middlewares.standardResponse(res, null, 500, "Internal server error: " + error.message);
  }
});

module.exports = router;


