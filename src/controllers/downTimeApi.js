const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

//get lossID 
router.get("/loss", (request, response) => {
    new sqlConnection.sql.Request().query(
      `select LossID , LossName from [Config_LossCategory]`,
      (err, result) => {
        if (err) {
          middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
        } else {
          middlewares.standardResponse(response, result.recordset, 200, "success");
        }
      }
    );
  });

  //get lossID 
router.get("/loss4M", (request, response) => {
    new sqlConnection.sql.Request().query(
      `select [4MLossID] , [4MLossName] from [Config_4M_LossCategory]`,
      (err, result) => {
        if (err) {
          middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
        } else {
          middlewares.standardResponse(response, result.recordset, 200, "success");
        }
      }
    );
  });

  //Get all SubLoss
  router.get("/Subloss/LossName", (request, response) => {
    const { LossName } = request.query; 
    if (!LossName) {
        return middlewares.standardResponse(response, null, 400, "LossName is required");
    }

    const sqlRequest = new sqlConnection.sql.Request();
    sqlRequest.input("LossName", sqlConnection.sql.VarChar, LossName);
    sqlRequest.query(
      `select s.SubLossID , s.SubLossName , l.LossName , l.LossID from [Config_SubLossCategory] s
      JOIN Config_LossCategory l ON s.LossID = l.LossID
      `,
      (err, result) => {
        if (err) {
          middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
        } else {
          middlewares.standardResponse(response, result.recordset, 200, "success");
        }
      }
    );
  });

// Get all lines
router.get("/Lines", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT LineID, LineName FROM Config_Line`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});



//get api to show all dowmtimes
router.get("/Getdowntime/details/:EquipmentID", async (request, response) => {
  const { EquipmentID } = request.params;

  if (!EquipmentID) {
    return middlewares.standardResponse(response, null, 400, "EquipmentID is required");
  }

  try {
    const sqlRequest = new sqlConnection.sql.Request();

    // ✅ FIX: Use VarChar instead of Int
    sqlRequest.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);

    const query = `
      DECLARE @StationID INT;

      SELECT @StationID = StationID
      FROM PPMS_LILBawal.dbo.Config_Equipment
      WHERE EquipmentID = @EquipmentID;

      SELECT 
          d.DowntimeID,
          d.StationID,
          d.ProdDate,
          d.ProdShift,
          d.StartTime,
          d.EndTime,
          d.SystemDownTime,
          d.PLCDownTime,
          d.LossID,
          d.Reason,
          l.LossName,
          d.SubLossID,
          d.[4MLossID],
          l4.[4MLossName],
          sl.SubLossName
      FROM PPMS_LILBawal.dbo.Perf_Downtime d
      LEFT JOIN Config_LossCategory l ON d.LossID = l.LossID
      LEFT JOIN Config_SubLossCategory sl ON d.SubLossID = sl.SubLossID
      LEFT JOIN Config_4M_LossCategory l4 ON d.[4MLossID] = l4.[4MLossID]
      WHERE d.StationID = @StationID;
    `;

    const result = await sqlRequest.query(query);

    // ✅ handle empty result gracefully
    if (!result.recordset || result.recordset.length === 0) {
      return middlewares.standardResponse(response, [], 200, "No records found for given EquipmentID");
    }

    return middlewares.standardResponse(response, result.recordset, 200, "Success");
  } catch (err) {
    console.error("Query Error:", err);
    return middlewares.standardResponse(response, null, 500, "Error executing query: " + err.message);
  }
});

// API to show the unassigned dt for dt screeen table
router.get("/Getdowntime/unassigned/:EquipmentID", async (request, response) => {
    const { EquipmentID } = request.params;

    if (!EquipmentID) {
        return middlewares.standardResponse(response, null, 400, "EquipmentID is required");
    }

    try {
        const sqlRequest = new sqlConnection.sql.Request();
        sqlRequest.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);

        const query = `
            -- Get the StationID for the given EquipmentID
            DECLARE @StationID INT;

            SELECT @StationID = StationID
            FROM PPMS_LILBawal.dbo.Config_Equipment
            WHERE EquipmentID = @EquipmentID;

            -- If StationID found, get only UNASSIGNED Downtime Details
            SELECT 
                d.DowntimeID,
                d.StationID,
                d.ProdDate,
                d.ProdShift,
                d.StartTime,
                d.EndTime,
                d.SystemDownTime,
                d.PLCDownTime,
                d.LossID,
                d.Reason,
                l.LossName,
                d.SubLossID,
                d.[4MLossID],
                l4.[4MLossName],
                sl.SubLossName
            FROM PPMS_LILBawal.dbo.Perf_Downtime d
            LEFT JOIN Config_LossCategory l ON d.LossID = l.LossID
            LEFT JOIN Config_SubLossCategory sl ON d.SubLossID = sl.SubLossID
             LEFT JOIN Config_4M_LossCategory l4 ON d.[4MLossID] = l4.[4MLossID]
            WHERE 
                d.StationID = @StationID
                AND (d.LossID IS NULL OR d.LossID = 0 OR d.SubLossID IS NULL OR d.SubLossID = 0)
                or (d.[4MLossID] IS NULL OR d.[4MLossID] = 5 );
        `;

        const result = await sqlRequest.query(query);
        return middlewares.standardResponse(response, result.recordset, 200, "Success");
    } catch (err) {
        console.error("Query Error:", err);
        return middlewares.standardResponse(response, null, 500, "Error executing query: " + err);
    }
});




// Update downtime details: Reason, LossName, SubLossName
// ✅ Update downtime details: Reason, LossName, SubLossName, 4MLossName
// ✅ Update downtime details: Reason, LossName, SubLossName, 4MLossName
router.put("/downtime/update", async (request, response) => {
  try {
    console.log("Received body:", request.body); // Debug log

    const { DowntimeID, LossName, SubLossName, LossName4M, Reason } = request.body;

    // ✅ Validate request body
    if (!DowntimeID || !LossName || !SubLossName || !LossName4M || !Reason) {
      return middlewares.standardResponse(
        response,
        null,
        400,
        "DowntimeID, LossName, SubLossName, LossName4M, and Reason are required"
      );
    }

    // ✅ Create new SQL request for isolation
    const sqlRequest = new sqlConnection.sql.Request();

    // 1️⃣ Get LossID dynamically
    sqlRequest.input("LossName", sqlConnection.sql.VarChar, LossName.trim());
    const lossQuery = await sqlRequest.query(`
      SELECT LossID FROM Config_LossCategory WHERE LossName = @LossName
    `);
    if (lossQuery.recordset.length === 0) {
      return middlewares.standardResponse(response, null, 404, "LossName not found in Config_LossCategory");
    }
    const LossID = lossQuery.recordset[0].LossID;

    // 2️⃣ Get SubLossID dynamically
    const subLossRequest = new sqlConnection.sql.Request();
    subLossRequest.input("SubLossName", sqlConnection.sql.VarChar, SubLossName.trim());
    const subLossQuery = await subLossRequest.query(`
      SELECT SubLossID FROM Config_SubLossCategory WHERE SubLossName = @SubLossName
    `);
    if (subLossQuery.recordset.length === 0) {
      return middlewares.standardResponse(response, null, 404, "SubLossName not found in Config_SubLossCategory");
    }
    const SubLossID = subLossQuery.recordset[0].SubLossID;

    // 3️⃣ Get 4MLossID dynamically
    const loss4MRequest = new sqlConnection.sql.Request();
    loss4MRequest.input("LossName4M", sqlConnection.sql.VarChar, LossName4M.trim());
    const loss4MQuery = await loss4MRequest.query(`
      SELECT [4MLossID] FROM Config_4M_LossCategory WHERE [4MLossName] = @LossName4M
    `);
    if (loss4MQuery.recordset.length === 0) {
      return middlewares.standardResponse(response, null, 404, "4MLossName not found in Config_4M_LossCategory");
    }
    const LossID4M = loss4MQuery.recordset[0]["4MLossID"];

    // 4️⃣ Update Perf_Downtime table
    const updateRequest = new sqlConnection.sql.Request();
    updateRequest.input("DowntimeID", sqlConnection.sql.Int, DowntimeID);
    updateRequest.input("LossID", sqlConnection.sql.Int, LossID);
    updateRequest.input("SubLossID", sqlConnection.sql.Int, SubLossID);
    updateRequest.input("LossID4M", sqlConnection.sql.Int, LossID4M);
    updateRequest.input("Reason", sqlConnection.sql.VarChar, Reason.trim());

    const updateQuery = `
      UPDATE Perf_Downtime 
      SET 
        LossID = @LossID, 
        SubLossID = @SubLossID, 
        [4MLossID] = @LossID4M,
        Reason = @Reason
      WHERE DowntimeID = @DowntimeID;
    `;

    await updateRequest.query(updateQuery);

    return middlewares.standardResponse(
      response,
      null,
      200,
      "Downtime details (including 4M Loss) updated successfully"
    );

  } catch (err) {
    console.error("Error in /downtime/update:", err);
    middlewares.standardResponse(
      response,
      null,
      500,
      "Error updating downtime details: " + err.message
    );
  }
});

// GET downtime details based on LineName
// router.get("/downtime/trend/LineName", (req, res) => {
//   const { LineName, prodDate } = req.query;

//   if (!LineName || !prodDate) {
//     return middlewares.standardResponse(res, null, 400, "Missing required parameters: LineName or prodDate");
//   }

//   const sqlRequest = new sqlConnection.sql.Request();
//   sqlRequest.input("LineName", sqlConnection.sql.VarChar, LineName);
//   sqlRequest.input("ProdDate", sqlConnection.sql.Date, prodDate);

//   const query = `
//     SELECT 
//       o.StationID,
//       o.TotalDownTime,
//       o.ProdDate,
//       DATEPART(HOUR, o.[Timestamp]) AS Hour,
//       c.LineName
//     FROM 
//       [Perf_CycleTime] o 
//     JOIN Config_Station s ON o.StationID = s.StationID
//     JOIN Config_Line c ON s.LineID = c.LineID
//     WHERE 
//       c.LineName = @LineName
//       AND CAST(o.ProdDate AS DATE) = @ProdDate
//     GROUP BY 
//       o.StationID,
//       o.TotalDownTime,
//       o.ProdDate,
//       DATEPART(HOUR, o.[Timestamp]),
//       c.LineName
//     ORDER BY 
//       Hour;
//   `;

//   sqlRequest.query(query, (err, result) => {
//     if (err) {
//       console.error("Query Error:", err);
//       return middlewares.standardResponse(res, null, 500, "Error executing query: " + err);
//     }
//     middlewares.standardResponse(res, result.recordset, 200, "Success");
//   });
// });


module.exports = router;
