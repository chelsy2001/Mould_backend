const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
//const sql = require("mssql");
//const middlewares = require("../middlewares/middlewares.js");
//const { sqlConfig } = require('../../config/sqlConnection'); // Adjust the path based on your folder structure
const middlewares = require("../middlewares/middlewares.js");
const { sql, config } = require('../databases/ssmsConn.js');

const router = express.Router();

//to show the checklist
router.get("/HCChecklistForApproval", (request, response) => {
    new sqlConnection.sql.Request().query(
        `
 SELECT 
    sch.UID,
    sch.CheckListID,
    chk.CheckListName,
    sch.EquipmentID,
    sch.MouldID,
    mould.MouldName,
    sch.HCFreqCount,
    sch.HCFreqDays,
    sch.HCWarningCount,
    sch.HCWarningDays,
    sch.MaterialID,
    sch.Instance,
    sch.HCStatus,
    sch.LastUpdatedTime,
    sch.LastUpdatedBy
FROM 
   Config_Mould_HCSchedule AS sch
LEFT JOIN 
 Config_Mould_HCCheckList AS chk
    ON sch.CheckListID = chk.CheckListID
LEFT JOIN 
 Config_Mould AS mould
    ON sch.MouldID = mould.MouldID
    ORDER BY 
    CASE 
        WHEN sch.HCStatus IN (5) THEN 0  -- Pin rows with ItemID 3 to the top
        ELSE 1
    END  `,
        (err, result) => {
            if (err) {
                middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
            } else {
                middlewares.standardResponse(response, result.recordset, 200, "success");
            }
        }
    );
});
//to check the user to get the user who's role is quality supervisor

router.get("/Users", (request, response) => {
    new sqlConnection.sql.Request().query(
        `
SELECT CU.UserName
FROM Config_User CU
JOIN Config_Role CR
    ON CU.DepartmentRoleID = CR.RoleID
WHERE CR.RoleName = 'Quality Supervisor';  `,
        (err, result) => {
            if (err) {
                middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
            } else {
                middlewares.standardResponse(response, result.recordset, 200, "success");
            }
        }
    );
});

//login api
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return middlewares.standardResponse(res, null, 400, "Username and password are required");
    }

    const request = new sqlConnection.sql.Request();
    request.input("UserName", sqlConnection.sql.NVarChar, username);
    request.input("Password", sqlConnection.sql.NVarChar, password);

    request.query(
        `SELECT * FROM [Config_User] 
     WHERE UserName = @UserName AND Password = @Password`,
        (err, result) => {
            if (err) {
                middlewares.standardResponse(res, null, 500, "Database error: " + err);
            } else if (result.recordset.length === 0) {
                middlewares.standardResponse(res, null, 401, "Invalid username or password");
            } else {
                // Optional: remove password from response
                const user = result.recordset[0];
                delete user.Password;

                middlewares.standardResponse(res, user, 200, "Login successful");
            }
        }
    );
});

//to approve the checklists

// router.post("/ApproveChecklist", (req, res) => {
//     const { checklistID } = req.body;

//     if (!checklistID) {
//         return middlewares.standardResponse(res, null, 400, "ChecklistID is required");
//     }

//     const sql = require('mssql');
//     const db = new sql.ConnectionPool(sqlConnection.sqlConfig);

//     db.connect().then(pool => {
//         // Step 1: Get MouldID from checklistID
//         return pool.request()
//             .input('CheckListID', sql.NVarChar(50), checklistID)
//             .query(`
//                 SELECT TOP 1 MouldID 
//                 FROM [PPMS_Solution].[dbo].[Mould_Execute_PMCheckList] 
//                 WHERE CheckListID = @CheckListID
//             `);
//     }).then(result => {
//         if (result.recordset.length === 0) {
//             throw new Error("MouldID not found for provided ChecklistID");
//         }

//         const mouldID = result.recordset[0].MouldID;

//         // Step 2: Execute Stored Procedure
//         return db.request()
//             .input('MouldID', sql.NVarChar(50), mouldID)
//             .execute('PM_ExecutionDataMovemnetToHistory');
//     }).then(() => {
//         middlewares.standardResponse(res, null, 200, "Checklist approved and data moved to history");
//     }).catch(err => {
//         console.error(err);
//         middlewares.standardResponse(res, null, 500, "Server Error: " + err.message);
//     });
// });

// Approve Checklist and Move Data to History
router.post("/ApproveChecklist", async (req, res) => {
    const { CheckListID } = req.body;

    if (!CheckListID) {
        return middlewares.standardResponse(res, null, 400, "ChecklistID is required");
    }

    try {
        await sql.connect(config);

        const request = new sql.Request();
        request.input('CheckListID', sqlConnection.sql.Int, CheckListID);

        // Step 1: Get MouldID from checklistID
        const result = await request.query(`
      SELECT TOP 1 MouldID 
      FROM [Mould_Execute_HCCheckList] 
      WHERE CheckListID = @CheckListID
    `);

        if (result.recordset.length === 0) {
            return middlewares.standardResponse(res, null, 404, "MouldID not found for provided ChecklistID");
        }

        const mouldID = result.recordset[0].MouldID;

        // Step 2: Execute stored procedure
        const procRequest = new sql.Request();
        procRequest.input('MouldID', sql.NVarChar(50), mouldID);
        await procRequest.execute('[dbo].[HC_ExecutionDataMovemnetToHistory]');

        return middlewares.standardResponse(res, null, 200, "Checklist approved and data moved to history");
    } catch (err) {
        console.error("Error in ApproveChecklist API:", err);
        return middlewares.standardResponse(res, null, 500, "Internal server error: " + err.message);
    }
});

router.get('/GetCheckPoints/:CheckListID', (request, response) => {
  const CheckListID = request.params.CheckListID;

  const query = `
    SELECT 
    p.[UID],
    p.[CheckListID],
    p.[CheckPointID],
    p.[CheckPointName],
    p.[CheckingMethod],
    p.[CheckPointType],
    p.[UOM],
    p.[UpperLimit],
    p.[LowerLimit],
    p.[Standard],
    p.[CheckPointValue],
    p.[OKNOK],
    p.[Observation],
    p.[LastUpdatedTime],
    c.[CheckListName]
FROM 
  [Mould_Execute_HCCheckPoint] p
JOIN 
    [Config_Mould_HCCheckList] c
    ON p.CheckListID = c.CheckListID
WHERE 
    p.CheckListID = @CheckListID ;
  `;

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input('CheckListID', sqlConnection.sql.Int, CheckListID);

  sqlRequest.query(query, (err, result) => {
    if (err) {
      middlewares.standardResponse(response, null, 300, 'Error executing query: ' + err);
    } else {
      middlewares.standardResponse(response, result.recordset, 200, 'Success');
    }
  });
});

// update api to update the Checkpointsn observation
router.post('/UpdateCheckPoint', async (req, res) => {
  const { CheckPointID, Observation, OKNOK } = req.body;

  if (!CheckPointID || OKNOK === undefined) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields.");
  }

  try {
    const query = `
      UPDATE Mould_Execute_HCCheckPoint
      SET 
        Observation = @Observation,
        OKNOK = @OKNOK,
        LastUpdatedTime = GETDATE()
      WHERE 
        CheckPointID = @CheckPointID
    `;

    const sqlRequest = new sqlConnection.sql.Request();
    sqlRequest.input('Observation', sql.NVarChar, Observation ?? '');
    sqlRequest.input('OKNOK', sql.Int, OKNOK); // 1 for OK, 2 for NOK
    sqlRequest.input('CheckPointID', sql.Int, CheckPointID);

    await sqlRequest.query(query);

    middlewares.standardResponse(res, null, 200, "CheckPoint status updated successfully.");
  } catch (err) {
    middlewares.standardResponse(res, null, 500, "Database error: " + err.message);
  }
});

module.exports = router;