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
        sqlRequest.input("EquipmentID", sqlConnection.sql.Int, EquipmentID);

        const query = `
            -- Get the StationID for the given EquipmentID
            DECLARE @StationID INT;

            SELECT @StationID = StationID
            FROM PPMS_LILBawal.dbo.Config_Equipment
            WHERE EquipmentID = @EquipmentID;

            -- If StationID found, get Downtime Details
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
                sl.SubLossName
            FROM PPMS_LILBawal.dbo.Perf_Downtime d
            LEFT JOIN Config_LossCategory l ON d.LossID = l.LossID
            LEFT JOIN Config_SubLossCategory sl ON d.SubLossID = sl.SubLossID
            WHERE d.StationID = @StationID;
        `;

        const result = await sqlRequest.query(query);
        return middlewares.standardResponse(response, result.recordset, 200, "Success");
    } catch (err) {
        console.error("Query Error:", err);
        return middlewares.standardResponse(response, null, 500, "Error executing query: " + err);
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
        sqlRequest.input("EquipmentID", sqlConnection.sql.Int, EquipmentID);

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
                sl.SubLossName
            FROM PPMS_LILBawal.dbo.Perf_Downtime d
            LEFT JOIN Config_LossCategory l ON d.LossID = l.LossID
            LEFT JOIN Config_SubLossCategory sl ON d.SubLossID = sl.SubLossID
            WHERE 
                d.StationID = @StationID
                AND (d.LossID IS NULL OR d.LossID = 0 OR d.SubLossID IS NULL OR d.SubLossID = 0);
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
        const { DowntimeID, LossName, SubLossName, Reason } = request.body;

        if (!DowntimeID || !LossName || !SubLossName || !Reason) {
            return middlewares.standardResponse(response, null, 400, "DowntimeID, LossName, SubLossName, and Reason are required");
        }

        const sqlRequest = new sqlConnection.sql.Request();

        // Get LossID dynamically
        sqlRequest.input("LossName", sqlConnection.sql.VarChar, LossName);
        const lossQuery = await sqlRequest.query(`SELECT LossID FROM Config_LossCategory WHERE LossName = @LossName`);
        if (lossQuery.recordset.length === 0) {
            return middlewares.standardResponse(response, null, 404, "LossName not found in Config_LossCategory");
        }
        const LossID = lossQuery.recordset[0].LossID;

        // Get SubLossID dynamically
        sqlRequest.input("SubLossName", sqlConnection.sql.VarChar, SubLossName);
        const subLossQuery = await sqlRequest.query(`SELECT SubLossID FROM Config_SubLossCategory WHERE SubLossName = @SubLossName`);
        if (subLossQuery.recordset.length === 0) {
            return middlewares.standardResponse(response, null, 404, "SubLossName not found in Config_SubLossCategory");
        }
        const SubLossID = subLossQuery.recordset[0].SubLossID;

        // Update Perf_Downtime table
        sqlRequest.input("DowntimeID", sqlConnection.sql.Int, DowntimeID);
        sqlRequest.input("LossID", sqlConnection.sql.Int, LossID);
        sqlRequest.input("SubLossID", sqlConnection.sql.Int, SubLossID);
        sqlRequest.input("Reason", sqlConnection.sql.VarChar, Reason);

        const updateQuery = `
            UPDATE Perf_Downtime 
            SET 
                LossID = @LossID, 
                SubLossID = @SubLossID, 
                Reason = @Reason
            WHERE DowntimeID = @DowntimeID;
        `;

        await sqlRequest.query(updateQuery);

        middlewares.standardResponse(response, null, 200, "Downtime details updated successfully");
    } catch (err) {
        middlewares.standardResponse(response, null, 500, "Error updating downtime details: " + err.message);
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
