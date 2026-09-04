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
    window.location.replace("/login.html");
}

(function enforceAuth() {
    const token = sessionStorage.getItem("cognito_id_token");
    if (!token) return window.location.replace("/login.html");

    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));

        if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
            sessionStorage.removeItem("cognito_id_token");
            return window.location.replace("/login.html");
        }

        const emailDisplay = document.getElementById("userEmailDisplay");
        if (emailDisplay) emailDisplay.textContent = payload.name || payload.email || "Accountant";

        document.getElementById("appContainer").style.display = "block";
        document.getElementById("authBtn").onclick = (e) => { e.preventDefault(); handleLogout(); };
    } catch {
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

async function analyzeBillWithGemini(base64Data, mimeType) {
    loadingStatus.style.display = "block";
    reviewCard.style.display = "none";

    const systemPrompt = `You are a school billing receipt data extractor.
Analyze this paper receipt carefully. It can be printed or handwritten.
Extract the data and return ONLY a single valid JSON object (no markdown, no backticks, no words) with this structure:
{
  "department": "Uniform" or "Books",
  "billNo": "exact receipt or bill number found",
  "billDate": "YYYY-MM-DD format (infer year 2026 if not specified)",
  "branch": "Hadapsar or Loni or Fursungi or Urli or empty",
  "studentName": "student name or empty",
  "standard": "class/std, e.g. Nursery, I, II, 5th, etc.",
  "gender": "BOYS or GIRLS or empty",
  "paymentMode": "Cash or Online",
  "items": [
    { "name": "Item Name", "size": "size or empty", "quantity": 1, "amount": 0.00 }
  ],
  "total": 0.00
}`;

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inline_data: { mime_type: mimeType, data: base64Data } }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "Gemini API error");
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const cleanJson = rawText.replace(/```json|```/gi, "").trim();
        const parsed = JSON.parse(cleanJson);

        populateReviewForm(parsed);
    } catch (err) {
        console.error("Gemini Extraction Error:", err);
        alert("Failed to extract data: " + err.message + "\nPlease try another photo or enter manually.");
    } finally {
        loadingStatus.style.display = "none";
    }
}

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
