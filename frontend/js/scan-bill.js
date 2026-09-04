// ==================================================
// SMART PAPER BILL SCANNER (scan-bill.js)
// ==================================================
// Read key from config.js (or fallback to empty placeholder)
const GEMINI_API_KEY = window.ENV_CONFIG?.GEMINI_API_KEY || "";
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

const receiptImageInput = document.getElementById("receiptImageInput");
const imagePreview = document.getElementById("imagePreview");
const loadingStatus = document.getElementById("loadingStatus");
const reviewCard = document.getElementById("reviewCard");
const reviewWarning = document.getElementById("reviewWarning");

const scannedBillForm = document.getElementById("scannedBillForm");
const scannedDept = document.getElementById("scannedDept");
const scannedBranch = document.getElementById("scannedBranch");
const scannedBillNo = document.getElementById("scannedBillNo");
const scannedBillDate = document.getElementById("scannedBillDate");
const scannedStudentName = document.getElementById("scannedStudentName");
const scannedStandard = document.getElementById("scannedStandard");
const scannedGender = document.getElementById("scannedGender");
const genderGroup = document.getElementById("genderGroup");
const scannedPaymentMode = document.getElementById("scannedPaymentMode");
const txnGroup = document.getElementById("txnGroup");
const scannedTxnId = document.getElementById("scannedTxnId");

const scannedItemsContainer = document.getElementById("scannedItemsContainer");
const scannedBillTotal = document.getElementById("scannedBillTotal");
const addScannedItemBtn = document.getElementById("addScannedItemBtn");
const discardBtn = document.getElementById("discardBtn");

// ==================================================
// AUTHENTICATION GUARD
// ==================================================
function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("cognito_id_token");
    localStorage.removeItem("selectedBranch");
    window.location.replace("/login.html");
}

(function enforceAuth() {
    const token = sessionStorage.getItem("cognito_id_token");
    if (!token) return window.location.replace("/login.html");

    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        const payload = JSON.parse(json);

        if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
            sessionStorage.removeItem("cognito_id_token");
            return window.location.replace("/login.html");
        }

        const emailDisplay = document.getElementById("userEmailDisplay");
        if (emailDisplay) emailDisplay.textContent = payload.name || payload.email || "Accountant";

        // Reveal the main container
        const appContainer = document.getElementById("appContainer");
        if (appContainer) {
            appContainer.style.display = "block";
        }

        const authBtn = document.getElementById("authBtn");
        if (authBtn) {
            authBtn.onclick = (e) => {
                e.preventDefault();
                handleLogout();
            };
        }
    } catch (err) {
        console.error("Auth decoding error:", err);
        window.location.replace("/login.html");
    }
})();


function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionStorage.getItem("cognito_id_token")}`
    };
}

// ==================================================
// OCR ENGINE: GEMINI 1.5 FLASH
// ==================================================
receiptImageInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview thumbnail
    const reader = new FileReader();
    reader.onload = async () => {
        imagePreview.src = reader.result;
        imagePreview.style.display = "block";

        const base64Bytes = reader.result.split(",")[1];
        const mimeType = file.type || "image/jpeg";

        await analyzeBillWithGemini(base64Bytes, mimeType);
    };
    reader.readAsDataURL(file);
});

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand, 
  ScanCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Supports either a single unified table or a dedicated books table via env vars
const DEFAULT_TABLE_NAME = process.env.TABLE_NAME || "SchoolSales";
const BOOKS_TABLE_NAME = process.env.BOOKS_TABLE_NAME || DEFAULT_TABLE_NAME;

function getTableNameForDept(dept) {
  return dept === "Books" ? BOOKS_TABLE_NAME : DEFAULT_TABLE_NAME;
}

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
};

// 1. Helper to extract user email from authorizer claims or Bearer token
function getActorEmail(event) {
  const authorizerClaims = event.requestContext?.authorizer?.jwt?.claims 
                        || event.requestContext?.authorizer?.claims;
  
  if (authorizerClaims) {
    if (authorizerClaims.email) return authorizerClaims.email;
    if (authorizerClaims["cognito:username"]) return authorizerClaims["cognito:username"];
    if (authorizerClaims.username) return authorizerClaims.username;
  }

  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization || headers.AUTHORIZATION;

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const payloadBase64 = token.split(".")[1];
      const normalizedBase64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
      const decodedJson = Buffer.from(normalizedBase64, "base64").toString("utf-8");
      const parsed = JSON.parse(decodedJson);

      return parsed.email || parsed["cognito:username"] || parsed.name || parsed.sub || "Token Found (No Email)";
    } catch (e) {
      console.error("JWT Decode Error in Lambda:", e.message);
    }
  }

  return "Unknown / Unauthenticated User";
}

// 2. Helper to log structured JSON audit streams for CloudWatch Logs Insights
function auditLog(action, details, actor) {
  const logEntry = {
    eventType: "AUDIT_EVENT",
    action,
    actor,
    timestamp: new Date().toISOString(),
    details
  };
  console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);
}

export const handler = async (event) => {
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  const rawPath = event.rawPath || event.path || "";

  // Handle CORS Preflight
  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const actor = getActorEmail(event);

    // ----------------------------------------------------
    // 1. GET /bills -> Fetch bills by department, date, month, or branch
    // ----------------------------------------------------
    if (httpMethod === "GET") {
      const { branch, date, month, department } = queryParams;
      const dept = department || "Uniform";
      const targetTable = getTableNameForDept(dept);

      let items = [];

      if (branch && branch !== "All") {
        const queryRes = await docClient.send(new QueryCommand({
          TableName: targetTable,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: {
            ":pk": `BRANCH#${branch}#DEPT#${dept}`
          }
        }));
        items = queryRes.Items || [];

        // Backward compatibility for Uniform if using legacy partition key format
        if (dept === "Uniform" && items.length === 0) {
          const legacyQuery = await docClient.send(new QueryCommand({
            TableName: targetTable,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
              ":pk": `BRANCH#${branch}`
            }
          }));
          items = (legacyQuery.Items || []).filter(b => !b.department || b.department === "Uniform");
        }
      } else {
        const scanRes = await docClient.send(new ScanCommand({
          TableName: targetTable
        }));
        items = (scanRes.Items || []).filter(b => {
          if (dept === "Books") return b.department === "Books";
          return !b.department || b.department === "Uniform";
        });
      }

      if (date) {
        items = items.filter(b => b.billDate === date);
      } else if (month) {
        items = items.filter(b => b.billDate && b.billDate.startsWith(month));
      }

      items.sort((a, b) => (b.billDate || "").localeCompare(a.billDate || ""));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(items)
      };
    }

    // ----------------------------------------------------
    // 2. POST /bills -> Validate Uniqueness & Save Bill
    // ----------------------------------------------------
    if (httpMethod === "POST") {
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;

      const {
        department,
        branch,
        billDate,
        billNo,
        studentName,
        standard,
        gender,
        paymentMode,
        transactionId,
        items,
        total
      } = body;

      const dept = department || "Uniform";
      const targetTable = getTableNameForDept(dept);

      if (!branch || !billDate || !billNo || !standard || !paymentMode) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "All required fields must be filled." })
        };
      }

      if (dept === "Uniform" && !gender) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Gender is required for Uniform billing." })
        };
      }

      const trimmedTxnId = transactionId ? String(transactionId).trim() : "";

      if (paymentMode === "Online" && !trimmedTxnId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Transaction ID is required for Online payments." })
        };
      }

      const cleanBillNo = String(billNo).trim().toUpperCase();

      // Check Bill No uniqueness using GSI scoped to department
      try {
        const billCheck = await docClient.send(new QueryCommand({
          TableName: targetTable,
          IndexName: "BillNoIndex",
          KeyConditionExpression: "billNo = :bno",
          ExpressionAttributeValues: {
            ":bno": cleanBillNo
          }
        }));

        const existingBill = (billCheck.Items || []).find(b => (b.department || "Uniform") === dept);
        if (existingBill) {
          return {
            statusCode: 409,
            headers: corsHeaders,
            body: JSON.stringify({ message: `Bill No. "${cleanBillNo}" already exists in ${dept} department!` })
          };
        }
      } catch (gsiErr) {
        console.warn("BillNoIndex check warning:", gsiErr.message);
      }

      // Normalize item entries BEFORE assigning to newBill
      const cleanItems = (items || []).map(i => {
        const cleaned = {
          name: String(i.name || "").trim(),
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unitPrice) || 0,
          amount: Number(i.amount) || 0
        };
        if (i.size) cleaned.size = String(i.size).trim();
        return cleaned;
      });

      // Construct the item with cleanItems defined
      const newBill = {
        PK: `BRANCH#${branch}#DEPT#${dept}`,
        SK: `BILL#${billDate}#${cleanBillNo}`,
        id: Date.now(),
        department: dept,
        branch,
        billDate,
        billNo: cleanBillNo,
        studentName: studentName ? String(studentName).trim() : "",
        standard,
        paymentMode,
        items: cleanItems,
        total: Number(total) || 0,
        createdAt: new Date().toISOString()
      };

      if (gender) newBill.gender = gender;
      if (paymentMode === "Online" && trimmedTxnId) newBill.transactionId = trimmedTxnId;

      await docClient.send(new PutCommand({
        TableName: targetTable,
        Item: newBill
      }));

      // Stream structured developer audit event to CloudWatch
      auditLog("CREATE_BILL", {
        department: dept,
        branch,
        billNo: newBill.billNo,
        billDate,
        standard,
        total: newBill.total,
        itemCount: cleanItems.length,
        paymentMode
      }, actor);

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, bill: newBill })
      };
    }

    // ----------------------------------------------------
    // 3. DELETE /bills -> Delete by branch, SK, and department
    // ----------------------------------------------------
    if (httpMethod === "DELETE") {
      const { branch, billDate, billNo, department } = queryParams;
      const dept = department || "Uniform";
      const targetTable = getTableNameForDept(dept);

      if (!branch || !billDate || !billNo) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "branch, billDate, and billNo parameters are required." })
        };
      }

      await docClient.send(new DeleteCommand({
        TableName: targetTable,
        Key: {
          PK: `BRANCH#${branch}#DEPT#${dept}`,
          SK: `BILL#${billDate}#${billNo}`
        }
      }));

      // Backward compatibility cleanup for legacy uniform keys
      if (dept === "Uniform") {
        await docClient.send(new DeleteCommand({
          TableName: targetTable,
          Key: {
            PK: `BRANCH#${branch}`,
            SK: `BILL#${billDate}#${billNo}`
          }
        })).catch(() => {});
      }

      // Stream structured developer audit event to CloudWatch
      auditLog("DELETE_BILL", {
        department: dept,
        branch,
        billNo,
        billDate
      }, actor);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: "Bill deleted successfully." })
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: `Route ${httpMethod} ${rawPath} not supported.` })
    };

  } catch (error) {
    console.error("Handler Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};

// ==================================================
// REVIEW & FORM AUTO-FILL
// ==================================================
function populateReviewForm(data) {
    reviewCard.style.display = "block";
    reviewWarning.style.display = "block";

    scannedDept.value = data.department === "Books" ? "Books" : "Uniform";
    toggleDepartmentFields();

    if (data.billNo) scannedBillNo.value = data.billNo;
    if (data.billDate) scannedBillDate.value = data.billDate;
    if (data.studentName) scannedStudentName.value = data.studentName;
    if (data.standard) scannedStandard.value = data.standard;

    if (data.branch && ["Hadapsar", "Loni", "Fursungi", "Urli"].includes(data.branch)) {
        scannedBranch.value = data.branch;
    } else {
        const saved = localStorage.getItem("selectedBranch");
        if (saved) scannedBranch.value = saved;
    }

    if (data.gender) scannedGender.value = data.gender.toUpperCase().startsWith("G") ? "GIRLS" : "BOYS";
    scannedPaymentMode.value = data.paymentMode === "Online" ? "Online" : "Cash";
    toggleTxn();

    // Populate rows
    scannedItemsContainer.innerHTML = "";
    if (Array.isArray(data.items) && data.items.length > 0) {
        data.items.forEach(i => addRow(i.name, i.size, i.quantity, i.amount));
    } else {
        addRow("SET", "", 1, data.total || 0);
    }

    recalcTotal();
    reviewCard.scrollIntoView({ behavior: "smooth" });
}

function addRow(name = "", size = "", qty = 1, amt = 0) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
        <input type="text" class="item-name" value="${name}" placeholder="Item description" required style="min-width: 0;" />
        <input type="text" class="item-size" value="${size}" placeholder="-" style="min-width: 0;" />
        <input type="number" class="item-qty" value="${qty || 1}" min="1" required style="min-width: 0;" />
        <input type="number" class="item-amount" value="${amt || 0}" step="0.01" required style="min-width: 0; font-weight: 700;" />
        <button type="button" class="remove-item-btn" title="Remove">×</button>
    `;
    scannedItemsContainer.appendChild(row);
}

function recalcTotal() {
    let sum = 0;
    scannedItemsContainer.querySelectorAll(".item-amount").forEach(i => sum += Number(i.value) || 0);
    scannedBillTotal.textContent = `₹${sum.toFixed(2)}`;
}

function toggleDepartmentFields() {
    genderGroup.style.display = scannedDept.value === "Uniform" ? "block" : "none";
}

function toggleTxn() {
    const isOnline = scannedPaymentMode.value === "Online";
    txnGroup.style.display = isOnline ? "block" : "none";
    scannedTxnId.required = isOnline;
}

// Event Listeners
scannedDept?.addEventListener("change", toggleDepartmentFields);
scannedPaymentMode?.addEventListener("change", toggleTxn);
addScannedItemBtn?.addEventListener("click", () => addRow());

scannedItemsContainer?.addEventListener("input", (e) => {
    if (e.target.classList.contains("item-amount")) recalcTotal();
});

scannedItemsContainer?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("remove-item-btn")) return;
    if (scannedItemsContainer.querySelectorAll(".item-row").length === 1) return alert("At least one item is required.");
    e.target.closest(".item-row").remove();
    recalcTotal();
});

discardBtn?.addEventListener("click", () => {
    reviewCard.style.display = "none";
    imagePreview.style.display = "none";
    receiptImageInput.value = "";
});

// ==================================================
// COMMIT VERIFIED BILL TO DYNAMODB VIA EXISTING API
// ==================================================
scannedBillForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dept = scannedDept.value;
    const isOnline = scannedPaymentMode.value === "Online";

    if (isOnline && !scannedTxnId.value.trim()) {
        alert("Transaction ID is required for Online payments.");
        return scannedTxnId.focus();
    }

    const rows = scannedItemsContainer.querySelectorAll(".item-row");
    const items = [];

    rows.forEach(r => {
        items.push({
            name: r.querySelector(".item-name").value.trim(),
            size: r.querySelector(".item-size").value.trim() || undefined,
            quantity: Number(r.querySelector(".item-qty").value) || 1,
            amount: Number(r.querySelector(".item-amount").value) || 0
        });
    });

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    const payload = {
        department: dept,
        branch: scannedBranch.value.trim(),
        billDate: scannedBillDate.value.trim(),
        billNo: scannedBillNo.value.trim(),
        studentName: scannedStudentName.value.trim(),
        standard: scannedStandard.value.trim(),
        paymentMode: scannedPaymentMode.value.trim(),
        transactionId: isOnline ? scannedTxnId.value.trim() : "",
        items,
        total
    };

    if (dept === "Uniform") {
        payload.gender = scannedGender.value;
    }

    try {
        const btn = document.getElementById("confirmSaveBtn");
        btn.disabled = true;
        btn.textContent = "Saving to DynamoDB...";

        const res = await fetch(`${API_BASE_URL}/bills`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "Failed to commit bill");

        alert(`Success! Bill #${payload.billNo} saved to ${dept} database.`);
        reviewCard.style.display = "none";
        imagePreview.style.display = "none";
        receiptImageInput.value = "";
    } catch (err) {
        alert("Save Error: " + err.message);
    } finally {
        const btn = document.getElementById("confirmSaveBtn");
        btn.disabled = false;
        btn.textContent = "Commit to Database";
    }
});
