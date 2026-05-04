import { useState, useEffect } from 'react';

/**
 * Custom hook debounce — trì hoãn cập nhật giá trị
 * Dùng cho search input: chỉ gọi API sau khi user ngừng gõ
 * @param {*} value - Giá trị cần debounce
 * @param {number} delay - Thời gian trì hoãn (ms), mặc định 300ms
 * @returns {*} Giá trị đã debounce
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: hủy timer cũ khi value thay đổi
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
