import { s as store_get, a as attr, e as ensure_array_like, b as attr_style, u as unsubscribe_stores, c as stringify, d as attr_class, f as bind_props, h as head } from "../../../chunks/index2.js";
import { X as escape_html, Y as fallback } from "../../../chunks/context.js";
import { d as derived, w as writable } from "../../../chunks/index.js";
import "clsx";
const CONFIG = {
  NUM_DAYS_DEFAULT: 60,
  DAY_COLUMN_WIDTH: 200,
  ROW_HEIGHT: 100,
  START_HOUR: 8
};
const WORK_HOURS = {
  SUNDAY: 0,
  MONDAY: 10,
  TUESDAY: 10,
  WEDNESDAY: 10,
  THURSDAY: 10,
  FRIDAY: 8,
  SATURDAY: 0
};
function getWorkHoursPerDay(dayOfWeek) {
  const hours = [
    WORK_HOURS.SUNDAY,
    WORK_HOURS.MONDAY,
    WORK_HOURS.TUESDAY,
    WORK_HOURS.WEDNESDAY,
    WORK_HOURS.THURSDAY,
    WORK_HOURS.FRIDAY,
    WORK_HOURS.SATURDAY
  ];
  return hours[dayOfWeek] || 0;
}
function formatDate(date, format) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  if (format === "ddd") return dayNames[date.getDay()];
  if (format === "MMM YYYY") return `${monthNames[date.getMonth()]} ${year}`;
  if (format === "HH:mm") return `${hours}:${minutes}`;
  if (format === "YYYY-MM-DD HH:mm") return `${year}-${month}-${day} ${hours}:${minutes}`;
  return date.toLocaleString();
}
function generateCalendarDays(startDate, numDays, holidays) {
  const days = [];
  const currentDate = new Date(startDate);
  for (let i = 0; i < numDays; i++) {
    const date = new Date(currentDate);
    const dayOfWeek = date.getDay();
    const workHours = getWorkHoursPerDay(dayOfWeek);
    const isWeekend = workHours === 0;
    const isHoliday = holidays.includes(formatDate(date, "YYYY-MM-DD"));
    const isBlocked = isWeekend || isHoliday;
    days.push({
      date,
      dayOfWeek,
      workHours,
      isBlocked,
      isToday: i === 0
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return days;
}
function createPlanningStore() {
  const { subscribe, set, update } = writable({
    lines: [],
    tasks: [],
    holidays: [],
    today: /* @__PURE__ */ new Date(),
    numDaysToShow: CONFIG.NUM_DAYS_DEFAULT,
    isLoading: true
  });
  return {
    subscribe,
    setData: (lines, tasks, holidays) => {
      update((state) => ({
        ...state,
        lines,
        tasks,
        holidays,
        isLoading: false
      }));
    },
    updateTask: (taskId, updates) => {
      update((state) => ({
        ...state,
        // Create a NEW array with the updated task (immutable update)
        tasks: state.tasks.map(
          (t) => t.id === taskId ? { ...t, ...updates } : t
        )
      }));
    },
    setToday: (date) => {
      update((state) => ({ ...state, today: date }));
    },
    loadMoreDays: () => {
      update((state) => ({ ...state, numDaysToShow: state.numDaysToShow + 30 }));
    },
    setLoading: (isLoading) => {
      update((state) => ({ ...state, isLoading }));
    }
  };
}
const planningStore = createPlanningStore();
const calendarDays = derived(
  planningStore,
  ($store) => generateCalendarDays($store.today, $store.numDaysToShow, $store.holidays)
);
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let lines;
    let datePickerValue = "";
    lines = store_get($$store_subs ??= {}, "$planningStore", planningStore).lines;
    $$renderer2.push(`<div class="sticky left-0 z-20 flex-shrink-0 bg-white shadow-lg"><div class="h-auto md:h-24 border-b border-gray-200 flex flex-col justify-center p-4 sticky top-0 bg-white"><h2 class="text-lg font-bold text-gray-700 text-center">Lines</h2> <div class="mt-2 space-y-2"><div class="flex space-x-2"><input type="date"${attr("value", datePickerValue)} class="text-xs p-1 border rounded w-full"/> <button class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded">Go</button></div> <button class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 w-full px-2 py-1 rounded">Go to Today</button></div></div> <div class="divide-y divide-gray-200"><!--[-->`);
    const each_array = ensure_array_like(lines);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let line = each_array[$$index];
      $$renderer2.push(`<div class="flex items-center p-4 border-b border-gray-200"${attr_style(`height: ${stringify(CONFIG.ROW_HEIGHT)}px`)}>${escape_html(line.name)}</div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function CalendarHeader($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    $$renderer2.push(`<div class="sticky top-0 z-10 flex-shrink-0 bg-white shadow"><div class="flex"><!--[-->`);
    const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$calendarDays", calendarDays));
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let day = each_array[$$index];
      $$renderer2.push(`<div${attr_class(`flex-shrink-0 text-center border-l border-b border-gray-200 p-2 ${stringify(day.isBlocked ? "bg-gray-200 text-gray-500" : "bg-white")} ${stringify(day.isToday ? "bg-blue-100" : "")}`)}${attr_style(`width: ${stringify(CONFIG.DAY_COLUMN_WIDTH)}px`)}><div${attr_class(`font-semibold text-sm ${stringify(day.isToday ? "text-blue-700" : "text-gray-800")}`)}>${escape_html(formatDate(day.date, "ddd"))}</div> <div${attr_class(`text-xl font-bold ${stringify(day.isToday ? "text-blue-900" : "text-gray-900")}`)}>${escape_html(day.date.getDate())}</div> <div class="text-xs text-gray-500">${escape_html(formatDate(day.date, "MMM YYYY"))}</div> <div${attr_class(`text-xs font-medium mt-1 ${stringify(day.isBlocked ? "text-red-600" : "text-green-600")}`)}>`);
      if (day.isBlocked) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`${escape_html(day.isHoliday ? "Holiday" : "Weekend")}`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`${escape_html(day.workHours)} Hours`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="flex-shrink-0 text-center border-l border-b border-gray-200 p-2 bg-gray-50 hover:bg-gray-100 cursor-pointer flex flex-col justify-center items-center" style="width: 120px" role="button" tabindex="0"><div class="font-semibold text-sm text-blue-600">Load More</div> <div class="text-xs text-gray-500 mt-2">(${escape_html(store_get($$store_subs ??= {}, "$planningStore", planningStore).numDaysToShow)} days shown)</div></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function createDragStore() {
  const { subscribe, set, update } = writable({
    draggedTaskId: null,
    originalLineId: null,
    draggedTaskDuration: 0,
    taskOffsetLeft: 0,
    isDragging: false,
    ghostPosition: null,
    ghostIsValid: true
  });
  return {
    subscribe,
    startDrag: (taskId, lineId, duration, offsetLeft) => {
      set({
        draggedTaskId: taskId,
        originalLineId: lineId,
        draggedTaskDuration: duration,
        taskOffsetLeft: offsetLeft,
        isDragging: true,
        ghostPosition: null,
        ghostIsValid: true
      });
    },
    updateGhost: (position, isValid) => {
      update((state) => ({
        ...state,
        ghostPosition: position,
        ghostIsValid: isValid
      }));
    },
    endDrag: () => {
      set({
        draggedTaskId: null,
        originalLineId: null,
        draggedTaskDuration: 0,
        taskOffsetLeft: 0,
        isDragging: false,
        ghostPosition: null,
        ghostIsValid: true
      });
    }
  };
}
const dragStore = createDragStore();
function getPixelOffsetForDate(date, calendarDays2) {
  const dateObj = new Date(date);
  const dateStr = formatDate(dateObj, "YYYY-MM-DD");
  const dayIndex = calendarDays2.findIndex((d) => formatDate(d.date, "YYYY-MM-DD") === dateStr);
  if (dayIndex === -1) return null;
  const day = calendarDays2[dayIndex];
  if (day.isBlocked || day.workHours === 0) {
    return dayIndex * CONFIG.DAY_COLUMN_WIDTH;
  }
  const totalWorkMinutes = day.workHours * 60;
  const dayWorkStart = new Date(day.date);
  dayWorkStart.setHours(CONFIG.START_HOUR, 0, 0, 0);
  const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 6e4);
  const effectiveTime = new Date(Math.max(dayWorkStart.getTime(), Math.min(dayWorkEnd.getTime(), dateObj.getTime())));
  let taskOffsetMinutes = (effectiveTime.getTime() - dayWorkStart.getTime()) / (1e3 * 60);
  const leftPercent = taskOffsetMinutes / totalWorkMinutes;
  const leftPixelOffset = leftPercent * CONFIG.DAY_COLUMN_WIDTH;
  return dayIndex * CONFIG.DAY_COLUMN_WIDTH + leftPixelOffset;
}
function Task($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let lines, days, taskStart, taskEnd, lineIndex, startPixel, endPixel, width, visible, isDragging;
    let task = $$props["task"];
    lines = store_get($$store_subs ??= {}, "$planningStore", planningStore).lines;
    days = store_get($$store_subs ??= {}, "$calendarDays", calendarDays);
    taskStart = new Date(task.start);
    taskEnd = new Date(task.end);
    lineIndex = lines.findIndex((l) => l.id === task.lineId);
    startPixel = getPixelOffsetForDate(taskStart, days);
    endPixel = getPixelOffsetForDate(taskEnd, days);
    width = endPixel && startPixel ? endPixel - startPixel : 0;
    visible = lineIndex !== -1 && startPixel !== null && width > 0;
    isDragging = store_get($$store_subs ??= {}, "$dragStore", dragStore).draggedTaskId === task.id;
    if (visible) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div${attr("id", `${stringify(task.id)}-task`)}${attr("data-task-id", task.id)}${attr_class("task absolute bg-blue-600 border border-blue-800 rounded-lg p-2 text-white shadow-md overflow-hidden cursor-grab active:cursor-grabbing svelte-1r92bhv", void 0, { "dragging": isDragging })}${attr_style(`left: ${stringify(startPixel)}px; top: ${stringify(lineIndex * CONFIG.ROW_HEIGHT + 10)}px; width: ${stringify(width)}px; height: ${stringify(CONFIG.ROW_HEIGHT - 20)}px;`)} draggable="true"${attr("data-tooltip-content", `<strong>Order:</strong> ${stringify(task.orderId)}<br><strong>Style:</strong> ${stringify(task.style)}<br><strong>Qty:</strong> ${stringify(task.quantity)}<br><strong>Start:</strong> ${stringify(formatDate(taskStart, "YYYY-MM-DD HH:mm"))}<br><strong>End:</strong> ${stringify(formatDate(taskEnd, "YYYY-MM-DD HH:mm"))}`)} role="button" tabindex="0"><div class="font-bold text-sm truncate">${escape_html(task.orderId)}</div> <div class="text-xs truncate">${escape_html(task.style)}</div> <div class="text-xs truncate">Qty: ${escape_html(task.quantity)}</div></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
    bind_props($$props, { task });
  });
}
function CalendarGrid($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let lines, tasks, days;
    function getGridLineStyles(day) {
      if (day.workHours === 0) return { faint: "none", strong: "none" };
      const percentPerHr = 100 / day.workHours;
      return {
        faint: `repeating-linear-gradient(to right, #f0f0f0 0, #f0f0f0 1px, transparent 1px, transparent ${percentPerHr}%)`,
        strong: `repeating-linear-gradient(to right, #a5b4fc 0, #a5b4fc 1px, transparent 1px, transparent ${percentPerHr}%)`
      };
    }
    lines = store_get($$store_subs ??= {}, "$planningStore", planningStore).lines;
    tasks = store_get($$store_subs ??= {}, "$planningStore", planningStore).tasks;
    days = store_get($$store_subs ??= {}, "$calendarDays", calendarDays);
    $$renderer2.push(`<div class="flex-1 overflow-x-auto"><div class="relative min-w-max"><!--[-->`);
    const each_array = ensure_array_like(days);
    for (let dayIndex = 0, $$length = each_array.length; dayIndex < $$length; dayIndex++) {
      let day = each_array[dayIndex];
      $$renderer2.push(`<!--[-->`);
      const each_array_1 = ensure_array_like(lines);
      for (let lineIndex = 0, $$length2 = each_array_1.length; lineIndex < $$length2; lineIndex++) {
        let line = each_array_1[lineIndex];
        const gridLines = getGridLineStyles(day);
        const cellId = `cell-${line.id}-${formatDate(day.date, "YYYY-MM-DD")}`;
        $$renderer2.push(`<div${attr("id", cellId)}${attr_class(`absolute border-r border-b border-gray-200 grid-cell ${stringify(day.isBlocked ? "bg-gray-100" : "bg-white")}`)}${attr_style(`left: ${stringify(dayIndex * CONFIG.DAY_COLUMN_WIDTH)}px; top: ${stringify(lineIndex * CONFIG.ROW_HEIGHT)}px; width: ${stringify(CONFIG.DAY_COLUMN_WIDTH)}px; height: ${stringify(CONFIG.ROW_HEIGHT)}px; --grid-lines-faint: ${stringify(gridLines.faint)}; --grid-lines-strong: ${stringify(gridLines.strong)}; background-image: var(--grid-lines-faint, none);`)}${attr("data-line-id", line.id)}${attr("data-date", formatDate(day.date, "YYYY-MM-DD"))}${attr("data-is-blocked", day.isBlocked)} role="gridcell" tabindex="-1"></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array_2 = ensure_array_like(tasks);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let task = each_array_2[$$index_2];
      Task($$renderer2, { task });
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function GhostTask($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let position, isValid, visible;
    position = store_get($$store_subs ??= {}, "$dragStore", dragStore).ghostPosition;
    isValid = store_get($$store_subs ??= {}, "$dragStore", dragStore).ghostIsValid;
    visible = store_get($$store_subs ??= {}, "$dragStore", dragStore).isDragging && position;
    if (visible) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div id="ghost-task"${attr_class(`absolute z-50 opacity-70 border-2 border-dashed pointer-events-none rounded-lg p-2 box-border ${stringify(isValid ? "bg-blue-100 border-blue-500" : "bg-red-100 border-red-500")}`)}${attr_style(`left: ${stringify(position.left)}px; top: ${stringify(position.top)}px; width: ${stringify(position.width)}px; height: ${stringify(position.height)}px;`)}></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function Tooltip($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function LoadingModal($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    if (store_get($$store_subs ??= {}, "$planningStore", planningStore).isLoading) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50"><div class="bg-white p-6 rounded-lg shadow-xl"><div class="text-lg font-semibold">Loading Planner...</div></div></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function PlanningBoard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let initialLines = fallback($$props["initialLines"], () => [], true);
    let initialTasks = fallback($$props["initialTasks"], () => [], true);
    let initialHolidays = fallback($$props["initialHolidays"], () => [], true);
    $$renderer2.push(`<div class="flex h-screen w-full bg-gray-100">`);
    Sidebar($$renderer2);
    $$renderer2.push(`<!----> <div class="flex-1 flex flex-col">`);
    CalendarHeader($$renderer2);
    $$renderer2.push(`<!----> `);
    CalendarGrid($$renderer2);
    $$renderer2.push(`<!----></div></div> `);
    GhostTask($$renderer2);
    $$renderer2.push(`<!----> `);
    Tooltip($$renderer2);
    $$renderer2.push(`<!----> `);
    LoadingModal($$renderer2);
    $$renderer2.push(`<!---->`);
    bind_props($$props, { initialLines, initialTasks, initialHolidays });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const MOCK_LINES = [
      { id: "line-1", name: "Line 01" },
      { id: "line-2", name: "Line 02" },
      { id: "line-3", name: "Line 03" },
      { id: "line-4", name: "Line 04 (Sewing)" },
      { id: "line-5", name: "Line 05" },
      { id: "line-6", name: "Line 06 (Finishing)" }
    ];
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today, "YYYY-MM-DD");
    const MOCK_TASKS = [
      {
        id: "task-101",
        lineId: "line-1",
        orderId: "PO-4567",
        style: "T-Shirt (Red)",
        quantity: 500,
        start: `${todayStr}T09:00:00`,
        end: `${todayStr}T13:30:00`
      },
      {
        id: "task-102",
        lineId: "line-1",
        orderId: "PO-4568",
        style: "Polo (Blue)",
        quantity: 300,
        start: `${todayStr}T14:00:00`,
        end: `${todayStr}T17:00:00`
      },
      {
        id: "task-103",
        lineId: "line-2",
        orderId: "PO-4569",
        style: "Jeans (Black)",
        quantity: 1200,
        start: "2025-11-03T09:00:00",
        end: "2025-11-06T17:00:00"
      },
      {
        id: "task-104",
        lineId: "line-3",
        orderId: "PO-4570",
        style: "Jacket (Denim)",
        quantity: 250,
        start: "2025-11-03T11:30:00",
        end: "2025-11-03T16:00:00"
      },
      {
        id: "task-105",
        lineId: "line-4",
        orderId: "PO-4571",
        style: "Shorts (Cargo)",
        quantity: 800,
        start: "2025-11-05T10:00:00",
        end: "2025-11-05T18:00:00"
      }
    ];
    const MOCK_HOLIDAYS = ["2025-12-16", "2025-12-25", "2026-01-01"];
    head("1x1wh5u", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Garments Production Planning Board</title>`);
      });
      $$renderer3.push(`<script src="https://cdn.tailwindcss.com"><\/script><!---->`);
    });
    PlanningBoard($$renderer2, {
      initialLines: MOCK_LINES,
      initialTasks: MOCK_TASKS,
      initialHolidays: MOCK_HOLIDAYS
    });
  });
}
export {
  _page as default
};
