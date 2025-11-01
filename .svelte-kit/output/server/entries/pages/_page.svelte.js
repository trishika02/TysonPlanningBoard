import "clsx";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div id="app" class="flex h-screen w-full"><div id="sidebar" class="sticky-sidebar flex-shrink-0 bg-white shadow-lg"><div class="h-auto md:h-24 border-b border-gray-200 flex flex-col justify-center p-4 sticky-header bg-white"><h2 class="text-lg font-bold text-gray-700 text-center">Lines</h2> <div class="mt-2 space-y-2"><div class="flex space-x-2"><input type="date" id="date-picker" class="text-xs p-1 border rounded w-full"/> <button id="go-to-date-btn" class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded">Go</button></div> <button id="go-to-today-btn" class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 w-full px-2 py-1 rounded">Go to Today</button></div></div> <div id="sidebar-rows" class="divide-y divide-gray-200"></div></div> <div id="main-content" class="flex-1 flex flex-col"><div id="calendar-header" class="sticky-header flex-shrink-0 bg-white shadow z-10"><div id="calendar-dates" class="flex"></div></div> <div id="calendar-body" class="flex-1 calendar-scroll"><div id="calendar-grid" class="relative min-w-max"></div></div></div></div> <div id="loading-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50"><div class="bg-white p-6 rounded-lg shadow-xl"><div class="text-lg font-semibold">Loading Planner...</div></div></div> <div id="tooltip" class="fixed z-50 hidden px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm" role="tooltip"></div>`);
  });
}
export {
  _page as default
};
