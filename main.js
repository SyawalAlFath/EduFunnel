let appData = null;
let monthlyChart = null;

let currentPage = "overview";
let currentChannel = "all";
let currentDateRange = "year";
let activeDataSource = "none";
let dailyAggregationCache = null;

const CHANNEL_TRAFFIC_KEYS = {
  "Instagram Ads": "instagram",
  "Facebook Ads": "facebook",
  "Google Search Ads": "google_ads"
};

/* ================= ELEMENTS ================= */
const registerPage = document.getElementById("registerPage");
const loginPage = document.getElementById("loginPage");
const dashboardPage = document.getElementById("dashboardPage");
const app = document.getElementById("app");

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");

const goToLogin = document.getElementById("goToLogin");
const goToRegister = document.getElementById("goToRegister");
const logoutButton = document.getElementById("logoutButton");

const channelFilter = document.getElementById("channelFilter");
const dateFilter = document.getElementById("dateFilter");

/* ================= PAGE SWITCHING ================= */
function showRegisterPage() {
  registerPage.classList.remove("hidden");
  loginPage.classList.add("hidden");
  dashboardPage.classList.add("hidden");
}

function showLoginPage() {
  registerPage.classList.add("hidden");
  loginPage.classList.remove("hidden");
  dashboardPage.classList.add("hidden");
}

function showDashboardPage() {
  registerPage.classList.add("hidden");
  loginPage.classList.add("hidden");
  dashboardPage.classList.remove("hidden");

  fetchEduFunnelData();
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;

  if (isLoading) {
    button.dataset.defaultText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.defaultText || button.textContent;
  button.disabled = false;
}

/* ================= AUTH ================= */
goToLogin.addEventListener("click", showLoginPage);
goToRegister.addEventListener("click", showRegisterPage);

registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const submitButton = registerForm.querySelector("button[type='submit']");

  if (password !== confirmPassword) {
    alert("Password dan Confirm Password tidak sama.");
    return;
  }

  try {
    setButtonLoading(submitButton, true, "Creating...");

    const response = await fetch("auth.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "register",
        full_name: name,
        email: email,
        password: password
      }),
      credentials: "same-origin"
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Registrasi gagal.");
    }

    registerForm.reset();

    alert("Akun berhasil dibuat. Silakan login.");
    showLoginPage();

  } catch (error) {
    console.error("Gagal membuat akun:", error);
    alert(error.message || "Akun gagal dibuat.");
  } finally {
    setButtonLoading(submitButton, false);
  }
});



loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const submitButton = loginForm.querySelector("button[type='submit']");

  try {
    setButtonLoading(submitButton, true, "Signing in...");

    const response = await fetch("auth.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "login",
        email: email,
        password: password
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Login gagal.");
    }

    loginForm.reset();
    showDashboardPage();

  } catch (error) {
    console.error("Gagal login:", error);
    alert(error.message || "Email atau password salah.");
  } finally {
    setButtonLoading(submitButton, false);
  }
});

logoutButton.addEventListener("click", async function () {
  try {
    const response = await fetch("auth.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "logout"
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Logout gagal.");
    }

    showLoginPage();

  } catch (error) {
    console.error("Gagal logout:", error);
    alert("Terjadi kesalahan saat logout. Silakan coba lagi.");
  }
});


/* ================= FETCH DATA ================= */
function getLocalEduFunnelData() {
  if (!window.eduFunnelData) return null;

  return JSON.parse(JSON.stringify(window.eduFunnelData));
}

function validateEduFunnelData(data) {
  return data && Array.isArray(data.sources);
}

function mapMySQLData(summaryRow, sourcesRows, trafficRows, dailyRows) {
  const number = function (value) {
    return Number(value || 0);
  };

  const safeSummary = summaryRow || {};
  const safeSources = Array.isArray(sourcesRows) ? sourcesRows : [];
  const safeMonthly = Array.isArray(trafficRows) ? trafficRows : [];
  const safeDaily = Array.isArray(dailyRows) ? dailyRows : [];

  // ================= SUMMARY =================

  const summary = {
    total_pengunjung: number(safeSummary.total_impressions),
    total_daftar: number(safeSummary.total_clicks),
    total_test: number(safeSummary.total_leads),
    total_daftar_ulang: number(safeSummary.agency_registrants),
    total_berkuliah: number(safeSummary.total_accepted),

    total_verified: number(safeSummary.total_verified),
    total_re_registered: number(safeSummary.total_re_registered),
    school_total_registrants: number(safeSummary.school_total_registrants)
  };

  // ================= CHANNEL DATA =================

  const sources = safeSources.map(function (source, index) {
    const impressions = number(source.impressions);
    const accepted = number(source.accepted);

    const conversionRate = impressions > 0
      ? (accepted / impressions) * 100
      : 0;

    return {
      name: source.channel || `Channel ${index + 1}`,

      pengunjung: impressions,
      daftar: number(source.clicks),
      test: number(source.leads),
      daftar_ulang: number(source.registrants),
      berkuliah: accepted,

      verified: number(source.verified),
      re_registered: number(source.re_registered),

      conversion_rate: Number(conversionRate.toFixed(2)),
      drop_off: impressions > 0
        ? Number((100 - conversionRate).toFixed(2))
        : 0,

      progression_rates: {},
      attrition_rates: {},
      ranking: index + 1,
      status: impressions > 0 ? "Stable" : "No Data"
    };
  });

  // ================= MONTHLY DATA =================

  const monthlyGroups = {};

  const channelKeys = {
    "Instagram Ads": "instagram",
    "Facebook Ads": "facebook",
    "Google Search Ads": "google_ads"
  };

  safeMonthly.forEach(function (item) {
    const month = item.month;

    if (!monthlyGroups[month]) {
      monthlyGroups[month] = {
        month: month,
        month_order: number(item.month_order),

        google_ads: 0,
        instagram: 0,
        facebook: 0,

        daftar: 0,
        test: 0,
        daftar_ulang: 0,
        berkuliah: 0,
        re_registered: 0
      };
    }

    const group = monthlyGroups[month];
    const key = channelKeys[item.channel];

    if (key) {
      group[key] += number(item.impressions);

      group[`${key}_daftar`] =
        (group[`${key}_daftar`] || 0) + number(item.clicks);

      group[`${key}_test`] =
        (group[`${key}_test`] || 0) + number(item.leads);

      group[`${key}_daftar_ulang`] =
        (group[`${key}_daftar_ulang`] || 0) + number(item.registrants);

      group[`${key}_berkuliah`] =
        (group[`${key}_berkuliah`] || 0) + number(item.accepted);

      group[`${key}_re_registered`] =
        (group[`${key}_re_registered`] || 0) + number(item.re_registered);
    }

    group.daftar += number(item.clicks);
    group.test += number(item.leads);
    group.daftar_ulang += number(item.registrants);
    group.berkuliah += number(item.accepted);
    group.re_registered += number(item.re_registered);
  });

  const monthlyTraffic = Object.values(monthlyGroups)
    .sort(function (a, b) {
      return a.month_order - b.month_order;
    });

  // ================= DAILY DATA =================

  const dailyTraffic = safeDaily.map(function (item) {
    return {
      date: item.date,
      channel: item.channel,

      pengunjung: number(item.impressions),
      daftar: number(item.clicks),
      test: number(item.leads),
      daftar_ulang: number(item.registrants),
      berkuliah: number(item.accepted),

      verified: number(item.verified),
      re_registered: number(item.re_registered)
    };
  });

  // ================= FINAL DATA =================

  return {
    metadata: {
      project_name: "PPDB 2025",
      period: "2025",
      generated_by: "MySQL Database"
    },

    summary: summary,

    metric_cards: [
      {
        title: "Tayangan Iklan",
        value: summary.total_pengunjung
      },
      {
        title: "Pendaftar Agency",
        value: summary.total_daftar_ulang
      },
      {
        title: "Total Pendaftar Sekolah",
        value: summary.school_total_registrants
      }
    ],

    funnel_stages: [
      "Tayangan Iklan",
      "Klik",
      "Leads",
      "Pendaftar",
      "Diterima",
      "Daftar Ulang"
    ],

    funnel_data: [
      summary.total_pengunjung,
      summary.total_daftar,
      summary.total_test,
      summary.total_daftar_ulang,
      summary.total_berkuliah,
      summary.total_re_registered
    ],

    sources: sources,
    monthly_channel_traffic: monthlyTraffic,
    daily_channel_traffic: dailyTraffic
  };
}

async function fetchMySQLData() {
  const endpoints = [
    "summary",
    "funnel",
    "monthly",
    "daily"
  ];

  const results = await Promise.all(
    endpoints.map(async function (action) {
      const response = await fetch(
        `api.php?action=${action}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`Gagal mengambil data ${action}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || `Data ${action} gagal dimuat`);
      }

      return result.data;
    })
  );

  const [summaryData, funnelData, monthlyData, dailyData] = results;

  console.log("DATA SUMMARY:", summaryData);
  console.log("DATA FUNNEL:", funnelData);
  console.log("DATA MONTHLY:", monthlyData);
  console.log("DATA DAILY:", dailyData);

  return mapMySQLData(
    summaryData,
    funnelData,
    monthlyData,
    dailyData
  );
}

async function fetchJsonFallbackData() {
  if (window.location.protocol !== "file:") {
    const response = await fetch("data_funnel.json");

    if (response.ok) {
      return response.json();
    }
  }

  const localData = getLocalEduFunnelData();

  if (validateEduFunnelData(localData)) {
    return localData;
  }

  throw new Error("Fallback data_funnel tidak tersedia.");
}


async function fetchEduFunnelData() {
  try {
    app.innerHTML = `
      <section class="loading-state">
        <h2>Loading data...</h2>
        <p>Sedang mengambil data PPDB 2025 dari database.</p>
      </section>
    `;

    appData = await fetchMySQLData();

    activeDataSource = "PHP API";
    console.info("PPDB 2025 data source: PHP API");

    setupNavigation();
    setupFilters();

    renderPage("overview");

  } catch (error) {
    activeDataSource = "api-error";

    console.error("Gagal mengambil data dari PHP API:", error);

    app.innerHTML = `
      <section class="empty-state">
        <h2>Data gagal dimuat</h2>
        <p>${error.message}</p>
        <p>Periksa koneksi PHP API dan database.</p>
      </section>
    `;
  }
}

/* ================= NAVIGATION ================= */
function setupNavigation() {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach(function (item) {
    item.onclick = function () {
      setActiveMenu(item.dataset.page);
      renderPage(item.dataset.page);
    };
  });
}

function setActiveMenu(page) {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach(function (item) {
    item.classList.remove("active");

    if (item.dataset.page === page) {
      item.classList.add("active");
    }
  });
}

/* ================= FILTER ================= */
function setupFilters() {
  if (channelFilter) {
    channelFilter.onchange = function () {
      currentChannel = channelFilter.value;
      renderPage(currentPage);
    };
  }

  if (dateFilter) {
    dateFilter.value = currentDateRange;
    dateFilter.onchange = function () {
      currentDateRange = dateFilter.value;
      renderPage(currentPage);
    };
  }
}

/* ================= DATE RANGE DATA ================= */
function getMonthlyChannelTraffic() {
  return appData.monthly_channel_traffic || [
    { month: "Jan", google_ads: 19, instagram: 18, twitter_x: 23, website: 18 },
    { month: "Feb", google_ads: 25, instagram: 22, twitter_x: 23, website: 20 },
    { month: "Mar", google_ads: 14, instagram: 16, twitter_x: 14, website: 16 },
    { month: "Apr", google_ads: 18, instagram: 23, twitter_x: 21, website: 29 },
    { month: "May", google_ads: 29, instagram: 23, twitter_x: 24, website: 20 },
    { month: "Jun", google_ads: 29, instagram: 13, twitter_x: 15, website: 27 },
    { month: "Jul", google_ads: 12, instagram: 25, twitter_x: 17, website: 21 },
    { month: "Aug", google_ads: 24, instagram: 26, twitter_x: 23, website: 31 },
    { month: "Sep", google_ads: 19, instagram: 27, twitter_x: 15, website: 21 },
    { month: "Oct", google_ads: 24, instagram: 26, twitter_x: 15, website: 14 },
    { month: "Nov", google_ads: 15, instagram: 21, twitter_x: 21, website: 15 },
    { month: "Dec", google_ads: 28, instagram: 26, twitter_x: 16, website: 19 }
  ];
}

function getLatestMonthlyTraffic() {
  const monthlyData = getMonthlyChannelTraffic();

  if (monthlyData.length === 0) {
    return null;
  }

  const hasMonthOrder = monthlyData.some(function (item) {
    return Number(item.month_order || 0) > 0;
  });

  if (!hasMonthOrder) {
    return monthlyData[monthlyData.length - 1];
  }

  return monthlyData.reduce(function (latest, item) {
    return Number(item.month_order || 0) > Number(latest.month_order || 0)
      ? item
      : latest;
  }, monthlyData[0]);
}

function getDailyChannelTraffic() {
  return Array.isArray(appData.daily_channel_traffic)
    ? appData.daily_channel_traffic
    : [];
}

function parseDailyTrafficDate(value) {
  if (!value) return null;

  const parsedDate = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getAggregatedDailyData(range = currentDateRange, channel = currentChannel) {
  const dailyRows = getDailyChannelTraffic();
  const cacheKey = `${range}:${channel}`;

  if (
    dailyAggregationCache
    && dailyAggregationCache.key === cacheKey
    && dailyAggregationCache.rowsReference === dailyRows
  ) {
    return dailyAggregationCache.result;
  }

  if (dailyRows.length === 0) {
    console.warn(
      "MySQL: daily_channel_traffic kosong total. Menggunakan funnel_sources sebagai fallback."
    );

    const fallbackSources = (Array.isArray(appData.sources) ? appData.sources : [])
      .filter(function (source) {
        return channel === "all" || source.name === channel;
      })
      .map(function (source) {
        const visitors = Number(source.pengunjung || 0);
        const enrolled = Number(source.berkuliah || 0);
        const conversionRate = calculateConversionRate(visitors, enrolled);

        return {
          ...source,
          pengunjung: visitors,
          daftar: Number(source.daftar || 0),
          test: Number(source.test || 0),
          daftar_ulang: Number(source.daftar_ulang || 0),
          berkuliah: enrolled,
          conversion_rate: Number(formatConversionRate(conversionRate)),
          drop_off: visitors > 0 ? Number(formatConversionRate(100 - conversionRate)) : 0
        };
      });
    const fallbackSummary = fallbackSources.reduce(function (totals, source) {
      totals.total_pengunjung += Number(source.pengunjung || 0);
      totals.total_daftar += Number(source.daftar || 0);
      totals.total_test += Number(source.test || 0);
      totals.total_daftar_ulang += Number(source.daftar_ulang || 0);
      totals.total_berkuliah += Number(source.berkuliah || 0);

      return totals;
    }, {
      total_pengunjung: 0,
      total_daftar: 0,
      total_test: 0,
      total_daftar_ulang: 0,
      total_berkuliah: 0
    });
    const fallbackResult = {
      range: range,
      channel: channel,
      latestDate: null,
      rows: [],
      sources: fallbackSources,
      summary: fallbackSummary,
      conversion_rate: calculateConversionRate(
        fallbackSummary.total_pengunjung,
        fallbackSummary.total_berkuliah
      ),
      source: "funnel_sources_fallback"
    };

    dailyAggregationCache = {
      key: cacheKey,
      rowsReference: dailyRows,
      result: fallbackResult
    };

    console.log("FINAL AGGREGATED DATA:", fallbackResult);

    return fallbackResult;
  }

  const datedRows = dailyRows
    .map(function (item) {
      return {
        item: item,
        parsedDate: parseDailyTrafficDate(item.date)
      };
    })
    .filter(function (entry) {
      return entry.parsedDate;
    });

  const latestDate = datedRows.length > 0
    ? datedRows.reduce(function (latest, entry) {
      return entry.parsedDate > latest ? entry.parsedDate : latest;
    }, datedRows[0].parsedDate)
    : null;
  let rangeRows = dailyRows;

  if (latestDate && range === "7") {
    const latestDates = [...new Set(
      datedRows.map(function (entry) {
        return entry.item.date;
      })
    )]
      .sort(function (dateA, dateB) {
        return parseDailyTrafficDate(dateB) - parseDailyTrafficDate(dateA);
      })
      .slice(0, 7);
    const latestDateSet = new Set(latestDates);

    rangeRows = datedRows
      .filter(function (entry) {
        return latestDateSet.has(entry.item.date);
      })
      .map(function (entry) {
        return entry.item;
      });
  }

  if (latestDate && range === "month") {
    rangeRows = datedRows
      .filter(function (entry) {
        return entry.parsedDate.getFullYear() === latestDate.getFullYear()
          && entry.parsedDate.getMonth() === latestDate.getMonth();
      })
      .map(function (entry) {
        return entry.item;
      });
  }

  if (latestDate && range === "year") {
    rangeRows = datedRows
      .filter(function (entry) {
        return entry.parsedDate.getFullYear() === latestDate.getFullYear();
      })
      .map(function (entry) {
        return entry.item;
      });
  }

  const filteredRows = channel === "all"
    ? rangeRows
    : rangeRows.filter(function (item) {
      return item.channel === channel;
    });
  const grouped = filteredRows.reduce(function (totals, item) {
    const channelName = item.channel;

    if (!totals[channelName]) {
      totals[channelName] = {
        pengunjung: 0,
        daftar: 0,
        test: 0,
        daftar_ulang: 0,
        berkuliah: 0
      };
    }

    totals[channelName].pengunjung += Number(item.pengunjung || 0);
    totals[channelName].daftar += Number(item.daftar || 0);
    totals[channelName].test += Number(item.test || 0);
    totals[channelName].daftar_ulang += Number(item.daftar_ulang || 0);
    totals[channelName].berkuliah += Number(item.berkuliah || 0);

    return totals;
  }, {});
  const selectedChannels = channel === "all"
    ? Object.keys(CHANNEL_TRAFFIC_KEYS)
    : [channel];
  const sources = selectedChannels.map(function (channelName, index) {
    const counts = grouped[channelName] || {
      pengunjung: 0,
      daftar: 0,
      test: 0,
      daftar_ulang: 0,
      berkuliah: 0
    };
    const visitors = Number(counts.pengunjung);
    const enrolled = Number(counts.berkuliah);
    const conversionRate = calculateConversionRate(visitors, enrolled);

    return {
      name: channelName,
      pengunjung: visitors,
      daftar: Number(counts.daftar),
      test: Number(counts.test),
      daftar_ulang: Number(counts.daftar_ulang),
      berkuliah: enrolled,
      conversion_rate: conversionRate.toFixed(2),
      drop_off: Number((100 - conversionRate).toFixed(2)),
      progression_rates: {},
      attrition_rates: {},
      ranking: index + 1,
      status: visitors === 0 ? "No Data" : conversionRate >= 5 ? "Stable" : "Alert"
    };
  });
  const summary = sources.reduce(function (totals, source) {
    totals.total_pengunjung += Number(source.pengunjung);
    totals.total_daftar += Number(source.daftar);
    totals.total_test += Number(source.test);
    totals.total_daftar_ulang += Number(source.daftar_ulang);
    totals.total_berkuliah += Number(source.berkuliah);

    return totals;
  }, {
    total_pengunjung: 0,
    total_daftar: 0,
    total_test: 0,
    total_daftar_ulang: 0,
    total_berkuliah: 0
  });
  const result = {
    range: range,
    channel: channel,
    latestDate: latestDate ? latestDate.toISOString().slice(0, 10) : null,
    rows: filteredRows,
    sources: sources,
    summary: summary,
    conversion_rate: calculateConversionRate(
      summary.total_pengunjung,
      summary.total_berkuliah
    ),
    source: "daily_channel_traffic"
  };

  dailyAggregationCache = {
    key: cacheKey,
    rowsReference: dailyRows,
    result: result
  };

  console.log("FINAL AGGREGATED DATA:", result);

  return result;
}

function getChartDataByDateRange() {
  const monthlyData = getMonthlyChannelTraffic();
  const latestMonth = getLatestMonthlyTraffic();
  const dailySources = getAggregatedDailyData(currentDateRange, "all").sources;
  const dailyVisitors = dailySources.reduce(function (totals, source) {
    totals[source.name] = Number(source.pengunjung);
    return totals;
  }, {});
  const dailyChartData = [
  {
    month: "Daily Traffic",
    google_ads: Number(dailyVisitors["Google Search Ads"] || 0),
    instagram: Number(dailyVisitors["Instagram Ads"] || 0),
    facebook: Number(dailyVisitors["Facebook Ads"] || 0)
  }
];

  if (currentDateRange === "7") {
    dailyChartData[0].month = "Last 7 Days";
    return dailyChartData;
  }

  if (currentDateRange === "month" || currentDateRange === "30") {
    return latestMonth ? [latestMonth] : dailyChartData;
  }

  if (currentDateRange === "year") {
    return monthlyData.length > 0 ? monthlyData : dailyChartData;
  }

  return [];
}

function getAggregatedYearlyData(channel = currentChannel) {
  const yearlySources = (Array.isArray(appData.sources) ? appData.sources : [])
    .filter(function (source) {
      return channel === "all" || source.name === channel;
    })
    .map(function (source) {
      const visitors = Number(source.pengunjung || 0);
      const enrolled = Number(source.berkuliah || 0);
      const conversionRate = calculateConversionRate(visitors, enrolled);

      return {
        ...source,
        pengunjung: visitors,
        daftar: Number(source.daftar || 0),
        test: Number(source.test || 0),
        daftar_ulang: Number(source.daftar_ulang || 0),
        berkuliah: enrolled,
        conversion_rate: Number(formatConversionRate(conversionRate)),
        drop_off: visitors > 0 ? Number(formatConversionRate(100 - conversionRate)) : 0
      };
    });
  const summary = yearlySources.reduce(function (totals, source) {
    totals.total_pengunjung += Number(source.pengunjung);
    totals.total_daftar += Number(source.daftar);
    totals.total_test += Number(source.test);
    totals.total_daftar_ulang += Number(source.daftar_ulang);
    totals.total_berkuliah += Number(source.berkuliah);

    return totals;
  }, {
    total_pengunjung: 0,
    total_daftar: 0,
    total_test: 0,
    total_daftar_ulang: 0,
    total_berkuliah: 0
  });

  const yearlyConversionRate = calculateConversionRate(
    summary.total_pengunjung,
    summary.total_berkuliah
  );

  return {
    range: "year",
    channel: channel,
    sources: yearlySources,
    summary: summary,
    conversion_rate: Number(formatConversionRate(yearlyConversionRate)),
    source: "funnel_sources"
  };
}

function getMonthlyChannelStageValue(monthRow, trafficKey, stage) {
  const candidateKeys = [
    `${trafficKey}_${stage}`,
    `${stage}_${trafficKey}`
  ];
  const matchingKey = candidateKeys.find(function (key) {
    return Object.prototype.hasOwnProperty.call(monthRow, key);
  });

  return matchingKey ? Number(monthRow[matchingKey] || 0) : null;
}

function getAggregatedMonthlyData(channel = currentChannel) {
  const latestMonth = getLatestMonthlyTraffic();

  if (!latestMonth) {
    console.warn("MySQL: monthly_channel_traffic kosong. Tidak ada metrik This Month.");

    return {
      range: "month",
      channel: channel,
      sources: [],
      summary: {
        total_pengunjung: 0,
        total_daftar: 0,
        total_test: 0,
        total_daftar_ulang: 0,
        total_berkuliah: 0
      },
      conversion_rate: 0,
      source: "monthly_channel_traffic"
    };
  }

  const channelEntries = Object.entries(CHANNEL_TRAFFIC_KEYS)
    .filter(function ([channelName]) {
      return channel === "all" || channelName === channel;
    });
  const hasPerChannelFunnel = channelEntries.every(function ([, trafficKey]) {
    return ["daftar", "test", "daftar_ulang", "berkuliah"].every(function (stage) {
      return getMonthlyChannelStageValue(latestMonth, trafficKey, stage) !== null;
    });
  });
  const allPerChannelEntries = Object.entries(CHANNEL_TRAFFIC_KEYS);
  const perChannelFunnelHasData = allPerChannelEntries.some(function ([, trafficKey]) {
    return ["daftar", "test", "daftar_ulang", "berkuliah"].some(function (stage) {
      return Number(getMonthlyChannelStageValue(latestMonth, trafficKey, stage) || 0) > 0;
    });
  });
  let sources = [];

  if (hasPerChannelFunnel && perChannelFunnelHasData) {
    sources = channelEntries.map(function ([channelName, trafficKey], index) {
      const visitors = Number(latestMonth[trafficKey] || 0);
      const daftar = getMonthlyChannelStageValue(latestMonth, trafficKey, "daftar");
      const test = getMonthlyChannelStageValue(latestMonth, trafficKey, "test");
      const daftarUlang = getMonthlyChannelStageValue(latestMonth, trafficKey, "daftar_ulang");
      const enrolled = getMonthlyChannelStageValue(latestMonth, trafficKey, "berkuliah");
      const conversionRate = calculateConversionRate(visitors, enrolled);

      return {
        name: channelName,
        pengunjung: visitors,
        daftar: daftar,
        test: test,
        daftar_ulang: daftarUlang,
        berkuliah: enrolled,
        conversion_rate: Number(formatConversionRate(conversionRate)),
        drop_off: visitors > 0 ? Number(formatConversionRate(100 - conversionRate)) : 0,
        progression_rates: {},
        attrition_rates: {},
        ranking: index + 1,
        status: visitors === 0 ? "No Data" : conversionRate >= 5 ? "Stable" : "Alert"
      };
    });
  } else if (channel === "all") {
    if (hasPerChannelFunnel && !perChannelFunnelHasData) {
      console.warn("Monthly per-channel funnel columns exist but contain zero data.");
    }

    sources = channelEntries.map(function ([channelName, trafficKey], index) {
      const visitors = Number(latestMonth[trafficKey] || 0);
      const daftar = Number(getMonthlyChannelStageValue(latestMonth, trafficKey, "daftar") || 0);
      const test = Number(getMonthlyChannelStageValue(latestMonth, trafficKey, "test") || 0);
      const daftarUlang = Number(
        getMonthlyChannelStageValue(latestMonth, trafficKey, "daftar_ulang") || 0
      );
      const enrolled = Number(
        getMonthlyChannelStageValue(latestMonth, trafficKey, "berkuliah") || 0
      );
      const conversionRate = calculateConversionRate(visitors, enrolled);

      return {
        name: channelName,
        pengunjung: visitors,
        daftar: daftar,
        test: test,
        daftar_ulang: daftarUlang,
        berkuliah: enrolled,
        conversion_rate: Number(formatConversionRate(conversionRate)),
        drop_off: visitors > 0 ? Number(formatConversionRate(100 - conversionRate)) : 0,
        progression_rates: {},
        attrition_rates: {},
        ranking: index + 1,
        status: visitors === 0 ? "No Data" : conversionRate >= 5 ? "Stable" : "Alert"
      };
    });
  } else {
    const [channelName, trafficKey] = channelEntries[0];
    const visitors = Number(latestMonth[trafficKey] || 0);

    if (hasPerChannelFunnel && !perChannelFunnelHasData) {
      console.warn("Monthly per-channel funnel columns exist but contain zero data.");
    } else {
      console.warn(
        `MySQL: funnel bulanan per channel ${channelName} belum tersedia. Tambahkan kolom ${trafficKey}_daftar, ${trafficKey}_test, ${trafficKey}_daftar_ulang, dan ${trafficKey}_berkuliah.`
      );
    }

    sources = [{
      name: channelName,
      pengunjung: visitors,
      daftar: 0,
      test: 0,
      daftar_ulang: 0,
      berkuliah: 0,
      conversion_rate: 0,
      drop_off: visitors > 0 ? 100 : 0,
      progression_rates: {},
      attrition_rates: {},
      ranking: 1,
      status: visitors > 0 ? "Stable" : "No Data"
    }];
  }

  let summary = sources.reduce(function (totals, source) {
    totals.total_pengunjung += Number(source.pengunjung || 0);
    totals.total_daftar += Number(source.daftar || 0);
    totals.total_test += Number(source.test || 0);
    totals.total_daftar_ulang += Number(source.daftar_ulang || 0);
    totals.total_berkuliah += Number(source.berkuliah || 0);
    return totals;
  }, {
    total_pengunjung: 0,
    total_daftar: 0,
    total_test: 0,
    total_daftar_ulang: 0,
    total_berkuliah: 0
  });

  if (channel === "all") {
    const detailSummary = summary;

    summary = {
      total_pengunjung: Object.values(CHANNEL_TRAFFIC_KEYS).reduce(function (total, trafficKey) {
        return total + Number(latestMonth[trafficKey] || 0);
      }, 0),
      total_daftar: Number(latestMonth.daftar || 0),
      total_test: Number(latestMonth.test || 0),
      total_daftar_ulang: Number(latestMonth.daftar_ulang || 0),
      total_berkuliah: Number(latestMonth.berkuliah || 0)
    };

    if (
      hasPerChannelFunnel
      && perChannelFunnelHasData
      && (
        detailSummary.total_daftar !== summary.total_daftar
        || detailSummary.total_test !== summary.total_test
        || detailSummary.total_daftar_ulang !== summary.total_daftar_ulang
        || detailSummary.total_berkuliah !== summary.total_berkuliah
      )
    ) {
      console.warn("Monthly channel detail totals do not match monthly total columns.", {
        detailSummary: detailSummary,
        monthlySummary: summary
      });
    }
  }

  return {
    range: "month",
    channel: channel,
    sources: sources,
    summary: summary,
    conversion_rate: calculateConversionRate(
      summary.total_pengunjung,
      summary.total_berkuliah
    ),
    source: "monthly_channel_traffic"
  };
}

function validateFunnelOrder(label, metrics) {
  const values = [
    Number(metrics.pengunjung ?? metrics.total_pengunjung ?? 0),
    Number(metrics.daftar ?? metrics.total_daftar ?? 0),
    Number(metrics.test ?? metrics.total_test ?? 0),
    Number(metrics.daftar_ulang ?? metrics.total_daftar_ulang ?? 0),
    Number(metrics.berkuliah ?? metrics.total_berkuliah ?? 0)
  ];
  const isValid = values.every(function (value, index) {
    return index === 0 || values[index - 1] >= value;
  });

  if (!isValid) {
    console.warn(`Invalid funnel order for ${label}.`, {
      pengunjung: values[0],
      daftar: values[1],
      test: values[2],
      daftar_ulang: values[3],
      berkuliah: values[4]
    });
  }
}

function recalculateMetricsFromChannelRows(metrics) {
  const channelRows = (Array.isArray(metrics.sources) ? metrics.sources : []).map(function (source) {
    const visitors = Number(source.pengunjung || 0);
    const enrolled = Number(source.berkuliah || 0);
    const conversionRate = calculateConversionRate(visitors, enrolled);

    return {
      ...source,
      pengunjung: visitors,
      daftar: Number(source.daftar || 0),
      test: Number(source.test || 0),
      daftar_ulang: Number(source.daftar_ulang || 0),
      berkuliah: enrolled,
      re_registered: Number(source.re_registered || 0),

      conversion_rate: Number(formatConversionRate(conversionRate)),
      drop_off: visitors > 0
        ? Number(formatConversionRate(100 - conversionRate))
        : 0
    };
  });

  const totals = channelRows.reduce(function (result, row) {
    result.total_pengunjung += row.pengunjung;
    result.total_daftar += row.daftar;
    result.total_test += row.test;
    result.total_daftar_ulang += row.daftar_ulang;
    result.total_berkuliah += row.berkuliah;
    result.total_re_registered += row.re_registered;

    return result;
  }, {
    total_pengunjung: 0,
    total_daftar: 0,
    total_test: 0,
    total_daftar_ulang: 0,
    total_berkuliah: 0,
    total_re_registered: 0
  });

  totals.total_conversion_rate = calculateConversionRate(
    totals.total_pengunjung,
    totals.total_berkuliah
  );

  console.log("CHANNEL ROWS", channelRows);
  console.log("TOTAL RECALCULATED", totals);

  return {
    ...metrics,
    sources: channelRows,
    summary: totals,
    conversion_rate: totals.total_conversion_rate
  };
}

function getMetricsByRangeAndChannel(range = currentDateRange, channel = currentChannel) {
  let metrics;

  if (range === "month" || range === "30") {
    metrics = getAggregatedMonthlyData(channel);
  } else if (range === "year") {
    metrics = getAggregatedYearlyData(channel);
  } else {
    metrics = getAggregatedDailyData("7", channel);
  }

  metrics = recalculateMetricsFromChannelRows(metrics);

  metrics.sources.forEach(function (source) {
    validateFunnelOrder(`${metrics.source}:${source.name}`, source);
  });
  validateFunnelOrder(`${metrics.source}:summary`, metrics.summary);

  console.log("METRICS SOURCE", {
    range: range,
    channel: channel,
    sourceTable: metrics.source,
    metrics: metrics
  });

  return metrics;
}

/* ================= FILTERED DATA ================= */
function getFilteredSources() {
  return getMetricsByRangeAndChannel(currentDateRange, currentChannel).sources;
}

function getFilteredSummary() {
  return getMetricsByRangeAndChannel(currentDateRange, currentChannel).summary;
}


function getDateRangeLabel() {
  if (currentDateRange === "month" || currentDateRange === "30") {
    return "Bulan Ini";
  }

  if (currentDateRange === "year") {
    return "Tahun Ini";
  }

  return "7 Hari Terakhir";
}


function getChannelTrafficTitle() {
  if (currentDateRange === "month" || currentDateRange === "30") {
    return "This Month Channel Traffic";
  }
  if (currentDateRange === "year") return "Monthly Channel Traffic";
  return "Last 7 Days Channel Traffic";
}

function formatAnimatedNumber(value, format, decimals) {
  if (format === "percent") {
    return `${Number(value).toFixed(decimals)}%`;
  }

  if (format === "decimal") {
    return Number(value).toFixed(decimals);
  }

  return Math.round(Number(value)).toLocaleString("id-ID");
}

function formatConversionRate(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : "0.00";
}

function calculateConversionRate(visitors, enrolled) {
  const visitorCount = Number(visitors || 0);
  const enrolledCount = Number(enrolled || 0);

  return visitorCount === 0 ? 0 : (enrolledCount / visitorCount) * 100;
}

function animateNumber(element, targetValue, options = {}) {
  const duration = options.duration || 900;
  const format = options.format || "int";
  const decimals = Number(options.decimals || 0);
  const target = Number(targetValue);
  const startTime = performance.now();

  if (!Number.isFinite(target)) return;

  function updateFrame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 4);
    const currentValue = target * easedProgress;

    element.textContent = formatAnimatedNumber(currentValue, format, decimals);

    if (progress < 1) {
      requestAnimationFrame(updateFrame);
    } else {
      element.textContent = formatAnimatedNumber(target, format, decimals);
    }
  }

  element.textContent = formatAnimatedNumber(0, format, decimals);
  requestAnimationFrame(updateFrame);
}

function animateCountUps() {
  document.querySelectorAll("[data-count-up]").forEach(function (element) {
    animateNumber(element, element.dataset.value, {
      format: element.dataset.format || "int",
      decimals: element.dataset.decimals || 0,
      duration: 900
    });
  });
}

function animateProgressBars() {
  document.querySelectorAll(".bar-fill[data-width]").forEach(function (bar) {
    bar.style.width = "0%";

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bar.style.width = `${bar.dataset.width}%`;
      });
    });
  });
}

function runDashboardAnimations() {
  animateCountUps();
  animateProgressBars();
}

function getReportExportMarkup() {
  return `
    <div class="report-export">
      <button class="auth-button report-btn" type="button" data-report-toggle>
        Generate Detailed Report
      </button>

      <div class="export-menu" hidden>
        <button type="button" data-export-type="pdf">Download PDF</button>
        <button type="button" data-export-type="csv">Download Excel/CSV</button>
        <button type="button" data-export-type="json">Download JSON</button>
      </div>
    </div>
  `;
}

function renderEmptyState() {
  app.innerHTML = `
    <section class="empty-state">
      <h2>Data tidak ditemukan</h2>
      <p>Coba ubah filter channel, rentang tanggal, atau keyword pencarian.</p>
    </section>
  `;
}

/* ================= PAGE RENDER ================= */
function renderPage(page) {
  currentPage = page;

  if (monthlyChart) {
    monthlyChart.destroy();
    monthlyChart = null;
  }

  if (page === "overview") renderOverview();
  if (page === "channel") renderChannelAnalysis();
  if (page === "funnel") renderFunnelDepth();
  if (page === "table") renderDataTable();

  runDashboardAnimations();
  setupReportExport();
}

/* ================= HELPERS ================= */
function getTotalConversionRate(metrics = getMetricsByRangeAndChannel(
  currentDateRange,
  currentChannel
)) {

  return formatConversionRate(metrics.conversion_rate);
}

function getSummaryStages(summary = getFilteredSummary()) {
  return [
    { label: "Tayangan Iklan", count: Number(summary.total_pengunjung) },
    { label: "Klik", count: Number(summary.total_daftar) },
    { label: "Leads", count: Number(summary.total_test) },
    { label: "Pendaftar", count: Number(summary.total_daftar_ulang) },
    { label: "Diterima", count: Number(summary.total_berkuliah) },
    { label: "Daftar Ulang", count: Number(summary.total_re_registered) }
  ];
}
function getHighestDrop(stages) {
  let highestDrop = {
    label: "-",
    value: 0,
    percent: 0
  };

  for (let i = 1; i < stages.length; i++) {
    const previous = stages[i - 1];
    const current = stages[i];

    if (previous.count === 0) continue;

    const dropValue = previous.count - current.count;
    const dropPercent = (dropValue / previous.count) * 100;

    if (dropValue > highestDrop.value) {
      highestDrop = {
        label: `${previous.label} ke ${current.label}`,
        value: dropValue,
        percent: dropPercent
      };
    }
  }

  return highestDrop;
}

/* ================= Ringkasan PPDB ================= */
function renderOverview() {
  const metrics = getMetricsByRangeAndChannel(currentDateRange, currentChannel);
  const filteredSources = metrics.sources;

  if (filteredSources.length === 0) {
    renderEmptyState();
    return;
  }

  const summary = metrics.summary;
  const stages = getSummaryStages(summary);
  const highestDrop = getHighestDrop(stages);

  const bestSource = [...filteredSources].sort(function (a, b) {
    return Number(b.conversion_rate) - Number(a.conversion_rate);
  })[0];

  const conversionRate = getTotalConversionRate(metrics);

  app.innerHTML = `
    <section class="page-title">
      <p>PPDB ANALYTICS · SMP NEGERI 5 DEPOK</p>
      <h1>Ringkasan Performa PPDB</h1>
      <span>
        Pantau performa promosi dan perkembangan calon peserta didik
        berdasarkan ${getDateRangeLabel().toLowerCase()}.
      </span>
    </section>

    <section class="summary">
      <div class="summary-card">
        <h3>Total Tayangan Iklan</h3>
        <p data-count-up data-value="${summary.total_pengunjung}">
          ${summary.total_pengunjung.toLocaleString("id-ID")}
        </p>
        <span class="label">Jumlah impresi dari seluruh channel</span>
      </div>

      <div class="summary-card">
        <h3>Total Klik Iklan</h3>
        <p data-count-up data-value="${summary.total_daftar}">
          ${summary.total_daftar.toLocaleString("id-ID")}
        </p>
        <span class="label">Jumlah klik pada iklan</span>
      </div>

      <div class="summary-card">
        <h3>Rasio Konversi</h3>
        <p
          data-count-up
          data-value="${conversionRate}"
          data-format="percent"
          data-decimals="2"
        >
          ${conversionRate}%
        </p>
        <span class="label">Persentase diterima dibanding tayangan iklan</span>
      </div>
    </section>

    <section class="dashboard-grid">
      <div class="card">
        <div class="section-header">
          <div>
            <h2>Alur Pendaftaran PPDB</h2>
            <span>Perkembangan dari tayangan iklan hingga daftar ulang</span>
          </div>
        </div>

        <div id="overviewFunnel"></div>
      </div>

      <aside class="card insight-card">
        <h2>Insight Performa</h2>

        <p class="label">Penurunan terbesar berdasarkan jumlah</p>

        <div
          class="insight-value"
          data-count-up
          data-value="${highestDrop.percent.toFixed(1)}"
          data-format="percent"
          data-decimals="1"
        >
          ${highestDrop.percent.toFixed(1)}%
        </div>

        <p>
          Penurunan terbesar terjadi pada tahap
          <strong>${highestDrop.label}</strong>,
          dengan selisih
          <strong>${highestDrop.value.toLocaleString("id-ID")}</strong>
          data.
        </p>

        <hr />

        <p class="label">Channel dengan rasio konversi tertinggi</p>

        <h3>${bestSource.name}</h3>

        <p>
          Rasio konversi sebesar
          <strong>${formatConversionRate(bestSource.conversion_rate)}%</strong>.
        </p>

        ${getReportExportMarkup()}
      </aside>
    </section>

    <p class="label" style="margin-top: 18px;">
      Catatan: Data pada dashboard ini merupakan data simulasi untuk keperluan tugas akademik.
    </p>
  `;

  renderFunnelBars("overviewFunnel", stages);
}


/* ================= Analisis Promosi ================= */
function renderChannelAnalysis() {
  const metrics = getMetricsByRangeAndChannel(currentDateRange, currentChannel);
  const filteredSources = metrics.sources;

  if (filteredSources.length === 0) {
    renderEmptyState();
    return;
  }

  const channelCards = filteredSources.map(function (source) {
    let statusText = "Stabil";
    let badgeClass = "stable";

    if (source.status === "Alert") {
      statusText = "Perlu Evaluasi";
      badgeClass = "risk";
    } else if (source.status === "No Data") {
      statusText = "Belum Ada Data";
      badgeClass = "risk";
    }

    return `
      <div class="channel-card">
        <div class="channel-top">
          <h2>${source.name}</h2>
          <span class="badge ${badgeClass}">${statusText}</span>
        </div>

        <p class="label">Total Tayangan Iklan</p>
        <h3 data-count-up data-value="${Number(source.pengunjung)}">
          ${Number(source.pengunjung).toLocaleString("id-ID")}
        </h3>

        <div class="channel-stats">
          <div>
            <span>Klik Iklan</span>
            <strong data-count-up data-value="${Number(source.daftar)}">
              ${Number(source.daftar).toLocaleString("id-ID")}
            </strong>
          </div>

          <div>
            <span>Leads</span>
            <strong data-count-up data-value="${Number(source.test)}">
              ${Number(source.test).toLocaleString("id-ID")}
            </strong>
          </div>

          <div>
            <span>Pendaftar</span>
            <strong data-count-up data-value="${Number(source.daftar_ulang)}">
              ${Number(source.daftar_ulang).toLocaleString("id-ID")}
            </strong>
          </div>

          <div>
            <span>Diterima</span>
            <strong data-count-up data-value="${Number(source.berkuliah)}">
              ${Number(source.berkuliah).toLocaleString("id-ID")}
            </strong>
          </div>
        </div>

        <div class="channel-conversion">
          <span>Rasio Konversi</span>
          <strong
            data-count-up
            data-value="${Number(source.conversion_rate)}"
            data-format="percent"
            data-decimals="2"
          >
            ${formatConversionRate(source.conversion_rate)}%
          </strong>
        </div>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <section class="page-title">
      <p>PPDB ANALYTICS · SUMBER PROMOSI</p>
      <h1>Analisis Performa Promosi</h1>
      <span>
        Bandingkan efektivitas setiap channel promosi dalam menjangkau
        dan memperoleh calon peserta didik pada ${getDateRangeLabel().toLowerCase()}.
      </span>
    </section>

    <section class="channel-grid">
      ${channelCards}
    </section>

    <section class="card">
      <div class="section-header">
        <div>
          <h2>${getChannelTrafficTitle()}</h2>
          <span>Perbandingan jumlah tayangan iklan dari setiap channel promosi.</span>
        </div>
      </div>

      <canvas id="monthlyChart"></canvas>
    </section>

    <p class="label" style="margin-top: 18px;">
      Catatan: Data performa channel merupakan data simulasi untuk keperluan tugas akademik.
    </p>
  `;

  renderMonthlyChart();
}

/* ================= FUNNEL DEPTH ================= */
function renderFunnelDepth() {
  const metrics = getMetricsByRangeAndChannel(currentDateRange, currentChannel);
  const filteredSources = metrics.sources;

  if (filteredSources.length === 0) {
    renderEmptyState();
    return;
  }

  const stages = getSummaryStages(metrics.summary);
  const highestDrop = getHighestDrop(stages);
  const conversionRate = getTotalConversionRate(metrics);

  app.innerHTML = `
    <section class="page-title">
      <p>PPDB ANALYTICS · PERJALANAN PENDAFTAR</p>
      <h1>Analisis Tahapan Pendaftaran</h1>
      <span>
        Pantau perkembangan calon peserta didik dari tahap melihat iklan
        hingga menyelesaikan proses daftar ulang pada ${getDateRangeLabel().toLowerCase()}.
      </span>
    </section>

    <section class="dashboard-grid">
      <div class="card">
        <div class="section-header">
          <div>
            <h2>Alur Konversi PPDB</h2>
            <span>Jumlah data pada setiap tahapan pendaftaran</span>
          </div>
        </div>

        <div id="depthFunnel"></div>
      </div>

      <aside>
        <div class="card friction-card">
          <h2>Titik Penurunan Terbesar</h2>

          <div class="insight-value">
            ${highestDrop.percent.toFixed(1)}%
          </div>

          <p>
            Penurunan terbesar terjadi dari tahap
            <strong>${highestDrop.label}</strong>.
          </p>

          <p>
            Terdapat selisih
            <strong>${highestDrop.value.toLocaleString("id-ID")}</strong>
            data dibandingkan tahap sebelumnya.
          </p>
        </div>

        <div class="card">
          <h3>Rasio Konversi Akhir</h3>

          <div
            class="final-yield"
            data-count-up
            data-value="${conversionRate}"
            data-format="percent"
            data-decimals="2"
          >
            ${conversionRate}%
          </div>

          <p>
            Perbandingan jumlah siswa diterima dengan total tayangan iklan.
          </p>

          ${getReportExportMarkup()}
        </div>
      </aside>
    </section>

    <p class="label" style="margin-top: 18px;">
      Catatan: Data tahapan pendaftaran merupakan data simulasi untuk keperluan tugas akademik.
    </p>
  `;

  renderFunnelBars("depthFunnel", stages);
}


/* ================= DATA TABLE ================= */
function renderDataTable() {
  const metrics = getMetricsByRangeAndChannel(currentDateRange, currentChannel);
  const filteredSources = metrics.sources;

  if (filteredSources.length === 0) {
    renderEmptyState();
    return;
  }

  const summary = metrics.summary;

  const rows = filteredSources.map(function (source) {
    let statusText = "Stabil";

    if (source.status === "Alert") {
      statusText = "Perlu Evaluasi";
    } else if (source.status === "No Data") {
      statusText = "Belum Ada Data";
    }

    return `
      <tr>
        <td><strong>${source.name}</strong></td>

        <td>${Number(source.pengunjung).toLocaleString("id-ID")}</td>

        <td>${Number(source.daftar).toLocaleString("id-ID")}</td>

        <td>${Number(source.test).toLocaleString("id-ID")}</td>

        <td>${Number(source.daftar_ulang).toLocaleString("id-ID")}</td>

        <td>${Number(source.berkuliah).toLocaleString("id-ID")}</td>

        <td>${formatConversionRate(source.conversion_rate)}%</td>

        <td>${statusText}</td>
      </tr>
    `;
  }).join("");

  const conversionRate = getTotalConversionRate(metrics);

  app.innerHTML = `
    <section class="page-title">
      <p>PPDB ANALYTICS · DATA PERFORMA</p>
      <h1>Data Performa Promosi</h1>
      <span>
        Rincian data tayangan, interaksi, leads, dan hasil pendaftaran
        dari setiap channel promosi pada ${getDateRangeLabel().toLowerCase()}.
      </span>
    </section>

    <section class="summary">
      <div class="summary-card">
        <h3>Total Tayangan Iklan</h3>
        <p data-count-up data-value="${summary.total_pengunjung}">
          ${summary.total_pengunjung.toLocaleString("id-ID")}
        </p>
      </div>

      <div class="summary-card">
        <h3>Total Klik Iklan</h3>
        <p data-count-up data-value="${summary.total_daftar}">
          ${summary.total_daftar.toLocaleString("id-ID")}
        </p>
      </div>

      <div class="summary-card">
        <h3>Rasio Konversi</h3>
        <p
          data-count-up
          data-value="${conversionRate}"
          data-format="percent"
          data-decimals="2"
        >
          ${conversionRate}%
        </p>
      </div>
    </section>

    <section class="card">
      <div class="section-header">
        <div>
          <h2>Rincian Performa Setiap Channel</h2>
          <span>
            Perbandingan hasil promosi berdasarkan sumber iklan.
          </span>
        </div>
      </div>

      <div style="width: 100%; overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Sumber Promosi</th>
              <th>Tayangan</th>
              <th>Klik</th>
              <th>Leads</th>
              <th>Pendaftar</th>
              <th>Diterima</th>
              <th>Konversi</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            ${rows}

            <tr class="total-row">
              <td><strong>TOTAL</strong></td>

              <td>${summary.total_pengunjung.toLocaleString("id-ID")}</td>

              <td>${summary.total_daftar.toLocaleString("id-ID")}</td>

              <td>${summary.total_test.toLocaleString("id-ID")}</td>

              <td>${summary.total_daftar_ulang.toLocaleString("id-ID")}</td>

              <td>${summary.total_berkuliah.toLocaleString("id-ID")}</td>

              <td>${conversionRate}%</td>

              <td>Keseluruhan</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="label" style="margin-top: 18px;">
      Catatan: Seluruh data merupakan data simulasi untuk keperluan tugas akademik.
    </p>
  `;
}


/* ================= FUNNEL BAR ================= */
function renderFunnelBars(containerId, stages) {
  const container = document.getElementById(containerId);
  const firstCount = stages[0].count;

  container.innerHTML = stages.map(function (stage, index) {
    const width = firstCount === 0 ? 0 : (stage.count / firstCount) * 100;

    let dropText = "";

    if (index > 0) {
      const previous = stages[index - 1];

      if (previous.count > 0) {
        const drop = previous.count - stage.count;
        const dropPercent = (drop / previous.count) * 100;

        dropText = `
          <div class="drop">
            ${dropPercent.toFixed(1)}% drop-off
          </div>
        `;
      }
    }

    return `
      <div class="funnel-stage">
        <div class="stage-label">
          <strong>${stage.label}</strong>
          <span data-count-up data-value="${stage.count}">${stage.count.toLocaleString("id-ID")}</span>
        </div>

        <div class="bar-bg">
          <div class="bar-fill" data-width="${width}" style="width: 0%"></div>
        </div>

        ${dropText}
      </div>
    `;
  }).join("");
}

/* ================= CHART ================= */
function getSmoothChartOptions() {
  return {
    responsive: true,
    animation: {
      duration: 1200,
      easing: "easeOutQuart"
    },
    transitions: {
      active: {
        animation: {
          duration: 400
        }
      },
      resize: {
        animation: {
          duration: 600
        }
      },
      show: {
        animations: {
          x: {
            from: 0,
            duration: 900,
            easing: "easeOutQuart"
          },
          y: {
            from: 0,
            duration: 900,
            easing: "easeOutQuart"
          }
        }
      },
      hide: {
        animation: {
          duration: 300
        }
      }
    },
    hover: {
      mode: "nearest",
      intersect: true,
      animationDuration: 250
    },
    plugins: {
      legend: {
        labels: {
          color: "#cbd5e1"
        }
      }
    },
    scales: {
      x: {
        ticks: { color: "#cbd5e1" },
        grid: { color: "rgba(255,255,255,0.06)" }
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#cbd5e1" },
        grid: { color: "rgba(255,255,255,0.06)" }
      }
    }
  };
}

function renderMonthlyChart() {
  if (typeof Chart === "undefined") {
    const chart = document.getElementById("monthlyChart");

    if (chart) {
      const chartMessage = document.createElement("div");
      chartMessage.className = "empty-state";
      chartMessage.innerHTML = `
        <h2>Grafik belum tersedia</h2>
        <p>Chart.js gagal dimuat. Data channel tetap bisa dibaca.</p>
      `;

      chart.replaceWith(chartMessage);
    }

    return;
  }

  const monthlyData = getChartDataByDateRange();

  const googleAds = monthlyData.map(item => item.google_ads);
  const instagram = monthlyData.map(item => item.instagram);
  const facebook = monthlyData.map(item => item.facebook);

  const ctx = document.getElementById("monthlyChart").getContext("2d");

  if (monthlyChart) {
    monthlyChart.destroy();
    monthlyChart = null;
  }

  monthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthlyData.map(item => item.month),
      datasets: [
        {
          label: "Google Search Ads",
          data: googleAds,
          backgroundColor: "rgba(79, 140, 255, 0.7)",
          hoverBackgroundColor: "rgba(79, 140, 255, 0.95)",
          hoverBorderColor: "rgba(191, 219, 254, 0.95)",
          hoverBorderWidth: 2
        },
        {
          label: "Instagram Ads",
          data: instagram,
          backgroundColor: "rgba(0, 212, 255, 0.7)",
          hoverBackgroundColor: "rgba(0, 212, 255, 0.95)",
          hoverBorderColor: "rgba(207, 250, 254, 0.95)",
          hoverBorderWidth: 2
        },
        {
          label: "Facebook Ads",
          data: facebook,
          backgroundColor: "rgba(255, 99, 132, 0.7)",
          hoverBackgroundColor: "rgba(255, 99, 132, 0.95)",
          hoverBorderColor: "rgba(255, 228, 230, 0.95)",
          hoverBorderWidth: 2
        },
      ]
    },
    options: getSmoothChartOptions()
  });
}

/* ================= DOWNLOAD REPORT ================= */
function getReportFileName(extension) {
  const period = getDateRangeLabel().toLowerCase().replace(/\s+/g, "-");
  const channel = (currentChannel === "all" ? "all-channels" : currentChannel)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `edufunnel-report-${period}-${channel}.${extension}`;
}


function getCurrentReportData() {
  if (!appData) {
    return null;
  }

  const summary = getFilteredSummary();
  const funnelData = getSummaryStages();
  const sources = getFilteredSources();
  const highestDrop = getHighestDrop(funnelData);

  const bestSource = sources.length > 0
    ? [...sources].sort(function (a, b) {
        return Number(b.conversion_rate) - Number(a.conversion_rate);
      })[0]
    : null;

  return {
    title: "Laporan PPDB Analytics - SMP Negeri 5 Depok",

    metadata: {
      project_name: "PPDB Analytics - SMP Negeri 5 Depok",
      period: "2025",
      generated_by: "MySQL Database",
      data_type: "Data Simulasi Akademik"
    },

    selectedPeriod: getDateRangeLabel(),

    selectedChannel: currentChannel === "all"
      ? "Semua Kanal"
      : currentChannel,

    selectedPeriodValue: currentDateRange,

    summary: summary,
    funnelData: funnelData,
    sources: sources,
    chartData: getChartDataByDateRange(),
    highestDrop: highestDrop,
    bestSource: bestSource,

    generatedAt: new Date().toLocaleString("id-ID")
  };
}


function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function downloadJSONReport() {
  const reportData = getCurrentReportData();

  if (!reportData) {
    alert("Data belum siap.");
    return;
  }

  const jsonData = JSON.stringify(reportData, null, 2);
  downloadBlob(jsonData, getReportFileName("json"), "application/json");
}

function escapeCSVValue(value) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function addCSVRow(rows, values) {
  rows.push(values.map(escapeCSVValue).join(","));
}


function downloadCSVReport() {
  const reportData = getCurrentReportData();

  if (!reportData) {
    alert("Data belum siap.");
    return;
  }

  const rows = [];

  addCSVRow(rows, [reportData.title]);
  addCSVRow(rows, ["Waktu Pembuatan", reportData.generatedAt]);
  addCSVRow(rows, ["Periode", reportData.selectedPeriod]);
  addCSVRow(rows, ["Sumber Promosi", reportData.selectedChannel]);
  addCSVRow(rows, ["Jenis Data", "Data Simulasi Akademik"]);
  rows.push("");

  addCSVRow(rows, ["RINGKASAN PERFORMA"]);
  addCSVRow(rows, ["Metrik", "Jumlah"]);

  addCSVRow(rows, [
    "Total Tayangan Iklan",
    reportData.summary.total_pengunjung
  ]);

  addCSVRow(rows, [
    "Total Klik Iklan",
    reportData.summary.total_daftar
  ]);

  addCSVRow(rows, [
    "Total Leads",
    reportData.summary.total_test
  ]);

  addCSVRow(rows, [
    "Total Pendaftar",
    reportData.summary.total_daftar_ulang
  ]);

  addCSVRow(rows, [
    "Total Siswa Diterima",
    reportData.summary.total_berkuliah
  ]);

  addCSVRow(rows, [
    "Rasio Konversi",
    `${getTotalConversionRate()}%`
  ]);

  rows.push("");

  addCSVRow(rows, ["TAHAPAN PENDAFTARAN"]);
  addCSVRow(rows, ["Tahapan", "Jumlah"]);

  reportData.funnelData.forEach(function (stage) {
    addCSVRow(rows, [stage.label, stage.count]);
  });

  rows.push("");

  addCSVRow(rows, ["RINCIAN PERFORMA CHANNEL"]);

  addCSVRow(rows, [
    "Sumber Promosi",
    "Tayangan",
    "Klik",
    "Leads",
    "Pendaftar",
    "Diterima",
    "Rasio Konversi",
    "Status"
  ]);

  reportData.sources.forEach(function (source) {
    let statusText = "Stabil";

    if (source.status === "Alert") {
      statusText = "Perlu Evaluasi";
    } else if (source.status === "No Data") {
      statusText = "Belum Ada Data";
    }

    addCSVRow(rows, [
      source.name,
      source.pengunjung,
      source.daftar,
      source.test,
      source.daftar_ulang,
      source.berkuliah,
      `${formatConversionRate(source.conversion_rate)}%`,
      statusText
    ]);
  });

  downloadBlob(
    "\uFEFF" + rows.join("\r\n"),
    getReportFileName("csv"),
    "text/csv;charset=utf-8"
  );
}


function addPDFLine(doc, label, value, x, y) {
  doc.text(`${label}: ${value}`, x, y);
}


function downloadPDFReport() {
  const reportData = getCurrentReportData();

  if (!reportData) {
    alert("Data belum siap.");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Library PDF belum siap. Coba refresh halaman.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const left = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // IDENTITAS LAPORAN
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("LAPORAN PPDB ANALYTICS", left, y);

  y += 8;
  doc.setFontSize(12);
  doc.text("SMP NEGERI 5 DEPOK", left, y);

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  addPDFLine(doc, "Periode", reportData.selectedPeriod, left, y);
  y += 6;

  addPDFLine(doc, "Sumber Promosi", reportData.selectedChannel, left, y);
  y += 6;

  addPDFLine(doc, "Waktu Pembuatan", reportData.generatedAt, left, y);
  y += 6;

  addPDFLine(doc, "Jenis Data", "Data Simulasi Akademik", left, y);

  // RINGKASAN PERFORMA
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Ringkasan Performa", left, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  addPDFLine(
    doc,
    "Total Tayangan Iklan",
    reportData.summary.total_pengunjung.toLocaleString("id-ID"),
    left,
    y
  );
  y += 6;

  addPDFLine(
    doc,
    "Total Klik Iklan",
    reportData.summary.total_daftar.toLocaleString("id-ID"),
    left,
    y
  );
  y += 6;

  addPDFLine(
    doc,
    "Total Leads",
    reportData.summary.total_test.toLocaleString("id-ID"),
    left,
    y
  );
  y += 6;

  addPDFLine(
    doc,
    "Total Pendaftar",
    reportData.summary.total_daftar_ulang.toLocaleString("id-ID"),
    left,
    y
  );
  y += 6;

  addPDFLine(
    doc,
    "Total Siswa Diterima",
    reportData.summary.total_berkuliah.toLocaleString("id-ID"),
    left,
    y
  );
  y += 6;

  addPDFLine(
    doc,
    "Rasio Konversi",
    `${getTotalConversionRate()}%`,
    left,
    y
  );

  // TAHAPAN PENDAFTARAN
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Tahapan Pendaftaran", left, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  reportData.funnelData.forEach(function (stage) {
    addPDFLine(
      doc,
      stage.label,
      stage.count.toLocaleString("id-ID"),
      left,
      y
    );
    y += 6;
  });

  // INSIGHT PERFORMA
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Insight Performa", left, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  addPDFLine(
    doc,
    "Penurunan Terbesar",
    `${reportData.highestDrop.percent.toFixed(1)}%`,
    left,
    y
  );
  y += 6;

  addPDFLine(
    doc,
    "Tahapan Penurunan",
    reportData.highestDrop.label,
    left,
    y
  );
  y += 6;

  addPDFLine(
    doc,
    "Jumlah Selisih",
    reportData.highestDrop.value.toLocaleString("id-ID"),
    left,
    y
  );
  y += 6;

  addPDFLine(
    doc,
    "Channel Terbaik",
    reportData.bestSource
      ? `${reportData.bestSource.name} (${formatConversionRate(reportData.bestSource.conversion_rate)}%)`
      : "-",
    left,
    y
  );

  // GRAFIK
  if (monthlyChart) {
    try {
      const chartImage = monthlyChart.toBase64Image();

      y += 12;

      if (y + 85 > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Grafik Performa Channel", left, y);

      y += 6;

      doc.addImage(
        chartImage,
        "PNG",
        left,
        y,
        pageWidth - (left * 2),
        75
      );
    } catch (error) {
      console.warn("Grafik tidak dapat ditambahkan ke PDF:", error);
    }
  }

  // CATATAN
  y = doc.internal.pageSize.getHeight() - 15;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(
    "Catatan: Seluruh data merupakan data simulasi untuk keperluan tugas akademik.",
    left,
    y
  );

  doc.save(getReportFileName("pdf"));
}


function setupReportExport() {
  document.querySelectorAll("[data-report-toggle]").forEach(function (toggle) {
    toggle.onclick = function () {
      const exportMenu = toggle.closest(".report-export").querySelector(".export-menu");
      exportMenu.hidden = !exportMenu.hidden;
    };
  });

  document.querySelectorAll("[data-export-type]").forEach(function (button) {
    button.onclick = function () {
      const exportMenu = button.closest(".export-menu");
      const exportType = button.dataset.exportType;

      exportMenu.hidden = true;

      if (exportType === "pdf") downloadPDFReport();
      if (exportType === "csv") downloadCSVReport();
      if (exportType === "json") downloadJSONReport();
    };
  });
}

function downloadReport() {
  downloadJSONReport();
}


/* ================= INIT ================= */
window.addEventListener("load", async function () {
  try {
    const response = await fetch("auth.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "check"
      })
    });

    const result = await response.json();

    if (result.success) {
      showDashboardPage();
      return;
    }

  } catch (error) {
    console.error("Gagal mengecek session:", error);
  }

  showLoginPage();
});


document.getElementById("sendToN8nButton")?.addEventListener("click", async function () {
    const button = this;
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Mengirim data...";

    try {
        const response = await fetch("api.php?action=send_to_n8n");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Pengiriman data gagal.");
        }

        alert("Berhasil! Data PPDB telah dikirim ke n8n.");

    } catch (error) {
        alert("Gagal mengirim data: " + error.message);
        console.error("n8n Error:", error);

    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
});
