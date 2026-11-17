
// ========================================
// STUDYMATE - MULTI USER STUDY PLANNER
// ========================================

const API_BASE_URL = "http://127.0.0.1:5000";
const TOKEN_KEY = "sm_auth_token";

let authToken = localStorage.getItem(TOKEN_KEY);
let currentUser = null;

let tasks = [];
let player = { xp: 0, streak: 0, lastStudyDate: "", sessions: 0 };
let focusData = {};
let dailyGoal = 180;
let challengeClaimed = "";

let currentFilter = "all";
let calendarDate = new Date();
let selectedDate = getTodayKey();

let timerSeconds = 25 * 60;
let timerMode = "focus";
let timerInterval = null;
let timerRunning = false;
let toastTimeout = null;


// ========================================
// API CONNECTION
// ========================================

async function apiRequest(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (authToken) {
        headers.Authorization = "Bearer " + authToken;
    }

    const response = await fetch(API_BASE_URL + path, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && path !== "/api/auth/login" &&
        path !== "/api/auth/register") {
        logout(false);
        throw new Error("Your session expired. Please log in again.");
    }

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
    }

    return data;
}


// ========================================
// AUTHENTICATION SCREEN
// ========================================

function createAuthScreen() {
    if (document.getElementById("authScreen")) return;

    const style = document.createElement("style");

    style.textContent = `
        #authScreen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #080d1b;
            color: white;
            font-family: Arial, sans-serif;
        }

        #authScreen * { box-sizing: border-box; }

        .auth-card {
            width: 100%;
            max-width: 430px;
            padding: 35px;
            border-radius: 20px;
            background: #111a2e;
            border: 1px solid #273653;
            box-shadow: 0 20px 60px #0006;
        }

        .auth-logo {
            text-align: center;
            font-size: 29px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #9d8cff;
        }

        .auth-subtitle {
            text-align: center;
            color: #9aa9c4;
            margin-bottom: 28px;
        }

        .auth-card h2 {
            text-align: center;
            margin-bottom: 22px;
        }

        .auth-card label {
            display: block;
            margin: 14px 0 7px;
            color: #cbd5e1;
            font-size: 14px;
        }

        .auth-card input {
            width: 100%;
            padding: 13px;
            border: 1px solid #34435f;
            border-radius: 9px;
            background: #0b1427;
            color: white;
            outline: none;
        }

        .auth-card input:focus {
            border-color: #8b7cff;
        }

        .auth-submit {
            width: 100%;
            padding: 14px;
            margin-top: 22px;
            border: none;
            border-radius: 9px;
            background: #806cff;
            color: white;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
        }

        .auth-submit:disabled {
            opacity: .6;
            cursor: wait;
        }

        .auth-switch {
            text-align: center;
            margin-top: 20px;
            color: #aab6cc;
            font-size: 14px;
        }

        .auth-switch button {
            background: none;
            border: none;
            color: #a99aff;
            cursor: pointer;
            font-weight: bold;
        }

        .auth-error {
            color: #ff8585;
            font-size: 13px;
            margin-top: 13px;
            text-align: center;
            min-height: 18px;
        }

        .auth-help {
            color: #8795ad;
            font-size: 12px;
            text-align: center;
            margin-top: 15px;
        }

        @media(max-width:480px) {
            .auth-card { padding: 25px 20px; }
        }
    `;

    document.head.appendChild(style);

    const screen = document.createElement("div");
    screen.id = "authScreen";
    document.body.prepend(screen);

    document.querySelector(".app").style.display = "none";

    showAuthForm("login");
}


function showAuthForm(mode) {
    const screen = document.getElementById("authScreen");
    if (!screen) return;

    const isRegister = mode === "register";

    screen.innerHTML = `
        <div class="auth-card">
            <div class="auth-logo">✦ StudyMate</div>
            <p class="auth-subtitle">Your personal learning space</p>

            <h2>${isRegister ? "Create Your Account" : "Welcome Back!"}</h2>

            <form id="authForm">
                ${isRegister ? `
                    <label for="authName">Full Name</label>
                    <input id="authName" type="text"
                        placeholder="Enter your name"
                        minlength="2" maxlength="80" required>
                ` : ""}

                <label for="authEmail">Email Address</label>
                <input id="authEmail" type="email"
                    placeholder="you@example.com" required>

                <label for="authPassword">Password</label>
                <input id="authPassword" type="password"
                    placeholder="At least 8 characters"
                    minlength="8" required>

                <div id="authError" class="auth-error"></div>

                <button class="auth-submit" id="authSubmit" type="submit">
                    ${isRegister ? "Create Account" : "Login"}
                </button>
            </form>

            <p class="auth-switch">
                ${isRegister
                    ? 'Already have an account? <button id="switchAuth">Login</button>'
                    : 'New to StudyMate? <button id="switchAuth">Create an account</button>'}
            </p>

            <p class="auth-help">
                Your tasks and study progress are saved to your own account.
            </p>
        </div>
    `;

    document.getElementById("switchAuth").onclick = function() {
        showAuthForm(isRegister ? "login" : "register");
    };

    document.getElementById("authForm").onsubmit = async function(event) {
        event.preventDefault();

        const button = document.getElementById("authSubmit");
        const errorBox = document.getElementById("authError");

        const email = document.getElementById("authEmail").value.trim();
        const password = document.getElementById("authPassword").value;

        const payload = { email, password };

        if (isRegister) {
            payload.name = document.getElementById("authName").value.trim();
        }

        button.disabled = true;
        button.textContent = "Please wait...";
        errorBox.textContent = "";

        try {
            const result = await apiRequest(
                isRegister ? "/api/auth/register" : "/api/auth/login",
                {
                    method: "POST",
                    body: JSON.stringify(payload)
                }
            );

            authToken = result.token;
            localStorage.setItem(TOKEN_KEY, authToken);

            await enterDashboard(result.user, result.profile);

        } catch (error) {
            errorBox.textContent = error.message;
            button.disabled = false;
            button.textContent = isRegister ? "Create Account" : "Login";
        }
    };
}


// ========================================
// LOGIN SESSION
// ========================================

async function enterDashboard(user, initialProfile) {
    currentUser = user;

    if (initialProfile) {
        applyProfile(initialProfile);
    }

    try {
        const results = await Promise.all([
            apiRequest("/api/tasks"),
            apiRequest("/api/profile")
        ]);

        tasks = results[0];
        applyProfile(results[1]);

    } catch (error) {
        console.error(error);
        notify("Could not load your account data.");
        return;
    }

    document.getElementById("authScreen").style.display = "none";
    document.querySelector(".app").style.display = "";

    updateUserDetails();
    addLogoutButton();

    document.getElementById("goalInput").value = dailyGoal;

    document.getElementById("todayDate").textContent =
        new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    renderTimer();
    displayTasks();
    renderCalendar();
    updateDashboard();

    notify("Welcome to StudyMate, " + currentUser.name + "!");
}


function applyProfile(profile) {
    player = {
        xp: profile.xp || 0,
        streak: profile.streak || 0,
        lastStudyDate: profile.lastStudyDate || "",
        sessions: profile.sessions || 0
    };

    focusData = profile.focusData || {};
    dailyGoal = profile.dailyGoal || 180;
    challengeClaimed = profile.challengeClaimed || "";
}


function updateUserDetails() {
    if (!currentUser) return;

    const playerName = document.querySelector(".player h3");
    if (playerName) playerName.textContent = currentUser.name;

    const avatar = document.querySelector(".avatar");
    if (avatar) avatar.textContent = currentUser.name.charAt(0).toUpperCase();

    const heading = document.querySelector(".topbar h1");
    if (heading) heading.textContent = "Welcome back, " + currentUser.name + "!";

    const motto = document.querySelector(".player p");
    if (motto) motto.textContent = "PERSONAL ACCOUNT";
}


function addLogoutButton() {
    if (document.getElementById("logoutBtn")) return;

    const playerBox = document.querySelector(".player");
    if (!playerBox) return;

    const button = document.createElement("button");
    button.id = "logoutBtn";
    button.textContent = "↪ Logout";

    button.style.cssText = `
        margin-top: 12px;
        padding: 9px 18px;
        border: 1px solid #53617b;
        border-radius: 8px;
        background: transparent;
        color: white;
        cursor: pointer;
    `;

    button.onclick = function() {
        logout(true);
    };

    playerBox.appendChild(button);
}


async function logout(showMessage = true) {
    if (authToken) {
        try {
            await apiRequest("/api/auth/logout", { method: "POST" });
        } catch (error) {
            console.warn("Logout request could not be completed.");
        }
    }

    localStorage.removeItem(TOKEN_KEY);
    authToken = null;
    currentUser = null;

    clearInterval(timerInterval);
    timerRunning = false;

    tasks = [];
    player = { xp: 0, streak: 0, lastStudyDate: "", sessions: 0 };
    focusData = {};
    dailyGoal = 180;
    challengeClaimed = "";

    document.querySelector(".app").style.display = "none";

    createAuthScreen();
    showAuthForm("login");

    if (showMessage) {
        notify("You have logged out.");
    }
}


// ========================================
// PROFILE SAVING
// ========================================

async function saveAll() {
    if (!authToken) return;

    try {
        await apiRequest("/api/profile", {
            method: "PUT",
            body: JSON.stringify({
                xp: player.xp,
                streak: player.streak,
                lastStudyDate: player.lastStudyDate,
                sessions: player.sessions,
                focusData: focusData,
                dailyGoal: dailyGoal,
                challengeClaimed: challengeClaimed
            })
        });
    } catch (error) {
        console.error("Profile save failed:", error);
    }
}


// ========================================
// DATE HELPERS
// ========================================

function formatKey(date) {
    let y = date.getFullYear();
    let m = String(date.getMonth() + 1).padStart(2, "0");
    let d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function getTodayKey() {
    return formatKey(new Date());
}

function getYesterdayKey() {
    let date = new Date();
    date.setDate(date.getDate() - 1);
    return formatKey(date);
}


// ========================================
// NOTIFICATIONS
// ========================================

function notify(message) {
    let toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(function() {
        toast.classList.remove("show");
    }, 2500);
}


// ========================================
// XP AND LEVELS
// ========================================

function getLevel() {
    return Math.floor(player.xp / 100) + 1;
}

function getRank(level) {
    if (level >= 10) return "Legendary Scholar";
    if (level >= 7) return "Master Learner";
    if (level >= 5) return "Knowledge Warrior";
    if (level >= 3) return "Focused Achiever";
    if (level >= 2) return "Rising Learner";
    return "Beginner Explorer";
}

function earnXP(amount, message) {
    let oldLevel = getLevel();
    player.xp += amount;
    let newLevel = getLevel();

    saveAll();
    updateDashboard();

    notify("+" + amount + " XP! " + message);

    if (newLevel > oldLevel) {
        setTimeout(function() {
            notify("LEVEL UP! Welcome to Level " + newLevel + "!");
        }, 900);
    }
}


// ========================================
// TASKS
// ========================================

async function addTask() {
    let input = document.getElementById("taskInput");
    let name = input.value.trim();
    let priority = document.getElementById("priorityInput").value;

    if (!name) {
        notify("Enter a mission first!");
        input.focus();
        return;
    }

    try {
        const task = await apiRequest("/api/tasks", {
            method: "POST",
            body: JSON.stringify({
                name,
                priority,
                completed: false,
                xpAwarded: false,
                completedAt: null
            })
        });

        tasks.push(task);
        input.value = "";
        displayTasks();
        notify("New mission added!");

    } catch (error) {
        notify(error.message);
    }
}


document.getElementById("taskInput").addEventListener("keydown", function(event) {
    if (event.key === "Enter") addTask();
});


async function toggleTask(id) {
    let task = tasks.find(item => item.id === id);
    if (!task) return;

    const wasCompleted = task.completed;
    const newCompleted = !wasCompleted;
    const hadXP = Boolean(task.xpAwarded);

    try {
        const updated = await apiRequest("/api/tasks/" + id, {
            method: "PUT",
            body: JSON.stringify({
                completed: newCompleted,
                completedAt: newCompleted ? getTodayKey() : null,
                xpAwarded: hadXP || newCompleted
            })
        });

        Object.assign(task, updated);

        if (newCompleted && !hadXP) {
            earnXP(20, "Mission completed!");
        }

        displayTasks();
        saveAll();
        checkDailyChallenges();

    } catch (error) {
        notify(error.message);
    }
}


async function deleteTask(id) {
    try {
        await apiRequest("/api/tasks/" + id, {
            method: "DELETE"
        });

        tasks = tasks.filter(task => task.id !== id);
        displayTasks();
        notify("Mission removed.");

    } catch (error) {
        notify(error.message);
    }
}


function setFilter(filter, button) {
    currentFilter = filter;

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    button.classList.add("active");
    displayTasks();
}


function displayTasks() {
    let list = document.getElementById("taskList");
    let search = document.getElementById("searchInput").value.toLowerCase().trim();

    list.innerHTML = "";

    let filtered = tasks.filter(task => {
        let searchMatch = task.name.toLowerCase().includes(search);

        let filterMatch =
            currentFilter === "all" ||
            (currentFilter === "pending" && !task.completed) ||
            (currentFilter === "completed" && task.completed);

        return searchMatch && filterMatch;
    });

    filtered.forEach(task => {
        let card = document.createElement("div");
        card.className = "study-card";

        if (task.completed) card.classList.add("completed");

        let info = document.createElement("div");
        info.className = "task-info";

        let title = document.createElement("h3");
        title.textContent = task.name;

        let status = document.createElement("p");
        status.textContent = task.completed
            ? "✓ Mission accomplished"
            : "◉ Mission in progress";

        info.append(title, status);

        let priority = document.createElement("span");
        priority.className = "priority " + task.priority.toLowerCase();
        priority.textContent = task.priority;

        let done = document.createElement("button");
        done.className = "done-btn";
        done.textContent = task.completed ? "↶ Undo" : "✓ Complete";
        done.onclick = () => toggleTask(task.id);

        let remove = document.createElement("button");
        remove.className = "delete-btn";
        remove.textContent = "✕";
        remove.onclick = () => deleteTask(task.id);

        card.append(info, priority, done, remove);
        list.appendChild(card);
    });

    document.getElementById("emptyMessage").style.display =
        filtered.length ? "none" : "block";

    updateDashboard();
}


// ========================================
// DAILY STUDY GOAL
// ========================================

document.getElementById("goalInput").value = dailyGoal;

async function saveGoal() {
    let value = Number(document.getElementById("goalInput").value);

    if (!Number.isInteger(value) || value < 1 || value > 1440) {
        notify("Enter a goal between 1 and 1440 minutes.");
        return;
    }

    dailyGoal = value;
    await saveAll();
    updateDashboard();
    notify("Daily goal updated!");
}


// ========================================
// FOCUS TIMER
// ========================================

function renderTimer() {
    let minutes = Math.floor(timerSeconds / 60);
    let seconds = timerSeconds % 60;

    document.getElementById("timer").textContent =
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");

    document.getElementById("timerMode").textContent =
        timerMode === "focus" ? "FOCUS SESSION" : "BREAK TIME";
}


function startTimer() {
    if (timerRunning) return;

    timerRunning = true;
    document.getElementById("startBtn").textContent = "▶ Running";

    timerInterval = setInterval(function() {
        timerSeconds--;
        renderTimer();

        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            timerRunning = false;
            document.getElementById("startBtn").textContent = "▶ Start";

            if (timerMode === "focus") {
                completeFocusSession();
            } else {
                notify("Break completed! Time to focus.");
                timerMode = "focus";
                timerSeconds = 25 * 60;
                renderTimer();
            }
        }
    }, 1000);
}


function pauseTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById("startBtn").textContent = "▶ Resume";
}


function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerMode = "focus";
    timerSeconds = 25 * 60;
    document.getElementById("startBtn").textContent = "▶ Start";
    renderTimer();
}


function startBreak() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerMode = "break";
    timerSeconds = 5 * 60;
    renderTimer();
    document.getElementById("startBtn").textContent = "▶ Start Break";
    startTimer();
}


async function completeFocusSession() {
    let today = getTodayKey();

    focusData[today] = focusData[today] || {
        minutes: 0,
        sessions: 0
    };

    focusData[today].minutes += 25;
    focusData[today].sessions += 1;
    player.sessions++;

    if (player.lastStudyDate !== today) {
        player.streak = player.lastStudyDate === getYesterdayKey()
            ? player.streak + 1
            : 1;

        player.lastStudyDate = today;
    }

    timerMode = "focus";
    timerSeconds = 25 * 60;

    earnXP(50, "Focus session completed!");
    await saveAll();

    renderTimer();
    updateDashboard();
    checkDailyChallenges();

    alert("Focus session completed! You earned 25 study minutes and 50 XP.");
}


// ========================================
// SMART STUDY SUGGESTION
// ========================================

function suggestTask() {
    let pending = tasks.filter(task => !task.completed);

    if (!pending.length) {
        document.getElementById("suggestionText").textContent =
            "All missions completed! Add a new mission to continue.";
        return;
    }

    let order = { High: 1, Medium: 2, Low: 3 };

    pending.sort((a, b) => order[a.priority] - order[b.priority]);

    document.getElementById("suggestionText").textContent =
        "Recommended mission: " + pending[0].name +
        " — " + pending[0].priority + " Priority.";

    document.getElementById("tasks").scrollIntoView({
        behavior: "smooth"
    });
}


// ========================================
// DAILY CHALLENGES
// ========================================

function getTodayCompletedTasks() {
    return tasks.filter(task =>
        task.completed && task.completedAt === getTodayKey()
    ).length;
}


function getTodaySessions() {
    let record = focusData[getTodayKey()];
    return record ? record.sessions || 0 : 0;
}


async function checkDailyChallenges() {
    let today = getTodayKey();

    let progress = getTodayCompletedTasks() >= 3 &&
                   getTodaySessions() >= 2;

    if (progress && challengeClaimed !== today) {
        challengeClaimed = today;
        earnXP(50, "Daily challenges completed! Bonus reward!");
        await saveAll();
    }

    updateChallenges();
}


function updateChallenges() {
    let completed = Math.min(3, getTodayCompletedTasks());
    let sessions = Math.min(2, getTodaySessions());

    document.getElementById("taskChallengeFill").style.width =
        (completed / 3 * 100) + "%";

    document.getElementById("focusChallengeFill").style.width =
        (sessions / 2 * 100) + "%";

    document.getElementById("taskChallengeText").textContent =
        completed + " / 3 completed";

    document.getElementById("focusChallengeText").textContent =
        sessions + " / 2 completed";

    if (challengeClaimed === getTodayKey()) {
        document.getElementById("challengeReward").textContent =
            "🏆 Daily challenges completed! Bonus XP claimed.";
    } else if (completed >= 3 && sessions >= 2) {
        document.getElementById("challengeReward").textContent =
            "Both challenges complete! Your bonus is ready.";
    } else {
        document.getElementById("challengeReward").textContent =
            "Complete both challenges to earn 50 bonus XP!";
    }
}


// ========================================
// WEEKLY ANALYTICS
// ========================================

function updateAnalytics() {
    let today = new Date();
    let weekMinutes = 0;
    let weekTasks = 0;
    let days = [];

    for (let i = 6; i >= 0; i--) {
        let date = new Date(today);
        date.setDate(today.getDate() - i);

        let key = formatKey(date);
        let record = focusData[key] || { minutes: 0, sessions: 0 };

        let minutes = typeof record === "number"
            ? record
            : record.minutes || 0;

        let completed = tasks.filter(task =>
            task.completedAt === key
        ).length;

        weekMinutes += minutes;
        weekTasks += completed;

        days.push({
            label: date.toLocaleDateString("en-IN", { weekday: "short" }),
            minutes: minutes
        });
    }

    document.getElementById("weeklyMinutes").textContent =
        weekMinutes + " min";

    document.getElementById("weeklyTasks").textContent = weekTasks;

    let maxMinutes = Math.max(60, ...days.map(day => day.minutes));
    let chart = document.getElementById("weeklyChart");
    chart.innerHTML = "";

    days.forEach(day => {
        let column = document.createElement("div");
        column.className = "chart-column";

        let value = document.createElement("span");
        value.className = "chart-value";
        value.textContent = day.minutes;

        let wrap = document.createElement("div");
        wrap.className = "chart-bar-wrap";

        let bar = document.createElement("div");
        bar.className = "chart-bar";
        bar.style.height =
            Math.max(3, day.minutes / maxMinutes * 100) + "%";
        bar.title = day.minutes + " focus minutes";

        wrap.appendChild(bar);

        let label = document.createElement("span");
        label.className = "chart-day";
        label.textContent = day.label;

        column.append(value, wrap, label);
        chart.appendChild(column);
    });
}


// ========================================
// STUDY CALENDAR
// ========================================

function changeMonth(amount) {
    calendarDate.setDate(1);
    calendarDate.setMonth(calendarDate.getMonth() + amount);
    renderCalendar();
}


function renderCalendar() {
    let year = calendarDate.getFullYear();
    let month = calendarDate.getMonth();

    document.getElementById("calendarMonth").textContent =
        calendarDate.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric"
        });

    let grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";

    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(day => {
        let heading = document.createElement("div");
        heading.className = "calendar-day-name";
        heading.textContent = day;
        grid.appendChild(heading);
    });

    let firstDay = new Date(year, month, 1).getDay();
    let totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        let blank = document.createElement("div");
        blank.className = "calendar-cell empty";
        grid.appendChild(blank);
    }

    for (let day = 1; day <= totalDays; day++) {
        let date = new Date(year, month, day);
        let key = formatKey(date);
        let record = focusData[key] || { minutes: 0, sessions: 0 };

        let minutes = typeof record === "number"
            ? record
            : record.minutes || 0;

        let completed = tasks.filter(task =>
            task.completedAt === key
        ).length;

        let cell = document.createElement("button");
        cell.className = "calendar-cell";

        if (minutes > 0 || completed > 0) {
            cell.classList.add("has-activity");
        }

        if (key === getTodayKey()) cell.classList.add("today");
        if (key === selectedDate) cell.classList.add("selected");

        let number = document.createElement("span");
        number.textContent = day;
        cell.appendChild(number);

        if (minutes > 0 || completed > 0) {
            let dot = document.createElement("small");
            dot.textContent = "●";
            cell.appendChild(dot);
        }

        cell.onclick = function() {
            selectedDate = key;
            renderCalendar();
            showCalendarDetails(key);
        };

        grid.appendChild(cell);
    }

    showCalendarDetails(selectedDate);
}


function showCalendarDetails(key) {
    let record = focusData[key] || { minutes: 0, sessions: 0 };

    let minutes = typeof record === "number"
        ? record
        : record.minutes || 0;

    let sessions = typeof record === "number"
        ? 0
        : record.sessions || 0;

    let completed = tasks.filter(task =>
        task.completedAt === key
    ).length;

    document.getElementById("calendarDetails").textContent =
        key + " — " + minutes + " focus minutes, " +
        sessions + " focus sessions, " +
        completed + " tasks completed.";
}


// ========================================
// ACHIEVEMENTS
// ========================================

function updateBadges() {
    let completed = tasks.filter(task => task.completed).length;

    let badges = [
        ["🚀", "First Step", "Earn 20 XP", player.xp >= 20],
        ["🎯", "Mission Master", "Complete 5 missions", completed >= 5],
        ["⚡", "XP Hunter", "Earn 100 XP", player.xp >= 100],
        ["🔥", "Consistency", "3-day study streak", player.streak >= 3],
        ["🧠", "Deep Focus", "Complete 5 sessions", player.sessions >= 5],
        ["🏆", "High Achiever", "Earn 500 XP", player.xp >= 500],
        ["👑", "Scholar Elite", "Reach Level 5", getLevel() >= 5],
        ["💎", "Legend", "Earn 1000 XP", player.xp >= 1000]
    ];

    let container = document.getElementById("badgesGrid");
    container.innerHTML = "";

    badges.forEach(badge => {
        let card = document.createElement("div");
        card.className = "badge-card" + (badge[3] ? "" : " locked");

        let icon = document.createElement("div");
        icon.className = "badge-icon";
        icon.textContent = badge[0];

        let title = document.createElement("h3");
        title.textContent = badge[1];

        let description = document.createElement("p");
        description.textContent = badge[3] ? "UNLOCKED" : badge[2];

        card.append(icon, title, description);
        container.appendChild(card);
    });
}


// ========================================
// DASHBOARD UPDATE
// ========================================

function updateDashboard() {
    let total = tasks.length;
    let completed = tasks.filter(task => task.completed).length;

    let level = getLevel();
    let xpInLevel = player.xp % 100;

    let record = focusData[getTodayKey()] || { minutes: 0, sessions: 0 };
    let todayMinutes = typeof record === "number"
        ? record
        : record.minutes || 0;

    document.getElementById("totalTasks").textContent = total;
    document.getElementById("completedTasks").textContent = completed;
    document.getElementById("pendingTasks").textContent = total - completed;

    document.getElementById("xpCount").textContent = player.xp;
    document.getElementById("levelLabel").textContent = "LEVEL " + level;
    document.getElementById("levelNumber").textContent = "LVL " + level;
    document.getElementById("rankName").textContent = getRank(level);

    document.getElementById("levelFill").style.width = xpInLevel + "%";
    document.getElementById("levelProgress").textContent =
        xpInLevel + " / 100 XP to next level";

    document.getElementById("streakCount").textContent = player.streak;
    document.getElementById("sessionCount").textContent = player.sessions;

    document.getElementById("goalMinutes").textContent = todayMinutes;

    let percentage = Math.min(
        100,
        Math.round(todayMinutes / dailyGoal * 100)
    );

    document.getElementById("goalText").textContent =
        todayMinutes + " / " + dailyGoal + " minutes";

    document.getElementById("goalFill").style.width = percentage + "%";

    updateBadges();
    updateChallenges();
    updateAnalytics();
}


// ========================================
// APP INITIALIZATION
// ========================================

async function initializeApp() {
    createAuthScreen();

    if (!authToken) {
        showAuthForm("login");
        return;
    }

    try {
        const result = await apiRequest("/api/auth/me");
        const profile = await apiRequest("/api/profile");

        await enterDashboard(result.user, profile);

    } catch (error) {
        console.error(error);
        localStorage.removeItem(TOKEN_KEY);
        authToken = null;
        showAuthForm("login");
    }
}

initializeApp();
