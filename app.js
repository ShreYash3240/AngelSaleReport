// ==================================================
// SCHOOL SALES MANAGEMENT - APP.JS (AWS CLOUD INTEGRATED)
// ==================================================

// --------------------------------------------------
// CONFIGURATION: SET YOUR API GATEWAY URL HERE
// --------------------------------------------------
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------
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

const monthSelector = document.getElementById("monthSelector");
const viewMonthBtn = document.getElementById("viewMonthBtn");
const exportBtn = document.getElementById("exportBtn");
const exportMatrixXlsxBtn = document.getElementById("exportMatrixXlsxBtn");

const monthlyBillCount = document.getElementById("monthlyBillCount");
const monthlyTotal = document.getElementById("monthlyTotal");
const todayBranchFilter = document.getElementById("todayBranchFilter");
const monthBranchFilter = document.getElementById("monthBranchFilter");

// In-memory bills cache loaded from AWS
let currentBills = [];

// ==================================================
// COGNITO AUTHENTICATION & GATEKEEPER
// ==================================================
const COGNITO_AUTH_DOMAIN = "https://school-sales-app-auth.auth.ap-south-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "2p6l3k2tpv751025t3qmmee1to";
const REDIRECT_URI = "https://main.d2gnewcvmz76ap.amplifyapp.com/index.html";

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function redirectToLogin() {
  const loginUrl = `${COGNITO_AUTH_DOMAIN}/oauth2/authorize?client_id=${COGNITO_CLIENT_ID}&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  window.location.replace(loginUrl);
}

function handleLogout() {
  // Clear the session token stored for this tab
  sessionStorage.removeItem("cognito_id_token");
  
  // Redirect to Cognito logout endpoint
  const logoutUrl = `${COGNITO_AUTH_DOMAIN}/logout?client_id=${COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;
  window.location.replace(logoutUrl);
}

function enforceAuthentication() {
  // 1. Capture token from URL hash on redirect
  const hash = window.location.hash.substring(1);
  if (hash) {
    const params = new URLSearchParams(hash);
    const idToken = params.get("id_token");
    if (idToken) {
      sessionStorage.setItem("cognito_id_token", idToken);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  // 2. Validate current session token
  const token = sessionStorage.getItem("cognito_id_token");
  if (!token) {
    redirectToLogin();
    return false;
  }

  const payload = parseJwt(token);
  if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
    sessionStorage.removeItem("cognito_id_token");
    redirectToLogin();
    return false;
  }

  // 3. User is valid -> update greeting & reveal main app
  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay) {
    emailDisplay.textContent = payload.name || payload.email || "Accountant";
  }

  const appContainer = document.getElementById("appContainer");
  if (appContainer) {
    appContainer.style.display = "block";
  }

  // 4. Attach event listeners
  const authBtn = document.getElementById("authBtn");
  if (authBtn) {
    authBtn.onclick = (e) => {
      e.preventDefault();
      handleLogout();
    };
  }

  return true;
}

// Execute gatekeeper immediately
enforceAuthentication();


// --------------------------------------------------
// ITEM PRICES
// --------------------------------------------------
const itemPrices = {
    "SHIRT": 0,
    "HALF-PANTS": 0,
    "FULL-PANTS": 0,
    "SKIRT": 0,
    "SHOES": 850,
    "SOCKS": 80,
    "BLAZZER": 1500,
    "PT SHIRTS": 0,
    "PT PANTS": 0,
    "WINTER JACKET": 720,
    "UNIFORM SET": 0
};

// --------------------------------------------------
// PERSISTENT BRANCH MANAGEMENT
// --------------------------------------------------
function restoreBranchSelection() {
    const savedBranch = localStorage.getItem("selectedBranch");
    if (savedBranch) {
        if (branch) branch.value = savedBranch;
        if (todayBranchFilter) todayBranchFilter.value = savedBranch;
        if (monthBranchFilter) monthBranchFilter.value = savedBranch;
    }
}

if (branch) {
    branch.addEventListener("change", function () {
        if (branch.value) {
            localStorage.setItem("selectedBranch", branch.value);
            if (todayBranchFilter) todayBranchFilter.value = branch.value;
            if (monthBranchFilter) monthBranchFilter.value = branch.value;
            fetchAndDisplayTodayBills();
            updateMonthlySummary();
        }
    });
}

if (todayBranchFilter) {
    todayBranchFilter.addEventListener("change", function () {
        if (todayBranchFilter.value !== "All") {
            localStorage.setItem("selectedBranch", todayBranchFilter.value);
            if (branch) branch.value = todayBranchFilter.value;
            if (monthBranchFilter) monthBranchFilter.value = todayBranchFilter.value;
        }
        fetchAndDisplayTodayBills();
    });
}

if (monthBranchFilter) {
    monthBranchFilter.addEventListener("change", function () {
        if (monthBranchFilter.value !== "All") {
            localStorage.setItem("selectedBranch", monthBranchFilter.value);
            if (branch) branch.value = monthBranchFilter.value;
            if (todayBranchFilter) todayBranchFilter.value = monthBranchFilter.value;
        }
        updateMonthlySummary();
    });
}

// --------------------------------------------------
// AUTO-INCREMENT BILL NUMBER LOGIC
// --------------------------------------------------
const STARTING_BILL_NO = 12026;

async function setNextBillNumber() {
    try {
        const res = await fetch(`${API_BASE_URL}/bills`);
        if (!res.ok) throw new Error("Failed to fetch bill numbers");
        const allBills = await res.json();

        let maxNo = 0;
        allBills.forEach(b => {
            const num = parseInt(b.billNo, 10);
            if (!isNaN(num) && num > maxNo) {
                maxNo = num;
            }
        });

        billNo.value = maxNo >= STARTING_BILL_NO ? maxNo + 1 : STARTING_BILL_NO;
    } catch (err) {
        console.warn("Could not calculate next bill number from server:", err);
        billNo.value = STARTING_BILL_NO;
    }
}

// --------------------------------------------------
// PAYMENT MODE TOGGLE
// --------------------------------------------------
function handlePaymentMode() {
    if (!transactionIdGroup) return;

    if (paymentMode.value === "Online") {
        transactionIdGroup.style.setProperty("display", "block", "important");
        transactionId.required = true;
    } else {
        transactionIdGroup.style.setProperty("display", "none", "important");
        transactionId.required = false;
        transactionId.value = "";
    }
}

// --------------------------------------------------
// DATE HELPERS
// --------------------------------------------------
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length !== 3) return dateString;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function setDefaultDate() {
    const today = getTodayDate();
    billDate.value = today;
    if (monthSelector) {
        monthSelector.value = today.substring(0, 7);
    }
}

// --------------------------------------------------
// CREATE ITEM ROWS
// --------------------------------------------------
function createItemDropdown() {
    const select = document.createElement("select");
    select.className = "item-name";
    select.required = true;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select Item";
    select.appendChild(defaultOption);

    Object.keys(itemPrices).forEach(function (item) {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });

    return select;
}

function createQuantityDropdown() {
    const select = document.createElement("select");
    select.className = "item-qty";
    select.required = true;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Qty.";
    select.appendChild(defaultOption);

    for (let quantity = 1; quantity <= 10; quantity++) {
        const option = document.createElement("option");
        option.value = quantity;
        option.textContent = quantity;
        select.appendChild(option);
    }

    return select;
}

function createItemRow() {
    const row = document.createElement("div");
    row.className = "item-row";

    const itemSelect = createItemDropdown();
    const quantitySelect = createQuantityDropdown();

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.className = "item-amount";
    amountInput.min = "0";
    amountInput.step = "0.01";
    amountInput.placeholder = "Amount";
    amountInput.required = true;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-item-btn";
    removeButton.title = "Remove item";
    removeButton.setAttribute("aria-label", "Remove item");
    removeButton.textContent = "×";

    row.appendChild(itemSelect);
    row.appendChild(quantitySelect);
    row.appendChild(amountInput);
    row.appendChild(removeButton);

    return row;
}

function addItemRow() {
    const row = createItemRow();
    itemsContainer.appendChild(row);
    updateTotal();
}

// --------------------------------------------------
// AUTO-PAIR SOCKS & RECALCULATE PRICING
// --------------------------------------------------
function syncAndRecalculateItems() {
    const rows = Array.from(itemsContainer.querySelectorAll(".item-row"));

    rows.forEach(row => {
        const itemSelect = row.querySelector(".item-name");
        const qtySelect = row.querySelector(".item-qty");
        if (itemSelect && itemPrices[itemSelect.value] > 0) {
            if (!qtySelect.value || qtySelect.value === "") {
                qtySelect.value = "1";
            }
        }
    });

    let shoesQty = 0;
    rows.forEach(row => {
        const itemSelect = row.querySelector(".item-name");
        const qtySelect = row.querySelector(".item-qty");
        if (itemSelect && itemSelect.value === "SHOES") {
            shoesQty += Number(qtySelect.value) || 0;
        }
    });

    let socksRow = rows.find(row => {
        const itemSelect = row.querySelector(".item-name");
        return itemSelect && itemSelect.value === "SOCKS";
    });

    if (shoesQty > 0) {
        if (!socksRow) {
            socksRow = createItemRow();
            itemsContainer.appendChild(socksRow);
            const itemSelect = socksRow.querySelector(".item-name");
            itemSelect.value = "SOCKS";
        }

        const qtySelect = socksRow.querySelector(".item-qty");
        if ((Number(qtySelect.value) || 0) < shoesQty) {
            qtySelect.value = shoesQty;
        }
    }

    const allRows = Array.from(itemsContainer.querySelectorAll(".item-row"));
    allRows.forEach(row => {
        const itemSelect = row.querySelector(".item-name");
        const quantitySelect = row.querySelector(".item-qty");
        const amountInput = row.querySelector(".item-amount");

        if (!itemSelect || !quantitySelect || !amountInput) return;

        const item = itemSelect.value;
        const quantity = Number(quantitySelect.value) || 0;
        const unitPrice = Number(itemPrices[item]) || 0;

        if (item === "SOCKS") {
            const billableSocks = Math.max(0, quantity - shoesQty);
            const socksAmount = billableSocks * 80;

            amountInput.value = socksAmount.toFixed(2);
            amountInput.readOnly = true;

            if (billableSocks === 0 && quantity > 0) {
                amountInput.title = `Included with Shoes (₹0.00)`;
            } else if (billableSocks < quantity) {
                amountInput.title = `${shoesQty} free with shoes, ${billableSocks} charged @ ₹80`;
            } else {
                amountInput.title = `₹80 per pair`;
            }
        } else if (item && unitPrice > 0) {
            if (quantity > 0) {
                amountInput.value = (unitPrice * quantity).toFixed(2);
            } else {
                amountInput.value = "";
            }
            amountInput.readOnly = true;
            amountInput.title = `₹${unitPrice} per item`;
        } else {
            amountInput.readOnly = false;
            amountInput.title = "Enter amount manually";
        }
    });

    updateTotal();
}

function updateTotal() {
    const amountInputs = itemsContainer.querySelectorAll(".item-amount");
    let total = 0;
    amountInputs.forEach(function (input) {
        total += Number(input.value) || 0;
    });
    billTotal.textContent = `₹${total.toFixed(2)}`;
}

function getItems() {
    const rows = itemsContainer.querySelectorAll(".item-row");
    const items = [];

    rows.forEach(function (row) {
        const name = row.querySelector(".item-name").value;
        const quantity = Number(row.querySelector(".item-qty").value);
        const amount = Number(row.querySelector(".item-amount").value);
        const unitPrice = Number(itemPrices[name]) || 0;

        items.push({
            name: name,
            quantity: quantity,
            unitPrice: unitPrice,
            amount: amount
        });
    });

    return items;
}

function clearForm() {
    const currentPersistentBranch = localStorage.getItem("selectedBranch") || (branch ? branch.value : "");

    billForm.reset();
    setDefaultDate();
    setNextBillNumber();

    if (branch && currentPersistentBranch) {
        branch.value = currentPersistentBranch;
    }

    itemsContainer.innerHTML = "";
    addItemRow();
    billTotal.textContent = "₹0.00";
    handlePaymentMode();
}

// --------------------------------------------------
// FETCH AND DISPLAY TODAY'S BILLS (FROM AWS DYNAMODB)
// --------------------------------------------------
async function fetchAndDisplayTodayBills() {
    const todayStr = getTodayDate();
    const filterBranchVal = todayBranchFilter ? todayBranchFilter.value : "All";

    try {
        let url = `${API_BASE_URL}/bills?date=${todayStr}`;
        if (filterBranchVal !== "All") {
            url += `&branch=${encodeURIComponent(filterBranchVal)}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to load today's bills.");
        const todayBills = await response.json();

        billsTableBody.innerHTML = "";
        let totalSales = 0;

        if (todayBills.length === 0) {
            emptyMessage.style.display = "block";
        } else {
            emptyMessage.style.display = "none";

            todayBills.forEach(function (bill) {
                totalSales += Number(bill.total) || 0;
                const row = document.createElement("tr");

                let itemHTML = "";
                let quantityHTML = "";
                let amountHTML = "";

                (bill.items || []).forEach(function (item) {
                    itemHTML += `<div>${escapeHTML(item.name)}</div>`;
                    quantityHTML += `<div>${Number(item.quantity) || 0}</div>`;
                    amountHTML += `<div>₹${(Number(item.amount) || 0).toFixed(2)}</div>`;
                });

                row.innerHTML = `
                    <td>${formatDate(bill.billDate)}</td>
                    <td>${escapeHTML(bill.branch || "-")}</td>
                    <td>${escapeHTML(bill.billNo)}</td>
                    <td>${escapeHTML(bill.standard)}</td>
                    <td>${escapeHTML(bill.gender)}</td>
                    <td>${escapeHTML(bill.paymentMode || "")}</td>
                    <td>${escapeHTML(bill.transactionId || "-")}</td>
                    <td class="item-list">${itemHTML}</td>
                    <td class="item-list">${quantityHTML}</td>
                    <td class="item-list">${amountHTML}</td>
                    <td>₹${(Number(bill.total) || 0).toFixed(2)}</td>
                    <td>
                        <button type="button" class="delete-btn" data-branch="${escapeHTML(bill.branch)}" data-date="${bill.billDate}" data-billno="${bill.billNo}">
                            Delete
                        </button>
                    </td>
                `;

                billsTableBody.appendChild(row);
            });
        }

        todayBillCount.textContent = todayBills.length;
        todayTotal.textContent = `₹${totalSales.toFixed(2)}`;
    } catch (err) {
        console.error("Error displaying today bills:", err);
    }
}

// --------------------------------------------------
// DELETE BILL VIA API
// --------------------------------------------------
async function deleteBill(branchName, billDateStr, billNoStr) {
    if (!confirm(`Are you sure you want to delete Bill #${billNoStr}?`)) return;

    try {
        const url = `${API_BASE_URL}/bills?branch=${encodeURIComponent(branchName)}&billDate=${billDateStr}&billNo=${billNoStr}`;
        const res = await fetch(url, { method: "DELETE" });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || "Failed to delete bill.");
        }

        alert(`Bill #${billNoStr} deleted successfully.`);
        fetchAndDisplayTodayBills();
        updateMonthlySummary();
        setNextBillNumber();
    } catch (err) {
        alert("Error deleting bill: " + err.message);
    }
}

// --------------------------------------------------
// UPDATE MONTHLY SUMMARY (FROM AWS DYNAMODB)
// --------------------------------------------------
async function updateMonthlySummary() {
    if (!monthSelector) return;
    const selectedMonth = monthSelector.value;
    const selectedBranch = monthBranchFilter ? monthBranchFilter.value : "All";
    if (!selectedMonth) return;

    try {
        let url = `${API_BASE_URL}/bills?month=${selectedMonth}`;
        if (selectedBranch !== "All") {
            url += `&branch=${encodeURIComponent(selectedBranch)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load month data");
        currentBills = await res.json();

        let total = 0;
        currentBills.forEach(bill => total += Number(bill.total) || 0);

        if (monthlyBillCount) monthlyBillCount.textContent = currentBills.length;
        if (monthlyTotal) monthlyTotal.textContent = `₹${total.toFixed(2)}`;
    } catch (err) {
        console.error("Error updating monthly summary:", err);
    }
}

function csvEscape(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

async function exportCSV() {
    const selectedMonth = monthSelector.value;
    const selectedBranch = monthBranchFilter.value;
    if (!selectedMonth) {
        alert("Please select a month.");
        return;
    }

    try {
        let url = `${API_BASE_URL}/bills?month=${selectedMonth}`;
        if (selectedBranch !== "All") {
            url += `&branch=${encodeURIComponent(selectedBranch)}`;
        }

        const res = await fetch(url);
        const monthBills = await res.json();

        if (monthBills.length === 0) {
            alert("No bills found for the selected month.");
            return;
        }

        let csv = "Bill Date,Branch,Bill No.,Std.,Gender,Payment Mode,Transaction ID,Items,Qty.,Amount,Total\n";
        monthBills.forEach(function (bill) {
            (bill.items || []).forEach(function (item) {
                csv += `${csvEscape(formatDate(bill.billDate))},${csvEscape(bill.branch || "")},${csvEscape(bill.billNo)},${csvEscape(bill.standard)},${csvEscape(bill.gender)},${csvEscape(bill.paymentMode || "")},${csvEscape(bill.transactionId || "")},${csvEscape(item.name)},${Number(item.quantity) || 0},${(Number(item.amount) || 0).toFixed(2)},${(Number(bill.total) || 0).toFixed(2)}\n`;
            });
        });

        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `${selectedMonth}-School-Sales.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
    } catch (err) {
        alert("Export failed: " + err.message);
    }
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

// --------------------------------------------------
// BUSINESS RULES & MATRIX EXCEL EXPORT
// --------------------------------------------------
const XLSX_COLUMNS = [
    "SHIRT", "HALF PANTS", "FULL PANTS", "SKIRT", 
    "SHOES", "SOCKS", "BLEZZER", "PT SHIRT", "PT PANTS"
];

function isJuniorBoyStandard(std) {
    const juniors = ["Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th"];
    return juniors.includes(std);
}

function formatToExcelDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2].padStart(2, "0");

    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = months[monthIndex] || parts[1];
    return `${day}-${month}-${year}`;
}

function expandBillItemsForMatrix(bill) {
    const expanded = {};

    (bill.items || []).forEach(item => {
        const name = (item.name || "").trim().toUpperCase();
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        if (name === "UNIFORM SET") {
            if (bill.gender === "Girl") {
                expanded["SHIRT"] = (expanded["SHIRT"] || 0) + qty;
                expanded["SKIRT"] = (expanded["SKIRT"] || 0) + qty;
                expanded["SHOES"] = (expanded["SHOES"] || 0) + qty;
                expanded["SOCKS"] = (expanded["SOCKS"] || 0) + qty;
            } else if (bill.gender === "Boy" && isJuniorBoyStandard(bill.standard)) {
                expanded["SHIRT"] = (expanded["SHIRT"] || 0) + qty;
                expanded["HALF PANTS"] = (expanded["HALF PANTS"] || 0) + qty;
                expanded["SHOES"] = (expanded["SHOES"] || 0) + qty;
                expanded["SOCKS"] = (expanded["SOCKS"] || 0) + qty;
            } else {
                expanded["SHIRT"] = (expanded["SHIRT"] || 0) + qty;
                expanded["FULL PANTS"] = (expanded["FULL PANTS"] || 0) + qty;
                expanded["SHOES"] = (expanded["SHOES"] || 0) + qty;
                expanded["SOCKS"] = (expanded["SOCKS"] || 0) + qty;
            }
        } else {
            let norm = name.replace(/-/g, " ");
            if (norm === "PT SHIRTS") norm = "PT SHIRT";
            if (norm === "BLAZZER") norm = "BLEZZER";
            expanded[norm] = (expanded[norm] || 0) + qty;
        }
    });

    const shoes = expanded["SHOES"] || 0;
    if (shoes > 0) {
        if (!expanded["SOCKS"] || expanded["SOCKS"] < shoes) {
            expanded["SOCKS"] = shoes;
        }
    }

    return expanded;
}

async function exportMatrixXLSX() {
    const selectedMonth = monthSelector.value;
    const selectedBranch = monthBranchFilter.value;

    if (!selectedMonth) {
        alert("Please select a month.");
        return;
    }

    try {
        let url = `${API_BASE_URL}/bills?month=${selectedMonth}`;
        if (selectedBranch !== "All") {
            url += `&branch=${encodeURIComponent(selectedBranch)}`;
        }

        const res = await fetch(url);
        const monthBills = await res.json();

        if (monthBills.length === 0) {
            alert("No bills found for the selected month.");
            return;
        }

        const excelRows = monthBills.map(bill => {
            const row = {
                "Transaction Req Date": formatToExcelDate(bill.billDate),
                "Settlement Date": "", 
                "Transaction Amount": Number(bill.total) || 0
            };

            XLSX_COLUMNS.forEach(col => row[col] = "");

            const expandedItems = expandBillItemsForMatrix(bill);
            XLSX_COLUMNS.forEach(col => {
                if (expandedItems[col]) {
                    row[col] = expandedItems[col];
                }
            });

            return row;
        });

        const emptyRow = {};
        const labelRow = { "Transaction Req Date": "", "Settlement Date": "", "Transaction Amount": "" };
        const totalRow = { "Transaction Req Date": "", "Settlement Date": "", "Transaction Amount": "" };

        XLSX_COLUMNS.forEach(col => {
            labelRow[col] = col;
            totalRow[col] = excelRows.reduce((sum, r) => sum + (Number(r[col]) || 0), 0);
        });

        excelRows.push(emptyRow, labelRow, totalRow);

        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, `${selectedMonth}-Sales-Matrix.xlsx`);
    } catch (err) {
        alert("Matrix export failed: " + err.message);
    }
}

// --------------------------------------------------
// EVENT LISTENERS
// --------------------------------------------------
addItemBtn.addEventListener("click", addItemRow);
paymentMode.addEventListener("change", handlePaymentMode);
clearBtn.addEventListener("click", clearForm);

itemsContainer.addEventListener("change", function (event) {
    if (event.target.classList.contains("item-name") || event.target.classList.contains("item-qty")) {
        syncAndRecalculateItems();
    }
});

itemsContainer.addEventListener("input", function (event) {
    if (event.target.classList.contains("item-amount")) {
        updateTotal();
    }
});

itemsContainer.addEventListener("click", function (event) {
    if (!event.target.classList.contains("remove-item-btn")) return;
    const rows = itemsContainer.querySelectorAll(".item-row");
    if (rows.length === 1) {
        alert("At least one item is required.");
        return;
    }
    event.target.closest(".item-row").remove();
    syncAndRecalculateItems();
});

// SUBMIT BILL -> SENDS POST REQUEST TO AWS LAMBDA & DYNAMODB
billForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const branchVal = branch.value.trim();
    const dateVal = billDate.value.trim();
    const currentBillNo = billNo.value.trim();
    const standardVal = standard.value.trim();
    const genderVal = gender.value.trim();
    const payModeVal = paymentMode.value.trim();
    const transIdVal = transactionId.value.trim();

    if (!branchVal) { alert("Please select a Branch."); branch.focus(); return; }
    if (!dateVal) { alert("Please select a Bill Date."); billDate.focus(); return; }
    if (!currentBillNo) { alert("Please enter a Bill Number."); billNo.focus(); return; }
    if (!standardVal) { alert("Please select a Standard."); standard.focus(); return; }
    if (!genderVal) { alert("Please select Gender."); gender.focus(); return; }
    if (!payModeVal) { alert("Please select a Payment Mode."); paymentMode.focus(); return; }

    const isOnline = (payModeVal === "Online");
    if (isOnline && !transIdVal) {
        alert("Transaction ID is mandatory for Online payments.");
        transactionId.focus();
        return;
    }

    const rows = itemsContainer.querySelectorAll(".item-row");
    if (rows.length === 0) {
        alert("Please add at least one item to this bill.");
        return;
    }

    const items = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nameSelect = row.querySelector(".item-name");
        const qtySelect = row.querySelector(".item-qty");
        const amountInput = row.querySelector(".item-amount");

        const nameVal = nameSelect ? nameSelect.value.trim() : "";
        const qtyVal = qtySelect ? parseInt(qtySelect.value, 10) : 0;
        const amountVal = amountInput ? parseFloat(amountInput.value) : NaN;

        if (!nameVal) { alert(`Row ${i + 1}: Please select an item.`); return; }
        if (!qtyVal || qtyVal < 1) { alert(`Row ${i + 1} (${nameVal}): Please choose a quantity.`); return; }
        if (isNaN(amountVal) || amountVal < 0 || amountInput.value.trim() === "") {
            alert(`Row ${i + 1} (${nameVal}): Amount cannot be empty.`); return;
        }

        items.push({
            name: nameVal,
            quantity: qtyVal,
            unitPrice: Number(itemPrices[nameVal]) || 0,
            amount: amountVal
        });
    }

    let total = 0;
    items.forEach(item => total += Number(item.amount) || 0);

    const billPayload = {
        branch: branchVal,
        billDate: dateVal,
        billNo: currentBillNo,
        standard: standardVal,
        gender: genderVal,
        paymentMode: payModeVal,
        transactionId: isOnline ? transIdVal : "",
        items: items,
        total: total
    };

    // Save to AWS Cloud API
    try {
        const res = await fetch(`${API_BASE_URL}/bills`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(billPayload)
        });

        const data = await res.json();

        if (!res.ok) {
            // Catches 409 duplicate Bill No / Transaction ID from DynamoDB
            alert(data.message || "Failed to save bill on server.");
            return;
        }

        alert(`Bill #${billPayload.billNo} saved successfully in DynamoDB!`);

        clearForm();
        fetchAndDisplayTodayBills();
        updateMonthlySummary();
        setNextBillNumber();
    } catch (err) {
        console.error("Save error:", err);
        alert("Network or API error: Could not reach AWS backend.");
    }
});

if (viewMonthBtn) viewMonthBtn.addEventListener("click", updateMonthlySummary);
if (exportBtn) exportBtn.addEventListener("click", exportCSV);
if (exportMatrixXlsxBtn) exportMatrixXlsxBtn.addEventListener("click", exportMatrixXLSX);

billsTableBody.addEventListener("click", function (event) {
    if (!event.target.classList.contains("delete-btn")) return;
    const btn = event.target;
    deleteBill(
        btn.getAttribute("data-branch"),
        btn.getAttribute("data-date"),
        btn.getAttribute("data-billno")
    );
});

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------
setDefaultDate();
restoreBranchSelection();
itemsContainer.innerHTML = "";
addItemRow();
handlePaymentMode();
setNextBillNumber();
fetchAndDisplayTodayBills();
updateMonthlySummary();
updateTotal();
