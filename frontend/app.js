const API = "http://localhost:8080/api/tasks";

const $ = (s) => document.querySelector(s);
const list = $("#list");
const msg = $("#msg");

let calendar;

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function toCalendarDate(value) {
  if (value === null || value === undefined) return null;

  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s;

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m) {
    let [, dd, mm, yyyy, HH, MI] = m;
    dd = dd.padStart(2, "0");
    mm = mm.padStart(2, "0");
    HH = HH.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${HH}:${MI}:00`;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    let [, dd, mm, yyyy, HH, MI, SS] = m;
    dd = dd.padStart(2, "0");
    mm = mm.padStart(2, "0");
    HH = HH.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${HH}:${MI}:${SS}`;
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, yyyy, mm, dd, HH, MI, SS] = m;
    return `${yyyy}-${mm}-${dd}T${HH}:${MI}:${SS ?? "00"}`;
  }

  return null;
}

function toApiDate(date) {
  if (!date) return null;

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const MI = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${HH}:${MI}`;
}

async function apiGet() {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST ${res.status}: ${txt}`);
  }
  return res.json();
}

async function apiPut(id, body) {
  const res = await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT ${res.status}: ${txt}`);
  }
  return res.json();
}

async function apiToggle(id) {
  const res = await fetch(`${API}/${id}/toggle`, { method: "PATCH" });
  if (!res.ok) throw new Error(`PATCH ${res.status}`);
}

async function apiDelete(id) {
  const res = await fetch(`${API}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${res.status}`);
}

function renderList(tasks) {
  list.innerHTML = "";
  if (!tasks.length) {
    list.innerHTML = `<li class="list-group-item text-muted">No hay tareas</li>`;
    return;
  }

  for (const t of tasks.slice().reverse()) {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-start gap-2";

    const startTxt = (t.startAt ?? t.start ?? "");
    const endTxt = (t.endAt ?? t.end ?? "");

    li.innerHTML = `
      <div class="me-auto">
        <div class="fw-semibold ${t.completed ? "completed-item" : ""}">${escapeHtml(t.title)}</div>
        <div class="text-muted small">${escapeHtml(t.description || "")}</div>
        <div class="text-muted small">${escapeHtml(startTxt + " → " + endTxt)}</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-success" data-act="toggle" data-id="${t.id}">✔</button>
        <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${t.id}">🗑</button>
      </div>
    `;
    list.appendChild(li);
  }
}

function tasksToEvents(tasks) {
  return tasks
    .map(t => {
      const rawStart = t.startAt ?? t.start;
      const rawEnd = t.endAt ?? t.end;

      const start = toCalendarDate(rawStart);
      const end = toCalendarDate(rawEnd);

      return {
        id: String(t.id),
        title: t.completed ? `✅ ${t.title}` : t.title,
        start,
        end,
      };
    })
    .filter(e => e.start);
}

function initCalendar() {
  if (typeof FullCalendar === "undefined") {
    msg.textContent = "FullCalendar no se ha cargado. Revisa el script CDN en index.html.";
    return;
  }

  const el = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(el, {
    initialView: "timeGridWeek",
    height: "auto",
    nowIndicator: true,
    firstDay: 1,
    editable: true,
    eventDurationEditable: true,
    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },

    eventClick: async (info) => {
      const id = info.event.id;
      const choice = prompt("1 = completar/reabrir\n2 = borrar\nEnter = cancelar");
      try {
        if (choice === "1") await apiToggle(id);
        if (choice === "2") await apiDelete(id);
        await reload();
      } catch (e) {
        alert("Error: " + e.message);
      }
    },

    eventDrop: async (info) => {
      try {
        const taskId = info.event.id;
        const updatedTask = {
          title: info.event.title.replace(/^✅\s*/, ""),
          startAt: toApiDate(info.event.start),
          endAt: toApiDate(info.event.end),
        };

        await apiPut(taskId, updatedTask);
        await reload();
      } catch (e) {
        info.revert();
        alert("No se pudo mover la tarea: " + e.message);
      }
    },

    eventResize: async (info) => {
      try {
        const taskId = info.event.id;
        const updatedTask = {
          title: info.event.title.replace(/^✅\s*/, ""),
          startAt: toApiDate(info.event.start),
          endAt: toApiDate(info.event.end),
        };

        await apiPut(taskId, updatedTask);
        await reload();
      } catch (e) {
        info.revert();
        alert("No se pudo cambiar la duración: " + e.message);
      }
    },
  });

  calendar.render();
}

async function reload() {
  msg.textContent = "";
  try {
    const tasks = await apiGet();

    console.log("TASKS FROM API:", tasks);
    console.log("EVENTS:", tasksToEvents(tasks));

    renderList(tasks);

    if (calendar) {
      calendar.removeAllEvents();
      calendar.addEventSource(tasksToEvents(tasks));
    }
  } catch (e) {
    msg.textContent = "No puedo conectar con la API: " + e.message;
  }
}

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = $("#title").value.trim();
  const description = $("#desc").value.trim();
  const startAt = $("#startAt").value;
  const endAt = $("#endAt").value;

  if (!title) {
    msg.textContent = "El título es obligatorio.";
    return;
  }
  if (!startAt || !endAt) {
    msg.textContent = "Debes indicar inicio y fin.";
    return;
  }
  if (endAt <= startAt) {
    msg.textContent = "El fin debe ser posterior al inicio.";
    return;
  }

  try {
    await apiPost({
      title,
      description,
      startAt,
      endAt,
      start: startAt,
      end: endAt
    });

    $("#title").value = "";
    $("#desc").value = "";
    msg.textContent = "";

    const d = toCalendarDate(startAt);
    if (d && calendar) calendar.gotoDate(d);

    await reload();
  } catch (e2) {
    msg.textContent = "Error al crear: " + e2.message;
  }
});

list.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const act = btn.dataset.act;

  try {
    if (act === "toggle") await apiToggle(id);
    if (act === "del") await apiDelete(id);
    await reload();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

$("#reload").addEventListener("click", reload);
$("#today").addEventListener("click", () => calendar?.today());

initCalendar();
reload();