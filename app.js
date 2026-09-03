// ==================================================
// CONFIGURATION & DOM ELEMENTS
// ==================================================
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";
const STARTING_BILL_NO = 12026;

const billForm = document.getElementById("billForm");
const branch = document.getElementById("branch");
const billDate = document.getElementById("billDate");
const billNo = document.getElementById("billNo");
const standard = document.getElementById("standard");
const gender = document.getElementById("gender");
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

const PT_SIZES = ["24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44", "46"];

// ==================================================
// COGNITO AUTHENTICATION & AUDIT HEADERS
// ==================================================
const COGNITO_AUTH_DOMAIN = "https://school-sales-app-auth.auth.ap-south-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "2p6l3k2tpv751025t3qmmee1to";
const REDIRECT_URI = "https://main.d2gnewcvmz76ap.amplifyapp.com/index.html";

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
    window.location.replace("login.html");
}


function enforceAuthentication() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const token = new URLSearchParams(hash).get("id_token");
        if (token) {
            sessionStorage.setItem("cognito_id_token", token);
            window.history.replaceState(null, "", window.location.pathname);
        }
    }

    const token = sessionStorage.getItem("cognito_id_token");
    if (!token) return window.location.replace("login.html");

    const payload = parseJwt(token);
    if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
        sessionStorage.removeItem("cognito_id_token");
        return window.location.replace("login.html");
    }

    const emailDisplay = document.getElementById("userEmailDisplay");
    if (emailDisplay) emailDisplay.textContent = payload.name || payload.email || "Accountant";

    const appContainer = document.getElementById("appContainer");
    if (appContainer) appContainer.style.display = "block";

    const authBtn = document.getElementById("authBtn");
    if (authBtn) authBtn.onclick = (e) => { e.preventDefault(); handleLogout(); };
}
enforceAuthentication();

// Passes Cognito JWT to Lambda so CloudWatch captures developer audit logs
function getAuthHeaders() {
    const token = sessionStorage.getItem("cognito_id_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// ==================================================
// PRICING LOOKUP (MATRIX DRIVEN)
// ==================================================
function getAvailableUniformItems() {
    const gen = gender.value.trim();
    const specificItem = (gen === "GIRLS") ? "SHIRT & SKIRT" : "SHIRT & PANT";
    return [
        "SET", 
        specificItem, 
        "BLAZZER", 
        "SHOES & SOCKS", 
        "ONLY SOCKS", 
        "BELT", 
        "PT SHIRT", 
        "PT PANT"
    ];
}

function getItemUnitPrice(itemName, size = "") {
    if (!itemName) return 0;

    // 1. PT Uniform: Price based purely on Size
    if (itemName === "PT SHIRT" || itemName === "PT PANT") {
        if (!size) return 0;
        return typeof PT_UNIFORM_PRICE_MATRIX !== "undefined" ? (PT_UNIFORM_PRICE_MATRIX[size]?.[itemName] ?? 0) : 0;
    }

    // 2. Regular Uniform: Price based on Std & Gender
    const std = standard.value.trim();
    const gen = gender.value.trim();
    if (!std || !gen) return 0;

    return typeof UNIFORM_PRICE_MATRIX !== "undefined" ? (UNIFORM_PRICE_MATRIX[std]?.[gen]?.[itemName] ?? 0) : 0;
}

// ==================================================
// DYNAMIC ROWS & CALCULATIONS
// ==================================================
function createItemRow() {
    const row = document.createElement("div");
    row.className = "item-row";

    // Item selector
    const select = document.createElement("select");
    select.className = "item-name";
    select.required = true;
    const items = getAvailableUniformItems();
    select.innerHTML = `<option value="">Select Item</option>` + 
        items.map(i => `<option value="${i}">${i}</option>`).join("");

    // Size selector (applicable to PT Uniform)
    const sizeSelect = document.createElement("select");
    sizeSelect.className = "item-size";
    sizeSelect.disabled = true;
    sizeSelect.innerHTML = `<option value="">-</option>` + 
        PT_SIZES.map(s => `<option value="${s}">${s}</option>`).join("");

    // Quantity selector
    const qty = document.createElement("select");
    qty.className = "item-qty";
    qty.required = true;
    qty.innerHTML = `<option value="">Qty.</option>` + 
        Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");

    // Amount output
    const amt = document.createElement("input");
    amt.type = "number";
    amt.className = "item-amount";
    amt.min = "0";
    amt.step = "0.01";
    amt.placeholder = "Amount";
    amt.required = true;

    // Remove row button
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-item-btn";
    removeBtn.title = "Remove item";
    removeBtn.textContent = "×";

    row.append(select, sizeSelect, qty, amt, removeBtn);
    return row;
}

function addItemRow() {
    itemsContainer.appendChild(createItemRow());
    updateTotal();
}

function syncAndRecalculateItems() {
    const rows = itemsContainer.querySelectorAll(".item-row");
    rows.forEach(row => {
        const itemSelect = row.querySelector(".item-name");
        const sizeSelect = row.querySelector(".item-size");
        const qtySelect = row.querySelector(".item-qty");
        const amtInput = row.querySelector(".item-amount");

        if (!itemSelect || !sizeSelect || !qtySelect || !amtInput) return;

        const item = itemSelect.value;
        const isPT = (item === "PT SHIRT" || item === "PT PANT");

        // Toggle size dropdown based on whether it is PT Uniform
        if (isPT) {
            sizeSelect.disabled = false;
            sizeSelect.required = true;
            if (sizeSelect.value === "") {
                sizeSelect.options[0].textContent = "Size *";
            }
        } else {
            sizeSelect.disabled = true;
            sizeSelect.required = false;
            sizeSelect.value = "";
            sizeSelect.options[0].textContent = "-";
        }

        const size = sizeSelect.value;
        const unitPrice = getItemUnitPrice(item, size);

        if (unitPrice > 0 && !qtySelect.value) {
            qtySelect.value = "1";
        }

        const quantity = Number(qtySelect.value) || 0;

        if (item && unitPrice > 0) {
            amtInput.value = (unitPrice * quantity).toFixed(2);
            amtInput.readOnly = true;
            amtInput.title = `Unit Price: ₹${unitPrice}`;
        } else if (item && unitPrice === 0) {
            if (item === "BLAZZER") {
                alert(`Blazzer is not applicable for ${standard.value} (${gender.value})`);
                itemSelect.value = "";
                amtInput.value = "";
            } else if (isPT && !size) {
                amtInput.value = "";
                amtInput.title = "Select size to calculate price";
            } else {
                amtInput.readOnly = false;
                amtInput.title = "Manual pricing";
            }
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
// PERSISTENCE & AUTO-FILL HELPERS
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
        const res = await fetch(`${API_BASE_URL}/bills`, {
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
    billForm.reset();
    billDate.value = getTodayDate();
    setNextBillNumber();
    if (branch && savedBranch) branch.value = savedBranch;
    itemsContainer.innerHTML = "";
    addItemRow();
    billTotal.textContent = "₹0.00";
    handlePaymentMode();
}

// ==================================================
// API CALLS (DYNAMODB)
// ==================================================
async function fetchAndDisplayTodayBills() {
    const today = getTodayDate();
    const filter = todayBranchFilter?.value || "All";
    let url = `${API_BASE_URL}/bills?date=${today}`;
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

                const itemNames = (bill.items || []).map(i => `<div>${escapeHTML(i.name)}${i.size ? ` (Size: ${i.size})` : ""}</div>`).join("");
                const itemQtys  = (bill.items || []).map(i => `<div>${Number(i.quantity) || 0}</div>`).join("");
                const itemAmts  = (bill.items || []).map(i => `<div>₹${(Number(i.amount) || 0).toFixed(2)}</div>`).join("");

                tr.innerHTML = `
                    <td>${formatDate(bill.billDate)}</td>
                    <td>${escapeHTML(bill.branch || "-")}</td>
                    <td>${escapeHTML(bill.billNo)}</td>
                    <td>${escapeHTML(bill.standard)}</td>
                    <td>${escapeHTML(bill.gender || "")}</td>
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
        console.error("Error loading today's bills:", err);
    }
}

async function deleteBill(bBranch, bDate, bNo) {
    if (!confirm(`Delete Bill #${bNo}?`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/bills?branch=${encodeURIComponent(bBranch)}&billDate=${bDate}&billNo=${bNo}`, { 
            method: "DELETE",
            headers: getAuthHeaders() // Transmits token for DELETE_BILL audit log
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Delete failed");
        
        alert(`Bill #${bNo} deleted.`);
        fetchAndDisplayTodayBills();
        setNextBillNumber();
    } catch (err) {
        alert("Delete failed: " + err.message);
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

standard?.addEventListener("change", syncAndRecalculateItems);

gender?.addEventListener("change", () => {
    const rows = itemsContainer.querySelectorAll(".item-row");
    const items = getAvailableUniformItems();
    
    rows.forEach(row => {
        const select = row.querySelector(".item-name");
        const prevVal = select.value;
        
        select.innerHTML = `<option value="">Select Item</option>` + 
            items.map(i => `<option value="${i}">${i}</option>`).join("");

        if (prevVal === "SHIRT & PANT" && gender.value === "GIRLS") {
            select.value = "SHIRT & SKIRT";
        } else if (prevVal === "SHIRT & SKIRT" && gender.value === "BOYS") {
            select.value = "SHIRT & PANT";
        } else if (items.includes(prevVal)) {
            select.value = prevVal;
        }
    });

    syncAndRecalculateItems();
});

paymentMode?.addEventListener("change", handlePaymentMode);
addItemBtn?.addEventListener("click", addItemRow);
clearBtn?.addEventListener("click", clearForm);

itemsContainer?.addEventListener("change", (e) => {
    if (
        e.target.classList.contains("item-name") || 
        e.target.classList.contains("item-size") || 
        e.target.classList.contains("item-qty")
    ) {
        syncAndRecalculateItems();
    }
});

itemsContainer?.addEventListener("input", (e) => {
    if (e.target.classList.contains("item-amount")) updateTotal();
});

itemsContainer?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("remove-item-btn")) return;
    if (itemsContainer.querySelectorAll(".item-row").length === 1) {
        return alert("At least one item is required.");
    }
    e.target.closest(".item-row").remove();
    updateTotal();
});

billsTableBody?.addEventListener("click", (e) => {
    if (!e.target.classList.contains("delete-btn")) return;
    const btn = e.target;
    deleteBill(btn.getAttribute("data-branch"), btn.getAttribute("data-date"), btn.getAttribute("data-billno"));
});

billForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

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
        const size = row.querySelector(".item-size").value;
        const qty = parseInt(row.querySelector(".item-qty").value, 10);
        const amt = parseFloat(row.querySelector(".item-amount").value);

        if (!name || isNaN(qty) || isNaN(amt)) {
            return alert(`Row ${i + 1}: Please complete all item fields.`);
        }
        if ((name === "PT SHIRT" || name === "PT PANT") && !size) {
            return alert(`Row ${i + 1} (${name}): Please select a size.`);
        }

        items.push({
            name,
            size: size || undefined,
            quantity: qty,
            unitPrice: getItemUnitPrice(name, size),
            amount: amt
        });
    }

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    const payload = {
        branch: branch.value.trim(),
        billDate: billDate.value.trim(),
        billNo: billNo.value.trim(),
        standard: standard.value.trim(),
        gender: gender.value.trim(),
        paymentMode: paymentMode.value.trim(),
        transactionId: isOnline ? transactionId.value.trim() : "",
        items,
        total
    };

    try {
        const res = await fetch(`${API_BASE_URL}/bills`, {
            method: "POST",
            headers: getAuthHeaders(), // Transmits token for CREATE_BILL audit log
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || "Failed to save bill.");

        alert(`Bill #${payload.billNo} saved successfully!`);
        clearForm();
        fetchAndDisplayTodayBills();
        setNextBillNumber();
    } catch {
        alert("Could not reach AWS backend.");
    }
});

// ==================================================
// INITIALIZATION
// ==================================================
const savedBranch = localStorage.getItem("selectedBranch");
if (savedBranch) {
    if (branch) branch.value = savedBranch;
    if (todayBranchFilter) todayBranchFilter.value = savedBranch;
}
billDate.value = getTodayDate();
itemsContainer.innerHTML = "";
addItemRow();
handlePaymentMode();
setNextBillNumber();
fetchAndDisplayTodayBills();
