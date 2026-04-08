const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");
const { route } = require("./reworkApi.js");

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
//   router.get("/Subloss/LossName", (request, response) => {
//   const { LossName } = request.query;

//   if (!LossName) {
//     return middlewares.standardResponse(response, null, 400, "LossName is required");
//   }

//   const sqlRequest = new sqlConnection.sql.Request();
//   sqlRequest.input("LossName", sqlConnection.sql.VarChar, LossName);

//   sqlRequest.query(
//     `SELECT 
//         s.SubLossID, 
//         s.SubLossName, 
//         l.LossName, 
//         l.LossID 
//      FROM Config_SubLossCategory s
//      JOIN Config_LossCategory l 
//        ON s.LossID = l.LossID
//      WHERE l.LossName = @LossName`,   // ✅ filter added
//     (err, result) => {
//       if (err) {
//         middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
//       } else {
//         middlewares.standardResponse(response, result.recordset, 200, "success");
//       }
//     }
//   );
// });

router.get("/Subloss", (request, response) => {
  const { LossID } = request.query;

  if (!LossID) {
    return middlewares.standardResponse(response, null, 400, "LossID is required");
  }

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input("LossID", sqlConnection.sql.Int, LossID);

  sqlRequest.query(
    `SELECT 
        SubLossID, 
        SubLossName
     FROM Config_SubLossCategory
     WHERE LossID = @LossID`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error: " + err);
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
  const { page = 1 } = request.query;

  if (!EquipmentID) {
    return middlewares.standardResponse(response, null, 400, "EquipmentID is required");
  }

  try {
    const sqlRequest = new sqlConnection.sql.Request();

    sqlRequest.input("EquipmentID", sqlConnection.sql.VarChar, EquipmentID);
    sqlRequest.input("PageNumber", sqlConnection.sql.Int, parseInt(page));

    const query = `
      DECLARE @StationID INT;
      DECLARE @PageSize INT = 3000;

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
          d.PLCDownTime as Duration,
          d.TotalDownTime ,
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

      WHERE d.StationID = @StationID

      ORDER BY d.DowntimeID DESC
      OFFSET (@PageNumber - 1) * @PageSize ROWS
      FETCH NEXT @PageSize ROWS ONLY;
    `;

    const result = await sqlRequest.query(query);

    return middlewares.standardResponse(response, result.recordset, 200, "Success");

  } catch (err) {
    console.error("Query Error:", err);
    return middlewares.standardResponse(response, null, 500, "Error: " + err.message);
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

-- Get only UNASSIGNED Downtime Details with Shift Validation

SELECT Top 1000
    d.DowntimeID,
    d.StationID,
    d.ProdDate,
    d.ProdShift,
    d.StartTime,
    d.EndTime,
    d.SystemDownTime,
    d.PLCDownTime as Duration,
    d.TotalDownTime ,
    d.LossID,
    d.Reason,
    l.LossName,
    d.SubLossID,
    d.[4MLossID],
    l4.[4MLossName],
    sl.SubLossName
FROM PPMS_LILBawal.dbo.Perf_Downtime d

LEFT JOIN Config_LossCategory l 
    ON d.LossID = l.LossID

LEFT JOIN Config_SubLossCategory sl 
    ON d.SubLossID = sl.SubLossID

LEFT JOIN Config_4M_LossCategory l4 
    ON d.[4MLossID] = l4.[4MLossID]

-- Validate Shift & Date
INNER JOIN PPMS_LILBawal.dbo.Prod_ShiftInformation psi
    ON d.ProdDate = psi.ProdDate
    AND d.ProdShift = psi.ShiftName

WHERE 
    d.StationID = @StationID
    AND (
        d.LossID IS NULL OR d.LossID = 0 
        OR d.SubLossID IS NULL OR d.SubLossID = 0
        OR d.[4MLossID] IS NULL OR d.[4MLossID] = 5
    )
        order by d.LastUpdatedTime desc;
        `;

        const result = await sqlRequest.query(query);
        return middlewares.standardResponse(response, result.recordset, 200, "Success");
    } catch (err) {
        console.error("Query Error:", err);
        return middlewares.standardResponse(response, null, 500, "Error executing query: " + err);
    }
});




// Update downtime details: Reason, LossName, SubLossName

router.put("/downtime/update", async (request, response) => {
  try {
    console.log("Received body:", request.body);

    const { DowntimeID, LossName, SubLossName, Reason } = request.body;

    if (!DowntimeID || !LossName || !SubLossName) {
      return middlewares.standardResponse(
        response,
        null,
        400,
        "DowntimeID, LossID, SubLossID required"
      );
    }

    const updateRequest = new sqlConnection.sql.Request();

    await updateRequest
      .input("DowntimeID", sqlConnection.sql.Int, DowntimeID)
      .input("LossID", sqlConnection.sql.Int, LossName)        // ✅ directly ID
      .input("SubLossID", sqlConnection.sql.Int, SubLossName)  // ✅ directly ID
      .input("Reason", sqlConnection.sql.VarChar, Reason || "")

      .query(`
        UPDATE Perf_Downtime 
        SET 
          LossID = @LossID,
          SubLossID = @SubLossID,
          Reason = @Reason
        WHERE DowntimeID = @DowntimeID
      `);

    return middlewares.standardResponse(
      response,
      null,
      200,
      "✅ Updated successfully"
    );

  } catch (err) {
    console.error("Error in update:", err);
    return middlewares.standardResponse(
      response,
      null,
      500,
      err.message
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

router.post("/downtime/split", async (req, res) => {
  try {
    console.log("📥 Incoming Split Data:", req.body);

    const {
      DowntimeID,
      Duration,
      NewDuration,
      LossName1,
      SubLossName1,
      TPMSubLossName1,
      Reason1,
      LossName2,
      SubLossName2,
      TPMSubLossName2,
      Reason2
    } = req.body;

    if (!DowntimeID || !Duration || !NewDuration) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const request = new sqlConnection.sql.Request();

    await request
      .input("DowntimeID", sql.Int, DowntimeID)
      .input("Duration", sql.Int, Duration)
      .input("NewDuration", sql.Int, NewDuration)

      .input("LossName1", sql.Int, LossName1 || 0)
      .input("SubLossName1", sql.Int, SubLossName1 || 0)
      .input("TPMSubLossName1", sql.Int, TPMSubLossName1 || 0)
      .input("Reason1", sql.NVarChar, Reason1 || "")

      .input("LossName2", sql.Int, LossName2 || 0)
      .input("SubLossName2", sql.Int, SubLossName2 || 0)
      .input("TPMSubLossName2", sql.Int, TPMSubLossName2 || 0)
      .input("Reason2", sql.NVarChar, Reason2 || "")

      .execute("USP_UpdateDowntime123");

    res.json({
      success: true,
      message: "✅ Downtime split successfully"
    });

  } catch (err) {
    console.error("❌ Split API Error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
