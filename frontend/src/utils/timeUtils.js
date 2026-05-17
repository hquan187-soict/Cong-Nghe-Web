/**
 * Chuyển đổi thời gian thành dạng tương đối (relative time)
 * Ví dụ: "vừa xong", "5 phút", "2 giờ", "Hôm qua", "15/04"
 * @param {string|Date} dateInput - ISO date string hoặc Date object
 * @param {string} lang - Ngôn ngữ ('vi' hoặc 'en'), mặc định 'vi'
 * @returns {string} Thời gian tương đối
 */
export function formatRelativeTime(dateInput, lang = 'vi') {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const labels = {
    vi: {
      justNow: 'Vừa xong',
      minutesAgo: (n) => `${n} phút`,
      hoursAgo: (n) => `${n} giờ`,
      yesterday: 'Hôm qua',
    },
    en: {
      justNow: 'Just now',
      minutesAgo: (n) => `${n}m`,
      hoursAgo: (n) => `${n}h`,
      yesterday: 'Yesterday',
    },
  };

  const l = labels[lang] || labels.vi;

  if (diffSeconds < 60) {
    return l.justNow;
  }

  if (diffMinutes < 60) {
    return l.minutesAgo(diffMinutes);
  }

  if (diffHours < 24) {
    return l.hoursAgo(diffHours);
  }

  if (diffDays === 1) {
    return l.yesterday;
  }

  // Hơn 1 ngày → hiển thị ngày/tháng
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function formatLastActive(dateInput, lang = 'vi') {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (lang === 'vi') {
    if (diffMinutes < 1) return 'Đang hoạt động'
    if (diffMinutes < 60) return `Hoạt động ${diffMinutes} phút trước`
    if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`
    return `Hoạt động ${diffDays} ngày trước`
  }

  if (diffMinutes < 1) return 'Active now'
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`
  if (diffHours < 24) return `Active ${diffHours}h ago`
  return `Active ${diffDays}d ago`
}
