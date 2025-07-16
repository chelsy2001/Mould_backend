const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();


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

    await procRequest.execute('[PPMS].[dbo].[Insert_ReworkGenealogy1]');

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
    FROM [PPMS].[dbo].[Perf_CycleTime] pct
    INNER JOIN [PPMS].[dbo].[Config_Station] cs ON pct.StationID = cs.StationID
    INNER JOIN [PPMS].[dbo].[Config_Line] cl ON cs.LineID = cl.LineID
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
      FROM [PPMS].[dbo].[Rework_StatusReference]
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
          [PPMS].[dbo].[Rework_Genealogy] AS RG
      LEFT JOIN 
          [PPMS].[dbo].[Config_Line] AS CL ON RG.LineID = CL.LineID
      LEFT JOIN 
          [PPMS].[dbo].[Config_SKU] AS CS ON RG.SKUID = CS.SKUID
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
        `select * from [PPMS].[dbo].[Config_ReworkReason]`,
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


