// Lista este pastrata in localStorage, inclusiv dupa refresh si deconectare.
const VALID_LOGIN = "Yonete";
const VALID_PASSWORD = "PicioareleLuiCezar!";
const STORAGE_KEY = "yoneteChampionBoard";
const CHAMPIONS_URL = "https://ddragon.leagueoflegends.com/cdn/16.18.1/data/en_US/champion.json";
const WEBP_BASE = "https://ddragon-webp.lolmath.net/latest/img/champion/";
const WEBP_VERSIONED_BASE = "https://ddragon-webp.lolmath.net/16.18.1/img/champion/";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const state = loadState();
const prices = { troll: 50, priority: 25, simple: 10 };
const specialNames = ["ce vrei tu", "ce vreau eu", "secret"];
let championIndex = {};
let championNames = [];

function isSecret(name) {
  return specialNames.includes(name.trim().toLocaleLowerCase("ro"));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      troll: Array.isArray(saved?.troll) ? saved.troll : [],
      priority: Array.isArray(saved?.priority) ? saved.priority : [],
      simple: Array.isArray(saved?.simple) ? saved.simple : []
    };
  } catch {
    return { troll: [], priority: [], simple: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalize(value) {
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function loadChampions() {
  try {
    const response = await fetch(CHAMPIONS_URL, { cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();

    championIndex = {};
    championNames = [];

    Object.values(json.data).forEach(champion => {
      const name = champion.name.trim();
      const key = normalize(name);
      championIndex[key] = {
        name,
        file: champion.image.full.replace(/\.png$/i, ".webp")
      };
      championNames.push(name);
    });

    championNames.sort((a, b) => a.localeCompare(b));
    refreshAllSuggestions();
  } catch (error) {
    console.warn("Lista campionilor Riot nu a putut fi incarcata:", error);
    // Chiar daca API-ul nu raspunde, utilizatorul poate introduce manual numele.
    refreshAllSuggestions();
  }

  Object.keys(state).forEach(renderCategory);
}

function getMatches(query) {
  const q = normalize(query);
  if (!q) return championNames.slice(0, 12);

  return championNames
    .map(name => ({ name, value: normalize(name) }))
    .sort((a, b) => {
      const aStarts = a.value.startsWith(q) ? 0 : 1;
      const bStarts = b.value.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.value.localeCompare(b.value);
    })
    .filter(item => item.value.includes(q))
    .slice(0, 10)
    .map(item => item.name);
}

function renderSuggestions(input, suggestions, forceShow = false) {
  if (!suggestions) return;
  const matches = getMatches(input.value);
  suggestions.innerHTML = "";

  if (!forceShow && !input.value.trim()) {
    suggestions.classList.remove("open");
    return;
  }

  if (!matches.length) {
    suggestions.classList.remove("open");
    return;
  }

  matches.forEach(name => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "suggestion-option";
    option.textContent = name;
    option.addEventListener("mousedown", event => {
      event.preventDefault();
      input.value = name;
      suggestions.classList.remove("open");
      input.focus();
    });
    suggestions.appendChild(option);
  });

  suggestions.classList.add("open");
}

function refreshAllSuggestions() {
  document.querySelectorAll(".champion-autocomplete").forEach(wrapper => {
    const input = wrapper.querySelector(".champion-name");
    const suggestions = wrapper.querySelector(".suggestions");
    if (input && suggestions && document.activeElement === input) {
      renderSuggestions(input, suggestions, true);
    }
  });
}

function imagePath(name) {
  if (isSecret(name)) return "images/secret.webp";

  const champion = championIndex[normalize(name)];
  if (champion?.file) {
    return WEBP_BASE + champion.file;
  }

  // Fallback pentru nume introduse manual: folosim numele ca filename .webp.
  return WEBP_BASE + encodeURIComponent(name.trim()) + ".webp";
}

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  if (username === VALID_LOGIN && password === VALID_PASSWORD) {
    loginError.textContent = "";
    sessionStorage.setItem("yoneteLoggedIn", "yes");
    showApp();
  } else {
    loginError.textContent = "Login sau parola incorecta. Incearca din nou.";
  }
});

document.getElementById("logout-button").addEventListener("click", () => {
  sessionStorage.removeItem("yoneteLoggedIn");
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  document.getElementById("password").value = "";
});

document.querySelectorAll(".category-panel").forEach(panel => {
  const category = panel.dataset.category;
  const form = panel.querySelector(".champion-form");
  const nameInput = panel.querySelector(".champion-name");
  const suggestions = panel.querySelector(".suggestions");

  nameInput.addEventListener("input", () => renderSuggestions(nameInput, suggestions));
  nameInput.addEventListener("focus", () => renderSuggestions(nameInput, suggestions, true));
  nameInput.addEventListener("keydown", event => {
    if (event.key === "Escape") suggestions.classList.remove("open");
  });
  document.addEventListener("click", event => {
    if (!panel.querySelector(".champion-autocomplete")?.contains(event.target)) {
      suggestions.classList.remove("open");
    }
  });

  const damageInput = panel.querySelector(".damage");
  const qtyOutput = panel.querySelector(".qty-value");
  let quantity = 1;

  panel.querySelector(".qty-minus").addEventListener("click", () => {
    quantity = Math.max(1, quantity - 1);
    qtyOutput.textContent = quantity;
  });
  panel.querySelector(".qty-plus").addEventListener("click", () => {
    quantity += 1;
    qtyOutput.textContent = quantity;
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const typedName = nameInput.value.trim();
    if (!typedName) return;

    // Daca numele corespunde unui campion, salvam forma oficiala.
    const official = championIndex[normalize(typedName)]?.name;
    const name = official || typedName;

    state[category].push({
      id: Date.now() + Math.random(),
      name,
      damage: damageInput.value,
      quantity
    });

    saveState();
    nameInput.value = "";
    suggestions.classList.remove("open");
    quantity = 1;
    qtyOutput.textContent = quantity;
    renderCategory(category);
  });
});

function renderCategory(category) {
  const panel = document.querySelector(`[data-category="${category}"]`);
  const list = panel.querySelector(".champion-list");
  list.innerHTML = "";

  if (state[category].length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = "Niciun campion adaugat inca.";
    list.appendChild(empty);
    return;
  }

  state[category].forEach(entry => {
    const card = document.createElement("div");
    card.className = "champion-entry";

    const img = document.createElement("img");
    img.src = imagePath(entry.name);
    img.alt = entry.name;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";

    // Incearca si varianta versionata a aceluiasi CDN daca latest nu raspunde.
    img.onerror = () => {
      const current = img.getAttribute("src") || "";
      if (current.includes("ddragon-webp.lolmath.net/latest/")) {
        img.src = current.replace("/latest/", "/16.18.1/");
      } else {
        img.onerror = null;
        img.src = "images/placeholder.svg";
      }
    };

    const info = document.createElement("div");
    const title = document.createElement("div");
    title.className = "champ-name";
    title.textContent = entry.name;

    const meta = document.createElement("div");
    meta.className = "champ-meta";
    const damage = document.createElement("span");
    damage.className = "pill " + entry.damage.toLowerCase();
    damage.textContent = entry.damage;
    const categoryPrice = document.createElement("span");
    categoryPrice.className = "pill price-pill";
    categoryPrice.textContent = prices[category] + " lei";
    meta.append(damage, categoryPrice);

    const controls = document.createElement("div");
    controls.className = "entry-controls";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.addEventListener("click", () => {
      entry.quantity = Math.max(1, entry.quantity - 1);
      saveState();
      renderCategory(category);
    });
    const count = document.createElement("span");
    count.textContent = "x" + entry.quantity;
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", () => {
      entry.quantity += 1;
      saveState();
      renderCategory(category);
    });
    controls.append(minus, count, plus);
    info.append(title, meta, controls);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-entry";
    remove.textContent = "×";
    remove.title = "Sterge campionul";
    remove.addEventListener("click", () => {
      state[category] = state[category].filter(item => item.id !== entry.id);
      saveState();
      renderCategory(category);
    });

    card.append(img, info, remove);
    list.appendChild(card);
  });
}

Object.keys(state).forEach(renderCategory);
if (sessionStorage.getItem("yoneteLoggedIn") === "yes") showApp();
loadChampions();
