// ==================================================
// BOOKS DEPARTMENT - DAILY SALES (books-daily.js)
// ==================================================
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";
const STARTING_BILL_NO = 22026; // Distinct sequence for book bills

const bookBillForm = document.getElementById("bookBillForm");
const branch = document.getElementById("branch");
const billDate = document.getElementById("billDate");
const billNo = document.getElementById("billNo");
const standard = document.getElementById("standard");
const paymentMode = document.getElementById("paymentMode");
const transactionIdGroup = document.getElementById("transactionIdGroup");
const transactionId = document.getElementById("transactionId");

const itemsContainer = document.getElementById("itemsContainer");
const addItemBtn = document.getElementById("addItemBtn");
const billTotal = document.getElementById("billTotal");
const clearBtn = document.getElementById("clearBtn");

const billsTableBody = document.getElementById("billsTableBody");
const emptyMessage = document.getElementById("emptyMessage");
const todayBillCount = document.getElementById("todayBillCount");
const todayTotal = document.getElementById("todayTotal");
const todayBranchFilter = document.getElementById("todayBranchFilter");

const BUNDLE_OPTIONS = [
    { key: "TOTAL AMOUNT", label: "COMPLETE BOOK SET (Both Text & Notes)" },
    { key: "TEXTBOOKS SET", label: "TEXTBOOKS SET ONLY" },
    { key: "NOTEBOOK SET", label: "NOTEBOOK SET ONLY" }
];

// ==================================================
// AUTHENTICATION CHECK & AUDIT HELPERS
// ==================================================
const COGNITO_AUTH_DOMAIN = "https://school-sales-app-auth.auth.ap-south-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "2p6l3k2tpv751025t3qmmee1to";
const REDIRECT_URI = "https://main.d2gnewcvmz76ap.amplifyapp.com/index.html";

function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("cognito_id_token");
    localStorage.removeItem("selectedBranch");
    window.location.replace("login.html");
}


function enforceAuth() {
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
}
enforceAuth();

// Header helper: Passes Cognito JWT to Lambda for server-side CloudWatch audit logging
function getAuthHeaders() {
    const token = sessionStorage.getItem("cognito_id_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// ==================================================
// PRICING LOOKUP (BUNDLES + INDIVIDUAL UNITS)
// ==================================================
function getAvailableBookItems(std) {
    if (!std) return [];

    const items = [];

    // 1. Standard Bundles
    BUNDLE_OPTIONS.forEach(b => {
        if (typeof BOOKS_PRICE_MATRIX !== "undefined" && BOOKS_PRICE_MATRIX[std]?.[b.key]) {
            items.push({ value: b.key, label: b.label, isBundle: true });
        }
    });

    // 2. Individual Textbooks & Notebooks
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

    // A. Check in Standard Bundles Matrix
    if (typeof BOOKS_PRICE_MATRIX !== "undefined" && BOOKS_PRICE_MATRIX[std]?.[itemName] !== undefined) {
        return BOOKS_PRICE_MATRIX[std][itemName];
    }

    // B. Check in Granular Breakdown Matrix
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
    
    // Group 1: Bundles
    const bundles = availableItems.filter(i => i.isBundle);
    if (bundles.length > 0) {
        html += `<optgroup label="── Full Sets / Bundles ──">`;
        bundles.forEach(b => {
            html += `<option value="${escapeHTML(b.value)}">${escapeHTML(b.label)}</option>`;
        });
        html += `</optgroup>`;
    }

    // Group 2: Individual Books
    const singles = availableItems.filter(i => !i.isBundle);
    if (singles.length > 0) {
        html += `<optgroup label="── Individual Textbooks & Notebooks ──">`;
        singles.forEach(s => {
            html += `<option value="${escapeHTML(s.value)}">${escapeHTML(s.label)}</option>`;
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
// UTILITIES & DATA SYNC
// ==================================================
function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(ds) {
    if (!ds) return "";
    const p = ds.split("-");
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : ds;
}

function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function handlePaymentMode() {
    const isOnline = paymentMode.value === "Online";
    transactionIdGroup.style.display = isOnline ? "block" : "none";
    transactionId.required = isOnline;
    if (!isOnline) transactionId.value = "";
}

async function setNextBillNumber() {
    try {
        const res = await fetch(`${API_BASE_URL}/bills?department=Books`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error();
        const bills = await res.json();
        const max = bills.reduce((m, b) => Math.max(m, parseInt(b.billNo, 10) || 0), 0);
        billNo.value = max >= STARTING_BILL_NO ? max + 1 : STARTING_BILL_NO;
    } catch {
        billNo.value = STARTING_BILL_NO;
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
// API CALLS
// ==================================================
async function fetchAndDisplayTodayBills() {
    const today = getTodayDate();
    const filter = todayBranchFilter?.value || "All";
    let url = `${API_BASE_URL}/bills?department=Books&date=${today}`;
    if (filter !== "All") url += `&branch=${encodeURIComponent(filter)}`;

    try {
        const res = await fetch(url, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error();
        const bills = await res.json();

        billsTableBody.innerHTML = "";
        let totalSales = 0;

        if (bills.length === 0) {
            emptyMessage.style.display = "block";
        } else {
            emptyMessage.style.display = "none";
            bills.forEach(bill => {
                totalSales += Number(bill.total) || 0;
                const tr = document.createElement("tr");

                const itemNames = (bill.items || []).map(i => `<div>${escapeHTML(i.name)}</div>`).join("");
                const itemQtys  = (bill.items || []).map(i => `<div>${Number(i.quantity) || 0}</div>`).join("");
                const itemAmts  = (bill.items || []).map(i => `<div>₹${(Number(i.amount) || 0).toFixed(2)}</div>`).join("");

                tr.innerHTML = `
                    <td>${formatDate(bill.billDate)}</td>
                    <td>${escapeHTML(bill.branch || "-")}</td>
                    <td>${escapeHTML(bill.billNo)}</td>
                    <td>${escapeHTML(bill.standard)}</td>
                    <td>${escapeHTML(bill.paymentMode || "")}</td>
                    <td>${escapeHTML(bill.transactionId || "-")}</td>
                    <td class="item-list">${itemNames}</td>
                    <td class="item-list">${itemQtys}</td>
                    <td class="item-list">${itemAmts}</td>
                    <td>₹${(Number(bill.total) || 0).toFixed(2)}</td>
                    <td>
                        <button type="button" class="delete-btn" data-branch="${escapeHTML(bill.branch)}" data-date="${bill.billDate}" data-billno="${bill.billNo}">
                            Delete
                        </button>
                    </td>
                `;
                billsTableBody.appendChild(tr);
            });
        }
        todayBillCount.textContent = bills.length;
        todayTotal.textContent = `₹${totalSales.toFixed(2)}`;
    } catch (err) {
        console.error("Error loading book bills:", err);
    }
}

async function deleteBill(bBranch, bDate, bNo) {
    if (!confirm(`Delete Book Bill #${bNo}?`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/bills?department=Books&branch=${encodeURIComponent(bBranch)}&billDate=${bDate}&billNo=${bNo}`, { 
            method: "DELETE",
            headers: getAuthHeaders()
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Delete failed");

        alert(`Bill #${bNo} deleted.`);
        fetchAndDisplayTodayBills();
        setNextBillNumber();
    } catch (err) {
        alert("Delete failed: " + (err.message || "Unknown error"));
    }
}

// ==================================================
// EVENT LISTENERS
// ==================================================
branch?.addEventListener("change", () => {
    localStorage.setItem("selectedBranch", branch.value);
    if (todayBranchFilter) todayBranchFilter.value = branch.value;
    fetchAndDisplayTodayBills();
});

todayBranchFilter?.addEventListener("change", () => {
    if (todayBranchFilter.value !== "All") {
        localStorage.setItem("selectedBranch", todayBranchFilter.value);
        if (branch) branch.value = todayBranchFilter.value;
    }
    fetchAndDisplayTodayBills();
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

billsTableBody?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("delete-btn")) return;
    const btn = e.target;
    deleteBill(btn.getAttribute("data-branch"), btn.getAttribute("data-date"), btn.getAttribute("data-billno"));
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
        fetchAndDisplayTodayBills();
        setNextBillNumber();
    } catch {
        alert("Could not reach AWS backend.");
    }
});

// Init
const savedBranch = localStorage.getItem("selectedBranch");
if (savedBranch) {
    if (branch) branch.value = savedBranch;
    if (todayBranchFilter) todayBranchFilter.value = savedBranch;
}
billDate.value = getTodayDate();
itemsContainer.innerHTML = "";
addBookRow();
handlePaymentMode();
setNextBillNumber();
fetchAndDisplayTodayBills();
