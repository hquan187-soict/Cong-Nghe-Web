function getTranslation(key) {
  const lang = localStorage.getItem('language') || 'vi';
  const translations = {
    vi: {
      baseTitle: 'HUST Messenger - Trang web nhắn tin & gọi điện trực tuyến',
      incomingCall: '(📞) Cuộc gọi đến...'
    },
    en: {
      baseTitle: 'HUST Messenger - Online Messaging & Calling',
      incomingCall: '(📞) Incoming call...'
    }
  };
  return translations[lang][key];
}

let unreadChats = 0;
let unreadNotifs = 0;
let isRinging = false;

function updateTitle() {
  const baseTitle = getTranslation('baseTitle');
  
  if (isRinging) {
    document.title = `${getTranslation('incomingCall')} - ${baseTitle}`;
    return;
  }
  
  const total = unreadChats + unreadNotifs;
  if (total > 0) {
    const displayCount = total > 99 ? '99+' : total.toString();
    document.title = `(${displayCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
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
