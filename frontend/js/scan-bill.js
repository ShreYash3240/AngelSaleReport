// ==================================================
// SMART PAPER BILL SCANNER (scan-bill.js)
// ==================================================
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

// Track the uploaded receipt image key in S3
let currentReceiptS3Key = "";

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

        const appContainer = document.getElementById("appContainer");
        if (appContainer) appContainer.style.display = "block";

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
// CLIENT-SIDE IMAGE COMPRESSION (Max 1024px, < 300KB)
// ==================================================
function resizeImage(file, maxWidth = 1024, quality = 0.65) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                resolve({
                    dataUrl: dataUrl,
                    base64: dataUrl.split(",")[1],
                    mimeType: "image/jpeg"
                });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==================================================
// DIRECT S3 VAULT UPLOAD (PRE-SIGNED PUT URL)
// ==================================================
async function uploadToS3Vault(dataUrl, mimeType) {
    const byteString = atob(dataUrl.split(",")[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });

    const res = await fetch(`${API_BASE_URL}/receipt-url?action=upload&mimeType=${encodeURIComponent(mimeType)}`, {
        headers: getAuthHeaders()
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to obtain S3 upload credentials");
    }

    const { uploadUrl, s3Key } = await res.json();

    const s3Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob
    });

    if (!s3Res.ok) {
        throw new Error(`Direct S3 upload failed with status ${s3Res.status}`);
    }

    return s3Key;
}

// ==================================================
// CAMERA / FILE SELECTION HANDLER
// ==================================================
receiptImageInput?.addEventListener("change", async (e) => {
    e.preventDefault();
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
        loadingStatus.style.display = "block";
        reviewCard.style.display = "none";
        currentReceiptS3Key = "";

        loadingStatus.textContent = "⏳ Optimizing image size...";
        const resized = await resizeImage(file);

        imagePreview.src = resized.dataUrl;
        imagePreview.style.display = "inline-block";

        // Step 1: Upload compressed photo directly to S3 Vault
        loadingStatus.textContent = "🔒 Archiving image to S3 Vault...";
        currentReceiptS3Key = await uploadToS3Vault(resized.dataUrl, resized.mimeType);

        // Step 2: Extract text via Gemini backend proxy
        loadingStatus.textContent = "⏳ Gemini is analyzing handwriting and items... Please wait.";
        await analyzeBillWithGemini(resized.base64, resized.mimeType);
    } catch (err) {
        console.error("Vault/OCR Processing error:", err);
        currentReceiptS3Key = ""; // Ensure key is reset on failure
        alert("Upload/Scan Error: " + err.message);
        loadingStatus.style.display = "none";
    }
});

// ==================================================
// OCR CALL VIA BACKEND LAMBDA PROXY
// ==================================================
async function analyzeBillWithGemini(base64Data, mimeType) {
    try {
        const response = await fetch(`${API_BASE_URL}/scan-bill`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                imageBase64: base64Data,
                mimeType: mimeType
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || data.error || "OCR extraction failed");
        }

        populateReviewForm(data);
    } catch (err) {
        console.error("Extraction Error:", err);
        alert("Failed to extract data: " + err.message + "\nPlease review the form and enter details manually.");
        populateReviewForm({});
    } finally {
        loadingStatus.style.display = "none";
    }
}

// 1. Converts strings like "sai shinde" -> "Sai Shinde"
function toTitleCase(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// 2. Normalizes divisions/sections ("5th Diamond", "Class 10-A", "Vth") -> Canonical Standard ("5th", "10th")
function normalizeStandard(std) {
    if (!std) return "";
    let s = String(std).trim().toUpperCase();

    if (s.includes("NUR")) return "Nursery";
    if (s.includes("JR") || s.includes("LKG")) return "Jr. KG";
    if (s.includes("SR") || s.includes("UKG")) return "Sr. KG";

    // Prioritize 10 over 1-9 to avoid truncating "10th" into "1st"
    const digitMatch = s.match(/\b(10|[1-9])\b/) || s.match(/^(10|[1-9])/);
    if (digitMatch) {
        const num = digitMatch[1];
        const suffixes = { "1": "1st", "2": "2nd", "3": "3rd" };
        return suffixes[num] || `${num}th`;
    }

    const romanMap = {
        "X": "10th", "IX": "9th", "VIII": "8th", "VII": "7th",
        "VI": "6th", "V": "5th", "IV": "4th", "III": "3rd", "II": "2nd", "I": "1st"
    };
    for (const [roman, normalized] of Object.entries(romanMap)) {
        const regex = new RegExp(`\\b${roman}\\b`, "i");
        if (regex.test(s)) return normalized;
    }

    return toTitleCase(std);
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
    if (data.studentName) scannedStudentName.value = toTitleCase(data.studentName);
    if (data.standard) scannedStandard.value = normalizeStandard(data.standard);

    if (data.branch && ["Hadapsar", "Loni", "Fursungi", "Urli"].includes(data.branch)) {
        scannedBranch.value = data.branch;
    } else {
        const saved = localStorage.getItem("selectedBranch");
        if (saved) scannedBranch.value = saved;
    }

    if (data.gender) scannedGender.value = data.gender.toUpperCase().startsWith("G") ? "GIRLS" : "BOYS";
    scannedPaymentMode.value = data.paymentMode === "Online" ? "Online" : "Cash";
    toggleTxn();

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
    currentReceiptS3Key = "";
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
        studentName: toTitleCase(scannedStudentName.value.trim()),
        standard: normalizeStandard(scannedStandard.value.trim()),
        paymentMode: scannedPaymentMode.value.trim(),
        transactionId: isOnline ? scannedTxnId.value.trim() : "",
        items,
        total
    };

    if (dept === "Uniform") {
        payload.gender = scannedGender.value;
    }

    if (currentReceiptS3Key) {
        payload.receiptS3Key = currentReceiptS3Key;
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
        currentReceiptS3Key = "";
    } catch (err) {
        alert("Save Error: " + err.message);
    } finally {
        const btn = document.getElementById("confirmSaveBtn");
        btn.disabled = false;
        btn.textContent = "Commit to Database";
    }
});
