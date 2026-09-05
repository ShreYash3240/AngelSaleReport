// ==================================================
// UNIFORM DEPARTMENT - MONTHLY & RANGE REPORT (monthly-sales.js)
// ==================================================
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

// DOM Elements
const reportFromDate = document.getElementById("reportFromDate");
const reportToDate = document.getElementById("reportToDate");
const reportBranch = document.getElementById("reportBranch");
const loadReportBtn = document.getElementById("loadReportBtn");
const thisMonthBtn = document.getElementById("thisMonthBtn");
const lastMonthBtn = document.getElementById("lastMonthBtn");
const exportExcelBtn = document.getElementById("exportExcelBtn");

const summaryTotal = document.getElementById("summaryTotal");
const summaryCount = document.getElementById("summaryCount");
const summaryCash = document.getElementById("summaryCash");
const summaryOnline = document.getElementById("summaryOnline");
const tableRecordCount = document.getElementById("tableRecordCount");

const reportBody = document.getElementById("reportBody");
const reportEmptyMessage = document.getElementById("reportEmptyMessage");

const XLSX_COLUMNS = [
    "SHIRT", "HALF PANTS", "FULL PANTS", "SKIRT", 
    "SHOES", "SOCKS", "BLAZZER", "BELT", "PT SHIRT", "PT PANT"
];

let cachedUniformBills = [];
let currentUniformChart = null;

// Friendly Custom Popup Function
function showPopup(message, type = "info") {
    const modal = document.getElementById("customAlertModal");
    const msgEl = document.getElementById("customAlertMessage");
    const titleEl = document.getElementById("customAlertTitle");
    const iconEl = document.getElementById("customAlertIcon");
    const okBtn = document.getElementById("customAlertOkBtn");

    if (!modal) {
        // Fallback if modal isn't present on page yet
        alert(message);
        return;
    }

    msgEl.textContent = message;

    // Customize styling based on message type
    if (type === "success") {
        titleEl.textContent = "Success!";
        iconEl.textContent = "✅";
        okBtn.style.background = "#16a34a"; // Friendly Green
    } else if (type === "error") {
        titleEl.textContent = "Action Needed";
        iconEl.textContent = "⚠️";
        okBtn.style.background = "#dc2626"; // Clear Red
    } else {
        titleEl.textContent = "Information";
        iconEl.textContent = "ℹ️";
        okBtn.style.background = "#0284c7"; // Friendly Blue
    }

    modal.style.display = "flex";

    // Close action
    okBtn.onclick = () => {
        modal.style.display = "none";
    };
}

// ==================================================
// AUTHENTICATION & HEADERS
// ==================================================
function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("cognito_id_token");
    localStorage.removeItem("selectedBranch");
    window.location.replace("/login.html");
}

function getStoredToken() {
    return sessionStorage.getItem("cognito_id_token") || localStorage.getItem("cognito_id_token");
}

(function enforceAuth() {
    const token = getStoredToken();
    if (!token) return window.location.replace("/login.html");

    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        const payload = JSON.parse(json);

        if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
            handleLogout();
            return;
        }

        const emailDisplay = document.getElementById("userEmailDisplay");
        if (emailDisplay) emailDisplay.textContent = payload.name || payload.email || "Accountant";

        const container = document.getElementById("appContainer");
        if (container) container.style.display = "block";

        const authBtn = document.getElementById("authBtn");
        if (authBtn) {
            authBtn.onclick = (e) => {
                e.preventDefault();
                handleLogout();
            };
        }
    } catch {
        handleLogout();
    }
})();

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getStoredToken()}`
    };
}

// ==================================================
// DATE UTILITIES & DATA NORMALIZATION
// ==================================================
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
    if (!std) return "Other";
    let s = String(std).trim().toUpperCase();

    if (s.includes("NUR")) return "Nursery";
    if (s.includes("JR") || s.includes("LKG")) return "Jr. KG";
    if (s.includes("SR") || s.includes("UKG")) return "Sr. KG";

    // Extract leading digit: "5th Diamond", "5th A", "5-B" -> "5th"
    const digitMatch = s.match(/\b([1-9]|10)\b/) || s.match(/^([1-9]|10)/);
    if (digitMatch) {
        const num = digitMatch[1];
        const suffixes = { "1": "1st", "2": "2nd", "3": "3rd" };
        return suffixes[num] || `${num}th`;
    }

    const romanMap = {
        "I": "1st", "II": "2nd", "III": "3rd", "IV": "4th", "V": "5th",
        "VI": "6th", "VII": "7th", "VIII": "8th", "IX": "9th", "X": "10th"
    };
    for (const [roman, normalized] of Object.entries(romanMap)) {
        const regex = new RegExp(`\\b${roman}\\b`, "i");
        if (regex.test(s)) return normalized;
    }

    return toTitleCase(std);
}

function setMonthRange(year, monthIndex) {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    reportFromDate.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
    reportToDate.value = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

function getMonthsInRange(fromStr, toStr) {
    const months = [];
    const [fromY, fromM] = fromStr.split("-").map(Number);
    const [toY, toM] = toStr.split("-").map(Number);

    let curY = fromY;
    let curM = fromM;

    while (curY < toY || (curY === toY && curM <= toM)) {
        months.push(`${curY}-${String(curM).padStart(2, "0")}`);
        curM++;
        if (curM > 12) {
            curM = 1;
            curY++;
        }
    }
    return months;
}

// ==================================================
// UNIFORM ITEM EXPANSION ENGINE
// ==================================================
function isJuniorBoyStandard(std) {
    const s = String(std || "").trim().toUpperCase();
    const juniors = new Set([
        "NURSERY", "JR. KG", "JR. KG.", "SR. KG", "SR. KG.", "LKG", "UKG", 
        "1ST", "2ND", "3RD", "4TH", "5TH", "6TH", 
        "I", "II", "III", "IV", "V", "VI"
    ]);
    for (const jr of juniors) {
        if (s.startsWith(jr)) return true;
    }
    return false;
}

function expandBillItems(bill) {
    const expanded = Object.create(null);
    XLSX_COLUMNS.forEach(col => expanded[col] = 0);

    const isGirl = String(bill.gender || "").trim().toUpperCase().startsWith("G");
    const isJuniorBoy = isJuniorBoyStandard(bill.standard);

    (bill.items || []).forEach(item => {
        let name = (item.name || "").trim().toUpperCase();
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        // 1. SET / UNIFORM SET
        if (name === "SET" || name === "UNIFORM SET" || name.includes("FULL SET")) {
            expanded["SHIRT"] += qty;
            if (isGirl) {
                expanded["SKIRT"] += qty;
            } else if (isJuniorBoy) {
                expanded["HALF PANTS"] += qty;
            } else {
                expanded["FULL PANTS"] += qty;
            }
            expanded["SHOES"] += qty;
            expanded["SOCKS"] += qty;
        } 
        // 2. SHIRT & PANT
        else if (name === "SHIRT & PANT" || name === "SHIRT, PANT" || name === "SHIRT PANT") {
            expanded["SHIRT"] += qty;
            if (isJuniorBoy) {
                expanded["HALF PANTS"] += qty;
            } else {
                expanded["FULL PANTS"] += qty;
            }
        } 
        // 3. SHIRT & SKIRT
        else if (name === "SHIRT & SKIRT" || name === "SHIRT, SKIRT") {
            expanded["SHIRT"] += qty;
            expanded["SKIRT"] += qty;
        } 
        // 4. SHOES & SOCKS / ONLY SHOES SET / SHOES SET
        else if (
            name === "SHOES & SOCKS" || 
            name === "SHOES, SOCKS" || 
            name.includes("SHOES SET") || 
            name.includes("ONLY SHOES SET") ||
            name === "SHOES AND SOCKS"
        ) {
            expanded["SHOES"] += qty;
            expanded["SOCKS"] += qty;
        } 
        // 5. ONLY SHOES (without socks)
        else if (name === "ONLY SHOES" || name === "SHOES") {
            expanded["SHOES"] += qty;
        }
        // 6. ONLY SOCKS / SOCKS
        else if (name === "ONLY SOCKS" || name === "SOCKS") {
            expanded["SOCKS"] += qty;
        } 
        // 7. Direct Matches (BLAZZER, BELT, PT SHIRT, PT PANT)
        else {
            let normalized = name.replace(/-/g, " ");
            if (normalized === "BLEZZER") normalized = "BLAZZER";
            if (normalized === "PT SHIRTS") normalized = "PT SHIRT";
            if (normalized === "PT PANTS") normalized = "PT PANT";

            if (normalized in expanded) {
                expanded[normalized] += qty;
            }
        }
    });

    return expanded;
}

// ==================================================
// S3 VAULT PRE-SIGNED URL VIEWER (IN-PAGE MODAL)
// ==================================================
async function viewReceiptImage(s3Key) {
    if (!s3Key) {
        showPopup("No original receipt image on file for this bill.", "error");
        return;
    }

    const modal = document.getElementById("receiptModal");
    const modalImg = document.getElementById("modalReceiptImg");

    try {
        const res = await fetch(`${API_BASE_URL}/receipt-url?action=view&s3Key=${encodeURIComponent(s3Key)}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok || !data.viewUrl) throw new Error(data.message || "Could not retrieve image");

        // Display directly in on-screen popup modal
        if (modal && modalImg) {
            modalImg.src = data.viewUrl;
            modal.style.display = "flex";
        } else {
            // Fallback if modal is missing
            window.open(data.viewUrl, "_blank");
        }
    } catch (err) {
        showPopup("Failed to load receipt: " + err.message, "error");
    }
}
window.viewReceiptImage = viewReceiptImage;

// Modal Close Listeners
document.getElementById("closeReceiptModalBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("receiptModal");
    if (modal) modal.style.display = "none";
});
document.getElementById("closeReceiptModalFooterBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("receiptModal");
    if (modal) modal.style.display = "none";
});
document.getElementById("receiptModal")?.addEventListener("click", (e) => {
    if (e.target.id === "receiptModal") e.target.style.display = "none";
});

// ==================================================
// DATA FETCHING & REPORT RENDER
// ==================================================
async function loadReport() {
    const from = reportFromDate.value;
    const to = reportToDate.value;
    const branch = reportBranch.value;

    if (!from || !to) return alert("Please select both From and To dates.");
    if (from > to) return alert("From Date cannot be later than To Date.");

    // 12 columns alignment
    reportBody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 24px;">Generating uniform report...</td></tr>`;
    if (reportEmptyMessage) reportEmptyMessage.style.display = "none";

    const monthsToFetch = getMonthsInRange(from, to);

    try {
        // Fetch all months concurrently
        const fetchPromises = monthsToFetch.map(month => {
            let url = `${API_BASE_URL}/bills?department=Uniform&month=${month}`;
            if (branch !== "All") url += `&branch=${encodeURIComponent(branch)}`;
            return fetch(url, { headers: getAuthHeaders() }).then(res => res.ok ? res.json() : []);
        });

        const results = await Promise.all(fetchPromises);
        const allBills = results.flat();

        const seen = new Set();
        cachedUniformBills = allBills.filter(b => {
            if (b.department && b.department !== "Uniform") return false;
            if (b.billDate < from || b.billDate > to) return false;
            
            const key = b._id || b.id || `${b.branch || ""}_${b.billDate}_${b.billNo}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        cachedUniformBills.sort((a, b) => 
            (b.billDate || "").localeCompare(a.billDate || "") || 
            String(b.billNo).localeCompare(String(a.billNo))
        );

        renderReportTable(cachedUniformBills);
    } catch (err) {
        console.error("Uniform report fetch error:", err);
        reportBody.innerHTML = `<tr><td colspan="12" style="color:red; text-align:center; padding: 20px;">Failed to load report: ${escapeHTML(err.message)}</td></tr>`;
    }
}

function renderReportTable(bills) {
    reportBody.innerHTML = "";

    let totalRevenue = 0;
    let cashRevenue = 0;
    let onlineRevenue = 0;

    if (bills.length === 0) {
        if (reportEmptyMessage) reportEmptyMessage.style.display = "block";
        summaryTotal.textContent = "₹0.00";
        summaryCount.textContent = "0";
        summaryCash.textContent = "₹0.00";
        summaryOnline.textContent = "₹0.00";
        tableRecordCount.textContent = "0";
        renderUniformsChart();
        return;
    }

    if (reportEmptyMessage) reportEmptyMessage.style.display = "none";

    const fragment = document.createDocumentFragment();

    bills.forEach(bill => {
        const amt = Number(bill.total) || 0;
        totalRevenue += amt;
        if (bill.paymentMode === "Online") onlineRevenue += amt;
        else cashRevenue += amt;

        let totalQty = 0;
        const itemBreakdown = (bill.items || []).map(i => {
            const q = Number(i.quantity) || 0;
            totalQty += q;
            return `<div>${escapeHTML(i.name)}${i.size ? ` (${escapeHTML(i.size)})` : ""} × ${q} (₹${(Number(i.amount) || 0).toFixed(2)})</div>`;
        }).join("");

        // S3 Receipt Vault view action (using action=view)
        const receiptAction = bill.receiptS3Key 
            ? `<a href="${API_BASE_URL}/receipt-url?action=view&s3Key=${encodeURIComponent(bill.receiptS3Key)}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: #e0f2fe; color: #0284c7; border-radius: 6px; font-weight: 600; font-size: 0.75rem; text-decoration: none;" title="View Digital Receipt Slip">📷 View</a>` 
            : `<span style="color: #94a3b8; font-size: 0.75rem;">-</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(bill.billDate)}</td>
            <td>${escapeHTML(bill.branch || "-")}</td>
            <td><strong>${escapeHTML(bill.billNo)}</strong></td>
            <td><strong>${escapeHTML(toTitleCase(bill.studentName) || "-")}</strong></td>
            <td>${escapeHTML(normalizeStandard(bill.standard))}</td>
            <td>${escapeHTML(bill.gender || "")}</td>
            <td>${escapeHTML(bill.paymentMode || "")}</td>
            <td>${escapeHTML(bill.transactionId || "-")}</td>
            <td class="item-list">${itemBreakdown}</td>
            <td>${totalQty}</td>
            <td><strong>₹${amt.toFixed(2)}</strong></td>
            <td style="text-align: center;">${receiptAction}</td>
        `;
        fragment.appendChild(tr);
    });

    reportBody.appendChild(fragment);

    summaryTotal.textContent = `₹${totalRevenue.toFixed(2)}`;
    summaryCount.textContent = bills.length;
    summaryCash.textContent = `₹${cashRevenue.toFixed(2)}`;
    summaryOnline.textContent = `₹${onlineRevenue.toFixed(2)}`;
    tableRecordCount.textContent = bills.length;

    renderUniformsChart();
}

// ==================================================
// CHART.JS CLIENT-SIDE ANALYTICS
// ==================================================
function renderUniformsChart() {
    const canvas = document.getElementById("salesChartCanvas");
    const chartTypeSelect = document.getElementById("chartTypeSelect");
    if (!canvas || !window.Chart) return;

    if (currentUniformChart) {
        currentUniformChart.destroy();
        currentUniformChart = null;
    }

    if (!cachedUniformBills || cachedUniformBills.length === 0) return;

    const ctx = canvas.getContext("2d");
    const type = chartTypeSelect?.value || "bar";

    if (type === "bar") {
        const stdTotals = {};
        cachedUniformBills.forEach(b => {
            const std = normalizeStandard(b.standard);
            stdTotals[std] = (stdTotals[std] || 0) + (Number(b.total) || 0);
        });

        currentUniformChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: Object.keys(stdTotals),
                datasets: [{
                    label: "Revenue (₹)",
                    data: Object.values(stdTotals),
                    backgroundColor: "#1d4ed8",
                    hoverBackgroundColor: "#1e40af",
                    borderRadius: 6,
                    maxBarThickness: 45
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` Revenue: ₹${Number(c.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => "₹" + Number(v).toLocaleString("en-IN") },
                        grid: { color: "#f1f5f9" }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    } else if (type === "pie") {
        const payTotals = { Cash: 0, "Online / UPI": 0 };
        cachedUniformBills.forEach(b => {
            if (b.paymentMode === "Online") payTotals["Online / UPI"] += (Number(b.total) || 0);
            else payTotals["Cash"] += (Number(b.total) || 0);
        });

        currentUniformChart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: Object.keys(payTotals),
                datasets: [{
                    data: Object.values(payTotals),
                    backgroundColor: ["#f59e0b", "#1d4ed8"],
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` ₹${Number(c.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                }
            }
        });
    } else if (type === "itemsPie") {
        const itemTotals = {};
        XLSX_COLUMNS.forEach(col => itemTotals[col] = 0);

        cachedUniformBills.forEach(b => {
            const expanded = expandBillItems(b);
            XLSX_COLUMNS.forEach(col => {
                itemTotals[col] += (expanded[col] || 0);
            });
        });

        const activeLabels = [];
        const activeCounts = [];
        XLSX_COLUMNS.forEach(col => {
            if (itemTotals[col] > 0) {
                activeLabels.push(col);
                activeCounts.push(itemTotals[col]);
            }
        });

        const itemPalette = [
            "#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed",
            "#0891b2", "#db2777", "#4b5563", "#ea580c", "#16a34a"
        ];

        currentUniformChart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: activeLabels,
                datasets: [{
                    data: activeCounts,
                    backgroundColor: itemPalette.slice(0, activeLabels.length),
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: "bottom",
                        labels: { boxWidth: 14, padding: 12, font: { size: 11, weight: "bold" } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` ${c.label}: ${c.raw} units sold`
                        }
                    }
                }
            }
        });
    } else if (type === "line") {
        const dailyTotals = {};
        cachedUniformBills.forEach(b => {
            const dt = b.billDate || "";
            if (dt) dailyTotals[dt] = (dailyTotals[dt] || 0) + (Number(b.total) || 0);
        });

        const sortedDates = Object.keys(dailyTotals).sort();
        const sortedValues = sortedDates.map(d => dailyTotals[d]);

        currentUniformChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: sortedDates.map(d => {
                    const p = d.split("-");
                    return p.length === 3 ? `${p[2]}/${p[1]}` : d;
                }),
                datasets: [{
                    label: "Daily Collection (₹)",
                    data: sortedValues,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    borderWidth: 2.5,
                    pointBackgroundColor: "#ef4444",
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` Total: ₹${Number(c.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => "₹" + Number(v).toLocaleString("en-IN") },
                        grid: { color: "#f1f5f9" }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

document.getElementById("chartTypeSelect")?.addEventListener("change", renderUniformsChart);

// ==================================================
// EXCEL MATRIX EXPORT (.XLSX)
// ==================================================
function exportUniformXlsx() {
    if (!cachedUniformBills || cachedUniformBills.length === 0) {
        alert("No uniform bills to export for this date range.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Excel export library is not loaded. Please check your network.");
        return;
    }

    const rows = cachedUniformBills.map(bill => {
        const row = {
            "Bill No.": bill.billNo || "",
            "Branch": bill.branch || "",
            "Student Name": toTitleCase(bill.studentName) || "",
            "Standard": normalizeStandard(bill.standard) || "",
            "Gender": bill.gender || "",
            "Payment Mode": bill.paymentMode || "",
            "Transaction ID": bill.transactionId || "",
            "Bill Date": formatDate(bill.billDate),
            "Total Amount": Number(bill.total) || 0
        };

        const expanded = expandBillItems(bill);
        XLSX_COLUMNS.forEach(col => {
            row[col] = expanded[col] > 0 ? expanded[col] : "";
        });

        return row;
    });

    const emptyRow = {};
    const labelRow = { 
        "Bill No.": "", "Branch": "", "Student Name": "", "Standard": "", 
        "Gender": "", "Payment Mode": "", "Transaction ID": "", 
        "Bill Date": "TOTAL QUANTITIES:", "Total Amount": cachedUniformBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0)
    };

    XLSX_COLUMNS.forEach(col => {
        let colTotal = 0;
        cachedUniformBills.forEach(b => {
            const exp = expandBillItems(b);
            colTotal += exp[col] || 0;
        });
        labelRow[col] = colTotal;
    });

    const exportData = [...rows, emptyRow, labelRow];
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Uniform Sales Matrix");

    const fileName = `Uniform_Sales_${reportFromDate.value}_to_${reportToDate.value}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

// ==================================================
// EVENT LISTENERS & INIT
// ==================================================
loadReportBtn?.addEventListener("click", loadReport);
exportExcelBtn?.addEventListener("click", exportUniformXlsx);

thisMonthBtn?.addEventListener("click", () => {
    const d = new Date();
    setMonthRange(d.getFullYear(), d.getMonth());
    loadReport();
});

lastMonthBtn?.addEventListener("click", () => {
    const d = new Date();
    setMonthRange(d.getFullYear(), d.getMonth() - 1);
    loadReport();
});

reportBranch?.addEventListener("change", loadReport);

const now = new Date();
setMonthRange(now.getFullYear(), now.getMonth());

const savedBranch = localStorage.getItem("selectedBranch");
if (savedBranch && reportBranch) {
    reportBranch.value = savedBranch;
}

loadReport();
