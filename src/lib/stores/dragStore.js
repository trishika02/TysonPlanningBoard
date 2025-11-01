import { writable } from 'svelte/store';

function createDragStore() {
    const { subscribe, set, update } = writable({
        draggedTaskId: null,
        originalLineId: null,
        draggedTaskDuration: 0,
        taskOffsetLeft: 0,
        isDragging: false,
        ghostPosition: null,
        ghostIsValid: true,
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
                ghostIsValid: true,
            });
        },
        updateGhost: (position, isValid) => {
            update(state => ({
                ...state,
                ghostPosition: position,
                ghostIsValid: isValid,
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
                ghostIsValid: true,
            });
        },
    };
}

export const dragStore = createDragStore();