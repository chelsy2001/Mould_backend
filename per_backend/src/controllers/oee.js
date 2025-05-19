const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// router.get("/OEE/LineName", async (req, res) => {
//   const { LineName, prodDate } = req.query;

//   if (!LineName || !prodDate) {
//     return middlewares.standardResponse(res, null, 400, "Missing required parameters: LineName or prodDate");
//   }

//   try {
//     const request = new sqlConnection.sql.Request();

//     // Set parameters from query
//     request.input("LineName", sql.VarChar, LineName);
//     request.input("ProdDate", sql.Date, prodDate); // Expected format: YYYY-MM-DD

//     const cleanNumber = (num) => (isNaN(num) || !isFinite(num) ? 0 : num);

//     const result = await request.query(`
//        SELECT 
//           o.LineID,
//           DATEPART(HOUR, o.[Timestamp]) AS Hour,
//     ROUND(AVG(o.Availability) * 100, 2) AS AvgAvailabilityPercent,
//     ROUND(AVG(o.Performance) * 100, 2) AS AvgPerformancePercent,
//     ROUND(AVG(o.Quality) * 100, 2) AS AvgQualityPercent,
//     ROUND(AVG(o.OLE) * 100, 2) AS AvgOLEPercent,
//           c.LineName
//         FROM 
//           [PPMS_Solution].[dbo].[Perf_Hourly_OLE] o
//         JOIN 
//           [PPMS_Solution].[dbo].[Config_Line] c ON o.LineID = c.LineID
//         WHERE 
//           c.LineName = @LineName
//           AND CAST(o.ProdDate AS DATE) = @ProdDate
//         GROUP BY 
//           o.LineID,
//           DATEPART(HOUR, o.[Timestamp]),
//           c.LineName
//         ORDER BY 
//           Hour;
//       `);

//       const cleanedData = result.recordset.map(item => ({
//         ...item,
//         AvgAvailability: cleanNumber(item.AvgAvailability),
//         AvgPerformance: cleanNumber(item.AvgPerformance),
//         AvgQuality: cleanNumber(item.AvgQuality),
//         AvgOLE: cleanNumber(item.AvgOLE)
//       }));

//     middlewares.standardResponse(res, result.recordset,cleanedData, 200, "success");
//   } catch (err) {
//     console.error("SQL Error:", err);
//     middlewares.standardResponse(res, null, 500, "Error executing query: " + err.message);
//   }
// });




router.get("/ProdDate/Shift", (request, response) => {
    new sqlConnection.sql.Request().query(
      `SELECT TOP 1 ProdDate, ShiftName
      FROM [PPMS_Solution].[dbo].[Prod_ShiftInformation]
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
  router.get("/getLineID/:LineName", (request, response) => {
  const lineName = request.params.LineName;

  new sqlConnection.sql.Request()
    .input("LineName", sqlConnection.sql.VarChar, lineName)
    .query("SELECT LineID FROM Config_Line WHERE LineName = @LineName", (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error fetching LineID: " + err);
      } else if (result.recordset.length > 0) {
        response.json({ LineID: result.recordset[0].LineID });
      } else {
        response.status(404).json({ message: "LineName not found" });
      }
    });
});


//Fetch the OEE Details based on lineid
  router.get("/OEEDetails/:LineID", (request, response) => {
    const lineId = parseInt(request.params.LineID);
  
    new sqlConnection.sql.Request()
      .input("LineID", sqlConnection.sql.Int, lineId)
      .execute("[PPMS_Solution].[dbo].[Dashboard_Perf_OEE_LineWise]", (err, result) => {
        if (err) {
          middlewares.standardResponse(response, null, 300, "Error executing stored procedure: " + err);
        } else {
          middlewares.standardResponse(response, result.recordset, 200, "success");
        }
      });
  });
  

module.exports = router;
