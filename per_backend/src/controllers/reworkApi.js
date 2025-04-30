const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

//GET Line ID
router.get("/Line", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT LineID, LineName FROM PPMS_Solution.dbo.Config_Line`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});

// get rework details
router.get("/rework/details/LineName", (request, response) => {
    const { LineName } = request.query; // Get station name from query parameters

    if (!LineName) {
        return middlewares.standardResponse(response, null, 400, "LineName is required");
    }

    const sqlRequest = new sqlConnection.sql.Request();
    sqlRequest.input("LineName", sqlConnection.sql.VarChar, LineName); // Bind the parameter

    sqlRequest.query(
        `SELECT
           R.ReworkID, 
           R.LineID,
           R.ProdDate,
           R.ProdShift,
           R.SKUID,
           R.ReworkStartTime,
           R.ReworkEndTime,
           R.ReworkStatus,
           R.Reason,
           l.LineName,
           S.SKUName
        FROM PPMS_Solution.dbo.Perf_Rework R
         JOIN PPMS_Solution.dbo.Config_Line l ON R.LineID = l.LineID
         JOIN PPMS_Solution.dbo.Config_SKU S ON R.SKUID = S.SKUID
        WHERE  l.LineName=@LineName;`,
        (err, result) => {
            if (err) {
                middlewares.standardResponse(response, null, 500, "Error executing query: " + err);
            } else {
                middlewares.standardResponse(response, result.recordset, 200, "Success");
            }
        }
    );
});
// router.get("/rework/details/LineName", (request, response) => {
//     const { LineName } = request.query; // Get station name from query parameters

//     if (!LineName) {
//         return middlewares.standardResponse(response, null, 400, "LineName is required");
//     }

//     const sqlRequest = new sqlConnection.sql.Request();
//     sqlRequest.input("LineName", sqlConnection.sql.VarChar, LineName); // Bind the parameter

//     sqlRequest.query(
//         `SELECT 
//             d.TotalCount,
//             d.StationID,
//             s.StationName,
//             d.Rework,
//             d.ReworkOK,
//             d.RejectedCount,
//             d.GoodPart,
//             d.RFT,
//             r.Reason,
//             c.LineID, 
//             c.LineName,
//             d.Timestamp
//         FROM [PPMS_Solution].[dbo].[Perf_CycleTime] d
//         JOIN PPMS_Solution.dbo.Config_Station s ON d.StationID = s.StationID
//         JOIN PPMS_Solution.dbo.Config_Line c ON s.LineID = c.LineID
// 		JOIN PPMS_Solution.dbo.Perf_Rework r ON c.LineID = r.LineID
//         WHERE c.LineName = @LineName;`,
//         (err, result) => {
//             if (err) {
//                 middlewares.standardResponse(response, null, 500, "Error executing query: " + err);
//             } else {
//                 middlewares.standardResponse(response, result.recordset, 200, "Success");
//             }
//         }
//     );
// });

//update rework details
router.put("/rework/updateReason", (request, response) => {
    const { ReworkID, LineName, Reason } = request.body;

    if (!ReworkID || !LineName || !Reason) {
        return middlewares.standardResponse(response, null, 400, "ReworkID, LineName, and Reason are required");
    }

    const sqlRequest = new sqlConnection.sql.Request();

    sqlRequest.input("LineName", sqlConnection.sql.VarChar, LineName);
    sqlRequest.input("Reason", sqlConnection.sql.VarChar, Reason);
    sqlRequest.input("ReworkID", sqlConnection.sql.Int, ReworkID);

    sqlRequest.query(`
        UPDATE PPMS_Solution.dbo.Perf_Rework
        SET 
            LineID = (SELECT LineID FROM PPMS_Solution.dbo.Config_Line WHERE LineName = @LineName),
            Reason = @Reason
        WHERE ReworkID = @ReworkID;
    `, (err, result) => {
        if (err) {
            middlewares.standardResponse(response, null, 500, "Error executing update query: " + err);
        } else {
            middlewares.standardResponse(response, result.rowsAffected, 200, "Update successful");
        }
    });
});


module.exports = router;