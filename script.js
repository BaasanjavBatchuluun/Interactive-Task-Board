(() => {
  "use strict";

  const STORAGE_KEY = "kanbanLite.tasks";
  const THEME_KEY = "kanbanLite.theme";

  const STATUSES = ["todo", "inprogress", "completed"];

  // ---------- DOM references ----------
  const taskForm = document.getElementById("taskForm");
  const titleInput = document.getElementById("taskTitle");
  const descInput = document.getElementById("taskDescription");
  const categoryInput = document.getElementById("taskCategory");
  const priorityInput = document.getElementById("taskPriority");

  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const clearCompletedBtn = document.getElementById("clearCompleted");
  const themeToggle = document.getElementById("themeToggle");

  const activeCountEl = document.getElementById("activeCount");
  const completedCountEl = document.getElementById("completedCount");

  const columns = document.querySelectorAll(".column");

  // ---------- State ----------
  let tasks = loadTasks();


  /** Read tasks from localStorage (returns [] if missing or corrupted). */
  function loadTasks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.warn("Could not read saved tasks:", error);
      return [];
    }
  }

  /** Write the current tasks array to localStorage. */
  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  // Task operations (add / move / delete)

  function addTask({ title, description, category, priority }) {
    tasks.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title,
      description,
      category,
      priority,
      status: "todo",
      createdAt: Date.now(),
    });
    commit();
  }

  /** Move a task to a specific column. */
  function moveTask(id, newStatus) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === newStatus) return;
    task.status = newStatus;
    commit();
  }

  /** Shift a task one column left (-1) or right (+1). */
  function shiftTask(id, direction) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const nextIndex = STATUSES.indexOf(task.status) + direction;
    if (nextIndex < 0 || nextIndex >= STATUSES.length) return;
    moveTask(id, STATUSES[nextIndex]);
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    commit();
  }

  function clearCompleted() {
    tasks = tasks.filter((t) => t.status !== "completed");
    commit();
  }

  /** Save + re-render after every state change. */
  function commit() {
    saveTasks();
    render();
  }

  // Rendering

  /** Apply the search text + category dropdown to the task list. */
  function getVisibleTasks() {
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;

    return tasks.filter((task) => {
      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesCategory = category === "all" || task.category === category;
      return matchesTitle && matchesCategory;
    });
  }

  function render() {
    const visible = getVisibleTasks();

    STATUSES.forEach((status) => {
      const list = document.getElementById(`list-${status}`);
      const items = visible.filter((t) => t.status === status);

      list.replaceChildren(); // clear old cards

      if (items.length === 0) {
        list.append(createEmptyState(status));
      } else {
        items.forEach((task) => list.append(createCard(task)));
      }

      // Column badge shows the filtered count
      document.getElementById(`count-${status}`).textContent = items.length;
    });

    // Header counter always reflects ALL tasks, not just filtered ones
    const completed = tasks.filter((t) => t.status === "completed").length;
    activeCountEl.textContent = tasks.length - completed;
    completedCountEl.textContent = completed;
  }

  function createEmptyState(status) {
    const messages = {
      todo: "Nothing planned — add a task above.",
      inprogress: "Drag a task here when you start it.",
      completed: "Finished tasks will land here.",
    };
    const div = document.createElement("div");
    div.className = "empty-state";
    div.textContent = messages[status];
    return div;
  }

  /** Small helper: build an element with class + text safely (no innerHTML). */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createCard(task) {
    const card = el("article", "task-card");
    card.dataset.id = task.id;
    card.dataset.priority = task.priority;
    card.draggable = true;
    if (task.status === "completed") card.classList.add("is-done");

    // Badges: priority + category
    const meta = el("div", "task-card__meta");
    const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    meta.append(
      el("span", `badge badge--${task.priority}`, priorityLabel),
      el("span", "badge badge--category", task.category)
    );

    const title = el("h3", "task-card__title", task.title);
    card.append(meta, title);

    if (task.description) {
      card.append(el("p", "task-card__desc", task.description));
    }

    // Action buttons: ← → (move) and delete
    const actions = el("div", "task-card__actions");
    const index = STATUSES.indexOf(task.status);

    const leftBtn = el("button", "mini-btn", "←");
    leftBtn.type = "button";
    leftBtn.title = "Move left";
    leftBtn.setAttribute("aria-label", "Move task left");
    leftBtn.disabled = index === 0;
    leftBtn.addEventListener("click", () => shiftTask(task.id, -1));

    const rightBtn = el("button", "mini-btn", "→");
    rightBtn.type = "button";
    rightBtn.title = "Move right";
    rightBtn.setAttribute("aria-label", "Move task right");
    rightBtn.disabled = index === STATUSES.length - 1;
    rightBtn.addEventListener("click", () => shiftTask(task.id, 1));

    const deleteBtn = el("button", "mini-btn mini-btn--danger", "🗑");
    deleteBtn.type = "button";
    deleteBtn.title = "Delete task";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    actions.append(leftBtn, rightBtn, el("span", "task-card__spacer"), deleteBtn);
    card.append(actions);

    // Drag & drop (bonus)
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", task.id);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));

    return card;
  }

  // ==========================================================
  // Event listeners
  // ==========================================================

  // Add task
  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;

    addTask({
      title,
      description: descInput.value.trim(),
      category: categoryInput.value,
      priority: priorityInput.value,
    });

    taskForm.reset();
    priorityInput.value = "medium"; // reset() would revert to the HTML default anyway
    titleInput.focus();
  });

  // Live search + category filter
  searchInput.addEventListener("input", render);
  categoryFilter.addEventListener("change", render);

  clearCompletedBtn.addEventListener("click", () => {
    const hasCompleted = tasks.some((t) => t.status === "completed");
    if (hasCompleted && confirm("Remove all completed tasks?")) clearCompleted();
  });

  // Drop targets: each column accepts dragged cards
  columns.forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault(); // required to allow dropping
      event.dataTransfer.dropEffect = "move";
      column.classList.add("drag-over");
    });

    column.addEventListener("dragleave", (event) => {
      // Ignore dragleave events fired when moving over child elements
      if (!column.contains(event.relatedTarget)) column.classList.remove("drag-over");
    });

    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      const id = event.dataTransfer.getData("text/plain");
      if (id) moveTask(id, column.dataset.status);
    });
  });

  // Dark mode


  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });

  // Saved choice wins; otherwise follow the operating system preference
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

  render();
})();
