const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();



// get rework details
// router.get("/rework/details/LineName", (request, response) => {
//     const { LineName } = request.query; // Get station name from query parameters

//     if (!LineName) {
//         return middlewares.standardResponse(response, null, 400, "LineName is required");
//     }

//     const sqlRequest = new sqlConnection.sql.Request();
//     sqlRequest.input("LineName", sqlConnection.sql.VarChar, LineName); // Bind the parameter

//     sqlRequest.query(
//         `SELECT
//            R.ReworkID, 
//            R.LineID,
//            R.ProdDate,
//            R.ProdShift,
//            R.SKUID,
//            R.ReworkStartTime,
//            R.ReworkEndTime,
//            R.ReworkStatus,
//            R.Reason,
//            l.LineName,
//            S.SKUName
//         FROM PPMS_Solution.dbo.Perf_Rework R
//          JOIN PPMS_Solution.dbo.Config_Line l ON R.LineID = l.LineID
//          JOIN PPMS_Solution.dbo.Config_SKU S ON R.SKUID = S.SKUID
//         WHERE  l.LineName=@LineName;`,
//         (err, result) => {
//             if (err) {
//                 middlewares.standardResponse(response, null, 500, "Error executing query: " + err);
//             } else {
//                 middlewares.standardResponse(response, result.recordset, 200, "Success");
//             }
//         }
//     );
// });

//-------------------
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
// POST: Update Count, Reason, and Remark using stored procedure
router.post('/update-rework', async (request, response) => {
  const { LineID, UserRole, Action, Count, Reason, Remark } = request.body;

  try {
    const procRequest = new sqlConnection.sql.Request();
    procRequest.input('LineID', sqlConnection.sql.Int, LineID);
    procRequest.input('UserRole', sqlConnection.sql.NVarChar(50), UserRole);
    procRequest.input('Action', sqlConnection.sql.NVarChar(50), Action);
    procRequest.input('Count', sqlConnection.sql.Int, Count);
    procRequest.input('Reason', sqlConnection.sql.NVarChar(255), Reason);
    procRequest.input('Remark', sqlConnection.sql.NVarChar(sqlConnection.sql.MAX), Remark);

    await procRequest.execute('[PPMS_Solution].[dbo].[Insert_ReworkGenealogy1]');

    return middlewares.standardResponse(response, null, 200, 'Rework genealogy updated successfully.');
  } catch (err) {
    console.error('Error executing update-rework:', err);
    return middlewares.standardResponse(response, null, 500, 'Error updating rework genealogy: ' + err.message);
  }
});



// GET Perf_CycleTime data by LineID
router.get('/cycletime/:lineID', (request, response) => {
  const lineID = request.params.lineID;

  const query = `
    SELECT top(1) pct.*
    FROM [PPMS_Solution].[dbo].[Perf_CycleTime] pct
    INNER JOIN [PPMS_Solution].[dbo].[Config_Station] cs ON pct.StationID = cs.StationID
    INNER JOIN [PPMS_Solution].[dbo].[Config_Line] cl ON cs.LineID = cl.LineID
    WHERE cl.LineID = @lineID
    ORDER BY pct.Timestamp DESC
  `;

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input('lineID', sqlConnection.sql.Int, lineID);

  sqlRequest.query(query, (err, result) => {
    if (err) {
      middlewares.standardResponse(response, null, 300, 'Error executing query: ' + err);
    } else {
      middlewares.standardResponse(response, result.recordset, 200, 'Success');
    }
  });
});
//API to fetch Role base action 
router.get("/get-actions/:role", (request, response) => {
    const role = request.params.role;
  
    const query = `
      SELECT [Action]
      FROM [PPMS_Solution].[dbo].[Rework_StatusReference]
      WHERE [Role] = @role
    `;
  
    const sqlRequest = new sqlConnection.sql.Request();
    sqlRequest.input("role", sqlConnection.sql.VarChar, role);
  
    sqlRequest.query(query, (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "Success");
      }
    });
  });
  //gET THE REWORK geneology on the basis of lineid
  router.get("/rework-genealogy/:lineID", (request, response) => {
    const lineID = request.params.lineID;
  
    const query = `
      SELECT 
          RG.[UID],
          RG.[Timestamp],
          RG.[LineID],
          CL.LineName,
          RG.[User],
          RG.[ProdDate],
          RG.[ProdShift],
          RG.[SKUID],
          CS.SKUName,
          RG.[Qty],
          RG.[StatusID],
          RG.[Reason],
          RG.[Remark]
      FROM 
          [PPMS_Solution].[dbo].[Rework_Genealogy] AS RG
      LEFT JOIN 
          [PPMS_Solution].[dbo].[Config_Line] AS CL ON RG.LineID = CL.LineID
      LEFT JOIN 
          [PPMS_Solution].[dbo].[Config_SKU] AS CS ON RG.SKUID = CS.SKUID
      WHERE 
          RG.LineID = ${lineID}
    `;
  
    new sqlConnection.sql.Request().query(query, (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "Success");
      }
    });
  });

  //get Rework reasons 
  router.get("/ReworkReason", (request, response) => {
      new sqlConnection.sql.Request().query(
        `select * from [PPMS_Solution].[dbo].[Config_ReworkReason]`,
        (err, result) => {
          if (err) {
            middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
          } else {
            middlewares.standardResponse(response, result.recordset, 200, "success");
          }
        }
      );
    });
  
  
module.exports = router;


