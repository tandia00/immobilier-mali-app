import React, { createContext, useContext } from 'react';
import useUnreadMessagesCount from '../hooks/useUnreadMessagesCount';

const UnreadMessagesContext = createContext(0);

export const UnreadMessagesProvider = ({ children }) => {
  const unreadCount = useUnreadMessagesCount();
  return (
    <UnreadMessagesContext.Provider value={unreadCount}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};

export const useUnreadMessages = () => useContext(UnreadMessagesContext);
