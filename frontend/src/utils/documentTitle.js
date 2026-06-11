const BASE_TITLE = 'HUST Messenger - Trang web nhắn tin & gọi điện trực tuyến';

let unreadChats = 0;
let unreadNotifs = 0;
let isRinging = false;

function updateTitle() {
  if (isRinging) {
    document.title = `(📞) Cuộc gọi đến... - ${BASE_TITLE}`;
    return;
  }
  
  const total = unreadChats + unreadNotifs;
  if (total > 0) {
    const displayCount = total > 99 ? '99+' : total.toString();
    document.title = `(${displayCount}) ${BASE_TITLE}`;
  } else {
    document.title = BASE_TITLE;
  }
}

export function setUnreadChatsCount(count) {
  unreadChats = count;
  updateTitle();
}

export function setUnreadNotifsCount(count) {
  unreadNotifs = count;
  updateTitle();
}

export function setRingingStatus(ringing) {
  isRinging = ringing;
  updateTitle();
}
