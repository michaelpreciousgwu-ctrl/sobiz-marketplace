// --- 1. GLOBAL INSTANCES & DB STORAGE RETRIEVAL ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
}

let inventory = JSON.parse(localStorage.getItem('sobiz_inventory')) || [];
let ledgerLogs = JSON.parse(localStorage.getItem('sobiz_ledger')) || [];
let salesLogs = JSON.parse(localStorage.getItem('sobiz_sales')) || [];
let complaints = JSON.parse(localStorage.getItem('sobiz_complaints')) || [];

const ADMIN_SECRET_PIN = "1234"; 
const ADMIN_PHONE_NUMBER = "2348000000000"; 

const DEFAULT_TEXT_NOTICE = "Flour prices are fluctuating from raw suppliers. Adjust retail fields accordingly.";
const DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";

let stagingLocalBlobUrl = "";

const themes = {
    default: { primary: "#2563eb", bg: "#f8fafc", cardBg: "#ffffff", text: "#0f172a", badgeText: "#0f172a" },
    artisan: { primary: "#b45309", bg: "#fdf8f2", cardBg: "#ffffff", text: "#1e1b4b", badgeText: "#451a03" },
    trader:  { primary: "#ea580c", bg: "#fff7ed", cardBg: "#ffffff", text: "#0f172a", badgeText: "#431407" },
    dark:    { primary: "#3b82f6", bg: "#0f172a", cardBg: "#1e293b", text: "#f8fafc", badgeText: "#0f172a" } 
};

// --- STAFF ACCESS CONTROL PORTAL GATEWAY ---
function openStaffModal() {
    document.getElementById('staffEntranceModal').classList.remove('hidden');
}

function closeStaffModal() {
    document.getElementById('staffEntranceModal').classList.add('hidden');
}

function saveModalSetupProfile() {
    const selectedTier = document.getElementById('modalBizTier').value;
    localStorage.setItem('so_biz_tier', selectedTier);
    
    let targetedTheme = "default";
    if (selectedTier === "Artisan") targetedTheme = "artisan";
    if (selectedTier === "Petty Trader") targetedTheme = "trader";
    if (selectedTier === "Supermarket") targetedTheme = "dark";
    
    localStorage.setItem('sobiz_theme_choice', targetedTheme);
    
    const themeSelector = document.getElementById('uiTheme');
    if (themeSelector) { themeSelector.value = targetedTheme; }
    changeWorkspaceTheme();
    
    closeStaffModal();
    showDashboard();
}

function triggerModalAdminAuth() {
    const enteredPin = prompt("Enter Administrator Security PIN:");
    if (enteredPin === ADMIN_SECRET_PIN) {
        closeStaffModal();
        
        // If not loaded into a workspace yet, choose a default one to safely initialize backing views
        if (!localStorage.getItem('so_biz_tier')) {
            localStorage.setItem('so_biz_tier', 'Artisan');
        }
        
        showDashboard();
        
        const adminCard = document.getElementById('adminPanelCard');
        if (adminCard) {
            adminCard.classList.remove('hidden');
            renderAdminInbox();
            adminCard.scrollIntoView({ behavior: 'smooth' });
        }
    } else {
        alert("Incorrect PIN access denied.");
    }
}

// --- PUBLIC LANDING STOREFRONT LOGIC ---
function showPublicStorefrontLanding() {
    document.getElementById('workspace').classList.add('hidden');
    document.getElementById('globalNotificationHub').classList.add('hidden');
    document.getElementById('themeSelectorGroup').classList.add('hidden');
    document.getElementById('adminPanelCard').classList.add('hidden');
    
    document.getElementById('publicStorefrontLandingView').classList.remove('hidden');
    renderPublicCatalog();
}

function renderPublicCatalog() {
    const catalogZone = document.getElementById('publicCatalogDisplayZone');
    const badgeCount = document.getElementById('publicTotalCountBadge');
    if (!catalogZone) return;

    const searchQuery = document.getElementById('publicSearchInput').value.trim().toLowerCase();
    const shopFilter = document.getElementById('publicShopFilter').value;
    
    let filteredItems = [...inventory];
    
    // 1. Filter by specific chosen business shop stream
    if (shopFilter !== "ALL") {
        filteredItems = filteredItems.filter(item => item.partnerId === shopFilter);
    }
    
    // 2. Filter by search query strings
    if (searchQuery !== "") {
        filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(searchQuery));
    }

    if (badgeCount) {
        badgeCount.innerText = `${filteredItems.length} Products Found`;
    }

    if (filteredItems.length === 0) {
        catalogZone.innerHTML = `<p style="grid-column: 1/-1; text-align:center; padding: 25px; color:#64748b; font-size:0.9rem;">No products found matching those search metrics.</p>`;
        return;
    }

    // Generate responsive layout cards displaying explicit shop metadata profiles
    catalogZone.innerHTML = filteredItems.map(item => {
        const isOut = item.qty <= 0;
        const shopType = item.partnerId || 'General Supply';
        
        return `
            <div class="catalog-item-card">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:start; gap:8px;">
                        <strong style="font-size:1.05rem; color:#0f172a; line-height:1.2;">${item.name}</strong>
                        <span style="font-weight:700; color:var(--primary); font-size:1.05rem; white-space:nowrap;">₦${item.retail}</span>
                    </div>
                    <div class="shop-tag">🏪 Shop: ${shopType}</div>
                    ${item.memo ? `<p style="font-size:0.8rem; background:#f1f5f9; padding:6px 8px; border-radius:4px; color:#475569; margin-top:8px; margin-bottom:0;">ℹ️ ${item.memo}</p>` : ''}
                </div>
                <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.82rem; font-weight:600; color: ${isOut ? '#dc2626' : '#16a34a'}">
                        ${isOut ? '❌ Out of Stock' : '✅ Available'}
                    </span>
                    <button onclick="triggerPublicOrder('${item.name}', '${item.retail}', '${shopType}')" 
                            style="width:auto; margin:0; padding:6px 12px; font-size:0.8rem; background:${isOut ? '#94a3b8':'#16a34a'}; pointer-events:${isOut ? 'none':'auto'};">
                        ${isOut ? 'Unavailable' : 'Order Now 💬'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function triggerPublicOrder(name, price, shopName) {
    const textMessage = `Hello, I would like to purchase:\n\n📦 *Product:* ${name}\n💰 *Price:* ₦${price}\n🏪 *Shop Stream:* ${shopName}\n\nPlease confirm product pickup details. Thanks!`;
    window.open(`https://wa.me/${ADMIN_PHONE_NUMBER}?text=${encodeURIComponent(textMessage)}`, '_blank');
}

// --- WORKSPACE NAV SYSTEMS ---
function switchPartnerView(targetModule) {
    document.querySelectorAll('.module-view').forEach(view => view.classList.add('hidden'));

    if (targetModule === 'stock') {
        document.getElementById('moduleStockView').classList.remove('hidden');
        renderInventory();
    } else if (targetModule === 'sales') {
        document.getElementById('moduleSalesView').classList.remove('hidden');
        if (document.getElementById('salesSearchInput')) document.getElementById('salesSearchInput').value = "";
        populateSalesDropdown();
    } else if (targetModule === 'audit') {
        document.getElementById('moduleAuditView').classList.remove('hidden');
        renderLedger();
    } else if (targetModule === 'support') {
        document.getElementById('moduleSupportView').classList.remove('hidden');
    }
}

function toggleStockForm() {
    const form = document.getElementById('stockEntryForm');
    const btn = document.getElementById('btnToggleForm');
    if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        btn.innerText = "✕ Close Form";
        btn.style.backgroundColor = "#dc2626";
    } else {
        form.classList.add('hidden');
        btn.innerText = "+ Add New Item";
        btn.style.backgroundColor = "#64748b";
        resetStockFormState();
    }
}

function resetStockFormState() {
    document.getElementById('editItemIndex').value = "";
    document.getElementById('prodName').value = '';
    document.getElementById('prodQty').value = '';
    document.getElementById('prodCost').value = '';
    document.getElementById('prodRetail').value = '';
    document.getElementById('prodMemo').value = '';
    document.getElementById('btnSaveStock').innerText = "Save to My Inventory";
    document.getElementById('btnSaveStock').style.backgroundColor = "var(--success)";
}

// --- INVENTORY MANAGEMENT ENGINE ---
function addStockItem() {
    const name = document.getElementById('prodName').value.trim();
    const qty = parseInt(document.getElementById('prodQty').value) || 0;
    const cost = parseFloat(document.getElementById('prodCost').value) || 0;
    const retail = parseFloat(document.getElementById('prodRetail').value) || 0;
    const minAlert = parseInt(document.getElementById('prodAlert').value) || 0;
    const memo = document.getElementById('prodMemo').value.trim();
    const partnerOwner = localStorage.getItem('so_biz_tier') || 'General';
    const editIndexValue = document.getElementById('editItemIndex').value;

    if (!name) { alert("Please type a product name."); return; }

    const itemPayload = { 
        id: editIndexValue !== "" ? inventory[parseInt(editIndexValue)].id : Date.now(), 
        partnerId: partnerOwner, 
        name, qty, cost, retail, minAlert, memo 
    };

    if (editIndexValue !== "") {
        inventory[parseInt(editIndexValue)] = itemPayload;
    } else {
        inventory.push(itemPayload);
    }
    
    localStorage.setItem('sobiz_inventory', JSON.stringify(inventory));
    toggleStockForm();
    renderInventory();
}

function computeLiveSystemAlerts() {
    const currentPartner = localStorage.getItem('so_biz_tier');
    const systemTxtNode = document.getElementById('hubSystemText');
    if (!systemTxtNode) return;

    const partnerItems = inventory.filter(item => item.partnerId === currentPartner);
    const lowStockItems = partnerItems.filter(item => item.qty <= item.minAlert);

    if (lowStockItems.length === 0) {
        systemTxtNode.innerHTML = `🟢 All stock levels stable. No pending replenishment actions.`;
        return;
    }

    let warningHtml = `<div style="font-weight:600; margin-bottom: 2px;">Critical Inventory Warnings:</div>`;
    lowStockItems.forEach(item => {
        const isOutOfStock = item.qty === 0;
        warningHtml += `
            <div class="system-alert-item">
                ${isOutOfStock ? '❌ OUT OF STOCK' : '⚠️ LOW STOCK'}: <strong>${item.name}</strong> (${item.qty} left)
            </div>
        `;
    });
    systemTxtNode.innerHTML = warningHtml;
}

function renderInventory() {
    const container = document.getElementById('stockList');
    const currentPartner = localStorage.getItem('so_biz_tier');
    
    let displayList = inventory.map((item, originalIdx) => ({...item, originalIdx})).filter(item => item.partnerId === currentPartner);
    
    let lowStockCounter = 0;
    displayList.forEach(item => {
        if (item.qty <= item.minAlert) lowStockCounter++;
    });
    const badge = document.getElementById('lowStockBadge');
    if (lowStockCounter > 0) {
        badge.innerText = lowStockCounter; badge.style.display = "block";
    } else {
        badge.style.display = "none";
    }

    const searchQuery = document.getElementById('stockSearchInput').value.trim().toLowerCase();
    if (searchQuery !== "") {
        displayList = displayList.filter(item => item.name.toLowerCase().includes(searchQuery));
    }

    const sortMethod = document.getElementById('stockSortSelect').value;
    if (sortMethod === "alpha") displayList.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMethod === "qtyDesc") displayList.sort((a, b) => b.qty - a.qty);
    else if (sortMethod === "qtyAsc") displayList.sort((a, b) => a.qty - b.qty);
    else if (sortMethod === "lowAlert") {
        displayList.sort((a, b) => {
            const aLow = a.qty <= a.minAlert ? 1 : 0;
            const bLow = b.qty <= b.minAlert ? 1 : 0;
            return bLow - aLow; 
        });
    }

    if (displayList.length === 0) {
        container.innerHTML = `<p style="color:#64748b; font-size:0.9rem; padding:10px 0; text-align:center;">No matching items found.</p>`;
        computeLiveSystemAlerts();
        return;
    }
    
    container.innerHTML = "";
    displayList.forEach(item => {
        const isLow = item.qty <= item.minAlert;
        const row = document.createElement('div');
        row.className = "item-row";
        row.innerHTML = `
            <div>
                <strong>${item.name}</strong> <span class="badge">Qty: ${item.qty}</span>
                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">Memo: ${item.memo || 'None'}</div>
            </div>
            <div style="display:flex; align-items:center; gap: 6px;">
                <div class="${isLow ? 'low-stock' : ''}" style="margin-right: 5px;">${isLow ? '⚠️ LOW' : `₦${item.retail}`}</div>
                <button class="row-actions-btn" onclick="startCorrectionFlow(${item.originalIdx})">✏️</button>
                <button class="row-actions-btn" onclick="deleteStockItem(${item.originalIdx})">🗑️</button>
            </div>
        `;
        container.appendChild(row);
    });
    
    computeLiveSystemAlerts();
    updateAdminMetrics();
}

function startCorrectionFlow(index) {
    const item = inventory[index];
    if (!item) return;

    document.getElementById('editItemIndex').value = index;
    document.getElementById('prodName').value = item.name;
    document.getElementById('prodQty').value = item.qty;
    document.getElementById('prodCost').value = item.cost;
    document.getElementById('prodRetail').value = item.retail;
    document.getElementById('prodAlert').value = item.minAlert;
    document.getElementById('prodMemo').value = item.memo || '';

    document.getElementById('btnSaveStock').innerText = "Apply Corrections";
    document.getElementById('btnSaveStock').style.backgroundColor = "var(--primary)";

    const form = document.getElementById('stockEntryForm');
    if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        document.getElementById('btnToggleForm').innerText = "✕ Cancel";
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteStockItem(index) {
    if (confirm("Delete this inventory item record?")) {
        inventory.splice(index, 1);
        localStorage.setItem('sobiz_inventory', JSON.stringify(inventory));
        renderInventory();
    }
}

// --- SALES REGISTRATION ENGINE ---
function populateSalesDropdown() {
    const dropdown = document.getElementById('salesItemDropdown');
    const searchInput = document.getElementById('salesSearchInput');
    if (!dropdown) return;

    const currentPartner = localStorage.getItem('so_biz_tier');
    let partnerItems = inventory.filter(item => item.partnerId === currentPartner);
    
    if (searchInput) {
        const query = searchInput.value.trim().toLowerCase();
        if (query !== "") partnerItems = partnerItems.filter(item => item.name.toLowerCase().includes(query));
    }
    
    if (partnerItems.length === 0) {
        dropdown.innerHTML = `<option value="">-- No Matching Items Found --</option>`;
        return;
    }
    
    dropdown.innerHTML = partnerItems.map(item => 
        `<option value="${item.name}">📦 ${item.name} (Available: ${item.qty})</option>`
    ).join('');
    
    const dateInput = document.getElementById('salesDate');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
}

function registerPartnerSale() {
    const itemName = document.getElementById('salesItemDropdown').value;
    const qtySold = parseInt(document.getElementById('salesQty').value) || 0;
    const saleDate = document.getElementById('salesDate').value;
    const currentPartner = localStorage.getItem('so_biz_tier');

    if (!itemName || qtySold <= 0 || !saleDate) return;

    const stockItem = inventory.find(item => item.name === itemName && item.partnerId === currentPartner);
    if (!stockItem || stockItem.qty < qtySold) {
        alert(`Insufficient stock metrics.`); return;
    }

    stockItem.qty -= qtySold;
    localStorage.setItem('sobiz_inventory', JSON.stringify(inventory));

    salesLogs.push({ date: saleDate, name: itemName, qty: qtySold, cost: stockItem.cost, retail: stockItem.retail });
    localStorage.setItem('sobiz_sales', JSON.stringify(salesLogs));

    document.getElementById('salesQty').value = '1';
    if (document.getElementById('salesSearchInput')) document.getElementById('salesSearchInput').value = "";

    populateSalesDropdown();
    computeLiveSystemAlerts();
    alert(`Success! Sale logged.`);
}

// --- DISCREPANCY PLUGINS ---
function submitPartnerComplaint() {
    const category = document.getElementById('complaintCategory').value;
    const textMessage = document.getElementById('complaintText').value.trim();
    const activePartner = localStorage.getItem('so_biz_tier') || 'General Trader';
    const timestamp = new Date().toLocaleString();

    if (!textMessage) { alert("Please type your explanation details first."); return; }

    const newRecord = { id: Date.now(), partner: activePartner, category, text: textMessage, time: timestamp };
    complaints.unshift(newRecord);
    localStorage.setItem('sobiz_complaints', JSON.stringify(complaints));

    const chatTemplate = `📢 *SO BIZ DISCREPANCY REPORT*\n\n*From:* ${activePartner}\n*Category:* ${category}\n*Time:* ${timestamp}\n\n*Message:* ${textMessage}`;
    
    document.getElementById('complaintText').value = "";
    alert("Discrepancy logged securely! Notifying Admin via WhatsApp...");
    window.open(`https://wa.me/${ADMIN_PHONE_NUMBER}?text=${encodeURIComponent(chatTemplate)}`, '_blank');
    switchPartnerView('stock');
}

function renderAdminInbox() {
    const boxContainer = document.getElementById('adminComplaintInboxList');
    if (!boxContainer) return;

    if (complaints.length === 0) {
        boxContainer.innerHTML = `<p style="font-size:0.85rem; color:#64748b; padding:8px 0; text-align:center;">No active complaints in database folder.</p>`;
        return;
    }

    boxContainer.innerHTML = complaints.map((item, index) => `
        <div class="complaint-card">
            <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:4px;">
                <span>👤 ${item.partner}</span>
                <span style="font-size:0.75rem; color:#475569;">${item.time}</span>
            </div>
            <strong style="color:#be123c; display:block; margin: 4px 0;">[${item.category}]</strong>
            <span style="display:block; font-weight:500;">${item.text}</span>
            <div style="text-align:right; margin-top:8px;">
                <button onclick="clearSingleComplaint(${index})" style="width:auto; margin:0; padding:3px 8px; font-size:0.75rem; background:#475569; color:white; border-radius:4px;">Clear Row</button>
            </div>
        </div>
    `).join('');
}

function clearSingleComplaint(idx) {
    if (confirm("Archive this dispute record card?")) {
        complaints.splice(idx, 1);
        localStorage.setItem('sobiz_complaints', JSON.stringify(complaints));
        renderAdminInbox();
    }
}

// --- DATA AUDITS & EXPORTS ---
function exportPartnerBackup() {
    const currentPartner = localStorage.getItem('so_biz_tier') || 'General';
    const packageData = {
        partner: currentPartner,
        inventory: inventory.filter(i => i.partnerId === currentPartner),
        ledger: ledgerLogs, sales: salesLogs, complaints: complaints
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(packageData, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `SO_BIZ_Backup_${currentPartner}.json`);
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
}

function runLocalAudit() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const outputZone = document.getElementById('auditOutput');
    if (!start || !end) return;

    const recordsInWindow = salesLogs.filter(sale => sale.date >= start && sale.date <= end);
    if (recordsInWindow.length === 0) {
        outputZone.innerHTML = "No matches inside this window."; return;
    }

    let grossRevenue = 0, investmentCost = 0;
    recordsInWindow.forEach(sale => {
        grossRevenue += (sale.retail * sale.qty);
        investmentCost += (sale.cost * sale.qty);
    });
    outputZone.innerHTML = `<div style="margin-top:10px;">Gross: ₦${grossRevenue.toFixed(2)} | Profit Net: ₦${(grossRevenue - investmentCost).toFixed(2)}</div>`;
}

function addLedgerEntry(type) {
    const name = document.getElementById('ledgerName').value;
    const amount = parseFloat(document.getElementById('ledgerAmount').value) || 0;
    const dueDate = document.getElementById('ledgerDueDate').value;
    if (!name || amount <= 0 || !dueDate) return;

    ledgerLogs.push({ name, amount, dueDate, type });
    localStorage.setItem('sobiz_ledger', JSON.stringify(ledgerLogs));
    renderLedger();
}

function renderLedger() {
    const iOweContainer = document.getElementById('iOweList');
    const theyOweContainer = document.getElementById('theyOweList');
    if (!iOweContainer || !theyOweContainer) return;
    iOweContainer.innerHTML = ""; theyOweContainer.innerHTML = "";
    
    ledgerLogs.forEach(entry => {
        const html = `<div><strong>${entry.name}</strong>: ₦${entry.amount.toFixed(2)}</div>`;
        if (entry.type === 'IOwe') iOweContainer.innerHTML += html;
        else theyOweContainer.innerHTML += html;
    });
    updateAdminMetrics();
}

// --- BULLETIN BOARD UTILITIES ---
function toggleFloatingMediaWindow() {
    document.getElementById('floatingMediaWindow').classList.toggle('hidden');
}

function setupAnnouncements() {
    const hubContainer = document.getElementById('globalNotificationHub');
    const adminTxtNode = document.getElementById('hubAdminText');
    const customLiveNotice = localStorage.getItem('sobiz_live_notice') || DEFAULT_TEXT_NOTICE;
    
    if (adminTxtNode) adminTxtNode.innerText = customLiveNotice;
    if (localStorage.getItem('so_biz_tier') && hubContainer) hubContainer.classList.remove('hidden');
    computeLiveSystemAlerts();
}

function setupMediaShowcaseBoard() {
    const fab = document.getElementById('mediaFabButton');
    const titleNode = document.getElementById('mediaTitle');
    const descNode = document.getElementById('mediaDescription');
    const container = document.getElementById('mediaContainer');

    titleNode.innerText = localStorage.getItem('sobiz_media_title') || "Network Hub Updates";
    descNode.innerText = localStorage.getItem('sobiz_media_desc') || "Review visuals posted by management here.";
    
    const liveUrl = stagingLocalBlobUrl || localStorage.getItem('sobiz_media_url') || DEFAULT_IMAGE_URL;
    if (liveUrl) {
        container.innerHTML = `<img src="${liveUrl}" alt="Network Media Display">`;
        fab.classList.remove('hidden'); 
    }
}

function handleLocalFileLoad(inputElement) {
    if (inputElement.files && inputElement.files[0]) {
        if (stagingLocalBlobUrl) URL.revokeObjectURL(stagingLocalBlobUrl);
        stagingLocalBlobUrl = URL.createObjectURL(inputElement.files[0]);
    }
}

function publishAdminAnnouncement() {
    const textValue = document.getElementById('adminBulletinInput').value.trim();
    if (!textValue) return;
    localStorage.setItem('sobiz_live_notice', textValue);
    setupAnnouncements();
    alert("Header notice banner updated!");
}

function publishAdminMediaBoard() {
    const title = document.getElementById('adminMediaTitle').value.trim();
    const desc = document.getElementById('adminMediaDesc').value.trim();
    const linkUrl = document.getElementById('adminMediaUrl').value.trim();

    localStorage.setItem('sobiz_media_title', title || "Network Hub Updates");
    localStorage.setItem('sobiz_media_desc', desc || "");

    if (stagingLocalBlobUrl !== "") localStorage.removeItem('sobiz_media_url');
    else localStorage.setItem('sobiz_media_url', linkUrl || DEFAULT_IMAGE_URL);

    setupMediaShowcaseBoard();
    document.getElementById('floatingMediaWindow').classList.remove('hidden');
    alert("Media elements deployed successfully!");
}

// --- GLOBAL THEMING & ARCHITECTURE BOOT ---
function changeWorkspaceTheme() {
    const selector = document.getElementById('uiTheme');
    if (!selector) return;
    
    const chosenTheme = themes[selector.value] || themes.default;
    document.documentElement.style.setProperty('--primary', chosenTheme.primary);
    document.documentElement.style.setProperty('--bg', chosenTheme.bg);
    document.documentElement.style.setProperty('--card-bg', chosenTheme.cardBg);
    document.documentElement.style.setProperty('--text', chosenTheme.text);
    document.documentElement.style.setProperty('--badge-text', chosenTheme.badgeText); 
    localStorage.setItem('sobiz_theme_choice', selector.value);
}

function showDashboard() {
    document.getElementById('publicStorefrontLandingView').classList.add('hidden');
    document.getElementById('workspace').classList.remove('hidden');
    
    const themeGroup = document.getElementById('themeSelectorGroup');
    if (themeGroup) themeGroup.classList.remove('hidden');
    
    setupAnnouncements();
    setupMediaShowcaseBoard();
    switchPartnerView('stock'); 
}

function updateAdminMetrics() {
    const totalRows = inventory.length + ledgerLogs.length + salesLogs.length + complaints.length;
    const dbBadge = document.getElementById('adminDbCount');
    if (dbBadge) dbBadge.innerText = `${totalRows} Entries`;
}

function triggerRemoteDataSync() {
    const statusBox = document.getElementById('adminSyncStatus');
    statusBox.style.color = "#ea580c"; statusBox.innerText = "Syncing...";
    setTimeout(() => { statusBox.style.color = "#16a34a"; statusBox.innerText = "Standby"; }, 1000);
}

function purgeSystemData() {
    if (confirm("Purge databases?")) { localStorage.clear(); window.location.reload(); }
}

// Initialization Entry Points
window.addEventListener('DOMContentLoaded', () => {
    // If a theme choice was previously cached, apply it gracefully
    const cachedTheme = localStorage.getItem('sobiz_theme_choice');
    if (cachedTheme) {
        const themeSelector = document.getElementById('uiTheme');
        if (themeSelector) themeSelector.value = cachedTheme;
        changeWorkspaceTheme();
    }
    
    // Launch directly to the customer-facing landing catalog page
    showPublicStorefrontLanding();
});