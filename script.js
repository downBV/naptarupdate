let app;

function initSalaryVisibility() {
  const salaryInput = document.getElementById("base-salary");
  if (!salaryInput) return null;

  // Konténer létrehozása
  const container = document.createElement("div");
  container.style.position = "relative";
  salaryInput.parentNode.insertBefore(container, salaryInput);
  container.appendChild(salaryInput);

  // Létrehozunk egy rejtett input mezőt a tényleges érték tárolásához
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden";
  hiddenInput.id = "real-salary";
  hiddenInput.value = salaryInput.value;
  container.appendChild(hiddenInput);

  // Láthatóság kapcsoló gomb
  const toggleButton = document.createElement("button");
  toggleButton.innerHTML = "👁️‍🗨️";
  toggleButton.style.position = "absolute";
  toggleButton.style.right = "10px";
  toggleButton.style.top = "50%";
  toggleButton.style.transform = "translateY(-50%)";
  toggleButton.style.background = "none";
  toggleButton.style.border = "none";
  toggleButton.style.cursor = "pointer";
  toggleButton.style.padding = "15px";
  toggleButton.style.fontSize = "24px";
  toggleButton.style.zIndex = "10";
  container.appendChild(toggleButton);

  let isVisible = false;

  // Érték maszkolása
  const maskValue = (value) => "•".repeat(String(value).length);

  // Közvetlen mentés az alkalmazásba
  const saveToApp = (value) => {
    if (window.app && value && !isNaN(value)) {
      // Közvetlenül módosítjuk az input értékét
      hiddenInput.value = value;

      // Frissítjük az alkalmazás adatait
      window.app.yearlyData[
        window.app.currentSettingsYear
      ].settings.besorolasi_ber = value;
      window.app.saveYearlyData();
      window.app.generatePayrollTable();
    }
  };

  // Input beállítása
  salaryInput.style.paddingRight = "45px";
  salaryInput.type = "text";

  // Input eseménykezelők
  salaryInput.addEventListener("focus", () => {
    salaryInput.value = hiddenInput.value;
  });

  salaryInput.addEventListener("input", (e) => {
    const newValue = e.target.value;
    if (newValue && !isNaN(newValue)) {
      hiddenInput.value = newValue;
      saveToApp(newValue);
    }
  });

  salaryInput.addEventListener("blur", () => {
    const currentValue = salaryInput.value;
    if (currentValue && !isNaN(currentValue)) {
      hiddenInput.value = currentValue;
      saveToApp(currentValue);
    }
    if (!isVisible) {
      salaryInput.value = maskValue(hiddenInput.value);
    }
  });

  // Láthatóság kapcsoló
  const toggleVisibility = (e) => {
    e.preventDefault();
    e.stopPropagation();

    isVisible = !isVisible;
    toggleButton.innerHTML = isVisible ? "👁️" : "👁️‍🗨️";

    if (isVisible) {
      salaryInput.value = hiddenInput.value;
    } else {
      salaryInput.value = maskValue(hiddenInput.value);
    }
  };

  // Gomb eseménykezelők
  toggleButton.addEventListener("click", toggleVisibility);
  toggleButton.addEventListener("touchstart", toggleVisibility, {
    passive: false,
  });
  toggleButton.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    { passive: false }
  );

  // Kezdeti megjelenítés
  if (!isVisible) {
    salaryInput.value = maskValue(hiddenInput.value);
  }

  return {
    getValue: () => hiddenInput.value,
    setValue: (value) => {
      if (value && !isNaN(value)) {
        hiddenInput.value = value;
        if (isVisible) {
          salaryInput.value = value;
        } else {
          salaryInput.value = maskValue(value);
        }
        saveToApp(value);
      }
    },
  };
}

const SHIFT_COLORS = {
  Nappal: ["#FFD700", "black"],
  Éjszaka: ["#4169E1", "white"],
  Szabadság: ["#09fd00", "black"],
  Túlóra: ["#FF0000", "white"],
  Csúszó: ["#DDA0DD", "black"],
  Táppénz: ["#000000", "white"],
  "Táppénz kezdete műszak": ["#1a1a1a", "white"],
  "Táppénz kezdete szabadnap": ["#2d2d2d", "white"],
  "Táppénz vége szabadnap": ["#444444", "white"],
  "Táppénz vége műszak": ["#666666", "white"],
};

const MINIMUM_WAGE = {
  2024: 266800,
  2025: 290812,
  2026: 322800,
  2027: 374624,
};

function normalizeKey(key) {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Az ablak validateBonus függvényének javítása
window.validateBonus = function (entry, monthIndex) {
  try {
    let bonus = entry.value === "" ? 2 : parseInt(entry.value);

    // Érték korlátozása 0 és 2 közé
    if (isNaN(bonus) || bonus < 0) {
      bonus = 0;
    } else if (bonus > 2) {
      bonus = 2;
    }

    // Az input mező értékének frissítése
    entry.value = bonus.toString();

    // Ellenőrizzük és inicializáljuk az évet és a bonusEntries objektumot
    const currentYear = window.app.currentPayrollYear;
    if (!window.app.yearlyData[currentYear]) {
      window.app.yearlyData[currentYear] = {
        settings: {
          besorolasi_ber: "300000",
          szabadsag: "25",
          muszakrend: "-",
          other_income: "0",
          under25: {
            enabled: false,
            birthYear: "",
            birthMonth: "",
          },
          midyear_changes: [],
        },
        calendar_data: {},
        bonusEntries: {},
        restaurantEntries: {},
        egyebJovedelmEntries: {},
      };
    }

    // Inicializáljuk a bonusEntries objektumot, ha nem létezik
    if (!window.app.yearlyData[currentYear].bonusEntries) {
      window.app.yearlyData[currentYear].bonusEntries = {};
    }

    // Frissítjük a bonusEntries értékét
    window.app.yearlyData[currentYear].bonusEntries[monthIndex] = bonus;

    // Újraszámoljuk a kapcsolódó értékeket
    window.app.generatePayrollTable();
    window.app.saveYearlyData();

    return true;
  } catch (error) {
    console.error("Bónusz validálási hiba:", error);
    return false;
  }
};

// Az ablak validateRestaurant függvényének javítása
window.validateRestaurant = function (entry, monthIndex) {
  try {
    const restaurant = entry.value === "" ? 0 : parseInt(entry.value);
    if (isNaN(restaurant) || restaurant < 0) {
      entry.value = "0";
      throw new Error("Az éttermi fogyasztás nem lehet negatív");
    }

    // Ellenőrizzük és inicializáljuk az évet és a restaurantEntries objektumot
    const currentYear = window.app.currentPayrollYear;
    if (!window.app.yearlyData[currentYear]) {
      window.app.yearlyData[currentYear] = {
        settings: {
          besorolasi_ber: "300000",
          szabadsag: "25",
          muszakrend: "-",
          other_income: "0",
          under25: {
            enabled: false,
            birthYear: "",
            birthMonth: "",
          },
          midyear_changes: [],
        },
        calendar_data: {},
        bonusEntries: {},
        restaurantEntries: {},
        egyebJovedelmEntries: {},
      };
    }

    // Inicializáljuk a restaurantEntries objektumot, ha nem létezik
    if (!window.app.yearlyData[currentYear].restaurantEntries) {
      window.app.yearlyData[currentYear].restaurantEntries = {};
    }

    // Frissítjük a restaurantEntries értékét
    window.app.yearlyData[currentYear].restaurantEntries[monthIndex] =
      restaurant;

    // Újraszámoljuk a kapcsolódó értékeket
    window.app.generatePayrollTable();
    window.app.saveYearlyData();

    return true;
  } catch (error) {
    console.error("Éttermi fogyasztás validálási hiba:", error);
    return false;
  }
};

// Az ablak validateEgyebJovedelem függvénye
window.validateEgyebJovedelem = function (entry, monthIndex) {
  try {
    const egyebJovedelem = entry.value === "" ? 0 : parseInt(entry.value);
    if (isNaN(egyebJovedelem) || egyebJovedelem < 0) {
      entry.value = "0";
      throw new Error("Az egyéb jövedelem nem lehet negatív");
    }

    const currentYear = window.app.currentPayrollYear;
    if (!window.app.yearlyData[currentYear]) {
      window.app.yearlyData[currentYear] = {
        settings: {
          besorolasi_ber: "300000",
          szabadsag: "25",
          muszakrend: "-",
          other_income: "0",
          under25: { enabled: false, birthYear: "", birthMonth: "" },
          midyear_changes: [],
        },
        calendar_data: {},
        bonusEntries: {},
        restaurantEntries: {},
        egyebJovedelmEntries: {},
      };
    }

    if (!window.app.yearlyData[currentYear].egyebJovedelmEntries) {
      window.app.yearlyData[currentYear].egyebJovedelmEntries = {};
    }

    window.app.yearlyData[currentYear].egyebJovedelmEntries[monthIndex] = egyebJovedelem;

    window.app.generatePayrollTable();
    window.app.saveYearlyData();

    return true;
  } catch (error) {
    console.error("Egyéb jövedelem validálási hiba:", error);
    return false;
  }
};

// Felvillanó üzenet megjelenítése
function showSuccessMessage(message) {
  // Töröljük a korábbi üzenetet, ha létezik
  const existingMessage = document.getElementById('success-message-toast');
  if (existingMessage) {
    existingMessage.remove();
  }

  // Üzenet elem létrehozása
  const messageDiv = document.createElement('div');
  messageDiv.id = 'success-message-toast';
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 16px 32px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideDown 0.3s ease-out;
  `;

  // Hozzáadjuk a DOM-hoz
  document.body.appendChild(messageDiv);

  // 3 másodperc után eltüntetjük
  setTimeout(() => {
    messageDiv.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => {
      messageDiv.remove();
    }, 300);
  }, 3000);
}

class ChangelogManager {
  constructor() {
    // FONTOS: Ezt a verziószámot növeld minden új funkcióval!
    this.currentVersion = "v3.1.15"; // <-- Itt változtasd a verziót
    this.storageKey = "lastSeenChangelog";
  }

  // Frissítési napló tartalma
  getChangelog() {
    return [
      {
        version: "3.1.15",
        date: "2026.05.08", 
        title: "Frissítés",
        changes: [
          "➕ Az info (i) menüben, már van lehetőség e-mailt írni, amiben jelezhetőek az ötletek/javítások.",
          "🔧 Véletlenszerű adattörlések problémájának kijavítása"
        ]
      }
    ];
  }
  //Ikonok a változásokhoz:
  //➕ Új funkció
  //🔧 Hibajavítás
  //✨ Fejlesztés
  //🎨 Dizájn változás
  //⚡ Teljesítmény javítás

  // 4. FEJLESZTŐI HASZNÁLAT:

  // Konzolból tesztelheted:
  // window.app.showChangelog()        // Kézi megjelenítés
  // window.app.resetChangelog()       // Verzió reset (újratöltés után újra megjelenik)

  /* 
    HOGYAN HASZNÁLD ÚJ FRISSÍTÉSNÉL:

    1. Növeld a verziószámot: this.currentVersion = "2.2.0"

    2. Add hozzá az új verziót a changelog elejére:
    {
        version: "2.2.0",
        date: "2025.05.25", 
        title: "Új funkció neve",
        changes: [
            "➕ Új: Valami új funkció",
            "🔧 Javítás: Valami javítás", 
            "✨ Fejlesztés: Valami fejlesztés"
        ]
    }

    3. A felhasználók automatikusan látni fogják az új changelog-ot!
    */

  // Ellenőrzi, hogy kell-e megjeleníteni a changelog-ot
  shouldShowChangelog() {
    const changelog = this.getChangelog();
    
    // Ha nincs changelog tartalom, vagy üres, ne mutassuk
    if (!changelog || changelog.length === 0) {
        return false;
    }
    
    // Ellenőrizzük, hogy van-e legalább egy verzió tartalommal
    const hasContent = changelog.some(version => 
        version.changes && version.changes.length > 0
    );
    
    if (!hasContent) {
        return false;
    }
    
    const lastSeenVersion = localStorage.getItem(this.storageKey);
    return lastSeenVersion !== this.currentVersion;
}

  // Changelog megjelenítése
  showChangelog() {
    if (!this.shouldShowChangelog()) {
      return; // Ne mutassuk, ha már látta
    }

    const overlay = this.createChangelogModal();
    document.body.appendChild(overlay);
  }

  // Modal létrehozása
  createChangelogModal() {
    const overlay = document.createElement("div");
    overlay.className = "changelog-overlay";

    const modal = document.createElement("div");
    modal.className = "changelog-modal";

    // Fejléc
    const header = document.createElement("div");
    header.className = "changelog-header";
    header.innerHTML = `
            <h2>Frissítések</h2>
        `;

    modal.appendChild(header);

    // Changelog tartalom
    const changelog = this.getChangelog();
changelog.forEach((version) => {
    // Ellenőrizzük, hogy a verziónak vannak-e változásai
    if (!version.changes || version.changes.length === 0) {
        return; // Ugord át ezt a verziót, ha nincs benne tartalom
    }
    
    const versionDiv = document.createElement("div");
    versionDiv.className = "changelog-version";

    const versionHeader = document.createElement("h4");
    versionHeader.textContent = `v${version.version} - ${version.date}`;
    versionDiv.appendChild(versionHeader);

    const versionTitle = document.createElement("p");
    versionTitle.style.fontWeight = "bold";
    versionTitle.style.marginBottom = "10px";
    versionTitle.style.color = "black";
    versionTitle.textContent = version.title;
    versionDiv.appendChild(versionTitle);

    const changesList = document.createElement("ul");
    changesList.style.color = "black"
    version.changes.forEach((change) => {
        const listItem = document.createElement("li");
        listItem.textContent = change;
        changesList.appendChild(listItem);
    });

    versionDiv.appendChild(changesList);
    modal.appendChild(versionDiv);
});

    // Bezárás gomb
    const closeButton = document.createElement("button");
    closeButton.className = "changelog-close-btn";
    closeButton.textContent = "Rendben, megértettem! 👍";
    closeButton.addEventListener("click", () => {
      this.markAsRead();
      document.body.removeChild(overlay);
    });

    modal.appendChild(closeButton);
    overlay.appendChild(modal);

    // ESC billentyű kezelése
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        this.markAsRead();
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);

    return overlay;
  }

  // Megjelöli elolvasottként
  markAsRead() {
    localStorage.setItem(this.storageKey, this.currentVersion);
  }

  // Kézi megjelenítés (fejlesztőknek)
  forceShow() {
    const overlay = this.createChangelogModal();
    document.body.appendChild(overlay);
  }

  // Verzió reset (teszteléshez)
  resetVersion() {
    localStorage.removeItem(this.storageKey);
    console.log("Changelog verzió resetelve. Újratöltés után megjelenik.");
  }
}

// ==================== CSÚSZÓ ÓRASZÁM MODAL ====================

function showHourInputModal(shiftType, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'shift-select-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'shift-select-modal';
  modal.style.maxHeight = '80vh';
  
  // Modal cím
  const title = document.createElement('h2');
  title.textContent = shiftType.includes('éj') ? 'Éjszakai csúszó órák' : 'Nappali csúszó órák';
  title.style.marginBottom = '20px';
  title.style.color = '#333';
  modal.appendChild(title);
  
  // Leírás
  const description = document.createElement('p');
  description.textContent = 'Add meg hány órát voltál csúszón ezen a napon:';
  description.style.marginBottom = '15px';
  description.style.color = '#666';
  modal.appendChild(description);
  
  // Óraszám input
  const inputContainer = document.createElement('div');
  inputContainer.style.marginBottom = '20px';
  
  const hourInput = document.createElement('input');
  hourInput.type = 'number';
  hourInput.min = '0.5';
  hourInput.max = '12';
  hourInput.step = '0.5';
  hourInput.value = '8';
  hourInput.style.width = '100%';
  hourInput.style.padding = '15px';
  hourInput.style.fontSize = '24px';
  hourInput.style.textAlign = 'center';
  hourInput.style.border = '2px solid #4a90e2';
  hourInput.style.borderRadius = '8px';
  hourInput.style.fontWeight = 'bold';
  
  // Gyors választó gombok
  const quickButtons = document.createElement('div');
  quickButtons.style.display = 'grid';
  quickButtons.style.gridTemplateColumns = 'repeat(3, 1fr)';
  quickButtons.style.gap = '10px';
  quickButtons.style.marginTop = '15px';
  
  [4, 8, 12].forEach(hours => {
    const btn = document.createElement('button');
    btn.textContent = `${hours}óra`;
    btn.style.padding = '10px';
    btn.style.backgroundColor = '#f0f0f0';
    btn.style.border = '2px solid #ddd';
    btn.style.borderRadius = '5px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '16px';
    btn.style.fontWeight = 'bold';
    
    btn.addEventListener('click', () => {
      hourInput.value = hours;
    });
    
    quickButtons.appendChild(btn);
  });
  
  inputContainer.appendChild(hourInput);
  inputContainer.appendChild(quickButtons);
  modal.appendChild(inputContainer);
  
  // Validáció üzenet
  const validationMsg = document.createElement('div');
  validationMsg.style.color = 'red';
  validationMsg.style.marginBottom = '15px';
  validationMsg.style.minHeight = '20px';
  validationMsg.style.fontSize = '14px';
  modal.appendChild(validationMsg);
  
  // Gombok
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';
  
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'OK';
  confirmBtn.style.flex = '1';
  confirmBtn.style.padding = '15px';
  confirmBtn.style.backgroundColor = '#4CAF50';
  confirmBtn.style.color = 'white';
  confirmBtn.style.border = 'none';
  confirmBtn.style.borderRadius = '8px';
  confirmBtn.style.fontSize = '18px';
  confirmBtn.style.fontWeight = 'bold';
  confirmBtn.style.cursor = 'pointer';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Mégse';
  cancelBtn.style.flex = '1';
  cancelBtn.style.padding = '15px';
  cancelBtn.style.backgroundColor = '#f44336';
  cancelBtn.style.color = 'white';
  cancelBtn.style.border = 'none';
  cancelBtn.style.borderRadius = '8px';
  cancelBtn.style.fontSize = '18px';
  cancelBtn.style.fontWeight = 'bold';
  cancelBtn.style.cursor = 'pointer';
  
  // Validáció
  const validateHours = () => {
    const value = parseFloat(hourInput.value);
    if (isNaN(value) || value < 0.5 || value > 12) {
      validationMsg.textContent = '⚠️ Az érték 0.5 és 12 között legyen!';
      return false;
    }
    if (value % 0.5 !== 0) {
      validationMsg.textContent = '⚠️ Csak fél órás lépésközök engedélyezettek!';
      return false;
    }
    validationMsg.textContent = '';
    return true;
  };
  
  confirmBtn.addEventListener('click', () => {
    if (validateHours()) {
      const hours = parseFloat(hourInput.value);
      callback(hours);
      document.body.removeChild(overlay);
    }
  });
  
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  buttonContainer.appendChild(confirmBtn);
  buttonContainer.appendChild(cancelBtn);
  modal.appendChild(buttonContainer);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Auto-focus az inputra
  setTimeout(() => hourInput.focus(), 100);
}

class BerszamfejtoCalculator {
  constructor(app) {
    if (!app) {
      throw new Error("App must be provided to BerszamfejtoCalculator");
    }
    this.app = app;
    this.tavolletCache = new Map();
    this.MINIMUM_WAGE = {
      2024: 266800,
      2025: 290812,
      2026: 328618,
      2027: 374624,
      2028: 426160,
    };
  }

  isShiftType(shiftValue, type) {
    // Normalizáljuk a stringeket
    const normalizedShift = String(shiftValue || "")
      .toLowerCase()
      .trim();
    const normalizedType = type.toLowerCase().trim();

    // Rugalmas illeszkedés
    return normalizedShift.includes(normalizedType);
  }

  calculateEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
  }

  getHolidays(year) {
    try {
      // Fix ünnepnapok
      const fixedHolidays = [
        { month: 0, day: 1 }, // Újév
        { month: 2, day: 15 }, // Március 15.
        { month: 4, day: 1 }, // Munka ünnepe
        { month: 7, day: 20 }, // Államalapítás ünnepe
        { month: 9, day: 23 }, // Október 23.
        { month: 10, day: 1 }, // Mindenszentek
        { month: 11, day: 25 }, // Karácsony
        { month: 11, day: 26 }, // Karácsony másnapja
      ];

      // Húsvét és kapcsolódó ünnepek kiszámítása
      const easter = this.calculateEaster(year);

      // Nagypéntek (Húsvét vasárnap előtti péntek)
      const goodFriday = new Date(easter);
      goodFriday.setDate(easter.getDate() - 2);

      // Húsvétvasárnap
      const easterSunday = new Date(easter);

      // Húsvéthétfő
      const easterMonday = new Date(easter);
      easterMonday.setDate(easter.getDate() + 1);

      // Pünkösd vasárnap (Húsvét után 49 nappal)
      const pentecostSunday = new Date(easter);
      pentecostSunday.setDate(easter.getDate() + 49);

      // Pünkösdhétfő (Húsvét után 50 nappal)
      const pentecostMonday = new Date(easter);
      pentecostMonday.setDate(easter.getDate() + 50);

      // Mozgó ünnepek hozzáadása
      const movingHolidays = [
        { month: goodFriday.getMonth(), day: goodFriday.getDate() }, // Nagypéntek
        { month: easterSunday.getMonth(), day: easterSunday.getDate() }, // Húsvétvasárnap
        { month: easterMonday.getMonth(), day: easterMonday.getDate() }, // Húsvéthétfő
        { month: pentecostSunday.getMonth(), day: pentecostSunday.getDate() }, // Pünkösd vasárnap
        { month: pentecostMonday.getMonth(), day: pentecostMonday.getDate() }, // Pünkösdhétfő
      ];

      // Összes ünnep összefűzése
      const allHolidays = [...fixedHolidays, ...movingHolidays];

      return allHolidays;
    } catch (error) {
      console.error("Hiba az ünnepnapok meghatározása során:", error);
      return [];
    }
  }

  isHoliday(year, month, day) {
    try {
      const holidays = this.getHolidays(year);
      return holidays.some(
        (holiday) => holiday.month === month && holiday.day === day
      );
    } catch (error) {
      console.error("Hiba az ünnepnap ellenőrzése során:", error);
      return false;
    }
  }

  calculateHolidayValue(year, month) {
    const holidays = this.getHolidays(year);
    let holidayValue = 0;
    let holidayCount = 0;

    holidays.forEach((holiday) => {
      if (holiday.month === month) {
        const calendarData = this.yearData.calendar_data[month] || {};
        const dayData = calendarData[holiday.day];

        if (
          dayData &&
          (dayData.includes("Nappal") || dayData.includes("Éjszaka"))
        ) {
          holidayValue += 12;
          holidayCount += 1;
        }
      }
    });

    return { holidayValue, holidayCount };
  }

  calculateChildTaxBenefit(childCount, date) {
    if (childCount <= 0) return 0;

    const currentDate = new Date(date);
    let benefitPerChild = 0;

    if (currentDate < new Date("2025-06-30")) {
      if (childCount === 1) benefitPerChild = 10000;
      else if (childCount === 2) benefitPerChild = 20000;
      else if (childCount >= 3) benefitPerChild = 33000;
    } else if (currentDate < new Date("2025-12-31")) {
      if (childCount === 1) benefitPerChild = 15000;
      else if (childCount === 2) benefitPerChild = 30000;
      else if (childCount >= 3) benefitPerChild = 49500;
    } else if (currentDate < new Date("2026-01-01")) {
      if (childCount === 1) benefitPerChild = 20000;
      else if (childCount === 2) benefitPerChild = 40000;
      else if (childCount >= 3) benefitPerChild = 66000;
    } 
    else {
      if (childCount === 1) benefitPerChild = 20000;
      else if (childCount === 2) benefitPerChild = 40000;
      else if (childCount >= 3) benefitPerChild = 66000;
    }

    return childCount * benefitPerChild;
  }

  getYearData(year) {
    if (year < 2024 || year > 2028) {
      throw new Error(`Érvénytelen év: ${year}`);
    }
    return this.app.yearlyData[year];
  }

  getMonthData(year, month) {
    const yearData = this.getYearData(year);
    return yearData.calendar_data[month] || {};
  }

  getEffectiveSalary(year, month) {
    try {
      // Érvényesítjük az évet
      if (year < 2024 || year > 2028) {
        console.warn(
          `Érvénytelen év: ${year}, az alapértelmezett 2024 lesz használva`
        );
        year = 2024;
      }

      const yearData = this.app.yearlyData[year];
      if (!yearData) {
        console.warn(`Nem található adat a ${year} évre`);
        return 300000; // Alapértelmezett érték
      }

      // Az alapbér lekérése
      const baseSalary = parseInt(yearData.settings?.besorolasi_ber) || 300000;

      // Évközi változások ellenőrzése
      if (yearData.settings?.midyear_changes?.length > 0) {
        // Rendezzük a változásokat dátum szerint csökkenő sorrendbe
        const sortedChanges = [...yearData.settings.midyear_changes].sort(
          (a, b) => b.month - a.month
        );

        // Keressük meg az első változást, ami a jelenlegi hónap előtt vagy abban történt
        const applicableChange = sortedChanges.find(
          (change) => change.month <= month
        );

        if (applicableChange) {
          return parseInt(applicableChange.salary);
        }
      }

      return baseSalary;
    } catch (error) {
      console.error("Hiba az érvényes bér meghatározása során:", error);
      return 300000; // Alapértelmezett érték hiba esetén
    }
  }

  getTuloraOrak(monthIndex, year) {
    try {
      if (!this.app.yearlyData[year]?.calendar_data?.[monthIndex]) {
        return { normal: 0, sunday: 0 };
      }

      const monthData = this.app.yearlyData[year].calendar_data[monthIndex];
      const pattern = this.app.yearlyData[year]?.settings?.muszakrend || "-";
      let normalOrak = 0;
      let vasarnapiOrak = 0;

      Object.entries(monthData).forEach(([day, shiftValue]) => {
        if (shiftValue && shiftValue.includes("Túlóra")) {
          const date = new Date(year, monthIndex, parseInt(day));
          const isSunday = date.getDay() === 0;
          let hours = 0;

          // Órák meghatározása
          if (shiftValue.includes("12 óra")) hours = 12;
          else if (shiftValue.includes("8 óra")) hours = 8;
          else if (shiftValue.includes("4 óra")) hours = 4;

          // A-B-C műszakrend speciális kezelése
          if (["A", "B", "C"].includes(pattern) && isSunday) {
            vasarnapiOrak += hours;
          } else {
            normalOrak += hours;
          }
        }
      });

      return { normal: normalOrak, sunday: vasarnapiOrak };
    } catch (error) {
      console.error("Hiba a túlóra órák számításában:", error);
      return { normal: 0, sunday: 0 };
    }
  }

  shouldCalculateOvertimeForMonth(year, monthIndex) {
    // 2025 október-november: csak novemberben (10)
    if (year === 2025 && monthIndex === 10) {
      return true;
    }
    
    // 2025 szeptember végéig: minden 3. hónap (2, 5, 8)
    if (year < 2025 || (year === 2025 && monthIndex < 9)) {
      return (monthIndex + 1) % 3 === 0; // március(2), június(5), szeptember(8)
    }
    
    // 2025 december 1-től: 4 hónapos periódusok vége
    // Március (2), Július (6), November (10)
    if (year > 2025 || (year === 2025 && monthIndex >= 11)) {
      return monthIndex === 2 || monthIndex === 6 || monthIndex === 10;
    }
    
    return false;
  }


  calculateQuarterlyOvertime(year, monthIndex) {
    try {
      let monthsToProcess = []; // Array of {year, month} objects
      
      // ─────────────────────────────────────────────────────────────────
      // SPECIÁLIS ESET: 2025 október-november (átmeneti periódus, 2 hónap)
      // ─────────────────────────────────────────────────────────────────
      if (year === 2025 && (monthIndex === 9 || monthIndex === 10)) {
        monthsToProcess = [
          {year: 2025, month: 9},
          {year: 2025, month: 10}
        ];
      }
      
      // ─────────────────────────────────────────────────────────────────
      // 2025 DECEMBER ELŐTT: 3 hónapos periódusok (régi rendszer)
      // ─────────────────────────────────────────────────────────────────
      else if (year < 2025 || (year === 2025 && monthIndex < 9)) {
        const startMonth = Math.floor(monthIndex / 3) * 3;
        monthsToProcess = [
          {year: year, month: startMonth},
          {year: year, month: startMonth + 1},
          {year: year, month: startMonth + 2}
        ];
      }
      
      // ─────────────────────────────────────────────────────────────────
      // 2025 DECEMBER 1-TŐL: 4 hónapos periódusok (új rendszer)
      // ─────────────────────────────────────────────────────────────────
      else {
        // Meghatározzuk a periódus kezdőhónapját
        // Dec-Jan-Feb-Mar (11,0,1,2), Apr-May-Jun-Jul (3,4,5,6), Aug-Sep-Oct-Nov (7,8,9,10)
        let periodStart;
        if (monthIndex >= 11 || monthIndex <= 2) {
          // December - Március periódus
          periodStart = 11; // December
        } else if (monthIndex >= 3 && monthIndex <= 6) {
          // Április - Július periódus
          periodStart = 3;
        } else {
          // Augusztus - November periódus
          periodStart = 7;
        }
        
        // Hónapok hozzáadása (évváltással is)
        for (let i = 0; i < 4; i++) {
          let currentMonth = periodStart + i;
          let currentYear = year;
          
          // Ha a periódus decemberrel kezdődik (11)
          if (periodStart === 11) {
            if (currentMonth === 11) {
              // December: ha az aktuális hónap jan-feb-márc (0-2), akkor előző év decembere
              if (monthIndex >= 0 && monthIndex <= 2) {
                currentYear = year - 1;
              }
              // különben az aktuális év decembere
            } else {
              // Jan-Feb-Márc (currentMonth > 11 után lesz 0,1,2)
              currentMonth = currentMonth - 12;
              // Ha az aktuális hónap december (11), akkor következő év jan-feb-márc
              if (monthIndex === 11) {
                currentYear = year + 1;
              }
              // különben az aktuális év jan-feb-márc
            }
          }
          
          monthsToProcess.push({year: currentYear, month: currentMonth});
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // ADATOK ÖSSZEGYŰJTÉSE A KIVÁLASZTOTT HÓNAPOKBÓL
      // ─────────────────────────────────────────────────────────────────
      let totalWorkingDays = 0;
      let totalHavi8 = 0;
      let totalLedolgozottOrak = 0;
      let totalCsuszoHours = 0;

      monthsToProcess.forEach(({year: processYear, month: processMonth}) => {
        const monthData = this.app.yearlyData[processYear]?.calendar_data[processMonth] || {};

        let monthWorkingDays = 0;
        Object.entries(monthData).forEach(([day, shiftValue]) => {
          if (!shiftValue) return;

          // Ledolgozott napok
          if (
            shiftValue.includes("Nappal") ||
            shiftValue.includes("Éjszaka") ||
            shiftValue.includes("Szabadság") ||
            shiftValue.includes("Csúszó") ||
            shiftValue.includes("Táppénz")
          ) {
            monthWorkingDays++;
          }

          // Ledolgozott órák (csúszók nélkül)
          if (shiftValue.includes("Nappal") || shiftValue.includes("Éjszaka")) {
            if (shiftValue.includes("12 óra")) {
              totalLedolgozottOrak += 12;
            } else if (shiftValue.includes("8 óra")) {
              totalLedolgozottOrak += 8;
            } else if (shiftValue.includes("4 óra")) {
              totalLedolgozottOrak += 4;
            } else {
              totalLedolgozottOrak += 12; // Alapértelmezett
            }
          }

          // Csúszó órák összeszámolása:
          // - "Csúszó túlórakeretből": levonjuk (csökkenti a keretet)
          // - Kombinált "Szabadság X óra + Csúszó Y óra": a csúszó rész szintén csökkenti a keretet
          // - "Csúszó túlórából": NEM vonjuk le itt (a Túlóra(100%) case maga kezeli, dupla lenne)
          if (shiftValue.includes("Csúszó") && shiftValue.includes("keretből")) {
            const hours = this.extractHoursFromShift(shiftValue);
            totalCsuszoHours += hours;
          } else if (shiftValue.includes("Szabadság") && shiftValue.includes("Csúszó")) {
            // Kombinált opció: a csúszó részt kinyerjük
            const hours = this.extractHoursFromShift(shiftValue);
            totalCsuszoHours += hours;
          }
        });

        totalWorkingDays += monthWorkingDays;
        const havi8 = this.calculateWorkingDays(processYear, processMonth) * 8;
        totalHavi8 += havi8;
      });

      // Túlóra keret: (összes ledolgozott óra) - (havi 8) - (csúszó órák)
      const totalRequiredHours = totalWorkingDays * 12;
      const tuloraKeret = totalRequiredHours - totalHavi8 - totalCsuszoHours;

      return tuloraKeret;
      console.log("tuloraKeret:", tuloraKeret);
    } catch (error) {
      console.error("Hiba a negyedéves túlóra számításában:", error);
      return 0;
    }
  }

  calculateWorkingDays(year, month) {
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const holidays = this.getHolidays(year);
      let workingDays = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();

        // Csak hétköznapi napok (hétfő-péntek) vizsgálata
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

        // Ünnepnap ellenőrzés
        const isHoliday = holidays.some(
          (h) => h.month === month && h.day === day
        );

        // Hétvégi ünnepnapok kizárása
        const isWeekendHoliday =
          isHoliday && (dayOfWeek === 0 || dayOfWeek === 6);

        // Csak hétköznapi nem hétvégi ünnepnapok számítása
        if (isWeekday && isHoliday && !isWeekendHoliday) {
          // Hétköznapi ünnepnap
          workingDays += 0; // Nem számoljuk munkanapnak
        } else if (isWeekday && !isHoliday) {
          // Normál munkanap
          workingDays += 1;
        }
      }

      return workingDays;
    } catch (error) {
      console.error("Hiba a munkanapok számításánál:", error);
      return 0;
    }
  }

  calculateShiftValues(monthData, date) {
    try {
      const isWeekend = date.getDay() === 0;
      const isHoliday = this.isHoliday(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

      return {
        isWeekend,
        isHoliday,
        shiftHours: this.getShiftHours(monthData),
        nightShiftHours: this.getNightShiftHours(monthData),
        weekendHours: isWeekend ? this.getWeekendHours(monthData) : 0,
        holidayHours: isHoliday ? this.getHolidayHours(monthData) : 0,
      };
    } catch (error) {
      console.error("Hiba a műszak értékek számításánál:", error);
      return {
        isWeekend: false,
        isHoliday: false,
        shiftHours: 0,
        nightShiftHours: 0,
        weekendHours: 0,
        holidayHours: 0,
      };
    }
  }

  calculateMonthlyValue(label, monthIndex, year) {
    try {
      // Érvényesítjük az évet
      if (!year || year < 2024 || year > 2028) {
        console.warn(
          `Érvénytelen év: ${year}, alapértelmezett 2024 használata`
        );
        year = 2024;
      }

      const yearData = this.app.yearlyData[year];
      const monthData = yearData.calendar_data[monthIndex] || {};

      // Az érvényes besorolási bér lekérése az adott hónapra
      const effectiveSalary = this.getEffectiveSalary(year, monthIndex);

      // Munkanapok számítása
      const workingDays = this.calculateWorkingDays(year, monthIndex);
      const havi8 = workingDays * 8;

      // Alapváltozók inicializálása
      let ledolgozando = 0;
      let ledolgozott = 0;
      let szabadsagOra = 0;
      let tappenzNapok = 0;
      let tulora100 = 0;
      let hetvegiPotlek50 = 0;
      let muszakPotlek40 = 0;
      let holidayCount = 0;
      let holidayValue = 0;

      // Napi értékek számítása
      Object.entries(monthData).forEach(([day, shiftValue]) => {
        if (!shiftValue) return;

        const date = new Date(year, monthIndex, parseInt(day));
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isHoliday = this.isHoliday(year, monthIndex, parseInt(day));

        // Ledolgozandó napok számítása
        if (
          shiftValue.includes("Nappal") ||
          shiftValue.includes("Éjszaka") ||
          shiftValue.includes("Szabadság") ||
          shiftValue.includes("Csúszó") ||
          shiftValue.includes("Táppénz vége műszak") ||
          shiftValue.includes("Táppénz kezdete műszak") ||
          (shiftValue.includes("Táppénz") && !shiftValue.includes("Táppénz vége") && !shiftValue.includes("Táppénz kezdete"))
        ) {
          ledolgozando += 1;
        }

        // Ledolgozott napok számítása
        if (
          shiftValue.includes("Nappal") ||
          shiftValue.includes("Éjszaka") ||
          shiftValue.includes("Csúszó")
        ) {
          ledolgozott += 1;
        } else if (shiftValue.includes("Szabadság")) {
          if (shiftValue.includes("12 óra")) {
            ledolgozott += 0;
          } else if (shiftValue.includes("8 óra")) {
            ledolgozott += 1 / 3;
          } else if (shiftValue.includes("4 óra")) {
            ledolgozott += 2 / 3;
          }
        }

        // Szabadság órák számítása
        // Kombinált opciók esetén (pl. "Szabadság 4 óra + Csúszó 8 óra") a szabadság részt
        // pontosabban kell kinyerni, hogy ne zavarjon a csúszó óra (pl. "8 óra")
        if (shiftValue.includes("Szabadság")) {
          const szabMatch = shiftValue.match(/Szabads[aá]g(?:\s+[eé]j)?\s+(\d+)\s*[oó]ra/i);
          if (szabMatch) {
            szabadsagOra += parseInt(szabMatch[1]);
          }
        }

        // Túlóra számítása
        if (
          shiftValue.includes("Túlóra 12 óra") ||
          shiftValue.includes("Túlóra éj 12 óra")
        ) {
          tulora100 += 12;
        } else if (
          shiftValue.includes("Túlóra 8 óra") ||
          shiftValue.includes("Túlóra éj 8 óra")
        ) {
          tulora100 += 8;
        }

        // Hétvégi pótlék számítása
        if (isWeekend) {
          if (shiftValue.includes("Nappal") || shiftValue.includes("Éjszaka")) {
            hetvegiPotlek50 += 12;
          } else if (
            shiftValue.includes("Szabadság 8 óra") ||
            shiftValue.includes("Szabadság éj 8 óra")
          ) {
            hetvegiPotlek50 += 4;
          } else if (
            shiftValue.includes("Szabadság 4 óra") ||
            shiftValue.includes("Szabadság éj 4 óra")
          ) {
            hetvegiPotlek50 += 8;
          }
        }

        // Műszakpótlék számítása
        if (
          shiftValue.includes("Éjszaka") ||
          shiftValue.includes("Túlóra éj 12 óra")
        ) {
          muszakPotlek40 += 12;
        } else if (shiftValue.includes("Túlóra éj 8 óra")) {
          muszakPotlek40 += 8;
        } else if (
          shiftValue.includes("Szabadság éj 4 óra")
        ) {
          muszakPotlek40 += 8;
        } else if (
          shiftValue.includes("Szabadság éj 8 óra")
        ) {
          muszakPotlek40 += 4;
        }

        // Ünnepnap számítása
        if (isHoliday) {
          if (
            shiftValue.includes("Nappal") ||
            shiftValue.includes("Éjszaka") ||
            shiftValue.includes("Túlóra 12 ó") ||
            shiftValue.includes("Túlóra éj 12 ó")
          ) {
            holidayCount += 1;
            holidayValue += 12;
          } else if (
            shiftValue.includes("Szabadság éj 8 óra") ||
            shiftValue.includes("Szabadság 8 óra")
          ) {
            holidayCount += 1 / 3;
            holidayValue += 4;
          } else if (
            shiftValue.includes("Szabadság 4 óra") ||
            shiftValue.includes("Szabadság éj 4 óra") ||
            shiftValue.includes("Túlóra 8 ó") ||
            shiftValue.includes("Túlóra éj 8 ó")
          ) {
            holidayCount += 2 / 3;
            holidayValue += 8;
          } else if (
            shiftValue.includes("Szabadság 12 óra") ||
            shiftValue.includes("Szabadság éj 12 óra")
          ) {
            holidayCount += 0;
            holidayValue += 0;
          }
        }

        // Táppénz számítása
        if (shiftValue.includes("Táppénz")) {
          tappenzNapok += 1;
        }
      });

      // Értékek visszaadása a label alapján
      switch (label) {
        case "Ledolgozandó napok":
          return ledolgozando;

        case "Ledolgozott napok":
          return ledolgozott;

        case "Szabadság kivét (óra)":
          return szabadsagOra;

        case "Túlóra (100%)": {
          let tulora100 = 0;
          
          Object.entries(monthData).forEach(([day, shiftValue]) => {
            if (!shiftValue) return;
            
            // Normál túlórák hozzáadása
            if (shiftValue.includes("Túlóra 12 óra") || shiftValue.includes("Túlóra éj 12 óra")) {
              tulora100 += 12;
            } else if (shiftValue.includes("Túlóra 8 óra") || shiftValue.includes("Túlóra éj 8 óra")) {
              tulora100 += 8;
            }
            // Csúszó túlórából levonás - JAVÍTVA
            else if (shiftValue.includes("Csúszó túlórából") && !shiftValue.includes("keretből")) {
              // "Csúszó túlórából 7.5 óra" formátumból kivesszük a 7.5-öt
              const match = shiftValue.match(/(\d+\.?\d*)\s*óra/);
              if (match) {
                const hours = parseFloat(match[1]);
                tulora100 -= hours; // Levonjuk a havi túlórából
              }
            }
          });
          
          // Negyedéves túlóra keret hozzáadása (csak negyedév végén)
          if (this.shouldCalculateOvertimeForMonth(year, monthIndex)) {
            const tuloraKeret = this.calculateQuarterlyOvertime(year, monthIndex);
          
            // Csúszó túlórakeretből levonás
            Object.entries(monthData).forEach(([day, shiftValue]) => {
              if (shiftValue && shiftValue.includes("Csúszó túlórakeretből")) {
                const match = shiftValue.match(/(\d+\.?\d*)\s*óra/);
                if (match) {
                  const hours = parseFloat(match[1]);
                  tulora100 -= hours; // Levonjuk a keretből
                }
              }
            });
            
            tulora100 += tuloraKeret;
          }
          
          return tulora100;
        }

        case "Hétvégi pótlék 50%": {
          const monthData =
            this.app.yearlyData[year]?.calendar_data[monthIndex] || {};
          let totalWeekendHours = 0;
          const pattern = this.app.yearlyData[year]?.settings?.muszakrend;

          Object.entries(monthData).forEach(([day, shiftValue]) => {
            if (!shiftValue) return;
            const date = new Date(year, monthIndex, parseInt(day));
            const isSunday = date.getDay() === 0; // Csak vasárnapra ellenőrzünk
            const isHoliday = this.isHoliday(year, monthIndex, parseInt(day));

            // JAVÍTÁS: Vasárnapokon számolunk hétvégi pótlékot, ünnepnapon is!
            if (isSunday) {
              // Eltávolítottuk a "&& !isHoliday" feltételt
              // Kombinált Szabadság + Csúszó: a csúszó rész alapján számoljuk a hétvégi pótlékot
              if (shiftValue.includes("Szabadság") && shiftValue.includes("Csúszó")) {
                const csuszoHours = this.extractHoursFromShift(shiftValue);
                totalWeekendHours += Math.max(0, 12 - csuszoHours);
              } else if (
                shiftValue.includes("Nappal") ||
                shiftValue.includes("Éjszaka")
              ) {
                totalWeekendHours += 12;
              } else if (
                shiftValue.includes("Szabadság 8 óra") ||
                shiftValue.includes("Csúszó 8 óra") ||
                shiftValue.includes("Szabadság éj 8 óra") ||
                shiftValue.includes("Csúszó éj 8 óra")
              ) {
                totalWeekendHours += 4;
              } else if (
                shiftValue.includes("Szabadság 4 óra") ||
                shiftValue.includes("Csúszó 4 óra") ||
                shiftValue.includes("Szabadság éj 4 óra") ||
                shiftValue.includes("Csúszó éj 4 óra")
              ) {
                totalWeekendHours += 8;
              }

              else if (shiftValue.includes("Csúszó")) {
                const hours = this.extractHoursFromShift(shiftValue);
                totalWeekendHours += Math.max(0, 12 - hours);
              }

              // A-B-C műszakrendek esetén a vasárnapi túlórák hozzáadása ÜNNEPNAPON IS
              if (
                ["A", "B", "C"].includes(pattern) &&
                shiftValue.includes("Túlóra")
              ) {
                if (shiftValue.includes("12 óra")) {
                  totalWeekendHours += 12;
                } else if (shiftValue.includes("8 óra")) {
                  totalWeekendHours += 8;
                } else if (shiftValue.includes("4 óra")) {
                  totalWeekendHours += 4;
                }
              }
              // JAVÍTÁS: 1-4 műszakrendek esetén is adjuk meg a túlóra hétvégi pótlékot vasárnapi ünnepnapokon
              else if (
                !["A", "B", "C"].includes(pattern) &&
                shiftValue.includes("Túlóra")
              ) {
                if (shiftValue.includes("12 óra")) {
                  totalWeekendHours += 12;
                } else if (shiftValue.includes("8 óra")) {
                  totalWeekendHours += 8;
                } else if (shiftValue.includes("4 óra")) {
                  totalWeekendHours += 4;
                }
              }
            }
            // Eltávolítottuk a szombati napokra vonatkozó külön feltételt
          });

          return totalWeekendHours;
        }

        // Műszakpótlék 40% számításának módosítása
        case "Műszakpótlék 40%": {
          let muszakPotlek40 = 0;

          // Napi értékek számítása
          Object.entries(monthData).forEach(([day, shiftValue]) => {
            if (!shiftValue) return;

            // Ellenőrizzük, hogy ünnepnap-e
            const isHoliday = this.isHoliday(year, monthIndex, parseInt(day));

            // JAVÍTÁS: Ünnepnapokon is adjuk meg a műszakpótlékot túlórázáskor
            if (shiftValue.includes("Éjszaka")) {
              muszakPotlek40 += 12;
            } else if (shiftValue.includes("Túlóra éj 12 óra")) {
              muszakPotlek40 += 12; // Ünnepnapon is jár
            } else if (shiftValue.includes("Túlóra éj 8 óra")) {
              muszakPotlek40 += 8; // Ünnepnapon is jár
            } else if (
              shiftValue.includes("Szabadság éj 4 óra") ||
              shiftValue.includes("Csúszó éj 4 óra")
            ) {
              muszakPotlek40 += 8;
            } else if (
              shiftValue.includes("Szabadság éj 8 óra") ||
              shiftValue.includes("Csúszó éj 8 óra")
            ) {
              muszakPotlek40 += 4;
            } else if (shiftValue.includes("Szabadság") && shiftValue.includes("Csúszó") && shiftValue.includes("éj")) {
              // Kombinált "Szabadság X óra + Csúszó Y óra éj" esetén a csúszó rész éjszakai pótlékot kap
              const csuszoHours = this.extractHoursFromShift(shiftValue);
              muszakPotlek40 += csuszoHours;
            } else if (shiftValue.includes("Csúszó") && shiftValue.includes("éj")) {
              const hours = this.extractHoursFromShift(shiftValue);
              muszakPotlek40 += Math.max(0, 12 - hours);
            }
          });

          return muszakPotlek40;
        }

        case "Teljesítmény prémium": {
          const yearData = this.app.yearlyData[year];
          const bonusValue = yearData.bonusEntries?.[monthIndex] || 0;
          return effectiveSalary * 0.05 * bonusValue;
        }

        case "Alapbér":
          return ledolgozando > 0
            ? (effectiveSalary / ledolgozando) * ledolgozott
            : 0;

        case "Túlóra alap": {
          const workingDays = this.calculateWorkingDays(year, monthIndex);
          const havi8 = workingDays * 8;
          const effectiveSalary = this.getEffectiveSalary(year, monthIndex);
          const tuloraOrak = this.getTuloraOrak(monthIndex, year);
          // Negyedéves túlóra keret számítása
          let tuloraKeret = 0;
          if (this.shouldCalculateOvertimeForMonth(year, monthIndex)) {
            tuloraKeret = this.calculateQuarterlyOvertime(year, monthIndex);
          }

          // A teljes túlóra óraszám figyelembe vétele
          const osszTuloraOrak =
            tuloraOrak.normal + tuloraOrak.sunday + tuloraKeret;

          // Túlóra alapjának számítása a havi 8 óra alapján
          const tuloraAlap =
            osszTuloraOrak > 0 ? (effectiveSalary / havi8) * osszTuloraOrak : 0;

          return Math.round(tuloraAlap);
        }
        case "Szabadságra jutó fizetés":
          return ledolgozando > 0
            ? (effectiveSalary / (ledolgozando * 12)) * szabadsagOra
            : 0;

        case "Távolléti díj":
          return this.calculateTavolletDij(monthIndex, year);

        case "Betegszabadságra jutó fizetés":
          return this.calculateBetegszabadsagFizetes(monthIndex, year);

        case "Táppénz ellátás (60%)":
          return this.calculateTappenzTavolletiDij(monthIndex, year);

        case "Fizetett ünnepnap":
          return ledolgozando > 0
            ? (effectiveSalary / ledolgozando) * holidayCount
            : 0;

        case "Túlórapótlék": {
          const effectiveSalary = this.getEffectiveSalary(year, monthIndex);
          const workingDays = this.calculateWorkingDays(year, monthIndex);
          const havi8 = workingDays * 8;
          const tuloraOrak = this.getTuloraOrak(monthIndex, year);
          const pattern =
            this.app.yearlyData[year]?.settings?.muszakrend || "-";

          // Negyedéves túlóra keret számítása
          let tuloraKeret = 0;
          if (this.shouldCalculateOvertimeForMonth(year, monthIndex)) {
            tuloraKeret = this.calculateQuarterlyOvertime(year, monthIndex);
          }
          // Normál túlórapótlék (100%)
          const normalTulorapotlek =
            (effectiveSalary / 174) * (tuloraOrak.normal + tuloraKeret);

          // Vasárnapi túlórapótlék speciális kezelése A, B, C műszakrendnél
          let vasarnapiTulorapotlek = 0;
          if (["A", "B", "C"].includes(pattern)) {
            // Vasárnapi túlóra 100%-os pótléka
            vasarnapiTulorapotlek = (effectiveSalary / 174) * tuloraOrak.sunday;
          } else {
            // Egyéb műszakrendek normál 100%-os pótléka
            vasarnapiTulorapotlek = (effectiveSalary / 174) * tuloraOrak.sunday;
          }

          return Math.round(normalTulorapotlek + vasarnapiTulorapotlek);
        }

        case "Hétvégi pótlék (50%)": {
          // Először lekérjük az óraszámot a már javított Hétvégi pótlék 50% függvényből
          const hetvegipotlekHours = this.calculateMonthlyValue(
            "Hétvégi pótlék 50%",
            monthIndex,
            year
          );
          const effectiveSalary = this.getEffectiveSalary(year, monthIndex);

          // Majd kiszámoljuk a pénzösszeget
          return Math.round((effectiveSalary / 174) * hetvegipotlekHours * 0.5);
        }

        // Műszakpótlék javítása
        case "Műszakpótlék (40%)": {
          // Először lekérjük az óraszámot a már javított Műszakpótlék 40% függvényből
          const muszakPotlekHours = this.calculateMonthlyValue(
            "Műszakpótlék 40%",
            monthIndex,
            year
          );
          const effectiveSalary = this.getEffectiveSalary(year, monthIndex);

          // Majd kiszámoljuk a pénzösszeget
          return Math.round((effectiveSalary / 174) * muszakPotlekHours * 0.4);
        }

        case "TB Járulék 18,5%": {
          const bruttoBer = this.calculateMonthlyValue("Bruttó bér", monthIndex, year);
          // Táppénz ellátás TB-mentes, ki kell vonni az alapból
          const tappenzEllatas = this.calculateMonthlyValue("Táppénz ellátás (60%)", monthIndex, year);
          const tbAlap = bruttoBer - tappenzEllatas;
          return Math.round(tbAlap * 0.185);
        }

        case "Rendszeres SZJA előleg": {
          const bruttoBer = this.calculateMonthlyValue("Bruttó bér", monthIndex, year);
          // Bruttó már tartalmazza a táppénzt, SZJA alap = teljes bruttó
          const baseSSZJA = Math.round(bruttoBer * 0.15);

          // 25 év alatti kedvezmény levonása az SZJA-ból
          const under25Discount = this.app.calculateUnder25Discount(
            year,
            monthIndex,
            bruttoBer
          );

          // Az SZJA előleg nem lehet negatív
          const finalSZJA = Math.max(0, baseSSZJA - under25Discount);

          return finalSZJA;
        }

        case "Családi adókedvezmény": {
          const yearData = this.app.yearlyData[year];
          const childCount = parseInt(yearData.settings.children_count || 0);
          const date = new Date(year, monthIndex);
          return this.calculateChildTaxBenefit(childCount, date);
        }

        case "Nettó": {
          const yearData = this.app.yearlyData[year];
          const bruttoBer = this.calculateMonthlyValue(
            "Bruttó bér",
            monthIndex,
            year
          );
          const otherIncome = parseFloat(yearData.settings.other_income || 0);
          const restaurantEntry = yearData.restaurantEntries?.[monthIndex] || 0;
          const childBenefit = this.calculateMonthlyValue(
            "Családi adókedvezmény",
            monthIndex,
            year
          );

          const tbJarulek = this.calculateMonthlyValue(
            "TB Járulék 18,5%",
            monthIndex,
            year
          );
          const szja = this.calculateMonthlyValue(
            "Rendszeres SZJA előleg",
            monthIndex,
            year
          );

          // Bruttó bér már tartalmazza a táppénzt is
          return Math.round(
            bruttoBer +
              otherIncome +
              childBenefit -
              tbJarulek -
              szja -
              restaurantEntry
          );
        }

        case "Megmaradt szabadságok": {
          const yearData = this.app.yearlyData[year];
          const totalVacationDays = parseFloat(yearData.settings.szabadsag || 25);

          // Az év elejétől a jelenlegi hónapig összesítjük a szabadságokat
          let totalUsedVacationHours = 0;
          for (let i = 0; i <= monthIndex; i++) {
            totalUsedVacationHours += this.calculateMonthlyValue(
              "Szabadság kivét (óra)",
              i,
              year
            );
          }

          // Órák átváltása napokra (8 órás munkanappal számolva)
          const totalUsedVacationDays = totalUsedVacationHours / 8;

          // Megmaradt szabadságnapok
          const remainingVacationDays =
            totalVacationDays - totalUsedVacationDays;

          return remainingVacationDays * 10 / 10;
        }

        case "Bruttó bér": {
          try {
            // Minden komponens összegzése
            const components = [
              "Alapbér",
              "Túlóra alap",
              "Szabadságra jutó fizetés",
              "Távolléti díj",
              "Betegszabadságra jutó fizetés",
              "Táppénz ellátás (60%)",
              "Fizetett ünnepnap",
              "Túlórapótlék",
              "Hétvégi pótlék (50%)",
              "Műszakpótlék (40%)",
              "Teljesítmény prémium",
            ];

            const total = components.reduce((sum, component) => {
              const value = this.calculateMonthlyValue(
                component,
                monthIndex,
                year
              );
              return sum + value;
            }, 0);

            // Egyéb jövedelem hozzáadása
            const yearData = this.app.yearlyData[year];
            const egyebJovedelem = yearData?.egyebJovedelmEntries?.[monthIndex] || 0;

            return Math.round(total + egyebJovedelem);
          } catch (error) {
            console.error("Hiba a bruttó bér számítása során:", error);
            return 0;
          }
        }
        default:
          console.warn(`Ismeretlen tétel: ${label}`);
          return 0;
      }
    } catch (error) {
      console.error("Hiba a havi érték számítása során:", error, {
        label,
        monthIndex,
        year,
      });
      return 0;
    }
  }

  getMonthData(monthIndex, year) {
    const yearData = this.app.yearData;
    const monthData = {
      workedDays: 0,
      totalWorkingDays: this.calculateWorkingDays(year, monthIndex),
      vacationHours: 0,
      overtimeHours: 0,
      nightShiftHours: 0,
      weekendHours: 0,
      sickDays: 0,
    };

    const calendarData = this.app.yearData.calendar_data[monthIndex] || {};

    // Ha üres a calendar_data, térjünk vissza az alapértelmezett adatokkal
    if (Object.keys(calendarData).length === 0) {
      return monthData;
    }

    Object.entries(calendarData).forEach(([day, shiftValue]) => {
      const date = new Date(year, monthIndex, parseInt(day));
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      switch (shiftValue) {
        case "Nappal":
          monthData.workedDays += 1;
          if (isWeekend) monthData.weekendHours += 12;
          break;

        case "Éjszaka":
          monthData.workedDays += 1;
          monthData.nightShiftHours += 12;
          if (isWeekend) monthData.weekendHours += 12;
          break;

        case "Szabadság 12 óra":
          monthData.vacationHours += 12;
          break;

        case "Szabadság éj 12 óra":
          monthData.vacationHours += 12;
          monthData.nightShiftHours += 12;
          break;

        case "Szabadság 8 óra":
          monthData.vacationHours += 8;
          break;

        case "Szabadság éj 8 óra":
          monthData.vacationHours += 8;
          monthData.nightShiftHours += 8;
          break;

        case "Szabadság 4 óra":
          monthData.vacationHours += 4;
          break;

        case "Szabadság éj 4 óra":
          monthData.vacationHours += 4;
          monthData.nightShiftHours += 4;
          break;

        case "Túlóra 12 óra":
          monthData.workedDays += 1;
          monthData.overtimeHours += 12;
          if (isWeekend) monthData.weekendHours += 12;
          break;

        case "Túlóra éj 12 óra":
          monthData.workedDays += 1;
          monthData.overtimeHours += 12;
          monthData.nightShiftHours += 12;
          if (isWeekend) monthData.weekendHours += 12;
          break;

        case "Túlóra 8 óra":
          monthData.overtimeHours += 8;
          if (isWeekend) monthData.weekendHours += 8;
          break;

        case "Túlóra éj 8 óra":
          monthData.overtimeHours += 8;
          monthData.nightShiftHours += 8;
          if (isWeekend) monthData.weekendHours += 8;
          break;

        case "Táppénz":
          monthData.sickDays += 1;
          break;
      }
    });
    return monthData;
  }

  // Segédfüggvény csúszó órák kinyeréséhez
  extractHoursFromShift(shiftValue) {
    if (!shiftValue || typeof shiftValue !== 'string') return 0;
    
    // Kombinált opció esetén (pl. "Szabadság 4 óra + Csúszó 8 óra"):
    // a csúszó részt kell kinyerni, nem a szabadság részt
    if (shiftValue.includes("Szabadság") && shiftValue.includes("Csúszó")) {
      const csuszoMatch = shiftValue.match(/Cs[uú]sz[oó][^+]*?(\d+\.?\d*)\s*[oó]ra/i);
      return csuszoMatch ? parseFloat(csuszoMatch[1]) : 0;
    }
    
    // "Csúszó túlórakeretből 7.5 óra" formátumból kiveszi a 7.5-öt
    const match = shiftValue.match(/(\d+\.?\d*)\s*óra/);
    return match ? parseFloat(match[1]) : 0;
  }

  // Csúszó órák típusának meghatározása
  getShiftHourType(shiftValue) {
    if (!shiftValue) return null;
    
    if (shiftValue.includes('Csúszó túlórakeretből éjszaka')) return 'keret_night';
    if (shiftValue.includes('Csúszó túlórakeretből')) return 'keret_day';
    if (shiftValue.includes('Csúszó túlórából éjszaka')) return 'tulora_night';
    if (shiftValue.includes('Csúszó túlórából')) return 'tulora_day';
    
    return null;
  }

  // 1. FŐ TÁVOLLÉTI DÍJ FÜGGVÉNY (szabadság TD + betegszabadság/táppénz pótlék TD)
  calculateTavolletDij(monthIndex, year) {
    try {
      const szabadsagTavolletiDij = this.calculateSzabadsagTavolletiDij(monthIndex, year);
      const betegTappenzPotlekTD = this.calculateBetegTappenzPotlekTD(monthIndex, year);


      return szabadsagTavolletiDij + betegTappenzPotlekTD;

    } catch (error) {
      console.error("Hiba a távolléti díj számításában:", error);
      return 0;
    }
  }

  // SEGÉDFÜGGVÉNY: Hány betegszabadság nap fogyott el az év elejétől az adott hónap ELŐTT
  // A törvényi keret 120 óra = 15 × 8 óra, de 12 órás munkarendben ez 10 nap (120 ÷ 12)
  calculateFelhasznaltBetegszabadsagNapok(monthIndex, year) {
    const BETEGSZAB_KERET_NAP = 10; // 120 óra ÷ 12 óra/nap
    let felhasznalt = 0;

    for (let m = 0; m < monthIndex; m++) {
      const { betegszabNapok } = this.calculateHaviTappenzReszletek(m, year, BETEGSZAB_KERET_NAP - felhasznalt);
      felhasznalt += betegszabNapok;
      if (felhasznalt >= BETEGSZAB_KERET_NAP) { felhasznalt = BETEGSZAB_KERET_NAP; break; }
    }

    return felhasznalt;
  }

  // SEGÉDFÜGGVÉNY: Az előző hónap végén folyt-e még a táppénz?
  // Visszaad: { folytatodas: bool, elozoHonapKezdoNap: nap száma vagy null, elozoHonapKezdoEv: év, elozoHonapKezdoHonap: hónap }
  isTappenzFolytatodas(monthIndex, year) {
    let prevMonth = monthIndex - 1;
    let prevYear = year;
    if (prevMonth < 0) { prevMonth = 11; prevYear--; }

    const prevMonthData = this.app.yearlyData[prevYear]?.calendar_data[prevMonth] || {};
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

    let tappenzTalalt = false;
    for (let d = daysInPrevMonth; d >= 1; d--) {
      const shift = prevMonthData[d] || "";
      if (shift.includes("Táppénz vége")) return { folytatodas: false };
      if (shift.includes("Táppénz")) { tappenzTalalt = true; }
      else if (tappenzTalalt && shift && shift !== " ") {
        // Volt táppénz és most más műszak jön visszafelé haladva → ez a betegség kezdete utáni nap
        break;
      }
    }

    if (!tappenzTalalt) return { folytatodas: false };

    // Megkeressük a betegség kezdőnapját az előző hónapban (vagy még korábbi hónapban)
    const kezdoNap = this.getTappenzKezdoNap(prevMonth, prevYear);
    return {
      folytatodas: true,
      kezdoNap: kezdoNap.nap,
      kezdoHonap: kezdoNap.honap,
      kezdoEv: kezdoNap.ev
    };
  }

  // SEGÉDFÜGGVÉNY: Megkeresi a táppénz időszak legelső napját visszamenőleg
  getTappenzKezdoNap(monthIndex, year) {
    let m = monthIndex;
    let y = year;

    while (true) {
      const monthData = this.app.yearlyData[y]?.calendar_data[m] || {};
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      let elsoTappenz = null;

      for (let d = 1; d <= daysInMonth; d++) {
        const shift = monthData[d] || "";
        if (shift.includes("Táppénz")) {
          if (elsoTappenz === null) elsoTappenz = d;
        } else if (elsoTappenz !== null && shift && shift !== " ") {
          // Megszakítás → az elsoTappenz az igazi kezdőnap
          return { nap: elsoTappenz, honap: m, ev: y };
        }
      }

      if (elsoTappenz !== null) {
        // Megnézzük az előző hónapot is — hátha ott is folytatódott
        let prevM = m - 1; let prevY = y;
        if (prevM < 0) { prevM = 11; prevY--; }
        const prevData = this.app.yearlyData[prevY]?.calendar_data[prevM] || {};
        const daysInPrev = new Date(prevY, prevM + 1, 0).getDate();
        const lastShift = prevData[daysInPrev] || "";

        // Ha az előző hónap utolsó napja is táppénz volt → menjünk még visszább
        if (lastShift.includes("Táppénz") && !lastShift.includes("Táppénz vége")) {
          m = prevM; y = prevY;
          continue;
        }
        return { nap: elsoTappenz, honap: m, ev: y };
      }

      return { nap: 1, honap: m, ev: y }; // fallback
    }
  }

  // SEGÉDFÜGGVÉNY: Egy hónap táppénz/betegszabadság napjainak kiszámítása adott maradék kerettel
  // Visszaad: { betegszabNapok, tappenzNapok } (napok száma, nem forint)
  calculateHaviTappenzReszletek(monthIndex, year, maradekKeret) {
    const monthData = this.app.yearlyData[year]?.calendar_data[monthIndex] || {};

    let tappenzNapok = [];
    Object.entries(monthData).forEach(([day, shiftValue]) => {
      if (shiftValue && shiftValue.includes("Táppénz")) {
        tappenzNapok.push({
          nap: parseInt(day),
          originalShift: this.getOriginalShiftForDay(year, monthIndex, parseInt(day))
        });
      }
    });

    if (tappenzNapok.length === 0) return { betegszabNapok: 0, tappenzNapok: 0 };
    tappenzNapok.sort((a, b) => a.nap - b.nap);

    const idoszakok = this.getTappenzPeriods(tappenzNapok, monthData);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const folytatodasInfo = this.isTappenzFolytatodas(monthIndex, year);
    const folytatodas = folytatodasInfo.folytatodas;

    // Keret ÓRÁBAN: maradekKeret napokban jön (10 nap = 120 óra max)
    let keretOra = maradekKeret * 12;

    let betegszabNapok = 0;
    let tappenzNapokDb = 0;

    idoszakok.forEach((idoszak, idoszakIndex) => {
      const elsoIdoszakFolytatodas = (idoszakIndex === 0 && folytatodas);
      const kezdoNap = elsoIdoszakFolytatodas ? 1 : idoszak[0].nap;
      const utolsoJeloltNap = idoszak[idoszak.length - 1].nap;
      const utolsoJeloltShift = monthData[utolsoJeloltNap] || "";

      const vegeNap = utolsoJeloltShift.includes("Táppénz vége")
        ? utolsoJeloltNap
        : daysInMonth;


      for (let naptariNap = kezdoNap; naptariNap <= vegeNap; naptariNap++) {
        const napAdata = idoszak.find(t => t.nap === naptariNap);
        const shiftErtek = monthData[naptariNap] || "";
        const originalShift = napAdata?.originalShift || "";

        // Beosztott napnak számít: volt eredeti műszak, vagy manuálisan jelölte be,
        // vagy Táppénz kezdete/vége műszak opció
        const isMuszakNap = napAdata && (
          (originalShift && originalShift !== " ") ||
          shiftErtek.includes("Táppénz kezdete műszak") ||
          shiftErtek.includes("Táppénz vége műszak") ||
          (!originalShift || originalShift === " ")
        );

        if (keretOra <= 0) {
          // Nincs betegszabadság keret → táppénz minden naptári napra
          tappenzNapokDb++;
        } else if (isMuszakNap) {
          // Beosztott nap: 12 óra fogy a keretből → betegszabadság
          betegszabNapok++;
          keretOra -= 12;
        }
        // Szabadnap és nincs keret sem: nem jár semmi
      }
    });

    return { betegszabNapok, tappenzNapok: tappenzNapokDb };
  }

  // 2. BETEGSZABADSÁGRA JUTÓ FIZETÉS SZÁMÍTÁSA (óra alapú, ledolgozandó × 12 osztóval)
  calculateBetegszabadsagFizetes(monthIndex, year) {
    try {
      const besorolas = this.getEffectiveSalary(year, monthIndex);
      const monthData = this.app.yearlyData[year]?.calendar_data[monthIndex] || {};

      // Ledolgozandó napok × 12 = havi beosztott munkaóra (tartalmazza a táppénzes napokat is)
      const ledolgozando = this.calculateMonthlyValue("Ledolgozandó napok", monthIndex, year);
      const haviMunkaOra = ledolgozando > 0
        ? ledolgozando * 12
        : this.calculateWorkingDays(year, monthIndex) * 12;

      const oradij = besorolas / haviMunkaOra;

      const felhasznalt = this.calculateFelhasznaltBetegszabadsagNapok(monthIndex, year);
      const maradekKeret = Math.max(0, 10 - felhasznalt);

      const { betegszabNapok } = this.calculateHaviTappenzReszletek(monthIndex, year, maradekKeret);

      const betegszabOra = betegszabNapok * 12;
      const osszeg = Math.round(betegszabOra * oradij * 0.7);

      return osszeg;

    } catch (error) {
      console.error("Hiba a betegszabadság számításában:", error);
      return 0;
    }
  }

  // 3. TÁPPÉNZ ELLÁTÁS SZÁMÍTÁSA (TB által folyósított 60%)
  // Alap: táppénz kezdőnapját megelőző 3. hónap utolsó napjától visszafelé 180 naptári nap
  // De legfeljebb a táppénz kezdőnapját megelőző naptári év január 1-jéig
  calculateTappenzTavolletiDij(monthIndex, year) {
    try {

      // 1. Táppénz kezdőnapjának meghatározása az adott hónapban
      const monthData = this.app.yearlyData[year]?.calendar_data[monthIndex] || {};
      let tappenzKezdete = null;

      // Ha folytatás az előző hónapból, visszakeressük az eredeti kezdőnapot
      const folytatodasInfo = this.isTappenzFolytatodas(monthIndex, year);
      if (folytatodasInfo.folytatodas) {
        const kezdo = this.getTappenzKezdoNap(monthIndex, year);
        tappenzKezdete = new Date(Date.UTC(kezdo.ev, kezdo.honap, kezdo.nap));
      } else {
        // Az adott hónapban keressük az első táppénz napot
        const napok = Object.entries(monthData)
          .filter(([, v]) => v && v.includes("Táppénz"))
          .map(([d]) => parseInt(d))
          .sort((a, b) => a - b);
        if (napok.length === 0) return 0;
        tappenzKezdete = new Date(Date.UTC(year, monthIndex, napok[0]));
      }

      // 2. Vizsgált időszak meghatározása
      // Záródátum: táppénz kezdőnapját megelőző 3. hónap utolsó napja
      const zaroHonap = new Date(Date.UTC(tappenzKezdete.getUTCFullYear(), tappenzKezdete.getUTCMonth() - 3, 1));
      const zaroDatum = new Date(Date.UTC(zaroHonap.getUTCFullYear(), zaroHonap.getUTCMonth() + 1, 0)); // hónap utolsó napja

      // Kezdődátum: zaroDatumtól visszafelé 180 nap
      const kezdoDatum = new Date(zaroDatum);
      kezdoDatum.setUTCDate(kezdoDatum.getUTCDate() - 179); // 180 nap = zaroDatum + 179 nap visszafelé

      // Korlát: táppénz kezdőnapját megelőző naptári év január 1.
      const korlat = new Date(Date.UTC(tappenzKezdete.getUTCFullYear() - 1, 0, 1));
      if (kezdoDatum < korlat) kezdoDatum.setTime(korlat.getTime());


      // 3. Tényleges napok száma a vizsgált időszakban
      const vizsgaltNapok = Math.round((zaroDatum - kezdoDatum) / (1000 * 60 * 60 * 24)) + 1;

      // 4. Bruttó kereset összesítése a vizsgált időszakra (arányosan havi bontásban)
      let osszKereset = 0;

      let datum = new Date(kezdoDatum);
      while (datum <= zaroDatum) {
        const ev = datum.getUTCFullYear();
        const honap = datum.getUTCMonth();
        const daysInMonth = new Date(Date.UTC(ev, honap + 1, 0)).getUTCDate();

        // Hány nap esik ebből a hónapból a vizsgált időszakra
        const honapKezdete = new Date(Date.UTC(ev, honap, 1));
        const honapVege = new Date(Date.UTC(ev, honap, daysInMonth));
        const idoszakKezdete = datum > honapKezdete ? datum : honapKezdete;
        const idoszakVege = zaroDatum < honapVege ? zaroDatum : honapVege;
        const napokSzama = Math.round((idoszakVege - idoszakKezdete) / (1000 * 60 * 60 * 24)) + 1;

        // Arányos bruttó (táppénz nélkül)
        if (this.app.yearlyData[ev]?.calendar_data?.[honap]) {
          const bruttoHavi = this.calculateMonthlyValue("Bruttó bér", honap, ev)
            - this.calculateTappenzTavolletiDij_Aktualis(honap, ev);
          osszKereset += bruttoHavi * (napokSzama / daysInMonth);
        }

        // Következő hónap első napjára ugrunk
        datum = new Date(Date.UTC(ev, honap + 1, 1));
      }

      // 5. Napi táppénz alap = összes kereset ÷ vizsgált napok száma
      const napiAlap = vizsgaltNapok > 0 ? osszKereset / vizsgaltNapok : 0;

      const felhasznalt = this.calculateFelhasznaltBetegszabadsagNapok(monthIndex, year);
      const maradekKeret = Math.max(0, 10 - felhasznalt);
      const { tappenzNapok } = this.calculateHaviTappenzReszletek(monthIndex, year, maradekKeret);

      const osszeg = Math.round(tappenzNapok * napiAlap * 0.6);


      return osszeg;
    } catch (error) {
      console.error("Hiba a táppénz számításában:", error);
      return 0;
    }
  }

  // Segédfüggvény: aktuális bér alapú táppénz (ha nincs előző éves adat)
  calculateTappenzTavolletiDij_Aktualis(monthIndex, year) {
    const besorolas = this.getEffectiveSalary(year, monthIndex);
    const monthData = this.app.yearlyData[year]?.calendar_data[monthIndex] || {};
    let valodiBeosztottNapok = 0;
    Object.entries(monthData).forEach(([day, shiftValue]) => {
      if (!shiftValue || shiftValue === " ") return;
      if (
        shiftValue.includes("Nappal") || shiftValue.includes("Éjszaka") ||
        shiftValue.includes("Csúszó") || shiftValue.includes("Szabadság") ||
        shiftValue.includes("Túlóra")
      ) valodiBeosztottNapok++;
    });
    const haviMunkaOra = valodiBeosztottNapok > 0
      ? valodiBeosztottNapok * 12
      : this.calculateWorkingDays(year, monthIndex) * 12;
    const oradij = besorolas / haviMunkaOra;

    const felhasznalt = this.calculateFelhasznaltBetegszabadsagNapok(monthIndex, year);
    const maradekKeret = Math.max(0, 10 - felhasznalt);
    const { tappenzNapok } = this.calculateHaviTappenzReszletek(monthIndex, year, maradekKeret);

    return Math.round(tappenzNapok * 12 * oradij * 0.6);
  }

  // 3b. BETEGSZABADSÁG + TÁPPÉNZ PÓTLÉK TD (Távolléti díj sor a bérpapíron)
  calculateBetegTappenzPotlekTD(monthIndex, year) {
    try {
      const besorolas = this.getEffectiveSalary(year, monthIndex);
      const {atlagEjszakaiPotlek, atlagVasarnapiPotlek} = this.calculateAveragePotlekok(monthIndex, year, besorolas);
      const potlekOradij = atlagEjszakaiPotlek + atlagVasarnapiPotlek;

      const felhasznalt = this.calculateFelhasznaltBetegszabadsagNapok(monthIndex, year);
      const maradekKeret = Math.max(0, 10 - felhasznalt);

      const { betegszabNapok, tappenzNapok } = this.calculateHaviTappenzReszletek(monthIndex, year, maradekKeret);

      // 12 órás munkarendben 1 nap = 12 óra
      const betegszabPotlek = betegszabNapok * 12 * potlekOradij * 0.7;
      const tappenzPotlek = tappenzNapok * 12 * potlekOradij * 0.6;
      const osszeg = Math.round(betegszabPotlek + tappenzPotlek);


      return osszeg;
    } catch (error) {
      console.error("Hiba a pótlék TD számításában:", error);
      return 0;
    }
  }

  // 4. SZABADSÁG TÁVOLLÉTI DÍJ (módosított - külön a szabadsághoz)
  calculateSzabadsagTavolletiDij(monthIndex, year) {
    try {
      const yearData = this.app.yearlyData[year];
      const monthData = yearData?.calendar_data[monthIndex] || {};
      const besorolas = this.getEffectiveSalary(year, monthIndex);

      // Előző 6 hónap pótlékainak és munkaóráinak összegzése
      const {atlagEjszakaiPotlek, atlagVasarnapiPotlek} = this.calculateAveragePotlekok(monthIndex, year, besorolas);

      // Szabadság távolléti díj számítása
      let szabadsagTavolletiDij = 0;

      // Szabadságos napok feldolgozása
      Object.entries(monthData).forEach(([day, shiftValue]) => {
        if (!shiftValue || shiftValue === " ") return;

        if (shiftValue.includes("Szabadság")) {
          let orak = 12;
          if (shiftValue.includes("8 óra")) orak = 8;
          if (shiftValue.includes("4 óra")) orak = 4;

          // SZABADSÁGNÁL: teljes pótlék (100%)
          szabadsagTavolletiDij += (atlagEjszakaiPotlek + atlagVasarnapiPotlek) * orak;
        }
      });

      return Math.round(szabadsagTavolletiDij);
    } catch (error) {
      console.error("Hiba a szabadság távolléti díj számításában:", error);
      return 0;
    }
  }

  // 5. ÁTLAGOS PÓTLÉKOK SZÁMÍTÁSA (segéd függvény)
  // Visszatér: Ft/óra értékekkel (atlagEjszakaiPotlek, atlagVasarnapiPotlek)
  calculateAveragePotlekok(monthIndex, year, besorolas) {
    let osszesEjszakaiPotlek = 0;
    let osszesVasarnapiPotlek = 0;
    let osszesLedolgozottOra = 0;

    // Előző 6 hónap vizsgálata
    for (let i = 1; i <= 6; i++) {
      let vizsgaltHonap = monthIndex - i;
      let vizsgaltEv = year;

      if (vizsgaltHonap < 0) {
        vizsgaltHonap += 12;
        vizsgaltEv--;
      }

      if (
        !this.app.yearlyData[vizsgaltEv] ||
        !this.app.yearlyData[vizsgaltEv].calendar_data
      ) {
        continue;
      }

      const honapiAdat = this.app.yearlyData[vizsgaltEv].calendar_data[vizsgaltHonap] || {};
      // Az adott hónap érvényes besorolási bére
      const honapiBesorolas = this.getEffectiveSalary(vizsgaltEv, vizsgaltHonap);
      // Napi TD alap az adott hónapban: besorolas / 22
      const napiAlapber = honapiBesorolas / 22;

      Object.entries(honapiAdat).forEach(([nap, shiftValue]) => {
        if (!shiftValue || shiftValue === " ") return;

        let orak = 12;
        if (shiftValue.includes("8 óra")) orak = 8;
        if (shiftValue.includes("4 óra")) orak = 4;

        // Csak a ténylegesen ledolgozott műszakok számítanak
        if (shiftValue.includes("Nappal") || shiftValue.includes("Éjszaka")) {
          osszesLedolgozottOra += orak;

          // Éjszakai pótlék: besorolas / 174 * óra * 40%
          if (shiftValue.includes("Éjszaka")) {
            osszesEjszakaiPotlek += (honapiBesorolas / 174) * orak * 0.4;
          }

          // Vasárnapi pótlék: besorolas / 174 * óra * 50%
          const date = new Date(vizsgaltEv, vizsgaltHonap, parseInt(nap));
          if (date.getDay() === 0) {
            osszesVasarnapiPotlek += (honapiBesorolas / 174) * orak * 0.5;
          }
        }
      });
    }

    // Átlagos pótlékok Ft/óra értékben
    const atlagEjszakaiPotlek = osszesLedolgozottOra > 0 ? osszesEjszakaiPotlek / osszesLedolgozottOra : 0;
    const atlagVasarnapiPotlek = osszesLedolgozottOra > 0 ? osszesVasarnapiPotlek / osszesLedolgozottOra : 0;

    return {atlagEjszakaiPotlek, atlagVasarnapiPotlek};
  }

  // 6. TÁPPÉNZ IDŐSZAKOK MEGHATÁROZÁSA (segéd függvény)
  getTappenzPeriods(tappenzNapok, monthData) {
    let tappenzIdoszakok = [];
    let jelenlegiIdoszak = [];

    for (let i = 0; i < tappenzNapok.length; i++) {
      const jelenlegiNap = tappenzNapok[i];
      const shiftValue = monthData[jelenlegiNap.nap] || "";

      if (jelenlegiIdoszak.length === 0) {
        // Első táppénzes nap — új időszak kezdete
        jelenlegiIdoszak.push(jelenlegiNap);
      } else {
        const elozoNap = jelenlegiIdoszak[jelenlegiIdoszak.length - 1];
        const elozoShift = monthData[elozoNap.nap] || "";

        // Ha az előző nap "Táppénz vége" volt → új időszak
        // Ha a jelenlegi nap "Táppénz kezdete" → új időszak
        if (elozoShift.includes("Táppénz vége") || shiftValue.includes("Táppénz kezdete")) {
          tappenzIdoszakok.push([...jelenlegiIdoszak]);
          jelenlegiIdoszak = [jelenlegiNap];
        } else {
          const folyamatos = this.isTappenzContinuous(elozoNap.nap, jelenlegiNap.nap, monthData);
          if (folyamatos) {
            jelenlegiIdoszak.push(jelenlegiNap);
          } else {
            tappenzIdoszakok.push([...jelenlegiIdoszak]);
            jelenlegiIdoszak = [jelenlegiNap];
          }
        }
      }

      // Ha ez a nap "Táppénz vége", lezárjuk az időszakot
      if (shiftValue.includes("Táppénz vége")) {
        tappenzIdoszakok.push([...jelenlegiIdoszak]);
        jelenlegiIdoszak = [];
      }
    }

    // Utolsó időszak lezárása
    if (jelenlegiIdoszak.length > 0) {
      tappenzIdoszakok.push(jelenlegiIdoszak);
    }

    return tappenzIdoszakok;
  }

  // 7. TÁPPÉNZ FOLYAMATOSSÁG ELLENŐRZÉSE (segéd függvény)
  isTappenzContinuous(elozoNap, jelenlegiNap, monthData) {
    // Ha közvetlenül egymás után vannak (max 1 nap különbség)
    if (jelenlegiNap - elozoNap <= 1) {
      return true;
    }

    // Ellenőrizzük a köztes napokat
    for (let kozesNap = elozoNap + 1; kozesNap < jelenlegiNap; kozesNap++) {
      const kozesShift = monthData[kozesNap];

      // Megszakítás: ha van munkavégzés közben
      if (kozesShift && kozesShift !== " " && !kozesShift.includes("Táppénz")) {
        return false;
      }
    }

    // Ha 7+ nap szünet van táppénz nélkül, azt is megszakításnak tekintjük
    if (jelenlegiNap - elozoNap > 7) {
      return false;
    }

    return true;
  }

  // 8. EREDETI MŰSZAK LEKÉRÉSE (már létező függvény)
  getOriginalShiftForDay(year, month, day) {
    const savedYear = this.app.currentYear;
    const savedMonth = this.app.currentMonth;
    try {
      this.app.currentYear = year;
      this.app.currentMonth = month;
      const originalShift = this.app.generateShiftPattern(day);
      return originalShift;
    } catch (error) {
      console.error("Hiba az eredeti műszak lekérésénél:", error);
      return " ";
    } finally {
      // Mindig visszaállítjuk, hiba esetén is
      this.app.currentYear = savedYear;
      this.app.currentMonth = savedMonth;
    }
  }
}

const SHIFT_START_DATE = new Date(Date.UTC(2024, 0, 1));

// Általános segédfüggvény a napok közötti különbség számolásához
function getDaysBetween(startDate, endDate) {
  try {
    // Mindkét dátumot UTC-ben kezeljük és az időt 00:00:00-ra állítjuk
    const start = new Date(
      Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      )
    );
    const end = new Date(
      Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
    );

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((end - start) / millisecondsPerDay);
  } catch (error) {
    console.error("Hiba a napok közötti különbség számításánál:", error);
    return 0;
  }
}
class EventHandlers {
  constructor(app) {
    this.app = app;
    // Év váltás eseménykezelők
    this.initYearChangeHandlers();
    // Beállítások eseménykezelők
    this.initSettingsHandlers();
    // Színbeállítások eseménykezelők
    this.initColorHandlers();
  }

  initYearChangeHandlers() {
    // Naptár év váltás
    document.getElementById("prev-month-btn")?.addEventListener("click", () => {
      this.app.changeYear(-1, "calendar");
    });

    document.getElementById("next-month-btn")?.addEventListener("click", () => {
      this.app.changeYear(1, "calendar");
    });

    // Bérszámfejtés év váltás
    document
      .getElementById("prev-payroll-month-btn")
      ?.addEventListener("click", () => {
        this.app.changeYear(-1, "payroll");
      });

    document
      .getElementById("next-payroll-month-btn")
      ?.addEventListener("click", () => {
        this.app.changeYear(1, "payroll");
      });

    // Beállítások év váltás
    document
      .getElementById("prev-settings-year-btn")
      ?.addEventListener("click", () => {
        this.app.changeYear(-1, "settings");
      });

    document
      .getElementById("next-settings-year-btn")
      ?.addEventListener("click", () => {
        this.app.changeYear(1, "settings");
      });
  }

  initSettingsHandlers() {
    // Under 25 checkbox kezelése
    const under25Checkbox = document.getElementById("under25-checkbox");
    const birthDateContainer = document.getElementById("birth-date-container");

    under25Checkbox?.addEventListener("change", (e) => {
      if (birthDateContainer) {
        birthDateContainer.style.display = e.target.checked ? "block" : "none";
        this.app.yearlyData[
          this.app.currentSettingsYear
        ].settings.under25.enabled = e.target.checked;
      }
    });

    // Évközi változás hozzáadása
    document
      .getElementById("add-midyear-change")
      ?.addEventListener("click", () => {
        const monthSelect = document.getElementById("midyear-month");
        const salaryInput = document.getElementById("midyear-salary");

        if (!monthSelect?.value || !salaryInput?.value) {
          alert("Kérlek válassz hónapot és adj meg új besorolási bért!");
          return;
        }

        this.app.addMidyearChange(monthSelect.value, salaryInput.value);

        // Mezők törlése
        monthSelect.value = "";
        salaryInput.value = "";
      });

    // Beállítások mentése
    document.getElementById("save-settings")?.addEventListener("click", () => {
      try {
        this.app.saveSettings();
        showSuccessMessage("Sikeres mentés");
      } catch (error) {
        alert("Hiba történt a beállítások mentése során!");
        console.error(error);
      }
    });
  }

  initColorHandlers() {
    const colorPickers = document.querySelectorAll(".color-picker");
    colorPickers.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const input = document.createElement("input");
        input.type = "color";
        const shiftType = button.getAttribute("data-shift-type");
        const colorType = button.getAttribute("data-color-type");
        if (shiftType && colorType) {
          this.handleColorPicker(input, shiftType, colorType);
        }
      });
    });
  }

  handleColorPicker(input, shiftType, colorType) {
    const key = this.findShiftColorKey(shiftType);
    if (!key) return;

    input.value =
      colorType === "bg" ? SHIFT_COLORS[key][0] : SHIFT_COLORS[key][1];

    input.addEventListener("input", (event) => {
      if (colorType === "bg") {
        SHIFT_COLORS[key][0] = event.target.value;
      } else {
        SHIFT_COLORS[key][1] = event.target.value;
      }

      this.app.updateColorPreviews();
      this.app.generateCalendar();
      this.app.saveColorSettings();
    });

    input.click();
  }

  findShiftColorKey(shiftType) {
    return Object.keys(SHIFT_COLORS).find(
      (key) =>
        key
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") ===
        shiftType
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
    );
  }
}

class ErrorHandler {
  static handle(error, context) {
    console.error(`Hiba a következő művelet során: ${context}`, error);

    let userMessage;
    switch (context) {
      case "saveSettings":
        userMessage =
          "Nem sikerült menteni a beállításokat. Kérlek próbáld újra!";
        break;
      case "loadSettings":
        userMessage =
          "Nem sikerült betölteni a beállításokat. Alapértelmezett értékek kerülnek használatra.";
        break;
      case "calculateSalary":
        userMessage =
          "Hiba történt a bérszámítás során. Kérlek ellenőrizd a megadott adatokat!";
        break;
      default:
        userMessage = "Váratlan hiba történt. Kérlek próbáld újra!";
    }

    alert(userMessage);
    return null;
  }

  static validateInput(value, type) {
    switch (type) {
      case "salary":
        return !isNaN(value) && value >= 0;
      case "year":
        return !isNaN(value) && value >= 2024 && value <= 2028;
      case "month":
        return !isNaN(value) && value >= 0 && value <= 11;
      default:
        return true;
    }
  }
}

// ____________________________________APPLIKÁCIÓ__________________________________________________

class BerszamfejtoApp {
  constructor() {
    try {
      // Alapvető dátumok inicializálása
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();

      this.currentYear =
        currentYear >= 2024 && currentYear <= 2028 ? currentYear : 2024;
      this.currentMonth = currentDate.getMonth();
      this.currentPayrollYear = this.currentYear;
      this.currentPayrollMonth = this.currentMonth;
      this.currentSettingsYear = this.currentYear;
      this.calculator = new BerszamfejtoCalculator(this);
      this.changelog = new ChangelogManager();
      // Changelog megjelenítése, ha szükséges - ÚJ!
      setTimeout(() => {
        this.changelog.showChangelog();
      }, 100);

      // Adatstruktúrák inicializálása
      this.initializeYearlyData();
      // Betöltjük a mentett adatokat
      this.loadYearlyData();
      // További inicializálások
      document.getElementById("current-settings-year").textContent =
      this.currentSettingsYear;
      loadTheme();
      this.loadColorSettings();
      this.initNavigation();
      this.initEventListeners();
      this.initSettingsNavigation();
      this.initTouchNavigation();
      this.initSettings();
      this.salaryVisibility = initSalaryVisibility();
      this.generateCalendar();
      this.initPayrollNavigation();
      this.generatePayrollTable();
      document.addEventListener(
        "contextmenu",
        function (e) {
          if (e.target.closest("#navbar")) {
            e.preventDefault();
          }
        },
        false
      );

      document.addEventListener(
        "contextmenu",
        function (e) {
          const navButtons = [
            document.getElementById("prev-month-btn"),
            document.getElementById("next-month-btn"),
            document.getElementById("prev-payroll-month-btn"),
            document.getElementById("next-payroll-month-btn"),
            document.getElementById("prev-settings-year-btn"),
            document.getElementById("next-settings-year-btn"),
          ];

          if (
            navButtons.some((button) => button && button.contains(e.target))
          ) {
            e.preventDefault();
          }
        },
        false
      ); // Touch és Click események kombinált kezelése

      const navButtons = document.querySelectorAll("#navbar button");
      navButtons.forEach((button) => {
        const handleNavigation = () => {
          const sectionId = button.id.replace("-btn", "-section");
          this.showSection(sectionId);
          navButtons.forEach((btn) => btn.classList.remove("active"));
          button.classList.add("active");
        };

        // Click esemény kezelése
        button.addEventListener("click", handleNavigation);

        // Touch események kezelése
        button.addEventListener(
          "touchstart",
          function (e) {
            e.preventDefault();
          },
          { passive: false }
        );

        button.addEventListener(
          "touchend",
          function (e) {
            e.preventDefault();
            handleNavigation();
          },
          { passive: false }
        );
      });

      // Alapértelmezett aktív állapot
      navButtons[0].classList.add("active");
    } catch (error) {
      console.error("Hiba az alkalmazás inicializálása során:", error);
      console.error("Hiba részletei:", error.message);
      console.error("Hiba stack:", error.stack);
    }
  }

  // Changelog kézi megjelenítése (fejlesztéshez)
  showChangelog() {
    this.changelog.forceShow();
  }

  // Verzió reset (teszteléshez)
  resetChangelog() {
    this.changelog.resetVersion();
  }

  initializeYearlyData() {
    this.yearlyData = {};
    // Inicializáljuk az összes évet
    for (let year = 2024; year <= 2028; year++) {
      this.yearlyData[year] = {
        settings: {
          besorolasi_ber: "300000",
          szabadsag: "25",
          muszakrend: "-",
          other_income: "0",
          children_count: "0",
          under25: {
            enabled: false,
            birthYear: "",
            birthMonth: "",
          },
          midyear_changes: [],
          midyear_shift_changes: [],
        },
        calendar_data: {},
        bonusEntries: {},
        restaurantEntries: {},
        egyebJovedelmEntries: {},
        notes: {},
      };

      // Inicializáljuk a hónapokat és generáljuk a műszakrendet
      for (let month = 0; month < 12; month++) {
        if (!this.yearlyData[year].calendar_data[month]) {
          this.yearlyData[year].calendar_data[month] = {};
        }

        // Műszakrend generálása minden napra
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const currentYear = this.currentYear; // Mentjük az eredeti értéket
          const currentMonth = this.currentMonth;

          // Beállítjuk ideiglenesen a generáláshoz szükséges értékeket
          this.currentYear = year;
          this.currentMonth = month;

          const shiftValue = this.generateShiftPattern(day);
          if (shiftValue !== " ") {
            this.yearlyData[year].calendar_data[month][day] = shiftValue;
          }

          // Visszaállítjuk az eredeti értékeket
          this.currentYear = currentYear;
          this.currentMonth = currentMonth;
        }

        // Alapértelmezett bónusz értékek beállítása (2)
        if (!this.yearlyData[year].bonusEntries[month]) {
          this.yearlyData[year].bonusEntries[month] = 2;
        }
      }
    }
  }

  saveYearlyData() {
    try {
      // Mentés előtt kitisztítjuk az undefined értékeket
      const yearData = JSON.parse(JSON.stringify(this.yearlyData));
      Object.keys(yearData).forEach((year) => {
        if (yearData[year].calendar_data) {
          Object.keys(yearData[year].calendar_data).forEach((month) => {
            Object.keys(yearData[year].calendar_data[month]).forEach((day) => {
              if (yearData[year].calendar_data[month][day] === undefined) {
                yearData[year].calendar_data[month][day] = " ";
              }
            });
          });
        }
      });

      localStorage.setItem("berszamfejtoYearlyData", JSON.stringify(yearData));
    } catch (error) {
      console.error("Hiba az adatok mentése során:", error);
    }
  }

  loadYearlyData() {
    try {
      const savedData = localStorage.getItem("berszamfejtoYearlyData");
      if (savedData) {
        const parsedData = JSON.parse(savedData);

        // Összes év végigiterálása
        for (let year = 2024; year <= 2028; year++) {
          if (parsedData[year]) {
            // Settings másolása
            this.yearlyData[year].settings =
              parsedData[year].settings || this.yearlyData[year].settings;

            // Calendar data ellenőrzése és generálása ha szükséges
            for (let month = 0; month < 12; month++) {
              // Ha nincs adat az adott hónapra, generáljuk
              if (
                !parsedData[year].calendar_data?.[month] ||
                Object.keys(parsedData[year].calendar_data[month]).length === 0
              ) {
                if (!this.yearlyData[year].calendar_data[month]) {
                  this.yearlyData[year].calendar_data[month] = {};
                }

                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                  const currentYear = this.currentYear;
                  const currentMonth = this.currentMonth;

                  this.currentYear = year;
                  this.currentMonth = month;

                  const shiftValue = this.generateShiftPattern(day);
                  if (shiftValue !== " ") {
                    this.yearlyData[year].calendar_data[month][day] =
                      shiftValue;
                  }

                  this.currentYear = currentYear;
                  this.currentMonth = currentMonth;
                }
              } else {
                // Ha van mentett adat, azt használjuk
                this.yearlyData[year].calendar_data[month] = {
                  ...parsedData[year].calendar_data[month],
                };
              }
            }

            // Bónuszok és éttermi fogyasztás másolása
            this.yearlyData[year].bonusEntries = {
              ...parsedData[year].bonusEntries,
            };
            this.yearlyData[year].restaurantEntries = {
              ...parsedData[year].restaurantEntries,
            };
            this.yearlyData[year].egyebJovedelmEntries = {
              ...parsedData[year].egyebJovedelmEntries,
            };
            // Megjegyzések másolása - ÚJ
            this.yearlyData[year].notes =
              {
                ...parsedData[year].notes,
              } || {};
          }
        }

        // Mentjük az esetleges új generált adatokat
        this.saveYearlyData();
      }
    } catch (error) {
      console.error("Hiba a mentett adatok betöltése során:", error);
      console.error("Hiba részletei:", error.stack);
    }
  }

  addMidyearChange(month, salary) {
    try {
      // Ellenőrizzük, hogy van-e már ilyen hónapra változás
      if (!this.yearlyData[this.currentSettingsYear].settings.midyear_changes) {
        this.yearlyData[this.currentSettingsYear].settings.midyear_changes = [];
      }

      // Ellenőrizzük, hogy van-e már változás erre a hónapra
      const existingChangeIndex = this.yearlyData[
        this.currentSettingsYear
      ].settings.midyear_changes.findIndex(
        (change) => change.month === parseInt(month)
      );

      const change = {
        month: parseInt(month),
        salary: salary,
        id: Date.now(),
      };

      if (existingChangeIndex !== -1) {
        // Ha már van változás erre a hónapra, frissítjük
        this.yearlyData[this.currentSettingsYear].settings.midyear_changes[
          existingChangeIndex
        ] = change;
      } else {
        // Ha nincs még változás erre a hónapra, hozzáadjuk
        this.yearlyData[this.currentSettingsYear].settings.midyear_changes.push(
          change
        );
      }

      this.displayMidyearChanges();
      this.saveYearlyData();

      // Frissítjük a bérszámfejtési táblázatot is
      this.generatePayrollTable();
    } catch (error) {
      console.error("Hiba az évközi változás hozzáadása során:", error);
      alert("Hiba történt az évközi változás hozzáadása során!");
    }
  }

  // Évközi változások megjelenítése
  // A BerszamfejtoApp osztályban módosítsuk ezt a függvényt:
  removeMidyearChange(id) {
    try {
      // Ellenőrizzük, hogy létezik-e az év és a midyear_changes tömb
      if (
        !this.yearlyData[this.currentSettingsYear] ||
        !this.yearlyData[this.currentSettingsYear].settings ||
        !this.yearlyData[this.currentSettingsYear].settings.midyear_changes
      ) {
        console.error("Hiányzó adatstruktúra az évközi változások kezeléséhez");
        return;
      }

      // Töröljük a változást a tömbből
      this.yearlyData[this.currentSettingsYear].settings.midyear_changes =
        this.yearlyData[
          this.currentSettingsYear
        ].settings.midyear_changes.filter((change) => change.id !== id);

      // Frissítjük a megjelenítést és mentjük az adatokat
      this.displayMidyearChanges();
      this.saveYearlyData();
      // Frissítjük a bérszámfejtési táblázatot is
      this.generatePayrollTable();
    } catch (error) {
      console.error("Hiba az évközi változás törlése során:", error);
      alert("Hiba történt a változás törlése során!");
    }
  }

  displayMidyearChanges() {
    try {
      const container = document.getElementById("midyear-changes-list");
      if (!container) return;

      container.innerHTML = "";

      if (!this.yearlyData[this.currentSettingsYear]) {
        this.yearlyData[this.currentSettingsYear] = {
          settings: {
            besorolasi_ber: "300000",
            szabadsag: "25",
            muszakrend: "-",
            other_income: "0",
            under25: {
              enabled: false,
              birthYear: "",
              birthMonth: "",
            },
            midyear_changes: [],
          },
          calendar_data: {},
          bonusEntries: {},
          restaurantEntries: {},
        egyebJovedelmEntries: {},
        };
      }

      const changes =
        this.yearlyData[this.currentSettingsYear].settings.midyear_changes;
      const months = [
        "JANUÁR",
        "FEBRUÁR",
        "MÁRCIUS",
        "ÁPRILIS",
        "MÁJUS",
        "JÚNIUS",
        "JÚLIUS",
        "AUGUSZTUS",
        "SZEPTEMBER",
        "OKTÓBER",
        "NOVEMBER",
        "DECEMBER",
      ];

      changes.forEach((change) => {
        const div = document.createElement("div");
        div.className = "midyear-change-item";

        div.innerHTML = `
                    <span>${months[change.month]}: ${parseInt(
          change.salary
        ).toLocaleString("hu-HU")} Ft</span>
                    <button 
                        data-change-id="${change.id}"
                        class="remove-midyear-change"
                        style="background: none; border: none; color: red; cursor: pointer;"
                    >
                        Törlés
                    </button>
                `;
        container.appendChild(div);
      });

      // Eseménykezelő hozzáadása a dinamikusan létrehozott gombokhoz
      container.addEventListener("click", (event) => {
        const removeButton = event.target.closest(".remove-midyear-change");
        if (removeButton) {
          const changeId = parseInt(
            removeButton.getAttribute("data-change-id")
          );

          // Biztonságos hívás, ha az app objektum létezik
          if (
            window.app &&
            typeof window.app.removeMidyearChange === "function"
          ) {
            window.app.removeMidyearChange(changeId);
          } else {
            console.error("Az app objektum nem elérhető a törlésnél");
          }
        }
      });
    } catch (error) {
      console.error("Hiba az évközi változások megjelenítése során:", error);
    }
  }

  // Export funkció - minden adat mentése fájlba
  exportAllData() {
    try {
      // Összes mentett adat összegyűjtése
      const exportData = {
        version: "3.0.0",
        exportDate: new Date().toISOString(),
        yearlyData: this.yearlyData,
        shiftColors: JSON.parse(localStorage.getItem("shiftColors") || "{}"),
        theme: localStorage.getItem("theme") || "light",
        installPromptShown: localStorage.getItem("installPromptShown") || "false",
        lastSeenChangelog: localStorage.getItem("lastSeenChangelog") || ""
      };

      // JSON fájl létrehozása
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Fájl letöltése
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `muszaknaptar_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('📁 Adatok sikeresen exportálva!\n\nA fájl letöltődött. Őrizd meg biztonságos helyen!');
    } catch (error) {
      console.error('Hiba az export során:', error);
      alert('❌ Hiba történt az adatok exportálása során!');
    }
  }

  // Verzió migráció funkció
  migrateImportedData(importData) {
    try {
      console.log(`Migráció: ${importData.version || 'ismeretlen'} → 3.0.0`);
      
      // Alapvető struktúra biztosítása
      if (!importData.yearlyData) {
        importData.yearlyData = {};
      }
      
      // Évek 2024-2028 között biztosítása
      for (let year = 2024; year <= 2028; year++) {
        if (!importData.yearlyData[year]) {
          importData.yearlyData[year] = {
            settings: {
              besorolasi_ber: "300000",
              szabadsag: "25", 
              muszakrend: "-",
              other_income: "0",
              children_count: "0",
              under25: { enabled: false, birthYear: "", birthMonth: "" },
              midyear_changes: []
            },
            calendar_data: {},
            bonusEntries: {},
            restaurantEntries: {},
        egyebJovedelmEntries: {},
            notes: {}
          };
        } else {
          // Meglévő év adatainak kiegészítése
          const yearData = importData.yearlyData[year];
          
          // Settings kiegészítése hiányzó mezőkkel
          if (!yearData.settings) yearData.settings = {};
          if (!yearData.settings.besorolasi_ber) yearData.settings.besorolasi_ber = "300000";
          if (!yearData.settings.szabadsag) yearData.settings.szabadsag = "25";
          if (!yearData.settings.muszakrend) yearData.settings.muszakrend = "-";
          if (!yearData.settings.other_income) yearData.settings.other_income = "0";
          if (!yearData.settings.children_count) yearData.settings.children_count = "0";
          if (!yearData.settings.under25) {
            yearData.settings.under25 = { enabled: false, birthYear: "", birthMonth: "" };
          }
          if (!yearData.settings.midyear_changes) yearData.settings.midyear_changes = [];
          
          // Egyéb adatok biztosítása
          if (!yearData.calendar_data) yearData.calendar_data = {};
          if (!yearData.bonusEntries) yearData.bonusEntries = {};
          if (!yearData.restaurantEntries) yearData.restaurantEntries = {};
          if (!yearData.egyebJovedelmEntries) yearData.egyebJovedelmEntries = {};
          if (!yearData.notes) yearData.notes = {};
          
          // Bónusz értékek alapértelmezése
          for (let month = 0; month < 12; month++) {
            if (yearData.bonusEntries[month] === undefined) {
              yearData.bonusEntries[month] = 2;
            }
            if (yearData.restaurantEntries[month] === undefined) {
              yearData.restaurantEntries[month] = 0;
            }
            if (yearData.egyebJovedelmEntries[month] === undefined) {
              yearData.egyebJovedelmEntries[month] = 0;
            }
          }
        }
      }
      
      console.log('✅ Migráció sikeres');
      return importData;
      
    } catch (error) {
      console.error('❌ Migráció hiba:', error);
      throw new Error('Az adatok migrációja sikertelen');
    }
  }

  // Import funkció - adatok visszatöltése fájlból
  importAllData() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            let importData = JSON.parse(e.target.result);
            
            // Alapvető validálás
            if (!importData.yearlyData && !importData.calendar_data) {
              throw new Error('Érvénytelen backup fájl - nincs műszakadat!');
            }
            
            // Régi formátum konvertálása
            if (importData.calendar_data && !importData.yearlyData) {
              console.log('Régi formátum konvertálása...');
              importData = {
                version: "2.0.0",
                yearlyData: {
                  [this.currentYear]: {
                    settings: importData.settings || {},
                    calendar_data: importData.calendar_data || {},
                    bonusEntries: importData.bonusEntries || {},
                    restaurantEntries: importData.restaurantEntries || {},
                    egyebJovedelmEntries: importData.egyebJovedelmEntries || {},
                    notes: importData.notes || {}
                  }
                },
                shiftColors: importData.shiftColors || {},
                theme: importData.theme || "light"
              };
            }
            
            // Migráció végrehajtása
            importData = this.migrateImportedData(importData);
            
            // Felhasználói megerősítés
            const sourceVersion = importData.version || 'ismeretlen verzió';
            if (!confirm(`🔄 Adatok importálása\n\nForrás: ${sourceVersion}\nCél: 3.0.0\n\n⚠️ Ez felülírja a jelenlegi adatokat!\n\nFolytatod az importálást?`)) {
              return;
            }
            
            // Adatok visszaállítása
            this.yearlyData = importData.yearlyData;
            this.saveYearlyData();
            
            // Egyéb beállítások visszaállítása
            if (importData.shiftColors) {
              localStorage.setItem('shiftColors', JSON.stringify(importData.shiftColors));
              this.loadColorSettings();
            }
            
            if (importData.theme) {
              localStorage.setItem('theme', importData.theme);
              document.body.setAttribute('data-theme', importData.theme);
              const themeCheckbox = document.getElementById('theme-checkbox');
              if (themeCheckbox) themeCheckbox.checked = importData.theme === 'dark';
            }
            
            if (importData.installPromptShown) {
              localStorage.setItem('installPromptShown', importData.installPromptShown);
            }
            
            if (importData.lastSeenChangelog) {
              localStorage.setItem('lastSeenChangelog', importData.lastSeenChangelog);
            }
            
            // UI frissítése
            this.loadYearSettings(this.currentSettingsYear);
            this.generateCalendar();
            this.generatePayrollTable();
            this.updateColorPreviews();
            
            alert(`✅ Import sikeres!\n\n📊 Betöltve: ${Object.keys(this.yearlyData).length} év adata\n🔄 Migráció: ${sourceVersion} → 3.0.0\n\n🎉 Minden műszak és beállítás visszaállítva!`);
            
          } catch (error) {
            console.error('Import hiba:', error);
            alert(`❌ Import sikertelen!\n\nHiba: ${error.message}\n\n💡 Tipp: Ellenőrizd, hogy érvényes backup fájlt választottál-e.`);
          }
        };
        
        reader.readAsText(file);
      };
      
      input.click();
    } catch (error) {
      console.error('Hiba az import során:', error);
      alert('❌ Hiba történt a fájl választása során!');
    }
  }

  // Évközi műszakváltás hozzáadása (egyszerűsített)
    // Évközi műszakváltás törlése (egyszerűsített)
  addMidyearShiftChange(month, day, newShiftPattern) {
    try {
      // Ellenőrizzük, hogy van-e már ilyen dátumra változás
      if (!this.yearlyData[this.currentSettingsYear].settings.midyear_shift_changes) {
        this.yearlyData[this.currentSettingsYear].settings.midyear_shift_changes = [];
      }

      // Dátum validálás
      const selectedDate = new Date(this.currentSettingsYear, parseInt(month), parseInt(day));
      const daysInMonth = new Date(this.currentSettingsYear, parseInt(month) + 1, 0).getDate();
      
      if (parseInt(day) < 1 || parseInt(day) > daysInMonth) {
        alert(`❌ Érvénytelen nap! A(z) ${parseInt(month) + 1}. hónapban csak 1-${daysInMonth} napok léteznek.`);
        return;
      }

      // Ellenőrizzük, hogy van-e már változás erre a dátumra
      const existingChangeIndex = this.yearlyData[
        this.currentSettingsYear
      ].settings.midyear_shift_changes.findIndex(
        (change) => change.month === parseInt(month) && change.day === parseInt(day)
      );

      const change = {
        month: parseInt(month),
        day: parseInt(day),
        shiftPattern: newShiftPattern,
        id: Date.now(),
        dateString: selectedDate.toLocaleDateString('hu-HU')
      };

      if (existingChangeIndex !== -1) {
        // Ha már van változás erre a dátumra, frissítjük
        this.yearlyData[this.currentSettingsYear].settings.midyear_shift_changes[
          existingChangeIndex
        ] = change;
        // ❌ ELTÁVOLÍTVA: alert('✅ Műszakváltás frissítve!');
      } else {
        // Ha nincs még változás erre a dátumra, hozzáadjuk
        this.yearlyData[this.currentSettingsYear].settings.midyear_shift_changes.push(
          change
        );
        // ❌ ELTÁVOLÍTVA: alert('✅ Műszakváltás hozzáadva!');
      }

      // Rendezzük dátum szerint növekvő sorrendbe
      this.yearlyData[this.currentSettingsYear].settings.midyear_shift_changes.sort(
        (a, b) => {
          if (a.month !== b.month) return a.month - b.month;
          return a.day - b.day;
        }
      );

      // AUTOMATIKUS: Törölünk és újragenerálunk a váltás dátumától
      this.clearAndRegenerateFromDate(parseInt(month), parseInt(day));
      
      this.displayMidyearShiftChanges();
      this.saveYearlyData();
      this.generatePayrollTable();
      
      // ✅ EGYSZERŰ ÜZENET: Csak egy rövid tájékoztatás
      console.log(`✅ Műszakváltás beállítva: ${selectedDate.toLocaleDateString('hu-HU')} → ${newShiftPattern}`);
      
    } catch (error) {
      console.error("Hiba az évközi műszakváltás hozzáadása során:", error);
      alert("Hiba történt az évközi műszakváltás hozzáadása során!");
    }
  }

  // EGYSZERŰSÍTETT: Törlés és újragenerálás egy adott dátumtól
  clearAndRegenerateFromDate(fromMonth, fromDay) {
    try {
      const year = this.currentSettingsYear;
      
      console.log(`🔄 Naptár törlése és újragenerálása: ${year}.${fromMonth + 1}.${fromDay}-től`);
      
      // Végigmegyünk az évben a megadott dátumtól kezdve és MINDENT TÖRLÜNK
      for (let month = fromMonth; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Az első hónapban csak a megadott naptól kezdjük
        const startDay = (month === fromMonth) ? fromDay : 1;
        
        if (!this.yearlyData[year].calendar_data[month]) {
          this.yearlyData[year].calendar_data[month] = {};
        }
        
        // TÖRLÉS: Minden nap törlése a váltás dátumától
        for (let day = startDay; day <= daysInMonth; day++) {
          delete this.yearlyData[year].calendar_data[month][day];
        }
        
        // ÚJRAGENERÁLÁS: Friss műszakrend szerint
        for (let day = startDay; day <= daysInMonth; day++) {
          // Meghatározzuk az érvényes műszakrendet erre a dátumra
          const effectiveShiftPattern = this.getEffectiveShiftPattern(year, month, day);
          
          const previousYear = this.currentYear;
          const previousMonth = this.currentMonth;
          
          // Beállítjuk ideiglenesen a generáláshoz szükséges értékeket
          this.currentYear = year;
          this.currentMonth = month;
          
          // Átmenetileg beállítjuk a műszakrendet
          const originalPattern = this.yearlyData[year].settings.muszakrend;
          this.yearlyData[year].settings.muszakrend = effectiveShiftPattern;
          
          const shiftValue = this.generateShiftPattern(day);
          
          // Visszaállítjuk az eredeti értékeket
          this.yearlyData[year].settings.muszakrend = originalPattern;
          this.currentYear = previousYear;
          this.currentMonth = previousMonth;
          
          if (shiftValue !== " ") {
            this.yearlyData[year].calendar_data[month][day] = shiftValue;
          }
        }
      }
      
      // Ha az aktuálisan megjelenített naptár érintett, frissítjük
      if (this.currentYear === year) {
        this.generateCalendar();
      }
      
      console.log('✅ Naptár újragenerálás kész');
      
    } catch (error) {
      console.error("Hiba a naptár újragenerálása során:", error);
    }
  }

  // 2. MÓDOSÍTOTT removeMidyearShiftChange - automatikus törlés
  removeMidyearShiftChange(id) {
    try {
      if (
        !this.yearlyData[this.currentSettingsYear] ||
        !this.yearlyData[this.currentSettingsYear].settings ||
        !this.yearlyData[this.currentSettingsYear].settings.midyear_shift_changes
      ) {
        console.error("Hiányzó adatstruktúra az évközi műszakváltások kezeléséhez");
        return;
      }

      // Keressük meg a törlendő változást a dátum meghatározásához
      const changeToRemove = this.yearlyData[
        this.currentSettingsYear
      ].settings.midyear_shift_changes.find(change => change.id === id);

      // Töröljük a változást a tömbből
      this.yearlyData[this.currentSettingsYear].settings.midyear_shift_changes =
        this.yearlyData[
          this.currentSettingsYear
        ].settings.midyear_shift_changes.filter((change) => change.id !== id);

      // Ha volt változás, újrageneráljuk a naptárat a törlés dátumától
      if (changeToRemove) {
        this.clearAndRegenerateFromDate(changeToRemove.month, changeToRemove.day);
        console.log(`✅ Műszakváltás törölve: ${changeToRemove.dateString}`);
      }

      // Frissítjük a megjelenítést és mentjük az adatokat
      this.displayMidyearShiftChanges();
      this.saveYearlyData();
      this.generatePayrollTable();
      
      // ❌ ELTÁVOLÍTVA: alert('✅ Műszakváltás törölve és naptár újragenerálva!');
      
    } catch (error) {
      console.error("Hiba az évközi műszakváltás törlése során:", error);
      alert("Hiba történt a műszakváltás törlése során!");
    }
  }

  // 3. MÓDOSÍTOTT displayMidyearShiftChanges - törlés gomb automatikus
  displayMidyearShiftChanges() {
    try {
      const container = document.getElementById("midyear-shift-changes-list");
      if (!container) return;

      container.innerHTML = "";

      if (!this.yearlyData[this.currentSettingsYear]) {
        return;
      }

      const changes =
        this.yearlyData[this.currentSettingsYear].settings.midyear_shift_changes || [];
      
      const shiftPatternNames = {
        "-": "Üres naptár",
        "1": "1. Műszakrend",
        "2": "2. Műszakrend", 
        "3": "3. Műszakrend",
        "4": "4. Műszakrend",
        "A": "A Műszakrend",
        "B": "B Műszakrend",
        "C": "C Műszakrend"
      };

      changes.forEach((change) => {
        const div = document.createElement("div");
        div.className = "midyear-change-item";

        div.innerHTML = `
          <span>${change.dateString}: ${shiftPatternNames[change.shiftPattern] || change.shiftPattern}</span>
          <button 
            data-change-id="${change.id}"
            class="remove-midyear-shift-change"
            style="background: none; border: none; color: red; cursor: pointer; font-size: 14px; padding: 5px;"
          >
            🗑️ Törlés
          </button>
        `;
        container.appendChild(div);
      });

      // MÓDOSÍTOTT eseménykezelő - automatikus törlés kérdés nélkül
      container.addEventListener("click", (event) => {
        const removeButton = event.target.closest(".remove-midyear-shift-change");
        if (removeButton) {
          const changeId = parseInt(
            removeButton.getAttribute("data-change-id")
          );

          // ❌ ELTÁVOLÍTVA: if (confirm('⚠️ Biztosan törölni szeretnéd...')) {
          
          // ✅ AUTOMATIKUS TÖRLÉS:
          if (window.app && typeof window.app.removeMidyearShiftChange === "function") {
            window.app.removeMidyearShiftChange(changeId);
          } else {
            console.error("Az app objektum nem elérhető a törlésnél");
          }
        }
      });
    } catch (error) {
      console.error("Hiba az évközi műszakváltások megjelenítése során:", error);
    }
  }

  // Meghatározza az érvényes műszakrendet egy adott dátumra (ugyanaz mint előtte)
  getEffectiveShiftPattern(year, month, day) {
    try {
      const yearData = this.yearlyData[year];
      if (!yearData) return "-";

      // Alapértelmezett műszakrend
      let effectivePattern = yearData.settings?.muszakrend || "-";
      
      // Évközi műszakváltások ellenőrzése
      if (yearData.settings?.midyear_shift_changes?.length > 0) {
        // Rendezzük a változásokat dátum szerint csökkenő sorrendbe
        const sortedChanges = [...yearData.settings.midyear_shift_changes].sort((a, b) => {
          if (b.month !== a.month) return b.month - a.month;
          return b.day - a.day;
        });

        // Keressük meg az első változást, ami a jelenlegi dátum előtt vagy azon történt
        const applicableChange = sortedChanges.find(change => {
          if (change.month < month) return true;
          if (change.month === month && change.day <= day) return true;
          return false;
        });

        if (applicableChange) {
          effectivePattern = applicableChange.shiftPattern;
        }
      }

      return effectivePattern;
    } catch (error) {
      console.error("Hiba az érvényes műszakrend meghatározása során:", error);
      return "-";
    }
  }

  changeYear(direction, type = "calendar") {
    let currentYear;
    let minYear = 2024;
    let maxYear = 2028;

    switch (type) {
      case "calendar":
        currentYear = this.currentYear + direction;
        if (currentYear >= minYear && currentYear <= maxYear) {
          this.currentYear = currentYear;
          if (direction < 0 && this.currentMonth === 0) {
            this.currentMonth = 11;
            this.currentYear--;
          } else if (direction > 0 && this.currentMonth === 11) {
            this.currentMonth = 0;
            this.currentYear++;
          }
        } else {
          // Ha elérné a korlátokat, nem csinálunk semmit
          return;
        }
        this.generateCalendar();
        break;

      case "payroll":
        currentYear = this.currentPayrollYear + direction;
        if (currentYear >= minYear && currentYear <= maxYear) {
          this.currentPayrollYear = currentYear;
          if (direction < 0 && this.currentPayrollMonth === 0) {
            this.currentPayrollMonth = 11;
            this.currentPayrollYear--;
          } else if (direction > 0 && this.currentPayrollMonth === 11) {
            this.currentPayrollMonth = 0;
            this.currentPayrollYear++;
          }
        } else {
          // Ha elérné a korlátokat, nem csinálunk semmit
          return;
        }
        this.generatePayrollTable();
        break;

      case "settings":
        currentYear = this.currentSettingsYear + direction;
        if (currentYear >= minYear && currentYear <= maxYear) {
          this.currentSettingsYear = currentYear;
          this.loadYearSettings(this.currentSettingsYear);
        } else {
          // Ha elérné a korlátokat, nem csinálunk semmit
          return;
        }
        break;
    }
  }

  // 25 év alatti kedvezmény számítása
  calculateUnder25Discount(year, month, grossSalary) {
    if (year < 2024 || year > 2028) return 0;

    const yearData = this.yearlyData[year];
    if (!yearData?.settings?.under25?.enabled) return 0;

    const birthYear = parseInt(yearData.settings.under25.birthYear);
    const birthMonth = parseInt(yearData.settings.under25.birthMonth);

    if (!birthYear || !birthMonth) return 0;

    // Pontos életkor számítás
    const birthDate = new Date(birthYear, birthMonth - 1);
    const currentDate = new Date(year, month);

    // Életkor számítása pontosan
    let age = currentDate.getFullYear() - birthDate.getFullYear();
    if (
      currentDate <
      new Date(
        currentDate.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
      )
    ) {
      age--;
    }

    if (age >= 25) return 0;

    const maxDiscount = {
      2024: 1037880,
      2025: 1182213,
      2026: 1182213,
      2027: 1182213,
      2028: 1182213,
    };

    const maxMonthlyDiscount = maxDiscount[year] / 12;

    // Havi arányosítás, ha az adott évben nem teljes évig jogosult
    const firstEligibleMonth =
      birthDate.getMonth() + (birthDate.getFullYear() === year ? 1 : 0);
    const lastEligibleMonth = birthDate.getMonth() + 12;
    const eligibleMonthsInYear = Math.min(
      12,
      lastEligibleMonth - firstEligibleMonth + 1
    );

    const monthlyDiscountRate = eligibleMonthsInYear / 12;
    const adjustedMaxMonthlyDiscount = maxMonthlyDiscount * monthlyDiscountRate;

    // A bruttó bér 15%-a és a maximális havi kedvezmény közül a kisebb
    return Math.min(grossSalary * 0.15, adjustedMaxMonthlyDiscount);
  }

  debugCalendarData() {
    // Aktuális hónap napjainak száma
    const daysInMonth = new Date(
      this.currentYear,
      this.currentMonth + 1,
      0
    ).getDate();

    if (this.yearData.calendar_data[this.currentMonth]) {
      Object.entries(this.yearData.calendar_data[this.currentMonth])
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([day, shift]) => {
          const dayNum = parseInt(day);
          if (dayNum <= daysInMonth) {
          }
        });
    }
  }

  initTouchNavigation() {
    const calendarSection = document.getElementById("calendar-section");
    let startX = 0;
    let endX = 0;

    calendarSection.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    });

    calendarSection.addEventListener("touchend", (e) => {
      endX = e.changedTouches[0].clientX;
      this.handleSwipe(startX, endX);
    });
  }

  handleSwipe(startX, endX) {
    // Minimum elmozdulás érzékeléséhez
    const minSwipeDistance = 100;

    if (startX - endX > minSwipeDistance) {
      // Balra húzás - következő hónap
      this.changeMonth(1);
    } else if (endX - startX > minSwipeDistance) {
      // Jobbra húzás - előző hónap
      this.changeMonth(-1);
    }
  }

  initNavigation() {
    const navButtons = {
      "calendar-btn": "calendar-section",
      "payroll-btn": "payroll-section",
      "settings-btn": "settings-section",
      "help-btn": "help-section",
    };

    Object.entries(navButtons).forEach(([btnId, sectionId]) => {
      document.getElementById(btnId).addEventListener("click", () => {
        this.showSection(sectionId);
      });
    });
  }

  showSection(sectionId) {
    // Elrejtjük az összes szekciót, de megőrizzük az esetleges animációs osztályokat
    document.querySelectorAll(".section").forEach((section) => {
      const classes = Array.from(section.classList).filter(
        (cls) => !cls.includes("section") && !cls.includes("active")
      );
      section.className = `section ${classes.join(" ")}`;
      section.style.display = "none";
    });

    // Kijelölt szekció megjelenítése
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
      const classes = Array.from(selectedSection.classList).filter(
        (cls) => !cls.includes("section") && !cls.includes("active")
      );
      selectedSection.className = `section active ${classes.join(" ")}`;
      selectedSection.style.display = "block";
    }
  }

  loadSettings() {
    const savedSettings = localStorage.getItem("appSettings");
    return savedSettings
      ? JSON.parse(savedSettings)
      : {
          shiftPattern: "1",
          baseSalary: 0,
          vacationDays: 20,
        };
  }

  initEventListeners() {
    try {
      // Hónap navigáció
      const prevMonthBtn = document.getElementById("prev-month-btn");
      const nextMonthBtn = document.getElementById("next-month-btn");

      if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", () => this.changeMonth(-1));
      }
      if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", () => this.changeMonth(1));
      }

      // Műszakrend és egyéb beállítások inicializálása
      const shiftPatternSelect = document.getElementById(
        "shift-pattern-select"
      );
      const baseSalaryInput = document.getElementById("base-salary");
      const vacationDaysInput = document.getElementById("vacation-days");

      // Ellenőrizzük, hogy léteznek-e az elemek és van-e settings objektum
      if (shiftPatternSelect && this.yearlyData[this.currentYear].settings) {
        shiftPatternSelect.value =
          this.yearlyData[this.currentYear].settings.muszakrend || "-";
      }
      if (baseSalaryInput && this.yearlyData[this.currentYear].settings) {
        baseSalaryInput.value =
          this.yearlyData[this.currentYear].settings.besorolasi_ber || "300000";
      }
      if (vacationDaysInput && this.yearlyData[this.currentYear].settings) {
        vacationDaysInput.value =
          this.yearlyData[this.currentYear].settings.szabadsag || "25";
      }

      // 25 év alatti checkbox kezelése
      const under25Checkbox = document.getElementById("under25-checkbox");
      if (under25Checkbox) {
        under25Checkbox.addEventListener("change", (e) => {
          const birthDateContainer = document.getElementById(
            "birth-date-container"
          );
          if (birthDateContainer) {
            birthDateContainer.style.display = e.target.checked
              ? "block"
              : "none";
          }
        });
      }

      // Évközi változás hozzáadása
      const midyearAddButton = document.getElementById("add-midyear-change");
      if (midyearAddButton) {
        midyearAddButton.addEventListener("click", () => {
          const monthSelect = document.getElementById("midyear-month");
          const salaryInput = document.getElementById("midyear-salary");

          if (
            monthSelect &&
            salaryInput &&
            monthSelect.value &&
            salaryInput.value
          ) {
            this.addMidyearChange(monthSelect.value, salaryInput.value);
          }
        });
      }
    } catch (error) {
      console.error("Hiba az eseménykezelők inicializálása során:", error);
    }
  }

  initSettingsNavigation() {
    document
      .getElementById("prev-settings-year-btn")
      .addEventListener("click", () => {
        this.changeSettingsYear(-1);
      });

    document
      .getElementById("next-settings-year-btn")
      .addEventListener("click", () => {
        this.changeSettingsYear(1);
      });
  }

  changeSettingsYear(direction) {
    // Korlátozzuk az éveket 2024 és 2028 között
    const newYear = this.currentSettingsYear + direction;
    if (newYear < 2024 || newYear > 2028) {
      return; // Nem megyünk tovább, ha elértük a korlátokat
    }

    const settingsContent = document.getElementById("settings-section");

    // Add slide out animation
    settingsContent.className = `section ${
      direction > 0 ? "slide-year-out-left" : "slide-year-out-right"
    }`;

    setTimeout(() => {
      this.currentSettingsYear = newYear;

      // Frissítsük az év kijelzést
      document.getElementById("current-settings-year").textContent =
        this.currentSettingsYear;

      // Töltsük be az adott év beállításait
      this.loadYearSettings(this.currentSettingsYear);

      // Add slide in animation
      settingsContent.className = `section active ${
        direction > 0 ? "slide-year-in-right" : "slide-year-in-left"
      }`;
    }, 200);
  }

  loadYearSettings(year) {
    // Frissítsük a kijelzett évet
    document.getElementById("current-settings-year").textContent = year;
    this.currentSettingsYear = year;

    // Biztosítjuk, hogy létezik az adott év
    if (!this.yearlyData[year]) {
      this.yearlyData[year] = {
        settings: {
          besorolasi_ber: "300000",
          szabadsag: "25",
          muszakrend: "-", // Alapértelmezett érték visszaállítása
          other_income: "0",
          children_count: "0",
          under25: {
            enabled: false,
            birthYear: "",
            birthMonth: "",
          },
          midyear_changes: [],
        },
        calendar_data: {},
        bonusEntries: {},
        restaurantEntries: {},
        egyebJovedelmEntries: {},
      };
    }

    const yearData = this.yearlyData[year];

    // Form mezők feltöltése
    const shiftPatternSelect = document.getElementById("shift-pattern-select");
    if (shiftPatternSelect) {
      // Ha nem létezik beállított műszakrend, alapértelmezetten '1'-et használjuk
      shiftPatternSelect.value = yearData.settings.muszakrend || "-";
    }

    const baseSalaryInput = document.getElementById("base-salary");
    if (baseSalaryInput && this.salaryVisibility) {
      this.salaryVisibility.setValue(
        yearData.settings.besorolasi_ber || "300000"
      );
    }

    const otherIncomeInput = document.getElementById("other-income");
    if (otherIncomeInput) {
      otherIncomeInput.value = yearData.settings.other_income || "0";
    }

    const vacationDaysInput = document.getElementById("vacation-days");
    if (vacationDaysInput) {
      vacationDaysInput.value = yearData.settings.szabadsag || "25";
    }

    const childrenCountInput = document.getElementById("children-count");
    if (childrenCountInput) {
      childrenCountInput.value = yearData.settings.children_count || "0";
    }

    // 25 év alatti beállítások
    const under25 = yearData.settings.under25 || { enabled: false };
    const under25Checkbox = document.getElementById("under25-checkbox");
    const birthYearInput = document.getElementById("birth-year");
    const birthMonthInput = document.getElementById("birth-month");
    const birthDateContainer = document.getElementById("birth-date-container");

    if (under25Checkbox) under25Checkbox.checked = under25.enabled;
    if (birthYearInput) birthYearInput.value = under25.birthYear || "";
    if (birthMonthInput) birthMonthInput.value = under25.birthMonth || "";
    if (birthDateContainer)
      birthDateContainer.style.display = under25.enabled ? "block" : "none";

    // Évközi változások megjelenítése
    this.displayMidyearChanges();
    this.displayMidyearShiftChanges();
  }

  initSettings() {
    try {
      // Színbeállítások kezelése
      const colorPickers = document.querySelectorAll(".color-picker");
      colorPickers.forEach((button) => {
        button.addEventListener("click", (e) => this.handleColorPickerClick(e));
      });

      // Under 25 checkbox kezelése
      const under25Checkbox = document.getElementById("under25-checkbox");
      const birthDateContainer = document.getElementById(
        "birth-date-container"
      );

      if (under25Checkbox && birthDateContainer) {
        under25Checkbox.addEventListener("change", (e) => {
          birthDateContainer.style.display = e.target.checked
            ? "block"
            : "none";
        });
      }

      // Évközi változás hozzáadása gomb kezelése
      const addMidyearChangeBtn = document.getElementById("add-midyear-change");
      if (addMidyearChangeBtn) {
        addMidyearChangeBtn.addEventListener("click", () => {
          const monthSelect = document.getElementById("midyear-month");
          const salaryInput = document.getElementById("midyear-salary");

          if (
            monthSelect &&
            salaryInput &&
            monthSelect.value &&
            salaryInput.value
          ) {
            this.addMidyearChange(monthSelect.value, salaryInput.value);
          }
        });
      }

      // Beállítások mentése gomb kezelése
      const saveSettingsBtn = document.getElementById("save-settings");
      if (saveSettingsBtn) {
        // Először töröljük az összes korábban hozzáadott eseménykezelőt
        saveSettingsBtn.removeEventListener("click", this.saveSettingsHandler);

        // Dedikált eseménykezelő metódus
        this.saveSettingsHandler = () => {
          try {
            this.saveSettings();
            showSuccessMessage("Sikeres mentés");
          } catch (error) {
            console.error("Hiba a beállítások mentése során:", error);
            alert("Hiba történt a beállítások mentése során!");
          }
        };

        // Eseménykezelő hozzáadása
        saveSettingsBtn.addEventListener("click", this.saveSettingsHandler);
      }

      // Műszakrend és egyéb beállítások inicializálása
      const shiftPatternSelect = document.getElementById(
        "shift-pattern-select"
      );
      const baseSalaryInput = document.getElementById("base-salary");
      const vacationDaysInput = document.getElementById("vacation-days");
      const otherIncomeInput = document.getElementById("other-income");
      const childrenCountInput = document.getElementById("children-count");
      if (childrenCountInput && this.yearlyData[this.currentYear]?.settings) {
        childrenCountInput.value =
          this.yearlyData[this.currentYear].settings.children_count || "0";

        // Event listener hozzáadása az automatikus mentéshez
        childrenCountInput.addEventListener("input", () => {
          if (this.yearlyData[this.currentSettingsYear]?.settings) {
            this.yearlyData[this.currentSettingsYear].settings.children_count =
              childrenCountInput.value || "0";
            this.saveYearlyData();
            this.generatePayrollTable(); // Bérszámfejtés frissítése
          }
        });
      }

      if (vacationDaysInput && this.yearlyData[this.currentYear]?.settings) {
        vacationDaysInput.value =
          this.yearlyData[this.currentYear].settings.szabadsag || "25";

        // Event listener hozzáadása az automatikus mentéshez
        vacationDaysInput.addEventListener("input", () => {
          if (this.yearlyData[this.currentSettingsYear]?.settings) {
            this.yearlyData[this.currentSettingsYear].settings.szabadsag =
              vacationDaysInput.value || "25";
            this.saveYearlyData();
            this.generatePayrollTable(); // Bérszámfejtés frissítése
          }
        });
      }

      // Ellenőrizzük, hogy léteznek-e az elemek és van-e settings objektum
      if (shiftPatternSelect && this.yearlyData[this.currentYear]?.settings) {
        shiftPatternSelect.value =
          this.yearlyData[this.currentYear].settings.muszakrend || "-";
      }
      if (baseSalaryInput && this.yearlyData[this.currentYear]?.settings) {
        baseSalaryInput.value =
          this.yearlyData[this.currentYear].settings.besorolasi_ber || "300000";
      }
      if (vacationDaysInput && this.yearlyData[this.currentYear]?.settings) {
        vacationDaysInput.value =
          this.yearlyData[this.currentYear].settings.szabadsag || "25";
      }
      if (otherIncomeInput && this.yearlyData[this.currentYear]?.settings) {
        otherIncomeInput.value =
          this.yearlyData[this.currentYear].settings.other_income || "0";

        // Auto-save hozzáadása
        otherIncomeInput.addEventListener("input", () => {
          if (this.yearlyData[this.currentSettingsYear]?.settings) {
            this.yearlyData[this.currentSettingsYear].settings.other_income =
              otherIncomeInput.value || "0";
            this.saveYearlyData();
            this.generatePayrollTable();
          }
        });
      }

      // 25 év alatti beállítások betöltése
      if (
        under25Checkbox &&
        this.yearlyData[this.currentYear]?.settings?.under25
      ) {
        under25Checkbox.checked =
          this.yearlyData[this.currentYear].settings.under25.enabled;
        if (birthDateContainer) {
          birthDateContainer.style.display = under25Checkbox.checked
            ? "block"
            : "none";
        }

        const birthYearInput = document.getElementById("birth-year");
        const birthMonthInput = document.getElementById("birth-month");

        if (birthYearInput) {
          birthYearInput.value =
            this.yearlyData[this.currentYear].settings.under25.birthYear || "";
        }
        if (birthMonthInput) {
          birthMonthInput.value =
            this.yearlyData[this.currentYear].settings.under25.birthMonth || "";
        }
      }

      // Export/Import gombok eseménykezelői
      const exportAllBtn = document.getElementById('export-all-btn');
      const importAllBtn = document.getElementById('import-all-btn');
      const exportQuickBtn = document.getElementById('export-quick-btn');
      const importQuickBtn = document.getElementById('import-quick-btn');

      if (exportAllBtn) {
        exportAllBtn.addEventListener('click', () => {
          this.exportAllData();
        });
      }

      if (importAllBtn) {
        importAllBtn.addEventListener('click', () => {
          this.importAllData();
        });
      }

      if (exportQuickBtn) {
        exportQuickBtn.addEventListener('click', () => {
          this.exportQuickBackup();
        });
      }

      if (importQuickBtn) {
        importQuickBtn.addEventListener('click', () => {
          this.importQuickBackup();
        });
      }

      // Évközi műszakváltás eseménykezelő
      const addMidyearShiftChangeBtn = document.getElementById("add-midyear-shift-change");
        if (addMidyearShiftChangeBtn) {
          addMidyearShiftChangeBtn.addEventListener("click", () => {
            const monthSelect = document.getElementById("midyear-shift-month");
            const dayInput = document.getElementById("midyear-shift-day");
            const patternSelect = document.getElementById("midyear-shift-pattern");

            if (monthSelect && dayInput && patternSelect && 
                monthSelect.value && dayInput.value && patternSelect.value) {
              
              // ❌ ELTÁVOLÍTVA: Extra megerősítő kérdés
              // ✅ AUTOMATIKUS VÉGREHAJTÁS:
              this.addMidyearShiftChange(monthSelect.value, dayInput.value, patternSelect.value);
              
              // Mezők törlése sikeres hozzáadás után
              monthSelect.value = "";
              dayInput.value = "";
              patternSelect.value = "";
              
            } else {
              alert("❌ Kérlek tölts ki minden mezőt!\n\n• Válassz hónapot\n• Add meg a napot (1-31)\n• Válassz új műszakrendet");
            }
          });
        }

      // Évközi műszakváltások megjelenítése (betöltéskor)
      this.displayMidyearShiftChanges();

      // Besorolási bér mező kezelése
      const handleSalaryVisibility = () => {
        const salaryInput = document.getElementById("base-salary");
        const toggleButton = document.getElementById(
          "toggle-salary-visibility"
        );
        let isVisible = false;
        let hideTimeout;

        // CSS animációk
        const style = document.createElement("style");
        style.textContent = `
                        .salary-input {
                            transition: opacity 0.3s ease-in-out;
                        }
                        .salary-fade {
                            opacity: 0.5;
                        }
                        .visibility-toggle {
                            transition: transform 0.2s ease;
                        }
                        .visibility-toggle:active {
                            transform: translateY(-50%) scale(0.9);
                        }
                    `;
        document.head.appendChild(style);

        // Érték maszkolása
        const maskValue = (value) => "•".repeat(String(value).length);

        // Bérszámfejtés frissítése - MÓDOSÍTVA
        const updatePayroll = (value) => {
          if (window.app) {
            window.app.yearlyData[
              window.app.currentSettingsYear
            ].settings.besorolasi_ber = value;
            window.app.saveYearlyData();
            window.app.generatePayrollTable();
          }
        };

        // Érték mentése - ÚJ FÜGGVÉNY
        const saveValue = () => {
          const currentValue = salaryInput.value.replace(/[•]/g, "");
          updatePayroll(currentValue);
        };

        // Érték megjelenítés kezelése
        const updateInputVisibility = () => {
          if (isVisible) {
            salaryInput.type = "number";
            salaryInput.value = salaryInput.value.replace(/[•]/g, "");
          } else {
            salaryInput.type = "text";
            salaryInput.value = maskValue(salaryInput.value);
          }
        };

        if (salaryInput) {
          salaryInput.parentElement.style.position = "relative";
          salaryInput.style.paddingRight = "45px";
          salaryInput.parentElement.appendChild(toggleButton);

          // Kezdeti állapot beállítása
          updateInputVisibility();

          // Input eseménykezelő - MÓDOSÍTVA
          salaryInput.addEventListener("input", function (e) {
            clearTimeout(hideTimeout);
            if (this.type === "number") {
              saveValue(); // Mentjük az értéket

              if (!isVisible) {
                hideTimeout = setTimeout(() => {
                  this.type = "text";
                  this.value = maskValue(this.value);
                }, 1500);
              }
            }
          });

          // Láthatóság váltás kezelése - MÓDOSÍTVA
          const toggleVisibility = (e) => {
            e.preventDefault();
            e.stopPropagation();

            isVisible = !isVisible;
            clearTimeout(hideTimeout);

            // Értéket itt is mentjük
            saveValue();

            updateInputVisibility();
            toggleButton.innerHTML = isVisible ? "👁️" : "👁️‍🗨️";
          };

          // Touch és click események
          toggleButton.addEventListener("touchstart", toggleVisibility, {
            passive: false,
          });
          toggleButton.addEventListener(
            "touchend",
            (e) => {
              e.preventDefault();
              e.stopPropagation();
            },
            { passive: false }
          );
          toggleButton.addEventListener("click", toggleVisibility);

          // Focus és blur események - MÓDOSÍTVA
          salaryInput.addEventListener("focus", function () {
            clearTimeout(hideTimeout);
            if (!isVisible) {
              this.type = "number";
              this.value = this.value.replace(/[•]/g, "");
            }
          });

          salaryInput.addEventListener("blur", function () {
            saveValue(); // Mentjük az értéket blur eseménynél is

            if (!isVisible) {
              this.type = "text";
              this.value = maskValue(this.value);
            }
          });
        }

        return {
          getValue: () => salaryInput.value.replace(/[•]/g, ""),
          setValue: (value) => {
            if (salaryInput) {
              if (!isVisible) {
                salaryInput.type = "text";
                salaryInput.value = maskValue(value);
              } else {
                salaryInput.type = "number";
                salaryInput.value = value;
              }
            }
            // Bérszámfejtés frissítése értékbeállításkor is
            updatePayroll(value);
          },
        };
      };

      // Színbeállítások betöltése és előnézetek frissítése
      this.loadColorSettings();
      this.updateColorPreviews();

      // Évközi változások megjelenítése
      this.displayMidyearChanges();
      this.displayMidyearShiftChanges();
    } catch (error) {
      console.error("Hiba a beállítások inicializálása során:", error);
    }
  }

  changeMonth(direction) {
    const newYear =
      this.currentYear +
      (this.currentMonth + direction < 0
        ? -1
        : this.currentMonth + direction > 11
        ? 1
        : 0);

    // Korlátozzuk az éveket 2024 és 2028 között
    if (newYear < 2024 || newYear > 2028) {
      return; // Nem megyünk tovább, ha elértük a korlátokat
    }

    const calendarBody = document.getElementById("calendar-body");

    // Add slide out animation
    calendarBody.className =
      direction > 0 ? "slide-out-left" : "slide-out-right";

    setTimeout(() => {
      // Change month after slide out animation
      this.currentMonth += direction;

      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      } else if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }

      // SZINKRONIZÁLÁS: Bérszámfejtés frissítése is
      this.currentPayrollMonth = this.currentMonth;
      this.currentPayrollYear = this.currentYear;

      // Generate new calendar and payroll
      this.generateCalendar();
      this.generatePayrollTable(); // Bérszámfejtés is frissül

      // Add slide in animation
      calendarBody.className =
        direction > 0 ? "slide-in-right" : "slide-in-left";
    }, 300);
  }

  changePayrollMonth(direction) {
    const newYear =
      this.currentPayrollYear +
      (this.currentPayrollMonth + direction < 0
        ? -1
        : this.currentPayrollMonth + direction > 11
        ? 1
        : 0);

    // Korlátozzuk az éveket 2024 és 2028 között
    if (newYear < 2024 || newYear > 2028) {
      return; // Nem megyünk tovább, ha elértük a korlátokat
    }

    const payrollBody = document.getElementById("payroll-body");

    // Add slide out animation
    payrollBody.className =
      direction > 0 ? "slide-out-left" : "slide-out-right";

    setTimeout(() => {
      // Change month after slide out animation
      this.currentPayrollMonth += direction;

      if (this.currentPayrollMonth < 0) {
        this.currentPayrollMonth = 11;
        this.currentPayrollYear--;
      } else if (this.currentPayrollMonth > 11) {
        this.currentPayrollMonth = 0;
        this.currentPayrollYear++;
      }

      // SZINKRONIZÁLÁS: Naptár frissítése is
      this.currentMonth = this.currentPayrollMonth;
      this.currentYear = this.currentPayrollYear;

      // Generate new payroll and calendar
      this.generatePayrollTable();
      this.generateCalendar(); // Naptár is frissül

      // Add slide in animation
      payrollBody.className =
        direction > 0 ? "slide-in-right" : "slide-in-left";
    }, 200);
  }

  getHolidays(year) {
    // Fix ünnepnapok
    const fixedHolidays = [
      { month: 0, day: 1 }, // Újév
      { month: 2, day: 15 }, // Március 15.
      { month: 4, day: 1 }, // Munka ünnepe
      { month: 7, day: 20 }, // Államalapítás ünnepe
      { month: 9, day: 23 }, // Október 23.
      { month: 10, day: 1 }, // Mindenszentek
      { month: 11, day: 24 }, // Szenteste
      { month: 11, day: 25 }, // Karácsony
      { month: 11, day: 26 }, // Karácsony másnapja
    ];

    // Húsvét és kapcsolódó ünnepek kiszámítása
    const easter = this.calculateEaster(year);

    // Nagypéntek (Húsvét vasárnap előtti péntek)
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);

    // Húsvéthétfő
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);

    // Pünkösd (Húsvét után 49 nappal)
    const pentecost = new Date(easter);
    pentecost.setDate(easter.getDate() + 49);

    // Pünkösdhétfő
    const pentecostMonday = new Date(pentecost);
    pentecostMonday.setDate(pentecost.getDate() + 1);

    // Mozgó ünnepek hozzáadása
    const movingHolidays = [
      { month: goodFriday.getMonth(), day: goodFriday.getDate() }, // Nagypéntek
      { month: easterMonday.getMonth(), day: easterMonday.getDate() }, // Húsvéthétfő
      { month: pentecostSunday.getMonth(), day: pentecostSunday.getDate() }, // Pünkösd vasárnap
      { month: pentecostMonday.getMonth(), day: pentecostMonday.getDate() }, // Pünkösdhétfő
    ];

    // Összes ünnep összefűzése
    const allHolidays = [...fixedHolidays, ...movingHolidays];

    return allHolidays;
  }

  // Húsvét vasárnap kiszámítása (Meeus/Jones/Butcher algoritmus)
  calculateEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
  }

  isHoliday(year, month, day) {
    return this.calculator.isHoliday(year, month, day);
  }

  applyShiftColors(value, shiftDiv, dateSpan) {
  try {
    // Ha üres vagy undefined érték
    if (
      !value ||
      value === undefined ||
      value.trim() === " " ||
      value.trim() === ""
    ) {
      // Ellenőrizzük a jelenlegi témát
      const isDarkTheme = document.body.getAttribute('data-theme') === 'dark';
      
      if (isDarkTheme) {
        // Sötét téma - invertált színek
        shiftDiv.style.backgroundColor = "#2d2d2d"; // Sötét háttér
        shiftDiv.style.color = "#cccccc"; // Világos szöveg
        dateSpan.style.backgroundColor = "#333333"; // Sötét háttér
        dateSpan.style.color = "#ffffff"; // Fehér szöveg
      } else {
        // Világos téma - eredeti színek
        shiftDiv.style.backgroundColor = "white";
        shiftDiv.style.color = "black";
        dateSpan.style.backgroundColor = "#f0f0f0";
        dateSpan.style.color = "#333";
      }
      return;
    }

    // Keressük a megfelelő színt (műszakok esetén)
    let found = false;

    // Kombinált Szabadság + Csúszó opciók: felezett háttérszín
    if (value.includes("Szabadság") && value.includes("Csúszó")) {
      const szabadsagColor = SHIFT_COLORS["Szabadság"][0];
      const csuszoColor = SHIFT_COLORS["Csúszó"][0];
      const gradient = `linear-gradient(to right, ${szabadsagColor} 50%, ${csuszoColor} 50%)`;
      shiftDiv.style.background = gradient;
      shiftDiv.style.color = "black";
      dateSpan.style.background = gradient;
      dateSpan.style.color = "black";
      return;
    }

    Object.entries(SHIFT_COLORS).forEach(([type, [bgColor, textColor]]) => {
      // Normalizáljuk mindkét stringet az összehasonlításhoz
      const normalizedValue = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const normalizedType = type
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (normalizedValue.includes(normalizedType)) {
        shiftDiv.style.backgroundColor = bgColor;
        shiftDiv.style.color = textColor;
        dateSpan.style.backgroundColor = bgColor;
        dateSpan.style.color = textColor;
        found = true;
      }

      if (normalizedValue.includes("csuszo")) {
        shiftDiv.style.backgroundColor = SHIFT_COLORS["Csúszó"][0];
        shiftDiv.style.color = SHIFT_COLORS["Csúszó"][1];
        dateSpan.style.backgroundColor = SHIFT_COLORS["Csúszó"][0];
        dateSpan.style.color = SHIFT_COLORS["Csúszó"][1];
        found = true;
      }

    });

    // Ha nem találtunk színt, alapértelmezett színek (téma szerint)
    if (!found) {
      const isDarkTheme = document.body.getAttribute('data-theme') === 'dark';
      
      if (isDarkTheme) {
        // Sötét téma alapértelmezett
        shiftDiv.style.backgroundColor = "#2d2d2d";
        shiftDiv.style.color = "#cccccc";
        dateSpan.style.backgroundColor = "#333333";
        dateSpan.style.color = "#ffffff";
      } else {
        // Világos téma alapértelmezett
        shiftDiv.style.backgroundColor = "white";
        shiftDiv.style.color = "black";
        dateSpan.style.backgroundColor = "#f0f0f0";
        dateSpan.style.color = "#333";
      }
    }
  } catch (error) {
    console.error("Hiba a színek alkalmazása során:", error);
  }
}

  // Naptár generálása
  generateCalendar() {
    try {
      // DOM elemek lekérése
      const calendarBody = document.getElementById("calendar-body");
      const currentMonthElement = document.getElementById("current-month");

      if (!calendarBody || !currentMonthElement) {
        throw new Error("Hiányzó DOM elemek a naptár generálásához");
      }

      // Ünnepnapok lekérése az aktuális évre
      const holidays = this.calculator.getHolidays(this.currentYear);

      // Hónapok nevei
      const months = [
        "JANUÁR",
        "FEBRUÁR",
        "MÁRCIUS",
        "ÁPRILIS",
        "MÁJUS",
        "JÚNIUS",
        "JÚLIUS",
        "AUGUSZTUS",
        "SZEPTEMBER",
        "OKTÓBER",
        "NOVEMBER",
        "DECEMBER",
      ];

      // Hónap és év kiírása a fejlécbe
      currentMonthElement.textContent = `${months[this.currentMonth]} ${
        this.currentYear
      }`;

      // Adatstruktúrák inicializálása
      if (!this.yearlyData[this.currentYear]) {
        this.yearlyData[this.currentYear] = {
          settings: {
            besorolasi_ber: "300000",
            szabadsag: "25",
            muszakrend: "-",
            other_income: "0",
            under25: {
              enabled: false,
              birthYear: "",
              birthMonth: "",
            },
            midyear_changes: [],
          },
          calendar_data: {},
          bonusEntries: {},
          restaurantEntries: {},
        egyebJovedelmEntries: {},
        };
      }

      // Calendar_data inicializálása az aktuális hónapra
      if (!this.yearlyData[this.currentYear].calendar_data[this.currentMonth]) {
        this.yearlyData[this.currentYear].calendar_data[this.currentMonth] = {};
      }

      // Naptár generálás előkészítése
      calendarBody.innerHTML = "";
      const firstDay = new Date(
        this.currentYear,
        this.currentMonth,
        1
      ).getDay();
      const daysInMonth = new Date(
        this.currentYear,
        this.currentMonth + 1,
        0
      ).getDate();
      const today = new Date();

      // Vasárnap (0) átkonvertálása hétfőre (6)
      const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

      let currentDate = 1;
      let currentWeek = document.createElement("tr");

      // Első hét üres celláinak hozzáadása
      for (let i = 0; i < adjustedFirstDay; i++) {
        const emptyCell = document.createElement("td");
        currentWeek.appendChild(emptyCell);
      }

      // Naptár feltöltése
      while (currentDate <= daysInMonth) {
        // Ha új hét kezdődik
        if (
          (adjustedFirstDay + currentDate - 1) % 7 === 0 &&
          currentDate !== 1
        ) {
          calendarBody.appendChild(currentWeek);
          currentWeek = document.createElement("tr");
        }

        const cell = document.createElement("td");

        // Ünnepnap ellenőrzése
        const isCurrentDayHoliday = holidays.some(
          (holiday) =>
            holiday.month === this.currentMonth && holiday.day === currentDate
        );

        // Mai nap ellenőrzése
        const isToday =
          this.currentYear === today.getFullYear() &&
          this.currentMonth === today.getMonth() &&
          currentDate === today.getDate();

        // Dátum konténer létrehozása
        const dateContainer = document.createElement("div");
        dateContainer.className = "date-container";
        dateContainer.style.position = "relative";

        // Dátum szám létrehozása
        const dateSpan = document.createElement("span");
        dateSpan.className = "date-number";
        dateSpan.textContent = currentDate;
        dateContainer.appendChild(dateSpan);

        // Műszak div létrehozása
        const shiftDiv = document.createElement("div");
        shiftDiv.className = "shift-select";

        // MEGJEGYZÉS MEGJELENÍTÉSE - ÚJ RÉSZ
        const savedNote =
          this.yearlyData[this.currentYear].notes?.[this.currentMonth]?.[
            currentDate
          ] || "";
        if (savedNote) {
          const noteDisplay = document.createElement("div");
          noteDisplay.className = "note-display";
          noteDisplay.textContent = savedNote;
          noteDisplay.title = savedNote; // Tooltip a teljes szöveghez
          dateContainer.appendChild(noteDisplay);
        }

        shiftDiv.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const clickedDay = parseInt(dateSpan.textContent);

          // Modal létrehozása
          const overlay = document.createElement("div");
          overlay.className = "shift-select-overlay";

          const modal = document.createElement("div");
          modal.className = "shift-select-modal";

          // Modal címe
          const title = document.createElement("h2");
          title.textContent = `${this.currentYear}. ${
            this.currentMonth + 1
          }. ${clickedDay}.`;
          title.style.marginBottom = "15px";
          modal.appendChild(title);

          // Megjegyzés input mező
          const noteContainer = document.createElement("div");
          noteContainer.style.marginBottom = "15px";

          const noteLabel = document.createElement("label");
          noteLabel.textContent = "Megjegyzés:";
          noteLabel.style.display = "block";
          noteLabel.style.marginBottom = "5px";
          noteLabel.style.fontWeight = "bold";

          const noteInput = document.createElement("textarea");
          noteInput.style.width = "100%";
          noteInput.style.height = "60px";
          noteInput.style.padding = "8px";
          noteInput.style.border = "1px solid #ddd";
          noteInput.style.borderRadius = "4px";
          noteInput.style.fontSize = "14px";
          noteInput.style.resize = "vertical";
          noteInput.placeholder = "Írj ide bármilyen megjegyzést...";

          // Betöltjük a meglévő megjegyzést
          const existingNote =
            this.yearlyData[this.currentYear].notes?.[this.currentMonth]?.[
              clickedDay
            ] || "";
          noteInput.value = existingNote;

          // ÚJ: Automatikus mentés funkció
          const saveNote = () => {
            const noteText = noteInput.value.trim();

            // Megjegyzés mentése
            if (!this.yearlyData[this.currentYear].notes) {
              this.yearlyData[this.currentYear].notes = {};
            }
            if (!this.yearlyData[this.currentYear].notes[this.currentMonth]) {
              this.yearlyData[this.currentYear].notes[this.currentMonth] = {};
            }

            if (noteText) {
              this.yearlyData[this.currentYear].notes[this.currentMonth][
                clickedDay
              ] = noteText;
            } else {
              // Ha üres a megjegyzés, töröljük
              delete this.yearlyData[this.currentYear].notes[this.currentMonth][
                clickedDay
              ];
            }

            this.saveYearlyData();
            this.generateCalendar(); // Naptár újragenerálása, hogy megjelenjen a megjegyzés
          };

          // ÚJ: Modal bezárása és automatikus mentés
          const closeModal = () => {
            saveNote(); // Automatikusan mentjük a megjegyzést
            document.body.removeChild(overlay);
          };

          noteContainer.appendChild(noteLabel);
          noteContainer.appendChild(noteInput);
          modal.appendChild(noteContainer);

          // Műszak opciók
          const shifts = [
            "", // Szabadnap
            "Nappal",
            "Éjszaka",
            "Szabadság 12 óra",
            "Szabadság éj 12 óra",
            "Szabadság 8 óra",
            "Szabadság éj 8 óra",
            "Szabadság 4 óra",
            "Szabadság éj 4 óra",
            "Túlóra 12 óra",
            "Túlóra éj 12 óra",
            "Túlóra 8 óra",
            "Túlóra éj 8 óra",
            "Csúszó túlórakeretből",
            "Csúszó túlórakeretből éjszaka",
            "Csúszó túlórából",
            "Csúszó túlórából éjszaka",
            "Szabadság 4 óra + Csúszó 4 óra",
            "Szabadság 4 óra + Csúszó 4 óra éj",
            "Szabadság 8 óra + Csúszó 4 óra",
            "Szabadság 8 óra + Csúszó 4 óra éj",
            "Szabadság 4 óra + Csúszó 8 óra",
            "Szabadság 4 óra + Csúszó 8 óra éj",
            "Táppénz kezdete műszak",
            "Táppénz kezdete szabadnap",
            "Táppénz",
            "Táppénz vége szabadnap",
            "Táppénz vége műszak",
          ];

          shifts.forEach((shiftName) => {
            const button = document.createElement("button");
            button.textContent = shiftName === "" ? "Szabadnap" : shiftName;
            button.style.display = "block";
            button.style.width = "100%";
            button.style.padding = "10px";
            button.style.marginBottom = "20px";
            button.style.border = "none";
            button.style.borderRadius = "5px";

            const matchedKey = Object.keys(SHIFT_COLORS).find((key) =>
              shiftName.includes(key)
            );

            // Kombinált Szabadság + Csúszó opciók: felezett háttérszín
            if (shiftName.includes("Szabadság") && shiftName.includes("Csúszó")) {
              const szabadsagColor = SHIFT_COLORS["Szabadság"][0];
              const csuszoColor = SHIFT_COLORS["Csúszó"][0];
              button.style.background = `linear-gradient(to right, ${szabadsagColor} 50%, ${csuszoColor} 50%)`;
              button.style.color = "black";
            } else if (matchedKey) {
              const [bgColor, textColor] = SHIFT_COLORS[matchedKey];
              button.style.backgroundColor = bgColor;
              button.style.color = textColor;
            } else if (shiftName === "") {
              button.style.backgroundColor = "white";
              button.style.color = "black";
              button.style.border = "1px solid #ddd";
            } else {
              button.style.backgroundColor = "#4a90e2";
              button.style.color = "white";
            }

            button.addEventListener("click", () => {
              // Csúszó opciók esetén óraszám modal
              if (shiftName.startsWith("Csúszó")) {
                showHourInputModal(shiftName, (hours) => {
                  const newShift = `${shiftName} ${hours} óra`;
                  
                  shiftDiv.textContent = newShift;
                  this.applyShiftColors(newShift, shiftDiv, dateSpan);

                  this.yearlyData[this.currentYear].calendar_data[this.currentMonth][clickedDay] = newShift;

                  saveNote(); // Megjegyzés mentése
                  
                  this.currentPayrollMonth = this.currentMonth;
                  this.currentPayrollYear = this.currentYear;
                  this.generatePayrollTable();
                  
                  document.body.removeChild(overlay);
                });
              } else {
                // Normál műszakok esetén
                const newShift = shiftName === "" ? " " : shiftName;

                shiftDiv.textContent = newShift;
                this.applyShiftColors(newShift, shiftDiv, dateSpan);

                this.yearlyData[this.currentYear].calendar_data[this.currentMonth][clickedDay] = newShift;

                saveNote();

                this.currentPayrollMonth = this.currentMonth;
                this.currentPayrollYear = this.currentYear;
                this.generatePayrollTable();

                document.body.removeChild(overlay);
              }
            });

            modal.appendChild(button);
          });

          // Mégsem gomb - MÓDOSÍTVA: most automatikusan menti a megjegyzést
          const closeButton = document.createElement("button");
          closeButton.textContent = "Bezárás"; // Szöveg módosítva
          closeButton.style.display = "block";
          closeButton.style.width = "100%";
          closeButton.style.padding = "10px";
          closeButton.style.backgroundColor = "#4a90e2"; // Szín módosítva zöldre
          closeButton.style.color = "white";
          closeButton.style.border = "none";
          closeButton.style.borderRadius = "5px";

          closeButton.addEventListener("click", closeModal);

          modal.appendChild(closeButton);
          overlay.appendChild(modal);
          document.body.appendChild(overlay);

          // ÚJ: Overlay kattintás is automatikusan menti a megjegyzést
          overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
              closeModal();
            }
          });

          // ÚJ: ESC billentyű lenyomására is bezárás és mentés
          const handleEscape = (event) => {
            if (event.key === "Escape") {
              closeModal();
              document.removeEventListener("keydown", handleEscape);
            }
          };
          document.addEventListener("keydown", handleEscape);
        });

        // Műszak érték meghatározása
        let shiftValue =
          this.yearlyData[this.currentYear].calendar_data[this.currentMonth][
            currentDate
          ];

        // Csak akkor generáljunk új értéket, ha nincs mentett érték
        if (shiftValue === undefined) {
          shiftValue = this.generateShiftPattern(currentDate);

          // Ha a generált érték nem üres, akkor mentsük el
          if (shiftValue !== " ") {
            this.yearlyData[this.currentYear].calendar_data[this.currentMonth][
              currentDate
            ] = shiftValue;
          }
        }

        shiftDiv.textContent = shiftValue;
        this.applyShiftColors(shiftValue, shiftDiv, dateSpan);

        if (isToday) {
          cell.classList.add("today");
        }
        if (isCurrentDayHoliday) {
          cell.classList.add("holiday");
        }

        dateContainer.appendChild(shiftDiv);
        cell.appendChild(dateContainer);
        currentWeek.appendChild(cell);

        currentDate++;
      }

      // Utolsó hét hozzáadása
      if (currentWeek.hasChildNodes()) {
        calendarBody.appendChild(currentWeek);
      }

      // Adatok mentése
      this.saveYearlyData();
    } catch (error) {
      console.error("Hiba a naptár generálása során:", error);
    }
  }

  // Ünnepnapok ellenőrzése
  isHoliday(year, month, day) {
    const holidays = [
      { month: 0, day: 1 }, // Újév
      { month: 2, day: 15 }, // Március 15.
      { month: 3, day: 1 }, // Munka ünnepe
      { month: 4, day: 19 }, // Pünkösd
      { month: 7, day: 20 }, // Államalapítás ünnepe
      { month: 9, day: 23 }, // Nemzeti ünnep
      { month: 11, day: 25 }, // Karácsony
      { month: 11, day: 26 }, // Karácsony másnapja
    ];

    return holidays.some(
      (holiday) => holiday.month === month && holiday.day === day
    );
  }

  generateShiftPattern(day) {
    try {
      const currentDate = new Date(this.currentYear, this.currentMonth, day);
      const effectivePattern = this.getEffectiveShiftPattern(
      this.currentYear, 
      this.currentMonth, 
      day
    );

    // ÚJ: Az érvényes műszakrendet használjuk az alapértelmezett helyett
    const currentPattern = effectivePattern;
      let shiftValue;

      switch (currentPattern) {
        case "-":
                // Teljesen üres naptár - minden nap szabadnap
                return " ";

        case "A":
          // A, B, C műszakrendnél ne generáljon műszakot ünnepnapon
          if (
            this.calculator.isHoliday(this.currentYear, this.currentMonth, day)
          ) {
            return " ";
          }
          shiftValue = this.generateAShiftPattern(
            this.currentYear,
            this.currentMonth,
            day
          );
          break;
        case "B":
          if (
            this.calculator.isHoliday(this.currentYear, this.currentMonth, day)
          ) {
            return " ";
          }
          shiftValue = this.generateBShiftPattern(
            this.currentYear,
            this.currentMonth,
            day
          );
          break;
        case "C":
          if (
            this.calculator.isHoliday(this.currentYear, this.currentMonth, day)
          ) {
            return " ";
          }
          shiftValue = this.generateCShiftPattern(
            this.currentYear,
            this.currentMonth,
            day
          );
          break;
        case "1":
          shiftValue = this.generateClassicShiftPattern1(currentDate);
          break;
        case "2":
          shiftValue = this.generateClassicShiftPattern2(currentDate);
          break;
        case "3":
          shiftValue = this.generateClassicShiftPattern3(currentDate);
          break;
        case "4":
          shiftValue = this.generateClassicShiftPattern4(currentDate);
          break;
        default:
          shiftValue = " ";
      }

      return shiftValue;
    } catch (error) {
      console.error("Hiba a műszakrend generálásánál:", error);
      return " ";
    }
  }

  generateAShiftPattern(year, month, day) {
    const shiftCycle = [
      "Nappal",
      "Nappal",
      " ",
      "Éjszaka",
      "Éjszaka",
      " ",
      " ",
      " ",
      " ",
      "Nappal",
      "Nappal",
      "Nappal",
      " ",
      " ",
      "Éjszaka",
      "Éjszaka",
      "Éjszaka",
      " ",
      " ",
      " ",
      " ",
    ];

    // Ha ünnepnap, azonnal térjünk vissza üres értékkel
    if (this.calculator.isHoliday(year, month, day)) {
      return " ";
    }

    // UTC dátumokat használunk
    const startDate = new Date(Date.UTC(2025, 0, 6)); // 2025. január 6.
    const currentDate = new Date(Date.UTC(year, month, day));
    const daysDiff = getDaysBetween(startDate, currentDate);

    if (daysDiff < 0) {
      const negativeDaysDiff = Math.abs(daysDiff);
      const cycleLength = shiftCycle.length;
      const negativeIndex =
        (cycleLength - (negativeDaysDiff % cycleLength)) % cycleLength;
      return shiftCycle[negativeIndex];
    }

    return shiftCycle[daysDiff % shiftCycle.length];
  }

  generateBShiftPattern(year, month, day) {
    const shiftCycle = [
      "Nappal",
      "Nappal",
      " ",
      "Éjszaka",
      "Éjszaka",
      " ",
      " ",
      " ",
      " ",
      "Nappal",
      "Nappal",
      "Nappal",
      " ",
      " ",
      "Éjszaka",
      "Éjszaka",
      "Éjszaka",
      " ",
      " ",
      " ",
      " ",
    ];

    // Ha ünnepnap, azonnal térjünk vissza üres értékkel
    if (this.calculator.isHoliday(year, month, day)) {
      return " ";
    }

    const startDate = new Date(Date.UTC(2025, 0, 20)); // 2025. január 20.
    const currentDate = new Date(Date.UTC(year, month, day));
    const daysDiff = getDaysBetween(startDate, currentDate);

    if (daysDiff < 0) {
      const negativeDaysDiff = Math.abs(daysDiff);
      const cycleLength = shiftCycle.length;
      const negativeIndex =
        (cycleLength - (negativeDaysDiff % cycleLength)) % cycleLength;
      return shiftCycle[negativeIndex];
    }

    return shiftCycle[daysDiff % shiftCycle.length];
  }

  generateCShiftPattern(year, month, day) {
    const shiftCycle = [
      "Nappal",
      "Nappal",
      " ",
      "Éjszaka",
      "Éjszaka",
      " ",
      " ",
      " ",
      " ",
      "Nappal",
      "Nappal",
      "Nappal",
      " ",
      " ",
      "Éjszaka",
      "Éjszaka",
      "Éjszaka",
      " ",
      " ",
      " ",
      " ",
    ];

    // Ha ünnepnap, azonnal térjünk vissza üres értékkel
    if (this.calculator.isHoliday(year, month, day)) {
      return " ";
    }

    const startDate = new Date(Date.UTC(2025, 0, 13)); // 2025. január 13.
    const currentDate = new Date(Date.UTC(year, month, day));
    const daysDiff = getDaysBetween(startDate, currentDate);

    if (daysDiff < 0) {
      const negativeDaysDiff = Math.abs(daysDiff);
      const cycleLength = shiftCycle.length;
      const negativeIndex =
        (cycleLength - (negativeDaysDiff % cycleLength)) % cycleLength;
      return shiftCycle[negativeIndex];
    }

    return shiftCycle[daysDiff % shiftCycle.length];
  }

  generateClassicShiftPattern1(currentDate) {
    const utcDate = new Date(
      Date.UTC(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      )
    );
    const startDate = new Date(Date.UTC(2024, 0, 1));

    const daysFromStart = getDaysBetween(startDate, utcDate);
    const cycleDay = ((daysFromStart % 8) + 8) % 8;

    return [6, 7].includes(cycleDay)
      ? "Nappal"
      : [2, 3].includes(cycleDay)
      ? "Éjszaka"
      : " ";
  }

  generateClassicShiftPattern2(currentDate) {
    const utcDate = new Date(
      Date.UTC(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      )
    );
    const startDate = new Date(Date.UTC(2024, 0, 1));

    const daysFromStart = getDaysBetween(startDate, utcDate);
    const cycleDay = ((daysFromStart % 8) + 8) % 8;

    return [6, 7].includes(cycleDay)
      ? "Éjszaka"
      : [2, 3].includes(cycleDay)
      ? "Nappal"
      : " ";
  }

  generateClassicShiftPattern3(currentDate) {
    const utcDate = new Date(
      Date.UTC(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      )
    );
    const startDate = new Date(Date.UTC(2024, 0, 1));

    const daysFromStart = getDaysBetween(startDate, utcDate);
    const cycleDay = ((daysFromStart % 8) + 8) % 8;

    return [0, 1].includes(cycleDay)
      ? "Éjszaka"
      : [4, 5].includes(cycleDay)
      ? "Nappal"
      : " ";
  }

  generateClassicShiftPattern4(currentDate) {
    const utcDate = new Date(
      Date.UTC(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      )
    );
    const startDate = new Date(Date.UTC(2024, 0, 1));

    const daysFromStart = getDaysBetween(startDate, utcDate);
    const cycleDay = ((daysFromStart % 8) + 8) % 8;

    return [0, 1].includes(cycleDay)
      ? "Nappal"
      : [4, 5].includes(cycleDay)
      ? "Éjszaka"
      : " ";
  }

  initPayrollNavigation() {
    document
      .getElementById("prev-payroll-month-btn")
      .addEventListener("click", () => {
        this.changePayrollMonth(-1);
      });

    document
      .getElementById("next-payroll-month-btn")
      .addEventListener("click", () => {
        this.changePayrollMonth(1);
      });

    // Touch események a payroll szekcióhoz
    const payrollSection = document.getElementById("payroll-section");
    let startX = 0;
    let endX = 0;

    payrollSection.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    });

    payrollSection.addEventListener("touchend", (e) => {
      endX = e.changedTouches[0].clientX;
      this.handlePayrollSwipe(startX, endX);
    });
  }

  handlePayrollSwipe(startX, endX) {
    // Minimum elmozdulás érzékeléséhez
    const minSwipeDistance = 100;

    if (startX - endX > minSwipeDistance) {
      // Balra húzás - következő hónap
      this.changePayrollMonth(1);
    } else if (endX - startX > minSwipeDistance) {
      // Jobbra húzás - előző hónap
      this.changePayrollMonth(-1);
    }
  }

  initColorSettings() {
    const colorSettingsContainer = document.getElementById("color-settings");
    if (!colorSettingsContainer) return;

    // Színbeállítások generálása
    Object.entries(SHIFT_COLORS).forEach(([type, [bgColor, textColor]]) => {
      const row = this.createColorSettingRow(type, bgColor, textColor);
      colorSettingsContainer.appendChild(row);
    });

    this.updateColorPreviews();
  }

  createColorSettingRow(type, bgColor, textColor) {
    const row = document.createElement("div");
    row.className = "color-row";

    const preview = document.createElement("div");
    preview.className = `color-preview ${this.normalizeClassName(
      type
    )}-preview`;
    preview.textContent = type;

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "color-buttons";

    const bgButton = document.createElement("button");
    bgButton.className = "color-picker";
    bgButton.setAttribute("data-shift-type", type.toLowerCase());
    bgButton.setAttribute("data-color-type", "bg");
    bgButton.textContent = "Háttérszín";

    const textButton = document.createElement("button");
    textButton.className = "color-picker";
    textButton.setAttribute("data-shift-type", type.toLowerCase());
    textButton.setAttribute("data-color-type", "text");
    textButton.textContent = "Szövegszín";

    buttonsContainer.appendChild(bgButton);
    buttonsContainer.appendChild(textButton);

    row.appendChild(preview);
    row.appendChild(buttonsContainer);

    return row;
  }

  handleColorChange(key, colorType, newColor) {
    if (colorType === "bg") {
      SHIFT_COLORS[key][0] = newColor;
    } else {
      SHIFT_COLORS[key][1] = newColor;
    }
    this.updateColorPreviews();
    this.generateCalendar();
    this.saveColorSettings();
  }

  createColorButton(shiftType, colorType, label) {
    const button = document.createElement("button");
    button.className = "color-picker";
    button.setAttribute("data-shift-type", shiftType.toLowerCase());
    button.setAttribute("data-color-type", colorType);
    button.textContent = label;

    button.addEventListener("click", (e) => this.handleColorPickerClick(e));
    return button;
  }

  normalizeClassName(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  handleColorPickerClick(event) {
    event.preventDefault();
    const button = event.target;
    const shiftType = button.getAttribute("data-shift-type");
    const colorType = button.getAttribute("data-color-type");
    const key = Object.keys(SHIFT_COLORS).find(
      (k) =>
        k
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") ===
        shiftType
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
    );

    if (!key) return;

    // Viewport méretek és modal méretek számítása
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalWidth = Math.round(viewportWidth * 0.8);
    const modalHeight = Math.round(viewportHeight * 0.8);

    // A canvasSize most már nagyobb, a modal méretének 95%-a
    const canvasSize = Math.round(Math.min(modalWidth * 1, modalHeight * 0.9));

    // Overlay létrehozása
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    // Modal létrehozása
    const modal = document.createElement("div");
    modal.style.backgroundColor = "#333";
    modal.style.padding = "15px"; // csökkentett padding
    modal.style.borderRadius = "10px";
    modal.style.width = "modalWidth";
    modal.style.height = "modalHeight";
    modal.style.boxSizing = "border-box";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.alignItems = "center";
    modal.style.gap = "8px"; // kisebb gap az elemek között
    modal.style.overflow = "hidden";

    // Színválasztó canvas
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.cursor = "crosshair";

    // Canvas konténer
    const canvasContainer = document.createElement("div");
    canvasContainer.style.position = "relative";
    canvasContainer.style.width = canvasSize + "px";
    canvasContainer.style.height = canvasSize + "px";
    canvasContainer.style.margin = "0"; // nincs margin

    // Kör jelző
    const colorSelector = document.createElement("div");
    colorSelector.style.position = "absolute";
    colorSelector.style.width = "10px";
    colorSelector.style.height = "10px";
    colorSelector.style.border = "2px solid white";
    colorSelector.style.borderRadius = "50%";
    colorSelector.style.pointerEvents = "none";
    colorSelector.style.transform = "translate(-50%, -50%)";
    colorSelector.style.boxShadow = "0 0 0 1px black";

    canvasContainer.appendChild(canvas);
    canvasContainer.appendChild(colorSelector);

    // Színsáv konténer
    const hueContainer = document.createElement("div");
    hueContainer.style.position = "relative";
    hueContainer.style.width = canvasSize + "px";
    hueContainer.style.height = "40px";
    hueContainer.style.margin = "5px 0"; // kisebb margin

    // Színsáv létrehozása - a szélesség ugyanakkora mint a fő canvas
    const hueCanvas = document.createElement("canvas");
    hueCanvas.width = canvasSize;
    hueCanvas.height = 40; // magasabb, hogy jobban látható legyen
    hueCanvas.style.cursor = "pointer";

    // Színsáv csúszka
    const hueSlider = document.createElement("div");
    hueSlider.style.position = "absolute";
    hueSlider.style.top = "0";
    hueSlider.style.width = "4px";
    hueSlider.style.height = "40px";
    hueSlider.style.backgroundColor = "white";
    hueSlider.style.border = "1px solid black";
    hueSlider.style.pointerEvents = "none";
    hueSlider.style.transform = "translateX(-50%)";

    hueContainer.appendChild(hueCanvas);
    hueContainer.appendChild(hueSlider);

    // RGB kijelző
    const rgbDisplay = document.createElement("div");
    rgbDisplay.style.backgroundColor = "#222";
    rgbDisplay.style.padding = "5px"; // nagyobb padding
    rgbDisplay.style.borderRadius = "5px";
    rgbDisplay.style.color = "white";
    rgbDisplay.style.fontFamily = "monospace";
    rgbDisplay.style.fontSize = "14px"; // nagyobb betűméret
    rgbDisplay.style.textAlign = "center";
    rgbDisplay.style.width = "100%";
    rgbDisplay.style.maxWidth = canvasSize + "px";
    rgbDisplay.style.marginTop = "5px";

    // Előnézeti panel
    const colorPreview = document.createElement("div");
    colorPreview.style.width = "100%";
    colorPreview.style.maxWidth = canvasSize + "px";
    colorPreview.style.height = "40px"; // magasabb előnézeti panel
    colorPreview.style.border = "2px solid #444";
    colorPreview.style.borderRadius = "5px";

    let currentHue = 0;
    let currentPos = { x: 0, y: 0 };
    let isDragging = false;
    let isHueDragging = false;
    let currentColor =
      colorType === "bg" ? SHIFT_COLORS[key][0] : SHIFT_COLORS[key][1];
    colorPreview.style.backgroundColor = currentColor;

    // Kontextek létrehozása
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const hueCtx = hueCanvas.getContext("2d", { willReadFrequently: true });

    // Színsáv rajzolása
    const drawHueBar = () => {
      const gradient = hueCtx.createLinearGradient(0, 0, hueCanvas.width, 0);
      for (let i = 0; i <= 360; i += 30) {
        gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
      }
      hueCtx.fillStyle = gradient;
      hueCtx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
    };

    // Színspektrum rajzolása
    const drawSpectrum = (hue) => {
      const validHue = isNaN(hue) || hue === undefined ? 0 : Math.max(0, Math.min(360, hue));
      const pureColor = `hsl(${validHue}, 100%, 50%)`;

      const whiteGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      whiteGrad.addColorStop(0, "rgb(255,255,255)");
      whiteGrad.addColorStop(1, pureColor);
      ctx.fillStyle = whiteGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const blackGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      blackGrad.addColorStop(0, "rgba(0,0,0,0)");
      blackGrad.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = blackGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const validateRGB = (r, g, b) => {
      return {
        r: Math.max(0, Math.min(255, Math.round(r))),
        g: Math.max(0, Math.min(255, Math.round(g))),
        b: Math.max(0, Math.min(255, Math.round(b))),
      };
    };

    const updateColor = (x, y) => {
      x = Math.max(0, Math.min(x, canvas.width - 1));
      y = Math.max(0, Math.min(y, canvas.height - 1));

      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const rgb = validateRGB(pixel[0], pixel[1], pixel[2]);

      currentColor = `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g
        .toString(16)
        .padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
      rgbDisplay.textContent = `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`;
      colorPreview.style.backgroundColor = currentColor;

      colorSelector.style.left = `${x}px`;
      colorSelector.style.top = `${y}px`;
      currentPos = { x, y };
    };

    const updateHue = (x) => {
      x = Math.max(0, Math.min(x, hueCanvas.width));
      currentHue = isNaN(x) ? 0 : (x / hueCanvas.width) * 360;
      currentHue = Math.max(0, Math.min(360, currentHue));
      drawSpectrum(currentHue);
      hueSlider.style.left = `${x}px`;
      if (currentPos.x !== undefined && currentPos.y !== undefined) {
        updateColor(currentPos.x, currentPos.y);
      }
    };

    const handleHueSelect = (e) => {
      const rect = hueCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, hueCanvas.width));
      updateHue(x);
    };

    const handleColorSelect = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, canvas.width - 1));
      const y = Math.max(0, Math.min(e.clientY - rect.top, canvas.height - 1));
      updateColor(x, y);
    };

    // Mouse események
    canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isDragging = true;
      handleColorSelect(e);
    });

    hueCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isHueDragging = true;
      handleHueSelect(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) handleColorSelect(e);
      if (isHueDragging) handleHueSelect(e);
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      isHueDragging = false;
    });

    // Touch események
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      isDragging = true;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(touch.clientX - rect.left, canvas.width - 1)
      );
      const y = Math.max(
        0,
        Math.min(touch.clientY - rect.top, canvas.height - 1)
      );
      updateColor(x, y);
    });

    hueCanvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      isHueDragging = true;
      const touch = e.touches[0];
      handleHueSelect(touch);
    });

    document.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(touch.clientX - rect.left, canvas.width - 1)
        );
        const y = Math.max(
          0,
          Math.min(touch.clientY - rect.top, canvas.height - 1)
        );
        updateColor(x, y);
      }
      if (isHueDragging) {
        handleHueSelect(touch);
      }
    });

    document.addEventListener("touchend", () => {
      isDragging = false;
      isHueDragging = false;
    });

    // Gombok
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.height = "70px";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.width = canvasSize + "px";
    buttonContainer.style.marginTop = "5px";

    const saveButton = document.createElement("button");
    saveButton.textContent = "Mentés";
    saveButton.style.flex = "1";
    saveButton.style.padding = "10px";
    saveButton.style.fontSize = "25px";
    saveButton.style.backgroundColor = "#4CAF50";
    saveButton.style.color = "white";
    saveButton.style.border = "none";
    saveButton.style.borderRadius = "5px";
    saveButton.style.cursor = "pointer";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Mégse";
    cancelButton.style.flex = "1";
    cancelButton.style.padding = "10px";
    cancelButton.style.fontSize = "25px";
    cancelButton.style.backgroundColor = "#f44336";
    cancelButton.style.color = "white";
    cancelButton.style.border = "none";
    cancelButton.style.borderRadius = "5px";
    cancelButton.style.cursor = "pointer";

    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);

    // Modal összeállítása
    modal.appendChild(canvasContainer);
    modal.appendChild(hueContainer);
    modal.appendChild(rgbDisplay);
    modal.appendChild(colorPreview);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Kezdeti állapot beállítása
    drawHueBar();
    drawSpectrum(currentHue);

    // Kezdeti szín beállítása
    const setInitialPosition = () => {
      const r = parseInt(currentColor.slice(1, 3), 16);
      const g = parseInt(currentColor.slice(3, 5), 16);
      const b = parseInt(currentColor.slice(5, 7), 16);

      let minDiff = Infinity;
      let bestX = 0;
      let bestY = 0;

      for (let x = 0; x < canvas.width; x += 5) {
        for (let y = 0; y < canvas.height; y += 5) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const diff =
            Math.abs(pixel[0] - r) +
            Math.abs(pixel[1] - g) +
            Math.abs(pixel[2] - b);
          if (diff < minDiff) {
            minDiff = diff;
            bestX = x;
            bestY = y;
          }
        }
      }

      const hsl = rgbToHsl(r, g, b);
      const hueX = (hsl.h / 360) * hueCanvas.width;
      updateHue(hueX);
      updateColor(bestX, bestY);
    };

    // RGB to HSL konvertáló
    const rgbToHsl = (r, g, b) => {
      r /= 255;
      g /= 255;
      b /= 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h,
        s,
        l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }

        h = Math.round(h * 60);
        if (h < 0) h += 360;
      }

      return { h, s, l };
    };

    // Gomb események
    saveButton.addEventListener("click", () => {
      if (colorType === "bg") {
        SHIFT_COLORS[key][0] = currentColor;
      } else {
        SHIFT_COLORS[key][1] = currentColor;
      }
      this.updateColorPreviews();
      this.generateCalendar();
      this.saveColorSettings();
      document.body.removeChild(overlay);
    });

    cancelButton.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });

    // Overlay bezárása kattintásra
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // Késleltetett kezdeti pozíció beállítás
    setTimeout(setInitialPosition, 50);
  }

  generatePayrollTable() {
    try {
      // Ellenőrizzük és inicializáljuk az adott év adatait
      if (!this.yearlyData[this.currentPayrollYear]) {
        this.yearlyData[this.currentPayrollYear] = {
          settings: {
            besorolasi_ber: "300000",
            szabadsag: "25",
            muszakrend: "-",
            other_income: "0",
            children_count: "0",
            under25: {
              enabled: false,
              birthYear: "",
              birthMonth: "",
            },
            midyear_changes: [],
          },
          calendar_data: {},
          bonusEntries: {},
          restaurantEntries: {},
        egyebJovedelmEntries: {},
        };
      }

      // Ha nincs még calendar_data az adott hónapra, inicializáljuk
      if (
        !this.yearlyData[this.currentPayrollYear].calendar_data[
          this.currentPayrollMonth
        ]
      ) {
        this.yearlyData[this.currentPayrollYear].calendar_data[
          this.currentPayrollMonth
        ] = {};
        // Generáljuk ki a műszakrendet
        const daysInMonth = new Date(
          this.currentPayrollYear,
          this.currentPayrollMonth + 1,
          0
        ).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const shiftValue = this.generateShiftPattern(day);
          if (shiftValue !== " ") {
            this.yearlyData[this.currentPayrollYear].calendar_data[
              this.currentPayrollMonth
            ][day] = shiftValue;
          }
        }
        this.saveYearlyData();
      }

      const payrollBody = document.getElementById("payroll-body");
      const currentPayrollMonthElement = document.getElementById(
        "current-payroll-month"
      );

      const months = [
        "JANUÁR",
        "FEBRUÁR",
        "MÁRCIUS",
        "ÁPRILIS",
        "MÁJUS",
        "JÚNIUS",
        "JÚLIUS",
        "AUGUSZTUS",
        "SZEPTEMBER",
        "OKTÓBER",
        "NOVEMBER",
        "DECEMBER",
      ];

      currentPayrollMonthElement.textContent = `${
        months[this.currentPayrollMonth]
      } ${this.currentPayrollYear}`;

      payrollBody.innerHTML = "";

      // Tételek és utótagok definíciója
      const items = [
        { label: "Ledolgozandó napok", suffix: " nap" },
        { label: "Ledolgozott napok", suffix: " nap" },
        { label: "Szabadság kivét (óra)", suffix: " óra" },
        { label: "Túlóra (100%)", suffix: " óra" },
        { label: "Hétvégi pótlék 50%", suffix: " óra" },
        { label: "Műszakpótlék 40%", suffix: " óra" },
        { label: "Alapbér", suffix: " Ft" },
        { label: "Túlóra alap", suffix: " Ft" },
        { label: "Szabadságra jutó fizetés", suffix: " Ft" },
        { label: "Távolléti díj", suffix: " Ft" },
        { label: "Betegszabadságra jutó fizetés", suffix: " Ft" },
        { label: "Táppénz ellátás (60%)", suffix: " Ft" },
        { label: "Fizetett ünnepnap", suffix: " Ft" },
        { label: "Túlórapótlék", suffix: " Ft" },
        { label: "Hétvégi pótlék (50%)", suffix: " Ft" },
        { label: "Műszakpótlék (40%)", suffix: " Ft" },
        { label: "Teljesítmény prémium", suffix: " Ft" },
        { label: "Bónusz", suffix: "" },
        { label: "Éttermi fogyasztás", suffix: " Ft" },
        { label: "Egyéb jövedelem", suffix: " Ft" },
        { label: "Bruttó bér", suffix: " Ft" },
        { label: "TB Járulék 18,5%", suffix: " Ft" },
        { label: "Rendszeres SZJA előleg", suffix: " Ft" },
        { label: "Családi adókedvezmény", suffix: " Ft" },
        { label: "Nettó", suffix: " Ft" },
        { label: "Megmaradt szabadságok", suffix: " nap" },
      ];

      items.forEach((item) => {
        const row = document.createElement("tr");
        const labelCell = document.createElement("td");
        const valueCell = document.createElement("td");

        labelCell.textContent = item.label;

        if (item.label === "Bónusz") {
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.max = "2";
          input.step = "1";
          input.className = "w-24 text-right px-2 py-1 border rounded";

          const value =
            this.yearlyData[this.currentPayrollYear].bonusEntries?.[
              this.currentPayrollMonth
            ] ?? 2;
          input.value = value;
          valueCell.appendChild(input);

          input.addEventListener("change", (e) => {
            window.validateBonus(e.target, this.currentPayrollMonth);
          });
          input.addEventListener("input", (e) => {
            window.validateBonus(e.target, this.currentPayrollMonth);
          });
        } else if (item.label === "Éttermi fogyasztás") {
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.step = "1";
          input.className = "w-24 text-right px-2 py-1 border rounded";

          const value =
            this.yearlyData[this.currentPayrollYear].restaurantEntries?.[
              this.currentPayrollMonth
            ] || 0;
          input.value = value;
          valueCell.appendChild(input);

          input.addEventListener("change", (e) => {
            window.validateRestaurant(e.target, this.currentPayrollMonth);
          });
          input.addEventListener("input", (e) => {
            window.validateRestaurant(e.target, this.currentPayrollMonth);
          });
        } else if (item.label === "Egyéb jövedelem") {
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.step = "1";
          input.className = "w-24 text-right px-2 py-1 border rounded";

          const value =
            this.yearlyData[this.currentPayrollYear].egyebJovedelmEntries?.[
              this.currentPayrollMonth
            ] || 0;
          input.value = value;
          valueCell.appendChild(input);

          input.addEventListener("change", (e) => {
            window.validateEgyebJovedelem(e.target, this.currentPayrollMonth);
          });
          input.addEventListener("input", (e) => {
            window.validateEgyebJovedelem(e.target, this.currentPayrollMonth);
          });
        } else {
          // Normál értékek megjelenítése utótaggal
          const value = this.calculator.calculateMonthlyValue(
            item.label,
            this.currentPayrollMonth,
            this.currentPayrollYear
          );

          // Érték formázása a típus szerint
          let formattedValue;
            if (item.suffix === " nap" || item.suffix === " óra") {
              // Órák és napok: 1 tizedesjegy
              formattedValue = parseFloat(value).toFixed(1);
            } else if (item.suffix === " Ft") {
              // Pénzösszegek: kerekítés
              formattedValue = Math.round(value);
            } else {
              formattedValue = Math.round(value);
            }

          // Ezres tagolás hozzáadása és utótag
          valueCell.textContent =
            formattedValue !== 0
              ? formattedValue.toLocaleString("hu-HU") + item.suffix
              : "0" + item.suffix;
        }

        row.appendChild(labelCell);
        row.appendChild(valueCell);
        payrollBody.appendChild(row);
      });
    } catch (error) {
      console.error("Hiba a bérszámfejtési táblázat generálása során:", error);
    }
  }

  loadData() {
    try {
      const savedData = localStorage.getItem("berszamfejtoData");

      if (savedData) {
        const parsedData = JSON.parse(savedData);

        // Az adatok visszatöltése a yearData objektumba
        this.yearData = {
          calendar_data: parsedData.calendar_data || {},
          bonusEntries: parsedData.bonusEntries || {},
          restaurantEntries: parsedData.restaurantEntries || {},
          settings: {
            besorolasi_ber: this.settings.baseSalary?.toString() || "300000",
            szabadsag: this.settings.vacationDays?.toString() || "25",
            muszakrend: this.settings.shiftPattern || "-",
          },
        };
      }
    } catch (error) {
      console.error("Hiba az adatok betöltése során:", error);
    }
  }

  updateColorPreviews() {
    Object.entries(SHIFT_COLORS).forEach(([type, [bgColor, textColor]]) => {
      // Normalizáljuk a class nevet (ékezetek eltávolítása)
      const previewClass =
        type
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") + "-preview";

      const preview = document.querySelector(`.${previewClass}`);
      if (preview) {
        preview.style.backgroundColor = bgColor;
        preview.style.color = textColor;
        preview.textContent = type;
      }
    });
  }

  saveColorSettings() {
    localStorage.setItem("shiftColors", JSON.stringify(SHIFT_COLORS));
  }

  loadColorSettings() {
    const savedColors = localStorage.getItem("shiftColors");
    if (savedColors) {
      const parsedColors = JSON.parse(savedColors);
      Object.entries(parsedColors).forEach(([key, value]) => {
        if (SHIFT_COLORS[key]) {
          SHIFT_COLORS[key] = value;
        }
      });
      this.updateColorPreviews();
    }
  }

  saveSettings() {
    try {
      const shiftPatternSelect = document.getElementById(
        "shift-pattern-select"
      );
      const baseSalaryInput = document.getElementById("base-salary");
      const vacationDaysInput = document.getElementById("vacation-days");
      const otherIncomeInput = document.getElementById("other-income");
      const under25Checkbox = document.getElementById("under25-checkbox");
      const birthYearInput = document.getElementById("birth-year");
      const birthMonthInput = document.getElementById("birth-month");
      const currentMonth = this.currentMonth;
      const childrenCountInput = document.getElementById("children-count");

      if (!shiftPatternSelect || !baseSalaryInput) {
        throw new Error("Hiányzó form elemek");
      }

      // Az előző műszakrend lekérése az összehasonlításhoz
      const oldShiftPattern =
        this.yearlyData[this.currentSettingsYear]?.settings?.muszakrend || "-";
      const newShiftPattern = shiftPatternSelect.value;
      const shiftPatternChanged = oldShiftPattern !== newShiftPattern;

      // A beállítások frissítése az aktuális évre
      if (!this.yearlyData[this.currentSettingsYear]) {
        this.yearlyData[this.currentSettingsYear] = {
          settings: {
            besorolasi_ber: "300000",
            szabadsag: "25",
            muszakrend: "-",
            other_income: "0",
            children_count: "0",
            under25: {
              enabled: false,
              birthYear: "",
              birthMonth: "",
            },
            midyear_changes: [],
          },
          calendar_data: {},
          bonusEntries: {},
          restaurantEntries: {},
        egyebJovedelmEntries: {},
        };
      }

      // A beállítások mentése
      const realSalaryInput = document.getElementById("real-salary");
      this.yearlyData[this.currentSettingsYear].settings = {
        ...this.yearlyData[this.currentSettingsYear].settings,
        besorolasi_ber: realSalaryInput
          ? realSalaryInput.value
          : baseSalaryInput.value,
        szabadsag: vacationDaysInput?.value || "25",
        muszakrend: newShiftPattern,
        other_income: otherIncomeInput?.value || "0",
        children_count: childrenCountInput?.value || "0",
        under25: {
          enabled: under25Checkbox?.checked || false,
          birthYear: birthYearInput?.value || "",
          birthMonth: birthMonthInput?.value || "",
        },
      };

      // Csak akkor generáljuk újra a naptárat, ha változott a műszakrend
      if (shiftPatternChanged) {
        const year = this.currentSettingsYear;

        // Ha változott a műszakrend, teljesen új calendar_data-t hozunk létre
        this.yearlyData[year].calendar_data = {};

        // Új naptár generálása minden hónapra
        for (let month = 0; month < 12; month++) {
          this.yearlyData[year].calendar_data[month] = {};

          const daysInMonth = new Date(year, month + 1, 0).getDate();
          for (let day = 1; day <= daysInMonth; day++) {
            const previousYear = this.currentYear;
            this.currentYear = year;
            this.currentMonth = month;

            const shiftValue = this.generateShiftPattern(day);

            this.currentYear = previousYear;
            this.currentMonth = this.currentMonth;

            if (shiftValue !== " ") {
              this.yearlyData[year].calendar_data[month][day] = shiftValue;
            }
          }
        }
      }

      // Adatok mentése
      this.saveYearlyData();

      // Naptár és bérszámfejtés frissítése
      this.currentMonth = currentMonth;
      this.generateCalendar();
      this.generatePayrollTable();
    } catch (error) {
      console.error("Hiba a beállítások mentése során:", error);
      alert("Hiba történt a beállítások mentése során!");
    }
  }
}

// Service Worker regisztrálása és PWA telepítés kezelése
let deferredPrompt;

// Központi telepítési modal létrehozása (Android Chrome, Desktop)
function createInstallModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "install-modal-overlay";
  modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;

  const modal = document.createElement("div");
  modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        max-width: 90%;
        width: 400px;
        text-align: center;
        animation: slideIn 0.3s ease;
    `;

  modal.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 48px; margin-bottom: 15px;">📱</div>
            <h2 style="margin: 0 0 15px 0; color: #333; font-size: 24px;">Alkalmazás telepítés</h2>
            <p style="margin: 0; color: #666; font-size: 16px; line-height: 1.5;">
                Szeretnéd telepíteni az alkalmazást az eszközödre?
            </p>
        </div>
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="install-yes-btn" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: background 0.3s ease;
                flex: 1;
                max-width: 120px;
            ">Igen</button>
            <button id="install-no-btn" style="
                background: #f44336;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: background 0.3s ease;
                flex: 1;
                max-width: 120px;
            ">Nem</button>
        </div>
    `;

  // Animációk hozzáadása
  const style = document.createElement("style");
  style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateY(-50px) scale(0.9);
            }
            to { 
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        #install-yes-btn:hover {
            background: #45a049 !important;
        }
        #install-no-btn:hover {
            background: #da190b !important;
        }
    `;
  document.head.appendChild(style);

  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);

  // Eseménykezelők
  document.getElementById("install-yes-btn").addEventListener("click", () => {
    installApp();
    closeInstallModal();
    markInstallPromptShown();
  });

  document.getElementById("install-no-btn").addEventListener("click", () => {
    closeInstallModal();
    markInstallPromptShown(); // Megjelöljük, hogy látta és elutasította
  });

  return modalOverlay;
}

// iOS Safari telepítési útmutató
function showIOSInstallInstructions() {
  const overlay = document.createElement("div");
  overlay.id = "ios-install-overlay";
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;

  const modal = document.createElement("div");
  modal.style.cssText = `
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        max-width: 90%;
        width: 350px;
        text-align: center;
        animation: slideIn 0.3s ease;
    `;

  modal.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 48px; margin-bottom: 15px;">📱</div>
            <h2 style="margin: 0 0 15px 0; color: #333; font-size: 20px;">Telepítsd az alkalmazást!</h2>
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.5;">
                Kövesd ezeket a lépéseket a kezdőképernyőre telepítéshez:
            </p>
        </div>
        
        <div style="text-align: left; margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="background: #007AFF; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px;">1</span>
                <span style="font-size: 14px;">Nyomd meg a <strong>Megosztás</strong> gombot</span>
                <span style="font-size: 20px; margin-left: 10px;">□↗️</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="background: #007AFF; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px;">2</span>
                <span style="font-size: 14px;">Válaszd ki: <strong>"Hozzáadás a kezdőképernyőhöz"</strong></span>
                <span style="font-size: 16px; margin-left: 10px;">📱➕</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span style="background: #007AFF; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px;">3</span>
                <span style="font-size: 14px;">Nyomd meg a <strong>"Hozzáadás"</strong> gombot</span>
                <span style="font-size: 16px; margin-left: 10px;">✅</span>
            </div>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="ios-install-ok-btn" style="
                background: #007AFF;
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
                width: 100%;
            ">Értettem</button>
        </div>
    `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Eseménykezelő - mindegy mit nyom, megjelöljük hogy látta
  document
    .getElementById("ios-install-ok-btn")
    .addEventListener("click", () => {
      markInstallPromptShown();
      document.body.removeChild(overlay);
    });

  // Overlay kattintás - szintén megjelöljük
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      markInstallPromptShown();
      document.body.removeChild(overlay);
    }
  });
}

// Modal bezárása
function closeInstallModal() {
  const modal = document.getElementById("install-modal-overlay");
  if (modal) {
    modal.style.animation = "fadeOut 0.3s ease";
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// Accordion toggle funkció
function toggleAccordion(section) {
  const content = document.getElementById(section + "-content");
  const arrow = document.getElementById(section + "-arrow");

  if (content.style.display === "none" || content.style.display === "") {
    // Megnyitás
    content.style.display = "block";
    arrow.style.transform = "rotate(180deg)";
    arrow.textContent = "▲";

    // Smooth scroll a megnyitott szekcióhoz
    setTimeout(() => {
      content.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);
  } else {
    // Bezárás
    content.style.display = "none";
    arrow.style.transform = "rotate(0deg)";
    arrow.textContent = "▼";
  }
}

// Összes adat törlése funkció
function clearAllUserData() {
  if (
    confirm(
      "⚠️ FIGYELEM!\n\nBiztosan törölni szeretnéd az ÖSSZES mentett adatot?\n\nEz törli:\n• Összes naptáradatot\n• Beállításokat\n• Bónusz adatokat\n• Minden egyéb mentett információt\n\nEz a művelet VISSZAVONHATATLAN!"
    )
  ) {
    try {
      // LocalStorage teljes törlése
      localStorage.clear();

      // SessionStorage is
      sessionStorage.clear();

      // Cache törlése
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
          });
        });
      }

      alert("✅ Minden adat sikeresen törölve!\n\nAz oldal újra fog töltődni.");

      // Oldal újratöltése
      window.location.reload();
    } catch (error) {
      console.error("Hiba az adatok törlése során:", error);
      alert(
        "❌ Hiba történt az adatok törlése során.\n\nPróbáld meg manuálisan törölni a böngésző cache-ét és cookie-jait."
      );
    }
  }
}

function toggleTheme() {
    const checkbox = document.getElementById('theme-checkbox');
    const body = document.body;
    const newTheme = checkbox.checked ? 'dark' : 'light';
    
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (window.app && window.app.generateCalendar) {
        window.app.generateCalendar();
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const checkbox = document.getElementById('theme-checkbox');
    
    document.body.setAttribute('data-theme', savedTheme);
    if (checkbox) checkbox.checked = savedTheme === 'dark';
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    
    if (icon && text) {
        if (theme === 'dark') {
            icon.textContent = '☀️';
            text.textContent = 'Világos';
        } else {
            icon.textContent = '🌙';
            text.textContent = 'Sötét';
        }
    }
}

// Copyright konzol üzenet
console.log(`
🧮 Műszak Naptár & Bérszámfejtő
👨‍💻 Készítette: [B.V.] © 2025
🔒 Proprietárius szoftver - Minden jog fenntartva
🆓 Ingyenes használat: muszaknaptar.hu
⚠️ Tájékoztató jellegű - nem hivatalos bérszámfejtés
`);

// Telepítés funkció
async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("Felhasználó elfogadta a telepítést");
    } else {
      console.log("Felhasználó elutasította a telepítést");
    }
    deferredPrompt = null;
  }
}

// Ellenőrzi, hogy már megjelent-e a telepítési prompt
function hasInstallPromptBeenShown() {
  return localStorage.getItem("installPromptShown") === "true";
}

// Megjelöli, hogy már megjelent a telepítési prompt
function markInstallPromptShown() {
  localStorage.setItem("installPromptShown", "true");
}

// Telepítési modal megjelenítése
function showInstallModal() {
  // Ellenőrizzük, hogy iOS Safari-ban vagyunk-e
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isInStandaloneMode =
    "standalone" in window.navigator && window.navigator.standalone;

  if (isIOS && isSafari && !isInStandaloneMode) {
    // iOS Safari esetén az útmutatót mutatjuk
    if (!hasInstallPromptBeenShown()) {
      setTimeout(() => {
        showIOSInstallInstructions();
      }, 1000);
    }
  } else {
    // Egyéb böngészők esetén az eredeti modal
    if (
      !hasInstallPromptBeenShown() &&
      !window.matchMedia("(display-mode: standalone)").matches
    ) {
      setTimeout(() => {
        createInstallModal();
      }, 1000);
    }
  }
}

// Telepítési eseménykezelő
window.addEventListener("beforeinstallprompt", (e) => {
  console.log("PWA telepítési prompt elérhető");
  e.preventDefault();
  deferredPrompt = e;

  // Modal megjelenítése
  showInstallModal();
});

// Ellenőrizzük, hogy már telepítve van-e
window.addEventListener("appinstalled", () => {
  console.log("PWA sikeresen telepítve");
  closeInstallModal();
  deferredPrompt = null;
});

function showUpdateOverlay(worker) {
  if (document.getElementById("update-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "update-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "99999",
    background: "transparent",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  });

  document.body.appendChild(overlay);

  const doUpdate = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Biztonsági mentés frissítés előtt
    try {
      const currentData = localStorage.getItem("berszamfejtoYearlyData");
      if (currentData) {
        const parsed = JSON.parse(currentData);
        const hasRealData = Object.values(parsed).some(yearObj =>
          yearObj?.calendar_data &&
          Object.keys(yearObj.calendar_data).length > 0
        );
        if (hasRealData) {
          localStorage.setItem("berszamfejtoBackup", currentData);
          localStorage.setItem("berszamfejtoBackupDate", new Date().toISOString());
        }
      }
    } catch (err) {
      // Ha a mentés hibás, nem akadályozza meg a frissítést
    }

    overlay.remove();
    worker.postMessage({ type: "SKIP_WAITING" });
  };

  // Mobil: touchstart, desktop: mousedown
  overlay.addEventListener("touchstart", doUpdate, { once: true, passive: false });
  overlay.addEventListener("mousedown", doUpdate, { once: true });
}

// ─── Service Worker regisztrálása ────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then((registration) => {
        console.log("ServiceWorker regisztrálva");

        // Ha az oldal betöltésekor már vár egy új SW (pl. tab újranyitás)
        if (registration.waiting) {
          showUpdateOverlay(registration.waiting);
        }

        // Ha a háttérben új SW települ
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateOverlay(newWorker);
            }
          });
        });

        // iOS install prompt
        if (
          !hasInstallPromptBeenShown() &&
          !window.matchMedia("(display-mode: standalone)").matches
        ) {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          const isInStandaloneMode =
            "standalone" in window.navigator && window.navigator.standalone;

          if (isIOS && isSafari && !isInStandaloneMode) {
            setTimeout(() => {
              showIOSInstallInstructions();
            }, 2000);
          }
        }
      })
      .catch((error) => {
        console.log("ServiceWorker regisztrálási hiba:", error);
      });

    // Ha a SW átvette az irányítást (skipWaiting után) → újratöltés
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

// ─── Globális függvények ──────────────────────────────────────────────────────
window.installApp = installApp;
window.toggleTheme = toggleTheme;
window.loadTheme = loadTheme;

document.addEventListener("DOMContentLoaded", () => {
  window.app = new BerszamfejtoApp();
});