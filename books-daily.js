// ==================================================
// BOOKS DEPARTMENT - BILL ENTRY (books-daily.js)
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

const BUNDLE_OPTIONS = [
    { key: "TOTAL AMOUNT", label: "COMPLETE BOOK SET (Both Text & Notes)" },
    { key: "TEXTBOOKS SET", label: "TEXTBOOKS SET ONLY" },
    { key: "NOTEBOOK SET", label: "NOTEBOOK SET ONLY" }
];

// ==================================================
// AUTHENTICATION & HEADERS
// ==================================================
function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("cognito_id_token");
    localStorage.removeItem("selectedBranch");
    window.location.replace("login.html");
}

(function enforceAuth() {
    const token = sessionStorage.getItem("cognito_id_token");
    if (!token) return window.location.replace("login.html");

    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        const payload = JSON.parse(json);

        if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
            sessionStorage.removeItem("cognito_id_token");
            return window.location.replace("login.html");
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
    } catch {
        window.location.replace("login.html");
    }
})();

function getAuthHeaders() {
    const token = sessionStorage.getItem("cognito_id_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// ==================================================
// PRICING LOOKUP
// ==================================================
function getAvailableBookItems(std) {
    if (!std) return [];
    const items = [];

    BUNDLE_OPTIONS.forEach(b => {
        if (typeof BOOKS_PRICE_MATRIX !== "undefined" && BOOKS_PRICE_MATRIX[std]?.[b.key]) {
            items.push({ value: b.key, label: b.label, isBundle: true });
        }
    });

    if (typeof BOOK_ITEMS_BREAKDOWN !== "undefined" && BOOK_ITEMS_BREAKDOWN[std]) {
        Object.keys(BOOK_ITEMS_BREAKDOWN[std]).forEach(singleBook => {
            items.push({ value: singleBook, label: singleBook, isBundle: false });
        });
    }

    return items;
}

function getBookUnitPrice(itemName) {
    const std = standard.value.trim();
    if (!std || !itemName) return 0;

    if (typeof BOOKS_PRICE_MATRIX !== "undefined" && BOOKS_PRICE_MATRIX[std]?.[itemName] !== undefined) {
        return BOOKS_PRICE_MATRIX[std][itemName];
    }
    if (typeof BOOK_ITEMS_BREAKDOWN !== "undefined" && BOOK_ITEMS_BREAKDOWN[std]?.[itemName] !== undefined) {
        return BOOK_ITEMS_BREAKDOWN[std][itemName];
    }
    return 0;
}

// ==================================================
// DYNAMIC ITEM ROWS
// ==================================================
function populateItemSelectOptions(selectElement, selectedValue = "") {
    const std = standard.value.trim();
    const availableItems = getAvailableBookItems(std);

    if (availableItems.length === 0) {
        selectElement.innerHTML = `<option value="">Select Standard first</option>`;
        return;
    }

    let html = `<option value="">Select Book / Set</option>`;
    const bundles = availableItems.filter(i => i.isBundle);
    if (bundles.length > 0) {
        html += `<optgroup label="── Full Sets / Bundles ──">`;
        bundles.forEach(b => {
            html += `<option value="${b.value}">${b.label}</option>`;
        });
        html += `</optgroup>`;
    }

    const singles = availableItems.filter(i => !i.isBundle);
    if (singles.length > 0) {
        html += `<optgroup label="── Individual Textbooks & Notebooks ──">`;
        singles.forEach(s => {
            html += `<option value="${s.value}">${s.label}</option>`;
        });
        html += `</optgroup>`;
    }

    selectElement.innerHTML = html;
    if (selectedValue) selectElement.value = selectedValue;
}

function createBookItemRow() {
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.gridTemplateColumns = "minmax(260px, 2fr) 90px 130px 36px";

    const select = document.createElement("select");
    select.className = "item-name";
    select.required = true;
    populateItemSelectOptions(select);

    const qty = document.createElement("select");
    qty.className = "item-qty";
    qty.required = true;
    qty.innerHTML = `<option value="">Qty.</option>` + 
        Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");

    const amt = document.createElement("input");
    amt.type = "number";
    amt.className = "item-amount";
    amt.min = "0";
    amt.step = "0.01";
    amt.placeholder = "Amount";
    amt.required = true;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-item-btn";
    removeBtn.textContent = "×";

    row.append(select, qty, amt, removeBtn);
    return row;
}

function addBookRow() {
    itemsContainer.appendChild(createBookItemRow());
    updateTotal();
}

function refreshAllDropdownsForStandard() {
    const rows = itemsContainer.querySelectorAll(".item-row");
    rows.forEach(row => {
        const select = row.querySelector(".item-name");
        const prevVal = select.value;
        populateItemSelectOptions(select, prevVal);
    });
    syncAndRecalculate();
}

function syncAndRecalculate() {
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
        } else {
            amtInput.readOnly = false;
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
// UTILITIES & AUTO-FILL HELPERS
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

const BOOK_BILL_PREFIX = "B";

function formatBookBillNo(num) {
    return `${BOOK_BILL_PREFIX}${String(num).padStart(4, "0")}`;
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

        billNo.value = formatBookBillNo(maxNum + 1);
    } catch {
        billNo.value = formatBookBillNo(1);
    }
}

function clearForm() {
    const savedBranch = localStorage.getItem("selectedBranch") || (branch ? branch.value : "");
    bookBillForm.reset();
    billDate.value = getTodayDate();
    setNextBillNumber();
    if (branch && savedBranch) branch.value = savedBranch;
    itemsContainer.innerHTML = "";
    addBookRow();
    billTotal.textContent = "₹0.00";
    handlePaymentMode();
}

// ==================================================
// EVENT LISTENERS
// ==================================================
branch?.addEventListener("change", () => {
    localStorage.setItem("selectedBranch", branch.value);
});

standard?.addEventListener("change", refreshAllDropdownsForStandard);
paymentMode?.addEventListener("change", handlePaymentMode);
addItemBtn?.addEventListener("click", addBookRow);
clearBtn?.addEventListener("click", clearForm);

itemsContainer?.addEventListener("change", (e) => {
    if (e.target.classList.contains("item-name") || e.target.classList.contains("item-qty")) {
        syncAndRecalculate();
    }
});

itemsContainer?.addEventListener("input", (e) => {
    if (e.target.classList.contains("item-amount")) updateTotal();
});

itemsContainer?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("remove-item-btn")) return;
    if (itemsContainer.querySelectorAll(".item-row").length === 1) return alert("At least one item required.");
    e.target.closest(".item-row").remove();
    updateTotal();
});

bookBillForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const isOnline = paymentMode.value === "Online";
    if (isOnline && !transactionId.value.trim()) {
        alert("Transaction ID required for Online payments.");
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
            return alert(`Row ${i + 1}: Please complete all fields.`);
        }
        items.push({ name, quantity: qty, unitPrice: getBookUnitPrice(name), amount: amt });
    }

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    const payload = {
        department: "Books",
        branch: branch.value.trim(),
        billDate: billDate.value.trim(),
        billNo: billNo.value.trim(),
        studentName: studentName.value.trim(),
        standard: standard.value.trim(),
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

        alert(`Book Bill #${payload.billNo} saved successfully!`);
        clearForm();
        setNextBillNumber();
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
addBookRow();
handlePaymentMode();
setNextBillNumber();
