// ==================================================
// UNIFORM DEPARTMENT - BILL ENTRY (app.js)
// ==================================================
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

const billForm = document.getElementById("billForm");
const branch = document.getElementById("branch");
const billDate = document.getElementById("billDate");
const billNo = document.getElementById("billNo");
const studentName = document.getElementById("studentName");
const standard = document.getElementById("standard");
const gender = document.getElementById("gender");
const paymentMode = document.getElementById("paymentMode");
const transactionIdGroup = document.getElementById("transactionIdGroup");
const transactionId = document.getElementById("transactionId");

const itemsContainer = document.getElementById("itemsContainer");
const addItemBtn = document.getElementById("addItemBtn");
const billTotal = document.getElementById("billTotal");
const clearBtn = document.getElementById("clearBtn");

const PT_SIZES = ["24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44", "46"];

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
// PRICING LOOKUP
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

    if (itemName === "PT SHIRT" || itemName === "PT PANT") {
        if (!size) return 0;
        return typeof PT_UNIFORM_PRICE_MATRIX !== "undefined" ? (PT_UNIFORM_PRICE_MATRIX[size]?.[itemName] ?? 0) : 0;
    }

    const std = standard.value.trim();
    const gen = gender.value.trim();
    if (!std || !gen) return 0;

    return typeof UNIFORM_PRICE_MATRIX !== "undefined" ? (UNIFORM_PRICE_MATRIX[std]?.[gen]?.[itemName] ?? 0) : 0;
}

// ==================================================
// DYNAMIC ITEM ROWS
// ==================================================
function createItemRow() {
    const row = document.createElement("div");
    row.className = "item-row";

    const select = document.createElement("select");
    select.className = "item-name";
    select.required = true;
    const items = getAvailableUniformItems();
    select.innerHTML = `<option value="">Select Item</option>` + 
        items.map(i => `<option value="${i}">${i}</option>`).join("");

    const sizeSelect = document.createElement("select");
    sizeSelect.className = "item-size";
    sizeSelect.disabled = true;
    sizeSelect.innerHTML = `<option value="">-</option>` + 
        PT_SIZES.map(s => `<option value="${s}">${s}</option>`).join("");

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

        if (isPT) {
            sizeSelect.disabled = false;
            sizeSelect.required = true;
            if (sizeSelect.value === "") sizeSelect.options[0].textContent = "Size *";
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

const UNIFORM_BILL_PREFIX = "U";

function formatUniformBillNo(num) {
    return `${UNIFORM_BILL_PREFIX}${String(num).padStart(4, "0")}`;
}

async function setNextBillNumber() {
    try {
        const res = await fetch(`${API_BASE_URL}/bills?department=Uniform`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error();
        const bills = await res.json();

        let maxNum = 0;
        bills.forEach(b => {
            const raw = String(b.billNo || "").trim();
            const cleaned = raw.toUpperCase().replace(/^U/, "");
            const parsed = parseInt(cleaned, 10);
            if (!isNaN(parsed) && parsed > maxNum) {
                maxNum = parsed;
            }
        });

        billNo.value = formatUniformBillNo(maxNum + 1);
    } catch {
        billNo.value = formatUniformBillNo(1);
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
// EVENT LISTENERS
// ==================================================
branch?.addEventListener("change", () => {
    localStorage.setItem("selectedBranch", branch.value);
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
        department: "Uniform",
        branch: branch.value.trim(),
        billDate: billDate.value.trim(),
        billNo: billNo.value.trim(),
        studentName: studentName.value.trim(),
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
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || "Failed to save bill.");

        alert(`Uniform Bill #${payload.billNo} saved successfully!`);
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
addItemRow();
handlePaymentMode();
setNextBillNumber();
