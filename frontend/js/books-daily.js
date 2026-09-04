// ==================================================
// BOOKS DEPARTMENT - DAILY BILL ENTRY (books-daily.js)
// ==================================================
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

const bookBillForm = document.getElementById("bookBillForm");
const branch = document.getElementById("branch");
const billDate = document.getElementById("billDate");
const billNo = document.getElementById("billNo");
const studentName = document.getElementById("studentName");
const standard = document.getElementById("standard");
const paymentMode = document.getElementById("paymentMode");
const transactionIdGroup = document.getElementById("transactionIdGroup");
const transactionId = document.getElementById("transactionId");

const itemsContainer = document.getElementById("itemsContainer");
const addItemBtn = document.getElementById("addItemBtn");
const billTotal = document.getElementById("billTotal");
const clearBtn = document.getElementById("clearBtn");

// ==================================================
// AUTHENTICATION & HEADERS
// ==================================================
function parseJwt(token) {
    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        return JSON.parse(json);
    } catch { return null; }
}

function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("cognito_id_token");
    localStorage.removeItem("selectedBranch");
    window.location.replace("/login.html");
}

(function enforceAuthentication() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const token = new URLSearchParams(hash).get("id_token");
        if (token) {
            sessionStorage.setItem("cognito_id_token", token);
            window.history.replaceState(null, "", window.location.pathname);
        }
    }

    const token = sessionStorage.getItem("cognito_id_token");
    if (!token) return window.location.replace("/login.html");

    const payload = parseJwt(token);
    if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
        sessionStorage.removeItem("cognito_id_token");
        return window.location.replace("/login.html");
    }

    const emailDisplay = document.getElementById("userEmailDisplay");
    if (emailDisplay) emailDisplay.textContent = payload.name || payload.email || "Accountant";

    const appContainer = document.getElementById("appContainer");
    if (appContainer) appContainer.style.display = "block";

    const authBtn = document.getElementById("authBtn");
    if (authBtn) authBtn.onclick = (e) => { e.preventDefault(); handleLogout(); };
})();

function getAuthHeaders() {
    const token = sessionStorage.getItem("cognito_id_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// ==================================================
// DATA NORMALIZATION UTILITIES
// ==================================================
function toTitleCase(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function normalizeStandard(std) {
    if (!std) return "";
    let s = String(std).trim().toUpperCase();

    if (s.includes("NUR")) return "Nursery";
    if (s.includes("JR") || s.includes("LKG")) return "Jr. KG";
    if (s.includes("SR") || s.includes("UKG")) return "Sr. KG";

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
// CLASS-SPECIFIC BOOK ITEMS FILTERING
// ==================================================
function getItemsForStandard(stdRaw) {
    let availableItems = ["TEXTBOOKS SET", "NOTEBOOK SET"];

    if (stdRaw) {
        let stdKey = stdRaw.toUpperCase();
        if (stdKey.includes("NUR")) stdKey = "NURSERY";
        else if (stdKey.includes("JR") || stdKey.includes("LKG")) stdKey = "JR. KG";
        else if (stdKey.includes("SR") || stdKey.includes("UKG")) stdKey = "SR. KG";

        if (typeof BOOK_ITEMS_BREAKDOWN !== "undefined" && BOOK_ITEMS_BREAKDOWN[stdKey]) {
            const granularBooks = Object.keys(BOOK_ITEMS_BREAKDOWN[stdKey]);
            availableItems = availableItems.concat(granularBooks);
        }
    }

    return availableItems;
}

function getBookUnitPrice(itemName) {
    if (!itemName) return 0;
    const stdRaw = standard.value.trim();
    if (!stdRaw) return 0;

    let stdKey = stdRaw.toUpperCase();
    if (stdKey.includes("NUR")) stdKey = "NURSERY";
    else if (stdKey.includes("JR") || stdKey.includes("LKG")) stdKey = "JR. KG";
    else if (stdKey.includes("SR") || stdKey.includes("UKG")) stdKey = "SR. KG";

    // 1. Check Standard Bundle Price Matrix
    if (typeof BOOK_PRICE_MATRIX !== "undefined" && BOOK_PRICE_MATRIX[stdKey]) {
        if (BOOK_PRICE_MATRIX[stdKey][itemName] !== undefined) {
            return BOOK_PRICE_MATRIX[stdKey][itemName];
        }
    }

    // 2. Check Granular Individual Breakdown Matrix
    if (typeof BOOK_ITEMS_BREAKDOWN !== "undefined" && BOOK_ITEMS_BREAKDOWN[stdKey]) {
        if (BOOK_ITEMS_BREAKDOWN[stdKey][itemName] !== undefined) {
            return BOOK_ITEMS_BREAKDOWN[stdKey][itemName];
        }
    }

    return 0;
}

// ==================================================
// DYNAMIC ITEM ROWS
// ==================================================
function createBookItemRow() {
    const row = document.createElement("div");
    row.className = "item-row";

    const std = standard.value.trim();
    const select = document.createElement("select");
    select.className = "item-name";
    select.required = true;

    const items = getItemsForStandard(std);
    select.innerHTML = `<option value="">Select Book Item</option>` + 
        items.map(i => `<option value="${i}">${i}</option>`).join("");
    select.disabled = false;

    const qty = document.createElement("select");
    qty.className = "item-qty";
    qty.required = true;
    qty.innerHTML = `<option value="">Qty.</option>` + 
        Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");

    const amt = document.createElement("input");
    amt.type = "number";
    amt.className = "item-amount";
    amt.min = "0";
    amt.step = "0.01";
    amt.placeholder = "0.00";
    amt.required = true;
    amt.style.backgroundColor = "#ffffff";
    amt.style.fontWeight = "bold";
    amt.style.color = "#0f172a";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-item-btn";
    removeBtn.title = "Remove item";
    removeBtn.textContent = "×";

    row.append(select, qty, amt, removeBtn);
    return row;
}

function addBookItemRow() {
    itemsContainer.appendChild(createBookItemRow());
    updateTotal();
}

function updateAllRowItemDropdowns() {
    const std = standard.value.trim();
    const rows = itemsContainer.querySelectorAll(".item-row");
    const items = getItemsForStandard(std);

    rows.forEach(row => {
        const select = row.querySelector(".item-name");
        const prevVal = select.value;

        select.disabled = false;
        select.innerHTML = `<option value="">Select Book Item</option>` + 
            items.map(i => `<option value="${i}">${i}</option>`).join("");
        
        if (items.includes(prevVal)) {
            select.value = prevVal;
        } else {
            select.value = "";
        }
    });
    syncAndRecalculateBooks();
}

function syncAndRecalculateBooks() {
    const rows = itemsContainer.querySelectorAll(".item-row");
    rows.forEach(row => {
        const itemSelect = row.querySelector(".item-name");
        const qtySelect = row.querySelector(".item-qty");
        const amtInput = row.querySelector(".item-amount");

        if (!itemSelect || !qtySelect || !amtInput) return;

        const item = itemSelect.value;
        const unitPrice = getBookUnitPrice(item);

        if (unitPrice > 0 && !qtySelect.value) {
            qtySelect.value = "1";
        }

        const quantity = Number(qtySelect.value) || 0;

        if (item && unitPrice > 0) {
            amtInput.value = (unitPrice * quantity).toFixed(2);
            amtInput.readOnly = true;
            amtInput.title = `Unit Price: ₹${unitPrice}`;
        } else if (item) {
            amtInput.readOnly = false;
            amtInput.title = "Manual pricing";
        } else {
            amtInput.value = "";
        }
    });
    updateTotal();
}

function updateTotal() {
    let total = 0;
    itemsContainer.querySelectorAll(".item-amount").forEach(inp => total += Number(inp.value) || 0);
    billTotal.textContent = `₹${total.toFixed(2)}`;
}

// ==================================================
// UTILITIES & SEQUENCE
// ==================================================
function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function handlePaymentMode() {
    const isOnline = paymentMode.value === "Online";
    transactionIdGroup.style.display = isOnline ? "block" : "none";
    transactionId.required = isOnline;
    if (!isOnline) transactionId.value = "";
}

const BOOKS_BILL_PREFIX = "B";

function formatBooksBillNo(num) {
    return `${BOOKS_BILL_PREFIX}${String(num).padStart(4, "0")}`;
}

async function setNextBillNumber() {
    try {
        const res = await fetch(`${API_BASE_URL}/bills?department=Books`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error();
        const bills = await res.json();

        let maxNum = 0;
        bills.forEach(b => {
            const raw = String(b.billNo || "").trim();
            const cleaned = raw.toUpperCase().replace(/^B/, "");
            const parsed = parseInt(cleaned, 10);
            if (!isNaN(parsed) && parsed > maxNum) {
                maxNum = parsed;
            }
        });

        billNo.value = formatBooksBillNo(maxNum + 1);
    } catch {
        billNo.value = formatBooksBillNo(1);
    }
}

function clearForm() {
    const savedBranch = localStorage.getItem("selectedBranch") || (branch ? branch.value : "");
    bookBillForm.reset();
    billDate.value = getTodayDate();
    setNextBillNumber();
    if (branch && savedBranch) branch.value = savedBranch;
    itemsContainer.innerHTML = "";
    addBookItemRow();
    updateAllRowItemDropdowns();
    billTotal.textContent = "₹0.00";
    handlePaymentMode();
}

// ==================================================
// DIGITAL BILL SLIP POPUP & PRINT ENGINE
// ==================================================
function showDigitalReceiptSlip(bill) {
    const modal = document.getElementById("receiptSlipModal");
    if (!modal) return;

    const dateParts = (bill.billDate || "").split("-");
    const formattedDate = dateParts.length === 3 
        ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` 
        : bill.billDate;

    document.getElementById("slipDate").textContent = formattedDate;
    document.getElementById("slipBillNo").textContent = bill.billNo || "";
    document.getElementById("slipStudentName").textContent = bill.studentName || "";
    document.getElementById("slipStd").textContent = bill.standard || "";

    const tbody = document.getElementById("slipItemsBody");
    tbody.innerHTML = "";

    const items = bill.items || [];
    const minRows = 4;
    const totalRows = Math.max(items.length, minRows);

    for (let i = 0; i < totalRows; i++) {
        const tr = document.createElement("tr");
        tr.style.height = "22px";

        if (i < items.length) {
            const item = items[i];
            const sizeStr = item.size ? ` (${item.size})` : "";
            tr.innerHTML = `
                <td style="width: 10%; border-right: 1.2px solid #000; border-bottom: 1px solid #cbd5e1; text-align: center; font-size: 0.68rem; padding: 2px 1px; overflow: hidden; box-sizing: border-box;">${i + 1}</td>
                <td style="width: 48%; border-right: 1.2px solid #000; border-bottom: 1px solid #cbd5e1; padding: 2px 3px; font-weight: 600; font-size: 0.68rem; overflow: hidden; box-sizing: border-box; text-overflow: ellipsis; white-space: nowrap;">${item.name}${sizeStr}</td>
                <td style="width: 14%; border-right: 1.2px solid #000; border-bottom: 1px solid #cbd5e1; text-align: center; font-size: 0.68rem; padding: 2px 1px; overflow: hidden; box-sizing: border-box;">${item.quantity || 1}</td>
                <td style="width: 28%; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 700; font-size: 0.7rem; padding: 2px 2px; overflow: hidden; box-sizing: border-box;">${Number(item.amount || 0)}</td>
            `;
        } else {
            tr.innerHTML = `
                <td style="width: 10%; border-right: 1.2px solid #000; border-bottom: 1px solid #cbd5e1; box-sizing: border-box;"></td>
                <td style="width: 48%; border-right: 1.2px solid #000; border-bottom: 1px solid #cbd5e1; box-sizing: border-box;"></td>
                <td style="width: 14%; border-right: 1.2px solid #000; border-bottom: 1px solid #cbd5e1; box-sizing: border-box;"></td>
                <td style="width: 28%; border-bottom: 1px solid #cbd5e1; box-sizing: border-box;"></td>
            `;
        }
        tbody.appendChild(tr);
    }

    if (bill.paymentMode === "Online") {
        const trPay = document.createElement("tr");
        trPay.innerHTML = `
            <td style="border-right: 1.5px solid #000;"></td>
            <td colspan="3" style="padding: 2px 6px; font-size: 0.75rem; color: #334155; font-weight: bold;">
                Online : ${bill.transactionId || "Verified"}
            </td>
        `;
        tbody.appendChild(trPay);
    }

    document.getElementById("slipTotalAmount").textContent = Number(bill.total || 0);
    modal.style.display = "flex";
}

document.getElementById("printSlipBtn")?.addEventListener("click", () => window.print());
document.getElementById("closeSlipBtn")?.addEventListener("click", () => {
    document.getElementById("receiptSlipModal").style.display = "none";
});
document.getElementById("receiptSlipModal")?.addEventListener("click", (e) => {
    if (e.target.id === "receiptSlipModal") e.target.style.display = "none";
});

// ==================================================
// EVENT LISTENERS
// ==================================================
branch?.addEventListener("change", () => {
    localStorage.setItem("selectedBranch", branch.value);
});

standard?.addEventListener("change", updateAllRowItemDropdowns);
paymentMode?.addEventListener("change", handlePaymentMode);
addItemBtn?.addEventListener("click", addBookItemRow);
clearBtn?.addEventListener("click", clearForm);

itemsContainer?.addEventListener("change", (e) => {
    if (e.target.classList.contains("item-name") || e.target.classList.contains("item-qty")) {
        syncAndRecalculateBooks();
    }
});

itemsContainer?.addEventListener("input", (e) => {
    if (e.target.classList.contains("item-amount")) updateTotal();
});

itemsContainer?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("remove-item-btn")) return;
    if (itemsContainer.querySelectorAll(".item-row").length === 1) {
        return alert("At least one book item is required.");
    }
    e.target.closest(".item-row").remove();
    updateTotal();
});

bookBillForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!standard.value.trim()) {
        alert("Please select a standard.");
        return standard.focus();
    }

    const isOnline = paymentMode.value === "Online";
    if (isOnline && !transactionId.value.trim()) {
        alert("Transaction ID is required for Online payments.");
        return transactionId.focus();
    }

    const rows = itemsContainer.querySelectorAll(".item-row");
    const items = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row.querySelector(".item-name").value;
        const qty = parseInt(row.querySelector(".item-qty").value, 10);
        const amt = parseFloat(row.querySelector(".item-amount").value);

        if (!name || isNaN(qty) || isNaN(amt)) {
            return alert(`Row ${i + 1}: Please complete all item fields.`);
        }

        items.push({
            name,
            quantity: qty,
            unitPrice: getBookUnitPrice(name),
            amount: amt
        });
    }

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    const payload = {
        department: "Books",
        branch: branch.value.trim(),
        billDate: billDate.value.trim(),
        billNo: billNo.value.trim(),
        studentName: toTitleCase(studentName.value.trim()),
        standard: normalizeStandard(standard.value.trim()),
        paymentMode: paymentMode.value.trim(),
        transactionId: isOnline ? transactionId.value.trim() : "",
        items,
        total
    };

    try {
        const res = await fetch(`${API_BASE_URL}/bills`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || "Failed to save bill.");

        clearForm();
        setNextBillNumber();

        // 🚀 Trigger printable digital receipt slip modal popup
        showDigitalReceiptSlip(payload);
    } catch {
        alert("Could not reach AWS backend.");
    }
});

// ==================================================
// INITIALIZATION
// ==================================================
const savedBranch = localStorage.getItem("selectedBranch");
if (savedBranch && branch) branch.value = savedBranch;

billDate.value = getTodayDate();
itemsContainer.innerHTML = "";
addBookItemRow();
updateAllRowItemDropdowns();
handlePaymentMode();
setNextBillNumber();