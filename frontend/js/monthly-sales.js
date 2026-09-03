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

// Individual uniform item breakdown columns for Matrix Export
const XLSX_COLUMNS = [
    "SHIRT", "HALF PANTS", "FULL PANTS", "SKIRT", 
    "SHOES", "SOCKS", "BLAZZER", "BELT", "PT SHIRT", "PT PANT"
];

let cachedUniformBills = [];

// ==================================================
// AUTHENTICATION & HEADERS
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
        window.location.replace("/login.html");
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
// DATE UTILITIES
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

function setMonthRange(year, monthIndex) {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    reportFromDate.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
    reportToDate.value = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

// Generates an array of all "YYYY-MM" partitions between two dates
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
    const juniors = ["NURSERY", "JR. KG.", "SR. KG.", "LKG", "UKG", "I", "II", "III", "IV", "V", "VI", "1ST", "2ND", "3RD", "4TH", "5TH", "6TH"];
    return juniors.includes(String(std || "").trim().toUpperCase());
}

function expandBillItems(bill) {
    const expanded = {};
    XLSX_COLUMNS.forEach(col => expanded[col] = 0);

    const isGirl = String(bill.gender || "").trim().toUpperCase().startsWith("G");
    const isJuniorBoy = isJuniorBoyStandard(bill.standard);

    (bill.items || []).forEach(item => {
        let name = (item.name || "").trim().toUpperCase();
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        // 1. SET / UNIFORM SET
        if (name === "SET" || name === "UNIFORM SET") {
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
        else if (name === "SHIRT & PANT" || name === "SHIRT, PANT") {
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
        // 4. SHOES & SOCKS
        else if (name === "SHOES & SOCKS" || name === "SHOES, SOCKS") {
            expanded["SHOES"] += qty;
            expanded["SOCKS"] += qty;
        } 
        // 5. ONLY SOCKS
        else if (name === "ONLY SOCKS") {
            expanded["SOCKS"] += qty;
        } 
        // 6. Direct Matches (BLAZZER, BELT, PT SHIRT, PT PANT, etc.)
        else {
            let normalized = name.replace(/-/g, " ");
            if (normalized === "BLEZZER") normalized = "BLAZZER";
            if (normalized === "PT SHIRTS") normalized = "PT SHIRT";
            if (normalized === "PT PANTS") normalized = "PT PANT";

            if (expanded.hasOwnProperty(normalized)) {
                expanded[normalized] += qty;
            }
        }
    });

    return expanded;
}

// ==================================================
// DATA FETCHING & REPORT RENDER
// ==================================================
async function loadReport() {
    const from = reportFromDate.value;
    const to = reportToDate.value;
    const branch = reportBranch.value;

    if (!from || !to) return alert("Please select both From and To dates.");
    if (from > to) return alert("From Date cannot be later than To Date.");

    reportBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 24px;">Generating uniform report...</td></tr>`;
    if (reportEmptyMessage) reportEmptyMessage.style.display = "none";

    const monthsToFetch = getMonthsInRange(from, to);

    try {
        let allBills = [];

        for (const month of monthsToFetch) {
            let url = `${API_BASE_URL}/bills?department=Uniform&month=${month}`;
            if (branch !== "All") url += `&branch=${encodeURIComponent(branch)}`;
            
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                allBills = allBills.concat(data);
            }
        }

        // Filter exact inclusive range and prevent duplicate keys
        const seen = new Set();
        cachedUniformBills = allBills.filter(b => {
            if (b.department && b.department !== "Uniform") return false;
            if (b.billDate < from || b.billDate > to) return false;
            const key = `${b.branch || ""}_${b.billDate}_${b.billNo}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort descending by date, then bill number
        cachedUniformBills.sort((a, b) => 
            (b.billDate || "").localeCompare(a.billDate || "") || 
            String(b.billNo).localeCompare(String(a.billNo))
        );

        renderReportTable(cachedUniformBills);
    } catch (err) {
        console.error("Uniform report fetch error:", err);
        reportBody.innerHTML = `<tr><td colspan="11" style="color:red; text-align:center; padding: 20px;">Failed to load report: ${err.message}</td></tr>`;
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
        return;
    }

    if (reportEmptyMessage) reportEmptyMessage.style.display = "none";

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

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(bill.billDate)}</td>
            <td>${escapeHTML(bill.branch || "-")}</td>
            <td><strong>${escapeHTML(bill.billNo)}</strong></td>
            <td><strong>${escapeHTML(bill.studentName || "-")}</strong></td>
            <td>${escapeHTML(bill.standard)}</td>
            <td>${escapeHTML(bill.gender || "")}</td>
            <td>${escapeHTML(bill.paymentMode || "")}</td>
            <td>${escapeHTML(bill.transactionId || "-")}</td>
            <td class="item-list">${itemBreakdown}</td>
            <td>${totalQty}</td>
            <td><strong>₹${amt.toFixed(2)}</strong></td>
        `;
        reportBody.appendChild(tr);
    });

    summaryTotal.textContent = `₹${totalRevenue.toFixed(2)}`;
    summaryCount.textContent = bills.length;
    summaryCash.textContent = `₹${cashRevenue.toFixed(2)}`;
    summaryOnline.textContent = `₹${onlineRevenue.toFixed(2)}`;
    tableRecordCount.textContent = bills.length;
}

// ==================================================
// CHART.JS CLIENT-SIDE ANALYTICS (UNIFORM)
// ==================================================
let currentUniformChart = null;

function renderUniformsChart() {
    const canvas = document.getElementById("salesChartCanvas");
    const chartTypeSelect = document.getElementById("chartTypeSelect");
    if (!canvas || !window.Chart) return;

    // Destroy existing chart instance before creating a new one
    if (currentUniformChart) {
        currentUniformChart.destroy();
        currentUniformChart = null;
    }

    if (!cachedUniformBills || cachedUniformBills.length === 0) return;

    const ctx = canvas.getContext("2d");
    const type = chartTypeSelect?.value || "bar";

    if (type === "bar") {
        // Aggregate revenue by standard
        const stdTotals = {};
        cachedUniformBills.forEach(b => {
            const std = b.standard || "Other";
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
                            label: (ctx) => ` Revenue: ₹${Number(ctx.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => "₹" + Number(v).toLocaleString("en-IN") },
                        grid: { color: "#f1f5f9" }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });

    } else if (type === "pie") {
        // Aggregate Cash vs Online collection
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
                            label: (ctx) => ` ₹${Number(ctx.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                }
            }
        });

    } else if (type === "itemsPie") {
        // Aggregate individual garment/item quantities sold using expandBillItems()
        const itemTotals = {};
        XLSX_COLUMNS.forEach(col => itemTotals[col] = 0);

        cachedUniformBills.forEach(b => {
            const expanded = expandBillItems(b);
            XLSX_COLUMNS.forEach(col => {
                itemTotals[col] += (expanded[col] || 0);
            });
        });

        // Only include items that have at least 1 unit sold
        const activeLabels = [];
        const activeCounts = [];
        XLSX_COLUMNS.forEach(col => {
            if (itemTotals[col] > 0) {
                activeLabels.push(col);
                activeCounts.push(itemTotals[col]);
            }
        });

        // Vibrant palette for individual items
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
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw} units sold`
                        }
                    }
                }
            }
        });

    } else if (type === "line") {
        // Daily timeline trend
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
                            label: (ctx) => ` Total: ₹${Number(ctx.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => "₹" + Number(v).toLocaleString("en-IN") },
                        grid: { color: "#f1f5f9" }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

// Re-render chart on dropdown change
document.getElementById("chartTypeSelect")?.addEventListener("change", renderUniformsChart);

// Hook automatically into the table renderer
const baseRenderReportTable = renderReportTable;
renderReportTable = function(bills) {
    baseRenderReportTable(bills);
    renderUniformsChart();
};

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

    // Build normalized rows with individual column breakdown
    const rows = cachedUniformBills.map(bill => {
        const row = {
            "Bill No.": bill.billNo || "",
            "Branch": bill.branch || "",
            "Student Name": bill.studentName || "",
            "Standard": bill.standard || "",
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

    // Summary calculation rows
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

// Init with current month range
const d = new Date();
setMonthRange(d.getFullYear(), d.getMonth());

const savedBranch = localStorage.getItem("selectedBranch");
if (savedBranch && reportBranch) {
    reportBranch.value = savedBranch;
}

loadReport();
