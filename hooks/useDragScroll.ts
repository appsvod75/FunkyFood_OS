import React, { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Hook to enable drag-to-scroll functionality on a container.
 * Supports both mouse and touch events.
 */
export const useDragScroll = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const onStart = useCallback((pageY: number) => {
        if (!ref.current) return;
        setIsDragging(true);
        setStartY(pageY - ref.current.offsetTop);
        setScrollTop(ref.current.scrollTop);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    }, []);

    const onMove = useCallback((pageY: number) => {
        if (!isDragging || !ref.current) return;
        const y = pageY - ref.current.offsetTop;
        const walk = (y - startY) * 1.5;
        ref.current.scrollTop = scrollTop - walk;
    }, [isDragging, startY, scrollTop]);

    const onEnd = useCallback(() => {
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, []);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, select, textarea')) return;
        onStart(e.pageY);
    }, [onStart]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, select, textarea')) return;
        onStart(e.touches[0].pageY);
    }, [onStart]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        onMove(e.pageY);
    }, [isDragging, onMove]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging) return;
        // Optimization: only prevent default if we're actually dragging
        onMove(e.touches[0].pageY);
    }, [isDragging, onMove]);

    const onMouseUp = onEnd;
    const onTouchEnd = onEnd;
    const onMouseLeave = onEnd;

    useEffect(() => {
        return () => {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, []);

    return {
        ref,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseLeave,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        isDragging
    };
};
