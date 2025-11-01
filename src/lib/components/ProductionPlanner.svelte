<script>
  import { onMount } from "svelte";

  export let rows = [];
  export let dates = [];
  export let blockedDays = [];
  export let workingHours = {}; // { Mon:[{start:9,end:13},{start:14,end:18}], ... }

  export let onTaskUpdate = () => {};
  export let onTaskCreate = () => {};

  let draggedTask = null;
  let ghostTask = null;
  let draggedTaskDuration = 0;

  const dayKey = d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];

  // ✅ check if this is a blocked holiday/off-day
  function isBlocked(date) {
    return blockedDays.some(b => b.toDateString() === date.toDateString());
  }

  // ✅ convert HH:MM into minutes
  function t2m(hours) { return hours * 60; }

  // ✅ get total work minutes for a date
  function getDayMinutes(date) {
    const k = dayKey(date);
    if (!workingHours[k]) return 0;
    return workingHours[k].reduce((t,b)=>t + (t2m(b.end) - t2m(b.start)),0);
  }

  // ✅ find next valid working datetime forward
  function nextWorkStart(date) {
    let d = new Date(date);
    while (true) {
      let k = dayKey(d);
      if (!isBlocked(d) && workingHours[k]?.length) {
        const first = workingHours[k][0];
        return new Date(d.getFullYear(),d.getMonth(),d.getDate(),first.start,0);
      }
      d.setDate(d.getDate()+1);
    }
  }

  // ✅ snap a datetime inside working windows
  function snapToWorkingTime(date) {
    const k = dayKey(date);
    const blocks = workingHours[k];
    if (!blocks) return nextWorkStart(date);

    const totalMin = date.getHours()*60 + date.getMinutes();

    for (const block of blocks) {
      const s = t2m(block.start);
      const e = t2m(block.end);

      if (totalMin < s)
        return new Date(date.getFullYear(),date.getMonth(),date.getDate(),block.start,0);
      if (totalMin >= s && totalMin < e)
        return date;
    }
    // past end → move to next workday
    return nextWorkStart(new Date(date.getFullYear(),date.getMonth(),date.getDate()+1));
  }

  // ✅ Given start + required work minutes → calculate end
  function calcEnd(start, minsNeeded) {
    let remaining = minsNeeded;
    let cur = new Date(start);

    while (remaining > 0) {
      const k = dayKey(cur);
      const blocks = workingHours[k];
      if (!blocks || isBlocked(cur)) {
        cur = nextWorkStart(cur);
        continue;
      }

      // which block is cur in?
      let moved = false;
      for (const block of blocks) {
        let bs = t2m(block.start);
        let be = t2m(block.end);
        let curMin = cur.getHours()*60 + cur.getMinutes();

        // if before block start → jump in
        if (curMin < bs) {
          cur = new Date(cur.getFullYear(),cur.getMonth(),cur.getDate(),block.start,0);
          curMin = bs;
        }

        if (curMin >= bs && curMin < be) {
          const canDo = be - curMin;
          if (remaining <= canDo) {
            return new Date(cur.getTime() + remaining*60000);
          }
          remaining -= canDo;
          cur = new Date(cur.getFullYear(),cur.getMonth(),cur.getDate(),block.end,0);
          moved = true;
        }
      }

      if (!moved) {
        cur = nextWorkStart(new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+1));
      }
    }

    return cur;
  }

  // ✅ map X position to datetime
  function columnToDate(col) {
    return new Date(dates[col]);
  }

  // ✅ map date to column (day index)
  function dateToCol(date) {
    return dates.findIndex(d => d.toDateString() === date.toDateString());
  }

  // === DRAG EVENTS ===

  function handleDragStart(e, task, row, date) {
    draggedTask = { ...task, row };
    draggedTaskDuration = task.workMinutes;
  }

  function handleDragOver(e, row, date) {
    e.preventDefault();
    if (!draggedTask) return;

    let start = snapToWorkingTime(new Date(date));    
    let end = calcEnd(start, draggedTaskDuration);

    ghostTask = {
      row: row.id,
      start,
      end,
      col: dateToCol(start),
      colEnd: dateToCol(end)
    };
  }

  function handleDrop(e, row) {
    if (!ghostTask) return;

    onTaskUpdate({
      id: draggedTask.id,
      row: row.id,
      start: ghostTask.start,
      end: ghostTask.end,
      workMinutes: draggedTaskDuration
    });

    ghostTask = null;
    draggedTask = null;
  }
</script>

<style>
  .planner { font-family: sans-serif; user-select: none; }
  .header { display: grid; font-weight: bold; background: #f1f1f1; }
  .row { position: relative; height: 60px; border-bottom:1px solid #eee; display:grid; }
  .cell { border-right:1px solid #eee; }
  .blocked { background: repeating-linear-gradient(45deg,#eee,#eee 6px,#ccc 6px,#ccc 12px); }
  .task { position:absolute; height:38px; top:10px; border-radius:6px; background:#4C7AF2; }
  .ghost { opacity: .4; border:2px dashed #000; background:transparent; }
</style>

<div class="planner">
  <div class="header" style="grid-template-columns:repeat({dates.length},1fr)">
    {#each dates as d}
      <div>{d.toLocaleDateString()}</div>
    {/each}
  </div>

  {#each rows as row}
    <div class="row" style="grid-template-columns:repeat({dates.length},1fr)">
      
      {#each dates as date}
        <div class="cell {isBlocked(date) ? 'blocked':''}"
          on:dragover={(e)=>handleDragOver(e,row,date)}
          on:drop={(e)=>handleDrop(e,row)}>
        </div>
      {/each}

      {#each row.tasks as t}
        <div
          class="task"
          style="left:{dateToCol(new Date(t.start))*100}%; width:{(dateToCol(new Date(t.end))-dateToCol(new Date(t.start))+1)*100}%"
          draggable="true"
          on:dragstart={(e)=>handleDragStart(e,t,row)}>
        </div>
      {/each}

      {#if ghostTask && ghostTask.row===row.id}
        <div class="task ghost"
          style="left:{ghostTask.col*100}%;width:{(ghostTask.colEnd-ghostTask.col+1)*100}%">
        </div>
      {/if}

    </div>
  {/each}
</div>
