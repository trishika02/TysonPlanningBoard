
let tooltipState = $state({
    visible: false,
    x: 0,
    y: 0,
    content: ''
});

export const tooltipStore = {
    get state() { return tooltipState; },
    show(x, y, content) {
        tooltipState.visible = true;
        tooltipState.x = x;
        tooltipState.y = y;
        tooltipState.content = content;
    },
    hide() {
        tooltipState.visible = false;
    },
    move(x, y) {
        tooltipState.x = x;
        tooltipState.y = y;
    }
};
