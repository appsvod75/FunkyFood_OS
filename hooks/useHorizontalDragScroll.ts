import React, { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Hook to enable horizontal drag-to-scroll functionality on a container.
 * Supports both mouse and touch events.
 */
export const useHorizontalDragScroll = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const onStart = useCallback((pageX: number) => {
        if (!ref.current) return;
        setIsDragging(true);
        setStartX(pageX - ref.current.offsetLeft);
        setScrollLeft(ref.current.scrollLeft);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    }, []);

    const onMove = useCallback((pageX: number) => {
        if (!isDragging || !ref.current) return;
        const x = pageX - ref.current.offsetLeft;
        const walk = (x - startX) * 1.5;
        ref.current.scrollLeft = scrollLeft - walk;
    }, [isDragging, startX, scrollLeft]);

    const onEnd = useCallback(() => {
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, []);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, select, textarea')) return;
        onStart(e.pageX);
    }, [onStart]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, select, textarea')) return;
        onStart(e.touches[0].pageX);
    }, [onStart]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        onMove(e.pageX);
    }, [isDragging, onMove]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging) return;
        onMove(e.touches[0].pageX);
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
